const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { VERSIONS_DIR, MODS_DIR } = require('./mc-api.cjs');

function getInstalledVersions() {
  if (!fs.existsSync(VERSIONS_DIR)) return [];
  const entries = fs.readdirSync(VERSIONS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => {
      const versionDir = path.join(VERSIONS_DIR, e.name);
      const jsonPath = path.join(versionDir, `${e.name}.json`);
      let meta = { type: 'unknown', releaseTime: '', isModded: false, parent: '' };
      if (fs.existsSync(jsonPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          meta.type = data.type || 'custom';
          if (data.inheritsFrom) {
            meta.isModded = true;
            meta.parent = data.inheritsFrom;
            meta.type = data.type || 'release';
          }
          meta.releaseTime = data.releaseTime || '';
        } catch {}
      }
      const jarPath = path.join(versionDir, `${e.name}.jar`);
      const hasJar = fs.existsSync(jarPath);
      const modsPath = path.join(versionDir, 'mods');
      const modCount = fs.existsSync(modsPath)
        ? fs.readdirSync(modsPath).filter((f) => f.endsWith('.jar')).length
        : 0;
      return {
        id: e.name,
        type: meta.type,
        releaseTime: meta.releaseTime,
        hasJar,
        modCount,
        isModded: meta.isModded,
        parent: meta.parent,
      };
    });
}

function deleteVersion(versionId) {
  const versionDir = path.join(VERSIONS_DIR, versionId);
  if (fs.existsSync(versionDir)) {
    fs.rmSync(versionDir, { recursive: true, force: true });
    return true;
  }
  return false;
}

function getMods(versionId) {
  const modsPath = path.join(VERSIONS_DIR, versionId, 'mods');
  if (!fs.existsSync(modsPath)) return [];
  const files = fs.readdirSync(modsPath);
  return files
    .filter((f) => f.endsWith('.jar') || f.endsWith('.disabled'))
    .map((f) => {
      const filePath = path.join(modsPath, f);
      const isDisabled = f.endsWith('.disabled');
      const realName = isDisabled ? f.replace(/\.disabled$/, '') : f;
      try {
        const stat = fs.statSync(filePath);
        return {
          name: realName,
          fileName: f,
          disabled: isDisabled,
          size: stat.size,
          mtime: stat.mtimeMs,
        };
      } catch {
        return { name: f, fileName: f, disabled: isDisabled, size: 0, mtime: 0 };
      }
    });
}

function toggleMod(versionId, filename) {
  const modsPath = path.join(VERSIONS_DIR, versionId, 'mods');
  const active = path.join(modsPath, filename);
  const disabled = path.join(modsPath, `${filename}.disabled`);
  if (fs.existsSync(active)) {
    fs.renameSync(active, disabled);
    return { disabled: true };
  }
  if (fs.existsSync(disabled)) {
    fs.renameSync(disabled, active);
    return { disabled: false };
  }
  throw new Error('Mod not found');
}

function importMod(versionId, sourcePath) {
  const modsDir = path.join(VERSIONS_DIR, versionId, 'mods');
  if (!fs.existsSync(modsDir)) {
    fs.mkdirSync(modsDir, { recursive: true });
  }
  const filename = path.basename(sourcePath);
  const destPath = path.join(modsDir, filename);
  fs.copyFileSync(sourcePath, destPath);
  return { name: filename, path: destPath };
}

function deleteMod(versionId, filename) {
  const modPath = path.join(VERSIONS_DIR, versionId, 'mods', filename);
  if (fs.existsSync(modPath)) {
    fs.unlinkSync(modPath);
    return true;
  }
  return false;
}

function openMinecraftFolder() {
  const { BASE_DIR } = require('./mc-api.cjs');
  const cmd = `explorer "${BASE_DIR}"`;
  exec(cmd);
}

module.exports = {
  getInstalledVersions,
  deleteVersion,
  getMods,
  importMod,
  deleteMod,
  toggleMod,
  openMinecraftFolder,
};
