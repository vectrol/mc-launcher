import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Play, CheckCircle2, Loader2, Sparkles, Cpu, Package, ChevronDown, Eye } from 'lucide-react';
import { VersionInfo, ModLoaderVersion, DownloadProgress } from '../types';

// Module-level loader version cache
const loaderCache: Record<string, ModLoaderVersion[]> = {};

interface Props {
  version: VersionInfo;
  index: number;
  isDownloading: boolean;
  isLaunching: boolean;
  isInstalled: boolean;
  onInstall: (versionId: string, variant: 'vanilla' | 'fabric' | 'forge' | 'optifine' | 'neoforge' | 'quilt', loaderVersion?: string) => Promise<void>;
  onLaunch: () => void;
  t: (key: string, ...args: (string | number)[]) => string;
  progress: DownloadProgress | null;
  activeId: string | null;
}

export default function VersionCard({ version, index, isDownloading, isLaunching, isInstalled, onInstall, onLaunch, t, progress, activeId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [variant, setVariant] = useState<'vanilla' | 'fabric' | 'forge' | 'optifine' | 'neoforge' | 'quilt'>('vanilla');
  const [loaderVersions, setLoaderVersions] = useState<ModLoaderVersion[]>([]);
  const [loaderLoading, setLoaderLoading] = useState(false);
  const [selectedLoader, setSelectedLoader] = useState('');
  const [loaderError, setLoaderError] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<{ summary: string; url: string } | null>(null);
  const [changelogLoading, setChangelogLoading] = useState(false);

  const date = new Date(version.releaseTime);
  const dateStr = date.toLocaleDateString(navigator.language, { year: 'numeric', month: 'short', day: 'numeric' });
  const isActive = activeId === version.id && isDownloading;

  useEffect(() => {
    if (expanded && variant !== 'vanilla') fetchLoaderVersions();
  }, [expanded, variant]);

  useEffect(() => {
    if (expanded && !changelog && !changelogLoading) fetchChangelog();
  }, [expanded]);

  async function fetchChangelog() {
    try {
      setChangelogLoading(true);
      const c = await window.electronAPI.mc.getVersionChangelog(version.id);
      if (c) setChangelog(c);
    } catch {} finally { setChangelogLoading(false); }
  }

  async function fetchLoaderVersions() {
    try {
      const cacheKey = `${variant}:${version.id}`;
      if (loaderCache[cacheKey]) { setLoaderVersions(loaderCache[cacheKey]); return; }
      setLoaderLoading(true); setLoaderError(null); setSelectedLoader('');
      let data: ModLoaderVersion[];
      if (variant === 'fabric') data = await window.electronAPI.mc.getFabricVersions(version.id);
      else if (variant === 'forge') data = await window.electronAPI.mc.getForgeVersions(version.id);
      else if (variant === 'optifine') data = await window.electronAPI.mc.getOptiFineVersions(version.id);
      else if (variant === 'neoforge') data = await window.electronAPI.mc.getNeoForgeVersions(version.id);
      else data = await window.electronAPI.mc.getQuiltVersions(version.id);
      loaderCache[`${variant}:${version.id}`] = data;
      setLoaderVersions(data);
      if (data.length === 0) setLoaderError(t('loader.notFound', version.id, variant === 'fabric' ? 'Fabric' : variant === 'forge' ? 'Forge' : 'OptiFine'));
    } catch { setLoaderError(t('loader.failedFetch')); setLoaderVersions([]); }
    finally { setLoaderLoading(false); }
  }

  function handleInstall() {
    if (variant !== 'vanilla' && !selectedLoader) return;
    onInstall(version.id, variant, selectedLoader || undefined);
  }

  function toggleExpand() {
    if (isInstalled) return;
    setExpanded(!expanded);
    if (!expanded) { setVariant('vanilla'); setSelectedLoader(''); setLoaderVersions([]); }
  }

  const isThisDownloading = isActive && progress && progress.phase !== 'done';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.02, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: expanded ? 0 : -2, scale: expanded ? 1 : 1.02 }}
      className="relative group"
    >
      <div className="p-4 rounded-2xl glass-strong border border-mc-border/60 hover:border-mc-accent/30 transition-all duration-300">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-mc-accent/0 to-purple-500/0 group-hover:from-mc-accent/3 group-hover:to-purple-500/3 transition-all duration-500 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1.5">
            <motion.h3 layout className="font-mono font-medium text-sm text-mc-text">{version.id}</motion.h3>
            <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-md ${
              version.type === 'release' ? 'bg-mc-green/10 text-mc-green border border-mc-green/20'
                : version.type === 'snapshot' ? 'bg-mc-orange/10 text-mc-orange border border-mc-orange/20'
                : 'bg-mc-muted/10 text-mc-muted border border-mc-muted/20'
            }`}>
              {t(version.type === 'release' ? 'card.release' : version.type === 'snapshot' ? 'card.snapshot' : 'card.custom')}
            </span>
          </div>
          <p className="text-[10px] text-mc-muted mb-3">{dateStr}</p>

          {isInstalled && (
            <div className="flex items-center gap-1 mb-3 text-[10px] text-mc-green">
              <CheckCircle2 size={12} /><span>{t('card.installed')}</span>
            </div>
          )}

          {/* Action buttons */}
          {isInstalled ? (
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onLaunch} disabled={isLaunching}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-mc-green hover:bg-mc-green/80 text-white text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-mc-green/20">
              {isLaunching ? <><Loader2 size={13} className="animate-spin" />{t('card.starting')}</>
                : <><Play size={13} />{t('card.launch')}</>}
            </motion.button>
          ) : !expanded ? (
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={toggleExpand} disabled={isDownloading}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {isActive ? <><Loader2 size={13} className="animate-spin" />{t('card.downloading')}</>
                : <><Download size={13} />{t('card.download')}</>}
            </motion.button>
          ) : null}

          {/* Expanded installer */}
          <AnimatePresence>
            {expanded && !isInstalled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3 border-t border-mc-border/50 mt-3">
                  {/* Close button */}
                  <div className="flex justify-end">
                    <button onClick={() => setExpanded(false)}
                      className="text-[10px] text-mc-muted hover:text-mc-text flex items-center gap-0.5">
                      <ChevronDown size={10} /> {t('common.close')}
                    </button>
                  </div>

                  {/* Changelog */}
                  {changelog && (
                    <div className="p-3 rounded-xl bg-mc-card/30 border border-mc-border/30">
                      <p className="text-[10px] text-mc-muted mb-1 font-semibold">{t('versions.changelog')}</p>
                      <p className="text-[9px] text-mc-muted leading-relaxed line-clamp-4">{changelog.summary}</p>
                      <a href={changelog.url} target="_blank"
                        className="text-[9px] text-mc-accent-hover mt-1 inline-block hover:underline"
                        onClick={(e) => e.stopPropagation()}>
                        {t('versions.viewFull')} →
                      </a>
                    </div>
                  )}

                  {/* Variant selector */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: 'vanilla' as const, icon: Package, label: 'Vanilla' },
                      { id: 'fabric' as const, icon: Sparkles, label: 'Fabric' },
                      { id: 'forge' as const, icon: Cpu, label: 'Forge' },
                      { id: 'optifine' as const, icon: Eye, label: 'OptiFine' },
                      { id: 'neoforge' as const, icon: Cpu, label: 'NeoForge' },
                      { id: 'quilt' as const, icon: Sparkles, label: 'Quilt' },
                    ]).map((v) => (
                      <motion.button key={v.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setVariant(v.id)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-[10px] transition-all duration-200 ${
                          variant === v.id ? 'bg-mc-accent/15 border-mc-accent/40 text-mc-accent-hover' : 'bg-mc-card/40 border-mc-border/40 text-mc-muted hover:border-mc-accent/25'
                        }`}>
                        <v.icon size={14} />
                        <span className="font-semibold">{v.label}</span>
                      </motion.button>
                    ))}
                  </div>

                  {/* Loader version picker */}
                  {variant !== 'vanilla' && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-mc-muted uppercase">{t('loader.loaderVersion')}</p>
                      {loaderLoading ? (
                        <Loader2 size={14} className="animate-spin text-mc-accent mx-auto" />
                      ) : loaderVersions.length > 0 ? (
                        <div className="space-y-0.5 max-h-28 overflow-y-auto">
                          {loaderVersions.slice(0, 15).map((l) => (
                            <button key={l.version}
                              onClick={() => setSelectedLoader(l.version)}
                              className={`w-full text-left px-2.5 py-1.5 rounded text-[10px] transition-all flex items-center justify-between ${
                                selectedLoader === l.version ? 'bg-mc-accent/15 text-mc-accent-hover border border-mc-accent/30' : 'bg-mc-card/30 border border-mc-border/30 text-mc-muted hover:text-mc-text'
                              }`}>
                              <span className="font-mono text-[10px]">{l.version}</span>
                              {l.stable !== undefined && (
                                <span className={`text-[7px] px-1 py-0.5 rounded font-semibold uppercase ${l.stable ? 'bg-mc-green/10 text-mc-green' : 'bg-mc-orange/10 text-mc-orange'}`}>
                                  {l.stable ? t('loader.stable') : t('loader.beta')}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9px] text-mc-muted">{loaderError || t('versions.loading')}</p>
                      )}
                    </div>
                  )}

                  {/* Progress */}
                  {isActive && progress && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Loader2 size={10} className="animate-spin text-mc-accent" />
                        <span className="text-[9px] text-mc-muted">{progress.message}</span>
                      </div>
                      <div className="h-1 rounded-full bg-mc-surface overflow-hidden">
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-mc-accent to-purple-500"
                          animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.3 }} />
                      </div>
                    </div>
                  )}

                  {/* Install / Cancel */}
                  <div className="flex gap-1.5">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={handleInstall}
                      disabled={isActive || (variant !== 'vanilla' && !selectedLoader)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-mc-accent hover:bg-mc-accent-hover text-white text-[10px] font-medium transition-all duration-200 disabled:opacity-40">
                      {isActive ? <Loader2 size={11} className="animate-spin" />
                        : <Download size={11} />}
                      {isActive ? t('card.downloading') : (variant === 'vanilla' ? t('card.download') : t('loader.install'))}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
