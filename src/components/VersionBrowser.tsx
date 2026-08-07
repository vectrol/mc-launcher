import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, Sparkles, Wrench, Archive, Package } from 'lucide-react';
import VersionCard from './VersionCard';
import { VersionInfo, VersionManifest, DownloadProgress } from '../types';

interface Props {
  manifest: VersionManifest | null;
  loading: boolean;
  downloading: string | null;
  launching: string | null;
  installedVersions: Set<string>;
  downloadProgress: DownloadProgress | null;
  onInstall: (versionId: string, variant: 'vanilla' | 'fabric' | 'forge' | 'optifine' | 'neoforge' | 'quilt', loaderVersion?: string) => Promise<void>;
  onLaunch: (versionId: string) => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function VersionBrowser({
  manifest, loading, downloading, launching, installedVersions,
  downloadProgress, onInstall, onLaunch, t,
}: Props) {
  const [search, setSearch] = useState('');
  const [sections, setSections] = useState<Record<string, boolean>>({
    releases: true,
    snapshots: false,
    old: false,
  });

  if (!manifest) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2 border-mc-accent border-t-transparent" />
      </div>
    );
  }

  // Categorize versions
  const latestReleaseId = manifest.latest.release;
  const latestSnapshotId = manifest.latest.snapshot;

  const releases = manifest.versions.filter((v) => v.type === 'release');
  const snapshots = manifest.versions.filter((v) => v.type === 'snapshot');
  const oldBetas = manifest.versions.filter((v) => v.type === 'old_beta' || v.type === 'old_alpha');

  // Apply search filter
  const filterFn = (v: VersionInfo) => {
    if (!search) return true;
    return v.id.toLowerCase().includes(search.toLowerCase());
  };

  const filteredReleases = releases.filter(filterFn).slice(0, 50);
  const filteredSnapshots = snapshots.filter(filterFn).slice(0, 30);
  const filteredOld = oldBetas.filter(filterFn).slice(0, 30);

  function toggleSection(s: string) {
    setSections((prev) => ({ ...prev, [s]: !prev[s] }));
  }

  const sectionsDef = [
    { key: 'releases', icon: Sparkles, label: t('filter.releases'), items: filteredReleases, color: 'text-mc-green' },
    { key: 'snapshots', icon: Wrench, label: t('filter.snapshots'), items: filteredSnapshots, color: 'text-mc-orange' },
    { key: 'old', icon: Archive, label: t('versions.old'), items: filteredOld, color: 'text-mc-muted' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search bar */}
      <div className="px-6 py-4 border-b border-mc-border shrink-0 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mc-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filter.search')}
            className="w-full bg-mc-card border border-mc-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors" />
        </div>
        <ModpackDrop t={t} />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {sectionsDef.map((section) => (
          <div key={section.key}>
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center gap-2 mb-3 group"
            >
              <motion.div animate={{ rotate: sections[section.key] ? 0 : -90 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={14} className="text-mc-muted" />
              </motion.div>
              <section.icon size={16} className={section.color} />
              <h3 className="text-sm font-semibold text-mc-text">{section.label}</h3>
              <span className="text-[10px] text-mc-muted ml-1">({section.items.length})</span>
            </button>

            <AnimatePresence>
              {sections[section.key] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  {section.items.length > 0 ? (
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
                      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
                    >
                      {section.items.map((v, i) => (
                        <VersionCard
                          key={v.id}
                          version={v}
                          index={i}
                          isDownloading={downloading === v.id}
                          isLaunching={launching === v.id}
                          isInstalled={installedVersions.has(v.id)}
                          onInstall={onInstall}
                          onLaunch={() => onLaunch(v.id)}
                          t={t}
                          progress={downloadProgress}
                          activeId={downloading}
                        />
                      ))}
                    </motion.div>
                  ) : (
                    <p className="text-sm text-mc-muted py-3 italic">{t('versions.empty')}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModpackDrop({ t }: { t: (key: string) => string }) {
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(path: string) {
    try {
      const pack = await window.electronAPI.mc.parseModpack(path);
      await window.electronAPI.mc.installModpack(pack);
    } catch {}
  }

  return (
    <div className="relative shrink-0">
      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
        onClick={() => ref.current?.click()}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-mc-border hover:border-mc-accent/40 text-xs text-mc-muted hover:text-mc-text transition-all"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile((f as any).path); }}
      >
        <Package size={13} className={dragOver ? 'text-mc-accent' : ''} />
        {t('modpack.title')}
      </motion.button>
      <input ref={ref} type="file" accept=".zip,.mrpack" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile((f as any).path); }} />
    </div>
  );
}
