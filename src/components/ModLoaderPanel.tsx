import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Package, Sparkles, Cpu } from 'lucide-react';
import { ModLoaderVersion, DownloadProgress } from '../types';

interface Props {
  installedVersions: string[];
  onRefresh: () => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function ModLoaderPanel({ installedVersions, onRefresh, t }: Props) {
  const [mode, setMode] = useState<'fabric' | 'forge'>('fabric');
  const [mcVersion, setMcVersion] = useState('');
  const [loaders, setLoaders] = useState<ModLoaderVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLoader, setSelectedLoader] = useState<string>('');
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => { if (mcVersion) fetchLoaders(); }, [mcVersion, mode]);

  async function fetchLoaders() {
    try {
      setLoading(true); setError(null);
      let data: ModLoaderVersion[];
      if (mode === 'fabric') data = await window.electronAPI.mc.getFabricVersions(mcVersion);
      else data = await window.electronAPI.mc.getForgeVersions(mcVersion);
      setLoaders(data);
      if (data.length === 0) setError(t('loader.notFound', mcVersion, mode === 'fabric' ? 'Fabric' : 'Forge'));
    } catch {
      setError(t('loader.failedFetch')); setLoaders([]);
    } finally { setLoading(false); }
  }

  async function handleInstall() {
    if (!selectedLoader || !mcVersion) return;
    try {
      setInstalling(true); setError(null); setProgress(null);
      window.electronAPI.mc.onDownloadProgress((data: DownloadProgress) => setProgress(data));
      if (mode === 'fabric') await window.electronAPI.mc.installFabric(mcVersion, selectedLoader);
      else await window.electronAPI.mc.installForge(mcVersion, selectedLoader);
      onRefresh();
    } catch { setError(t('loader.installFailed')); }
    finally { setInstalling(false); }
  }

  const sortedInstalled = [...installedVersions].sort().reverse();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-mc-border shrink-0">
        <h2 className="text-lg font-semibold">{t('loader.title')}</h2>
        <p className="text-xs text-mc-muted">{t('loader.subtitle')}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex gap-2">
            {(['fabric', 'forge'] as const).map((m) => (
              <motion.button key={m} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { setMode(m); setLoaders([]); setSelectedLoader(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  mode === m ? 'bg-mc-accent/15 text-mc-accent-hover border border-mc-accent/30 shadow-sm shadow-mc-accent/10' : 'bg-mc-card border border-mc-border text-mc-muted hover:text-mc-text'}`}>
                {m === 'fabric' ? <Sparkles size={16} /> : <Cpu size={16} />} {m === 'fabric' ? 'Fabric' : 'Forge'}
              </motion.button>
            ))}
          </div>

          <div>
            <label className="text-xs text-mc-muted uppercase tracking-widest mb-2 block">{t('loader.baseVersion')}</label>
            <input type="text" value={mcVersion} onChange={(e) => setMcVersion(e.target.value)} placeholder="e.g. 1.21.4"
              className="w-full bg-mc-card border border-mc-border rounded-xl px-4 py-3 text-sm text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors font-mono" />
            {sortedInstalled.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sortedInstalled.slice(0, 6).map((v) => (
                  <motion.button key={v} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMcVersion(v)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all duration-200 ${
                      mcVersion === v ? 'bg-mc-accent/20 text-mc-accent-hover border border-mc-accent/30' : 'bg-mc-card border border-mc-border text-mc-muted hover:border-mc-accent/30'}`}>
                    {v}
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence>
            {loading && <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-mc-accent" /></div>}
            {!loading && loaders.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5 max-h-64 overflow-y-auto">
                <label className="text-xs text-mc-muted uppercase tracking-widest block">{t('loader.loaderVersion')}</label>
                {loaders.slice(0, 30).map((l) => (
                  <motion.button key={l.version} whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }} onClick={() => setSelectedLoader(l.version)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all duration-200 flex items-center justify-between ${
                      selectedLoader === l.version ? 'bg-mc-accent/15 text-mc-accent-hover border border-mc-accent/30' : 'bg-mc-card/50 border border-mc-border/50 text-mc-muted hover:text-mc-text hover:border-mc-accent/20'}`}>
                    <span className="font-mono">{l.version}</span>
                    {l.stable !== undefined && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${l.stable ? 'bg-mc-green/10 text-mc-green' : 'bg-mc-orange/10 text-mc-orange'}`}>
                        {l.stable ? t('loader.stable') : t('loader.beta')}
                      </span>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="p-3 rounded-xl bg-mc-red/10 border border-mc-red/20 text-sm text-mc-red">{error}</motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {progress && installing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl glass border border-mc-accent/20 space-y-2">
                <div className="flex items-center gap-2"><Loader2 size={14} className="animate-spin text-mc-accent" /><span className="text-sm text-mc-muted">{progress.message}</span></div>
                <div className="h-1.5 rounded-full bg-mc-surface overflow-hidden">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-mc-accent to-purple-500" animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.3 }} />
                </div>
                <p className="text-[10px] text-mc-muted text-right">{progress.percent}%</p>
              </motion.div>
            )}
          </AnimatePresence>

          {selectedLoader && mcVersion && (
            <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleInstall} disabled={installing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-mc-accent/20">
              {installing ? <><Loader2 size={16} className="animate-spin" />{t('loader.installing')}</>
                : <><Package size={16} />{t('loader.install')} {mode === 'fabric' ? 'Fabric' : 'Forge'} {selectedLoader}</>}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
