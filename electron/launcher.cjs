const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { BASE_DIR, VERSIONS_DIR, ASSETS_DIR, LIBRARIES_DIR } = require('./mc-api.cjs');
const { getValidAccount } = require('./mc-auth.cjs');
const { loadSettings, saveSettings, getAutoMemory } = require('./mc-settings.cjs');

function findJava(versionId) {
  // Per-version Java override
  if (versionId) {
    const { getInstanceSettings } = require('./mc-instances.cjs');
    const inst = getInstanceSettings(versionId);
    if (inst.javaPath && fs.existsSync(inst.javaPath)) return inst.javaPath;
  }
  const settings = loadSettings();
  if (settings.javaPath && fs.existsSync(settings.javaPath)) {
    return settings.javaPath;
  }
  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    const exe = path.join(javaHome, 'bin', 'javaw.exe');
    if (fs.existsSync(exe)) return exe;
    const exe2 = path.join(javaHome, 'bin', 'java.exe');
    if (fs.existsSync(exe2)) return exe2;
  }
  return 'java';
}

// Check natives dir exists and has DLLs; if not, re-extract
function ensureNatives(versionId, versionData) {
  const nativesDir = path.join(VERSIONS_DIR, versionId, 'natives');
  if (fs.existsSync(nativesDir)) {
    const dlls = fs.readdirSync(nativesDir).filter(f => f.endsWith('.dll'));
    if (dlls.length > 0) return;
  }
  const { extractNatives } = require('./mc-natives.cjs');
  extractNatives(versionId, versionData);
}

