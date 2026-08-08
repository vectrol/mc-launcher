const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { shell } = require('electron');
const { loadSettings, saveSettings } = require('./mc-settings.cjs');
const { logWarn } = require('./mc-api.cjs');

const MS_CLIENT_ID = '00000000402B5328';
const MS_REDIRECT_URL = 'http://localhost:49152/auth';
const MS_AUTH_URL = `https://login.live.com/oauth20_authorize.srf?client_id=${MS_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(MS_REDIRECT_URL)}&scope=XboxLive.signin%20offline_access`;

function getAccounts() {
  const settings = loadSettings();
  return settings.accounts || [];
}

function saveAccounts(accounts) {
  saveSettings({ accounts });
}

function getActiveAccount() {
  const accounts = getAccounts();
  return accounts.find((a) => a.active) || null;
}

function setActiveAccount(accountId) {
  const accounts = getAccounts();
  for (const a of accounts) a.active = a.id === accountId;
  saveAccounts(accounts);
}

function addOfflineAccount(username) {
  const accounts = getAccounts();
  // Generate UUID from username
  const uuid = generateOfflineUUID(username);
  const account = {
    id: `offline_${Date.now()}`,
    type: 'offline',
    username,
    uuid,
    active: accounts.length === 0,
  };
  accounts.push(account);
  saveAccounts(accounts);
  return account;
}

function removeAccount(accountId) {
  let accounts = getAccounts();
  accounts = accounts.filter((a) => a.id !== accountId);
  // If we removed the active account, activate another
  if (accounts.length > 0 && !accounts.some((a) => a.active)) {
    accounts[0].active = true;
  }
  saveAccounts(accounts);
}

function generateOfflineUUID(username) {
  // Generate a deterministic UUID v3 style from username + offline namespace
  let hash = 0;
  const ns = 'OfflinePlayer:';
  const str = ns + username.toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  // Format as UUID
  const hex = (hash >>> 0).toString(16).padStart(8, '0') + '0000000000000000000000000000';
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

function httpGetJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        return httpGetJSON(res.headers.location, headers).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))));
      res.on('error', reject);
    });
    req.setTimeout(10000, () => { req.destroy(new Error('Request timed out')); });
    req.on('error', reject);
  });
}

function httpPostJSON(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const postData = JSON.stringify(body);
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), ...headers },
    };
    const req = mod.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))));
      res.on('error', reject);
    });
    req.setTimeout(10000, () => { req.destroy(new Error('Auth request timed out')); });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path.dirname(destPath))) fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'MCLauncher/3.1' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      const total = parseInt(res.headers['content-length'], 10) || 0;
      let downloaded = 0;
      const ws = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        ws.write(chunk);
        if (onProgress && total > 0) onProgress({ percent: Math.round((downloaded / total) * 100) });
      });
      res.on('end', () => { ws.end(); resolve(); });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function startMicrosoftLogin(mainWindow) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const urlObj = new URL(req.url, MS_REDIRECT_URL);
      const code = urlObj.searchParams.get('code');

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>登录成功�?/h2><p>可以关闭此窗口返回启动器</p><script>setTimeout(()=>window.close(),2000)</script>');

        server.close();

        try {
          // Exchange code for Microsoft token
          const tokenData = await httpPostJSON('https://login.live.com/oauth20_token.srf', {
            client_id: MS_CLIENT_ID,
            code,
            redirect_uri: MS_REDIRECT_URL,
            grant_type: 'authorization_code',
          }, { 'Content-Type': 'application/x-www-form-urlencoded' });

          const msAccessToken = tokenData.access_token;

          // Authenticate with Xbox Live
          const xblAuth = await httpPostJSON('https://user.auth.xboxlive.com/user/authenticate', {
            Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
            RelyingParty: 'http://auth.xboxlive.com',
            TokenType: 'JWT',
          });

          const xblToken = xblAuth.Token;
          const uhs = xblAuth.DisplayClaims.xui[0].uhs;

          // Authenticate with XSTS
          const xstsAuth = await httpPostJSON('https://xsts.auth.xboxlive.com/xsts/authorize', {
            Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
            RelyingParty: 'rp://api.minecraftservices.com/',
            TokenType: 'JWT',
          });

          const xstsToken = xstsAuth.Token;

          // Get Minecraft access token
          const mcAuth = await httpPostJSON('https://api.minecraftservices.com/authentication/login_with_xbox', {
            identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
          });

          const mcToken = mcAuth.access_token;

          // Get player profile (UUID + username)
          const profile = await httpGetJSON('https://api.minecraftservices.com/minecraft/profile', {
            Authorization: `Bearer ${mcToken}`,
          });

          const account = {
            id: `ms_${profile.id}`,
            type: 'microsoft',
            username: profile.name,
            uuid: profile.id,
            accessToken: mcToken,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + (tokenData.expires_in * 1000),
          };

          const accounts = getAccounts();
          // Remove old MS account with same UUID if exists
          const filtered = accounts.filter((a) => !(a.type === 'microsoft' && a.uuid === profile.id));
          for (const a of filtered) a.active = false;
          account.active = true;
          filtered.push(account);
          saveAccounts(filtered);

          resolve(account);
        } catch (err) {
          reject(err);
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>登录失败</h2><p>未获取到授权�?/p>');
        server.close();
        reject(new Error('No auth code received'));
      }
    });

    server.listen(49152, () => {
      shell.openExternal(MS_AUTH_URL);
      if (mainWindow) mainWindow.focus();
    });

    server.on('error', reject);
  });
}

