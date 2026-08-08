const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadSettings, saveSettings } = require('./mc-settings.cjs');

// ─── Java scanner ──────────────────────────────────────────
// Scan common JDK locations and JAVA_HOME, report versions

function commonJavaDirs() {
  const dirs = [];
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pfx = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  dirs.push(path.join(pf, 'Java'), path.join(pf, 'Eclipse Adoptium'), path.join(pf, 'Zulu'), path.join(pfx, 'Java'), path.join(pf, 'Microsoft'));
  dirs.push(path.join(process.env.LOCALAPPDATA || '', 'Programs'));
  return dirs;
}

function getJavaVersion(javaPath) {
  return new Promise((resolve) => {
    exec(`"${javaPath}" -version 2>&1`, { timeout: 5000 }, (err, stdout, stderr) => {
      const out = (stdout || stderr || '').toString();
      const m = out.match(/version "([^"]+)"/);
      if (m) {
        const ver = m[1];
        const major = parseInt(ver.split('.')[0]) === 1 ? parseInt(ver.split('.')[1]) : parseInt(ver.split('.')[0]);
        resolve({ path: javaPath, version: ver, major });
      } else resolve(null);
    });
  });
}

async function scanJava() {
  const found = new Map(); // path -> info
  const scanPath = (dir) => {
    try {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const jdkDir = path.join(dir, entry.name);
        for (const bin of ['javaw.exe', 'java.exe']) {
          const exe = path.join(jdkDir, 'bin', bin);
          if (fs.existsSync(exe)) {
            found.set(exe, { path: exe, major: 0, version: '' });
            break;
          }
        }
      }
    } catch {}
  };
  commonJavaDirs().forEach(scanPath);

  // JAVA_HOME
  if (process.env.JAVA_HOME) {
    for (const bin of ['javaw.exe', 'java.exe']) {
      const exe = path.join(process.env.JAVA_HOME, 'bin', bin);
      if (fs.existsSync(exe)) found.set(exe, { path: exe, major: 0, version: '' });
    }
  }

  const results = [];
  for (const info of found.values()) {
    const ver = await getJavaVersion(info.path);
    if (ver) results.push(ver);
  }
  results.sort((a, b) => b.major - a.major);
  saveSettings({ javaScan: results });
  return results;
}

// Extract MC version from any version ID (root or loader)
function extractMcVersion(versionId) {
  if (!versionId) return '1.20.1';
  const segments = (versionId.match(/\d+\.\d+(?:\.\d+)?/g) || []);
  return segments.filter(s => s.startsWith('1.')).pop() || segments[0] || versionId;
}

function compareVersionLt(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return true;
    if ((pa[i] || 0) > (pb[i] || 0)) return false;
  }
  return false;
}

function compareVersionGte(a, b) {
  return !compareVersionLt(a, b);
}

// Recommended Java major for a Minecraft version (simple single-value)
function recommendedJavaMajor(mcVersion) {
  const mcSeg = extractMcVersion(mcVersion);
  const v = mcSeg.split('.');
  if (v.length < 2) return 17;
  const minor = parseInt(v[1]);
  if (minor >= 24) return 21;  // 1.24+
  if (minor >= 21) return 21;  // 1.21+ needs Java 21
  if (minor >= 18) return 17;  // 1.18+ needs Java 17
  if (minor >= 17) return 16;  // 1.17 needs Java 16
  if (minor >= 12) return 8;   // 1.12+ Java 8
  return 8;
}

