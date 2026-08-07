import { useState, useEffect, DragEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Upload, Trash2, FileArchive, Loader2 } from 'lucide-react';
import { ModInfo } from '../types';

interface Props {
  versionId: string;
  onBack: () => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function ModsPanel({ versionId, onBack, t }: Props) {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOverMods, setDragOverMods] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadMods(); }, [versionId]);

  async function loadMods() {
    try { setLoading(true); const m = await window.electronAPI.mc.getMods(versionId); setMods(m); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  async function handleDeleteMod(filename: string) {
    await window.electronAPI.mc.deleteMod(versionId, filename);
    setMods((prev) => prev.filter((m) => m.name !== filename));
  }

  function handleDragOver(e: DragEvent) { e.preventDefault(); e.stopPropagation(); setDragOverMods(true); }
  function handleDragLeave(e: DragEvent) { e.preventDefault(); e.stopPropagation(); setDragOverMods(false); }

  async function importFiles(filePaths: string[]) {
    setImporting(true);
    try {
      const results = await window.electronAPI.mc.importMods(versionId, filePaths);
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) setError(`${t('error.import')} ${failed.map((f) => f.name).join(', ')}`);
      await loadMods();
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragOverMods(false);
    const files = Array.from(e.dataTransfer.files);
    const jarFiles = files.filter((f) => f.name.endsWith('.jar'));
    if (jarFiles.length === 0) { setError(t('mods.onlyJar')); return; }
    const filePaths = jarFiles.map((f) => (f as any).path);
    if (filePaths.some((p) => !p)) { setError(t('mods.noPath')); return; }
    await importFiles(filePaths);
  }

  async function handleBrowseFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const filePaths = files.map((f) => (f as any).path).filter(Boolean);
    if (filePaths.length === 0) { setError(t('mods.noPath')); return; }
    await importFiles(filePaths);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function formatSize(bytes: number) {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-mc-border shrink-0">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onBack} className="p-2 rounded-lg hover:bg-mc-card/50 transition-colors">
          <ArrowLeft size={18} />
        </motion.button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{t('mods.title')}</h2>
          <p className="text-xs text-mc-muted">
            <span className="font-mono text-mc-accent-hover">{versionId}</span> &mdash; {mods.length} {t('installed.mods')}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onClick={() => setError(null)} className="px-6 py-2 bg-mc-red/10 border-b border-mc-red/20 text-sm text-mc-red cursor-pointer">
            {error} ({t('common.close')})
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-6">
        <motion.div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          animate={{ borderColor: dragOverMods ? 'rgba(99,102,241,0.5)' : 'rgba(37,37,58,0.6)', backgroundColor: dragOverMods ? 'rgba(99,102,241,0.05)' : 'rgba(26,26,37,0.3)', scale: dragOverMods ? 1.01 : 1 }}
          className="relative border-2 border-dashed rounded-2xl p-8 mb-6 transition-all duration-200 flex flex-col items-center gap-3 cursor-pointer">
          <motion.div animate={{ y: dragOverMods ? -4 : 0 }} transition={{ duration: 0.2 }}>
            {importing ? <Loader2 size={32} className="animate-spin text-mc-accent" /> : <Upload size={32} className="text-mc-muted" />}
          </motion.div>
          <div className="text-center">
            <p className="text-sm text-mc-text font-medium">{dragOverMods ? t('mods.dropActive') : t('mods.dropHere')}</p>
            <p className="text-xs text-mc-muted mt-1">
              {t('mods.orBrowse')} <button onClick={() => fileInputRef.current?.click()} className="text-mc-accent-hover underline underline-offset-2 mx-1">{t('mods.browse')}</button> {t('mods.addMods')}
            </p>
          </div>
          <input ref={fileInputRef} type="file" accept=".jar" multiple className="hidden" onChange={handleBrowseFiles} />
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-mc-accent" /></div>
        ) : mods.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2">
            <FileArchive size={36} className="text-mc-border" />
            <p className="text-sm text-mc-muted">{t('mods.empty')}</p>
            <p className="text-xs text-mc-muted">{t('mods.emptyHint')}</p>
          </div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }} className="space-y-1.5">
            {mods.map((mod) => (
              <motion.div key={mod.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 rounded-xl glass border border-mc-border/50 hover:border-mc-accent/20 transition-all duration-200 group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-mc-accent/10 flex items-center justify-center"><FileArchive size={14} className="text-mc-accent" /></div>
                  <div>
                    <p className="text-sm font-mono text-mc-text truncate max-w-[300px]">{mod.name}</p>
                    <p className="text-[10px] text-mc-muted">{formatSize(mod.size)}</p>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDeleteMod(mod.name)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-mc-red/15 text-mc-muted hover:text-mc-red transition-all duration-200">
                  <Trash2 size={14} />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
