// Backend module load + core function smoke tests
const path = require('path');
const Module = require('module');
const origRequire = Module.prototype.require;

// Mock electron (needed by modules at load time)
Module.prototype.require = function (id) {
  if (id === 'electron') {
    return {
      app: { getPath: () => process.env.APPDATA + '\\mc-launcher', isPackaged: false },
      shell: { openExternal: () => {}, openPath: () => {} },
      clipboard: { writeText: () => {} },
      ipcMain: { handle: () => {} },
      BrowserWindow: class {},
    };
  }
  return origRequire.apply(this, arguments);
};

const { test, assert, assertEq, runAll } = require('./framework.cjs');

// ─── Module loading ─────────────────────────────────────────

test('all 20 backend modules load without error', () => {
  const files = require('fs').readdirSync(path.join(__dirname, '..', 'electron'))
    .filter(f => f.endsWith('.cjs') && !['main.cjs', 'preload.cjs'].includes(f));
  assert(files.length >= 18, `expected >=18 modules, got ${files.length}`);
  for (const f of files) {
    const m = require('../electron/' + f);
    assert(m && typeof m === 'object', `${f} exports`);
  }
});

// ─── mc-settings ───────────────────────────────────────────

test('settings: defaults + save/load round-trip', () => {
  const { getSettings, saveSettings } = require('../electron/mc-settings.cjs');
  const s = getSettings();
  assert(['dark', 'light'].includes(s.theme), 'theme valid');
  assert(s.language, 'has language');
  const saved = saveSettings({ testFlag: 'x1' });
  assertEq(saved.testFlag, 'x1', 'save persists');
  saveSettings({ testFlag: undefined });
});

test('settings: playTime aggregation field exists', () => {
  const { getSettings } = require('../electron/mc-settings.cjs');
  const s = getSettings();
  assert(s.playTime && typeof s.playTime === 'object', 'playTime object');
});

// ─── mc-auth ───────────────────────────────────────────────

test('auth: offline account create + remove', () => {
  const { addOfflineAccount, removeAccount, getAccounts } = require('../electron/mc-auth.cjs');
  const a = addOfflineAccount('TestPlayer');
  assert(a.uuid && a.username === 'TestPlayer', 'account created');
  assert(/^[0-9a-f-]{36}$/.test(a.uuid), 'uuid format');
  const before = getAccounts().length;
  removeAccount(a.id);
  assertEq(getAccounts().length, before - 1, 'account removed');
});

test('auth: invite code round-trip', () => {
  const { generateInviteCode, resolveInviteCode } = require('../electron/mc-friends.cjs');
  const code = generateInviteCode();
  const r = resolveInviteCode(code);
  assert(r.success, 'code resolves');
  assert(r.ip && r.username, 'has ip+username');
  // Cleanup friend added by resolve
  if (r.friends) {
    const { removeFriend } = require('../electron/mc-friends.cjs');
    const added = r.friends.find(f => f.ip === r.ip && !f.lanOnly);
    if (added) removeFriend(added.id);
  }
});

test('auth: invalid invite code fails gracefully', () => {
  const { resolveInviteCode } = require('../electron/mc-friends.cjs');
  const r = resolveInviteCode('!!!not-valid!!!');
  assertEq(r.success, false, 'rejects bad code');
});

// ─── mc-versions ───────────────────────────────────────────

test('versions: getInstalledVersions returns array', async () => {
  const { getInstalledVersions } = require('../electron/mc-versions.cjs');
  const list = await getInstalledVersions();
  assert(Array.isArray(list), 'is array');
  for (const v of list) assert(v.id && typeof v.modCount === 'number', 'item shape');
});

// ─── mc-downloads ──────────────────────────────────────────

test('downloads: stats + queue lifecycle', async () => {
  const { getDownloadStats, addToQueue, cancelTask, getQueue } = require('../electron/mc-downloads.cjs');
  const stats = getDownloadStats();
  assert(typeof stats.totalBytes === 'number', 'stats number');
  const task = addToQueue({ name: 'test', url: 'https://example.com/x', dest: 'C:\\temp\\x' });
  assert(task.id, 'task created');
  cancelTask(task.id);
  assertEq(getQueue().length, 0, 'queue empty after cancel');
});

// ─── mc-crash ──────────────────────────────────────────────