function loadVersionData(versionId) {
  const jsonPath = path.join(VERSIONS_DIR, versionId, `${versionId}.json`);
  if (!fs.existsSync(jsonPath)) return null;
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

function filterLib(lib) {
  if (!lib.rules) return true;
  return lib.rules.every((rule) => {
    if (rule.action === 'allow') return !rule.os || rule.os.name === 'windows';
    if (rule.action === 'disallow') return rule.os && rule.os.name !== 'windows';
    return true;
  });
}

function mergeVersions(childData) {
  const libraries = [];
  const jvmArgs = [];
  const gameArgs = [];
  let mainClass = childData.mainClass || 'net.minecraft.client.main.Main';
  let assetIndexId = childData.assetIndex?.id || childData.id;
  let versionType = childData.type || 'release';
  let parentJar = null;

  // Walk inheritance chain
  const versions = [childData];
  let current = childData;
  const seen = new Set([current.id]);

  while (current.inheritsFrom) {
    const parentId = current.inheritsFrom;
    if (seen.has(parentId)) break;
    seen.add(parentId);

    const parentData = loadVersionData(parentId);
    if (!parentData) break;

    versions.unshift(parentData);
    current = parentData;
  }

  const baseVersion = versions[0];

  // Client jar: from base version's dir, using base version's id
  parentJar = path.join(VERSIONS_DIR, baseVersion.id, `${baseVersion.id}.jar`);
  // Also check child dir (for copied jars)
  const childJar = path.join(VERSIONS_DIR, childData.id, `${childData.id}.jar`);

  // If child's jar exists, prefer it; otherwise use base
  const jarPath = fs.existsSync(childJar) ? childJar : parentJar;

  // Build library list bottom-up (base first, then overrides)
  for (const ver of versions) {
    if (ver.libraries) {
      for (const lib of ver.libraries) {
        if (filterLib(lib)) {
          // Check for overrides: same name replaces previous
          const idx = libraries.findIndex((l) => l.name === lib.name);
          if (idx >= 0 && lib.name) {
            libraries[idx] = lib;
          } else {
            libraries.push(lib);
          }
        }
      }
    }
  }

  // Merge JVM args
  for (const ver of versions) {
    if (ver.arguments?.jvm) {
      for (const arg of ver.arguments.jvm) {
        if (typeof arg === 'string') {
          // Skip template -cp / ${classpath} placeholders - launcher adds its own
          if (arg === '-cp' || arg === '-classpath' || arg === '${classpath}') continue;
          if (arg.startsWith('-') && !jvmArgs.includes(arg)) {
            jvmArgs.push(arg);
          }
        }
      }
    }
  }

  // Merge game args (top-most wins for modern format)
  const topGame = [...versions].reverse().find((v) => v.arguments?.game);
  if (topGame?.arguments?.game) {
    for (const arg of topGame.arguments.game) {
      if (typeof arg === 'string') {
        // Skip template placeholders and launcher-provided flags
        if (arg.startsWith('${') || ['--username', '--version', '--gameDir', '--assetsDir', '--assetIndex', '--uuid', '--accessToken', '--clientId', '--xuid', '--userType', '--versionType'].includes(arg)) {
          continue;
        }
        gameArgs.push(arg);
      } else if (arg.rules) {
        const hasFeatureRule = arg.rules.some((rule) => rule.features);
        if (hasFeatureRule) continue; // Skip feature-gated args (custom resolution, quickplay)
        const allow = arg.rules.every((rule) => {
          if (rule.action === 'allow') return !rule.os || rule.os.name === 'windows';
          if (rule.action === 'disallow') return rule.os && rule.os.name !== 'windows';
          return true;
        });
        if (allow && arg.value) {
          if (typeof arg.value === 'string' && !arg.value.startsWith('${')) gameArgs.push(arg.value);
          else if (Array.isArray(arg.value)) {
            for (const v of arg.value) {
              if (typeof v === 'string' && !v.startsWith('${')) gameArgs.push(v);
            }
          }
        }
      }
    }
  }

  // Use base version's asset settings
  if (baseVersion.assetIndex) assetIndexId = baseVersion.assetIndex.id;
  if (baseVersion.type) versionType = baseVersion.type;

  // MainClass comes from the child (mod loader) or default
  if (!mainClass) mainClass = 'net.minecraft.client.main.Main';

  return {
    id: childData.id,
    mainClass,
    libraries,
    jvmArgs,
    gameArgs,
    assetIndexId,
    versionType,
    jarPath,
    baseId: baseVersion.id,
  };
}

function buildClasspath(merged) {
  const cp = [];
  const missing = [];
  // Client jar
  const jarPaths = [merged.jarPath, path.join(VERSIONS_DIR, merged.baseId, `${merged.baseId}.jar`)];
  let jarFound = false;
  for (const jp of jarPaths) {
    if (fs.existsSync(jp)) { cp.push(jp); jarFound = true; break; }
  }
  if (!jarFound) missing.push(`Client jar (checked: ${jarPaths.join(', ')})`);

  for (const lib of merged.libraries) {
    let found = false;
    if (lib.downloads?.artifact?.path) {
      const p = path.join(LIBRARIES_DIR, lib.downloads.artifact.path);
      if (fs.existsSync(p)) { cp.push(p); found = true; }
    }
    if (!found && lib.name) {
      const parts = lib.name.split(':');
      if (parts.length >= 3) {
        const [group, artifact, version] = parts;
        const subPath = `${group.replace(/\./g, '/')}/${artifact}/${version}/${artifact}-${version}.jar`;
        const libPath = path.join(LIBRARIES_DIR, subPath);
        if (fs.existsSync(libPath)) { cp.push(libPath); found = true; }
        else missing.push(`${artifact}-${version}.jar (${subPath})`);
      }
    }
  }

  if (cp.length === 0) {
    const err = new Error(`Classpath is empty. Missing ${missing.length} libraries. The base game version may need to be downloaded first.\nMissing: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` and ${missing.length - 3} more...` : ''}`);
    err.missingLibs = missing;
    throw err;
  }
  return cp.join(';');
}

function launchGame(versionId, mainWindow) {
  return new Promise(async (resolve, reject) => {
    try {
      const childData = loadVersionData(versionId);
      if (!childData) {
        return reject(new Error(`Version ${versionId} not found. Please install it first.`));
      }

      const merged = mergeVersions(childData);
      const settings = loadSettings();
      const { getInstanceSettings } = require('./mc-instances.cjs');
      const instSettings = getInstanceSettings(versionId);
      const javaPath = findJava(versionId);
      const account = await getValidAccount();

      // Ensure natives exist (repair if missing)
      ensureNatives(versionId, childData);

      const authPlayerName = account?.username || 'Player';
      const authUuid = account?.uuid || '00000000-0000-0000-0000-000000000000';
      const authAccessToken = account?.accessToken || '0';
      const userType = account?.type === 'microsoft' ? 'msa' : account?.type === 'thirdparty' ? 'msa' : 'legacy';

      // authlib-injector javaagent for third-party skin servers
      let javaAgentArg = '';
      if (account?.type === 'thirdparty' && account.authInjectorPath && account.apiRoot) {
        javaAgentArg = `-javaagent:${account.authInjectorPath}=${account.apiRoot}`;
      }

      let maxMemory = instSettings.maxMemory || settings.maxMemory || '4096';
      if (instSettings.autoMemory || settings.autoMemory) {
        maxMemory = getAutoMemory();
      }

      // Custom game directory for this version (instance system)
      const customDirs = settings.customGameDirs || {};
      const gameDir = customDirs[versionId] || BASE_DIR;

      // Custom JVM args from settings
      const customJvmArgs = (settings.jvmArgs || '').split(/\s+/).filter(Boolean);

      // Replace template placeholders in merged JVM args
      const nativesDir = path.join(VERSIONS_DIR, merged.id, 'natives');
      // Find log4j config from version data if available
      let log4jPath = '';
      if (childData.logging?.client?.file) {
        log4jPath = path.join(ASSETS_DIR, 'log_configs', childData.logging.client.file.id);
      }
      const cleanedJvmArgs = merged.jvmArgs.map((arg) =>
        arg
          .replace(/\$\{natives_directory\}/g, nativesDir)
          .replace(/\$\{launcher_name\}/g, 'mc-launcher')
          .replace(/\$\{launcher_version\}/g, '2.0.0')
          .replace(/\$\{path\}/g, log4jPath || '')
          .replace(/\$\{classpath\}/g, '')
          .replace(/\$\{assets_root\}/g, ASSETS_DIR)
          .replace(/\$\{game_directory\}/g, gameDir)
          .replace(/\$\{version_name\}/g, merged.id)
      ).filter((arg) => arg.trim() !== '');

      const allArgs = [
        `-Xmx${maxMemory}M`,
        '-XX:+UseG1GC',
        '-XX:-UseAdaptiveSizePolicy',
        '-XX:-OmitStackTraceInFastThrow',
        '-Dfml.ignoreInvalidMinecraftCertificates=true',
        '-Dfml.ignorePatchDiscrepancies=true',
        `-Djava.library.path=${nativesDir}`,
        '-Dminecraft.launcher.brand=mc-launcher',
        '-Dminecraft.launcher.version=2.0.0',
        ...(javaAgentArg ? [javaAgentArg] : []),
        ...customJvmArgs,
        ...cleanedJvmArgs,
        '-cp',
        buildClasspath(merged),
        merged.mainClass,
        ...merged.gameArgs,
        '--version', merged.id,
        '--gameDir', gameDir,
        '--assetsDir', ASSETS_DIR,
        '--assetIndex', merged.assetIndexId,
        '--accessToken', authAccessToken,
        '--uuid', authUuid,
        '--username', authPlayerName,
        '--userType', userType,
        '--versionType', merged.versionType,
      ];

      const child = spawn(javaPath, allArgs, {
        cwd: gameDir,
        stdio: 'pipe',
        detached: false,
      });

      // Track last played
      try {
        const s = loadSettings();
        const lastPlayed = [versionId, ...(s.lastPlayed || []).filter(x => x !== versionId)].slice(0, 10);
        saveSettings({ lastPlayed });
      } catch {}

      // Session start for playtime tracking
      const sessionStart = Date.now();

      // Game process monitor: poll memory (Windows tasklist) + parse FPS from logs
      const monitorInterval = setInterval(() => {
        try {
          const { exec } = require('child_process');
          exec(`tasklist /FI "PID eq ${child.pid}" /FO CSV /NH`, (err, stdout) => {
            if (err || !stdout) return;
            const m = stdout.match(/"([\d,]+) K"/);
            if (m) {
              const memMB = Math.round(parseInt(m[1].replace(/,/g, '')) / 1024);
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('mc:gameStats', { type: 'memory', value: memMB });
              }
            }
          });
        } catch {}
      }, 2000);
      let lastFps = 0;
      const logLineHandler = (line) => {
        let m = line.match(fpsRegex) || line.match(fpsRegex2);
        if (m) {
          lastFps = Math.round(parseFloat(m[1]));
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('mc:gameStats', { type: 'fps', value: lastFps });
          }
        }
      };
      let pending = '';
      const parseLog = (chunk) => {
        pending += chunk;
        const lines = pending.split('\n');
        pending = lines.pop() || '';
        for (const l of lines) logLineHandler(l);
      };

      // Auto-close launcher when game starts
      if (settings.autoClose && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
      }

      let gameClosed = false;

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        parseLog(text);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mc:gameLog', text);
        }
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        parseLog(text);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mc:gameLog', text);
        }
      });

      child.on('close', (code) => {
        gameClosed = true;
        clearInterval(monitorInterval);
        // Accumulate playtime
        try {
          const seconds = Math.round((Date.now() - sessionStart) / 1000);
          if (seconds > 5) {
            const s = loadSettings();
            const playTime = s.playTime || {};
            const today = new Date().toISOString().slice(0, 10);
            playTime[today] = (playTime[today] || 0) + seconds;
            saveSettings({ playTime });
          }
        } catch {}
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mc:gameClosed', code);
        }
        resolve({ success: true, exitCode: code });
      });

      child.on('error', (err) => {
        if (!gameClosed) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Wrapper: auto-restart on crash if enabled
function launchGameWithRestart(versionId, mainWindow, restartCount = 0) {
  return new Promise(async (resolve, reject) => {
    const settings = loadSettings();
    const shouldRestart = settings.autoRestart && restartCount < 3;
    try {
      const result = await launchGame(versionId, mainWindow);
      if (result.exitCode !== 0 && shouldRestart) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mc:gameLog', `\n[Launcher] Crash detected (exit ${result.exitCode}). Auto-restarting... (${restartCount + 1}/3)\n`);
        }
        const retry = await launchGameWithRestart(versionId, mainWindow, restartCount + 1);
        return resolve(retry);
      }
      resolve(result);
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { launchGame: launchGameWithRestart };
