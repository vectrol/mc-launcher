import { useState, DragEvent, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Loader2, Package, CheckCircle2 } from 'lucide-react';

interface Props {
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function ModpackImporter({ t }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [packInfo, setPackInfo] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(filePath: string) {
    try {
      setImporting(true); setError(null); setPackInfo(null); setDone(false);
      const pack = await window.electronAPI.mc.parseModpack(filePath);
      setPackInfo(pack);

      const unsub = window.electronAPI.mc.onDownloadProgress((data) => setProgress(data));
      await window.electronAPI.mc.installModpack(pack);
      setDone(true);
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const path = (file as any).path;
    if (path) handleFile(path);
    else setError('Cannot read file path');
  }

  function handleBrowse(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = (file as any).path;
    if (path) handleFile(path);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-mc-border shrink-0">
        <h2 className="text-lg font-semibold">{t('modpack.title')}</h2>
        <p className="text-xs text-mc-muted">{t('modpack.subtitle')}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto space-y-4">
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            animate={{ borderColor: dragOver ? 'rgba(99,102,241,0.5)' : 'rgba(37,37,58,0.6)', backgroundColor: dragOver ? 'rgba(99,102,241,0.05)' : 'rgba(26,26,37,0.3)' }}
            className="border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer"
          >
            {importing ? <Loader2 size={36} className="animate-spin text-mc-accent mx-auto mb-3" />
              : <Upload size={36} className="text-mc-muted mx-auto mb-3" />}
            <p className="text-sm font-medium text-mc-text">{dragOver ? t('modpack.drop') : t('modpack.dropHere')}</p>
            <p className="text-xs text-mc-muted mt-1">{t('modpack.formats')}</p>
            <label className="inline-block mt-3 px-4 py-2 rounded-xl bg-mc-accent/15 text-mc-accent-hover text-xs font-medium cursor-pointer hover:bg-mc-accent/25 transition-colors">
              {t('mods.browse')}
              <input type="file" accept=".zip,.mrpack" className="hidden" onChange={handleBrowse} />
            </label>
          </motion.div>

          {packInfo && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl glass-strong border border-mc-border/50">
              <div className="flex items-center gap-3">
                <Package size={20} className="text-mc-accent" />
                <div>
                  <p className="text-sm font-semibold">{packInfo.name}</p>
                  <p className="text-[10px] text-mc-muted">
                    MC {packInfo.mcVersion} · {packInfo.format} · {packInfo.mods?.length || 0} mods
                  </p>
                </div>
                {done && <CheckCircle2 size={18} className="text-mc-green ml-auto" />}
              </div>
            </motion.div>
          )}

          {progress && importing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2"><Loader2 size={14} className="animate-spin text-mc-accent" /><span className="text-xs text-mc-muted">{progress.message}</span></div>
              <div className="h-1.5 rounded-full bg-mc-surface overflow-hidden">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-mc-accent to-purple-500" animate={{ width: `${progress.percent}%` }} />
              </div>
              <p className="text-[9px] text-mc-muted text-right">{progress.percent}%</p>
            </div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-xl bg-mc-red/10 border border-mc-red/20 text-xs text-mc-red">{error}</motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
