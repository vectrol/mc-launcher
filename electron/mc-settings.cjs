const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const os = require('os');
const { logWarn } = require('./mc-api.cjs');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'launcher-settings.json');

const DEFAULT_SETTINGS = {
  language: 'zh-CN',
  theme: 'dark',
  accentColor: '#6366f1',
  javaPath: '',
  maxMemory: '4096',
  autoMemory: false,
  downloadSource: 'mojang',
  modrinthMirror: 'official',
  downloadThreads: '4',
  bandwidthLimit: '0',
  autoClose: false,
  autoRestart: false,
  curseforgeKey: '',
  windowWidth: 1100,
  windowHeight: 720,
  lastPlayed: [],
  accounts: [],
  servers: [],
  customGameDirs: {},
  instanceSettings: {},
  jvmArgs: '',
  lastKnownVersion: '',
  playTime: {}, // { "YYYY-MM-DD": seconds }
  javaScan: [],
  launchPresets: [
    { name: 'Balanced', memory: '4096', jvmArgs: '-XX:+UseG1GC' },
    { name: 'Low-end', memory: '2048', jvmArgs: '-XX:+UseSerialGC' },
    { name: 'High-end', memory: '8192', jvmArgs: '-XX:+UseG1GC -XX:+AggressiveOpts' },
  ],
  bgImage: '',
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) { logWarn('Settings', 'caught', e) }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  const merged = { ...loadSettings(), ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

function getAutoMemory() {
  const totalGB = os.totalmem() / (1024 * 1024 * 1024);
  const mem = Math.floor(totalGB * 0.5 * 1024);
  return Math.max(1024, Math.min(mem, 16384)).toString();
}

function getSettings() { return loadSettings(); }

module.exports = { loadSettings, saveSettings, getSettings, getAutoMemory, DEFAULT_SETTINGS };
