const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { BASE_DIR, VERSIONS_DIR, LIBRARIES_DIR, logWarn } = require('./mc-api.cjs');
const { importMod } = require('./mc-versions.cjs');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Modpack Import ────────────────────────────────────────

async function parseModpack(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mrpack') return parseModrinthPack(filePath);
  if (ext === '.zip') return parseCurseForgePack(filePath);
  throw new Error('Unsupported modpack format. Use .zip (CurseForge) or .mrpack (Modrinth)');
}

function parseCurseForgePack(filePath) {
  const zip = new AdmZip(filePath);
  // CurseForge packs have manifest.json at root
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) throw new Error('Not a valid CurseForge modpack (no manifest.json)');

  const manifest = JSON.parse(manifestEntry.getData().toString('utf-8'));

  return {
    format: 'curseforge',
    name: manifest.name || path.basename(filePath, '.zip'),
    version: manifest.version || '1.0.0',
    mcVersion: manifest.minecraft?.version || '',
    loader: manifest.minecraft?.modLoaders?.[0]?.id || '',
    mods: (manifest.files || []).map((f) => ({
      id: f.projectID,
      fileId: f.fileID,
      required: f.required !== false,
    })),
    zip,
    overrides: true,
  };
}

function parseModrinthPack(filePath) {
  const zip = new AdmZip(filePath);
  const indexEntry = zip.getEntry('modrinth.index.json');
  if (!indexEntry) throw new Error('Not a valid Modrinth modpack (no modrinth.index.json)');

  const index = JSON.parse(indexEntry.getData().toString('utf-8'));

  return {
    format: 'modrinth',
    name: index.name || path.basename(filePath, '.mrpack'),
    version: index.versionId || '1.0.0',
    mcVersion: index.dependencies?.minecraft || '',
    loader: index.dependencies?.['fabric-loader'] ? 'fabric' : index.dependencies?.forge ? 'forge' : '',
    loaderVersion: index.dependencies?.['fabric-loader'] || index.dependencies?.forge || '',
    mods: (index.files || []).map((f) => ({
      path: f.path,
      url: f.downloads?.[0],
      sha512: f.hashes?.sha512,
      size: f.fileSize,
    })),
    zip,
    overrides: true,
  };
}

