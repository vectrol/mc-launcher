import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, FolderOpen, Loader2, Image as ImageIcon } from 'lucide-react';
import { ScreenshotInfo } from '../types';

interface Props {
  t: (key: string) => string;
}

export default function ScreenshotsPanel({ t }: Props) {
  const [shots, setShots] = useState<ScreenshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ScreenshotInfo | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    try { setLoading(true); setShots(await window.electronAPI.mc.getScreenshots()); }
    catch {} finally { setLoading(false); }
  }

  async function loadImage(name: string) {
    if (images[name]) return;
    const b64 = await window.electronAPI.mc.getScreenshotBase64(name);
    if (b64) setImages(prev => ({ ...prev, [name]: b64 }));
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-mc-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold">{t('shots.title')}</h2>
          <p className="text-xs text-mc-muted">{shots.length} {t('shots.count')}</p>
        </div>
        <button onClick={() => window.electronAPI.mc.openScreenshotsFolder()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-mc-border hover:border-mc-accent/40 text-sm text-mc-muted hover:text-mc-text transition-all">
          <FolderOpen size={14} /> {t('installed.openFolder')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-mc-accent" /></div>
        ) : shots.length === 0 ? (
          <div className="text-center py-16"><ImageIcon size={48} className="text-mc-border mx-auto" /><p className="text-sm text-mc-muted mt-3">{t('shots.empty')}</p></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {shots.map(s => (
              <motion.div key={s.name} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-xl overflow-hidden border border-mc-border/50 group cursor-pointer" onClick={() => { setPreview(s); loadImage(s.name); }}>
                {images[s.name] ? (
                  <img src={images[s.name]} alt={s.name} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-mc-card flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-mc-muted" />
                  </div>
                )}
                {!images[s.name] && <div className="absolute inset-0" onMouseEnter={() => loadImage(s.name)} />}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); window.electronAPI.mc.deleteScreenshot(s.name); setShots(shots.filter(x => x.name !== s.name)); }}
                    className="p-2 rounded-lg bg-mc-red/20 text-mc-red hover:bg-mc-red/30 transition-colors"><Trash2 size={14} /></button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-8" onClick={() => setPreview(null)}>
          {images[preview.name] ? (
            <img src={images[preview.name]} className="max-w-full max-h-full rounded-xl" />
          ) : (
            <Loader2 size={28} className="animate-spin text-mc-accent" />
          )}
        </div>
      )}
    </div>
  );
}
