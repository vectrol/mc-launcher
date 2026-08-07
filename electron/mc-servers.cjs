const net = require('net');
const { loadSettings, saveSettings } = require('./mc-settings.cjs');

function getServers() {
  const settings = loadSettings();
  return settings.servers || [];
}

function addServer(name, address, port = 25565) {
  const settings = loadSettings();
  if (!settings.servers) settings.servers = [];
  const id = `sv_${Date.now()}`;
  settings.servers.push({ id, name, address, port, history: [] });
  saveSettings(settings);
  return settings.servers;
}

function recordPing(id, latency) {
  const settings = loadSettings();
  if (!settings.servers) return;
  const server = settings.servers.find(s => s.id === id);
  if (server) {
    if (!server.history) server.history = [];
    server.history.push({ t: Date.now(), ms: latency });
    server.history = server.history.slice(-20);
    saveSettings(settings);
  }
}

function removeServer(id) {
  const settings = loadSettings();
  if (settings.servers) {
    settings.servers = settings.servers.filter((s) => s.id !== id);
    saveSettings(settings);
  }
}

function pingServer(address, port = 25565) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    const startTime = Date.now();

    let buffer = Buffer.alloc(0);

    socket.connect(port, address, () => {
      // Send handshake packet
      const hostBuf = Buffer.from(address, 'utf-8');
      const handshake = Buffer.alloc(1 + 2 + 2 + hostBuf.length + 2 + 1);
      let offset = 0;
      handshake.writeUInt8(hostBuf.length + 2 + 2 + hostBuf.length + 2 + 1, offset); offset += 1; // Packet length
      handshake.writeUInt8(0x00, offset); offset += 1; // Packet ID (handshake)
      handshake.writeUInt16BE(760, offset); offset += 2; // Protocol version (1.21 = 767, use 760 for compatibility)
      handshake.writeUInt8(hostBuf.length, offset); offset += 1; // Host length
      hostBuf.copy(handshake, offset); offset += hostBuf.length; // Host
      handshake.writeUInt16BE(port, offset); offset += 2; // Port
      handshake.writeUInt8(1, offset); // Next state: status

      socket.write(handshake);

      // Request status
      const request = Buffer.alloc(2);
      request.writeUInt8(1, 0); // Length
      request.writeUInt8(0x00, 1); // Packet ID (request)
      socket.write(request);
    });

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      try {
        // Try to parse the response
        // First read packet length varint
        let pos = 0;
        let packetLength = 0;
        let shift = 0;
        while (pos < buffer.length) {
          const byte = buffer[pos++];
          packetLength |= (byte & 0x7F) << shift;
          if (!(byte & 0x80)) break;
          shift += 7;
        }

        if (pos + packetLength <= buffer.length) {
          // Read packet ID
          let pktIdLength = 0;
          let pktShift = 0;
          while (pos < buffer.length) {
            const byte = buffer[pos++];
            pktIdLength |= (byte & 0x7F) << pktShift;
            if (!(byte & 0x80)) break;
            pktShift += 7;
          }

          const jsonStr = buffer.slice(pos).toString('utf-8');
          const status = JSON.parse(jsonStr);

          socket.destroy();
          resolve({
            online: true,
            latency: Date.now() - startTime,
            version: status.version?.name || 'Unknown',
            players: { online: status.players?.online || 0, max: status.players?.max || 0 },
            motd: (status.description?.text || (typeof status.description === 'string' ? status.description : '')) || '',
          });
        }
      } catch {
        // Not enough data yet, keep buffering
      }
    });

    socket.on('timeout', () => { socket.destroy(); resolve({ online: false, error: 'Timeout' }); });
    socket.on('error', () => { socket.destroy(); resolve({ online: false, error: 'Connection refused' }); });
  });
}

module.exports = { getServers, addServer, removeServer, pingServer, recordPing };
