const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { downloadVersion, getVersionManifest, getVersionInfo, getVersionChangelog, BASE_DIR } = require('./mc-api.cjs');
const { launchGame } = require('./launcher.cjs');
const { getInstalledVersions, deleteVersion, getMods, importMod, deleteMod, openMinecraftFolder } = require('./mc-versions.cjs');
const { getFabricLoaderVersions, installFabric, getForgeVersions, installForge, getOptiFineVersions, installOptiFine, getNeoForgeVersions, installNeoForge, getQuiltVersions, installQuilt } = require('./mc-mods.cjs');
const { loadSettings, saveSettings, getAutoMemory } = require('./mc-settings.cjs');
const { getAccounts, getActiveAccount, setActiveAccount, addOfflineAccount, removeAccount, startMicrosoftLogin, loginThirdParty } = require('./mc-auth.cjs');
const { getWorlds, deleteWorld, backupWorld, openWorldsFolder, getWorldIconBase64, getResourcePacks, importResourcePacks, deleteResourcePack, openResourcePacksFolder } = require('./mc-extras.cjs');
const { getMinecraftNews, searchModrinth, getModrinthPopular, getModrinthMod, getModrinthVersions } = require('./mc-online.cjs');
const { parseModpack, installModpack, exportModpack } = require('./mc-modpack.cjs');
const { getServers, addServer, removeServer, pingServer, recordPing } = require('./mc-servers.cjs');
const { checkCrashReports, getCrashSuggestion, validateJava, validateVersion, validateDiskSpace } = require('./mc-crash.cjs');
const { cloneVersion, renameVersion, getInstanceSettings, setInstanceSettings } = require('./mc-instances.cjs');
const { addToQueue, pauseTask, resumeTask, cancelTask, getQueue, subscribe, downloadFileResume, sha1File } = require('./mc-downloads.cjs');
const { getScreenshots, deleteScreenshot, getScreenshotBase64, openScreenshotsFolder, checkNewVersion } = require('./mc-content.cjs');
const { getModrinthDependencies, checkModUpdates, getModrinthVersionFile } = require('./mc-online.cjs');
const { toggleMod } = require('./mc-versions.cjs');
const { startBroadcast, stopBroadcast, startLanScanner, getFriends, addFriend, removeFriend, getSnapshot } = require('./mc-friends.cjs');
const { checkModsForUpdates, detectModConflicts, updateAllMods } = require('./mc-modtools.cjs');
const { searchCurseForge, getCurseForgeFiles } = require('./mc-online.cjs');
const { logError, getErrorLog, clearErrorLog, checkForUpdates, downloadUpdate, importMinecraftFolder } = require('./mc-update.cjs');
const { scanJava, recommendedJavaMajor, runDiagnostics } = require('./mc-java.cjs');
const { getCrashDetail } = require('./mc-crash.cjs');
const { autoSelectSource } = require('./mc-api.cjs');
const { getInstanceIcon, setInstanceIcon } = require('./mc-instances.cjs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'MC Launcher',
    backgroundColor: '#0a0a0f',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  // Start P2P LAN services
  startBroadcast();
  startLanScanner();
  // CLI: --launch <versionId> [--account <id>]
  const args = process.argv.slice(1);
  const launchIdx = args.findIndex(a => a === '--launch');
  if (launchIdx >= 0 && args[launchIdx + 1]) {
    const versionId = args[launchIdx + 1];
    const acctIdx = args.findIndex(a => a === '--account');
    if (acctIdx >= 0 && args[acctIdx + 1]) {
      const { setActiveAccount } = require('./mc-auth.cjs');
      setActiveAccount(args[acctIdx + 1]);
    }
    setTimeout(() => {
      launchGame(versionId, mainWindow).catch(() => {});
    }, 2500); // wait for window ready
  }
});

// Global error logging
process.on('uncaughtException', (err) => logError('uncaught', err));
process.on('unhandledRejection', (reason) => logError('rejection', reason));

