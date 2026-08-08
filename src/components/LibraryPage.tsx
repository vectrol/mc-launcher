import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trash2, Package, FolderOpen, FolderInput, Loader2, Puzzle, ChevronDown, Image as ImageIcon, Archive, Copy, Pencil, Settings as SettingsIcon, X, Star, HardDrive, PanelsTopLeft, Camera } from 'lucide-react';
import { InstalledVersion } from '../types';
import VersionMods from './library/VersionMods';
import VersionWorlds from './library/VersionWorlds';
import VersionResourcePacks from './library/VersionResourcePacks';
import InstanceSettings from './library/InstanceSettings';

interface Props {
  onLaunch: (versionId: string) => void;
  onDeleted?: () => void;
  installingId: string | null;
  t: (key: string, ...args: (string | number)[]) => string;
}

type SubTab = 'mods' | 'worlds' | 'rpacks' | 'screenshots' | 'settings';

export default function LibraryPage({ onLaunch, onDeleted, installingId, t }: Props) {
  const [versions, setVersions] = useState<InstalledVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('mods');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<null | { type: 'clone' | 'rename'; id: string }>(null);
  const [editName, setEditName] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'time' | 'mods'>('name');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const iconRef = useRef<HTMLInputElement>(null);
  const [iconTarget, setIconTarget] = useState('');
  const [banners, setBanners] = useState<Record<string, string>>({});
  const bannerRef = useRef<HTMLInputElement>(null);
  const [bannerTarget, setBannerTarget] = useState('');
  const [bannerMsg, setBannerMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loaderMenu, setLoaderMenu] = useState<string | null>(null);
  const loaderMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadVersions();
    try { setFavorites(JSON.parse(localStorage.getItem('mc_fav_versions') || '[]')); } catch {}
  }, []);

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id];
      localStorage.setItem('mc_fav_versions', JSON.stringify(next));
      return next;
    });
  }

  async function loadIcon(id: string) {
    if (icons[id]) return;
    const b64 = await window.electronAPI.mc.getInstanceIcon(id);
    if (b64) setIcons(prev => ({ ...prev, [id]: b64 }));
  }

  async function handleIconFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f && iconTarget) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('read failed'));
          reader.readAsDataURL(f);
        });
        const r = await window.electronAPI.mc.setInstanceIcon(iconTarget, dataUrl);
        if (r.success) setIcons(prev => ({ ...prev, [iconTarget]: dataUrl }));
      } catch {}
    }
    setIconTarget('');
    if (iconRef.current) iconRef.current.value = '';
  }

  async function loadBanner(id: string) {
    if (banners[id]) return;
    const b64 = await window.electronAPI.mc.getInstanceBanner(id);
    if (b64) setBanners(prev => ({ ...prev, [id]: b64 }));
  }

  async function handleBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f && bannerTarget) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('read failed'));
          reader.readAsDataURL(f);
        });
        const r = await window.electronAPI.mc.setInstanceBanner(bannerTarget, dataUrl);
        if (r.success) setBanners(prev => ({ ...prev, [bannerTarget]: dataUrl }));
      } catch {}
    }
    setBannerTarget('');
    if (bannerRef.current) bannerRef.current.value = '';
  }

  useEffect(() => {
    if (expandedId) {
      const v = versions.find((v) => v.id === expandedId);
      if (v && (!v.hasJar && v.modCount === 0)) setActiveSubTab('worlds');
      else setActiveSubTab('mods');
      loadIcon(expandedId);
    }
  }, [expandedId]);

  const sortedVersions = [...versions].sort((a, b) => {
    const fa = favorites.includes(a.id) ? 0 : 1;
    const fb = favorites.includes(b.id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    if (sortBy === 'name') return a.id.localeCompare(b.id);
    if (sortBy === 'mods') return b.modCount - a.modCount;
    return (b.releaseTime || '').localeCompare(a.releaseTime || '');
  });

  // Preload banners for visible cards (lazy on mount)
  useEffect(() => {
    for (const v of sortedVersions.slice(0, 8)) loadBanner(v.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions.length]);

  async function loadVersions() {
    try { setLoading(true); setVersions(await window.electronAPI.mc.getInstalledVersions()); }
    catch {} finally { setLoading(false); }
  }

  async function handleDelete(versionId: string) {
    try {
      await window.electronAPI.mc.deleteVersion(versionId);
      setVersions((prev) => prev.filter((v) => v.id !== versionId));
      setConfirmDelete(null); setExpandedId(null);
      onDeleted?.();
    } catch (e: any) {
      setBannerMsg({ ok: false, text: e?.message || t('error.export') });
      setTimeout(() => setBannerMsg(null), 3000);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-mc-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold">{t('library.title')}</h2>
          <p className="text-xs text-mc-muted">{versions.length} {t('installed.count')}</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-mc-card/50 border border-mc-border text-xs text-mc-muted outline-none">
            <option value="name">{t('library.sortName')}</option>
            <option value="time">{t('library.sortTime')}</option>
            <option value="mods">{t('library.sortMods')}</option>
          </select>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={async () => {
              const folder = await window.electronAPI.mc.pickDirectory();
              if (!folder) return;
              try {
                const r = await window.electronAPI.mc.importMinecraftFolder(folder);
                await loadVersions();
                setBannerMsg({ ok: true, text: `${t('library.imported')}: ${r.name}` });
              } catch (e: any) {
                setBannerMsg({ ok: false, text: e?.message || t('error.import') });
              }
              setTimeout(() => setBannerMsg(null), 4000);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-mc-border hover:border-mc-accent/40 text-sm text-mc-muted hover:text-mc-text transition-all">
            <FolderInput size={14} /> {t('library.import')}
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => window.electronAPI.mc.openFolder()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-mc-border hover:border-mc-accent/40 text-sm text-mc-muted hover:text-mc-text transition-all">
            <FolderOpen size={14} /> {t('installed.openFolder')}
          </motion.button>
        </div>
      </div>

      {bannerMsg && (
        <div className={`px-6 py-2 text-xs ${bannerMsg.ok ? 'bg-mc-green/10 text-mc-green' : 'bg-mc-red/10 text-mc-red'}`}>
          {bannerMsg.text}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2 border-mc-accent border-t-transparent" />
            <p className="text-sm text-mc-muted">{t('installed.loading')}</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Package size={48} className="text-mc-border" />
            <p className="text-mc-muted">{t('installed.empty')}</p>
            <p className="text-xs text-mc-muted">{t('installed.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedVersions.map((v) => (
              <motion.div
                key={v.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="rounded-2xl glass-strong border border-mc-border/60 overflow-hidden"
              >
                {/* Banner */}
                {banners[v.id] && (
                  <div className="relative h-24 shrink-0 cursor-pointer group/banner" onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
                    <img src={banners[v.id]} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-mc-card via-transparent to-transparent" />
                  </div>
                )}
                {/* Header row */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4 cursor-pointer select-none flex-1" onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
                    <motion.div animate={{ rotate: expandedId === v.id ? 0 : -90 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={14} className="text-mc-muted" />
                    </motion.div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mc-accent/20 to-purple-500/20 border border-mc-accent/20 flex items-center justify-center shrink-0 overflow-hidden"
                      onMouseEnter={() => loadIcon(v.id)}>
                      {icons[v.id] ? <img src={icons[v.id]} alt="" className="w-full h-full object-cover" />
                        : installingId === v.id ? <Loader2 size={18} className="animate-spin text-mc-accent" /> : <Play size={16} className="text-mc-accent" />}
                    </div>
                    <div>
                      <h3 className="font-mono font-medium text-sm text-mc-text flex items-center gap-1.5">
                        {favorites.includes(v.id) && <Star size={11} className="text-mc-orange" fill="currentColor" />}
                        {v.id}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-mc-accent/10 text-mc-accent-hover font-semibold">
                          {t(v.type === 'release' ? 'card.release' : v.type === 'snapshot' ? 'card.snapshot' : v.type === 'modpack' ? 'card.modpack' : 'card.custom')}
                        </span>
                        {v.loaders?.map(l => (
                          <span key={l.id} className="text-[8px] px-1.5 py-0.5 rounded bg-mc-green/10 text-mc-green border border-mc-green/15 font-semibold">
                            {l.type === 'fabric' ? 'Fabric' : l.type === 'forge' ? 'Forge' : l.type === 'neoforge' ? 'NeoForge' : l.type === 'quilt' ? 'Quilt' : l.type === 'optifine' ? 'OptiFine' : l.type}
                          </span>
                        ))}
                        {v.modCount > 0 && <span className="text-[10px] text-mc-muted flex items-center gap-1"><Puzzle size={10} />{v.modCount}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggleFavorite(v.id)}
                      className="p-2 rounded-lg text-mc-muted hover:text-mc-orange transition-all"
                      title={favorites.includes(v.id) ? t('library.unfav') : t('library.fav')}>
                      <Star size={14} fill={favorites.includes(v.id) ? 'currentColor' : 'none'} className={favorites.includes(v.id) ? 'text-mc-orange' : ''} />
                    </button>
                    <button onClick={() => { setIconTarget(v.id); iconRef.current?.click(); }}
                      className="p-2 rounded-lg text-mc-muted hover:text-mc-accent-hover transition-all" title={t('library.setIcon')}>
                      <ImageIcon size={14} />
                    </button>
                    <button onClick={() => { setBannerTarget(v.id); bannerRef.current?.click(); }}
                      className="p-2 rounded-lg text-mc-muted hover:text-mc-accent-hover transition-all" title={t('library.setBanner')}>
                      <PanelsTopLeft size={14} />
                    </button>
                    <AnimatePresence>
                      {editMode?.id === v.id ? (
                        <motion.div key="edit" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && editName.trim()) {
                                try {
                                  if (editMode.type === 'clone') await window.electronAPI.mc.cloneVersion(v.id, editName.trim());
                                  else if (editName.trim() !== v.id) await window.electronAPI.mc.renameVersion(v.id, editName.trim());
                                  await loadVersions();
                                  setBannerMsg({ ok: true, text: t('library.done') });
                                } catch (err: any) {
                                  setBannerMsg({ ok: false, text: err?.message || t('error.export') });
                                }
                                setTimeout(() => setBannerMsg(null), 3000);
                                setEditMode(null);
                              }
                              if (e.key === 'Escape') setEditMode(null);
                            }}
                            className="w-32 bg-mc-card border border-mc-accent/40 rounded-lg px-2 py-1 text-xs text-mc-text outline-none font-mono"
                          />
                          <button onClick={() => setEditMode(null)} className="p-1 rounded hover:bg-mc-card/50 text-mc-muted"><X size={12} /></button>
                        </motion.div>
                      ) : (
                        <motion.div key="actions" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-1">
                          <button onClick={() => { setEditMode({ type: 'clone', id: v.id }); setEditName(`${v.id}-copy`); }}
                            className="p-2 rounded-lg hover:bg-mc-card/50 text-mc-muted hover:text-mc-text transition-all" title={t('library.clone')}>
                            <Copy size={14} />
                          </button>
                          <button onClick={() => { setEditMode({ type: 'rename', id: v.id }); setEditName(v.id); }}
                            className="p-2 rounded-lg hover:bg-mc-card/50 text-mc-muted hover:text-mc-text transition-all" title={t('library.rename')}>
                            <Pencil size={14} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                          className="p-2 rounded-lg hover:bg-mc-red/10 text-mc-muted hover:text-mc-red transition-all"><Trash2 size={16} /></motion.button>
                      )}
                    </AnimatePresence>
                    {v.loaders && v.loaders.length > 0 ? (
                      <div className="relative">
                        <div className="flex rounded-xl overflow-hidden shadow-lg shadow-mc-green/20" ref={loaderMenuRef}>
                          <motion.button whileTap={{ scale: 0.97 }} onClick={() => onLaunch(v.loaders![0]!.id)}
                            className="pl-3.5 pr-2 py-2 bg-mc-green hover:bg-mc-green/80 text-white text-sm font-medium transition-all flex items-center gap-1">
                            <Play size={14} /><span className="text-[9px] uppercase opacity-80">{v.loaders![0]!.type}</span>
                          </motion.button>
                          <button onClick={() => setLoaderMenu(loaderMenu === v.id ? null : v.id)}
                            className="px-2 py-2 bg-mc-green hover:bg-mc-green/80 text-white/70 hover:text-white border-l border-white/20 transition-colors">
                            <ChevronDown size={12} />
                          </button>
                        </div>
                        {loaderMenu === v.id && createPortal(
                          <div
                            className="fixed bg-mc-card border border-mc-border rounded-xl shadow-xl z-[110] min-w-[160px] overflow-hidden"
                            style={{
                              top: (loaderMenuRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                              right: window.innerWidth - (loaderMenuRef.current?.getBoundingClientRect().right ?? 0),
                            }}
                            onClick={() => setLoaderMenu(null)}
                          >
                            {v.loaders.map(l => (
                              <button key={l.id} onClick={() => { onLaunch(l.id); setLoaderMenu(null); }}
                                className="w-full px-3 py-2 text-left text-xs text-mc-text hover:bg-mc-green/10 flex items-center gap-2">
                                <Play size={10} className="text-mc-green" />{l.type === 'fabric' ? 'Fabric' : l.type === 'forge' ? 'Forge' : l.type === 'neoforge' ? 'NeoForge' : l.type}
                              </button>
                            ))}
                            <button onClick={() => { onLaunch(v.id); setLoaderMenu(null); }}
                              className="w-full px-3 py-2 text-left text-xs text-mc-muted hover:bg-mc-card/50 border-t border-mc-border/50 flex items-center gap-2">
                              <Play size={10} />{t('card.vanillaLaunch')}
                            </button>
                          </div>,
                          document.body
                        )}
                      </div>
                    ) : (
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => onLaunch(v.id)}
                        className="px-4 py-2 rounded-xl bg-mc-green hover:bg-mc-green/80 text-white text-sm font-medium transition-all shadow-lg shadow-mc-green/20 flex items-center gap-1.5">
                        <Play size={14} /> {t('card.launch')}
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Expanded panel */}
                <AnimatePresence>
                  {expandedId === v.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-mc-border/50">
                        {/* Sub tabs */}
                        <div className="flex gap-1 pt-3 mb-3">
                          {([
                            { k: 'mods' as SubTab, icon: Puzzle, label: t('mods.title') },
                            { k: 'worlds' as SubTab, icon: HardDrive, label: t('worlds.title') },
                            { k: 'rpacks' as SubTab, icon: ImageIcon, label: t('rp.title') },
                            { k: 'screenshots' as SubTab, icon: Camera, label: t('shots.title') },
                            { k: 'settings' as SubTab, icon: SettingsIcon, label: t('nav.settings') },
                          ]).map((tab) => (
                            <button key={tab.k} onClick={() => setActiveSubTab(tab.k)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                activeSubTab === tab.k ? 'bg-mc-accent/15 text-mc-accent-hover border border-mc-accent/20' : 'text-mc-muted hover:text-mc-text'
                              }`}>
                              <tab.icon size={12} />{tab.label}
                            </button>
                          ))}
                          <button onClick={async () => {
                            try {
                              const r = await window.electronAPI.mc.exportModpack(v.id, 'curseforge');
                              setBannerMsg({ ok: true, text: `${t('modpack.exported')}: ${r.path}` });
                            } catch (e: any) {
                              setBannerMsg({ ok: false, text: e?.message || t('error.export') });
                            }
                            setTimeout(() => setBannerMsg(null), 4000);
                          }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-mc-muted hover:text-mc-text transition-all">
                            <Archive size={12} />{t('modpack.export')}
                          </button>
                        </div>

                        {/* Sub tab content */}
                        <AnimatePresence mode="wait">
                          {activeSubTab === 'mods' ? (
                            <motion.div key="mods" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                              <VersionMods versionId={v.id} t={t} />
                            </motion.div>
                          ) : activeSubTab === 'worlds' ? (
                            <motion.div key="worlds" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                              <VersionWorlds t={t} />
                            </motion.div>
                          ) : activeSubTab === 'rpacks' ? (
                            <motion.div key="rpacks" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                              <VersionResourcePacks t={t} />
                            </motion.div>
                          ) : activeSubTab === 'screenshots' ? (
                            <motion.div key="screenshots" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                              <MiniScreenshots t={t} />
                            </motion.div>
                          ) : (
                            <motion.div key="settings" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                              <InstanceSettings versionId={v.id} t={t} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <input ref={iconRef} type="file" accept=".png,.jpg,.gif" className="hidden" onChange={handleIconFile} />
      <input ref={bannerRef} type="file" accept=".png,.jpg,.gif,.webp" className="hidden" onChange={handleBannerFile} />
    </div>
  );
}

function MiniScreenshots({ t }: { t: Props['t'] }) {
  const [shots, setShots] = useState<any[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.mc.getScreenshots().then(setShots).catch(() => {});
  }, []);

  if (shots.length === 0) return <p className="text-xs text-mc-muted py-2 italic">{t('shots.empty')}</p>;

  return (
    <div>
      <div className="flex gap-1.5 mb-2">
        <button onClick={() => window.electronAPI.mc.openScreenshotsFolder()}
          className="px-2.5 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-text transition-colors">
          <FolderOpen size={10} className="inline mr-1" />{t('installed.openFolder')}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {shots.slice(0, 12).map(s => (
          <div key={s.name} className="aspect-video rounded-lg bg-mc-card/30 border border-mc-border/30 overflow-hidden cursor-pointer relative group"
            onClick={() => {
              if (!images[s.name]) {
                window.electronAPI.mc.getScreenshotBase64(s.name).then(b64 => {
                  if (b64) setImages(prev => ({ ...prev, [s.name]: b64 }));
                });
              }
              setPreview(images[s.name] || null);
            }}
            onMouseEnter={() => {
              if (!images[s.name]) {
                window.electronAPI.mc.getScreenshotBase64(s.name).then(b64 => {
                  if (b64) setImages(prev => ({ ...prev, [s.name]: b64 }));
                });
              }
            }}>
            {images[s.name] ? (
              <img src={images[s.name]} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Loader2 size={12} className="animate-spin text-mc-muted" /></div>
            )}
            <button onClick={(e) => { e.stopPropagation(); window.electronAPI.mc.deleteScreenshot(s.name); setShots(shots.filter(x => x.name !== s.name)); }}
              className="absolute top-1 right-1 p-1 rounded bg-mc-red/20 text-mc-red opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={8} /></button>
          </div>
        ))}
      </div>
      {preview && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview} className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

