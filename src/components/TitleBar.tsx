import { useState, useEffect } from 'react';
import { Minus, X, Maximize2, Minimize2 } from 'lucide-react';

interface Props {
  t: (key: string) => string;
}

export default function TitleBar(_: Props) {
  const [isMaxed, setIsMaxed] = useState(false);

  useEffect(() => {
    window.electronAPI.window.isMaximized().then(setIsMaxed);
  }, []);

  async function handleMax() {
    await window.electronAPI.window.maximize();
    setIsMaxed(!isMaxed);
  }

  return (
    <header className="drag-region h-9 flex items-center justify-between bg-mc-surface border-b border-mc-border select-none shrink-0">
      <div className="flex items-center gap-2 px-3 no-drag">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-mc-red/80" />
          <div className="w-3 h-3 rounded-full bg-mc-orange/80" />
          <div className="w-3 h-3 rounded-full bg-mc-green/80" />
        </div>
        <span className="text-[11px] text-mc-muted ml-2 font-medium tracking-wide">MC Launcher</span>
      </div>
      <div className="flex no-drag">
        <button onClick={() => window.electronAPI.window.minimize()} className="w-10 h-9 flex items-center justify-center hover:bg-mc-card/50 transition-colors">
          <Minus size={14} className="text-mc-muted" />
        </button>
        <button onClick={handleMax} className="w-10 h-9 flex items-center justify-center hover:bg-mc-card/50 transition-colors">
          {isMaxed ? <Minimize2 size={12} className="text-mc-muted" /> : <Maximize2 size={12} className="text-mc-muted" />}
        </button>
        <button onClick={() => window.electronAPI.window.close()} className="w-10 h-9 flex items-center justify-center hover:bg-mc-red/20 transition-colors">
          <X size={14} className="text-mc-muted hover:text-mc-red transition-colors" />
        </button>
      </div>
    </header>
  );
}
