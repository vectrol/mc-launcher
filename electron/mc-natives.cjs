const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { VERSIONS_DIR, LIBRARIES_DIR } = require('./mc-api.cjs');

function extractNatives(versionId, versionData) {
  const nativesDir = path.join(VERSIONS_DIR, versionId, 'natives');
  if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true });

  if (!versionData.libraries) return;

  for (const lib of versionData.libraries) {
    if (!lib.name) continue;

    // Check if this library has native classifiers for current platform
    const classifiers = lib.natives;
    if (!classifiers) continue;

    // Get platform-specific classifier (windows → windows, osx → osx, linux → linux)
    let platformKey = null;
    if (classifiers.windows) platformKey = classifiers.windows;
    else if (classifiers.win32) platformKey = classifiers.win32;
    else continue;

    // Build the path to the native jar
    const parts = lib.name.split(':');
    if (parts.length < 3) continue;
    const [group, artifact, version] = parts;
    // Replace classifier placeholder
    const classifier = platformKey.replace('${arch}', '64');
    const basePath = `${group.replace(/\./g, '/')}/${artifact}/${version}`;
    const jarFileName = `${artifact}-${version}-${classifier}.jar`;
    const jarPath = path.join(LIBRARIES_DIR, basePath, jarFileName);

    if (!fs.existsSync(jarPath)) continue;

    // Extract .dll, .so, .dylib from native jar
    try {
      const zip = new AdmZip(jarPath);
      const entries = zip.getEntries();
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const name = entry.entryName;
        // Only extract native files, skip META-INF and other non-native files
        const ext = path.extname(name).toLowerCase();
        if (['.dll', '.so', '.dylib', '.jnilib'].includes(ext)) {
          const destPath = path.join(nativesDir, path.basename(name));
          if (!fs.existsSync(destPath)) {
            zip.extractEntryTo(entry, nativesDir, false, true);
          }
        }
      }
    } catch {}
  }
}

function hasNatives(versionData) {
  if (!versionData.libraries) return false;
  return versionData.libraries.some((lib) => lib.natives && (lib.natives.windows || lib.natives.win32));
}

module.exports = { extractNatives, hasNatives };
