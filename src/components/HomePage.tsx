import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Package, HardDrive, TrendingUp, Clock, Lightbulb, Newspaper, ExternalLink } from 'lucide-react';
import { InstalledVersion, NewsArticle } from '../types';

interface Props {
  installedList: InstalledVersion[];
  onLaunch: (id: string) => void;
  launching: string | null;
  manifest: any;
  t: (key: string, ...args: (string | number)[]) => string;
}

export default function HomePage({ installedList, onLaunch, launching, manifest, t }: Props) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const tips = [
    t('home.tip1'), t('home.tip2'), t('home.tip3'), t('home.tip4'),
  ];
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTipIndex((i) => (i + 1) % tips.length), 5000);
    return () => clearInterval(iv);
  }, [tips.length]);

  useEffect(() => {
    window.electronAPI.mc.getMinecraftNews().then((n) => { setNews(n); setNewsLoading(false); });
  }, []);

  const latestInstalled = installedList[0];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-mc-accent/20 via-mc-surface to-purple-500/10 border border-mc-border/50 p-8"
        >
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-1">{t('home.welcome')}</h2>
            <p className="text-sm text-mc-muted">{t('home.subtitle')}</p>

            {latestInstalled ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onLaunch(latestInstalled.id)}
                className="mt-6 flex items-center gap-3 px-6 py-4 rounded-xl bg-mc-green hover:bg-mc-green/90 text-white font-semibold text-base transition-all shadow-lg shadow-mc-green/30"
              >
                <Play size={20} /> {t('home.launchLatest')} <span className="font-mono opacity-80">{latestInstalled.id}</span>
              </motion.button>
            ) : (
              <div className="mt-6">
                <p className="text-sm text-mc-muted italic">{t('home.noVersion')}</p>
              </div>
            )}
          </div>

          {/* Decorative blobs */}
          <div className="absolute top-[-60px] right-[-40px] w-48 h-48 rounded-full bg-mc-accent/10 blur-3xl" />
          <div className="absolute bottom-[-40px] left-[-20px] w-32 h-32 rounded-full bg-purple-500/10 blur-3xl" />
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Package, label: t('home.installed'), value: installedList.length, color: 'text-mc-green' },
            { icon: HardDrive, label: t('sidebar.totalVersions'), value: manifest?.versions?.length || '-', color: 'text-mc-accent-hover' },
            { icon: TrendingUp, label: t('sidebar.latestRelease'), value: manifest?.latest?.release || '-', color: 'text-mc-text' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="p-5 rounded-2xl glass-strong border border-mc-border/50 text-center"
            >
              <stat.icon size={20} className={`${stat.color} mx-auto mb-2`} />
              <p className="text-2xl font-bold font-mono">{stat.value}</p>
              <p className="text-[11px] text-mc-muted mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Quick launch + News */}
        <div className="grid grid-cols-2 gap-4">
          {/* Quick launch */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="p-5 rounded-2xl glass-strong border border-mc-border/50">
            <div className="flex items-center gap-2 mb-4"><Clock size={16} className="text-mc-accent" /><h3 className="text-sm font-semibold">{t('nav.quickLaunch')}</h3></div>
            {installedList.length > 0 ? (
              <div className="space-y-1.5">
                {installedList.slice(0, 5).map((v) => (
                  <button key={v.id} onClick={() => onLaunch(v.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-mc-accent/10 text-sm text-mc-text hover:text-mc-accent-hover transition-all group">
                    <span className="font-mono text-xs">{v.id}</span>
                    <span className="text-[10px] text-mc-muted group-hover:text-mc-accent-hover flex items-center gap-1">
                      {launching === v.id ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3 h-3 rounded-full border border-mc-accent border-t-transparent" /> : <Play size={11} />}
                    </span>
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-mc-muted italic py-2">{t('home.noVersion')}</p>}
          </motion.div>

          {/* News */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="p-5 rounded-2xl glass-strong border border-mc-border/50">
            <div className="flex items-center gap-2 mb-4"><Newspaper size={16} className="text-mc-accent-hover" /><h3 className="text-sm font-semibold">{t('news.title')}</h3></div>
            {newsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-2 rounded-xl">
                    <div className="h-3 w-3/4 rounded bg-mc-border animate-pulse mb-2" />
                    <div className="h-2 w-1/2 rounded bg-mc-border/50 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : news.length > 0 ? (
              <div className="space-y-2">
                {news.slice(0, 4).map((a) => (
                  <a key={a.id} href={a.url} target="_blank"
                    className="block p-2 rounded-xl hover:bg-mc-card/30 transition-colors group">
                    <p className="text-xs font-medium text-mc-text line-clamp-1 group-hover:text-mc-accent-hover transition-colors">{a.title}</p>
                    <p className="text-[10px] text-mc-muted mt-0.5 line-clamp-1">{a.body}</p>
                  </a>
                ))}
              </div>
            ) : <p className="text-xs text-mc-muted italic">{t('news.empty')}</p>}
          </motion.div>
        </div>

        {/* Tips */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="p-5 rounded-2xl glass-strong border border-mc-border/50">
          <div className="flex items-center gap-2 mb-3"><Lightbulb size={16} className="text-mc-orange" /><h3 className="text-sm font-semibold">{t('home.tips')}</h3></div>
          <motion.p key={tipIndex} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-mc-muted italic">{tips[tipIndex]}</motion.p>
        </motion.div>
      </div>
    </div>
  );
}
