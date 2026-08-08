const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const BASE_DIR = path.join(app.getPath('userData'), 'minecraft');
const VERSIONS_DIR = path.join(BASE_DIR, 'versions');
const ASSETS_DIR = path.join(BASE_DIR, 'assets');
const LIBRARIES_DIR = path.join(BASE_DIR, 'libraries');
const MODS_DIR = path.join(BASE_DIR, 'mods');

async function getVersionChangelog(versionId) {
  try {
    // Try fetching from Minecraft Wiki for 1.13+
    const major = parseInt(versionId.split('.')[1]) || 0;
    if (major < 13) return null;

    const encoded = encodeURIComponent(`Java Edition ${versionId}`);
    const url = `https://minecraft.wiki/api.php?action=parse&page=${encoded}&prop=text&section=1&format=json&origin=*`;
    const data = await httpGetJSON(url);

    if (data?.parse?.text?.['*']) {
      // Strip HTML tags, get first 500 chars as summary
      const html = data.parse.text['*'];
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const summary = text.length > 500 ? text.slice(0, 500) + '...' : text;
      const wikiUrl = `https://minecraft.wiki/w/Java_Edition_${encodeURIComponent(versionId)}`;
      return { summary, url: wikiUrl };
    }
  } catch {}
  return null;
}

let versionManifest = null;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function httpGetJSON(url) {
  return httpGet(url).then((buf) => JSON.parse(buf.toString('utf-8')));
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(destPath));
    const mod = url.startsWith('https') ? https : http;
    const startTime = Date.now();
    const req = mod.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) {
        try { fs.unlinkSync(destPath); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const total = parseInt(res.headers['content-length'], 10) || 0;
      let downloaded = 0;
      let lastTick = Date.now();
      let lastBytes = 0;
      const ws = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        ws.write(chunk);
        if (onProgress) {
          const now = Date.now();
          const tickDiff = now - lastTick;
          if (tickDiff > 200) { // Update every 200ms
            const bytesPerSec = tickDiff > 0 ? ((downloaded - lastBytes) / (tickDiff / 1000)) : 0;
            const eta = bytesPerSec > 0 && total > 0 ? ((total - downloaded) / bytesPerSec) : 0;
            onProgress({ downloaded, total, percent: total > 0 ? Math.round((downloaded / total) * 100) : 0, speed: bytesPerSec, eta });
            lastTick = now;
            lastBytes = downloaded;
          }
        }
      });
      res.on('end', () => { ws.end(); resolve(); });
      res.on('error', (e) => { try { ws.close(); fs.unlinkSync(destPath); } catch {} reject(e); });
    });
    // Timeout: fail cleanly instead of hanging forever
    req.setTimeout(30000, () => {
      req.destroy(new Error('Download timed out'));
      try { fs.unlinkSync(destPath); } catch {}
    });
    req.on('error', (e) => {
      try { fs.unlinkSync(destPath); } catch {}
      reject(e);
    });
  });
}

async function downloadBatch(items, downloadFn, threads, onProgress) {
  let completed = 0;
  let failed = 0;
  const total = items.length;
  let activeDownloads = 0;
  let index = 0;

  return new Promise((resolve, reject) => {
    function next() {
      while (activeDownloads < threads && index < items.length) {
        const i = index++;
        activeDownloads++;
        const item = items[i];
        downloadFn(item)
          .then(() => {
            completed++;
            activeDownloads--;
            if (onProgress) onProgress({ completed, total, failed, percent: Math.round((completed / total) * 100) });
            next();
            if (completed >= total) resolve({ failed });
          })
          .catch((err) => {
            // Count failures instead of silently swallowing
            completed++;
            failed++;
            activeDownloads--;
            if (onProgress) onProgress({ completed, total, failed, percent: Math.round((completed / total) * 100) });
            next();
            if (completed >= total) resolve({ failed });
          });
      }
    }
    next();
    if (items.length === 0) resolve({ failed: 0 });
  });
}

