import { motion } from 'framer-motion';
import { X, CheckCircle2 } from 'lucide-react';
import { DownloadProgress } from '../types';

interface Props {
  progress: DownloadProgress;
  onClose: () => void;
  t: (key: string) => string;
}

const phaseLabels: Record<string, string> = {
  client: 'download.client',
  assets: 'download.assets',
  libraries: 'download.libraries',
  fabric: 'download.fabric',
  forge: 'download.forge',
};

export default function DownloadPanel({ progress, onClose, t }: Props) {
  const isDone = progress.phase === 'done';

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="border-t border-mc-border glass-strong"
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {isDone ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-7 h-7 rounded-full bg-mc-green/20 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-mc-green" />
              </motion.div>
            ) : (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-7 h-7 rounded-full border-2 border-mc-accent border-t-transparent" />
            )}
            <div>
              <p className="text-sm font-medium text-mc-text">
                {isDone ? t('download.complete') : progress.message || t(phaseLabels[progress.phase] || '')}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-mc-muted">
                {progress.current != null && progress.total != null && (
                  <span>{progress.current} / {progress.total}</span>
                )}
                {progress.speed != null && progress.speed > 0 && (
                  <span>{formatSpeed(progress.speed)}</span>
                )}
                {progress.eta != null && progress.eta > 0 && (
                  <span>~{formatETA(progress.eta)}</span>
                )}
              </div>
            </div>
          </div>
          {isDone && (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={onClose} className="p-1.5 rounded-lg hover:bg-mc-card/50 transition-colors">
              <X size={15} className="text-mc-muted" />
            </motion.button>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-mc-surface overflow-hidden">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-mc-accent to-purple-500"
            initial={{ width: '0%' }} animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.3, ease: 'easeOut' }} />
        </div>
        <p className="text-[10px] text-mc-muted mt-2 text-right">{progress.percent}%</p>
      </div>
    </motion.div>
  );
}

function formatSpeed(bytesPerSec: number) {
  if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bytesPerSec > 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

function formatETA(seconds: number) {
  if (seconds > 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  if (seconds > 60) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.ceil(seconds)}s`;
}
