import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownCircle, Pause, Play, X, Loader2, Check } from 'lucide-react';
import { DownloadQueueTask } from '../types';

interface Props { t: (key: string) => string; }

export default function DownloadQueuePanel({ t }: Props) {
  const [tasks, setTasks] = useState<DownloadQueueTask[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const iv = setInterval(async () => {
      setTasks(await window.electronAPI.mc.downloadQueueGet());
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const active = tasks.filter(t => t.status === 'downloading' || t.status === 'queued');

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 px-4 py-2.5 rounded-xl glass-strong border border-mc-border shadow-xl hover:border-mc-accent/40 transition-all">
        <ArrowDownCircle size={16} className={active.length > 0 ? 'text-mc-accent' : 'text-mc-muted'} />
        <span className="text-xs font-medium">{t('downloadQueue.title')}</span>
        {active.length > 0 && <span className="min-w-[18px] h-[18px] rounded-full bg-mc-accent text-white text-[9px] font-bold flex items-center justify-center px-1">{active.length}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-16 right-4 z-[70] w-80 max-h-96 overflow-y-auto rounded-2xl glass-strong border border-mc-border shadow-2xl">
            <div className="px-4 py-3 border-b border-mc-border/50 flex items-center justify-between">
              <span className="text-sm font-semibold">{t('downloadQueue.title')}</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-mc-card/50"><X size={12} className="text-mc-muted" /></button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-mc-muted p-4">{t('downloadQueue.empty')}</p>
            ) : (
              <div className="p-2 space-y-1.5">
                {tasks.map(task => (
                  <div key={task.id} className="p-2.5 rounded-xl bg-mc-card/30 border border-mc-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-mc-text truncate max-w-[180px]">{task.name}</span>
                      <div className="flex gap-0.5">
                        {task.status === 'downloading' && (
                          <button onClick={() => window.electronAPI.mc.downloadQueuePause(task.id)} className="p-1 rounded hover:bg-mc-card/50 text-mc-muted"><Pause size={10} /></button>
                        )}
                        {(task.status === 'paused' || task.status === 'error') && (
                          <button onClick={() => window.electronAPI.mc.downloadQueueResume(task.id)} className="p-1 rounded hover:bg-mc-card/50 text-mc-green"><Play size={10} /></button>
                        )}
                        <button onClick={() => window.electronAPI.mc.downloadQueueCancel(task.id)} className="p-1 rounded hover:bg-mc-card/50 text-mc-muted"><X size={10} /></button>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-mc-surface overflow-hidden">
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-mc-accent to-purple-500"
                        animate={{ width: `${task.percent}%` }} transition={{ duration: 0.3 }} />
                    </div>
                    <div className="flex justify-between mt-1 text-[8px] text-mc-muted">
                      <span className="flex items-center gap-1">{task.status === 'done' ? <Check size={8} className="text-mc-green" /> : task.status === 'error' ? task.error?.slice(0, 20) : task.status}</span>
                      <span>{task.speed ? formatSpeed(task.speed) : `${task.percent}%`}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function formatSpeed(bps: number) {
  if (!bps) return '';
  if (bps > 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${Math.round(bps)} B/s`;
}
