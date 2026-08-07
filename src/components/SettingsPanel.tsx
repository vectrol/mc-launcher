import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Palette, Languages, Cpu, Settings2, Save, CheckCircle2, HelpCircle, Keyboard, FolderOpen, ExternalLink, Info, RefreshCw, Loader2, Terminal, Download, Activity, Image as ImageIcon } from 'lucide-react';
import { AppSettings } from '../types';
import { Lang } from '../i18n';

interface Props { t: (key: string, ...args: (string | number)[]) => string; }

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6', '#ef4444', '#f97316'];

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Ctrl+1~5', desc: 'help.sc.1' },
  { keys: 'Ctrl+R', desc: 'help.sc.2' },
  { keys: 'Ctrl+B', desc: 'help.sc.3' },
  { keys: 'Esc', desc: 'help.sc.4' },
  { keys: 'Enter', desc: 'help.sc.5' },
];

const FAQS: { q: string; a: string }[] = [
  { q: 'help.faq1.q', a: 'help.faq1.a' },
  { q: 'help.faq2.q', a: 'help.faq2.a' },
  { q: 'help.faq3.q', a: 'help.faq3.a' },
  { q: 'help.faq4.q', a: 'help.faq4.a' },
  { q: 'help.faq5.q', a: 'help.faq5.a' },
];

