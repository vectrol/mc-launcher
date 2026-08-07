import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trash2, Package, FolderOpen, Loader2, Puzzle } from 'lucide-react';
import { InstalledVersion } from '../types';

interface Props {
  onLaunch: (versionId: string) => void;
  onSelectMods: (versionId: string) => void;
  installingId: string | null;
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function InstalledVersionsPanel({ onLaunch, onSelectMods, installingId, t }: Props) {
  const [versions, setVersions] = useState<InstalledVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { loadVersions(); }, []);

  async function loadVersions() {
    try { setLoading(true); const v = await window.electronAPI.mc.getInstalledVersions(); setVersions(v); }
    catch {} finally { setLoading(false); }
  }

  async function handleDelete(versionId: string) {
    await window.electronAPI.mc.deleteVersion(versionId);
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    setConfirmDelete(null);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-mc-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold">{t('installed.title')}</h2>
          <p className="text-xs text-mc-muted">{versions.length} {t('installed.count')}</p>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => window.electronAPI.mc.openFolder()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-mc-border hover:border-mc-accent/40 text-sm text-mc-muted hover:text-mc-text transition-all duration-200">
          <FolderOpen size={14} /> {t('installed.openFolder')}
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2 border-mc-accent border-t-transparent" />
            <p className="text-sm text-mc-muted">{t('installed.loading')}</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              <Package size={48} className="text-mc-border" />
            </motion.div>
            <div className="text-center">
              <p className="text-mc-muted">{t('installed.empty')}</p>
              <p className="text-xs text-mc-muted mt-1">{t('installed.emptyHint')}</p>
            </div>
          </div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }} className="space-y-2">
            {versions.map((v) => (
              <motion.div key={v.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                className="group flex items-center justify-between p-4 rounded-xl glass-strong border border-mc-border/60 hover:border-mc-accent/25 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mc-accent/20 to-purple-500/20 border border-mc-accent/20 flex items-center justify-center">
                    {installingId === v.id ? <Loader2 size={18} className="animate-spin text-mc-accent" /> : <Play size={16} className="text-mc-accent" />}
                  </div>
                  <div>
                    <h3 className="font-mono font-medium text-sm">{v.id}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-mc-accent/10 text-mc-accent-hover font-semibold">
                        {t(v.type === 'release' ? 'card.release' : v.type === 'snapshot' ? 'card.snapshot' : 'card.custom')}
                      </span>
                      {v.modCount > 0 && (
                        <span className="text-[10px] text-mc-muted flex items-center gap-1"><Puzzle size={10} />{v.modCount} {t('installed.mods')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => onSelectMods(v.id)}
                    className="p-2 rounded-lg hover:bg-mc-accent/15 text-mc-muted hover:text-mc-accent-hover transition-all duration-200" title={t('mods.title')}>
                    <Puzzle size={16} />
                  </motion.button>
                  <AnimatePresence mode="wait">
                    {confirmDelete === v.id ? (
                      <motion.div key="confirm" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-1">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(v.id)}
                          className="px-3 py-1.5 rounded-lg bg-mc-red/20 text-mc-red text-xs font-medium hover:bg-mc-red/30 transition-colors">{t('installed.delete')}</motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1.5 rounded-lg hover:bg-mc-card/50 text-mc-muted text-xs transition-colors">{t('installed.cancel')}</motion.button>
                      </motion.div>
                    ) : (
                      <motion.button key="trash" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setConfirmDelete(v.id)}
                        className="p-2 rounded-lg hover:bg-mc-red/10 text-mc-muted hover:text-mc-red transition-all duration-200" title={t('installed.delete')}>
                        <Trash2 size={16} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => onLaunch(v.id)}
                    className="px-4 py-2 rounded-xl bg-mc-green hover:bg-mc-green/80 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-mc-green/20 flex items-center gap-1.5">
                    <Play size={14} /> {t('card.launch')}
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
