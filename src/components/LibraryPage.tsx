import { useState, useEffect, DragEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trash2, Package, FolderOpen, FolderInput, Loader2, Puzzle, ChevronDown, Image, HardDrive, Archive, Download, Power, Copy, Pencil, Settings as SettingsIcon, X, RefreshCw } from 'lucide-react';
import { InstalledVersion, ModInfo, WorldInfo, ResourcePackInfo } from '../types';

interface Props {
  onLaunch: (versionId: string) => void;
  installingId: string | null;
  t: (key: string, ...args: (string | number)[]) => string;
}

type SubTab = 'mods' | 'worlds' | 'rpacks' | 'settings';

export default function LibraryPage({ onLaunch, installingId, t }: Props) {
  const [versions, setVersions] = useState<InstalledVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('mods');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<null | { type: 'clone' | 'rename'; id: string }>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => { loadVersions(); }, []);

  useEffect(() => {
    if (expandedId) {
      const v = versions.find((v) => v.id === expandedId);
      if (v && (!v.hasJar && v.modCount === 0)) setActiveSubTab('worlds');
      else setActiveSubTab('mods');
    }
  }, [expandedId]);

  async function loadVersions() {
    try { setLoading(true); setVersions(await window.electronAPI.mc.getInstalledVersions()); }
    catch {} finally { setLoading(false); }
  }

  async function handleDelete(versionId: string) {
    await window.electronAPI.mc.deleteVersion(versionId);
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    setConfirmDelete(null); setExpandedId(null);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-mc-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold">{t('library.title')}</h2>
          <p className="text-xs text-mc-muted">{versions.length} {t('installed.count')}</p>
        </div>
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={async () => {
              const folder = prompt(t('library.importHint'));
              if (folder) {
                try { await window.electronAPI.mc.importMinecraftFolder(folder); await loadVersions(); } catch {}
              }
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
            {versions.map((v) => (
              <motion.div
                key={v.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="rounded-2xl glass-strong border border-mc-border/60 overflow-hidden"
              >
                {/* Header row */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4 cursor-pointer select-none flex-1" onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
                    <motion.div animate={{ rotate: expandedId === v.id ? 0 : -90 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={14} className="text-mc-muted" />
                    </motion.div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mc-accent/20 to-purple-500/20 border border-mc-accent/20 flex items-center justify-center shrink-0">
                      {installingId === v.id ? <Loader2 size={18} className="animate-spin text-mc-accent" /> : <Play size={16} className="text-mc-accent" />}
                    </div>
                    <div>
                      <h3 className="font-mono font-medium text-sm text-mc-text">{v.id}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-mc-accent/10 text-mc-accent-hover font-semibold">
                          {v.isModded ? v.type : t(v.type === 'release' ? 'card.release' : v.type === 'snapshot' ? 'card.snapshot' : 'card.custom')}
                        </span>
                        {v.isModded && v.parent && (
                          <span className="text-[9px] text-mc-muted">← {v.parent}</span>
                        )}
                        {v.modCount > 0 && <span className="text-[10px] text-mc-muted flex items-center gap-1"><Puzzle size={10} />{v.modCount}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
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
                                } catch {}
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
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => onLaunch(v.id)}
                      className="px-4 py-2 rounded-xl bg-mc-green hover:bg-mc-green/80 text-white text-sm font-medium transition-all shadow-lg shadow-mc-green/20 flex items-center gap-1.5">
                      <Play size={14} /> {t('card.launch')}
                    </motion.button>
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
                            { k: 'rpacks' as SubTab, icon: Image, label: t('rp.title') },
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
                            try { await window.electronAPI.mc.exportModpack(v.id, 'curseforge'); }
                            catch {}
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
    </div>
  );
}

function VersionMods({ versionId, t }: { versionId: string; t: Props['t'] }) {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<{ base: string; files: string[] }[]>([]);
  const [checking, setChecking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.electronAPI.mc.getMods(versionId).then(setMods).catch(() => {});
    window.electronAPI.mc.detectModConflicts(versionId).then(setConflicts).catch(() => {});
  }, [versionId]);

  async function importFiles(paths: string[]) {
    setImporting(true);
    try { await window.electronAPI.mc.importMods(versionId, paths); setMods(await window.electronAPI.mc.getMods(versionId)); }
    catch {} finally { setImporting(false); }
  }

  async function checkUpdates() {
    setChecking(true);
    try { setUpdates(await window.electronAPI.mc.checkModsForUpdates(versionId)); }
    catch {} finally { setChecking(false); }
  }

  async function updateMod(item: any) {
    if (!item.latestFile) return;
    try {
      await window.electronAPI.mc.downloadMod(versionId, item.latestFile.url, item.latestFile.name, 'mods');
      await window.electronAPI.mc.deleteMod(versionId, item.fileName);
      setMods(await window.electronAPI.mc.getMods(versionId));
      setUpdates(updates.filter(u => u.fileName !== item.fileName));
    } catch {}
  }

  function handleDrop(e: DragEvent) { e.preventDefault(); setDragOver(false); const jars = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.jar')); if (jars.length) importFiles(jars.map(f => (f as any).path).filter(Boolean)); }
  function handleBrowse(e: React.ChangeEvent<HTMLInputElement>) { const files = Array.from(e.target.files || []); if (files.length) importFiles(files.map(f => (f as any).path).filter(Boolean)); if (fileRef.current) fileRef.current.value = ''; }

  return (
    <div className="space-y-2">
      {/* Update check button + conflict warnings */}
      <div className="flex items-center justify-between">
        <button onClick={checkUpdates} disabled={checking}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-accent-hover transition-all disabled:opacity-40">
          {checking ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          {t('mods.checkUpdates')}
        </button>
        <div className="flex gap-1.5">
          {updates.filter(u => u.hasUpdate).length > 0 && (
            <span className="text-[9px] px-2 py-1 rounded-lg bg-mc-orange/15 text-mc-orange">{updates.filter(u => u.hasUpdate).length} {t('mods.updates')}</span>
          )}
          {conflicts.length > 0 && (
            <span className="text-[9px] px-2 py-1 rounded-lg bg-mc-red/15 text-mc-red">{conflicts.length} {t('mods.conflicts')}</span>
          )}
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="p-2.5 rounded-xl bg-mc-red/10 border border-mc-red/20 text-[10px] text-mc-red space-y-1">
          {conflicts.map(c => (
            <p key={c.base} className="truncate">⚠ {c.files.join(', ')}</p>
          ))}
        </div>
      )}

      <motion.div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
        animate={{ borderColor: dragOver ? 'rgba(99,102,241,0.4)' : 'rgba(37,37,58,0.3)' }}
        className="border-2 border-dashed rounded-xl p-4 transition-all text-center cursor-pointer">
        {importing ? <Loader2 size={16} className="animate-spin text-mc-accent mx-auto" /> : <Download size={16} className="text-mc-muted mx-auto" />}
        <p className="text-[10px] text-mc-muted mt-1">{dragOver ? t('mods.dropActive') : t('mods.dropHere')} · <button onClick={() => fileRef.current?.click()} className="text-mc-accent-hover underline">{t('mods.browse')}</button></p>
        <input ref={fileRef} type="file" accept=".jar" multiple className="hidden" onChange={handleBrowse} />
      </motion.div>

      {/* Updateable mods */}
      {updates.filter(u => u.hasUpdate).length > 0 && (
        <div className="space-y-1">
          {updates.filter(u => u.hasUpdate).map(u => (
            <div key={u.fileName} className="flex items-center justify-between p-2 rounded-xl bg-mc-orange/10 border border-mc-orange/25 text-xs">
              <div className="min-w-0">
                <p className="font-mono text-[10px] text-mc-text truncate">{u.name}</p>
                <p className="text-[9px] text-mc-muted">{u.localVersion} → <span className="text-mc-orange">{u.latestVersion}</span></p>
              </div>
              <button onClick={() => updateMod(u)} className="px-2 py-1 rounded-lg bg-mc-orange/20 text-mc-orange text-[9px] hover:bg-mc-orange/30 transition-colors shrink-0">
                <Download size={9} className="inline mr-0.5" />{t('mods.update')}
              </button>
            </div>
          ))}
        </div>
      )}

      {mods.map(m => (
        <div key={m.fileName} className={`flex items-center justify-between p-2 rounded-xl border text-xs ${m.disabled ? 'bg-mc-card/10 border-mc-border/20 opacity-50' : 'bg-mc-card/30 border-mc-border/30'}`}>
          <span className="font-mono truncate">{m.name}{m.disabled && ' (off)'}</span>
          <div className="flex gap-1 shrink-0">
            <button onClick={async () => { await window.electronAPI.mc.toggleMod(versionId, m.fileName); setMods(await window.electronAPI.mc.getMods(versionId)); }}
              className={`p-1 rounded transition-colors ${m.disabled ? 'text-mc-green hover:bg-mc-green/10' : 'text-mc-orange hover:bg-mc-orange/10'}`}
              title={m.disabled ? 'Enable' : 'Disable'}>
              <Power size={10} />
            </button>
            <button onClick={async () => { await window.electronAPI.mc.deleteMod(versionId, m.fileName); setMods(mods.filter(x => x.fileName !== m.fileName)); }}
              className="p-1 rounded hover:bg-mc-red/10 text-mc-muted hover:text-mc-red"><Trash2 size={10} /></button>
          </div>
        </div>
      ))}
      {mods.length === 0 && <p className="text-xs text-mc-muted py-2 italic">{t('mods.empty')}</p>}
    </div>
  );
}

function VersionWorlds({ t }: { t: Props['t'] }) {
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [icons, setIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    window.electronAPI.mc.getWorlds().then(async (w) => {
      setWorlds(w);
      for (const world of w) {
        if (world.icon) { const icon = await window.electronAPI.mc.getWorldIcon(world.name); if (icon) setIcons(prev => ({ ...prev, [world.name]: icon })); }
      }
    });
  }, []);

  if (worlds.length === 0) return <p className="text-xs text-mc-muted py-2 italic">{t('worlds.empty')}</p>;

  return (
    <div className="grid grid-cols-3 gap-2">
      {worlds.map(w => (
        <div key={w.name} className="p-3 rounded-xl bg-mc-card/30 border border-mc-border/30 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-mc-card overflow-hidden shrink-0">{icons[w.name] ? <img src={icons[w.name]} alt="" className="w-full h-full object-cover" /> : <HardDrive size={12} className="text-mc-muted m-2" />}</div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-mc-text truncate">{w.name}</p>
            <p className="text-[8px] text-mc-muted">{new Date(w.lastPlayed).toLocaleDateString()}</p>
          </div>
          <button onClick={async () => { await window.electronAPI.mc.backupWorld(w.name); }}
            className="p-1 rounded hover:bg-mc-accent/10 text-mc-muted text-[8px] ml-auto shrink-0">Backup</button>
        </div>
      ))}
    </div>
  );
}

function VersionResourcePacks({ t }: { t: Props['t'] }) {
  const [packs, setPacks] = useState<ResourcePackInfo[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { window.electronAPI.mc.getResourcePacks().then(setPacks); }, []);

  async function importPacks(paths: string[]) {
    await window.electronAPI.mc.importResourcePacks(paths);
    setPacks(await window.electronAPI.mc.getResourcePacks());
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-text transition-colors">
          + {t('rp.title')}
        </button>
        <input ref={fileRef} type="file" accept=".zip" multiple className="hidden"
          onChange={e => { const files = Array.from(e.target.files || []).map(f => (f as any).path).filter(Boolean); if (files.length) importPacks(files); }} />
        <button onClick={() => window.electronAPI.mc.openResourcePacksFolder()} className="px-3 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-text transition-colors">{t('installed.openFolder')}</button>
      </div>
      {packs.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {packs.map(p => (
            <div key={p.name} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-mc-card/30 border border-mc-border/30 text-[10px] group">
              <Image size={10} className="text-mc-muted" /><span className="truncate max-w-[120px]">{p.name}</span>
              <button onClick={async () => { await window.electronAPI.mc.deleteResourcePack(p.name); setPacks(packs.filter(x => x.name !== p.name)); }}
                className="opacity-0 group-hover:opacity-100 text-mc-muted hover:text-mc-red"><Trash2 size={9} /></button>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-mc-muted italic">{t('rp.empty')}</p>}
    </div>
  );
}

function InstanceSettings({ versionId, t }: { versionId: string; t: Props['t'] }) {
  const [inst, setInst] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      window.electronAPI.mc.getInstanceSettings(versionId),
      window.electronAPI.mc.getCustomGameDirs(),
    ]).then(([s, dirs]) => {
      setInst({ ...s, gameDir: (dirs || {})[versionId] || '' });
      setLoaded(true);
    });
  }, [versionId]);

  async function save(patch: any) {
    if (patch.gameDir !== undefined) {
      await window.electronAPI.mc.setCustomGameDir(versionId, patch.gameDir || '');
      const r = await window.electronAPI.mc.getInstanceSettings(versionId);
      setInst(r);
      return;
    }
    const r = await window.electronAPI.mc.setInstanceSettings(versionId, patch);
    setInst(r);
  }

  if (!loaded) return <Loader2 size={16} className="animate-spin text-mc-accent mx-auto" />;

  return (
    <div className="grid grid-cols-2 gap-3 max-w-md">
      <div>
        <label className="text-[9px] text-mc-muted uppercase block mb-1">{t('settings.javaPath')}</label>
        <input type="text" value={inst.javaPath || ''} onChange={(e) => save({ javaPath: e.target.value })}
          placeholder={t('settings.javaPathHint')} className="w-full bg-mc-card/50 border border-mc-border/40 rounded-lg px-2 py-1.5 text-[11px] text-mc-text outline-none focus:border-mc-accent/40 font-mono" />
      </div>
      <div>
        <label className="text-[9px] text-mc-muted uppercase block mb-1">{t('settings.maxMemory')} (MB)</label>
        <input type="number" value={inst.maxMemory || ''} onChange={(e) => save({ maxMemory: e.target.value })}
          className="w-full bg-mc-card/50 border border-mc-border/40 rounded-lg px-2 py-1.5 text-[11px] text-mc-text outline-none focus:border-mc-accent/40 font-mono" />
      </div>
      <div className="col-span-2">
        <label className="flex items-center gap-2 cursor-pointer" onClick={() => save({ autoMemory: !inst.autoMemory })}>
          <div className={`w-8 h-4 rounded-full transition-all relative ${inst.autoMemory ? 'bg-mc-green' : 'bg-mc-border'}`}>
            <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${inst.autoMemory ? 'left-4' : 'left-0.5'}`} />
          </div>
          <span className="text-[11px] text-mc-muted">{t('settings.autoMemory')}</span>
        </label>
      </div>
      <div className="col-span-2">
        <label className="text-[9px] text-mc-muted uppercase block mb-1">{t('settings.gameDir')}</label>
        <div className="flex gap-1.5">
          <input type="text" value={inst.gameDir || ''} onChange={(e) => save({ gameDir: e.target.value })}
            placeholder={t('settings.gameDirHint')} className="flex-1 bg-mc-card/50 border border-mc-border/40 rounded-lg px-2 py-1.5 text-[11px] text-mc-text outline-none focus:border-mc-accent/40 font-mono" />
          <button onClick={async () => {
            const dir = prompt('Game directory:');
            if (dir) { await window.electronAPI.mc.setCustomGameDir(versionId, dir); const s = await window.electronAPI.mc.getInstanceSettings(versionId); setInst(s); }
          }} className="px-2.5 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border/40 text-[10px] text-mc-muted hover:text-mc-text transition-colors shrink-0">{t('settings.detect')}</button>
        </div>
      </div>
    </div>
  );
}
