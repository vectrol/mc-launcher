import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, Copy, Trash2 } from 'lucide-react';

interface Props {
  t: (key: string) => string;
}

export default function ConsolePanel({ t }: Props) {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen for game logs
    window.electronAPI.mc.onGameLog((data: string) => {
      setLogs((prev) => {
        const lines = data.split('\n').filter((l) => l.trim());
        return [...prev, ...lines].slice(-500);
      });
      if (!visible) setVisible(true);
    });

    window.electronAPI.mc.onGameClosed(() => {
      // Keep logs visible on close
    });
  }, []);

  useEffect(() => {
    if (!collapsed) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, collapsed]);

  function copyLogs() {
    navigator.clipboard.writeText(logs.join('\n'));
  }

  return (
    <AnimatePresence>
      {visible && logs.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="border-t border-mc-border bg-mc-surface/95 backdrop-blur-xl shrink-0"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-mc-card/30 transition-colors"
            onClick={() => setCollapsed(!collapsed)}
          >
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-mc-green" />
              <span className="text-xs font-medium text-mc-text">{t('console.title')}</span>
              <span className="text-[9px] text-mc-muted font-mono">{logs.length} {t('console.lines')}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); copyLogs(); }} className="p-1 rounded hover:bg-mc-card/50 text-mc-muted" title={t('console.copy')}>
                <Copy size={11} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setLogs([]); }} className="p-1 rounded hover:bg-mc-card/50 text-mc-muted" title={t('console.clear')}>
                <Trash2 size={11} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setVisible(false); }} className="p-1 rounded hover:bg-mc-red/20 text-mc-muted hover:text-mc-red">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Log content */}
          {!collapsed && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 180 }}
              className="overflow-y-auto px-4 pb-2"
            >
              <div className="font-mono text-[11px] leading-relaxed space-y-0.5">
                {logs.map((line, i) => {
                  let cls = 'text-mc-muted';
                  if (line.includes('ERROR') || line.includes('FATAL') || line.includes('Exception') || line.includes('Caused by'))
                    cls = 'text-mc-red';
                  else if (line.includes('WARN') || line.includes('WARNING'))
                    cls = 'text-mc-orange';
                  else if (line.includes('INFO') && (line.includes('Starting') || line.includes('Loaded') || line.includes('Done')))
                    cls = 'text-mc-green';
                  return <div key={i} className={cls}>{line}</div>;
                })}
                <div ref={logEndRef} />
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
