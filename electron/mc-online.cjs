const https = require('https');
const { logWarn } = require('./mc-api.cjs');

// ─── Mirror support ────────────────────────────────────────
// official: api.modrinth.com + cdn.modrinth.com
// kuvako:   modrinth.kuvako.de (community proxy, faster in China)

function getMirror() {
  try {
    const { loadSettings } = require('./mc-settings.cjs');
    return loadSettings().modrinthMirror || 'official';
  } catch { return 'official'; }
}

function apiBase() {
  return getMirror() === 'kuvako' ? 'https://modrinth.kuvako.de/api/v2' : 'https://api.modrinth.com/v2';
}

function cdnBase() {
  return getMirror() === 'kuvako' ? 'https://modrinth.kuvako.de' : 'https://cdn.modrinth.com';
}

function httpGetJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'MCLauncher/3.1' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGetJSON(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf-8');
          resolve(JSON.parse(text));
        } catch { reject(new Error('Invalid JSON response')); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ─── Minecraft News ────────────────────────────────────────

async function getMinecraftNews() {
  try {
    // Get version manifest for recent releases
    const manifest = await httpGetJSON('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    const recentReleases = manifest.versions
      .filter((v) => v.type === 'release')
      .sort((a, b) => new Date(b.releaseTime).getTime() - new Date(a.releaseTime).getTime())
      .slice(0, 5);

    const articles = [];
    for (const ver of recentReleases) {
      try {
        const versionData = await httpGetJSON(ver.url);
        articles.push({
          id: ver.id,
          title: `Minecraft ${ver.id} Released`,
          body: versionData.releaseNotes || `Minecraft Java Edition ${ver.id} has been released.`,
          date: ver.releaseTime,
          url: `https://www.minecraft.net/en-us/article/minecraft-java-edition-${ver.id.replace(/\./g, '-')}`,
          type: 'release',
        });
      } catch (e) { logWarn('Online', 'caught', e) }
    }

    // Deduplicate and sort
    const seen = new Set();
    return articles.filter((a) => {
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
  } catch {
    return [];
  }
}

// ─── Modrinth ──────────────────────────────────────────────
// projectType: 'mod' | 'shader' | 'resourcepack' | 'modpack' | 'datapack'

function projectTypeFacet(type) {
  const t = type || 'mod';
  return `[["project_type:${t}"]]`;
}

function mapHit(h) {
  return {
    id: h.project_id,
    slug: h.slug,
    title: h.title,
    description: h.description,
    icon: h.icon_url,
    downloads: h.downloads,
    follows: h.follows,
    categories: h.categories || [],
    author: h.author,
    updated: h.date_modified,
    projectType: h.project_type,
  };
}

async function searchModrinth(query, page = 0, projectType = 'mod') {
  const offset = page * 20;
  const url = `${apiBase()}/search?query=${encodeURIComponent(query)}&limit=20&offset=${offset}&facets=${encodeURIComponent(projectTypeFacet(projectType))}`;
  const data = await httpGetJSON(url);
  return {
    hits: (data.hits || []).map(mapHit),
    total: data.total_hits || 0,
  };
}

async function getModrinthPopular(projectType = 'mod') {
  const url = `${apiBase()}/search?limit=24&offset=0&facets=${encodeURIComponent(projectTypeFacet(projectType))}&index=downloads`;
  const data = await httpGetJSON(url);
  return {
    hits: (data.hits || []).map(mapHit),
  };
}

async function getModrinthMod(slug) {
  const data = await httpGetJSON(`${apiBase()}/project/${encodeURIComponent(slug)}`);
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description,
    body: data.body,
    icon: data.icon_url,
    downloads: data.downloads,
    follows: data.follows,
    categories: data.categories || [],
    author: data.author,
    updated: data.updated,
    issues: data.issues_url,
    source: data.source_url,
    license: data.license?.name,
    gallery: data.gallery || [],
  };
}

async function getModrinthVersions(slug, mcVersion, projectType = 'mod') {
  let url = `${apiBase()}/project/${encodeURIComponent(slug)}/version`;
  if (projectType === 'mod') url += '?loaders=["fabric","forge","quilt","neoforge"]';
  if (mcVersion && mcVersion !== 'undefined') url += (url.includes('?') ? '&' : '?') + `game_versions=["${mcVersion}"]`;
  const data = await httpGetJSON(url);
  return data.map((v) => ({
    id: v.id,
    name: v.name,
    version: v.version_number,
    mcVersions: v.game_versions,
    loaders: v.loaders,
    date: v.date_published,
    downloads: v.downloads,
    changelog: v.changelog,
    files: v.files.map((f) => ({
      name: f.filename,
      url: rewriteCdnUrl(f.url),
      size: f.size,
      primary: f.primary,
    })),
  }));
}

// Rewrite cdn.modrinth.com URLs to the configured mirror
function rewriteCdnUrl(url) {
  const mirror = getMirror();
  if (mirror === 'kuvako' && url.includes('cdn.modrinth.com')) {
    return url.replace('https://cdn.modrinth.com', 'https://modrinth.kuvako.de');
  }
  return url;
}

async function getModrinthDependencies(versionId) {
  try {
    const data = await httpGetJSON(`${apiBase()}/version/${encodeURIComponent(versionId)}`);
    return (data.dependencies || [])
      .filter(d => d.dependency_type === 'required')
      .map(d => ({
        projectId: d.project_id,
        versionId: d.version_id,
      }));
  } catch { return []; }
}

// Get primary file for a dependency version
async function getModrinthVersionFile(versionId) {
  try {
    const data = await httpGetJSON(`${apiBase()}/version/${encodeURIComponent(versionId)}`);
    const file = (data.files || []).find(f => f.primary) || (data.files || [])[0];
    return file ? { name: file.filename, url: rewriteCdnUrl(file.url) } : null;
  } catch { return null; }
}

// Check if installed mods have updates on Modrinth
async function checkModUpdates(slugs) {
  const results = [];
  for (const slug of slugs.slice(0, 20)) {
    try {
      const versions = await getModrinthVersions(slug);
      if (versions.length > 0) {
        results.push({ slug, latest: versions[0].version, latestDate: versions[0].date });
      }
    } catch (e) { logWarn('Online', 'caught', e) }
  }
  return results;
}

// ─── CurseForge ────────────────────────────────────────────

function getCurseKey() {
  try {
    const { loadSettings } = require('./mc-settings.cjs');
    return loadSettings().curseforgeKey || '';
  } catch { return ''; }
}

async function searchCurseForge(query, gameVersion) {
  const key = getCurseKey();
  if (!key) throw new Error('NO_API_KEY');
  const params = new URLSearchParams({
    gameId: '432',
    classId: '6',
    searchFilter: query,
    pageSize: '20',
    index: '0',
  });
  if (gameVersion) params.set('gameVersion', gameVersion);
  const data = await httpGetJSON(`https://api.curseforge.com/v1/mods/search?${params}`, { 'x-api-key': key });
  return (data.data || []).map(m => ({
    id: m.id,
    slug: m.slug,
    title: m.name,
    description: m.summary,
    icon: m.logo?.thumbnailUrl || '',
    downloads: m.downloadCount || 0,
    follows: 0,
    categories: (m.categories || []).map(c => c.name),
    author: m.authors?.[0]?.name || 'Unknown',
    updated: m.dateModified,
    projectType: 'curseforge',
  }));
}

async function getCurseForgeFiles(modId, gameVersion) {
  const key = getCurseKey();
  if (!key) throw new Error('NO_API_KEY');
  let url = `https://api.curseforge.com/v1/mods/${modId}/files?pageSize=10`;
  if (gameVersion) url += `&gameVersion=${encodeURIComponent(gameVersion)}`;
  const data = await httpGetJSON(url, { 'x-api-key': key });
  return (data.data || []).map(f => ({
    id: f.id,
    name: f.displayName,
    version: f.fileName,
    date: f.fileDate,
    size: f.fileLength,
    primary: f.isPrimary,
    files: [{
      name: f.fileName,
      url: f.downloadUrl || `https://www.curseforge.com/api/v1/mods/${modId}/files/${f.id}/download`,
      size: f.fileLength,
      primary: f.isPrimary,
    }],
  }));
}

module.exports = { getMinecraftNews, searchModrinth, getModrinthPopular, getModrinthMod, getModrinthVersions, getModrinthDependencies, getModrinthVersionFile, checkModUpdates, searchCurseForge, getCurseForgeFiles };
