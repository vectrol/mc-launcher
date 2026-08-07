import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Package, Sparkles, Cpu, Download } from 'lucide-react';
import { ModLoaderVersion, DownloadProgress } from '../types';

type Variant = 'vanilla' | 'fabric' | 'forge';

interface Props {
  versionId: string;
  isOpen: boolean;
  onClose: () => void;
  onInstall: (variant: Variant, loaderVersion?: string) => void;
  t: (key: string, ...args: (string | number)[]) => string;
  progress: DownloadProgress | null;
  installing: boolean;
}

export default function InstallVersionModal({ versionId, isOpen, onClose, onInstall, t, progress, installing }: Props) {
  const [variant, setVariant] = useState<Variant>('vanilla');
  const [loaderVersions, setLoaderVersions] = useState<ModLoaderVersion[]>([]);
  const [loaderLoading, setLoaderLoading] = useState(false);
  const [selectedLoader, setSelectedLoader] = useState('');
  const [loaderError, setLoaderError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && variant !== 'vanilla') fetchLoaderVersions();
  }, [isOpen, variant]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function fetchLoaderVersions() {
    try {
      setLoaderLoading(true);
      setLoaderError(null);
      setSelectedLoader('');
      let data: ModLoaderVersion[];
      if (variant === 'fabric') data = await window.electronAPI.mc.getFabricVersions(versionId);
      else data = await window.electronAPI.mc.getForgeVersions(versionId);
      setLoaderVersions(data);
      if (data.length === 0) setLoaderError(t('loader.notFound', versionId, variant === 'fabric' ? 'Fabric' : 'Forge'));
    } catch {
      setLoaderError(t('loader.failedFetch'));
      setLoaderVersions([]);
    } finally {
      setLoaderLoading(false);
    }
  }

  function handleInstall() {
    if (variant !== 'vanilla' && !selectedLoader) return;
    onInstall(variant, selectedLoader || undefined);
  }

  const variants: { id: Variant; icon: any; label: string; desc: string }[] = [
    { id: 'vanilla', icon: Package, label: 'Vanilla', desc: 'Original Minecraft' },
    { id: 'fabric', icon: Sparkles, label: 'Fabric', desc: 'Lightweight mod loader' },
    { id: 'forge', icon: Cpu, label: 'Forge', desc: 'Full modding platform' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="w-[440px] max-h-[80vh] overflow-y-auto rounded-2xl glass-strong border border-mc-border/60 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-mc-border">
            <div>
              <h3 className="font-semibold text-sm">{t('loader.title')}</h3>
              <p className="text-xs text-mc-muted font-mono text-mc-accent-hover">{versionId}</p>
            </div>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-mc-card/50 transition-colors">
              <X size={16} className="text-mc-muted" />
            </motion.button>
          </div>

          <div className="p-5 space-y-5">
            {/* Variant selector */}
            <div className="grid grid-cols-3 gap-2">
              {variants.map((v) => (
                <motion.button
                  key={v.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setVariant(v.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                    variant === v.id
                      ? 'bg-mc-accent/15 border-mc-accent/40 shadow-sm shadow-mc-accent/10'
                      : 'bg-mc-card/50 border-mc-border/50 hover:border-mc-accent/25 text-mc-muted'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    variant === v.id ? 'bg-mc-accent/20 text-mc-accent' : 'bg-mc-card text-mc-muted'
                  }`}>
                    <v.icon size={18} />
                  </div>
                  <span className={`text-xs font-semibold ${variant === v.id ? 'text-mc-accent-hover' : ''}`}>{v.label}</span>
                  <span className="text-[9px] text-mc-muted leading-tight text-center">{v.desc}</span>
                </motion.button>
              ))}
            </div>

            {/* Loader version picker */}
            <AnimatePresence>
              {variant !== 'vanilla' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <p className="text-[10px] uppercase tracking-widest text-mc-muted">{t('loader.loaderVersion')}</p>
                  {loaderLoading ? (
                    <div className="flex justify-center py-3"><Loader2 size={18} className="animate-spin text-mc-accent" /></div>
                  ) : loaderVersions.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {loaderVersions.slice(0, 20).map((l) => (
                        <motion.button
                          key={l.version}
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedLoader(l.version)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-200 flex items-center justify-between ${
                            selectedLoader === l.version
                              ? 'bg-mc-accent/15 text-mc-accent-hover border border-mc-accent/30'
                              : 'bg-mc-card/50 border border-mc-border/50 text-mc-muted hover:text-mc-text'
                          }`}
                        >
                          <span className="font-mono">{l.version}</span>
                          {l.stable !== undefined && (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-semibold uppercase ${l.stable ? 'bg-mc-green/10 text-mc-green' : 'bg-mc-orange/10 text-mc-orange'}`}>
                              {l.stable ? t('loader.stable') : t('loader.beta')}
                            </span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-mc-muted py-2">{loaderError || t('versions.loading')}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress */}
            <AnimatePresence>
              {progress && installing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-xl glass border border-mc-accent/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-mc-accent" />
                    <span className="text-xs text-mc-muted">{progress.message}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-mc-surface overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-mc-accent to-purple-500"
                      animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <p className="text-[9px] text-mc-muted text-right">{progress.percent}%</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Install button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleInstall}
              disabled={installing || (variant !== 'vanilla' && !selectedLoader)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-mc-accent/20"
            >
              {installing ? (
                <><Loader2 size={15} className="animate-spin" />{t('loader.installing')}</>
              ) : (
                <><Download size={15} />{variant === 'vanilla' ? t('card.download') : `${t('loader.install')} ${variant === 'fabric' ? 'Fabric' : 'Forge'}`}</>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