app.on('window-all-closed', () => {
  stopBroadcast();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Window controls
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

// Minecraft core
ipcMain.handle('mc:getManifest', async () => getVersionManifest());
ipcMain.handle('mc:getVersionInfo', async (_e, versionId) => getVersionInfo(versionId));

ipcMain.handle('mc:downloadVersion', async (_e, versionId) => {
  const controller = new AbortController();
  await downloadVersion(versionId, (progress) => {
    mainWindow?.webContents.send('mc:downloadProgress', progress);
  }, controller.signal);
  return { success: true };
});

ipcMain.handle('mc:launch', async (_e, versionId) => {
  return launchGame(versionId, mainWindow);
});

// Version management
ipcMain.handle('mc:getInstalledVersions', async () => getInstalledVersions());
ipcMain.handle('mc:deleteVersion', async (_e, versionId) => deleteVersion(versionId));
ipcMain.handle('mc:openFolder', async () => openMinecraftFolder());

// Mods
ipcMain.handle('mc:getMods', async (_e, versionId) => getMods(versionId));
ipcMain.handle('mc:importMod', async (_e, versionId, sourcePath) => importMod(versionId, sourcePath));
ipcMain.handle('mc:deleteMod', async (_e, versionId, filename) => deleteMod(versionId, filename));

ipcMain.handle('mc:importMods', async (_e, versionId, files) => {
  const results = [];
  for (const file of files) {
    try {
      const r = importMod(versionId, file);
      results.push({ success: true, name: r.name });
    } catch (e) {
      results.push({ success: false, name: path.basename(file), error: e.message });
    }
  }
  return results;
});

// Mod loaders
ipcMain.handle('mc:getFabricVersions', async (_e, mcVersion) => getFabricLoaderVersions(mcVersion));
ipcMain.handle('mc:getForgeVersions', async (_e, mcVersion) => getForgeVersions(mcVersion));

ipcMain.handle('mc:installFabric', async (_e, mcVersion, loaderVersion) => {
  await installFabric(mcVersion, loaderVersion, (progress) => {
    mainWindow?.webContents.send('mc:downloadProgress', progress);
  });
  return { success: true };
});

ipcMain.handle('mc:installForge', async (_e, mcVersion, forgeVersion) => {
  await installForge(mcVersion, forgeVersion, (progress) => {
    mainWindow?.webContents.send('mc:downloadProgress', progress);
  });
  return { success: true };
});

// Settings
ipcMain.handle('mc:getSettings', async () => loadSettings());
ipcMain.handle('mc:saveSettings', async (_e, settings) => saveSettings(settings));

// Auth
ipcMain.handle('mc:getAccounts', async () => getAccounts());
ipcMain.handle('mc:getActiveAccount', async () => getActiveAccount());
ipcMain.handle('mc:setActiveAccount', async (_e, id) => setActiveAccount(id));
ipcMain.handle('mc:addOfflineAccount', async (_e, username) => addOfflineAccount(username));
ipcMain.handle('mc:removeAccount', async (_e, id) => removeAccount(id));
ipcMain.handle('mc:startMicrosoftLogin', async () => startMicrosoftLogin(mainWindow));
ipcMain.handle('mc:loginThirdParty', async (_e, serverUrl, username, password) => {
  await loginThirdParty(serverUrl, username, password, (p) => {
    mainWindow?.webContents.send('mc:downloadProgress', { phase: 'authlib', message: `下载 authlib-injector ${p.percent}%`, percent: p.percent });
  });
  return { success: true };
});

// Worlds
ipcMain.handle('mc:getWorlds', async () => getWorlds());
ipcMain.handle('mc:deleteWorld', async (_e, name) => deleteWorld(name));
ipcMain.handle('mc:backupWorld', async (_e, name) => backupWorld(name));
ipcMain.handle('mc:openWorldsFolder', async () => openWorldsFolder());
ipcMain.handle('mc:getWorldIcon', async (_e, name) => getWorldIconBase64(name));

// Resource packs
ipcMain.handle('mc:getResourcePacks', async () => getResourcePacks());
ipcMain.handle('mc:importResourcePacks', async (_e, files) => importResourcePacks(files));
ipcMain.handle('mc:deleteResourcePack', async (_e, name) => deleteResourcePack(name));
ipcMain.handle('mc:openResourcePacksFolder', async () => openResourcePacksFolder());

// OptiFine
ipcMain.handle('mc:getOptiFineVersions', async (_e, mcVersion) => getOptiFineVersions(mcVersion));
ipcMain.handle('mc:installOptiFine', async (_e, mcVersion, optiVersion) => {
  await installOptiFine(mcVersion, optiVersion, (progress) => {
    mainWindow?.webContents.send('mc:downloadProgress', progress);
  });
  return { success: true };
});

// Instances
ipcMain.handle('mc:getCustomGameDirs', async () => (loadSettings()).customGameDirs || {});
ipcMain.handle('mc:setCustomGameDir', async (_e, versionId, dir) => {
  const s = loadSettings();
  if (!s.customGameDirs) s.customGameDirs = {};
  s.customGameDirs[versionId] = dir || path.join(BASE_DIR, 'instances', versionId);
  saveSettings(s);
  return s.customGameDirs;
});
ipcMain.handle('mc:removeCustomGameDir', async (_e, versionId) => {
  const s = loadSettings();
  if (s.customGameDirs) { delete s.customGameDirs[versionId]; saveSettings(s); }
});
ipcMain.handle('mc:getAutoMemory', async () => getAutoMemory());

// Changelogs
ipcMain.handle('mc:getVersionChangelog', async (_e, versionId) => getVersionChangelog(versionId));

// News & Modrinth
ipcMain.handle('mc:getMinecraftNews', async () => getMinecraftNews());
ipcMain.handle('mc:searchModrinth', async (_e, query, page, projectType) => searchModrinth(query, page, projectType));
ipcMain.handle('mc:getModrinthPopular', async (_e, projectType) => getModrinthPopular(projectType));
ipcMain.handle('mc:getModrinthMod', async (_e, slug) => getModrinthMod(slug));
ipcMain.handle('mc:getModrinthVersions', async (_e, slug, mcVersion, projectType) => getModrinthVersions(slug, mcVersion, projectType));

// Download mod from URL
ipcMain.handle('mc:downloadMod', async (_e, versionId, url, filename, destType) => {
  let dest;
  if (destType === 'shaders') {
    // Shader packs go to game dir / shaderpacks
    const { loadSettings } = require('./mc-settings.cjs');
    const s = loadSettings();
    const gameDir = (s.customGameDirs && s.customGameDirs[versionId]) || BASE_DIR;
    dest = path.join(gameDir, 'shaderpacks', filename);
  } else if (destType === 'resourcepacks') {
    dest = path.join(BASE_DIR, 'resourcepacks', filename);
  } else {
    dest = path.join(VERSIONS_DIR, versionId, 'mods', filename);
  }
  if (!fs.existsSync(path.dirname(dest))) fs.mkdirSync(path.dirname(dest), { recursive: true });
  const { addToQueue } = require('./mc-downloads.cjs');

  return new Promise((resolve, reject) => {
    const task = addToQueue({ name: filename, url, dest });
    const iv = setInterval(() => {
      const t = require('./mc-downloads.cjs').getQueue().find(x => x.id === task.id);
      if (!t) { clearInterval(iv); return; }
      if (t.status === 'done') { clearInterval(iv); resolve({ success: true, path: dest }); }
      else if (t.status === 'error') { clearInterval(iv); reject(new Error(t.error || 'Download failed')); }
    }, 300);
  });
});

// Modpack
ipcMain.handle('mc:parseModpack', async (_e, filePath) => parseModpack(filePath));
ipcMain.handle('mc:installModpack', async (_e, pack) => {
  await installModpack(pack, (progress) => {
    mainWindow?.webContents.send('mc:downloadProgress', progress);
  });
  return { success: true };
});
ipcMain.handle('mc:exportModpack', async (_e, versionId, format) => exportModpack(versionId, format));

// Servers
ipcMain.handle('mc:getServers', async () => getServers());
ipcMain.handle('mc:addServer', async (_e, name, address, port) => addServer(name, address, port));
ipcMain.handle('mc:removeServer', async (_e, id) => removeServer(id));
ipcMain.handle('mc:pingServer', async (_e, id, address, port) => {
  const result = await pingServer(address, port);
  if (result.online && result.latency) recordPing(id, result.latency);
  return result;
});

// NeoForge + Quilt
ipcMain.handle('mc:getNeoForgeVersions', async (_e, mcVersion) => getNeoForgeVersions(mcVersion));
ipcMain.handle('mc:installNeoForge', async (_e, mcVersion, version) => {
  await installNeoForge(mcVersion, version, (p) => mainWindow?.webContents.send('mc:downloadProgress', p));
  return { success: true };
});
ipcMain.handle('mc:getQuiltVersions', async (_e, mcVersion) => getQuiltVersions(mcVersion));
ipcMain.handle('mc:installQuilt', async (_e, mcVersion, version) => {
  await installQuilt(mcVersion, version, (p) => mainWindow?.webContents.send('mc:downloadProgress', p));
  return { success: true };
});

// Crash reports + validation
ipcMain.handle('mc:checkCrashReports', async () => checkCrashReports());
ipcMain.handle('mc:getCrashSuggestion', async (_e, crash) => getCrashSuggestion(crash));
ipcMain.handle('mc:validateLaunch', async (_e, versionId) => {
  const settings = loadSettings();
  const java = validateJava(settings.javaPath || 'java');
  const version = validateVersion(versionId);
  const disk = validateDiskSpace();
  return { java, version, disk };
});

// Instances
ipcMain.handle('mc:cloneVersion', async (_e, versionId, newName) => cloneVersion(versionId, newName));
ipcMain.handle('mc:renameVersion', async (_e, versionId, newName) => renameVersion(versionId, newName));
ipcMain.handle('mc:getInstanceSettings', async (_e, versionId) => getInstanceSettings(versionId));
ipcMain.handle('mc:setInstanceSettings', async (_e, versionId, patch) => setInstanceSettings(versionId, patch));

// Download queue
ipcMain.handle('mc:downloadQueueAdd', async (_e, item) => addToQueue(item));
ipcMain.handle('mc:downloadQueuePause', async (_e, id) => pauseTask(id));
ipcMain.handle('mc:downloadQueueResume', async (_e, id) => resumeTask(id));
ipcMain.handle('mc:downloadQueueCancel', async (_e, id) => cancelTask(id));
ipcMain.handle('mc:downloadQueueGet', async () => getQueue());

// Mods
ipcMain.handle('mc:toggleMod', async (_e, versionId, filename) => toggleMod(versionId, filename));
ipcMain.handle('mc:getModDependencies', async (_e, versionId) => getModrinthDependencies(versionId));
ipcMain.handle('mc:getModrinthVersionFile', async (_e, versionId) => getModrinthVersionFile(versionId));
ipcMain.handle('mc:checkModUpdates', async (_e, slugs) => checkModUpdates(slugs));

// Screenshots
ipcMain.handle('mc:getScreenshots', async () => getScreenshots());
ipcMain.handle('mc:getScreenshotBase64', async (_e, name) => getScreenshotBase64(name));
ipcMain.handle('mc:deleteScreenshot', async (_e, name) => deleteScreenshot(name));
ipcMain.handle('mc:openScreenshotsFolder', async () => openScreenshotsFolder());

// Version notification
ipcMain.handle('mc:checkNewVersion', async () => checkNewVersion());

// Friends / P2P LAN
ipcMain.handle('mc:getFriendsSnapshot', async () => getSnapshot());
ipcMain.handle('mc:addFriend', async (_e, name, ip) => addFriend(name, ip));
ipcMain.handle('mc:removeFriend', async (_e, id) => removeFriend(id));
ipcMain.handle('mc:copyServerAddress', async (_e, ip, port) => {
  const { clipboard } = require('electron');
  clipboard.writeText(`${ip}:${port}`);
  return { success: true };
});
ipcMain.handle('mc:generateInviteCode', async () => {
  const { generateInviteCode } = require('./mc-friends.cjs');
  return generateInviteCode();
});
ipcMain.handle('mc:resolveInviteCode', async (_e, code) => {
  const { resolveInviteCode } = require('./mc-friends.cjs');
  return resolveInviteCode(code);
});

// Mod tools
ipcMain.handle('mc:checkModsForUpdates', async (_e, versionId) => checkModsForUpdates(versionId));
ipcMain.handle('mc:detectModConflicts', async (_e, versionId) => detectModConflicts(versionId));
ipcMain.handle('mc:updateAllMods', async (_e, versionId) => {
  return await updateAllMods(versionId, (p) => {
    mainWindow?.webContents.send('mc:updateAllProgress', p);
  });
});

// CurseForge
ipcMain.handle('mc:searchCurseForge', async (_e, query, gameVersion) => searchCurseForge(query, gameVersion));
ipcMain.handle('mc:getCurseForgeFiles', async (_e, modId, gameVersion) => getCurseForgeFiles(modId, gameVersion));

// Update & logs & import
ipcMain.handle('mc:checkForUpdates', async () => checkForUpdates());
ipcMain.handle('mc:downloadUpdate', async () => {
  await downloadUpdate((p) => {
    mainWindow?.webContents.send('mc:updateProgress', p);
  });
  return { success: true };
});
ipcMain.handle('mc:openUpdateFolder', async () => {
  const { shell } = require('electron');
  shell.openPath(path.join(app.getPath('userData'), 'updates'));
});
ipcMain.handle('mc:getErrorLog', async () => getErrorLog());
ipcMain.handle('mc:clearErrorLog', async () => clearErrorLog());
ipcMain.handle('mc:importMinecraftFolder', async (_e, folderPath) => importMinecraftFolder(folderPath));

// v2.5 features
ipcMain.handle('mc:getCrashDetail', async (_e, file) => getCrashDetail(file));
ipcMain.handle('mc:scanJava', async () => scanJava());
ipcMain.handle('mc:recommendedJava', async (_e, mcVersion) => recommendedJavaMajor(mcVersion));
ipcMain.handle('mc:runDiagnostics', async () => runDiagnostics());
ipcMain.handle('mc:autoSelectSource', async () => autoSelectSource());
ipcMain.handle('mc:getPlayTime', async () => {
  const s = loadSettings();
  return s.playTime || {};
});
ipcMain.handle('mc:getDownloadStats', async () => {
  const { getDownloadStats } = require('./mc-downloads.cjs');
  return getDownloadStats();
});
ipcMain.handle('mc:savePresets', async (_e, presets) => saveSettings({ launchPresets: presets }));
ipcMain.handle('mc:getInstanceIcon', async (_e, versionId) => getInstanceIcon(versionId));
ipcMain.handle('mc:setInstanceIcon', async (_e, versionId, iconPath) => setInstanceIcon(versionId, iconPath));
ipcMain.handle('mc:setBgImage', async (_e, pathOrData) => {
  // Store data URL directly, or copy local file to userData
  if (pathOrData && !pathOrData.startsWith('data:')) {
    const { copyFileSync, existsSync } = require('fs');
    const dest = path.join(app.getPath('userData'), 'launcher-bg.png');
    if (existsSync(pathOrData)) {
      copyFileSync(pathOrData, dest);
      pathOrData = `data:image/png;base64,${require('fs').readFileSync(dest).toString('base64')}`;
    }
  }
  saveSettings({ bgImage: pathOrData || '' });
});
ipcMain.handle('mc:getBgImage', async () => (loadSettings()).bgImage || '');
