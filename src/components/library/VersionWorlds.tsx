import { useState, useEffect } from 'react';
import { HardDrive } from 'lucide-react';
import { WorldInfo } from '../../types';

interface Props {
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function VersionWorlds({ t }: Props) {
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [icons, setIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    window.electronAPI.mc.getWorlds().then(async (w) => {
      setWorlds(w);
      for (const world of w) {
        if (world.icon) { const icon = await window.electronAPI.mc.getWorldIcon(world.name); if (icon) setIcons(prev => ({ ...prev, [world.name]: icon })); }
      }
    });
  }, []);

  if (worlds.length === 0) return <p className="text-xs text-mc-muted py-2 italic">{t('worlds.empty')}</p>;

  return (
    <div className="grid grid-cols-3 gap-2">
      {worlds.map(w => (
        <div key={w.name} className="p-3 rounded-xl bg-mc-card/30 border border-mc-border/30 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-mc-card overflow-hidden shrink-0">{icons[w.name] ? <img src={icons[w.name]} alt="" className="w-full h-full object-cover" /> : <HardDrive size={12} className="text-mc-muted m-2" />}</div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-mc-text truncate">{w.name}</p>
            <p className="text-[8px] text-mc-muted">{new Date(w.lastPlayed).toLocaleDateString()}</p>
          </div>
          <button onClick={async () => { await window.electronAPI.mc.backupWorld(w.name); }}
            className="p-1 rounded hover:bg-mc-accent/10 text-mc-muted text-[8px] ml-auto shrink-0">{t('worlds.backup')}</button>
        </div>
      ))}
    </div>
  );
}
