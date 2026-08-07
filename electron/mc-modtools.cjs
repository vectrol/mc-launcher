const path = require('path');
const { VERSIONS_DIR } = require('./mc-api.cjs');
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
    } catch {}
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

module.exports = { checkModsForUpdates, detectModConflicts };
