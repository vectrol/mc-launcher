const fs = require('fs');
const path = require('path');
const { BASE_DIR } = require('./mc-api.cjs');

// ─── Screenshots ───────────────────────────────────────────

function getScreenshots() {
  const dir = path.join(BASE_DIR, 'screenshots');
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
      .sort()
      .reverse()
      .map(f => {
        const p = path.join(dir, f);
        const stat = fs.statSync(p);
        return { name: f, path: p, size: stat.size, mtime: stat.mtimeMs };
      });
  } catch { return []; }
}

function deleteScreenshot(name) {
  const p = path.join(BASE_DIR, 'screenshots', name);
  if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
  return false;
}

function getScreenshotBase64(name) {
  const p = path.join(BASE_DIR, 'screenshots', name);
  if (fs.existsSync(p)) {
    const ext = path.extname(p).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
  }
  return '';
}

function openScreenshotsFolder() {
  const { exec } = require('child_process');
  exec(`explorer "${path.join(BASE_DIR, 'screenshots')}"`);
}

// ─── Version update notification ───────────────────────────

const { loadSettings, saveSettings } = require('./mc-settings.cjs');

async function checkNewVersion() {
  const settings = loadSettings();
  const lastKnown = settings.lastKnownVersion || '';
  try {
    const { getVersionManifest } = require('./mc-api.cjs');
    const manifest = await getVersionManifest();
    const latest = manifest.latest?.release || '';
    if (lastKnown && latest && latest !== lastKnown) {
      // New version available
      saveSettings({ lastKnownVersion: latest });
      return { hasNew: true, old: lastKnown, latest };
    }
    saveSettings({ lastKnownVersion: latest });
    return { hasNew: false, latest };
  } catch {
    return { hasNew: false, latest: '' };
  }
}

module.exports = { getScreenshots, deleteScreenshot, getScreenshotBase64, openScreenshotsFolder, checkNewVersion };
