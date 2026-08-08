const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { downloadFile } = require('./mc-downloads.cjs');

const JRE_DIR = path.join(app.getPath('userData'), 'jre');

function getInstalledJres() {
  if (!fs.existsSync(JRE_DIR)) return [];
  try {
    return fs.readdirSync(JRE_DIR).map(name => {
      const dir = path.join(JRE_DIR, name);
      const exe = path.join(dir, 'bin', 'javaw.exe');
      const javaExe = path.join(dir, 'bin', 'java.exe');
      const p = fs.existsSync(exe) ? exe : javaExe;
      return { name, dir, path: p, exists: fs.existsSync(p) };
    }).filter(j => j.exists);
  } catch { return []; }
}

// List available JREs for a major version via Adoptium API
async function listAdoptium(major) {
  const https = require('https');
  const url = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=x64&image_type=jre&os=windows`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'MCLauncher' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(d);
          resolve((data || []).map(a => {
            const v = a.version;
            const versionStr = typeof v === 'string' ? v : (v?.semver || a.release_name || String(a.version?.major || ''));
            return {
              name: a.release_name || versionStr,
              version: versionStr,
              url: a.binary?.package?.link,
              size: a.binary?.package?.size,
            };
          }));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Download + extract JRE (zip)
async function installJre(major, onProgress) {
  const list = await listAdoptium(major);
  if (list.length === 0) throw new Error('No JRE available for Java ' + major);
  const item = list[0];

  onProgress({ phase: 'jre', message: `Downloading Java ${major}...`, percent: 0 });
  const zipPath = path.join(JRE_DIR, `jre-${major}.zip`);
  if (!fs.existsSync(JRE_DIR)) fs.mkdirSync(JRE_DIR, { recursive: true });

  await downloadFile(item.url, zipPath, (p) => {
    onProgress({ phase: 'jre', message: `Downloading Java ${major}...`, percent: Math.round(p.percent * 0.8) });
  });

  onProgress({ phase: 'jre', message: 'Extracting Java...', percent: 85 });
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  // Top-level folder name
  const root = entries.find(e => e.entryName.includes('/'))?.entryName.split('/')[0] || `jre-${major}`;
  const destRoot = path.join(JRE_DIR, root);
  if (fs.existsSync(destRoot)) fs.rmSync(destRoot, { recursive: true, force: true });
  zip.extractAllTo(JRE_DIR, true);

  // Cleanup zip
  try { fs.unlinkSync(zipPath); } catch {}

  const javaExe = path.join(destRoot, 'bin', 'javaw.exe');
  if (!fs.existsSync(javaExe)) throw new Error('Extraction failed');
  onProgress({ phase: 'done', message: 'Java installed!', percent: 100 });
  return { path: javaExe, name: root };
}

module.exports = { getInstalledJres, listAdoptium, installJre, JRE_DIR };