export default function SettingsPanel({ t }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'general' | 'advanced' | 'help'>('general');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [errorLog, setErrorLog] = useState('');
  const [showLog, setShowLog] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

  async function handleDownloadUpdate() {
    setDownloadingUpdate(true); setUpdateProgress(0); setUpdateDownloaded(false);
    window.electronAPI.mc.onUpdateProgress((p) => setUpdateProgress(p.percent));
    try {
      await window.electronAPI.mc.downloadUpdate();
      setUpdateDownloaded(true); setUpdateProgress(100);
    } catch {}
    setDownloadingUpdate(false);
  }

  // v2.5: Java scan / diagnostics / auto-source / presets
  const [javaList, setJavaList] = useState<any[]>([]);
  const [javaScanning, setJavaScanning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [diagRunning, setDiagRunning] = useState(false);

  async function handleScanJava() {
    setJavaScanning(true);
    try { setJavaList(await window.electronAPI.mc.scanJava()); } catch {}
    setJavaScanning(false);
  }

  async function handleDiagnostics() {
    setDiagRunning(true);
    try { setDiagnostics(await window.electronAPI.mc.runDiagnostics()); } catch {}
    setDiagRunning(false);
  }

  async function handleAutoSource() {
    try { const r = await window.electronAPI.mc.autoSelectSource(); const s = await window.electronAPI.mc.getSettings(); setSettings(s); }
    catch {}
  }

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try { setSettings(await window.electronAPI.mc.getSettings()); } catch {} finally { setLoading(false); }
  }

  async function handleSave(updates: Partial<AppSettings>) {
    if (!settings) return;
    setSaved(false);
    const result = await window.electronAPI.mc.saveSettings(updates);
    setSettings(result);
    if (updates.theme) document.documentElement.setAttribute('data-theme', updates.theme);
    if (updates.accentColor) {
      document.documentElement.style.setProperty('--mc-accent', updates.accentColor);
      document.documentElement.style.setProperty('--mc-accent-hover', adjustBrightness(updates.accentColor, 20));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function adjustBrightness(hex: string, amount: number) {
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + amount));
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + amount));
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  if (loading || !settings) {
    return <div className="flex-1 flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-6 h-6 rounded-full border-2 border-mc-accent border-t-transparent" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-mc-border shrink-0 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
        <div className="flex gap-1 p-0.5 rounded-xl bg-mc-card/50 border border-mc-border">
          {(['general', 'advanced', 'help'] as const).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === tb ? 'bg-mc-accent/20 text-mc-accent-hover' : 'text-mc-muted hover:text-mc-text'}`}>
              {tb === 'general' ? t('settings.title') : tb === 'advanced' ? t('settings.advanced') : t('help.title')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto space-y-8">
          {tab === 'general' ? (
            <>
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-4 text-mc-accent-hover"><Palette size={16} /> {t('settings.appearance')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.theme')}</label>
                    <div className="flex gap-2">
                      {(['dark', 'light'] as const).map((th) => (
                        <motion.button key={th} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleSave({ theme: th })}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${settings.theme === th ? 'bg-mc-accent/15 text-mc-accent-hover border-mc-accent/30' : 'bg-mc-card border-mc-border text-mc-muted hover:text-mc-text'}`}>
                          <span className="mr-1.5">{th === 'dark' ? '🌙' : '☀️'}</span>{t(`settings.theme${th === 'dark' ? 'Dark' : 'Light'}`)}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.accentColor')}</label>
                    <div className="flex gap-2 flex-wrap">
                      {PRESET_COLORS.map((c) => (
                        <motion.button key={c} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => handleSave({ accentColor: c })}
                          className="w-8 h-8 rounded-xl border-2 transition-all"
                          style={{ backgroundColor: c, borderColor: settings.accentColor === c ? '#fff' : 'transparent', boxShadow: settings.accentColor === c ? `0 0 12px ${c}80` : 'none' }} />
                      ))}
                      <div className="relative">
                        <div className="w-8 h-8 rounded-xl border-2 border-dashed border-mc-border flex items-center justify-center cursor-pointer hover:border-mc-accent/50 transition-colors"
                          style={{ background: settings.accentColor }}>
                          <input type="color" value={settings.accentColor}
                            onChange={(e) => handleSave({ accentColor: e.target.value })}
                            className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.bgImage')}</label>
                    <div className="flex gap-2">
                      <input type="file" accept=".png,.jpg,.jpeg" className="hidden" id="bgImageInput"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            await window.electronAPI.mc.setBgImage((f as any).path);
                            document.documentElement.style.setProperty('--mc-bg-image', `url("file:///${((f as any).path as string).replace(/\\/g, '/')}")`);
                            const s = await window.electronAPI.mc.getSettings(); setSettings(s);
                          }
                          e.target.value = '';
                        }} />
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={() => (document.getElementById('bgImageInput') as HTMLInputElement)?.click()}
                        className="flex-1 py-2.5 rounded-xl bg-mc-card border border-mc-border text-sm text-mc-muted hover:text-mc-text transition-all">
                        <ImageIcon size={13} className="inline mr-1" />{t('settings.bgImageHint')}
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={async () => {
                          await window.electronAPI.mc.setBgImage('');
                          document.documentElement.style.setProperty('--mc-bg-image', 'none');
                          const s = await window.electronAPI.mc.getSettings(); setSettings(s);
                        }}
                        className="px-3 py-2.5 rounded-xl bg-mc-card border border-mc-border text-xs text-mc-muted hover:text-mc-red transition-all">
                        {t('settings.clearBg')}
                      </motion.button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.language')}</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {(['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'es-ES', 'ru-RU'] as Lang[]).map((lang) => (
                        <motion.button key={lang} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleSave({ language: lang })}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${settings.language === lang ? 'bg-mc-accent/15 text-mc-accent-hover border-mc-accent/30' : 'bg-mc-card border-mc-border text-mc-muted hover:text-mc-text'}`}>
                          {t(`settings.lang${lang === 'zh-CN' ? 'Zh' : lang === 'en-US' ? 'En' : lang === 'ja-JP' ? 'Ja' : lang === 'ko-KR' ? 'Ko' : lang === 'es-ES' ? 'Es' : 'Ru'}`)}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-4 text-mc-accent-hover"><Cpu size={16} /> {t('settings.java')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.javaPath')}</label>
                    <input type="text" value={settings.javaPath}
                      onChange={(e) => setSettings({ ...settings, javaPath: e.target.value })}
                      placeholder={t('settings.javaPathHint')}
                      className="w-full bg-mc-card border border-mc-border rounded-xl px-4 py-2.5 text-sm text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors font-mono" />
                    <button onClick={handleScanJava} disabled={javaScanning}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-accent-hover transition-all disabled:opacity-40">
                      {javaScanning ? <Loader2 size={10} className="animate-spin" /> : <Cpu size={10} />}
                      {t('settings.scanJava')}
                    </button>
                    {javaList.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {javaList.map(j => (
                          <button key={j.path} onClick={() => handleSave({ javaPath: j.path })}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] border transition-all ${
                              settings.javaPath === j.path ? 'bg-mc-accent/15 border-mc-accent/30 text-mc-accent-hover' : 'bg-mc-card/30 border-mc-border/30 text-mc-muted hover:text-mc-text'
                            }`}>
                            <span className="font-mono">Java {j.version}</span>
                            <span className="text-mc-muted truncate ml-2">{j.path}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.maxMemory')}</label>
                    <div className="flex gap-2 items-center">
                      <input type="number" value={settings.maxMemory} disabled={settings.autoMemory}
                        onChange={(e) => handleSave({ maxMemory: e.target.value, autoMemory: false })}
                        className="flex-1 bg-mc-card border border-mc-border rounded-xl px-4 py-2.5 text-sm text-mc-text outline-none focus:border-mc-accent/50 transition-colors font-mono disabled:opacity-40" />
                      <span className="text-xs text-mc-muted shrink-0">MB</span>
                    </div>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer" onClick={() => handleSave({ autoMemory: !settings.autoMemory })}>
                      <div className={`w-9 h-5 rounded-full transition-all relative ${settings.autoMemory ? 'bg-mc-green' : 'bg-mc-border'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${settings.autoMemory ? 'left-4' : 'left-0.5'}`} />
                      </div>
                      <span className="text-xs text-mc-muted">{t('settings.autoMemory')}</span>
                    </label>
                    <div className="flex gap-1.5 mt-1">
                      {[
                        { label: t('settings.presetLow'), mem: '2048', args: '-XX:+UseSerialGC' },
                        { label: t('settings.presetBalanced'), mem: '4096', args: '-XX:+UseG1GC' },
                        { label: t('settings.presetHigh'), mem: '8192', args: '-XX:+UseG1GC -XX:+AggressiveOpts' },
                      ].map(p => (
                        <button key={p.label} onClick={() => handleSave({ maxMemory: p.mem, jvmArgs: p.args, autoMemory: false })}
                          className="flex-1 py-1.5 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-text hover:border-mc-accent/30 transition-all">{p.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : tab === 'advanced' ? (
            <section className="space-y-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-mc-accent-hover"><Settings2 size={16} /> {t('settings.advanced')}</h3>

              <div>
                <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.downloadSource')}</label>
                <div className="flex gap-2">
                  {(['mojang', 'bmclapi'] as const).map((src) => (
                    <motion.button key={src} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleSave({ downloadSource: src })}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${settings.downloadSource === src ? 'bg-mc-accent/15 text-mc-accent-hover border-mc-accent/30' : 'bg-mc-card border-mc-border text-mc-muted hover:text-mc-text'}`}>
                      {src === 'mojang' ? 'Mojang' : 'BMCLAPI (镜像)'}
                    </motion.button>
                  ))}
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleAutoSource}
                    className="px-3 py-2.5 rounded-xl text-[11px] border border-mc-accent/30 text-mc-accent-hover bg-mc-accent/10 hover:bg-mc-accent/20 transition-all">
                    {t('settings.autoSource')}
                  </motion.button>
                </div>
              </div>

              <div>
                <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.diagnostics')}</label>
                <button onClick={handleDiagnostics} disabled={diagRunning}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-accent-hover transition-all disabled:opacity-40">
                  {diagRunning ? <Loader2 size={11} className="animate-spin" /> : <Activity size={11} />}
                  {t('settings.runDiag')}
                </button>
                {diagnostics && (
                  <div className="mt-2 space-y-1">
                    {diagnostics.network.map((n: any) => (
                      <div key={n.host} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-mc-card/30 border border-mc-border/30 text-[10px]">
                        <span className="font-mono text-mc-muted">{n.host}</span>
                        {n.ok ? <span className="text-mc-green">{n.ms}ms</span> : <span className="text-mc-red">{n.error || '✗'}</span>}
                      </div>
                    ))}
                    {diagnostics.java.length > 0 && (
                      <p className="text-[10px] text-mc-muted px-1">Java: {diagnostics.java.map((j: any) => j.version).join(', ')}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.downloadThreads')}</label>
                <input type="number" value={settings.downloadThreads} min="1" max="16"
                  onChange={(e) => handleSave({ downloadThreads: e.target.value })}
                  className="w-full bg-mc-card border border-mc-border rounded-xl px-4 py-2.5 text-sm text-mc-text outline-none focus:border-mc-accent/50 transition-colors font-mono" />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => handleSave({ autoClose: !settings.autoClose })}>
                  <div className={`w-9 h-5 rounded-full transition-all relative ${settings.autoClose ? 'bg-mc-green' : 'bg-mc-border'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${settings.autoClose ? 'left-4' : 'left-0.5'}`} />
                  </div>
                  <span className="text-sm text-mc-text">{t('settings.autoClose')}</span>
                </label>
              </div>

              <div>
                <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.modrinthMirror')}</label>
                <div className="flex gap-2">
                  {(['official', 'kuvako'] as const).map((src) => (
                    <motion.button key={src} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleSave({ modrinthMirror: src })}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${settings.modrinthMirror === src ? 'bg-mc-accent/15 text-mc-accent-hover border-mc-accent/30' : 'bg-mc-card border-mc-border text-mc-muted hover:text-mc-text'}`}>
                      {src === 'official' ? 'Modrinth 官方' : 'Kuvako 国内镜像'}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.bandwidth')}</label>
                <div className="flex gap-2 items-center">
                  <input type="number" value={settings.bandwidthLimit} min="0" onChange={(e) => handleSave({ bandwidthLimit: e.target.value })}
                    className="flex-1 bg-mc-card border border-mc-border rounded-xl px-4 py-2.5 text-sm text-mc-text outline-none focus:border-mc-accent/50 transition-colors font-mono" />
                  <span className="text-xs text-mc-muted shrink-0">KB/s (0 = 不限)</span>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => handleSave({ autoRestart: !settings.autoRestart })}>
                  <div className={`w-9 h-5 rounded-full transition-all relative ${settings.autoRestart ? 'bg-mc-green' : 'bg-mc-border'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${settings.autoRestart ? 'left-4' : 'left-0.5'}`} />
                  </div>
                  <span className="text-sm text-mc-text">{t('settings.autoRestart')}</span>
                </label>
              </div>

              <div>
                <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.curseforge')}</label>
                <input type="password" value={settings.curseforgeKey} onChange={(e) => handleSave({ curseforgeKey: e.target.value })}
                  placeholder="CurseForge API Key (可选)"
                  className="w-full bg-mc-card border border-mc-border rounded-xl px-4 py-2.5 text-sm text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors font-mono" />
              </div>

              <div>
                <label className="text-xs text-mc-muted uppercase tracking-widest block mb-2">{t('settings.jvmArgs')}</label>
                <textarea
                  value={settings.jvmArgs}
                  onChange={(e) => setSettings({ ...settings, jvmArgs: e.target.value })}
                  placeholder={t('settings.jvmArgsHint')}
                  rows={4}
                  className="w-full bg-mc-card border border-mc-border rounded-xl px-4 py-2.5 text-xs text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors font-mono resize-none"
                />
              </div>
            </section>
          ) : (
            <section className="space-y-8">
              {/* Quick guide */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3 text-mc-accent-hover"><HelpCircle size={16} /> {t('help.guide')}</h3>
                <div className="space-y-1.5">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex gap-2.5 p-2.5 rounded-xl bg-mc-card/30 border border-mc-border/30 text-xs text-mc-muted">
                      <span className="w-5 h-5 rounded-lg bg-mc-accent/15 text-mc-accent-hover text-[10px] font-bold flex items-center justify-center shrink-0">{i}</span>
                      <span>{t(`help.guide${i}`)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shortcuts */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3 text-mc-accent-hover"><Keyboard size={16} /> {t('help.shortcuts')}</h3>
                <div className="space-y-1.5">
                  {SHORTCUTS.map((s) => (
                    <div key={s.keys} className="flex items-center justify-between p-2.5 rounded-xl bg-mc-card/30 border border-mc-border/30 text-xs">
                      <span className="text-mc-muted">{t(s.desc)}</span>
                      <kbd className="px-2 py-1 rounded-lg bg-mc-surface border border-mc-border font-mono text-[10px] text-mc-accent-hover">{s.keys}</kbd>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3 text-mc-accent-hover"><HelpCircle size={16} /> {t('help.faq')}</h3>
                <div className="space-y-1.5">
                  {FAQS.map((f, i) => (
                    <div key={i} className="rounded-xl bg-mc-card/30 border border-mc-border/30 overflow-hidden">
                      <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full text-left px-3.5 py-3 text-xs font-medium text-mc-text hover:bg-mc-card/50 transition-colors">
                        {t(f.q)}
                      </button>
                      {openFaq === i && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          className="px-3.5 pb-3 text-xs text-mc-muted leading-relaxed border-t border-mc-border/30 pt-2">
                          {t(f.a)}
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* About */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3 text-mc-accent-hover"><Info size={16} /> {t('help.about')}</h3>
                <div className="p-4 rounded-xl bg-mc-card/30 border border-mc-border/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between"><span className="text-mc-muted">{t('help.version')}</span><span className="font-mono text-mc-text">MC Launcher v2.0</span></div>
                  <div className="flex items-center justify-between"><span className="text-mc-muted">{t('help.dataDir')}</span><span className="font-mono text-mc-muted text-[10px] truncate max-w-[200px]">%APPDATA%/mc-launcher</span></div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => window.electronAPI.mc.openFolder()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-text transition-all">
                      <FolderOpen size={11} /> {t('help.openData')}
                    </button>
                    <a href="https://github.com" target="_blank"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-text transition-all">
                      <ExternalLink size={11} /> {t('help.feedback')}
                    </a>
                  </div>
                </div>
              </div>

              {/* Update + logs */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3 text-mc-accent-hover"><RefreshCw size={16} /> {t('help.update')}</h3>
                <div className="p-4 rounded-xl bg-mc-card/30 border border-mc-border/30 space-y-2">
                  <button onClick={async () => {
                    setCheckingUpdate(true);
                    try { setUpdateInfo(await window.electronAPI.mc.checkForUpdates()); } catch {}
                    setCheckingUpdate(false);
                  }} disabled={checkingUpdate}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-mc-accent/15 text-mc-accent-hover text-[11px] font-medium hover:bg-mc-accent/25 transition-all disabled:opacity-40">
                    {checkingUpdate ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    {t('help.checkUpdate')}
                  </button>
                  {updateInfo?.hasUpdate && (
                    <div className="space-y-2">
                      <p className="text-[11px] text-mc-orange">{t('help.newVersion')} v{updateInfo.latest} ({t('help.current')} v{updateInfo.current})</p>
                      <p className="text-[10px] text-mc-muted line-clamp-2">{updateInfo.notes}</p>
                      <div className="flex items-center gap-2">
                        <button onClick={handleDownloadUpdate} disabled={downloadingUpdate}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-mc-accent text-white text-[11px] font-medium hover:bg-mc-accent-hover transition-all disabled:opacity-50">
                          {downloadingUpdate ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                          {downloadingUpdate ? `${updateProgress}%` : t('help.downloadUpdate')}
                        </button>
                        <a href={updateInfo.url} target="_blank" className="text-[10px] text-mc-accent-hover hover:underline">{t('help.releasePage')} →</a>
                      </div>
                      {downloadingUpdate && (
                        <div className="h-1.5 rounded-full bg-mc-surface overflow-hidden">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-mc-accent to-purple-500"
                            animate={{ width: `${updateProgress}%` }} transition={{ duration: 0.3 }} />
                        </div>
                      )}
                      {updateDownloaded && (
                        <div className="flex items-center gap-2 text-[10px] text-mc-green">
                          <CheckCircle2 size={11} /> {t('help.updateDownloaded')}
                          <button onClick={() => window.electronAPI.mc.openUpdateFolder()}
                            className="text-mc-accent-hover hover:underline">{t('help.openFolder')}</button>
                        </div>
                      )}
                    </div>
                  )}
                  <button onClick={async () => { setErrorLog(await window.electronAPI.mc.getErrorLog()); setShowLog(!showLog); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-text transition-all">
                    <Terminal size={11} /> {t('help.errorLog')}
                  </button>
                  {showLog && (
                    <div className="space-y-1.5">
                      <pre className="max-h-40 overflow-y-auto p-2 rounded-lg bg-mc-surface border border-mc-border text-[9px] text-mc-muted font-mono whitespace-pre-wrap">{errorLog || t('help.noErrors')}</pre>
                      <button onClick={async () => { await window.electronAPI.mc.clearErrorLog(); setErrorLog(''); }}
                        className="text-[10px] text-mc-red hover:underline">{t('help.clearLog')}</button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => handleSave({})}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-sm font-medium transition-all shadow-lg shadow-mc-accent/20">
            {saved ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2"><CheckCircle2 size={16} /> {t('settings.saved')}</motion.span>
              : <><Save size={15} /> {t('settings.save')}</>}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