// Full constraint-based Java version range for a version
// Returns {min, max} — max may be Infinity meaning no upper bound
// Based on PCL's GetJavaRequirement logic
function getJavaConstraint(versionId) {
  const result = { min: 8, max: Infinity };
  const mcSeg = extractMcVersion(versionId);
  const mcParts = mcSeg.split('.').map(Number);
  const minor = mcParts[1] || 20;

  if (!versionId) return { min: 17, max: Infinity };

  const VERSIONS_DIR = require('./mc-api.cjs').VERSIONS_DIR;

  // Read version JSON — if this is a loader version (inheritsFrom), merge with parent
  let versionJson = null, parentJson = null;
  const jsonPath = path.join(VERSIONS_DIR, versionId, `${versionId}.json`);
  if (fs.existsSync(jsonPath)) {
    try { versionJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); } catch {}
  }
  // If this version inherits from a parent (Fabric/Forge loader), read parent too
  if (versionJson?.inheritsFrom) {
    const parentPath = path.join(VERSIONS_DIR, versionJson.inheritsFrom, `${versionJson.inheritsFrom}.json`);
    if (fs.existsSync(parentPath)) {
      try { parentJson = JSON.parse(fs.readFileSync(parentPath, 'utf-8')); } catch {}
    }
  }

  // Read Mojang's javaVersion requirement from version JSON
  const javaReq = versionJson?.javaVersion?.majorVersion || parentJson?.javaVersion?.majorVersion;
  if (javaReq) {
    result.min = Math.max(result.min, parseInt(javaReq));
  } else if (minor >= 24) {
    result.min = 21;
  } else if (minor >= 21 || (minor === 20 && mcParts[2] >= 5)) {
    result.min = 21;
  } else if (minor >= 18) {
    result.min = 17;
  } else if (minor >= 17) {
    result.min = 16;
  } else if (minor >= 12) {
    result.min = 8;
  }

  // Detect loaders from combined libraries (version + parent)
  const allLibs = [
    ...(versionJson?.libraries || []),
    ...(parentJson?.libraries || []),
  ];

  const hasOptiFine = (versionJson?.id || '').includes('OptiFine') ||
                      (parentJson?.id || '').includes('OptiFine');
  const hasFabric = !!(versionJson?.inheritsFrom) || versionId.includes('fabric');
  const hasLiteLoader = (versionJson?.id || '').includes('LiteLoader') ||
                        (parentJson?.id || '').includes('LiteLoader');

  let forgeVer = null, neoVer = null;
  for (const lib of allLibs) {
    const name = typeof lib === 'string' ? lib : (lib.name || '');
    if (name.startsWith('net.minecraftforge:forge:') || name.startsWith('net.minecraftforge:fmlloader:')) {
      const m = name.match(/:(\d+\.\d+(?:\.\d+)*)/);
      if (m) forgeVer = m[1];
    }
    if (name.startsWith('net.neoforged:neoforge:') || name.startsWith('net.neoforged:fmlloader:')) {
      const m = name.match(/:(\d+\.\d+(?:\.\d+)*(?:-beta)?)/);
      if (m) neoVer = m[1];
    }
  }

  // Forge-specific constraints
  if (forgeVer) {
    if (minor <= 12) {
      result.max = 8;
    } else if (minor <= 14) {
      result.min = 8; result.max = Math.min(result.max, 10);
    } else if (minor === 15) {
      result.min = 8; result.max = Math.min(result.max, 15);
    } else if (compareVersionGte(forgeVer, '36.2.26') && compareVersionLt(forgeVer, '37.0.0')) {
      result.max = Math.min(result.max, 23);
    } else if (compareVersionGte(forgeVer, '34.0.0') && compareVersionLt(forgeVer, '37.0.0')) {
      result.max = 8;
    } else if (compareVersionGte(forgeVer, '37.0.0') && compareVersionLt(forgeVer, '37.0.80')) {
      result.max = Math.min(result.max, 16);
    } else if (minor === 18 && hasOptiFine) {
      result.max = Math.min(result.max, 18);
    } else if (compareVersionGte(forgeVer, '45.0.21') && compareVersionLt(forgeVer, '45.0.66')) {
      result.max = Math.min(result.max, 19);
    } else if (compareVersionGte(forgeVer, '45.0.66') && compareVersionLt(forgeVer, '47.4.9')) {
      result.max = Math.min(result.max, 21);
    }
  }

  // NeoForge constraints
  if (neoVer) {
    if (compareVersionLt(neoVer, '20.2.62-beta') || (minor === 20 && mcParts[2] === 1)) {
      result.max = Math.min(result.max, 21);
    }
  }

  // Fabric constraints
  if (hasFabric) {
    if (minor >= 15 && minor <= 16) result.min = Math.max(result.min, 8);
    if (minor >= 18) result.min = Math.max(result.min, 17);
  }

  // OptiFine constraints
  if (hasOptiFine) {
    if (minor < 7) result.max = Math.min(result.max, 8);
    if (minor >= 8 && minor < 12) { result.min = 8; result.max = 8; }
    if (minor === 12) result.max = Math.min(result.max, 8);
  }

  // LiteLoader constraints
  if (hasLiteLoader) {
    result.max = Math.min(result.max, 8);
  }

  return result;
}

// ─── Network diagnostics ───────────────────────────────────

function pingHost(host, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => { socket.destroy(); resolve({ host, ok: true, ms: Date.now() - start }); });
    socket.on('timeout', () => { socket.destroy(); resolve({ host, ok: false, error: 'Timeout' }); });
    socket.on('error', (e) => { socket.destroy(); resolve({ host, ok: false, error: e.code || 'Error' }); });
    socket.connect(443, host);
  });
}

async function runDiagnostics() {
  const targets = ['launchermeta.mojang.com', 'api.modrinth.com', 'api.github.com', 'maven.fabricmc.net', 'littleskin.cn'];
  const results = [];
  for (const t of targets) {
    const r = await pingHost(t);
    results.push(r);
  }
  const java = await scanJava();
  return { network: results, java: java.slice(0, 3) };
}

module.exports = { scanJava, recommendedJavaMajor, getJavaConstraint, runDiagnostics };
