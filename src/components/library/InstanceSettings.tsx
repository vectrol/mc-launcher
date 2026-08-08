import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  versionId: string;
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function InstanceSettings({ versionId, t }: Props) {
  const [inst, setInst] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      window.electronAPI.mc.getInstanceSettings(versionId),
      window.electronAPI.mc.getCustomGameDirs(),
    ]).then(([s, dirs]) => {
      setInst({ ...s, gameDir: (dirs || {})[versionId] || '' });
      setLoaded(true);
    });
  }, [versionId]);

  async function save(patch: any) {
    if (patch.gameDir !== undefined) {
      await window.electronAPI.mc.setCustomGameDir(versionId, patch.gameDir || '');
      const r = await window.electronAPI.mc.getInstanceSettings(versionId);
      setInst(r);
      return;
    }
    const r = await window.electronAPI.mc.setInstanceSettings(versionId, patch);
    setInst(r);
  }

  if (!loaded) return <Loader2 size={16} className="animate-spin text-mc-accent mx-auto" />;

  return (
    <div className="grid grid-cols-2 gap-3 max-w-md">
      <div>
        <label className="text-[9px] text-mc-muted uppercase block mb-1">{t('settings.javaPath')}</label>
        <input type="text" value={inst.javaPath || ''} onChange={(e) => save({ javaPath: e.target.value })}
          placeholder={t('settings.javaPathHint')} className="w-full bg-mc-card/50 border border-mc-border/40 rounded-lg px-2 py-1.5 text-[11px] text-mc-text outline-none focus:border-mc-accent/40 font-mono" />
      </div>
      <div>
        <label className="text-[9px] text-mc-muted uppercase block mb-1">{t('settings.maxMemory')} (MB)</label>
        <input type="number" value={inst.maxMemory || ''} onChange={(e) => save({ maxMemory: e.target.value })}
          className="w-full bg-mc-card/50 border border-mc-border/40 rounded-lg px-2 py-1.5 text-[11px] text-mc-text outline-none focus:border-mc-accent/40 font-mono" />
      </div>
      <div className="col-span-2">
        <label className="flex items-center gap-2 cursor-pointer" onClick={() => save({ autoMemory: !inst.autoMemory })}>
          <div className={`w-8 h-4 rounded-full transition-all relative ${inst.autoMemory ? 'bg-mc-green' : 'bg-mc-border'}`}>
            <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${inst.autoMemory ? 'left-4' : 'left-0.5'}`} />
          </div>
          <span className="text-[11px] text-mc-muted">{t('settings.autoMemory')}</span>
        </label>
      </div>
      <div className="col-span-2">
        <label className="text-[9px] text-mc-muted uppercase block mb-1">{t('settings.gameDir')}</label>
        <div className="flex gap-1.5">
          <input type="text" value={inst.gameDir || ''} onChange={(e) => save({ gameDir: e.target.value })}
            placeholder={t('settings.gameDirHint')} className="flex-1 bg-mc-card/50 border border-mc-border/40 rounded-lg px-2 py-1.5 text-[11px] text-mc-text outline-none focus:border-mc-accent/40 font-mono" />
          <button onClick={async () => {
            const dir = await window.electronAPI.mc.pickDirectory();
            if (dir) { await window.electronAPI.mc.setCustomGameDir(versionId, dir); const s = await window.electronAPI.mc.getInstanceSettings(versionId); setInst(s); }
          }} className="px-2.5 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border/40 text-[10px] text-mc-muted hover:text-mc-text transition-colors shrink-0">{t('settings.detect')}</button>
        </div>
      </div>
    </div>
  );
}
