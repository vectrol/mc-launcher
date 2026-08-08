const path = require('path');
const { VERSIONS_DIR, logWarn } = require('./mc-api.cjs');
const { getModrinthVersions, searchModrinth } = require('./mc-online.cjs');

// ─── Mod update detection ──────────────────────────────────
// Map mod jar filename -> Modrinth project via search, then compare versions

const slugCache = new Map();

function slugify(name) {
  // "Some-Mod-1.2.3.jar" -> "some-mod"
  return name
    .replace(/\.jar$/i, '')
    .replace(/\b(\d+\.)*\d+(-fabric|-forge|-neoforge|-quilt)?$/i, '')
    .replace(/[-_]+/g, '-')
    .toLowerCase()
    .replace(/^[-_]+|[-_]+$/g, '');
}

async function resolveSlug(filename) {
  const slug = slugify(filename);
  if (slugCache.has(slug)) return slugCache.get(slug);
  try {
    const res = await searchModrinth(slug, 0, 'mod');
    const hit = res.hits.find(h => slugify(h.slug) === slug) || res.hits[0];
    const result = hit ? hit.slug : null;
    slugCache.set(slug, result);
    return result;
  } catch { return null; }
}

async function checkModsForUpdates(versionId) {
  const modsDir = path.join(VERSIONS_DIR, versionId, 'mods');
  const fs = require('fs');
  if (!fs.existsSync(modsDir)) return [];

  const jars = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));
  const results = [];

  // Detect filename version for local comparison
  const versionRegex = /(\d+\.\d+(?:\.\d+)?(?:[a-zA-Z.]*\d*)?)/;

  for (const jar of jars) {
    const slug = await resolveSlug(jar);
    if (!slug) continue;
    try {
      const versions = await getModrinthVersions(slug);
      if (versions.length === 0) continue;
      const latest = versions[0];
      // Compare local filename version with latest
      const localMatch = jar.match(versionRegex);
      const localVer = localMatch ? localMatch[1] : '';
      const latestVer = latest.version || '';
      const isNewer = latestVer && localVer && latestVer !== localVer;
      results.push({
        fileName: jar,
        slug,
        name: latest.name || slug,
        localVersion: localVer,
        latestVersion: latestVer,
        hasUpdate: !!isNewer,
        latestFile: latest.files.find(f => f.primary) || latest.files[0],
      });
    } catch (e) { logWarn('Modtools', 'caught', e) }
  }
  return results;
}

// ─── Mod conflict detection ────────────────────────────────
// Detect duplicate base names (same mod, different version) in mods dir

function detectModConflicts(versionId) {
  const fs = require('fs');
  const modsDir = path.join(VERSIONS_DIR, versionId, 'mods');
  if (!fs.existsSync(modsDir)) return [];

  const jars = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));
  const groups = new Map();

  for (const jar of jars) {
    const base = slugify(jar);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(jar);
  }

  const conflicts = [];
  for (const [base, files] of groups) {
    if (files.length > 1) {
      conflicts.push({ base, files });
    }
  }
  return conflicts;
}

// ─── Batch mod update with backup ──────────────────────────
// Download latest for all updateable mods, backup originals first

async function updateAllMods(versionId, onProgress) {
  const fs = require('fs');
  const path = require('path');
  const modsDir = path.join(VERSIONS_DIR, versionId, 'mods');
  const backupDir = path.join(VERSIONS_DIR, versionId, 'mods-backup');
  if (!fs.existsSync(modsDir)) return { updated: 0, failed: 0 };

  const updates = await checkModsForUpdates(versionId);
  const toUpdate = updates.filter(u => u.hasUpdate && u.latestFile);
  let updated = 0, failed = 0;

  if (toUpdate.length === 0) return { updated: 0, failed: 0 };

  // Backup originals
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupSub = path.join(backupDir, stamp);
  fs.mkdirSync(backupSub, { recursive: true });
  for (const u of toUpdate) {
    const src = path.join(modsDir, u.fileName);
    if (fs.existsSync(src)) {
      try { fs.copyFileSync(src, path.join(backupSub, u.fileName)); } catch (e) { logWarn('Modtools', 'caught', e) }
    }
  }

  for (let i = 0; i < toUpdate.length; i++) {
    const u = toUpdate[i];
    onProgress({ current: i + 1, total: toUpdate.length, name: u.name, percent: Math.round(((i) / toUpdate.length) * 100) });
    try {
      const dest = path.join(modsDir, u.latestFile.name);
      const { downloadFile } = require('./mc-downloads.cjs');
      await downloadFile(u.latestFile.url, dest);
      // Remove old version
      const old = path.join(modsDir, u.fileName);
      if (old !== dest && fs.existsSync(old)) fs.unlinkSync(old);
      updated++;
    } catch { failed++; }
  }
  onProgress({ current: toUpdate.length, total: toUpdate.length, name: '', percent: 100 });
  return { updated, failed, backupDir: backupSub };
}

module.exports = { checkModsForUpdates, detectModConflicts, updateAllMods,

  // Recursive dependency tree for a mod version
  async getModDependencyTree(slug, depth = 0) {
    const { getModrinthDependencies, getModrinthVersionFile, getModrinthVersions } = require('./mc-online.cjs');
    if (depth > 3) return [];
    try {
      const versions = await getModrinthVersions(slug);
      if (versions.length === 0) return [];
      const latest = versions[0];
      const deps = await getModrinthDependencies(latest.id);
      const tree = [];
      for (const dep of deps) {
        try {
          const file = await getModrinthVersionFile(dep.versionId);
          // Resolve project slug from version id
          const https = require('https');
          const proj = await new Promise((resolve) => {
            https.get(`https://api.modrinth.com/v2/version/${dep.versionId}`, { headers: { 'User-Agent': 'MCLauncher' } }, (res) => {
              let d = '';
              res.on('data', c => d += c);
              res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
            }).on('error', () => resolve(null));
          });
          const childSlug = proj?.project_id || dep.projectId;
          tree.push({
            projectId: dep.projectId,
            slug: childSlug,
            versionId: dep.versionId,
            fileName: file?.name || '',
            fileUrl: file?.url || '',
            depth,
            children: await module.exports.getModDependencyTree(childSlug, depth + 1),
          });
        } catch (e) { logWarn('Modtools', 'caught', e) }
      }
      return tree;
    } catch { return []; }
  },
};
