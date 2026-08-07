import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Trash2, FolderOpen, Archive, Loader2, Image } from 'lucide-react';
import { WorldInfo } from '../types';

interface Props {
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function WorldsPanel({ t }: Props) {
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadWorlds(); }, []);

  async function loadWorlds() {
    try {
      setLoading(true);
      const w = await window.electronAPI.mc.getWorlds();
      setWorlds(w);
      for (const world of w) {
        if (world.icon) {
          const icon = await window.electronAPI.mc.getWorldIcon(world.name);
          if (icon) setIcons((prev) => ({ ...prev, [world.name]: icon }));
        }
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleDelete(name: string) {
    await window.electronAPI.mc.deleteWorld(name);
    setWorlds((prev) => prev.filter((w) => w.name !== name));
    setConfirmDelete(null);
  }

  async function handleBackup(name: string) {
    await window.electronAPI.mc.backupWorld(name);
  }

  function formatSize(bytes: number) {
    if (!bytes) return 'N/A';
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-mc-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold">{t('worlds.title')}</h2>
          <p className="text-xs text-mc-muted">{worlds.length} {t('worlds.count')}</p>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => window.electronAPI.mc.openWorldsFolder()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-mc-border hover:border-mc-accent/40 text-sm text-mc-muted hover:text-mc-text transition-all">
          <FolderOpen size={14} /> {t('installed.openFolder')}
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-mc-accent" /></div>
        ) : worlds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <HardDrive size={48} className="text-mc-border" />
            <p className="text-mc-muted">{t('worlds.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {worlds.map((w) => (
              <motion.div key={w.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl glass-strong border border-mc-border/60 hover:border-mc-accent/25 transition-all group">
                <div className="flex gap-3">
                  <div className="w-14 h-14 rounded-xl bg-mc-card border border-mc-border shrink-0 flex items-center justify-center overflow-hidden">
                    {icons[w.name] ? <img src={icons[w.name]} alt="" className="w-full h-full object-cover" />
                      : <Image size={20} className="text-mc-muted" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-mc-text truncate">{w.name}</h3>
                    <p className="text-[10px] text-mc-muted">{formatSize(w.size)}</p>
                    <p className="text-[10px] text-mc-muted">{new Date(w.lastPlayed).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-mc-border/50">
                  {confirmDelete === w.name ? (
                    <>
                      <button onClick={() => handleDelete(w.name)} className="flex-1 py-1.5 rounded-lg bg-mc-red/20 text-mc-red text-[10px] font-medium hover:bg-mc-red/30 transition-colors">{t('installed.delete')}</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 rounded-lg text-[10px] text-mc-muted hover:bg-mc-card/50 transition-colors">{t('installed.cancel')}</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleBackup(w.name)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-text transition-colors"><Archive size={11} /> {t('worlds.backup')}</button>
                      <button onClick={() => setConfirmDelete(w.name)} className="p-1.5 rounded-lg text-mc-muted hover:text-mc-red hover:bg-mc-red/10 transition-colors"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
