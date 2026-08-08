const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { VERSIONS_DIR, MODS_DIR } = require('./mc-api.cjs');

function getInstalledVersions() {
  if (!fs.existsSync(VERSIONS_DIR)) return [];
  const entries = fs.readdirSync(VERSIONS_DIR, { withFileTypes: true });

  const allVersions = [];
  const childVersions = new Map(); // parentId -> [{id, json}]

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const versionDir = path.join(VERSIONS_DIR, e.name);
    const jsonFile = fs.readdirSync(versionDir).find(f => f.endsWith('.json'));
    if (!jsonFile) {
      // Directory without version JSON - might be a modpack folder
      const mpJson = path.join(versionDir, 'modpack.json');
      if (fs.existsSync(mpJson)) {
        allVersions.push({
          id: e.name, type: 'modpack', releaseTime: '', hasJar: false, modCount: 0,
          isModded: false, parent: '', loaders: [],
        });
      }
      continue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(path.join(versionDir, jsonFile), 'utf-8'));

      if (data.inheritsFrom) {
        // Child version (Fabric/Forge loader) — group under parent
        if (!childVersions.has(data.inheritsFrom)) childVersions.set(data.inheritsFrom, []);
        childVersions.get(data.inheritsFrom).push({ id: e.name, json: data });
        continue;
      }

      // Root version (no inheritsFrom) — show as primary
      const jarPath = path.join(versionDir, `${e.name}.jar`);
      const modsPath = path.join(versionDir, 'mods');
      const modCount = fs.existsSync(modsPath)
        ? fs.readdirSync(modsPath).filter((f) => f.endsWith('.jar')).length
        : 0;

      allVersions.push({
        id: e.name,
        type: data.type || 'release',
        releaseTime: data.releaseTime || '',
        hasJar: fs.existsSync(jarPath),
        modCount,
        isModded: false,
        parent: '',
        loaders: [], // filled below
      });
    } catch {}
  }

  // Attach loader info to root versions
  for (const v of allVersions) {
    const children = childVersions.get(v.id) || [];
    v.loaders = children.map(c => {
      let type = 'custom';
      if (c.id.includes('fabric')) type = 'fabric';
      else if (c.id.includes('neo') && c.id.includes('forge')) type = 'neoforge';
      else if (c.id.includes('forge')) type = 'forge';
      else if (c.id.includes('quilt')) type = 'quilt';
      else if (c.id.includes('optifine')) type = 'optifine';
      return { type, id: c.id };
    });
    // Count mods in loader versions too
    for (const c of children) {
      const mp = path.join(VERSIONS_DIR, c.id, 'mods');
      if (fs.existsSync(mp)) {
        v.modCount += fs.readdirSync(mp).filter(f => f.endsWith('.jar') || f.endsWith('.disabled')).length;
      }
    }
  }

  return allVersions;
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