async function installModpack(pack, onProgress) {
  // Sanitize version directory name
  const safeName = pack.name.replace(/[^a-zA-Z0-9_.\- ]/g, '').trim() || 'modpack';
  const versionDir = path.join(VERSIONS_DIR, safeName);
  ensureDir(versionDir);

  // Save pack metadata
  fs.writeFileSync(
    path.join(versionDir, 'modpack.json'),
    JSON.stringify({ format: pack.format, name: safeName, mcVersion: pack.mcVersion, loader: pack.loader }, null, 2)
  );

  let completed = 0;
  const total = pack.mods.length;

  if (pack.format === 'curseforge') {
    // Install mods from CurseForge via API
    for (const mod of pack.mods) {
      onProgress({ phase: 'modpack', message: `Installing mod ${mod.id}...`, percent: Math.round((completed / total) * 100), current: completed, total });
      try {
        const { https } = require('https');
        // CurseForge download requires API key, use Modrinth fallback or direct download
        // For now: try to download from CurseForge direct file URL
        const url = `https://www.curseforge.com/api/v1/mods/${mod.id}/files/${mod.fileId}/download`;
        const destPath = path.join(versionDir, 'mods', `mod_${mod.id}.jar`);
        ensureDir(path.dirname(destPath));
        // Try download via redirect
        await downloadFileWithRedirect(url, destPath);
      } catch (e) { logWarn('Modpack', 'caught', e) }
      completed++;
    }
  } else if (pack.format === 'modrinth') {
    // Modrinth mrpack: files' paths are relative to game dir (e.g. mods/xxx.jar, config/xxx)
    // Auto-install base MC version + loader first
    if (pack.mcVersion) {
      try {
        const { downloadVersion } = require('./mc-api.cjs');
        const { getInstalledVersions } = require('./mc-versions.cjs');
        const installed = getInstalledVersions().map(v => v.id);
        if (!installed.includes(pack.mcVersion)) {
          onProgress({ phase: 'modpack', message: `Downloading base MC ${pack.mcVersion}...`, percent: 5 });
          await downloadVersion(pack.mcVersion, (p) => {
            onProgress({ phase: 'modpack', message: `Downloading base MC ${pack.mcVersion}...`, percent: 5 + Math.round(p.percent * 0.2) });
          });
        }
      } catch (e) { logWarn('Modpack', 'caught', e) }
    }
    if (pack.loader && pack.loaderVersion) {
      try {
        const { getInstalledVersions } = require('./mc-versions.cjs');
        const installed = getInstalledVersions().map(v => v.id);
        const hasLoader = installed.some(v => pack.loader === 'fabric' ? v.includes('fabric-loader') : v.includes('forge-'));
        if (!hasLoader) {
          const { installFabric, installForge } = require('./mc-mods.cjs');
          onProgress({ phase: 'modpack', message: `Installing ${pack.loader} loader...`, percent: 30 });
          if (pack.loader === 'fabric') await installFabric(pack.mcVersion, pack.loaderVersion, (p) => onProgress({ phase: 'modpack', message: 'Installing Fabric...', percent: 30 + Math.round(p.percent * 0.2) }));
          else await installForge(pack.mcVersion, pack.loaderVersion, (p) => onProgress({ phase: 'modpack', message: 'Installing Forge...', percent: 30 + Math.round(p.percent * 0.2) }));
        }
      } catch (e) { logWarn('Modpack', 'caught', e) }
    }

    // Download all files to their proper game-dir-relative paths
    for (const mod of pack.mods) {
      onProgress({ phase: 'modpack', message: `Installing ${mod.path}...`, percent: 50 + Math.round((completed / Math.max(total, 1)) * 50), current: completed, total });
      try {
        // mrpack paths may contain ../ traversal - sanitize
        const safePath = mod.path.replace(/^[.\/\\]+/, '').replace(/[\\/]+/g, '/');
        if (safePath.includes('..')) continue;
        const destPath = path.join(versionDir, safePath);
        ensureDir(path.dirname(destPath));
        if (mod.url) {
          await downloadFileWithRedirect(mod.url, destPath);
        }
      } catch (e) { logWarn('Modpack', 'caught', e) }
      completed++;
    }

    // Extract overrides/ and client-overrides/ from the mrpack zip
    if (pack.zip) {
      const entries = pack.zip.getEntries();
      for (const entry of entries) {
        const name = entry.entryName;
        if ((name.startsWith('overrides/') || name.startsWith('client-overrides/')) && !entry.isDirectory) {
          const relPath = name.replace(/^(overrides|client-overrides)\//, '');
          const destPath = path.join(versionDir, relPath);
          ensureDir(path.dirname(destPath));
          if (!fs.existsSync(destPath)) {
            try { pack.zip.extractEntryTo(entry, path.dirname(destPath), false, true); } catch (e) { logWarn('Modpack', 'caught', e) }
          }
        }
      }
    }
  }

  // Copy overrides if present (CurseForge packs only; Modrinth handled above)
  if (pack.format === 'curseforge' && pack.zip && pack.overrides) {
    const entries = pack.zip.getEntries();
    for (const entry of entries) {
      const name = entry.entryName;
      if (name.startsWith('overrides/') && !entry.isDirectory) {
        const relPath = name.replace('overrides/', '');
        const destPath = path.join(versionDir, relPath);
        ensureDir(path.dirname(destPath));
        if (!fs.existsSync(destPath)) {
          try { pack.zip.extractEntryTo(entry, path.dirname(destPath), false, true); } catch (e) { logWarn('Modpack', 'caught', e) }
        }
      }
    }
  }

  onProgress({ phase: 'done', message: 'Modpack installation complete!', percent: 100 });
  return { success: true, name: safeName };
}

function downloadFileWithRedirect(url, destPath) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http = require('http');
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'MCLauncher/2.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFileWithRedirect(res.headers.location, destPath).then(resolve).catch(reject);
      }
      const ws = fs.createWriteStream(destPath);
      res.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
    }).on('error', reject);
  });
}

// ─── Modpack Export ────────────────────────────────────────

async function exportModpack(versionId, format = 'curseforge') {
  const versionDir = path.join(VERSIONS_DIR, versionId);
  if (!fs.existsSync(versionDir)) throw new Error('Version not found');

  const modsDir = path.join(versionDir, 'mods');
  const mods = fs.existsSync(modsDir) ? fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar')) : [];

  // Get version info
  let mcVersion = versionId;
  let loader = '';
  const jsonPath = path.join(versionDir, `${versionId}.json`);
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      if (data.inheritsFrom) mcVersion = data.inheritsFrom;
      if (data.id.includes('fabric')) loader = 'fabric';
      if (data.id.includes('forge')) loader = 'forge';
    } catch (e) { logWarn('Modpack', 'caught', e) }
  }

  const packDir = path.join(BASE_DIR, 'exports');
  ensureDir(packDir);
  const exportPath = path.join(packDir, `${versionId}-modpack.zip`);

  const AdmZip = require('adm-zip');
  const exportZip = new AdmZip();

  // Create manifest
  const manifest = {
    minecraft: { version: mcVersion, modLoaders: loader ? [{ id: `${loader}-loader`, primary: true }] : [] },
    manifestType: 'minecraftModpack',
    manifestVersion: 1,
    name: versionId,
    version: '1.0.0',
    author: 'MC Launcher',
    files: [], // We can't resolve CurseForge IDs retroactively
    overrides: 'overrides',
  };
  exportZip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));

  // Add mods to overrides
  for (const mod of mods) {
    exportZip.addLocalFile(path.join(modsDir, mod), 'overrides/mods');
  }

  // Add configs if present
  const configDir = path.join(versionDir, 'config');
  if (fs.existsSync(configDir)) {
    exportZip.addLocalFolder(configDir, 'overrides/config');
  }

  exportZip.writeZip(exportPath);
  return { success: true, path: exportPath, name: path.basename(exportPath) };
}

module.exports = { parseModpack, installModpack, exportModpack };
