import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, Wifi, WifiOff, Copy, Globe, Loader2, Radio, Play } from 'lucide-react';
import { FriendsSnapshot, FriendInfo, LanWorld } from '../types';

interface Props {
  t: (key: string, ...args: (string | number)[]) => string;
  installedList: { id: string }[];
}

export default function FriendPanel({ t, installedList }: Props) {
  const [snapshot, setSnapshot] = useState<FriendsSnapshot>({ friends: [], lanUsers: [], worlds: [] });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIp, setNewIp] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [joinTarget, setJoinTarget] = useState<LanWorld | null>(null);
  const [joinVersion, setJoinVersion] = useState('');

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 2000);
    return () => clearInterval(iv);
  }, []);

  async function refresh() {
    try { setSnapshot(await window.electronAPI.mc.getFriendsSnapshot()); }
    catch {} finally { setLoading(false); }
  }

  async function genCode() {
    setInviteCode(await window.electronAPI.mc.generateInviteCode());
    setShowInvite(true);
  }

  async function inputCodeAdd() {
    if (!inputCode.trim()) return;
    const r = await window.electronAPI.mc.resolveInviteCode(inputCode.trim());
    if (r.success) { setInputCode(''); refresh(); }
  }

  async function handleJoin(world: LanWorld) {
    await window.electronAPI.mc.copyServerAddress(world.ip, world.port);
    setCopied(world.id);
    setTimeout(() => setCopied(null), 2000);
    if (joinVersion) {
      // One-click join: start game with target version
      try { await window.electronAPI.mc.launch(joinVersion); } catch {}
    }
  }

  async function handleAdd() {
    if (!newName.trim() || !newIp.trim()) return;
    await window.electronAPI.mc.addFriend(newName.trim(), newIp.trim());
    setNewName(''); setNewIp(''); setShowAdd(false);
    refresh();
  }

  async function handleCopy(world: LanWorld) {
    await window.electronAPI.mc.copyServerAddress(world.ip, world.port);
    setCopied(world.id);
    setTimeout(() => setCopied(null), 2000);
  }

  const allFriends = [...snapshot.friends, ...snapshot.lanUsers];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-mc-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users size={16} className="text-mc-accent" /> {t('friends.title')}
          </h2>
          <p className="text-xs text-mc-muted">{allFriends.filter(f => f.online).length} {t('friends.online')} · {snapshot.worlds.length} {t('friends.lanWorlds')}</p>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-xs font-medium transition-all">
          <Plus size={12} /> {t('friends.add')}
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl glass-strong border border-mc-accent/20 space-y-3 max-w-md">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('friends.name')}
              className="w-full bg-mc-card border border-mc-border rounded-xl px-3 py-2 text-sm text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50" />
            <input type="text" value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder={t('friends.ipHint')}
              className="w-full bg-mc-card border border-mc-border rounded-xl px-3 py-2 text-sm text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 font-mono" />
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleAdd} disabled={!newName.trim() || !newIp.trim()}
                className="flex-1 py-2 rounded-xl bg-mc-accent hover:bg-mc-accent-hover text-white text-sm font-medium transition-all disabled:opacity-40">
                {t('friends.add')}
              </motion.button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-mc-muted hover:text-mc-text">{t('common.close')}</button>
            </div>
          </motion.div>
        )}

        {/* Invite code */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl glass-strong border border-mc-border/50 space-y-2 max-w-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-mc-text">{t('friends.invite')}</span>
            <motion.button whileTap={{ scale: 0.95 }} onClick={genCode}
              className="px-3 py-1.5 rounded-lg bg-mc-accent/15 text-mc-accent-hover text-[11px] font-medium hover:bg-mc-accent/25 transition-colors">
              {t('friends.genCode')}
            </motion.button>
          </div>
          {inviteCode && (
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-mc-surface border border-mc-border text-[10px] text-mc-accent-hover font-mono break-all">{inviteCode}</code>
              <button onClick={() => { navigator.clipboard.writeText(inviteCode); }}
                className="p-2 rounded-lg bg-mc-card/50 border border-mc-border text-mc-muted hover:text-mc-text transition-all"><Copy size={11} /></button>
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && inputCodeAdd()}
              placeholder={t('friends.inputCode')}
              className="flex-1 bg-mc-card border border-mc-border rounded-lg px-3 py-2 text-xs text-mc-text placeholder-mc-muted outline-none focus:border-mc-accent/50 font-mono" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={inputCodeAdd} disabled={!inputCode.trim()}
              className="px-3 py-2 rounded-lg bg-mc-card/50 border border-mc-border text-mc-muted hover:text-mc-text text-[11px] transition-all disabled:opacity-40">
              {t('friends.add')}
            </motion.button>
          </div>
        </motion.div>

        {/* LAN games (Minecraft worlds) */}
        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold text-mc-muted uppercase tracking-widest mb-3">
            <Radio size={13} className="text-mc-green" /> {t('friends.lanWorlds')}
          </h3>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-mc-accent" /></div>
          ) : snapshot.worlds.length === 0 ? (
            <div className="p-6 rounded-2xl glass border border-mc-border/50 text-center">
              <Radio size={28} className="text-mc-border mx-auto mb-2" />
              <p className="text-sm text-mc-muted">{t('friends.noLanWorlds')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {snapshot.worlds.map(w => (
                <motion.div key={w.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 rounded-2xl glass-strong border border-mc-green/20">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-mc-green/15 flex items-center justify-center shrink-0">
                      <Globe size={16} className="text-mc-green" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-mc-text">{w.name}</p>
                      <p className="text-[10px] text-mc-muted font-mono">{w.ip}:{w.port}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {joinTarget?.id === w.id ? (
                      <div className="flex items-center gap-1.5">
                        <select value={joinVersion} onChange={(e) => setJoinVersion(e.target.value)}
                          className="bg-mc-card border border-mc-border rounded-lg px-2 py-1.5 text-[10px] text-mc-text outline-none">
                          <option value="">{t('friends.selectVersion')}</option>
                          {installedList.map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
                        </select>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleJoin(w)}
                          className="px-3 py-1.5 rounded-lg bg-mc-green/20 text-mc-green text-[10px] font-medium hover:bg-mc-green/30 transition-all">
                          <Play size={10} className="inline mr-1" />{t('friends.join')}
                        </motion.button>
                      </div>
                    ) : (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setJoinTarget(w); setJoinVersion(''); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-mc-card/50 border border-mc-border text-[10px] text-mc-muted hover:text-mc-green transition-all">
                        <Play size={11} /> {t('friends.join')}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Friends */}
        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold text-mc-muted uppercase tracking-widest mb-3">
            <Users size={13} /> {t('friends.title')} <span className="text-mc-green">({allFriends.filter(f => f.online).length})</span>
          </h3>
          {allFriends.length === 0 ? (
            <div className="p-6 rounded-2xl glass border border-mc-border/50 text-center">
              <Users size={28} className="text-mc-border mx-auto mb-2" />
              <p className="text-sm text-mc-muted">{t('friends.empty')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allFriends.map(f => (
                <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3 rounded-2xl glass-strong border border-mc-border/50">
                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 rounded-xl bg-mc-card flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-mc-accent-hover">{f.name.slice(0, 1).toUpperCase()}</span>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-mc-surface ${f.online ? 'bg-mc-green' : 'bg-mc-muted'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-mc-text">{f.name} {f.lanOnly && <span className="text-[8px] px-1 py-0.5 rounded bg-mc-accent/10 text-mc-accent-hover">{t('friends.lanUser')}</span>}</p>
                      <p className="text-[10px] text-mc-muted font-mono">{f.ip}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.online ? <span className="flex items-center gap-1 text-[10px] text-mc-green"><Wifi size={11} />{t('friends.online')}</span>
                      : <span className="flex items-center gap-1 text-[10px] text-mc-muted"><WifiOff size={11} />{t('friends.offline')}</span>}
                    {!f.lanOnly && (
                      <button onClick={async () => { await window.electronAPI.mc.removeFriend(f.id); refresh(); }}
                        className="p-1.5 rounded-lg hover:bg-mc-red/10 text-mc-muted hover:text-mc-red transition-all"><Trash2 size={12} /></button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