let manifestCacheTime = 0;
const MANIFEST_CACHE_MS = 60 * 60 * 1000;

async function getVersionManifest() {
  if (versionManifest && Date.now() - manifestCacheTime < MANIFEST_CACHE_MS) return versionManifest;
  const cachePath = path.join(BASE_DIR, 'version_manifest.json');
  if (!versionManifest && fs.existsSync(cachePath)) {
    try {
      if (Date.now() - fs.statSync(cachePath).mtimeMs < MANIFEST_CACHE_MS) {
        versionManifest = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        return versionManifest;
      }
    } catch {}
  }
  versionManifest = await httpGetJSON('https://launchermeta.mojang.com/mc/game/version_manifest.json');
  manifestCacheTime = Date.now();
  try { ensureDir(BASE_DIR); fs.writeFileSync(cachePath, JSON.stringify(versionManifest)); } catch {}
  return versionManifest;
}

async function getVersionInfo(versionId) {
  const manifest = await getVersionManifest();
  const ver = manifest.versions.find((v) => v.id === versionId);
  if (!ver) throw new Error(`Version ${versionId} not found`);
  return httpGetJSON(ver.url);
}

async function downloadVersion(versionId, onProgress, signal) {
  ensureDir(BASE_DIR);
  ensureDir(VERSIONS_DIR);
  ensureDir(ASSETS_DIR);
  ensureDir(LIBRARIES_DIR);

  const { loadSettings } = require('./mc-settings.cjs');
  const settings = loadSettings();
  const threads = parseInt(settings.downloadThreads) || 4;

  const versionData = await getVersionInfo(versionId);
  const versionDir = path.join(VERSIONS_DIR, versionId);

  // Save version JSON
  ensureDir(versionDir);
  const versionJsonPath = path.join(versionDir, `${versionId}.json`);
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2));

  // Download client jar
  const clientUrl = versionData.downloads?.client?.url;
  if (clientUrl) {
    onProgress({ phase: 'client', message: 'Downloading client jar...', percent: 0 });
    await downloadFile(clientUrl, path.join(versionDir, `${versionId}.jar`), (p) => {
      onProgress({ phase: 'client', message: `Client jar: ${formatSpeed(p.speed)}`, percent: p.percent, speed: p.speed, eta: p.eta });
    });
  }

  // Download asset index
  if (versionData.assetIndex) {
    const assetIndexUrl = versionData.assetIndex.url;
    const assetIndexPath = path.join(ASSETS_DIR, 'indexes', `${versionData.assetIndex.id}.json`);
    ensureDir(path.dirname(assetIndexPath));
    onProgress({ phase: 'assets', message: 'Downloading asset index...', percent: 0 });
    const indexBuf = await httpGet(assetIndexUrl);
    fs.writeFileSync(assetIndexPath, indexBuf);
    const assetIndex = JSON.parse(indexBuf.toString('utf-8'));

    // Download asset objects in parallel
    const objects = Object.entries(assetIndex.objects);
    let totalSize = 0;
    let settings = { downloadSource: 'mojang' };
    try { settings.downloadSource = require('./mc-settings.cjs').loadSettings().downloadSource; } catch {}
    const assetBase = settings.downloadSource === 'bmclapi'
      ? 'https://bmclapi2.bangbang93.com/assets/'
      : 'https://resources.download.minecraft.net/';
    const tasks = objects.map(([name, obj]) => {
      const hash = obj.hash;
      const subPath = `${hash.substring(0, 2)}/${hash}`;
      const assetUrl = `${assetBase}${subPath}`;
      const assetPath = path.join(ASSETS_DIR, 'objects', subPath);
      totalSize += obj.size || 0;
      return async () => {
        if (!fs.existsSync(assetPath)) {
          await downloadFile(assetUrl, assetPath);
        }
      };
    });

    let completed = 0;
    let totalBytes = 0;
    const assetsResult = await downloadBatch(tasks, (fn) => fn(), threads, (p) => {
      completed = p.completed;
      onProgress({
        phase: 'assets',
        message: `Assets: ${completed}/${p.total}${p.failed > 0 ? ` (${p.failed} failed)` : ''}`,
        percent: Math.round((completed / p.total) * 100),
        current: completed,
        total: p.total,
      });
    });
    if (assetsResult.failed > 0) {
      onProgress({ phase: 'assets', message: `Assets: ${assetsResult.failed} failed - network issue?`, percent: 100 });
    }
  }

  // Download libraries in parallel
  if (versionData.libraries) {
    let filtered = [];
    for (const lib of versionData.libraries) {
      if (lib.rules) {
        const allow = lib.rules.every((rule) => {
          if (rule.action === 'allow') { if (rule.os) return rule.os.name === 'windows'; return true; }
          if (rule.action === 'disallow') { if (rule.os) return rule.os.name !== 'windows'; return false; }
          return true;
        });
        if (!allow) continue;
      }
      if (lib.downloads?.artifact) {
        filtered.push(lib);
      }
    }

    let completed = 0;
    let failedCount = 0;
    const libTasks = filtered.map((lib) => async () => {
      const artifact = lib.downloads.artifact;
      const libPath = path.join(LIBRARIES_DIR, artifact.path);
      if (!fs.existsSync(libPath)) {
        let url = artifact.url;
        try {
          const src = require('./mc-settings.cjs').loadSettings().downloadSource;
          if (src === 'bmclapi' && url.includes('libraries.minecraft.net')) {
            url = `https://bmclapi2.bangbang93.com/maven/${artifact.path}`;
          }
        } catch {}
        await downloadFile(url, libPath);
      }
    });
    const libResult = await downloadBatch(libTasks, (fn) => fn(), threads, (p) => {
      completed = p.completed;
      failedCount = p.failed;
      onProgress({
        phase: 'libraries',
        message: `Libraries: ${completed}/${p.total}${p.failed > 0 ? ` (${p.failed} failed)` : ''}`,
        percent: Math.round((completed / p.total) * 100),
        current: completed,
        total: p.total,
      });
    });

    // Critical: if many libraries failed, the game cannot launch - report loudly
    if (libResult.failed > 0) {
      onProgress({ phase: 'libraries', message: `Libraries: ${libResult.failed} failed. Re-download recommended.`, percent: 100 });
    }
  }

  // Extract native libraries
  const { extractNatives } = require('./mc-natives.cjs');
  onProgress({ phase: 'natives', message: 'Extracting native libraries...', percent: 85 });
  extractNatives(versionId, versionData);

  onProgress({ phase: 'done', message: 'Download complete!', percent: 100 });
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec === 0) return '';
  if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bytesPerSec > 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

