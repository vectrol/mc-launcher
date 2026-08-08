import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, X } from 'lucide-react';

interface Props { t: (key: string) => string; }

export default function GameMonitor({ t }: Props) {
  const [fps, setFps] = useState<number | null>(null);
  const [mem, setMem] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const unsub = window.electronAPI.mc.onGameStats((data) => {
      if (data.type === 'fps') setFps(data.value);
      if (data.type === 'memory') setMem(data.value);
    });
    return () => { (unsub as any)?.(); };
  }, []);

  const active = fps != null || mem != null;
  if (!active || !visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-10 right-3 z-[85] flex items-center gap-3 px-3 py-2 rounded-xl glass-strong border border-mc-border shadow-lg"
    >
      <Activity size={13} className="text-mc-accent" />
      {fps != null && (
        <span className="text-[11px] font-mono">
          <span className="text-mc-green font-bold">{fps}</span>
          <span className="text-mc-muted ml-0.5">FPS</span>
        </span>
      )}
      {mem != null && (
        <span className="text-[11px] font-mono">
          <span className="text-mc-accent-hover font-bold">{mem}</span>
          <span className="text-mc-muted ml-0.5">MB</span>
        </span>
      )}
      <button onClick={() => setVisible(false)} className="p-0.5 rounded hover:bg-mc-card/50 text-mc-muted hover:text-mc-red"><X size={11} /></button>
    </motion.div>
  );
}
