import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { ResourcePackInfo } from '../../types';

interface Props {
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function VersionResourcePacks({ t }: Props) {
  const [packs, setPacks] = useState<ResourcePackInfo[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { window.electronAPI.mc.getResourcePacks().then(setPacks); }, []);

  async function importPacks(paths: string[]) {
    await window.electronAPI.mc.importResourcePacks(paths);
    setPacks(await window.electronAPI.mc.getResourcePacks());
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-text transition-colors">
          + {t('rp.title')}
        </button>
        <input ref={fileRef} type="file" accept=".zip" multiple className="hidden"
          onChange={e => { const files = Array.from(e.target.files || []).map(f => (f as any).path).filter(Boolean); if (files.length) importPacks(files); }} />
        <button onClick={() => window.electronAPI.mc.openResourcePacksFolder()} className="px-3 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-text transition-colors">{t('installed.openFolder')}</button>
      </div>
      {packs.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {packs.map(p => (
            <div key={p.name} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-mc-card/30 border border-mc-border/30 text-[10px] group">
              <ImageIcon size={10} className="text-mc-muted" /><span className="truncate max-w-[120px]">{p.name}</span>
              <button onClick={async () => { await window.electronAPI.mc.deleteResourcePack(p.name); setPacks(packs.filter(x => x.name !== p.name)); }}
                className="opacity-0 group-hover:opacity-100 text-mc-muted hover:text-mc-red"><Trash2 size={9} /></button>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-mc-muted italic">{t('rp.empty')}</p>}
    </div>
  );
}