// ─── Download source auto-select (speed test) ──────────────

async function testSourceLatency(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const start = Date.now();
    const req = mod.get(url, { headers: { 'User-Agent': 'MCLauncher' } }, (res) => {
      res.destroy();
      resolve({ ok: true, ms: Date.now() - start });
    });
    req.on('error', () => resolve({ ok: false, ms: 9999 }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, ms: 9999 }); });
  });
}

async function autoSelectSource() {
  const mojang = await testSourceLatency('https://launchermeta.mojang.com/mc/game/version_manifest.json');
  const bmcl = await testSourceLatency('https://bmclapi2.bangbang93.com/mc/game/version_manifest.json');
  const best = bmcl.ok && bmcl.ms < mojang.ms ? 'bmclapi' : 'mojang';
  const { saveSettings } = require('./mc-settings.cjs');
  saveSettings({ downloadSource: best, sourceLatency: { mojang: mojang.ms, bmclapi: bmcl.ms } });
  return { best, mojang: mojang.ms, bmclapi: bmcl.ms };
}

module.exports = { getVersionManifest, getVersionInfo, downloadVersion, getVersionChangelog, autoSelectSource, BASE_DIR, VERSIONS_DIR, ASSETS_DIR, LIBRARIES_DIR, MODS_DIR };
