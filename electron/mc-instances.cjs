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

module.exports = { cloneVersion, renameVersion, getInstanceSettings, setInstanceSettings };
