import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, Loader2, ExternalLink, Sparkles, Package, Puzzle, Sun, Palette, Boxes, Star, Dices, Shield, GitBranch, FileText } from 'lucide-react';
import { ModrinthMod, InstalledVersion } from '../types';

type ResourceType = 'mod' | 'shader' | 'resourcepack' | 'modpack' | 'curseforge';

interface Props {
  installedList: InstalledVersion[];
  t: (key: string, ...args: (string | number)[]) => string;
}

const TYPES: { id: ResourceType; label: string; icon: any }[] = [
  { id: 'mod', label: '市场.mods', icon: Puzzle },
  { id: 'shader', label: '市场.shaders', icon: Sun },
  { id: 'resourcepack', label: '市场.rpacks', icon: Palette },
  { id: 'modpack', label: '市场.modpacks', icon: Boxes },
  { id: 'curseforge', label: '市场.curse', icon: Dices },
];

export default function ModBrowser({ installedList, t }: Props) {
  const [type, setType] = useState<ResourceType>('mod');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ModrinthMod[]>([]);
  const [popular, setPopular] = useState<ModrinthMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMod, setSelectedMod] = useState<ModrinthMod | null>(null);
  const [modVersions, setModVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [targetVersion, setTargetVersion] = useState('');
  const [packInstalling, setPackInstalling] = useState(false);
  const [installingMod, setInstallingMod] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'downloads' | 'follows' | 'updated'>('downloads');
  const [fullDetail, setFullDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [depTree, setDepTree] = useState<any[] | null>(null);
  const [depLoading, setDepLoading] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  useEffect(() => {
    try { setFavorites(JSON.parse(localStorage.getItem('mc_favorites') || '[]')); } catch {}
  }, []);

  function toggleFavorite(slug: string) {
    setFavorites(prev => {
      const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug];
      localStorage.setItem('mc_favorites', JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => { loadPopular(); }, [type]);

  function sortMods(list: ModrinthMod[]) {
    const arr = [...list];
    if (sortBy === 'downloads') arr.sort((a, b) => b.downloads - a.downloads);
    else if (sortBy === 'follows') arr.sort((a, b) => b.follows - a.follows);
    else arr.sort((a, b) => new Date(b.updated || 0).getTime() - new Date(a.updated || 0).getTime());
    return arr;
  }

  async function loadPopular() {
    try {
      setLoading(true); setError(null);
      if (type === 'curseforge') {
        // CurseForge has no "popular" endpoint without query; show empty state with hint
        setPopular([]);
        return;
      }
      const data = await window.electronAPI.mc.getModrinthPopular(type);
      setPopular(data.hits || []);
    } catch { setError(t('common.loading')); }
    finally { setLoading(false); }
  }

  async function handleSearch() {
    if (!query.trim()) return loadPopular();
    try {
      setSearching(true); setError(null);
      if (type === 'curseforge') {
        const data = await window.electronAPI.mc.searchCurseForge(query);
        setResults(data || []);
      } else {
        const data = await window.electronAPI.mc.searchModrinth(query, 0, type);
        setResults(data.hits || []);
      }
    } catch (e: any) {
      setError(e.message === 'NO_API_KEY' ? t('market.needKey') : t('common.loading'));
      setResults([]);
    }
    finally { setSearching(false); }
  }

  function openModDetail(mod: ModrinthMod) {
    setSelectedMod(mod);
    setShowInstall(false);
    setModVersions([]);
    setTargetVersion('');
    setDepTree(null);
    // Fetch full detail (body, gallery, license) for modrinth mods
    if (mod.projectType !== 'curseforge') {
      setDetailLoading(true);
      window.electronAPI.mc.getModrinthMod(mod.slug).then((d) => setFullDetail(d)).catch(() => {}).finally(() => setDetailLoading(false));
      // Load dependency tree for mods (only for the detail view)
      if (type === 'mod') {
        setDepLoading(true);
        window.electronAPI.mc.getModDependencyTree(mod.slug)
          .then(t => setDepTree(t.length > 0 ? t : null))
          .catch(() => setDepTree(null))
          .finally(() => setDepLoading(false));
      }
    } else {
      setFullDetail(null);
    }
  }

  async function handleInstallVersion() {
    if (!selectedMod || !targetVersion) return;
    try {
      setVersionsLoading(true);
      let vers: any[];
      if (type === 'curseforge') {
        vers = await window.electronAPI.mc.getCurseForgeFiles(String(selectedMod.id), targetVersion);
      } else {
        vers = await window.electronAPI.mc.getModrinthVersions(selectedMod.slug, targetVersion, type);
      }
      setModVersions(vers);
      setShowInstall(true);
    } catch {} finally { setVersionsLoading(false); }
  }

  // Modpack: download .mrpack then parse+install
  async function installModpack() {
    if (!selectedMod || type !== 'modpack') return;
    try {
      setPackInstalling(true); setError(null);
      const vers = await window.electronAPI.mc.getModrinthVersions(selectedMod.slug, undefined, 'modpack');
      if (vers.length === 0) { setError(t('mods.noVersionForMod')); return; }
      const file = vers[0].files.find((f: any) => f.primary) || vers[0].files[0];
      if (!file) return;
      // Download mrpack to temp
      const dest = await window.electronAPI.mc.downloadMod('', file.url, `${selectedMod.slug}.mrpack`, 'temp');
      if (!dest.success) { setError(t('error.download')); return; }
      const pack = await window.electronAPI.mc.parseModpack(dest.path);
      await window.electronAPI.mc.installModpack(pack);
      setShowInstall(false); setSelectedMod(null);
    } catch (e: any) { setError(e.message); }
    finally { setPackInstalling(false); }
  }

  async function doInstall(fileUrl: string, fileName: string, versionId?: string) {
    if (!selectedMod || !targetVersion) return;
    try {
      setInstallingMod(true);
      const destType = type === 'shader' ? 'shaders' : type === 'resourcepack' ? 'resourcepacks' : 'mods';
      const result = await window.electronAPI.mc.downloadMod(targetVersion, fileUrl, fileName, destType);
      if (result?.success) {
        // Auto-install required dependencies for mods
        if (type === 'mod' && versionId) {
          const deps = await window.electronAPI.mc.getModDependencies(versionId);
          for (const dep of deps) {
            try {
              const file = await window.electronAPI.mc.getModrinthVersionFile(dep.versionId);
              if (file) await window.electronAPI.mc.downloadMod(targetVersion, file.url, file.name, 'mods');
            } catch {}
          }
        }
        setError(null); setShowInstall(false); setSelectedMod(null);
      }
      else { setError(t('error.download')); }
    } catch (e: any) { setError(e.message); }
    finally { setInstallingMod(false); }
  }

  function formatNum(n: number) {
    if (n > 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n > 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  const displayMods = sortMods(query ? results : popular);
  const currentTypeLabel = TYPES.find(x => x.id === type)?.label || '';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header: category tabs + search */}
      <div className="px-6 pt-4 pb-3 border-b border-mc-border shrink-0 space-y-3">
        <div className="flex gap-1.5">
          {TYPES.map((tp) => (
            <motion.button key={tp.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setType(tp.id); setQuery(''); setResults([]); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                type === tp.id ? 'bg-mc-accent/15 text-mc-accent-hover border border-mc-accent/30' : 'bg-mc-card/50 border border-mc-border/50 text-mc-muted hover:text-mc-text'
              }`}>
              <tp.icon size={13} /> {t(tp.label)}
            </motion.button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mc-muted" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('modBrowser.search')}
              className="w-full bg-mc-card border border-mc-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors" />
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2.5 rounded-xl bg-mc-card border border-mc-border text-xs text-mc-muted outline-none shrink-0">
            <option value="downloads">{t('market.sortDl')}</option>
            <option value="follows">{t('market.sortFollows')}</option>
            <option value="updated">{t('market.sortUpdated')}</option>
          </select>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleSearch} disabled={searching}
            className="px-4 py-2.5 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-sm font-medium transition-all disabled:opacity-50 shrink-0">
            {searching ? <Loader2 size={14} className="animate-spin" /> : t('filter.search')}
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {selectedMod ? (
          <div className="max-w-2xl mx-auto space-y-4">
            <button onClick={() => setSelectedMod(null)} className="text-xs text-mc-muted hover:text-mc-text">← {t('nav.modBrowser')}</button>
            <div className="flex gap-4">
              <img src={selectedMod.icon} alt="" className="w-20 h-20 rounded-2xl bg-mc-card border border-mc-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{selectedMod.title}</h2>
                <p className="text-xs text-mc-muted">{t('modBrowser.by')} {selectedMod.author} · {formatNum(selectedMod.downloads)} {t('modBrowser.downloads')} · {formatNum(selectedMod.follows)} {t('modBrowser.follows')}</p>
                <p className="text-sm text-mc-muted mt-2 line-clamp-3">{selectedMod.description}</p>
              </div>
            </div>

            {/* Full detail: gallery, description, license */}
            {fullDetail && (
              <div className="space-y-3">
                {fullDetail.gallery?.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {fullDetail.gallery.slice(0, 5).map((g: any) => (
                      <img key={g.url} src={g.url} alt="" className="h-28 rounded-xl object-cover shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ))}
                  </div>
                )}
                {fullDetail.body && (
                  <div className="p-4 rounded-2xl glass-strong border border-mc-border/50">
                    <p className="text-[10px] text-mc-muted uppercase tracking-widest mb-2">{t('market.description')}</p>
                    <div className="text-xs text-mc-muted leading-relaxed max-h-48 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: fullDetail.body.slice(0, 3000) }} />
                  </div>
                )}
                <div className="flex items-center gap-3 text-[10px] text-mc-muted">
                  <span className="flex items-center gap-1"><Shield size={10} />{fullDetail.license || 'Unknown'}</span>
                  <span>{new Date(fullDetail.updated || Date.now()).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1">{fullDetail.categories?.slice(0, 3).map((c: string) => <span key={c} className="px-1.5 py-0.5 rounded bg-mc-card/50 border border-mc-border/30">{c}</span>)}</span>
                </div>
              </div>
            )}
            {detailLoading && <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-mc-accent" /></div>}

            {/* Dependency tree */}
            {(depLoading || depTree) && (
              <div className="p-4 rounded-2xl glass-strong border border-mc-border/50">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><GitBranch size={12} className="text-mc-accent-hover" />{t('market.deps')}</p>
                {depLoading ? (
                  <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-mc-accent" /></div>
                ) : (
                  <div className="space-y-1 text-[11px]">
                    {depTree?.map((dep, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-2 text-mc-text">
                          <GitBranch size={10} className="text-mc-muted shrink-0" />
                          <span className="font-mono">{dep.slug || dep.projectId}</span>
                          {dep.children?.length > 0 && (
                            <span className="text-[9px] text-mc-muted">({dep.children.length} sub-dep)</span>
                          )}
                        </div>
                        {dep.children?.map((c: any, j: number) => (
                          <div key={j} className="flex items-center gap-2 pl-6 text-mc-muted">
                            <GitBranch size={9} className="shrink-0" />
                            <span className="font-mono">{c.slug || c.projectId}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 rounded-2xl glass-strong border border-mc-border/50 space-y-3">
              <p className="text-xs font-semibold">{t('mods.installTo')}</p>
              {type === 'mod' && installedList.length === 0 ? (
                <p className="text-xs text-mc-muted">{t('mods.noVersionForMod')}</p>
              ) : (
                <>
                  {type !== 'modpack' ? (
                    <>
                      <div className="flex gap-2 flex-wrap">
                        {installedList.map((v) => (
                          <motion.button key={v.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setTargetVersion(v.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                              targetVersion === v.id ? 'bg-mc-accent/20 text-mc-accent-hover border border-mc-accent/30' : 'bg-mc-card/50 border border-mc-border text-mc-muted hover:border-mc-accent/30'
                            }`}>{v.id}</motion.button>
                        ))}
                      </div>
                      {targetVersion && (
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                          onClick={handleInstallVersion} disabled={versionsLoading}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-sm font-medium transition-all disabled:opacity-50">
                          {versionsLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                          {t('mods.versions')}
                        </motion.button>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-mc-muted">{t('market.modpackHint')}</p>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={installModpack} disabled={packInstalling}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-sm font-medium transition-all disabled:opacity-50">
                        {packInstalling ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        {packInstalling ? t('loader.installing') : t('market.installPack')}
                      </motion.button>
                    </div>
                  )}

                  {showInstall && modVersions.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-mc-border/50">
                      {modVersions.map((v) => {
                        const file = v.files.find((f: any) => f.primary) || v.files[0];
                        return file ? (
                          <div key={v.id}>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-mc-card/30 border border-mc-border/30">
                              <div className="min-w-0">
                                <p className="text-xs font-mono text-mc-text">{v.name}</p>
                                <p className="text-[9px] text-mc-muted">{(v.loaders || []).join(', ')} · {Math.round(file.size / 1024)}KB · {new Date(v.date || Date.now()).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {v.changelog && (
                                  <button onClick={() => setExpandedVersion(expandedVersion === v.id ? null : v.id)}
                                    className="p-1.5 rounded-lg text-mc-muted hover:text-mc-accent-hover transition-colors"
                                    title={t('market.changelog')}>
                                    <FileText size={11} />
                                  </button>
                                )}
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                  onClick={() => doInstall(file.url, file.name, v.id)} disabled={installingMod}
                                  className="px-3 py-1.5 rounded-lg bg-mc-green/20 text-mc-green hover:bg-mc-green/30 text-[10px] font-medium transition-all disabled:opacity-40">
                                  {installingMod ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                </motion.button>
                              </div>
                            </div>
                            {expandedVersion === v.id && v.changelog && (
                              <div className="p-2.5 mt-1 rounded-xl bg-mc-card/20 border border-mc-border/20 text-[10px] text-mc-muted leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                                {v.changelog.slice(0, 1000)}
                              </div>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <a href={type === 'curseforge' ? `https://www.curseforge.com/minecraft/mc-mods/${selectedMod.slug}` : `https://modrinth.com/${type === 'mod' ? 'mod' : type === 'shader' ? 'shader' : type === 'resourcepack' ? 'resourcepack' : 'modpack'}/${selectedMod.slug}`} target="_blank"
              className="flex items-center gap-1 text-xs text-mc-accent-hover hover:underline">
              <ExternalLink size={11} /> {type === 'curseforge' ? 'View on CurseForge' : 'View on Modrinth'}
            </a>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-mc-accent" /></div>
        ) : (
          <>
            {!query && <h3 className="text-sm font-semibold mb-4">{t('modBrowser.popular')} · {t(currentTypeLabel)}</h3>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayMods.map((mod) => (
                <motion.div key={mod.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  onClick={() => openModDetail(mod)}
                  className="p-4 rounded-2xl glass-strong border border-mc-border/50 hover:border-mc-accent/25 cursor-pointer transition-all group">
                  <div className="flex gap-3">
                    <img src={mod.icon} alt="" className="w-12 h-12 rounded-xl bg-mc-card shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-mc-text truncate group-hover:text-mc-accent-hover transition-colors">{mod.title}</h4>
                      <p className="text-[10px] text-mc-muted mt-0.5">{t('modBrowser.by')} {mod.author}</p>
                      <p className="text-[10px] text-mc-muted line-clamp-2 mt-1">{mod.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[9px] text-mc-muted">
                        <span className="flex items-center gap-1"><Download size={9} />{formatNum(mod.downloads)}</span>
                        <span className="flex items-center gap-1"><Sparkles size={9} />{formatNum(mod.follows)}</span>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(mod.slug); }}
                          className={`ml-auto p-1 rounded transition-colors ${favorites.includes(mod.slug) ? 'text-mc-orange' : 'text-mc-muted hover:text-mc-orange'}`}>
                          <Star size={11} fill={favorites.includes(mod.slug) ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            {displayMods.length === 0 && !loading && (
              <div className="text-center py-12"><Package size={36} className="text-mc-border mx-auto" /><p className="text-sm text-mc-muted mt-2">{type === 'curseforge' ? t('market.curseHint') : t('versions.empty')}</p></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
