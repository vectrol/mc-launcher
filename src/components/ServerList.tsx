import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Play, Loader2, Wifi, WifiOff, Signal, Users, RefreshCw } from 'lucide-react';
import { ServerInfo, ServerStatus } from '../types';

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const w = 80, h = 16;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className={className}>
      <polyline points={pts} fill="none" stroke="var(--mc-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function ServerList({ t }: Props) {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddr, setNewAddr] = useState('');
  const [pings, setPings] = useState<Record<string, ServerStatus>>({});

  useEffect(() => { loadServers(); }, []);

  async function loadServers() {
    try { setServers(await window.electronAPI.mc.getServers()); }
    catch {} finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!newName.trim() || !newAddr.trim()) return;
    const [addr, portStr] = newAddr.split(':');
    const port = parseInt(portStr) || 25565;
    const result = await window.electronAPI.mc.addServer(newName.trim(), addr.trim(), port);
    setServers(result);
    setNewName(''); setNewAddr(''); setShowAdd(false);
  }

  async function handleRemove(id: string) {
    await window.electronAPI.mc.removeServer(id);
    setServers((prev) => prev.filter((s) => s.id !== id));
  }

  async function handlePing(server: ServerInfo) {
    try {
      const status = await window.electronAPI.mc.pingServer(server.id, server.address, server.port);
      setPings((prev) => ({ ...prev, [server.id]: status }));
      loadServers(); // refresh history
    } catch {}
  }

  function pingAll() {
    for (const s of servers) handlePing(s);
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-mc-accent" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-mc-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold">{t('servers.title')}</h2>
          <p className="text-xs text-mc-muted">{servers.length} {t('servers.count')}</p>
        </div>
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={pingAll}
            className="px-3 py-2 rounded-xl border border-mc-border text-xs text-mc-muted hover:text-mc-text transition-all">
            {t('servers.refresh')}
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(!showAdd)}
            className="px-3 py-2 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-xs font-medium transition-all flex items-center gap-1">
            <Plus size={12} /> {t('servers.add')}
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-4 rounded-2xl glass-strong border border-mc-accent/20 space-y-3">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('servers.name')}
              className="w-full bg-mc-card border border-mc-border rounded-xl px-4 py-2.5 text-sm text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors" />
            <input type="text" value={newAddr} onChange={(e) => setNewAddr(e.target.value)} placeholder={t('servers.addressHint')}
              className="w-full bg-mc-card border border-mc-border rounded-xl px-4 py-2.5 text-sm text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors font-mono" />
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleAdd} disabled={!newName.trim() || !newAddr.trim()}
                className="flex-1 py-2 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-sm font-medium transition-all disabled:opacity-40">
                {t('servers.add')}
              </motion.button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-mc-muted hover:text-mc-text transition-colors">{t('common.close')}</button>
            </div>
          </motion.div>
        )}

        {servers.length === 0 ? (
          <div className="text-center py-16"><Signal size={48} className="text-mc-border mx-auto" /><p className="text-sm text-mc-muted mt-3">{t('servers.empty')}</p></div>
        ) : (
          <div className="space-y-2">
            {servers.map((s) => {
              const p = pings[s.id];
              return (
                <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 rounded-2xl glass-strong border border-mc-border/60 hover:border-mc-accent/25 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-mc-card/50 border border-mc-border flex items-center justify-center">
                      {p?.online ? <Wifi size={18} className="text-mc-green" /> : p ? <WifiOff size={18} className="text-mc-red" /> : <Signal size={18} className="text-mc-muted" />}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-mc-text">{s.name}</h3>
                      <p className="text-[10px] text-mc-muted font-mono">{s.address}:{s.port}</p>
                      {p?.online && (
                        <p className="text-[9px] text-mc-muted mt-0.5 flex items-center gap-2">
                          <span className="flex items-center gap-1"><Users size={9} />{p.players?.online}/{p.players?.max}</span>
                          <span>{p.version}</span>
                          {p.latency != null && <span className="text-mc-green">{p.latency}ms</span>}
                        </p>
                      )}
                      {p?.motd && <p className="text-[9px] text-mc-muted mt-0.5 truncate max-w-[300px]">{p.motd.replace(/§./g, '')}</p>}
                      {s.history && s.history.length > 1 && (
                        <Sparkline data={s.history.map(h => h.ms)} className="mt-1" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handlePing(s)}
                      className="p-2 rounded-lg hover:bg-mc-card/50 text-mc-muted hover:text-mc-text transition-all" title={t('servers.refresh')}>
                      <RefreshCw size={14} />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleRemove(s.id)}
                      className="p-2 rounded-lg hover:bg-mc-red/10 text-mc-muted hover:text-mc-red transition-all">
                      <Trash2 size={14} />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
