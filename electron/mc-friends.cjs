const dgram = require('dgram');
const { loadSettings, saveSettings } = require('./mc-settings.cjs');
const { getActiveAccount } = require('./mc-auth.cjs');

// ─── Protocol ──────────────────────────────────────────────
// Broadcast: MCLAN1|{username}|{uuid}
// Port: 47777
const BROADCAST_PORT = 47777;
const BROADCAST_INTERVAL = 3000;
const OFFLINE_TIMEOUT = 15000;
const LAN_MC_PORT = 4445; // Minecraft LAN world broadcast (multicast 224.0.2.60)
const LAN_MC_MULTICAST = '224.0.2.60';

let broadcastSocket = null;
let presenceTimer = null;
let minecraftSocket = null;
let running = false;

const discovered = new Map(); // ip -> { username, uuid, lastSeen }
const lanWorlds = new Map();  // id -> { name, port, ip, lastSeen }

function getFriends() {
  const s = loadSettings();
  return s.friends || [];
}

function saveFriends(friends) {
  saveSettings({ friends });
}

function addFriend(name, ip) {
  const friends = getFriends();
  if (friends.some(f => f.ip === ip)) return friends;
  friends.push({ id: `fr_${Date.now()}`, name, ip, online: false, lastSeen: 0 });
  saveFriends(friends);
  return friends;
}

function removeFriend(id) {
  saveFriends(getFriends().filter(f => f.id !== id));
}

function getActiveInfo() {
  const account = getActiveAccount();
  return { username: account?.username || 'Player', uuid: account?.uuid || '' };
}

// ─── Presence broadcast ────────────────────────────────────

function startBroadcast() {
  if (running) return;
  running = true;

  broadcastSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  try {
    broadcastSocket.bind(BROADCAST_PORT, () => {
      broadcastSocket.setBroadcast(true);
      sendPresence();
      presenceTimer = setInterval(sendPresence, BROADCAST_INTERVAL);
    });
  } catch {}

  broadcastSocket.on('message', (msg, rinfo) => {
    const text = msg.toString();
    if (!text.startsWith('MCLAN1|')) return;
    const [, username, uuid] = text.split('|');
    if (!username) return;
    // Ignore self
    const me = getActiveInfo();
    if (uuid && me.uuid && uuid === me.uuid) return;

    discovered.set(rinfo.address, { username, uuid, ip: rinfo.address, lastSeen: Date.now() });
  });

  broadcastSocket.on('error', () => {});
}

function sendPresence() {
  const me = getActiveInfo();
  if (!broadcastSocket) return;
  try {
    broadcastSocket.send(`MCLAN1|${me.username}|${me.uuid}`, BROADCAST_PORT, '255.255.255.255');
  } catch {}
}

function stopBroadcast() {
  running = false;
  if (presenceTimer) clearInterval(presenceTimer);
  try { broadcastSocket?.close(); } catch {}
  try { minecraftSocket?.close(); } catch {}
}

// ─── Minecraft LAN world scanner ───────────────────────────

function startLanScanner() {
  try {
    if (minecraftSocket) return;
    minecraftSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    minecraftSocket.bind(LAN_MC_PORT, () => {
      try { minecraftSocket.addMembership(LAN_MC_MULTICAST); } catch {}
    });
    minecraftSocket.on('message', (msg, rinfo) => {
      const text = msg.toString('utf-8');
      const motdMatch = text.match(/\[MOTD\](.*?)\[\/MOTD\]\[AD\](\d+)\[\/AD\]/);
      if (motdMatch) {
        const name = motdMatch[1];
        const port = parseInt(motdMatch[2]);
        const id = `${rinfo.address}:${port}`;
        lanWorlds.set(id, { id, name, ip: rinfo.address, port, lastSeen: Date.now() });
      }
    });
    minecraftSocket.on('error', () => {});
  } catch {}
}

// ─── Snapshot for UI ───────────────────────────────────────

function getSnapshot() {
  const now = Date.now();
  // Merge manually added friends with discovered presence
  const friends = getFriends().map(f => {
    const d = discovered.get(f.ip);
    const online = d && now - d.lastSeen < OFFLINE_TIMEOUT;
    return { ...f, online: !!online, lastSeen: d?.lastSeen || 0 };
  });

  // Auto-add discovered users as "LAN users" (visible but not persisted as friends)
  const lanUsers = [];
  for (const [ip, d] of discovered) {
    if (now - d.lastSeen >= OFFLINE_TIMEOUT) continue;
    lanUsers.push({ id: `lan_${ip}`, name: d.username, ip, online: true, lastSeen: d.lastSeen, lanOnly: true });
  }

  // Filter out LAN users already added as friends
  const friendIps = new Set(friends.map(f => f.ip));
  const newLan = lanUsers.filter(u => !friendIps.has(u.ip));

  const worlds = [];
  for (const [id, w] of lanWorlds) {
    if (now - w.lastSeen >= OFFLINE_TIMEOUT) continue;
    worlds.push({ ...w });
  }

  return { friends, lanUsers: newLan, worlds };
}

module.exports = {
  startBroadcast, stopBroadcast, startLanScanner,
  getFriends, addFriend, removeFriend, getSnapshot,

  // Friend invite codes: 6-char code encodes ip:port for cross-network add
  generateInviteCode() {
    const me = getActiveInfo();
    const os = require('os');
    const nets = os.networkInterfaces();
    let ip = '127.0.0.1';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) { ip = net.address; break; }
      }
    }
    const payload = Buffer.from(`${ip}|${me.username}`).toString('base64url');
    return payload;
  },

  resolveInviteCode(code) {
    try {
      const decoded = Buffer.from(code, 'base64url').toString();
      const [ip, username] = decoded.split('|');
      if (!ip) throw new Error('bad code');
      const friends = addFriend(username || 'Friend', ip);
      return { success: true, ip, username: username || 'Friend', friends };
    } catch {
      return { success: false, error: 'Invalid invite code' };
    }
  },
};
