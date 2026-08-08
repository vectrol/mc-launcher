import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface Props {
  crash: any;
  onClose: () => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function CrashDetailModal({ crash, onClose, t }: Props) {
  const [copied, setCopied] = useState(false);

  if (!crash) return null;

  function copyFull() {
    navigator.clipboard.writeText(crash.full || JSON.stringify(crash, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl glass-strong border border-mc-border shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-mc-border shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-mc-red" />
            <h3 className="text-sm font-semibold">{t('crash.title')}</h3>
            <span className="text-[10px] text-mc-muted font-mono">{crash.file}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={copyFull} className="p-1.5 rounded-lg hover:bg-mc-card/50 text-mc-muted hover:text-mc-text">
              {copied ? <Check size={13} className="text-mc-green" /> : <Copy size={13} />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-mc-card/50 text-mc-muted hover:text-mc-red"><X size={14} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="p-3 rounded-xl bg-mc-red/10 border border-mc-red/20">
            <p className="text-[10px] text-mc-muted uppercase">{t('crash.time')}</p>
            <p className="text-xs text-mc-text">{crash.time || crash.date}</p>
            <p className="text-[10px] text-mc-muted uppercase mt-2">{t('crash.desc')}</p>
            <p className="text-xs text-mc-red">{crash.description}</p>
          </div>

          {crash.detectedIssues?.length > 0 && (
            <div className="p-3 rounded-xl bg-mc-amber/10 border border-mc-amber/20">
              <p className="text-[10px] text-mc-muted uppercase mb-1">{t('crash.suggestions')}</p>
              {crash.detectedIssues.map((issue: string, i: number) => (
                <div key={i} className="flex items-start gap-1.5 py-0.5">
                  <span className="text-[9px] text-mc-amber mt-0.5">&#9679;</span>
                  <p className="text-[11px] text-mc-text">{issue}</p>
                </div>
              ))}
            </div>
          )}

          {crash.stacktrace && (
            <div>
              <p className="text-[10px] text-mc-muted uppercase mb-1">{t('crash.stack')}</p>
              <pre className="p-3 rounded-xl bg-mc-surface border border-mc-border text-[10px] text-mc-orange font-mono whitespace-pre-wrap max-h-52 overflow-y-auto">{crash.stacktrace}</pre>
            </div>
          )}

          {crash.system && (
            <div>
              <p className="text-[10px] text-mc-muted uppercase mb-1">{t('crash.system')}</p>
              <pre className="p-3 rounded-xl bg-mc-surface border border-mc-border text-[9px] text-mc-muted font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">{crash.system}</pre>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
