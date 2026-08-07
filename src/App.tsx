import { useState, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Globe, Library, Settings, Menu, X, RefreshCw, Play, ChevronRight, ShoppingBag, Globe2, Camera, Users } from 'lucide-react';
import TitleBar from './components/TitleBar';
import DownloadPanel from './components/DownloadPanel';
import HomePage from './components/HomePage';
import VersionBrowser from './components/VersionBrowser';
import LibraryPage from './components/LibraryPage';
import AccountPanel from './components/AccountPanel';
import ConsolePanel from './components/ConsolePanel';
import ModBrowser from './components/ModBrowser';
import ServerList from './components/ServerList';
import SplashOverlay from './components/SplashOverlay';
import DownloadQueuePanel from './components/DownloadQueuePanel';
import FriendPanel from './components/FriendPanel';
import { ToastProvider, useToast } from './components/Toast';
import { VersionManifest, DownloadProgress, InstalledVersion, AccountInfo } from './types';
import { translations, Lang, formatT } from './i18n';

// Lazy-loaded pages
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const ScreenshotsPanel = lazy(() => import('./components/ScreenshotsPanel'));

type Page = 'home' | 'versions' | 'library' | 'modBrowser' | 'servers' | 'friends' | 'screenshots' | 'settings';

export default function App() {
  return (
    <ToastProvider>
      <LauncherApp />
    </ToastProvider>
  );
}