test('crash: validate functions exist and return shapes', async () => {
  const { validateVersion } = require('../electron/mc-crash.cjs');
  const r = validateVersion('__not_installed__');
  assertEq(r.valid, false, 'missing version invalid');
});

test('crash: checkCrashReports returns array', () => {
  const { checkCrashReports } = require('../electron/mc-crash.cjs');
  assert(Array.isArray(checkCrashReports()), 'is array');
});

// ─── mc-online ─────────────────────────────────────────────

test('online: modrinth search works (network)', async () => {
  const { searchModrinth } = require('../electron/mc-online.cjs');
  const r = await searchModrinth('sodium', 0, 'mod');
  assert(r.hits.length > 0, 'got results');
});

test('online: popular fetch works (network)', async () => {
  const { getModrinthPopular } = require('../electron/mc-online.cjs');
  const r = await getModrinthPopular('mod');
  assert(r.hits.length > 0, 'got popular mods');
});

// ─── mc-update ─────────────────────────────────────────────

test('update: local version matches package.json', () => {
  const { getLocalVersion } = require('../electron/mc-update.cjs');
  const pkg = require('../package.json');
  assertEq(getLocalVersion(), pkg.version, 'version sync');
});

test('update: checkForUpdates returns valid shape', async () => {
  const { checkForUpdates } = require('../electron/mc-update.cjs');
  const r = await checkForUpdates();
  assert(typeof r.hasUpdate === 'boolean', 'has hasUpdate flag');
  assertEq(r.current, require('../package.json').version, 'current version');
});

// ─── mc-jre ────────────────────────────────────────────────

test('jre: listAdoptium returns items (network)', async () => {
  const { listAdoptium } = require('../electron/mc-jre.cjs');
  const list = await listAdoptium(17);
  assert(list.length > 0, 'got jre list');
  assert(list[0].url && list[0].size > 0, 'has url+size');
});

test('jre: getInstalledJres returns array', () => {
  const { getInstalledJres } = require('../electron/mc-jre.cjs');
  assert(Array.isArray(getInstalledJres()), 'is array');
});

// ─── mc-modtools ───────────────────────────────────────────

test('modtools: detectModConflicts returns array', () => {
  const { detectModConflicts } = require('../electron/mc-modtools.cjs');
  assert(Array.isArray(detectModConflicts('__none__')), 'is array');
});

// ─── mc-instances ──────────────────────────────────────────

test('instances: clone + rename + cleanup', async () => {
  const { cloneVersion, renameVersion, getInstanceSettings } = require('../electron/mc-instances.cjs');
  const fs = require('fs');
  const { VERSIONS_DIR } = require('../electron/mc-api.cjs');
  // Create a fake minimal version to test against
  const fakeId = '__test_base__';
  const fakeDir = path.join(VERSIONS_DIR, fakeId);
  fs.mkdirSync(fakeDir, { recursive: true });
  fs.writeFileSync(path.join(fakeDir, `${fakeId}.json`), JSON.stringify({ id: fakeId, type: 'release', mainClass: 'x' }));
  fs.writeFileSync(path.join(fakeDir, `${fakeId}.jar`), 'fakejar');
  try {
    const cloned = cloneVersion(fakeId, '__test_clone__');
    assert(cloned.startsWith('__test_clone__'), 'cloned name');
    assert(fs.existsSync(path.join(VERSIONS_DIR, cloned, `${cloned}.json`)), 'clone json renamed');
    const renamed = renameVersion(cloned, '__test_renamed__');
    assertEq(renamed, '__test_renamed__', 'renamed');
    assert(fs.existsSync(path.join(VERSIONS_DIR, renamed, `${renamed}.jar`)), 'renamed jar');
  } finally {
    fs.rmSync(fakeDir, { recursive: true, force: true });
    for (const d of ['__test_clone__', '__test_clone__-1', '__test_renamed__']) {
      fs.rmSync(path.join(VERSIONS_DIR, d), { recursive: true, force: true });
    }
  }
});

// ─── IPC consistency (static) ──────────────────────────────

