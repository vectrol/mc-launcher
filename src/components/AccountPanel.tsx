import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Plus, LogIn, Trash2, Loader2, CheckCircle2, Shield, Monitor, Globe } from 'lucide-react';
import { AccountInfo } from '../types';

interface Props {
  t: (key: string, ...args: (string | number)[]) => string;
  onAccountsChanged?: () => void;
}

export default function AccountPanel({ t, onAccountsChanged }: Props) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [offlineName, setOfflineName] = useState('');
  const [addingOffline, setAddingOffline] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showThirdParty, setShowThirdParty] = useState(false);
  const [tpServer, setTpServer] = useState('');
  const [tpUser, setTpUser] = useState('');
  const [tpPass, setTpPass] = useState('');
  const [tpLogging, setTpLogging] = useState(false);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    try {
      const a = await window.electronAPI.mc.getAccounts();
      setAccounts(a);
    } catch {} finally { setLoading(false); }
  }

  async function handleAddOffline() {
    if (!offlineName.trim()) return;
    try {
      setAddingOffline(true);
      setError(null);
      await window.electronAPI.mc.addOfflineAccount(offlineName.trim());
      await loadAccounts();
      setOfflineName('');
      setShowAdd(false);
      onAccountsChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally { setAddingOffline(false); }
  }

  async function handleThirdParty() {
    if (!tpServer.trim() || !tpUser.trim() || !tpPass) return;
    try {
      setTpLogging(true);
      setError(null);
      await window.electronAPI.mc.loginThirdParty(tpServer.trim(), tpUser.trim(), tpPass);
      await loadAccounts();
      setShowThirdParty(false); setTpPass('');
      onAccountsChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally { setTpLogging(false); }
  }

  async function handleMicrosoftLogin() {
    try {
      setLoggingIn(true);
      setError(null);
      await window.electronAPI.mc.startMicrosoftLogin();
      await loadAccounts();
      onAccountsChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally { setLoggingIn(false); }
  }

  async function handleRemove(id: string) {
    await window.electronAPI.mc.removeAccount(id);
    await loadAccounts();
    onAccountsChanged?.();
  }

  async function handleSetActive(id: string) {
    await window.electronAPI.mc.setActiveAccount(id);
    await loadAccounts();
    onAccountsChanged?.();
  }

  const activeAccount = accounts.find((a) => a.active);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={16} className="animate-spin text-mc-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Active account display */}
      {activeAccount ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 rounded-xl glass border border-mc-accent/20 flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-mc-accent/30 to-purple-500/30 flex items-center justify-center shrink-0">
            {activeAccount.type === 'microsoft' ? <Shield size={16} className="text-mc-accent" /> : activeAccount.type === 'thirdparty' ? <Globe size={16} className="text-mc-accent" /> : <Monitor size={16} className="text-mc-accent" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-mc-text truncate">{activeAccount.username}</p>
            <p className="text-[9px] text-mc-muted font-mono truncate">{activeAccount.uuid}</p>
          </div>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-mc-green/10 text-mc-green uppercase font-semibold shrink-0">
            {t('account.active')}
          </span>
        </motion.div>
      ) : (
        <div className="p-3 rounded-xl glass border border-mc-border flex items-center gap-2 text-mc-muted text-xs">
          <User size={14} />
          <span>{t('account.noAccountHint')}</span>
        </div>
      )}

      {/* Other accounts list */}
      <AnimatePresence>
        {accounts.filter((a) => !a.active).map((a) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-mc-card/30 transition-colors group"
          >
            <div className="w-6 h-6 rounded-lg bg-mc-card flex items-center justify-center shrink-0">
              {a.type === 'microsoft' ? <Shield size={10} className="text-mc-accent" /> : a.type === 'thirdparty' ? <Globe size={10} className="text-mc-accent" /> : <Monitor size={10} className="text-mc-muted" />}
            </div>
            <span className="text-xs text-mc-muted truncate flex-1">{a.username}</span>
            <span className="text-[8px] text-mc-muted uppercase">{t(a.type === 'microsoft' ? 'account.typeMs' : a.type === 'thirdparty' ? 'account.typeSkin' : 'account.typeOffline')}</span>
            <button onClick={() => handleSetActive(a.id)} className="p-1 rounded hover:bg-mc-accent/10 text-mc-muted hover:text-mc-accent transition-colors opacity-0 group-hover:opacity-100" title={t('account.switch')}>
              <CheckCircle2 size={12} />
            </button>
            <button onClick={() => handleRemove(a.id)} className="p-1 rounded hover:bg-mc-red/10 text-mc-muted hover:text-mc-red transition-colors opacity-0 group-hover:opacity-100">
              <Trash2 size={11} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add account buttons / form */}
      {showAdd ? (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
          <div>
            <input
              type="text"
              value={offlineName}
              onChange={(e) => setOfflineName(e.target.value)}
              placeholder={t('account.usernamePlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleAddOffline()}
              className="w-full bg-mc-card border border-mc-border rounded-lg px-3 py-2 text-xs text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors"
              autoFocus
            />
          </div>
          <div className="flex gap-1.5">
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleAddOffline} disabled={addingOffline || !offlineName.trim()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-mc-accent/15 text-mc-accent-hover text-[11px] font-medium hover:bg-mc-accent/25 transition-colors disabled:opacity-40">
              {addingOffline ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              {t('account.addOffline')}
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 rounded-lg hover:bg-mc-card/30 text-mc-muted text-[11px] transition-colors">
              {t('common.close')}
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-mc-card/50 border border-mc-border text-mc-muted hover:text-mc-text hover:border-mc-accent/30 text-[11px] font-medium transition-all">
              <Plus size={12} /> {t('account.addOffline')}
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleMicrosoftLogin} disabled={loggingIn}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-mc-card/50 border border-mc-border text-mc-muted hover:text-mc-text hover:border-mc-accent/30 text-[11px] font-medium transition-all disabled:opacity-40">
              {loggingIn ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
              {loggingIn ? t('account.loggingIn') : t('account.loginMs')}
            </motion.button>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setShowThirdParty(!showThirdParty)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-mc-card/50 border border-mc-border text-mc-muted hover:text-mc-text hover:border-mc-accent/30 text-[11px] font-medium transition-all">
            <Globe size={12} /> {t('account.loginSkin')}
          </motion.button>

          <AnimatePresence>
            {showThirdParty && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5 overflow-hidden">
                <input type="text" value={tpServer} onChange={(e) => setTpServer(e.target.value)}
                  placeholder={t('account.skinServerPlaceholder')}
                  className="w-full bg-mc-card border border-mc-border rounded-lg px-3 py-2 text-xs text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors font-mono" />
                <input type="text" value={tpUser} onChange={(e) => setTpUser(e.target.value)}
                  placeholder={t('account.usernamePlaceholder')}
                  className="w-full bg-mc-card border border-mc-border rounded-lg px-3 py-2 text-xs text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors" />
                <input type="password" value={tpPass} onChange={(e) => setTpPass(e.target.value)}
                  placeholder={t('account.password')}
                  onKeyDown={(e) => e.key === 'Enter' && handleThirdParty()}
                  className="w-full bg-mc-card border border-mc-border rounded-lg px-3 py-2 text-xs text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 transition-colors" />
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleThirdParty} disabled={tpLogging}
                  className="w-full flex items-center justify-center gap-1 py-2 rounded-lg bg-mc-accent/15 text-mc-accent-hover text-[11px] font-medium hover:bg-mc-accent/25 transition-colors disabled:opacity-40">
                  {tpLogging ? <Loader2 size={11} className="animate-spin" /> : <LogIn size={11} />}
                  {tpLogging ? t('account.loggingIn') : t('account.loginSkin')}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-[10px] text-mc-red px-1">{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
