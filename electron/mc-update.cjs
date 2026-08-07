const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { BASE_DIR } = require('./mc-api.cjs');

// ─── Launcher crash logging ────────────────────────────────

const LOG_FILE = path.join(app.getPath('userData'), 'launcher-error.log');

function logError(context, error) {
  try {
    const line = `[${new Date().toISOString()}] [${context}] ${error?.stack || error?.message || error}\n`;
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

function getErrorLog() {
  try {
    if (!fs.existsSync(LOG_FILE)) return '';
    return fs.readFileSync(LOG_FILE, 'utf-8').slice(-20000);
  } catch { return ''; }
}

function clearErrorLog() {
  try { fs.writeFileSync(LOG_FILE, ''); } catch {}
}

// ─── Self update check ─────────────────────────────────────
// Checks a GitHub repo releases (configurable via env var for demo)

const UPDATE_REPO = process.env.MC_UPDATE_REPO || 'yushijinhun/authlib-injector'; // placeholder
const LOCAL_VERSION = '3.0.0';

async function checkForUpdates() {
  try {
    const https = require('https');
    const url = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'MCLauncher' } }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('parse')); } });
      }).on('error', reject);
    });
    const remote = (data.tag_name || '').replace(/^v/, '');
    if (remote && remote !== LOCAL_VERSION) {
      return {
        hasUpdate: true,
        current: LOCAL_VERSION,
        latest: remote,
        notes: data.body?.slice(0, 500) || '',
        url: data.html_url,
      };
    }
    return { hasUpdate: false, current: LOCAL_VERSION };
  } catch {
    return { hasUpdate: false, current: LOCAL_VERSION };
  }
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
  } catch {}

  fs2.writeFileSync(path.join(dest, 'modpack.json'), JSON.stringify({
    format: 'imported', name: `${baseName}-import`, source: folderPath, mcVersion,
  }, null, 2));

  return { success: true, name: `${baseName}-import`, mcVersion };
}

module.exports = { logError, getErrorLog, clearErrorLog, checkForUpdates, importMinecraftFolder };
