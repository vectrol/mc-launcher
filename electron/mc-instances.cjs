const fs = require('fs');
const path = require('path');
const { VERSIONS_DIR } = require('./mc-api.cjs');
const { loadSettings, saveSettings } = require('./mc-settings.cjs');

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function cloneVersion(versionId, newName) {
  const src = path.join(VERSIONS_DIR, versionId);
  if (!fs.existsSync(src)) throw new Error(`Version ${versionId} not found`);
  if (!newName) newName = `${versionId}-copy`;
  // Ensure unique name
  let target = newName;
  let i = 1;
  while (fs.existsSync(path.join(VERSIONS_DIR, target))) { target = `${newName}-${i++}`; }

  const dest = path.join(VERSIONS_DIR, target);
  ensureDir(dest);
  fs.cpSync(src, dest, { recursive: true });

  // Rename internal files (json/jar)
  const jsonSrc = path.join(dest, `${versionId}.json`);
  const jarSrc = path.join(dest, `${versionId}.jar`);
  if (fs.existsSync(jsonSrc)) {
    const data = JSON.parse(fs.readFileSync(jsonSrc, 'utf-8'));
    data.id = target;
    if (data.inheritsFrom) data.inheritsFrom = data.inheritsFrom;
    fs.writeFileSync(path.join(dest, `${target}.json`), JSON.stringify(data, null, 2));
    fs.unlinkSync(jsonSrc);
  }
  if (fs.existsSync(jarSrc)) {
    fs.copyFileSync(jarSrc, path.join(dest, `${target}.jar`));
    fs.unlinkSync(jarSrc);
  }
  return target;
}

function renameVersion(versionId, newName) {
  const src = path.join(VERSIONS_DIR, versionId);
  if (!fs.existsSync(src)) throw new Error('Version not found');
  const dest = path.join(VERSIONS_DIR, newName);
  if (fs.existsSync(dest) && src !== dest) throw new Error('Name already exists');
  fs.renameSync(src, dest);
  const jsonSrc = path.join(dest, `${versionId}.json`);
  const jarSrc = path.join(dest, `${versionId}.jar`);
  if (fs.existsSync(jsonSrc)) {
    const data = JSON.parse(fs.readFileSync(jsonSrc, 'utf-8'));
    data.id = newName;
    fs.writeFileSync(path.join(dest, `${newName}.json`), JSON.stringify(data, null, 2));
    fs.unlinkSync(jsonSrc);
  }
  if (fs.existsSync(jarSrc)) {
    fs.renameSync(jarSrc, path.join(dest, `${newName}.jar`));
  }
  return newName;
}

function getInstanceSettings(versionId) {
  const s = loadSettings();
  return (s.instanceSettings && s.instanceSettings[versionId]) || {};
}

function setInstanceSettings(versionId, patch) {
  const s = loadSettings();
  if (!s.instanceSettings) s.instanceSettings = {};
  s.instanceSettings[versionId] = { ...(s.instanceSettings[versionId] || {}), ...patch };
  saveSettings(s);
  return s.instanceSettings[versionId];
}

function setInstanceIcon(versionId, iconPathOrData) {
  // Support both: file path OR data URL (base64)
  const destDir = path.join(VERSIONS_DIR, versionId);
  ensureDir(destDir);

  let ext = '.png';
  let buffer;

  if (iconPathOrData && iconPathOrData.startsWith('data:')) {
    // data:image/png;base64,XXXX
    const m = iconPathOrData.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);
    if (!m) throw new Error('Invalid image data');
    ext = m[1].toLowerCase() === 'jpeg' ? '.jpg' : `.${m[1].toLowerCase()}`;
    buffer = Buffer.from(m[2], 'base64');
  } else {
    const src = iconPathOrData;
    if (!src || !fs.existsSync(src)) throw new Error('Icon not found');
    ext = path.extname(src) || '.png';
    buffer = fs.readFileSync(src);
  }

  const dest = path.join(destDir, `instance-icon${ext}`);
  fs.writeFileSync(dest, buffer);
  setInstanceSettings(versionId, { icon: `instance-icon${ext}` });
  return { success: true, icon: `instance-icon${ext}` };
}

function getInstanceIcon(versionId) {
  const settings = getInstanceSettings(versionId);
  const iconFile = settings.icon;
  if (!iconFile) return '';
  const p = path.join(VERSIONS_DIR, versionId, iconFile);
  if (fs.existsSync(p)) {
    const ext = path.extname(p).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : 'image/png';
    return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
  }
  return '';
}

module.exports = { cloneVersion, renameVersion, getInstanceSettings, setInstanceSettings, setInstanceIcon, getInstanceIcon };
