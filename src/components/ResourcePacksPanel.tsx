import { useState, useEffect, DragEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Trash2, FileArchive, Loader2, FolderOpen, Image } from 'lucide-react';
import { ResourcePackInfo } from '../types';

interface Props {
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function ResourcePacksPanel({ t }: Props) {
  const [packs, setPacks] = useState<ResourcePackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadPacks(); }, []);

  async function loadPacks() {
    try { setLoading(true); setPacks(await window.electronAPI.mc.getResourcePacks()); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  async function importFiles(filePaths: string[]) {
    setImporting(true);
    try {
      const results = await window.electronAPI.mc.importResourcePacks(filePaths);
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) setError(`${t('error.import')} ${failed.map((f) => f.name).join(', ')}`);
      await loadPacks();
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.zip'));
    if (files.length === 0) { setError(t('rp.onlyZip')); return; }
    importFiles(files.map((f) => (f as any).path).filter(Boolean));
  }

  function handleBrowse(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    importFiles(files.map((f) => (f as any).path).filter(Boolean));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDelete(name: string) {
    await window.electronAPI.mc.deleteResourcePack(name);
    setPacks((prev) => prev.filter((p) => p.name !== name));
  }

  function formatSize(bytes: number) {
    if (!bytes) return 'N/A';
    return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-mc-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold">{t('rp.title')}</h2>
          <p className="text-xs text-mc-muted">{packs.length} {t('rp.count')}</p>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => window.electronAPI.mc.openResourcePacksFolder()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-mc-border hover:border-mc-accent/40 text-sm text-mc-muted hover:text-mc-text transition-all">
          <FolderOpen size={14} /> {t('installed.openFolder')}
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <motion.div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
          animate={{ borderColor: dragOver ? 'rgba(99,102,241,0.5)' : 'rgba(37,37,58,0.6)', backgroundColor: dragOver ? 'rgba(99,102,241,0.05)' : 'rgba(26,26,37,0.3)' }}
          className="relative border-2 border-dashed rounded-2xl p-6 mb-6 transition-all flex flex-col items-center gap-2 cursor-pointer">
          {importing ? <Loader2 size={28} className="animate-spin text-mc-accent" /> : <Upload size={28} className="text-mc-muted" />}
          <p className="text-sm text-mc-text font-medium">{dragOver ? t('mods.dropActive') : t('rp.dropHere')}</p>
          <p className="text-xs text-mc-muted">{t('mods.orBrowse')} <button onClick={() => fileInputRef.current?.click()} className="text-mc-accent-hover underline">{t('mods.browse')}</button></p>
          <input ref={fileInputRef} type="file" accept=".zip" multiple className="hidden" onChange={handleBrowse} />
        </motion.div>

        <AnimatePresence>
          {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setError(null)}
            className="mb-4 p-2 rounded-lg bg-mc-red/10 border border-mc-red/20 text-xs text-mc-red cursor-pointer">{error}</motion.div>}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-mc-accent" /></div>
        ) : packs.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2">
            <Image size={36} className="text-mc-border" />
            <p className="text-sm text-mc-muted">{t('rp.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {packs.map((p) => (
              <motion.div key={p.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl glass border border-mc-border/50 hover:border-mc-accent/20 transition-all group">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-mc-card flex items-center justify-center"><FileArchive size={18} className="text-mc-accent" /></div>
                  <p className="text-xs font-mono text-mc-text text-center truncate w-full">{p.name}</p>
                  <p className="text-[9px] text-mc-muted">{formatSize(p.size)}</p>
                  <button onClick={() => handleDelete(p.name)}
                    className="px-3 py-1 rounded-lg bg-mc-red/10 text-mc-red text-[9px] hover:bg-mc-red/20 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={10} className="inline mr-1" />{t('installed.delete')}</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
