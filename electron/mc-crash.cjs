const fs = require('fs');
const path = require('path');
const { BASE_DIR } = require('./mc-api.cjs');

function checkCrashReports() {
  const crashDir = path.join(BASE_DIR, 'crash-reports');
  if (!fs.existsSync(crashDir)) return [];
  const { loadSettings, saveSettings } = require('./mc-settings.cjs');
  const settings = loadSettings();
  const lastChecked = settings.lastCrashCheck || 0;
  const now = Date.now();
  try {
    const files = fs.readdirSync(crashDir).filter(f => f.startsWith('crash-') && f.endsWith('.txt'));
    const fresh = files
      .map(f => ({ f, stat: fs.statSync(path.join(crashDir, f)) }))
      .filter(x => x.stat.mtimeMs > lastChecked)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      .slice(0, 5);
    saveSettings({ lastCrashCheck: now });
    return fresh.map(({ f, stat }) => {
      const content = fs.readFileSync(path.join(crashDir, f), 'utf-8');
      const lines = content.split('\n');
      const timeLine = lines.find(l => l.startsWith('Time: '));
      const descLine = lines.find(l => l.startsWith('Description: '));
      let summary = '';
      // Try to find the actual error description
      const descIdx = lines.findIndex(l => l.startsWith('Description: '));
      if (descIdx >= 0) {
        for (let i = descIdx; i < Math.min(descIdx + 5, lines.length); i++) {
          if (lines[i].trim()) summary += lines[i].trim() + '\n';
        }
      }
      return {
        file: f,
        date: timeLine ? timeLine.replace('Time: ', '') : '',
        description: descLine ? descLine.replace('Description: ', '') : 'Unknown error',
        summary: summary || 'Could not parse crash report',
        // Check for common issues
        isOutOfMemory: content.includes('java.lang.OutOfMemoryError'),
        isModConflict: content.includes('Mixin') || content.includes('ClassNotFoundException'),
        isDriverIssue: content.includes('Pixel format') || content.includes('OpenGL') || content.includes('LWJGL'),
      };
    });
  } catch { return []; }
}

function getCrashSuggestion(crash) {
  if (crash.isOutOfMemory) return 'Increase memory allocation in Settings. Current default is 4096 MB.';
  if (crash.isModConflict) return 'A mod is causing a compatibility issue. Try removing recently added mods.';
  if (crash.isDriverIssue) return 'Graphics driver or OpenGL issue. Try updating your GPU drivers.';
  return 'Check the full crash report in the game directory.';
}

function getCrashDetail(file) {
  const crashDir = path.join(BASE_DIR, 'crash-reports');
  const p = path.join(crashDir, file);
  if (!fs.existsSync(p)) return null;
  const content = fs.readFileSync(p, 'utf-8');
  // Extract key sections
  const lines = content.split('\n');
  const sections = {
    time: '', description: '', stacktrace: '', system: '',
  };
  const timeIdx = lines.findIndex(l => l.startsWith('Time: '));
  if (timeIdx >= 0) sections.time = lines[timeIdx].replace('Time: ', '');
  const descIdx = lines.findIndex(l => l.startsWith('Description: '));
  if (descIdx >= 0) {
    sections.description = lines[descIdx].replace('Description: ', '');
    // Stacktrace follows after a blank line
    let i = descIdx + 1;
    while (i < lines.length && !lines[i].trim()) i++;
    const stack = [];
    while (i < lines.length && stack.length < 30 && !lines[i].startsWith('--')) {
      if (lines[i].trim()) stack.push(lines[i]);
      i++;
    }
    sections.stacktrace = stack.join('\n');
  }
  // System details section
  const sysIdx = lines.findIndex(l => l.startsWith('System Details'));
  if (sysIdx >= 0) {
    const sys = [];
    for (let i = sysIdx + 1; i < Math.min(sysIdx + 30, lines.length); i++) {
      if (lines[i].trim()) sys.push(lines[i]);
    }
    sections.system = sys.join('\n');
  }
  return { file, ...sections, full: content };
}

// ─── Pre-launch validation ─────────────────────────────────

const { execSync } = require('child_process');

function validateJava(javaPath) {
  try {
    const result = execSync(`"${javaPath}" -version 2>&1`).toString();
    const versionMatch = result.match(/version "(\d+[.\d+]*)/);
    if (versionMatch) {
      const major = parseInt(versionMatch[1].split('.')[0]);
      return { valid: true, version: versionMatch[1], major };
    }
  } catch {}
  return { valid: false, error: 'Java not found or incompatible. Install Java 17+ or set path in Settings.' };
}

function validateVersion(versionId) {
  const VERSIONS_DIR = path.join(BASE_DIR, 'versions');
  const versionDir = path.join(VERSIONS_DIR, versionId);
  const jsonPath = path.join(versionDir, `${versionId}.json`);
  const jarPath = path.join(versionDir, `${versionId}.jar`);

  if (!fs.existsSync(jsonPath)) return { valid: false, error: `Version JSON not found: ${jsonPath}` };
  if (!fs.existsSync(jarPath)) return { valid: false, error: `Version JAR not found: ${jarPath}. Download the version first.` };

  // Check for required natives
  const nativesDir = path.join(versionDir, 'natives');
  // Not critical but warn

  return { valid: true };
}

function validateDiskSpace() {
  try {
    // Use statfs (Node 18.15+) or PowerShell fallback
    let freeBytes = 0;
    try {
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync(BASE_DIR);
        freeBytes = stats.bavail * stats.bsize;
      }
    } catch {}
    if (freeBytes === 0) {
      try {
        const { execSync } = require('child_process');
        const result = execSync(`powershell -NoProfile -Command "Get-PSDrive -Name C | Select-Object -ExpandProperty Free"`, { encoding: 'utf-8' });
        freeBytes = parseInt(result.trim());
      } catch {}
    }
    if (freeBytes > 0 && freeBytes < 500 * 1024 * 1024) {
      return { valid: false, error: 'Low disk space (< 500MB). Free up space to avoid crashes.' };
    }
  } catch {}
  return { valid: true };
}

module.exports = { checkCrashReports, getCrashSuggestion, getCrashDetail, validateJava, validateVersion, validateDiskSpace };
