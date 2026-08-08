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

// Recommended Java major for a Minecraft version
function recommendedJavaMajor(mcVersion) {
  if (!mcVersion) return 17;
  // Extract MC version from loader IDs: fabric-loader-0.19.3-1.20.1 → 1.20.1
  // Look for the "1.xx" segment, taking the last one
  const segments = mcVersion.match(/\d+\.\d+(?:\.\d+)?/g) || [];
  const mcSeg = segments.filter(s => s.startsWith('1.')).pop() || segments[0] || mcVersion;
  const v = mcSeg.split('.');
  if (v.length < 2) return 17;
  const minor = parseInt(v[1]);
  if (minor >= 21) return 21;
  if (minor >= 20) return 17;
  if (minor >= 18) return 17;
  if (minor >= 17) return 16;
  if (minor >= 12) return 8;
  return 8;
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

module.exports = { scanJava, recommendedJavaMajor, runDiagnostics };
