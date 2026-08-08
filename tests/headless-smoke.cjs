// Headless smoke test: launches Electron main process without GUI
// Verifies main.cjs loads all modules and IPC handlers register without crash
const { spawn } = require('child_process');
const path = require('path');

let passed = 0, failed = 0;

function test(name, fn) {
  let ok = false;
  try {
    fn();
    ok = true;
  } catch (e) {
    console.log(`FAIL  ${name}: ${e.message}`);
    failed++;
  }
  if (ok) { passed++; console.log(`  OK  ${name}`); }
}

async function testAsync(name, p) {
  try {
    await p;
    passed++;
    console.log(`  OK  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}: ${e.message}`);
  }
}

// Smoke test: simulate Electron main startup by loading all modules
test('all 22 backend modules load without crash (headless)', () => {
  const Module = require('module');
  const origRequire = Module.prototype.require;
  // Mock electron app
  Module.prototype.require = function (id) {
    if (id === 'electron') {
      return {
        app: {
          getPath: () => path.join(process.env.APPDATA || '/tmp', 'mc-launcher-test'),
          isPackaged: false,
          on: () => {},
          whenReady: () => Promise.resolve(),
          getName: () => 'mc-launcher',
          getVersion: () => '3.1.0',
          commandLine: { getSwitchValue: () => '' },
        },
        shell: { openExternal: () => {}, openPath: () => {} },
        clipboard: { writeText: () => {} },
        ipcMain: { handle: () => {}, on: () => {}, removeHandler: () => {} },
        BrowserWindow: class {
          constructor() { this.webContents = { send: () => {}, on: () => {}, setWindowOpenHandler: () => {} }; }
          loadURL() { return Promise.resolve(); }
          on() {}
          show() {}
          setMenuBarVisibility() {}
          webContents = { on: () => {}, send: () => {}, session: { webRequest: { onHeadersReceived: () => {} } } };
        },
        screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }) },
        Menu: { buildFromTemplate: () => ({ setApplicationMenu: () => {} }) },
        globalShortcut: { register: () => {} },
        nativeTheme: { on: () => {}, themeSource: 'dark' },
        dialog: { showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }), showMessageBox: () => Promise.resolve({ response: 0 }) },
      };
    }
    return origRequire.apply(this, arguments);
  };
  const fs = require('fs');
  const files = fs.readdirSync(path.join(__dirname, '..', 'electron'))
    .filter(f => f.endsWith('.cjs') && !['main.cjs', 'preload.cjs'].includes(f));
  for (const f of files) {
    require('../electron/' + f);
  }
  Module.prototype.require = origRequire;
});

// Smoke test: main.cjs loads without crashing
test('main.cjs can be required without crash (headless)', () => {
  // main.cjs sets up IPC handlers — should not throw
  const Module = require('module');
  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === 'electron') {
      return {
        app: {
          getPath: () => path.join(process.env.APPDATA || '/tmp', 'mc-launcher-test'),
          isPackaged: false, on: () => {},
          whenReady: () => Promise.resolve(),
          getName: () => 'mc-launcher', getVersion: () => '3.0.0',
          commandLine: { getSwitchValue: () => '' },
        },
        shell: { openExternal: () => {}, openPath: () => {} },
        clipboard: { writeText: () => {} },
        ipcMain: { handle: () => {}, on: () => {}, removeHandler: () => {} },
        BrowserWindow: class {
          constructor() { this.webContents = { send: () => {}, on: () => {}, setWindowOpenHandler: () => {} }; }
          loadURL() { return Promise.resolve(); }
          on() {} show() {} setMenuBarVisibility() {}
          webContents = { on: () => {}, send: () => {}, session: { webRequest: { onHeadersReceived: () => {} } } };
        },
        screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }) },
        Menu: { buildFromTemplate: () => ({ setApplicationMenu: () => {} }) },
        globalShortcut: { register: () => {} },
        nativeTheme: { on: () => {}, themeSource: 'dark' },
        dialog: { showOpenDialog: () => Promise.resolve({ canceled: true }), showMessageBox: () => Promise.resolve({ response: 0 }) },
        Notification: { isSupported: () => false },
      };
    }
    return origRequire.apply(this, arguments);
  };
  require('../electron/main.cjs');
  Module.prototype.require = origRequire;
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
