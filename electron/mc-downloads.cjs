const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadSettings } = require('./mc-settings.cjs');

// ─── Download queue ────────────────────────────────────────
let queue = [];
let activeCount = 0;
const listeners = new Set();

function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function emit() { for (const cb of listeners) cb(queue.map(t => ({ ...t }))); }

function addToQueue(item) {
  const task = { id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, status: 'queued', percent: 0, ...item };
  queue.push(task);
  emit();
  processQueue();
  return task;
}

function pauseTask(id) { const t = queue.find(x => x.id === id); if (t && t.status === 'downloading') t.status = 'paused'; emit(); }
function resumeTask(id) { const t = queue.find(x => x.id === id); if (t && t.status === 'paused') { t.status = 'queued'; emit(); processQueue(); } }
function cancelTask(id) { queue = queue.filter(x => x.id !== id); emit(); }
function getQueue() { return queue.map(t => ({ ...t })); }

async function processQueue() {
  const settings = loadSettings();
  const maxConcurrent = parseInt(settings.downloadThreads) || 4;
  if (activeCount >= maxConcurrent) return;
  const next = queue.find(t => t.status === 'queued');
  if (!next) return;
  next.status = 'downloading';
  activeCount++;
  emit();
  try {
    const result = await downloadFileInternal(next.url, next.dest, {
      onProgress: (p) => { next.percent = p.percent; next.speed = p.speed; next.eta = p.eta; emit(); },
      startByte: next.resumedBytes || 0,
    });
    if (next.sha1 && result.finalHash !== next.sha1.toLowerCase()) {
      next.status = 'error'; next.error = 'SHA-1 mismatch (corrupted download)';
    } else {
      next.status = 'done'; next.percent = 100;
    }
  } catch (e) {
    if (next.status !== 'paused') { next.status = 'error'; next.error = e.message; }
  } finally {
    activeCount--;
    emit();
    processQueue();
  }
}

// ─── Download with resume + bandwidth + SHA-1 ──────────────
function downloadFileInternal(url, destPath, { onProgress, startByte = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const settings = loadSettings();
    const maxBps = parseInt(settings.bandwidthLimit) * 1024 || 0; // KB/s -> B/s

    if (!fs.existsSync(path.dirname(destPath))) fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const headers = { 'User-Agent': 'MCLauncher/3.0' };
    if (startByte > 0) headers.Range = `bytes=${startByte}-`;

    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFileInternal(res.headers.location, destPath, { onProgress, startByte }).then(resolve).catch(reject);
      }
      if (res.statusCode === 416) { // Range not satisfiable - file already complete
        return resolve({ finalHash: startByte === 0 ? '' : '' });
      }
      if (res.statusCode >= 400) { reject(new Error(`HTTP ${res.statusCode}`)); return; }

      const total = parseInt(res.headers['content-length'], 10) || 0;
      let downloaded = startByte;
      let hash = crypto.createHash('sha1');
      let lastTick = Date.now();
      let lastBytes = 0;
      let bytesThisInterval = 0;
      let intervalStart = Date.now();

      const ws = fs.createWriteStream(destPath, { flags: startByte > 0 ? 'a' : 'w' });
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        bytesThisInterval += chunk.length;
        hash.update(chunk);
        const now = Date.now();
        if (now - lastTick > 200) {
          const speed = bytesThisInterval / ((now - intervalStart) / 1000);
          const eta = speed > 0 && total > 0 ? (total - (downloaded - startByte)) / speed : 0;
          onProgress({ downloaded: downloaded - startByte, total: total + startByte, percent: total > 0 ? Math.round(((downloaded - startByte) / (total + startByte)) * 100) : 0, speed, eta });
          lastTick = now; bytesThisInterval = 0; intervalStart = now;
        }
        ws.write(chunk);
        // Bandwidth limiting
        if (maxBps > 0) {
          const elapsed = (Date.now() - intervalStart) / 1000;
          if (elapsed > 1 && bytesThisInterval > maxBps) {
            req.pause();
            const sleepMs = Math.max(50, (bytesThisInterval / maxBps - 1) * 1000);
            setTimeout(() => { req.resume(); intervalStart = Date.now(); bytesThisInterval = 0; }, sleepMs);
          }
        }
      });
      res.on('end', () => { ws.end(); resolve({ finalHash: hash.digest('hex') }); });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

function downloadFile(url, destPath, onProgress) {
  return downloadFileInternal(url, destPath, { onProgress });
}

function sha1File(filePath) {
  const hash = crypto.createHash('sha1');
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Resume support: if dest exists, use its size as start byte
async function downloadFileResume(url, destPath, onProgress) {
  let start = 0;
  if (fs.existsSync(destPath)) start = fs.statSync(destPath).size;
  return downloadFileInternal(url, destPath, { onProgress, startByte: start });
}

module.exports = {
  downloadFile, downloadFileResume, sha1File,
  addToQueue, pauseTask, resumeTask, cancelTask, getQueue, subscribe,
};
