import { useState, useEffect, useRef, DragEvent } from 'react';
import { motion } from 'framer-motion';
import { Download, Loader2, Power, Trash2, RefreshCw, Star, CheckSquare, X, AlertTriangle, ArrowRight } from 'lucide-react';
import { ModInfo } from '../../types';

interface Props {
  versionId: string;
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function VersionMods({ versionId, t }: Props) {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<{ base: string; files: string[] }[]>([]);
  const [checking, setChecking] = useState(false);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResult, setBatchResult] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.electronAPI.mc.getMods(versionId).then(setMods).catch(() => {});
    window.electronAPI.mc.detectModConflicts(versionId).then(setConflicts).catch(() => {});
  }, [versionId]);

  function toggleSelect(name: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  async function batchAction(action: 'disable' | 'enable' | 'delete') {
    for (const name of selected) {
      try {
        if (action === 'delete') await window.electronAPI.mc.deleteMod(versionId, name);
        else await window.electronAPI.mc.toggleMod(versionId, name);
      } catch {}
    }
    setSelected(new Set());
    setMods(await window.electronAPI.mc.getMods(versionId));
  }

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

  async function batchUpdate() {
    setBatchUpdating(true); setBatchProgress(0);
    try {
      const r = await window.electronAPI.mc.updateAllMods(versionId);
      setMods(await window.electronAPI.mc.getMods(versionId));
      setUpdates(await window.electronAPI.mc.checkModsForUpdates(versionId));
      setBatchResult(r.updated);
    } catch {}
    setBatchUpdating(false);
  }

  function handleDrop(e: DragEvent) { e.preventDefault(); setDragOver(false); const jars = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.jar')); if (jars.length) importFiles(jars.map(f => (f as any).path).filter(Boolean)); }
  function handleBrowse(e: React.ChangeEvent<HTMLInputElement>) { const files = Array.from(e.target.files || []); if (files.length) importFiles(files.map(f => (f as any).path).filter(Boolean)); if (fileRef.current) fileRef.current.value = ''; }

  return (
    <div className="space-y-2">
      {/* Update check button + conflict warnings */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <button onClick={checkUpdates} disabled={checking || batchUpdating}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-accent-hover transition-all disabled:opacity-40">
            {checking ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            {t('mods.checkUpdates')}
          </button>
          {updates.filter(u => u.hasUpdate).length > 0 && (
            <button onClick={batchUpdate} disabled={batchUpdating}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-mc-orange/15 border border-mc-orange/30 text-[10px] text-mc-orange hover:bg-mc-orange/25 transition-all disabled:opacity-40">
              {batchUpdating ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
              {batchUpdating ? `${batchProgress}%` : t('mods.updateAll')}
            </button>
          )}
        </div>
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
            <p key={c.base} className="truncate flex items-center gap-1"><AlertTriangle size={10} className="shrink-0" />{c.files.join(', ')}</p>
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

      {batchResult != null && batchResult > 0 && (
        <div className="p-2 rounded-xl bg-mc-green/10 border border-mc-green/25 text-[10px] text-mc-green">
          {t('mods.updatedOk', batchResult)} — {t('mods.backupNote')}
        </div>
      )}

      {/* Updateable mods */}
      {updates.filter(u => u.hasUpdate).length > 0 && (
        <div className="space-y-1">
          {updates.filter(u => u.hasUpdate).map(u => (
            <div key={u.fileName} className="flex items-center justify-between p-2 rounded-xl bg-mc-orange/10 border border-mc-orange/25 text-xs">
              <div className="min-w-0">
                <p className="font-mono text-[10px] text-mc-text truncate">{u.name}</p>
                <p className="text-[9px] text-mc-muted flex items-center gap-1">{u.localVersion} <ArrowRight size={8} /> <span className="text-mc-orange">{u.latestVersion}</span></p>
              </div>
              <button onClick={() => updateMod(u)} className="px-2 py-1 rounded-lg bg-mc-orange/20 text-mc-orange text-[9px] hover:bg-mc-orange/30 transition-colors shrink-0">
                <Download size={9} className="inline mr-0.5" />{t('mods.update')}
              </button>
            </div>
          ))}
        </div>
      )}

      {mods.map(m => (
        <div key={m.fileName} onClick={() => toggleSelect(m.fileName)}
          className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
            selected.has(m.fileName) ? 'bg-mc-accent/15 border-mc-accent/40'
              : m.disabled ? 'bg-mc-card/10 border-mc-border/20 opacity-50' : 'bg-mc-card/30 border-mc-border/30'
          }`}>
          <div className="flex items-center gap-2 min-w-0">
            <input type="checkbox" checked={selected.has(m.fileName)} onChange={() => toggleSelect(m.fileName)}
              className="accent-mc-accent shrink-0" />
            <span className="font-mono truncate">{m.name}{m.disabled && ' (off)'}</span>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); toggleSelect(m.fileName); }}
              className={`p-1 rounded transition-colors ${selected.has(m.fileName) ? 'text-mc-accent-hover bg-mc-accent/10' : 'text-mc-muted'}`}>
              <CheckSquare size={10} />
            </button>
            <button onClick={async (e) => { e.stopPropagation(); await window.electronAPI.mc.toggleMod(versionId, m.fileName); setMods(await window.electronAPI.mc.getMods(versionId)); }}
              className={`p-1 rounded transition-colors ${m.disabled ? 'text-mc-green hover:bg-mc-green/10' : 'text-mc-orange hover:bg-mc-orange/10'}`}
              title={m.disabled ? t('mods.enable') : t('mods.disable')}>
              <Power size={10} />
            </button>
            <button onClick={async (e) => { e.stopPropagation(); await window.electronAPI.mc.deleteMod(versionId, m.fileName); setMods(mods.filter(x => x.fileName !== m.fileName)); }}
              className="p-1 rounded hover:bg-mc-red/10 text-mc-muted hover:text-mc-red"><Trash2 size={10} /></button>
          </div>
        </div>
      ))}
      {mods.length === 0 && <p className="text-xs text-mc-muted py-2 italic">{t('mods.empty')}</p>}

      {/* Batch operations bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-mc-accent/10 border border-mc-accent/25 text-[10px]">
          <span className="text-mc-accent-hover font-medium">{selected.size} {t('mods.selected')}</span>
          <div className="flex-1" />
          <button onClick={() => batchAction('disable')} className="px-2 py-1 rounded-lg bg-mc-orange/15 text-mc-orange hover:bg-mc-orange/25 transition-colors">{t('mods.disable')}</button>
          <button onClick={() => batchAction('enable')} className="px-2 py-1 rounded-lg bg-mc-green/15 text-mc-green hover:bg-mc-green/25 transition-colors">{t('mods.enable')}</button>
          <button onClick={() => batchAction('delete')} className="px-2 py-1 rounded-lg bg-mc-red/15 text-mc-red hover:bg-mc-red/25 transition-colors">{t('mods.delete')}</button>
          <button onClick={() => setSelected(new Set())} className="p-1 text-mc-muted hover:text-mc-text"><X size={11} /></button>
        </div>
      )}
    </div>
  );
}