async function refreshMicrosoftToken(account) {
  if (account.type !== 'microsoft' || !account.refreshToken) return null;

  try {
    const tokenData = await httpPostJSON('https://login.live.com/oauth20_token.srf', {
      client_id: MS_CLIENT_ID,
      refresh_token: account.refreshToken,
      redirect_uri: MS_REDIRECT_URL,
      grant_type: 'refresh_token',
    }, { 'Content-Type': 'application/x-www-form-urlencoded' });

    // Refresh MC token with new MS token
    const xblAuth = await httpPostJSON('https://user.auth.xboxlive.com/user/authenticate', {
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${tokenData.access_token}` },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    });

    const xstsAuth = await httpPostJSON('https://xsts.auth.xboxlive.com/xsts/authorize', {
      Properties: { SandboxId: 'RETAIL', UserTokens: [xblAuth.Token] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    });

    const mcAuth = await httpPostJSON('https://api.minecraftservices.com/authentication/login_with_xbox', {
      identityToken: `XBL3.0 x=${xblAuth.DisplayClaims.xui[0].uhs};${xstsAuth.Token}`,
    });

    account.accessToken = mcAuth.access_token;
    account.refreshToken = tokenData.refresh_token;
    account.expiresAt = Date.now() + (tokenData.expires_in * 1000);

    const accounts = getAccounts();
    const idx = accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) {
      accounts[idx] = account;
      saveAccounts(accounts);
    }

    return account;
  } catch {
    return null;
  }
}

async function getValidAccount() {
  let account = getActiveAccount();
  if (!account) return null;

  if (account.type === 'microsoft' && account.expiresAt && account.expiresAt < Date.now() + 60000) {
    // Token expired or about to expire, try refresh
    const refreshed = await refreshMicrosoftToken(account);
    if (refreshed) account = refreshed;
    else {
      // Refresh failed, deactivate
      setActiveAccount('');
      return null;
    }
  }

  return account;
}

// ─── Third-party skin servers (authlib-injector) ───────────
// Supports LittleSkin, Blessing Skin, etc.

function getAuthJarDir() {
  const { BASE_DIR } = require('./mc-api.cjs');
  const dir = path.join(BASE_DIR, 'authlib-injector');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function getAuthMeta(serverUrl) {
  // Fetch authlib-injector metadata: {apiRoot, signaturePublickey, skinDomains, meta}
  const root = serverUrl.replace(/\/+$/, '');
  const metaUrl = `${root}/api/authlib-injector`;
  try {
    const data = await httpGetJSON(metaUrl, { 'User-Agent': 'MCLauncher/3.1' });
    const apiRoot = data.apiRoot || `${root}/api/yggdrasil`;
    return { root, apiRoot, meta: data };
  } catch {
    // Fallback: assume default yggdrasil path
    return { root, apiRoot: `${root}/api/yggdrasil` };
  }
}

async function downloadAuthInjector(serverUrl, onProgress) {
  const jarPath = path.join(getAuthJarDir(), 'authlib-injector.jar');
  if (fs.existsSync(jarPath)) return jarPath;

  const root = serverUrl.replace(/\/+$/, '');
  const candidates = [
    `${root}/authlib-injector.jar`,
    `${root}/api/authlib-injector.jar`,
    'https://authlib-injector.yushiomoe.org/authlib-injector-1.2.5.jar',
    'https://github.com/yushijinhun/authlib-injector/releases/latest/download/authlib-injector-1.2.5.jar',
  ];

  for (const url of candidates) {
    try {
      await downloadFile(url, jarPath, onProgress);
      if (fs.existsSync(jarPath) && fs.statSync(jarPath).size > 100000) return jarPath;
    } catch (e) { logWarn('Auth', 'caught', e) }
  }
  throw new Error('Failed to download authlib-injector');
}

async function loginThirdParty(serverUrl, username, password, onProgress) {
  const { root, apiRoot } = await getAuthMeta(serverUrl);
  const jarPath = await downloadAuthInjector(serverUrl, onProgress);

  // Yggdrasil authenticate
  const clientToken = `mc-launcher-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const authRes = await httpPostJSON(`${apiRoot}/authenticate`, {
    agent: { name: 'Minecraft', version: 1 },
    username,
    password,
    clientToken,
    requestUser: true,
  });

  if (!authRes.accessToken) throw new Error('Authentication failed');
  const profile = authRes.selectedProfile || authRes.availableProfiles?.[0];
  if (!profile) throw new Error('No game profile found on this account');

  const account = {
    id: `tp_${profile.id}`,
    type: 'thirdparty',
    username: profile.name,
    uuid: profile.id,
    accessToken: authRes.accessToken,
    serverUrl: root,
    apiRoot,
    clientToken,
    authInjectorPath: jarPath,
    active: true,
  };

  // Remove old same-account entry, deactivate others
  const accounts = getAccounts();
  const filtered = accounts.filter((a) => !(a.type === 'thirdparty' && a.uuid === profile.id));
  for (const a of filtered) a.active = false;
  filtered.push(account);
  saveAccounts(filtered);
  return account;
}

module.exports = {
  getAccounts,
  getActiveAccount,
  setActiveAccount,
  addOfflineAccount,
  removeAccount,
  startMicrosoftLogin,
  getValidAccount,
  generateOfflineUUID,
  loginThirdParty,
  getAuthMeta,
};
