const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const { VERSIONS_DIR, LIBRARIES_DIR, BASE_DIR, logWarn } = require('./mc-api.cjs');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'MCLauncher/1.0' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function httpGetJSON(url) {
  return httpGet(url).then((buf) => JSON.parse(buf.toString('utf-8')));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(destPath));
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'MCLauncher/1.0' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      const total = parseInt(res.headers['content-length'], 10) || 0;
      let downloaded = 0;
      const ws = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        ws.write(chunk);
        if (onProgress && total > 0) {
          onProgress({ downloaded, total, percent: Math.round((downloaded / total) * 100) });
        }
      });
      res.on('end', () => { ws.end(); resolve(); });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// ─── Fabric ────────────────────────────────────────────────

async function getFabricLoaderVersions(mcVersion) {
  const data = await httpGetJSON(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
  return data.map((item) => ({
    version: item.loader.version,
    stable: item.loader.stable,
  }));
}

async function getFabricInstallers(mcVersion) {
  const data = await httpGetJSON(`https://meta.fabricmc.net/v2/versions/installer`);
  return data.map((item) => ({
    version: item.version,
    stable: item.stable,
  }));
}

async function installFabric(mcVersion, loaderVersion, onProgress) {
  onProgress({ phase: 'fabric', message: 'Fetching Fabric profile...', percent: 0 });

  // Get the Fabric profile JSON
  const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
  const profileData = await httpGetJSON(profileUrl);

  const versionId = profileData.id;
  const versionDir = path.join(VERSIONS_DIR, versionId);

  // Save version JSON
  ensureDir(versionDir);
  const jsonPath = path.join(versionDir, `${versionId}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(profileData, null, 2));

  // Download Fabric libraries
  if (profileData.libraries) {
    let completed = 0;
    let failed = 0;
    const total = profileData.libraries.length;
    for (const lib of profileData.libraries) {
      if (lib.name && lib.url) {
        const parts = lib.name.split(':');
        if (parts.length >= 3) {
          const [group, artifact, version] = parts;
          const subPath = `${group.replace(/\./g, '/')}/${artifact}/${version}/${artifact}-${version}.jar`;
          const destPath = path.join(LIBRARIES_DIR, subPath);
          if (!fs.existsSync(destPath)) {
            const baseUrl = lib.url.endsWith('/') ? lib.url : lib.url + '/';
            try { await downloadFile(baseUrl + subPath, destPath); }
            catch { failed++; }
          }
        }
      }
      completed++;
      onProgress({ phase: 'fabric', message: `Fabric libs: ${completed}/${total}${failed > 0 ? ` (${failed} failed)` : ''}`, percent: Math.round((completed / total) * 100), current: completed, total });
      onProgress({
        phase: 'fabric',
        message: 'Downloading Fabric libraries...',
        percent: Math.round((completed / profileData.libraries.length) * 100),
        current: completed,
        total: profileData.libraries.length,
      });
    }
  }

  // Copy the base Minecraft jar to the new version (Fabric inherits from it)
  const baseJarPath = path.join(VERSIONS_DIR, mcVersion, `${mcVersion}.jar`);
  const targetJarPath = path.join(versionDir, `${versionId}.jar`);
  if (fs.existsSync(baseJarPath) && !fs.existsSync(targetJarPath)) {
    fs.copyFileSync(baseJarPath, targetJarPath);
  }

  onProgress({ phase: 'done', message: 'Fabric installation complete!', percent: 100 });
  return { versionId, profileData };
}

// ─── Forge ─────────────────────────────────────────────────

async function getForgeVersions(mcVersion) {
  try {
    // Try BMCLAPI mirror first
    const data = await httpGetJSON(`https://bmclapi2.bangbang93.com/forge/minecraft/${mcVersion}`);
    return data.map((item) => ({
      version: item.version,
      mcversion: item.mcversion,
      installerUrl: `https://bmclapi2.bangbang93.com/forge/download?mcversion=${mcVersion}&version=${item.version}&category=installer&format=jar`,
      universalUrl: `https://bmclapi2.bangbang93.com/forge/download?mcversion=${mcVersion}&version=${item.version}&category=installer&format=jar`,
    }));
  } catch {
    // Fallback: try the Forge maven (limited support)
    try {
      const xml = (await httpGet(`https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml`)).toString('utf-8');
      const versions = xml.match(/<version>([\d.]+-[\d.]+)<\/version>/g) || [];
      return versions
        .map((v) => v.replace(/<\/?version>/g, ''))
        .filter((v) => v.startsWith(`${mcVersion}-`) || v.startsWith(`${mcVersion.split('.').slice(0, 2).join('.')}-`))
        .map((v) => ({
          version: v.split('-').slice(1).join('-'),
          mcversion: mcVersion,
          installerUrl: `https://maven.minecraftforge.net/net/minecraftforge/forge/${v}/forge-${v}-installer.jar`,
          universalUrl: `https://maven.minecraftforge.net/net/minecraftforge/forge/${v}/forge-${v}-universal.jar`,
        }));
    } catch {
      return [];
    }
  }
}

async function installForge(mcVersion, forgeVersion, onProgress) {
  // Try BMCLAPI first, then fallback
  const fullVersion = `${mcVersion}-${forgeVersion}`;
  const installerBaseUrl = `https://bmclapi2.bangbang93.com/forge/download?mcversion=${mcVersion}&version=${forgeVersion}&category=installer&format=jar`;

  onProgress({ phase: 'forge', message: 'Downloading Forge installer...', percent: 0 });

  const tempDir = path.join(BASE_DIR, 'temp');
  ensureDir(tempDir);
  const installerPath = path.join(tempDir, `forge-${fullVersion}-installer.jar`);

  try {
    await downloadFile(installerBaseUrl, installerPath, (p) => {
      onProgress({ phase: 'forge', message: 'Downloading Forge installer...', percent: p.percent });
    });
  } catch {
    // Fallback to official maven
    const fallbackUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`;
    await downloadFile(fallbackUrl, installerPath);
  }

  onProgress({ phase: 'forge', message: 'Extracting version profile...', percent: 50 });

  // Extract version.json from the installer jar
  const AdmZip = require('adm-zip');
  let versionData;
  try {
    const zip = new AdmZip(installerPath);
    const versionEntry = zip.getEntries().find(
      (e) => e.entryName === 'version.json'
    );
    if (versionEntry) {
      versionData = JSON.parse(versionEntry.getData().toString('utf-8'));
    }
  } catch (e) { logWarn('Mods', 'caught', e) }

  if (!versionData) {
    // Try extracting with jar command as fallback
    throw new Error('Could not extract Forge version profile from installer');
  }

  const versionId = versionData.id || fullVersion;
  const versionDir = path.join(VERSIONS_DIR, versionId);
  ensureDir(versionDir);

  // Save version JSON
  const jsonPath = path.join(versionDir, `${versionId}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(versionData, null, 2));

  // Download Forge libraries
  if (versionData.libraries) {
    let completed = 0;
    let totalLibs = versionData.libraries;
    let filtered = [];
    for (const lib of totalLibs) {
      // Skip native libraries that don't apply
      if (lib.rules) {
        const allow = lib.rules.every((rule) => {
          if (rule.action === 'allow') {
            if (rule.os) return rule.os.name === 'windows';
            return true;
          }
          if (rule.action === 'disallow') {
            if (rule.os) return rule.os.name !== 'windows';
            return false;
          }
          return true;
        });
        if (!allow) continue;
      }
      filtered.push(lib);
    }

    for (const lib of filtered) {
      if (lib.downloads?.artifact) {
        const artifact = lib.downloads.artifact;
        const libPath = path.join(LIBRARIES_DIR, artifact.path);
        if (!fs.existsSync(libPath)) {
          try {
            await downloadFile(artifact.url, libPath);
          } catch (e) { logWarn('Mods', 'caught', e) }
        }
      }
      completed++;
      onProgress({
        phase: 'forge',
        message: 'Downloading Forge libraries...',
        percent: Math.round((completed / filtered.length) * 60) + 40,
        current: completed,
        total: filtered.length,
      });
    }
  }

  // Clean up temp
  try { fs.unlinkSync(installerPath); } catch (e) { logWarn('Mods', 'caught', e) }

  onProgress({ phase: 'done', message: 'Forge installation complete!', percent: 100 });
  return { versionId, versionData };
}

module.exports = {
  getFabricLoaderVersions,
  getFabricInstallers,
  installFabric,
  getForgeVersions,
  installForge,

  // OptiFine
  async getOptiFineVersions(mcVersion) {
    try {
      const data = await httpGetJSON('https://bmclapi2.bangbang93.com/optifine/versionList');
      return data.filter((v) => v.startsWith(mcVersion + '_') || v.startsWith(mcVersion + '-')).map((v) => ({
        version: v,
        mcversion: mcVersion,
      }));
    } catch { return []; }
  },

  async installOptiFine(mcVersion, optiVersion, onProgress) {
    // BMCLAPI provides both download and pre-made version JSON
    const versionId = `${mcVersion}-OptiFine_${optiVersion.split('_').slice(1).join('_')}`;
    const versionDir = path.join(VERSIONS_DIR, versionId);
    ensureDir(versionDir);

    // First, ensure base version exists
    const baseJsonPath = path.join(VERSIONS_DIR, mcVersion, `${mcVersion}.json`);
    if (!fs.existsSync(baseJsonPath)) {
      // Copy from downloaded version info
      try {
        const { getVersionInfo } = require('./mc-api.cjs');
        const info = await getVersionInfo(mcVersion);
        ensureDir(path.join(VERSIONS_DIR, mcVersion));
        fs.writeFileSync(baseJsonPath, JSON.stringify(info, null, 2));
      } catch { throw new Error(`Base version ${mcVersion} not found`); }
    }

    // Download OptiFine installer
    const installerUrl = `https://bmclapi2.bangbang93.com/optifine/${mcVersion}/${optiVersion.replace(`${mcVersion}_`, '')}/`;
    const tempDir = path.join(BASE_DIR, 'temp');
    ensureDir(tempDir);
    const installerPath = path.join(tempDir, `optifine-${optiVersion}.jar`);

    onProgress({ phase: 'optifine', message: 'Downloading OptiFine...', percent: 0 });
    try {
      await downloadFile(installerUrl, installerPath, (p) => {
        onProgress({ phase: 'optifine', message: 'Downloading OptiFine...', percent: p.percent });
      });
    } catch {
      // Try alternative URL pattern
      const altUrl = `https://bmclapi2.bangbang93.com/optifine/${mcVersion}/${optiVersion}/`;
      await downloadFile(altUrl, installerPath);
    }

    // Extract version.json from installer
    onProgress({ phase: 'optifine', message: 'Extracting OptiFine profile...', percent: 50 });
    const AdmZip = require('adm-zip');
    let versionData;
    try {
      const zip = new AdmZip(installerPath);
      const entry = zip.getEntries().find((e) => e.entryName === 'version.json' || e.entryName.endsWith('.json'));
      if (entry) versionData = JSON.parse(entry.getData().toString('utf-8'));
    } catch (e) { logWarn('Mods', 'caught', e) }

    if (!versionData) {
      // Fallback: create a simple version JSON manually
      const baseData = JSON.parse(fs.readFileSync(baseJsonPath, 'utf-8'));
      versionData = {
        id: versionId,
        inheritsFrom: mcVersion,
        type: 'release',
        mainClass: 'net.minecraft.launchwrapper.Launch',
        arguments: {
          game: [],
          jvm: ['-Doptifine.installer=true'],
        },
        libraries: [
          ...(baseData.libraries || []),
          {
            name: `optifine:OptiFine:${optiVersion}`,
            downloads: {
              artifact: {
                path: `optifine/OptiFine/${optiVersion}/OptiFine-${optiVersion}.jar`,
                url: '',
              },
            },
          },
        ],
      };
      // Copy the OptiFine installer jar to libraries
      const libDir = path.join(LIBRARIES_DIR, 'optifine', 'OptiFine', optiVersion);
      ensureDir(libDir);
      fs.copyFileSync(installerPath, path.join(libDir, `OptiFine-${optiVersion}.jar`));
    }

    fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionData, null, 2));

    // Copy base jar
    const baseJar = path.join(VERSIONS_DIR, mcVersion, `${mcVersion}.jar`);
    const targetJar = path.join(versionDir, `${versionId}.jar`);
    if (fs.existsSync(baseJar) && !fs.existsSync(targetJar)) {
      fs.copyFileSync(baseJar, targetJar);
    }

    // Clean up
    try { fs.unlinkSync(installerPath); } catch (e) { logWarn('Mods', 'caught', e) }

    onProgress({ phase: 'done', message: 'OptiFine installation complete!', percent: 100 });
    return { versionId, versionData };
  },

  // NeoForge
  async getNeoForgeVersions(mcVersion) {
    try {
      const data = await httpGetJSON('https://bmclapi2.bangbang93.com/neoforge/list');
      return (data || []).filter(v => v.mcversion === mcVersion).map(v => ({ version: v.version, mcversion: v.mcversion }));
    } catch { return []; }
  },

  async installNeoForge(mcVersion, version, onProgress) {
    const versionId = `neoforge-${version}`;
    const versionDir = path.join(VERSIONS_DIR, versionId); ensureDir(versionDir);
    const jsonPath = path.join(versionDir, `${versionId}.json`);
    if (!fs.existsSync(jsonPath)) {
      // Download installer, extract version.json
      const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
      const temp = path.join(BASE_DIR, 'temp'); ensureDir(temp);
      const ip = path.join(temp, `nf-${version}.jar`);
      onProgress({ phase: 'neoforge', message: 'Downloading NeoForge...', percent: 0 });
      try { await downloadFile(url, ip, p => onProgress({ phase: 'neoforge', message: 'Downloading NeoForge...', percent: p.percent })); }
      catch { await downloadFile(`https://bmclapi2.bangbang93.com/neoforge/download/${version}`, ip); }
      onProgress({ phase: 'neoforge', message: 'Extracting profile...', percent: 50 });
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(ip);
      const entry = zip.getEntries().find(e => e.entryName === 'version.json');
      if (!entry) throw new Error('No version.json in NeoForge installer');
      const vd = JSON.parse(entry.getData().toString('utf-8'));
      vd.id = versionId;
      fs.writeFileSync(jsonPath, JSON.stringify(vd, null, 2));
      // Download libraries
      if (vd.libraries) {
        let c = 0; const t = vd.libraries.length;
        for (const lib of vd.libraries) {
          if (lib.rules) { const a = lib.rules.every(r => r.action === 'allow' ? (!r.os || r.os.name === 'windows') : r.os && r.os.name !== 'windows'); if (!a) continue; }
          if (lib.downloads?.artifact) { const p = path.join(LIBRARIES_DIR, lib.downloads.artifact.path); if (!fs.existsSync(p)) try { await downloadFile(lib.downloads.artifact.url, p); } catch (e) { logWarn('Mods', 'caught', e) } }
          c++; onProgress({ phase: 'neoforge', message: `NeoForge libs: ${c}/${t}`, percent: 60 + Math.round((c / t) * 40), current: c, total: t });
        }
      }
      try { fs.unlinkSync(ip); } catch (e) { logWarn('Mods', 'caught', e) }
    }
    const bj = path.join(VERSIONS_DIR, mcVersion, `${mcVersion}.jar`);
    const tj = path.join(versionDir, `${versionId}.jar`);
    if (fs.existsSync(bj) && !fs.existsSync(tj)) fs.copyFileSync(bj, tj);
    onProgress({ phase: 'done', message: 'NeoForge complete!', percent: 100 });
    return { versionId, versionData: JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) };
  },

  // Quilt
  async getQuiltVersions(mcVersion) {
    try {
      const data = await httpGetJSON('https://meta.quiltmc.org/v3/versions/loader');
      return (data || []).filter(v => v.version).map(v => ({ version: v.version, stable: v.stable }));
    } catch { return []; }
  },

  async installQuilt(mcVersion, loaderVersion, onProgress) {
    onProgress({ phase: 'quilt', message: 'Fetching Quilt profile...', percent: 0 });
    const d = await httpGetJSON(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${loaderVersion}/profile/json`);
    const vid = d.id; const vd = path.join(VERSIONS_DIR, vid); ensureDir(vd);
    fs.writeFileSync(path.join(vd, `${vid}.json`), JSON.stringify(d, null, 2));
    if (d.libraries) {
      let c = 0; const t = d.libraries.length;
      for (const lib of d.libraries) {
        if (lib.name && lib.url) {
          const [g, a, v] = lib.name.split(':'); if (!g || !a || !v) continue;
          const sp = `${g.replace(/\./g, '/')}/${a}/${v}/${a}-${v}.jar`;
          const dp = path.join(LIBRARIES_DIR, sp);
          if (!fs.existsSync(dp)) try { await downloadFile((lib.url.endsWith('/') ? lib.url : lib.url + '/') + sp, dp); } catch (e) { logWarn('Mods', 'caught', e) }
        }
        c++; onProgress({ phase: 'quilt', message: `Quilt libs: ${c}/${t}`, percent: Math.round((c / t) * 100), current: c, total: t });
      }
    }
    const bj = path.join(VERSIONS_DIR, mcVersion, `${mcVersion}.jar`);
    const tj = path.join(vd, `${vid}.jar`);
    if (fs.existsSync(bj) && !fs.existsSync(tj)) fs.copyFileSync(bj, tj);
    onProgress({ phase: 'done', message: 'Quilt complete!', percent: 100 });
    return { versionId: vid, profileData: d };
  },
};