test('ipc: main handlers == preload invocations', () => {
  const fs = require('fs');
  const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf-8');
  const preloadSrc = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf-8');
  const mainHandlers = [...mainSrc.matchAll(/ipcMain\.handle\('([^']+)'/g)].map(m => m[1]);
  const preloadInvocations = [...preloadSrc.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map(m => m[1]);
  const missing = preloadInvocations.filter(p => !mainHandlers.includes(p));
  assertEq(missing.length, 0, `missing in main: ${missing.join(', ')}`);
});

// ─── i18n consistency (static) ─────────────────────────────

test('i18n: zh/en keys match', () => {
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'i18n.ts'), 'utf-8');
  const dict = (name) => {
    const re = new RegExp(`const ${name}[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\n\\};`);
    const m = src.match(re);
    if (!m) return new Set();
    return new Set([...m[1].matchAll(/'([^']+)':/g)].map(x => x[1]));
  };
  const zh = dict('zh');
  const en = dict('en');
  const missingEn = [...zh].filter(k => !en.has(k));
  assertEq(missingEn.length, 0, `en missing: ${missingEn.slice(0, 5).join(', ')}`);
});

// ─── Java constraint detection (headless) ───────────────────

test('java: constraint for fabric-loader extracts mc version', () => {
  const { getJavaConstraint } = require('../electron/mc-java.cjs');
  const c = getJavaConstraint('fabric-loader-0.19.3-1.20.1');
  assert(c.min >= 17, `fabric 1.20.1 needs >=17, got min=${c.min}`);
});

test('java: constraint for vanilla 1.20.1 is Java 17+', () => {
  const { getJavaConstraint } = require('../electron/mc-java.cjs');
  const c = getJavaConstraint('1.20.1');
  assertEq(c.min, 17, 'vanilla 1.20.1 min=17');
});

test('java: constraint for 1.12.2 is Java 8+', () => {
  const { getJavaConstraint } = require('../electron/mc-java.cjs');
  const c = getJavaConstraint('1.12.2');
  assertEq(c.min, 8, '1.12.2 min=8');
});

test('java: constraint for 1.21 is Java 21+', () => {
  const { getJavaConstraint } = require('../electron/mc-java.cjs');
  const c = getJavaConstraint('1.21');
  assertEq(c.min, 21, '1.21 min=21');
});

test('java: null versionId defaults to 17', () => {
  const { getJavaConstraint } = require('../electron/mc-java.cjs');
  const c = getJavaConstraint(null);
  assertEq(c.min, 17, 'null defaults to 17');
});

test('java: recommendedJavaMajor handles loader IDs', () => {
  const { recommendedJavaMajor } = require('../electron/mc-java.cjs');
  assertEq(recommendedJavaMajor('fabric-loader-0.19.3-1.20.1'), 17, 'fabric 1.20.1');
  assertEq(recommendedJavaMajor('1.12.2'), 8, 'vanilla 1.12');
  assertEq(recommendedJavaMajor('1.21.4'), 21, 'vanilla 1.21');
  assertEq(recommendedJavaMajor(null), 17, 'null fallback');
});

// ─── Version detection with loaders ─────────────────────────

test('versions: getInstalledVersions returns loaders array', () => {
  const { getInstalledVersions } = require('../electron/mc-versions.cjs');
  const versions = getInstalledVersions();
  assert(Array.isArray(versions), 'is array');
  for (const v of versions) {
    assert(v.id, 'has id');
    assert(Array.isArray(v.loaders), 'loaders is array');
    assert(typeof v.modCount === 'number', 'modCount number');
  }
});

// ─── Page switching robustness (headless unit) ──────────────

test('page: App page type has exactly 7 pages', () => {
  // Verify the Page type in App.tsx matches 7 pages
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf-8');
  const match = src.match(/type Page = '([^;]+)'/);
  assert(match, 'Page type found');
  const pages = match[1].split("' | '");
  assertEq(pages.length, 7, `expected 7 pages, got ${pages.length}: ${pages.join(', ')}`);
});

test('page: no AnimatePresence mode="wait" in App.tsx', () => {
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf-8');
  assert(!src.includes('mode="wait"'), 'mode="wait" removed from App.tsx');
});

test('page: single keyed motion.div pattern present', () => {
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf-8');
  assert(src.includes('key={activePage}'), 'single key={activePage} pattern found');
  assert(src.includes('mode="popLayout"'), 'mode=popLayout found');
});

// ─── Run ───────────────────────────────────────────────────

runAll();