function LauncherApp() {
  const { toast } = useToast();
  const [manifest, setManifest] = useState<VersionManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [installedVersions, setInstalledVersions] = useState<Set<string>>(new Set());
  const [installedList, setInstalledList] = useState<InstalledVersion[]>([]);
  const [launching, setLaunching] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);
  const [activePage, setActivePage] = useState<Page>('home');
  const [lang, setLang] = useState<Lang>('zh-CN');
  const [splashVisible, setSplashVisible] = useState(false);
  const [splashVersion, setSplashVersion] = useState('');

  const t = (key: string, ...args: (string | number)[]) => {
    const dict = translations[lang] || translations['zh-CN'];
    const val = dict[key] ?? translations['en-US'][key] ?? key;
    if (args.length > 0) return formatT(val, ...args);
    return val;
  };

  useEffect(() => {
    loadManifest();
    refreshInstalled();
    loadSettings();
    const unsub = window.electronAPI.mc.onDownloadProgress((data: DownloadProgress) => {
      setDownloadProgress(data);
    });
    // Hide splash on first game log (game started)
    const unsubLog = window.electronAPI.mc.onGameLog(() => {
      setSplashVisible(false);
    });
    // Keyboard shortcuts
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') { setActivePage('home'); e.preventDefault(); }
        if (e.key === '2') { setActivePage('versions'); e.preventDefault(); }
        if (e.key === '3') { setActivePage('library'); e.preventDefault(); }
        if (e.key === '4') { setActivePage('modBrowser'); e.preventDefault(); }
        if (e.key === '5') { setActivePage('servers'); e.preventDefault(); }
        if (e.key === 'r') { refreshInstalled(); e.preventDefault(); }
        if (e.key === 'b') { setSidebarOpen(p => !p); e.preventDefault(); }
      }
      if (e.key === 'Escape') setError(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); unsub; unsubLog; };
  }, []);

  useEffect(() => {
    // Check for new Minecraft version on startup
    window.electronAPI.mc.checkNewVersion().then((r) => {
      if (r.hasNew) toast(t('notify.newVersion', r.latest), 'warning');
    }).catch(() => {});
  }, []);

  async function loadSettings() {
    try {
      const s = await window.electronAPI.mc.getSettings();
      setLang(s.language || 'zh-CN');
      document.documentElement.setAttribute('data-theme', s.theme || 'dark');
    } catch {}
  }

  async function loadManifest() {
    try { setLoading(true); setError(null); setManifest(await window.electronAPI.mc.getManifest()); }
    catch { setError(t('error.manifest')); }
    finally { setLoading(false); }
  }

  async function refreshInstalled() {
    try {
      const list = await window.electronAPI.mc.getInstalledVersions();
      setInstalledList(list);
      setInstalledVersions(new Set(list.map((v) => v.id)));
    } catch {}
  }

  async function handleInstall(versionId: string, variant: 'vanilla' | 'fabric' | 'forge' | 'optifine' | 'neoforge' | 'quilt', loaderVersion?: string) {
    try {
      setDownloading(versionId);
      setDownloadProgress(null);
      setShowDownloadPanel(true);
      await window.electronAPI.mc.downloadVersion(versionId);
      if (variant !== 'vanilla' && loaderVersion) {
        if (variant === 'fabric') await window.electronAPI.mc.installFabric(versionId, loaderVersion);
        else if (variant === 'forge') await window.electronAPI.mc.installForge(versionId, loaderVersion);
        else if (variant === 'optifine') await window.electronAPI.mc.installOptiFine(versionId, loaderVersion);
        else if (variant === 'neoforge') await window.electronAPI.mc.installNeoForge(versionId, loaderVersion);
        else if (variant === 'quilt') await window.electronAPI.mc.installQuilt(versionId, loaderVersion);
      }
      await refreshInstalled();
    } catch (e: any) {
      setError(e.message || t('error.download'));
    } finally {
      setDownloading(null);
    }
  }

  async function handleLaunch(versionId: string) {
    try {
      setLaunching(versionId);
      setError(null);
      setSplashVersion(versionId);
      setSplashVisible(true);

      // Pre-launch validation
      const validation = await window.electronAPI.mc.validateLaunch(versionId);
      if (!validation.java.valid) {
        setSplashVisible(false);
        toast(validation.java.error || 'Java not found', 'error');
        return;
      }
      if (!validation.version.valid) {
        setSplashVisible(false);
        toast(validation.version.error || 'Version incomplete', 'error');
        return;
      }
      if (!validation.disk.valid) {
        toast(validation.disk.error || 'Low disk space', 'warning');
      }

      await window.electronAPI.mc.launch(versionId);
      setSplashVisible(false);

      // Check for crash reports after game closes
      const crashes = await window.electronAPI.mc.checkCrashReports();
      if (crashes.length > 0) {
        const latest = crashes[0];
        const suggestion = await window.electronAPI.mc.getCrashSuggestion(latest);
        toast(t('notify.crash', latest.description, suggestion), 'error');
      }
    } catch (e: any) {
      setSplashVisible(false);
      setError(e.message || t('error.launch'));
    } finally {
      setLaunching(null);
    }
  }

  const navItems: { id: Page; label: string; icon: any }[] = [
    { id: 'home', label: t('nav.home'), icon: Home },
    { id: 'versions', label: t('nav.versions'), icon: Globe },
    { id: 'library', label: t('library.title'), icon: Library },
    { id: 'modBrowser', label: t('nav.modBrowser'), icon: ShoppingBag },
    { id: 'servers', label: t('servers.title'), icon: Globe2 },
    { id: 'friends', label: t('friends.title'), icon: Users },
    { id: 'screenshots', label: t('shots.title'), icon: Camera },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <div className="h-screen flex flex-col bg-mc-bg overflow-hidden">
      <TitleBar t={t} />

      <div className="flex-1 flex overflow-hidden">
        {/* Icon Sidebar */}
        <motion.nav
          animate={{ width: sidebarOpen ? 64 : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="glass-strong border-r border-mc-border shrink-0 flex flex-col items-center py-4 gap-1"
        >
          {/* Logo */}
          <motion.div whileHover={{ scale: 1.1 }} className="w-10 h-10 rounded-xl bg-gradient-to-br from-mc-accent to-purple-500 flex items-center justify-center mb-3 shrink-0 cursor-pointer shadow-md shadow-mc-accent/20"
            onClick={() => setActivePage('home')}>
            <span className="text-white font-bold text-[11px]">MC</span>
          </motion.div>

          {/* Nav icons */}
          {navItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { setActivePage(item.id); }}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 relative ${
                activePage === item.id
                  ? 'bg-mc-accent/15 text-mc-accent-hover shadow-sm shadow-mc-accent/10'
                  : 'text-mc-muted hover:text-mc-text hover:bg-mc-card/50'
              }`}
              title={item.label}
            >
              <item.icon size={18} />
              {activePage === item.id && (
                <motion.div layoutId="nav-indicator" className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-mc-accent rounded-full" />
              )}
            </motion.button>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Installed version count badge */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-mc-muted hover:text-mc-text cursor-pointer relative"
            onClick={() => setActivePage('library')}
            title={t('library.title')}
          >
            <Library size={16} />
            {installedVersions.size > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-mc-accent text-white text-[8px] font-bold flex items-center justify-center px-1">
                {installedVersions.size}
              </span>
            )}
          </div>

          {/* Account mini */}
          <AccountMini t={t} />
        </motion.nav>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top header bar */}
          <div className="px-6 py-3 flex items-center justify-between border-b border-mc-border shrink-0">
            <div className="flex items-center gap-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-mc-card/50 transition-colors">
                {sidebarOpen ? <Menu size={16} /> : <Menu size={16} />}
              </motion.button>
              <div className="flex items-center gap-1.5 text-xs text-mc-muted">
                <span>{t('nav.home')}</span>
                <ChevronRight size={12} />
                <span className="text-mc-text font-medium">{navItems.find((n) => n.id === activePage)?.label || ''}</span>
              </div>
            </div>

            {/* Refresh + quick stats */}
            <div className="flex items-center gap-3">
              {showDownloadPanel && downloadProgress && downloadProgress.phase !== 'done' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass text-xs">
                  <div className="w-4 h-4 rounded-full border-2 border-mc-accent border-t-transparent animate-spin" />
                  <span className="text-mc-muted">{downloadProgress.percent}%</span>
                </div>
              )}
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={refreshInstalled}
                className="p-2 rounded-lg hover:bg-mc-card/50 text-mc-muted transition-colors" title={t('sidebar.refresh')}>
                <RefreshCw size={14} />
              </motion.button>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="px-6 py-2 bg-mc-red/10 border-b border-mc-red/20 flex items-center justify-between text-sm text-mc-red shrink-0">
                <span>{error}</span>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setError(null)}
                  className="p-1 rounded-lg hover:bg-mc-red/20 transition-colors"><X size={14} /></motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Page content */}
          <AnimatePresence mode="wait">
            {activePage === 'home' ? (
              <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col overflow-hidden">
                <HomePage installedList={installedList} onLaunch={handleLaunch} launching={launching} manifest={manifest} t={t} />
              </motion.div>
            ) : activePage === 'versions' ? (
              <motion.div key="versions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col overflow-hidden">
                <VersionBrowser
                  manifest={manifest} loading={loading} downloading={downloading} launching={launching}
                  installedVersions={installedVersions} downloadProgress={downloadProgress}
                  onInstall={handleInstall} onLaunch={handleLaunch} t={t} />
              </motion.div>
            ) : activePage === 'library' ? (
              <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col overflow-hidden">
                <LibraryPage onLaunch={handleLaunch} installingId={downloading} t={t} />
              </motion.div>
            ) : activePage === 'modBrowser' ? (
              <motion.div key="modBrowser" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col overflow-hidden">
                <ModBrowser installedList={installedList} t={t} />
              </motion.div>
            ) : activePage === 'servers' ? (
              <motion.div key="servers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col overflow-hidden">
                <ServerList t={t} />
              </motion.div>
            ) : activePage === 'friends' ? (
              <motion.div key="friends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col overflow-hidden">
                <FriendPanel t={t} installedList={installedList} />
              </motion.div>
            ) : activePage === 'screenshots' ? (
              <Suspense fallback={<div className="flex-1 flex items-center justify-center"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-6 h-6 rounded-full border-2 border-mc-accent border-t-transparent" /></div>}>
                <motion.div key="screenshots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col overflow-hidden">
                  <ScreenshotsPanel t={t} />
                </motion.div>
              </Suspense>
            ) : (
              <Suspense fallback={<div className="flex-1 flex items-center justify-center"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-6 h-6 rounded-full border-2 border-mc-accent border-t-transparent" /></div>}>
                <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col overflow-hidden">
                  <SettingsPanel t={t} />
                </motion.div>
              </Suspense>
            )}
          </AnimatePresence>

          {/* Console */}
          <ConsolePanel t={t} />
        </div>
      </div>

      {/* Splash */}
      <SplashOverlay visible={splashVisible} versionId={splashVersion} t={t} />

      {/* Download Queue */}
      <DownloadQueuePanel t={t} />

      {/* Download Panel */}
      <AnimatePresence>
        {showDownloadPanel && downloadProgress && (
          <DownloadPanel progress={downloadProgress} t={t}
            onClose={() => {
              if (downloadProgress.phase === 'done') { setShowDownloadPanel(false); setDownloadProgress(null); refreshInstalled(); }
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountMini({ t }: { t: (key: string) => string }) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    window.electronAPI.mc.getActiveAccount().then(setAccount);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest('[data-account-popup]') && !el.closest('[data-account-trigger]')) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show]);

  return (
    <>
      <div className="relative pb-3">
        <motion.button
          whileHover={{ scale: 1.1 }}
          onClick={() => setShow(!show)}
          data-account-trigger
          className="w-10 h-10 rounded-xl bg-mc-card/50 border border-mc-border flex items-center justify-center text-mc-muted hover:border-mc-accent/30 transition-all"
          title={t('account.title')}
        >
          {account ? (
            <span className="text-[10px] font-bold text-mc-accent-hover">{account.username.slice(0, 2).toUpperCase()}</span>
          ) : (
            <span className="text-[10px] text-mc-muted">?</span>
          )}
        </motion.button>
      </div>

      {/* Render popup via portal to escape the sidebar's backdrop-filter containing block */}
      {show && createPortal(
        <AnimatePresence>
          <motion.div
            data-account-popup
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.15 }}
            className="fixed left-16 bottom-4 z-[95] w-64 max-h-[70vh] overflow-y-auto rounded-2xl glass-strong border border-mc-border shadow-2xl p-3"
          >
            <AccountPanel t={t} onAccountsChanged={() => window.electronAPI.mc.getActiveAccount().then(setAccount)} />
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
