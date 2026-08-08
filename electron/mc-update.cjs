const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { BASE_DIR, logWarn } = require('./mc-api.cjs');

// ─── Launcher crash logging ────────────────────────────────

const LOG_FILE = path.join(app.getPath('userData'), 'launcher-error.log');

function logError(context, error) {
  try {
    const line = `[${new Date().toISOString()}] [${context}] ${error?.stack || error?.message || error}\n`;
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) { logWarn('Update', 'caught', e) }
}

function getErrorLog() {
  try {
    if (!fs.existsSync(LOG_FILE)) return '';
    return fs.readFileSync(LOG_FILE, 'utf-8').slice(-20000);
  } catch { return ''; }
}

function clearErrorLog() {
  try { fs.writeFileSync(LOG_FILE, ''); } catch (e) { logWarn('Update', 'caught', e) }
}

// ─── Self update check ─────────────────────────────────────
// Checks own GitHub repo releases for new versions

const UPDATE_REPO = process.env.MC_UPDATE_REPO || 'vectrol/mc-launcher';

function getLocalVersion() {
  try {
    const pkg = require('../package.json');
    return pkg.version || '3.1.0';
  } catch { return '3.1.0'; }
}

function githubGet(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, { headers: { 'User-Agent': 'MCLauncher', 'Accept': 'application/vnd.github+json' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(d)); } catch { reject(new Error('parse')); }
      });
    }).on('error', reject);
  });
}

// Version compare: "2.0.0" vs "2.1.0" -> -1
function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

async function checkForUpdates() {
  const local = getLocalVersion();
  // Try official API first, then mirrors (GitHub API often unreachable in CN)
  const apiBases = [
    `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,
    `https://ghproxy.com/https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,
    `https://gh-proxy.com/https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,
    `https://github.moeyy.xyz/https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,
  ];
  for (const base of apiBases) {
    try {
      const data = await githubGet(base);
      const remote = (data.tag_name || '').replace(/^v/, '');
      if (remote) {
        if (compareVersions(remote, local) > 0) {
          return {
            hasUpdate: true,
            current: local,
            latest: remote,
            notes: (data.body || '').slice(0, 500),
            url: data.html_url,
            assets: (data.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size })),
          };
        }
        return { hasUpdate: false, current: local };
      }
    } catch { /* try next mirror */ }
  }
  return { hasUpdate: false, current: local };
}

// Download the latest release asset (installer) to userData
async function downloadUpdate(onProgress) {
  const info = await checkForUpdates();
  if (!info.hasUpdate || info.assets.length === 0) {
    throw new Error('No update available');
  }
  // Prefer the setup .exe asset
  const asset = info.assets.find(a => /setup.*\.exe$/i.test(a.name)) || info.assets[0];
  const destDir = path.join(app.getPath('userData'), 'updates');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, asset.name);

  // Try official URL then mirror proxies (GitHub downloads often blocked/slow in CN)
  const dlUrls = [
    asset.url,
    `https://ghproxy.com/${asset.url}`,
    `https://gh-proxy.com/${asset.url}`,
    `https://github.moeyy.xyz/${asset.url}`,
  ];
  for (const url of dlUrls) {
    try {
      await downloadTo(url, destPath, onProgress);
      return { path: destPath, name: asset.name, info };
    } catch { /* try next */ }
  }
  throw new Error('Download failed on all mirrors');
}

function downloadTo(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const follow = (u, redirects) => {
      https.get(u, { headers: { 'User-Agent': 'MCLauncher' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
          return follow(res.headers.location, redirects + 1);
        }
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
        const total = parseInt(res.headers['content-length'], 10) || 0;
        let done = 0;
        const ws = fs.createWriteStream(destPath);
        res.on('data', c => {
          done += c.length;
          ws.write(c);
          if (onProgress && total > 0) onProgress({ percent: Math.round((done / total) * 100), downloaded: done, total });
        });
        res.on('end', () => { ws.end(); resolve(); });
        res.on('error', reject);
      }).on('error', reject);
    };
    follow(url, 0);
  });
}

// ─── Instance import wizard ────────────────────────────────
// Import an existing .minecraft folder as a version instance

function importMinecraftFolder(folderPath) {
  const { VERSIONS_DIR } = require('./mc-api.cjs');
  const fs2 = require('fs');
  if (!fs2.existsSync(folderPath)) throw new Error('Folder not found');

  const baseName = path.basename(folderPath).replace(/\.minecraft$/i, '') || 'imported';
  const dest = path.join(VERSIONS_DIR, `${baseName}-import`);

  // If no versions inside, it's a game dir - create a mods link structure
  const modsSrc = path.join(folderPath, 'mods');
  const configSrc = path.join(folderPath, 'config');

  if (!fs2.existsSync(dest)) fs2.mkdirSync(dest, { recursive: true });
  const { copyRecursive } = require('./mc-instances.cjs');
  if (fs2.existsSync(modsSrc)) copyRecursive(modsSrc, path.join(dest, 'mods'));
  if (fs2.existsSync(configSrc)) copyRecursive(configSrc, path.join(dest, 'config'));

  // Try to detect version from mods or a version json
  let mcVersion = '';
  try {
    const versionsIn = fs2.readdirSync(path.join(folderPath, 'versions'));
    mcVersion = versionsIn.find(v => !v.includes('loader')) || versionsIn[0] || '';
  } catch (e) { logWarn('Update', 'caught', e) }

  fs2.writeFileSync(path.join(dest, 'modpack.json'), JSON.stringify({
    format: 'imported', name: `${baseName}-import`, source: folderPath, mcVersion,
  }, null, 2));

  return { success: true, name: `${baseName}-import`, mcVersion };
}

// Apply update: run installer silently (NSIS /S) �?full silent replace
function applyUpdate() {
  const updatesDir = path.join(app.getPath('userData'), 'updates');
  if (!fs.existsSync(updatesDir)) return { success: false, error: 'No update downloaded' };
  const exe = fs.readdirSync(updatesDir).find(f => /setup.*\.exe$/i.test(f));
  if (!exe) return { success: false, error: 'No installer found' };
  const installer = path.join(updatesDir, exe);
  const { exec } = require('child_process');
  // NSIS silent install; app will close on restart
  exec(`"${installer}" /S`, (err) => {
    if (err) return { success: false, error: err.message };
  });
  // Close launcher so installer can replace files
  setTimeout(() => app.quit(), 1500);
  return { success: true, installer };
}

module.exports = { logError, getErrorLog, clearErrorLog, checkForUpdates, downloadUpdate, applyUpdate, getLocalVersion, importMinecraftFolder };
