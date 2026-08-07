const fs = require('fs');
const path = require('path');
const { BASE_DIR } = require('./mc-api.cjs');

const SAVES_DIR = path.join(BASE_DIR, 'saves');
const RESOURCE_PACKS_DIR = path.join(BASE_DIR, 'resourcepacks');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Worlds / Saves ────────────────────────────────────────

function getWorlds() {
  ensureDir(SAVES_DIR);
  const entries = fs.readdirSync(SAVES_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => {
    const worldDir = path.join(SAVES_DIR, e.name);
    let meta = { name: e.name, size: 0, lastPlayed: 0, icon: '' };
    try {
      const stat = fs.statSync(worldDir);
      meta.size = getDirSize(worldDir);
      meta.lastPlayed = stat.mtimeMs;
      // Check for icon
      const iconPath = path.join(worldDir, 'icon.png');
      if (fs.existsSync(iconPath)) {
        meta.icon = iconPath;
      }
    } catch {}
    return meta;
  }).sort((a, b) => b.lastPlayed - a.lastPlayed);
}

function getDirSize(dir) {
  let size = 0;
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      const fp = path.join(dir, f.name);
      if (f.isDirectory()) size += getDirSize(fp);
      else {
        try { size += fs.statSync(fp).size; } catch {}
      }
    }
  } catch {}
  return size;
}

function deleteWorld(name) {
  const worldDir = path.join(SAVES_DIR, name);
  if (fs.existsSync(worldDir)) {
    fs.rmSync(worldDir, { recursive: true, force: true });
    return true;
  }
  return false;
}

function backupWorld(name) {
  const worldDir = path.join(SAVES_DIR, name);
  if (!fs.existsSync(worldDir)) return false;
  const backupDir = path.join(BASE_DIR, 'backups');
  ensureDir(backupDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `${name}_${timestamp}`;
  const dest = path.join(backupDir, backupName);
  // Simple copy (could be zip in future)
  fs.cpSync(worldDir, dest, { recursive: true });
  return { name: backupName, path: dest };
}

function openWorldsFolder() {
  const { exec } = require('child_process');
  exec(`explorer "${SAVES_DIR}"`);
}

function getWorldIconBase64(worldName) {
  const iconPath = path.join(SAVES_DIR, worldName, 'icon.png');
  if (fs.existsSync(iconPath)) {
    const buf = fs.readFileSync(iconPath);
    return `data:image/png;base64,${buf.toString('base64')}`;
  }
  return '';
}

// ─── Resource Packs ────────────────────────────────────────

function getResourcePacks() {
  ensureDir(RESOURCE_PACKS_DIR);
  const files = fs.readdirSync(RESOURCE_PACKS_DIR);
  return files.filter((f) => f.endsWith('.zip') || f.endsWith('.rar') || f.isDirectory && !f.startsWith('.')).map((f) => {
    const fp = path.join(RESOURCE_PACKS_DIR, f);
    let meta = { name: f, size: 0, isDir: false };
    try {
      const stat = fs.statSync(fp);
      meta.size = stat.size;
      meta.isDir = stat.isDirectory();
    } catch {}
    return meta;
  });
}

function importResourcePack(sourcePath) {
  ensureDir(RESOURCE_PACKS_DIR);
  const filename = path.basename(sourcePath);
  const ext = path.extname(filename).toLowerCase();
  if (ext !== '.zip') return { success: false, error: 'Only .zip resource packs are supported' };
  const dest = path.join(RESOURCE_PACKS_DIR, filename);
  fs.copyFileSync(sourcePath, dest);
  return { success: true, name: filename };
}

function importResourcePacks(files) {
  const results = [];
  for (const file of files) {
    const r = importResourcePack(file);
    results.push({ ...r, name: path.basename(file) });
  }
  return results;
}

function deleteResourcePack(filename) {
  const fp = path.join(RESOURCE_PACKS_DIR, filename);
  if (fs.existsSync(fp)) { fs.unlinkSync(fp); return true; }
  return false;
}

function openResourcePacksFolder() {
  const { exec } = require('child_process');
  exec(`explorer "${RESOURCE_PACKS_DIR}"`);
}

module.exports = {
  getWorlds, deleteWorld, backupWorld, openWorldsFolder, getWorldIconBase64,
  getResourcePacks, importResourcePack, importResourcePacks, deleteResourcePack, openResourcePacksFolder,
};
