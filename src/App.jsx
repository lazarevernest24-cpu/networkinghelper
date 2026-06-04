import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Users, Upload, Plus, Settings, Search, ArrowLeft, Sparkles,
  Phone, Mail, Building2, Tag, Clock, MessageCircle, Lightbulb,
  TrendingUp, AlertTriangle, Loader2, X, Check, FileText, Trash2,
  Calendar, Briefcase, BookOpen, Network, Target, Zap, User,
  ChevronRight, BarChart3, GitBranch, Share2, Star,
  LogOut, UserPlus, Coffee, Copy, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import { parseVCard, sampleVCard } from './lib/vcard.js';
import {
  scoreContact, generateIcebreaker, generateMeetingIdeas,
  generateBriefing, analyzeNetwork, findJobConnections, recommendIntroductions,
  getApiKey, setApiKey
} from './lib/ai.js';
import {
  getProfiles, createProfile, deleteProfile, updateProfile,
  getActiveProfileId, setActiveProfileId,
  loadContacts, saveContacts
} from './lib/storage.js';
import {
  hasSupabase, getCurrentUser, signIn, signUp, signOut,
  dbLoadContacts, dbSaveAllContacts, dbDeleteContact, dbSaveContact
} from './lib/supabase.js';

function uid() { return 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function daysSince(ts) { return ts ? Math.floor((Date.now() - ts) / 86400000) : null; }
function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
}
const PALETTE = ['#1F4E3D','#B8451C','#B8893A','#3A5478','#7A4B6B','#3F6B4F','#4B6B3A','#6B3A5C'];
function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ─── ROOT ───────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState('loading'); // loading | auth | profiles | app
  const [sbUser, setSbUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileIdState] = useState(null);

  useEffect(() => {
    if (hasSupabase) {
      const user = getCurrentUser();
      if (user) { setSbUser(user); setMode('app'); }
      else setMode('auth');
    } else {
      // No Supabase — use local profiles
      const p = getProfiles();
      setProfiles(p);
      const aid = getActiveProfileId();
      if (aid && p.find(x => x.id === aid)) { setActiveProfileIdState(aid); setMode('app'); }
      else setMode('profiles');
    }
  }, []);

  const handleAuthSuccess = (user) => { setSbUser(user); setMode('app'); };
  const handleLogout = async () => {
    if (hasSupabase) { await signOut(); setSbUser(null); setMode('auth'); }
    else { setActiveProfileIdState(null); setMode('profiles'); }
  };

  // Bio хранится в localStorage для всех режимов
  const getBio = (userId) => localStorage.getItem(`nh_bio_${userId}`) || '';
  const saveBio = (userId, bio) => localStorage.setItem(`nh_bio_${userId}`, bio);

  const activeProfile = hasSupabase
    ? { id: sbUser?.id, name: sbUser?.user_metadata?.name || sbUser?.email?.split('@')[0] || 'Пользователь', bio: getBio(sbUser?.id) }
    : profiles.find(p => p.id === activeProfileId);

  if (mode === 'loading') return <Splash />;
  if (mode === 'auth') return <AuthScreen onSuccess={handleAuthSuccess} />;
  if (mode === 'profiles') return (
    <ProfileSelectScreen
      profiles={profiles}
      onSelect={(id) => { setActiveProfileIdState(id); setActiveProfileId(id); setMode('app'); }}
      onCreate={(name, bio) => {
        const p = createProfile(name, bio);
        setProfiles(getProfiles());
        setActiveProfileIdState(p.id);
        setActiveProfileId(p.id);
        setMode('app');
      }}
    />
  );
  if (mode === 'app' && activeProfile) return (
    <MainApp
      profile={activeProfile}
      useSupabase={hasSupabase}
      onLogout={handleLogout}
      onUpdateProfile={(patch) => {
        if (hasSupabase && patch.bio !== undefined) {
          saveBio(sbUser?.id, patch.bio);
          setSbUser(prev => ({ ...prev, _bioUpdated: Date.now() })); // force re-render
        } else if (!hasSupabase) {
          updateProfile(activeProfile.id, patch);
          setProfiles(getProfiles());
        }
      }}
    />
  );
  return <Splash />;
}

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#0F1A14'}}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4">
          <Network className="w-8 h-8 text-white" />
        </div>
        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mx-auto" />
      </div>
    </div>
  );
}

// ─── AUTH SCREEN ────────────────────────────────────────────────
function AuthScreen({ onSuccess }) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const submit = async () => {
    if (!email || !password) return;
    setLoading(true); setError('');
    try {
      let data;
      if (tab === 'login') data = await signIn(email, password);
      else data = await signUp(email, password, name || email.split('@')[0]);
      onSuccess(data.user);
    } catch (e) {
      setError(e.message.includes('Invalid login') ? 'Неверный email или пароль' : e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'#0F1A14'}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/50">
            <Network className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white" style={{fontFamily:'Fraunces, Georgia, serif'}}>NetHelper</h1>
          <p className="text-emerald-400/60 text-sm mt-1">Твоя сеть — твой капитал</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
            {['login','register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-emerald-600 text-white' : 'text-white/50 hover:text-white'}`}>
                {t === 'login' ? 'Войти' : 'Регистрация'}
              </button>
            ))}
          </div>

          {tab === 'register' && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Твоё имя"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 text-sm" />
          )}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 text-sm" />
          <div className="relative">
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль"
              type={showPass ? 'text' : 'password'}
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 text-sm pr-11" />
            <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>}

          <button onClick={submit} disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {tab === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE SELECT (local mode fallback) ───────────────────────
function ProfileSelectScreen({ profiles, onSelect, onCreate }) {
  const [creating, setCreating] = useState(profiles.length === 0);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'#0F1A14'}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Network className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white" style={{fontFamily:'Fraunces, Georgia, serif'}}>NetHelper</h1>
        </div>
        {!creating ? (
          <div className="space-y-3">
            {profiles.map(p => (
              <button key={p.id} onClick={() => onSelect(p.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{background: avatarColor(p.name)}}>
                  {initials(p.name)}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white font-semibold text-sm">{p.name}</div>
                  <div className="text-white/40 text-xs">{p.bio || 'Без описания'}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>
            ))}
            <button onClick={() => setCreating(true)}
              className="w-full p-3 rounded-2xl border border-dashed border-white/20 text-white/40 hover:text-emerald-400 text-sm transition-all">
              + Новый профиль
            </button>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="text-white font-semibold" style={{fontFamily:'Fraunces, Georgia, serif'}}>Создай профиль</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Твоё имя"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 text-sm" />
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Кто ты, чем занимаешься…" rows={2}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 text-sm resize-none" />
            <div className="flex gap-3">
              {profiles.length > 0 && <button onClick={() => setCreating(false)} className="flex-1 py-3 rounded-xl border border-white/20 text-white/60 text-sm">Назад</button>}
              <button onClick={() => name.trim() && onCreate(name.trim(), bio.trim())} disabled={!name.trim()}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-40">Начать →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────
function MainApp({ profile, useSupabase, onLogout, onUpdateProfile }) {
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const hasKey = !isLocalhost || !!getApiKey();

  useEffect(() => {
    const load = async () => {
      setLoadingContacts(true);
      try {
        if (useSupabase) {
          const data = await dbLoadContacts();
          setContacts(data);
        } else {
          setContacts(loadContacts(profile.id));
        }
      } catch (e) { console.error(e); }
      setLoadingContacts(false);
    };
    load();
  }, [profile.id]);

  const persistContacts = useCallback(async (updated) => {
    setContacts(updated);
    if (!useSupabase) saveContacts(profile.id, updated);
  }, [profile.id, useSupabase]);

  const addContact = useCallback(async (c) => {
    const newC = { id: uid(), tags: [], reminderDays: 60, lastContact: null, createdAt: Date.now(), context: '', notes: '', interests: '', canHelpMe: '', canHelpThem: '', goals: '', ...c };
    if (useSupabase) {
      try { const saved = await dbSaveContact(newC, profile.id); setContacts(prev => [saved, ...prev]); }
      catch { setContacts(prev => [newC, ...prev]); }
    } else {
      setContacts(prev => { const updated = [newC, ...prev]; saveContacts(profile.id, updated); return updated; });
    }
  }, [profile.id, useSupabase]);

  const updateContact = useCallback(async (id, patch) => {
    setContacts(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...patch } : c);
      if (!useSupabase) saveContacts(profile.id, updated);
      return updated;
    });
    if (useSupabase) {
      const contact = contacts.find(c => c.id === id);
      if (contact) { try { await dbSaveContact({ ...contact, ...patch }, profile.id); } catch {} }
    }
  }, [contacts, profile.id, useSupabase]);

  const deleteContact = useCallback(async (id) => {
    const contact = contacts.find(c => c.id === id);
    setContacts(prev => { const updated = prev.filter(c => c.id !== id); if (!useSupabase) saveContacts(profile.id, updated); return updated; });
    if (useSupabase && contact?._dbId) { try { await dbDeleteContact(contact._dbId); } catch {} }
    setView('list'); setSelectedId(null);
  }, [contacts, profile.id, useSupabase]);

  const importContacts = useCallback(async (list) => {
    const enriched = list.map(c => ({ ...c, id: uid() }));
    setContacts(prev => {
      const updated = [...enriched, ...prev];
      if (!useSupabase) saveContacts(profile.id, updated);
      return updated;
    });
    if (useSupabase) { try { await dbSaveAllContacts(enriched, profile.id); } catch {} }
  }, [profile.id, useSupabase]);

  const selected = contacts.find(c => c.id === selectedId);

  const reminders = useMemo(() => contacts
    .map(c => ({ c, days: daysSince(c.lastContact) }))
    .filter(({ c, days }) => days === null || days >= (c.reminderDays || 60))
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))
    .slice(0, 5), [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.position?.toLowerCase().includes(q) ||
      c.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [contacts, search]);

  const navTo = (v, id) => { setView(v); if (id !== undefined) setSelectedId(id); setSidebarOpen(false); };

  return (
    <div className="min-h-screen flex" style={{background:'#F5F1E8'}}>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <Sidebar profile={profile} contactsCount={contacts.length} view={view} isOpen={sidebarOpen}
        onImport={() => { setShowImport(true); setSidebarOpen(false); }}
        onAdd={() => { setShowAdd(true); setSidebarOpen(false); }}
        onSettings={() => { setShowSettings(true); setSidebarOpen(false); }}
        onHome={() => navTo('list')} onGraph={() => navTo('graph')}
        onNetworkAI={() => navTo('network-ai')} onLogout={onLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-black/10 bg-white/60 backdrop-blur-sm sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-1 rounded-xl hover:bg-black/5">
            <div className="space-y-1.5">{[0,1,2].map(i => <div key={i} className="w-5 h-0.5 bg-stone-700 rounded" />)}</div>
          </button>
          <span className="font-bold text-stone-800 text-sm" style={{fontFamily:'Fraunces, Georgia, serif'}}>NetHelper</span>
          {view !== 'list' && view !== 'graph' && view !== 'network-ai' && (
            <button onClick={() => navTo('list')} className="ml-auto text-stone-500 text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>
          )}
        </div>

        <main className="flex-1 overflow-auto px-4 md:px-8 py-6 md:py-8">
          {loadingContacts ? (
            <div className="flex items-center justify-center py-24 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mr-3" /> Загружаю контакты…
            </div>
          ) : (
            <>
              {view === 'list' && <ListView search={search} setSearch={setSearch} reminders={reminders} contacts={filtered}
                totalCount={contacts.length} onOpen={(id) => navTo('detail', id)} onImport={() => setShowImport(true)}
                onAdd={() => setShowAdd(true)} onGraph={() => navTo('graph')} onNetworkAI={() => navTo('network-ai')} />}
              {view === 'detail' && selected && <DetailView contact={selected} profile={profile.bio}
                onBack={() => navTo('list')} onUpdate={(patch) => updateContact(selected.id, patch)}
                onDelete={() => deleteContact(selected.id)} hasKey={hasKey} onNeedKey={() => setShowSettings(true)} />}
              {view === 'graph' && <NetworkGraphView contacts={contacts} onSelectContact={(id) => navTo('detail', id)} onBack={() => navTo('list')} />}
              {view === 'network-ai' && <NetworkAIView contacts={contacts} profile={profile.bio} hasKey={hasKey}
                onNeedKey={() => setShowSettings(true)} onBack={() => navTo('list')} />}
            </>
          )}
        </main>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importContacts} />}
      {showSettings && <SettingsModal profile={profile} onUpdateProfile={onUpdateProfile}
        onClose={() => setShowSettings(false)} useSupabase={useSupabase} />}
      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} onSave={(c) => { addContact(c); setShowAdd(false); }} />}
    </div>
  );
}

// ─── SIDEBAR ────────────────────────────────────────────────────
function Sidebar({ profile, contactsCount, view, isOpen, onImport, onAdd, onSettings, onHome, onGraph, onNetworkAI, onLogout }) {
  const navItems = [
    { icon: Users, label: 'Контакты', view: 'list', action: onHome, count: contactsCount },
    { icon: GitBranch, label: 'Граф сети', view: 'graph', action: onGraph },
    { icon: BarChart3, label: 'ИИ-анализ', view: 'network-ai', action: onNetworkAI },
  ];
  return (
    <aside className={`fixed md:sticky top-0 h-screen z-40 md:z-auto w-72 flex flex-col bg-stone-900 text-white transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/50">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white tracking-tight" style={{fontFamily:'Fraunces, Georgia, serif'}}>NetHelper</div>
            <div className="text-[10px] uppercase tracking-widest text-emerald-400/60">Personal CRM</div>
          </div>
        </div>
      </div>
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{background: avatarColor(profile.name)}}>
            {initials(profile.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold truncate">{profile.name}</div>
            <div className="text-white/40 text-xs truncate">{profile.bio || 'Без описания'}</div>
          </div>
          <button onClick={onLogout} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors" title="Выйти">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <button key={item.view} onClick={item.action}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${view === item.view ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
            <item.icon className="w-4 h-4 flex-shrink-0" /> {item.label}
            {item.count !== undefined && <span className="ml-auto text-xs font-mono opacity-60">{item.count}</span>}
          </button>
        ))}
        <div className="pt-4 border-t border-white/10 space-y-1">
          <button onClick={onAdd} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all">
            <Plus className="w-4 h-4" /> Добавить контакт
          </button>
          <button onClick={onImport} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all">
            <Upload className="w-4 h-4" /> Импорт .vcf
          </button>
        </div>
      </nav>
      <div className="p-4 border-t border-white/10">
        <button onClick={onSettings} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">
          <Settings className="w-4 h-4" /> Настройки
        </button>
      </div>
    </aside>
  );
}

// ─── LIST VIEW ──────────────────────────────────────────────────
function ListView({ search, setSearch, reminders, contacts, totalCount, onOpen, onImport, onAdd, onGraph, onNetworkAI }) {
  if (totalCount === 0) return <EmptyState onImport={onImport} onAdd={onAdd} />;
  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-none" style={{fontFamily:'Fraunces, Georgia, serif'}}>Карьерная сеть</h1>
          <p className="text-stone-500 mt-2 text-sm">Твои контакты — твои инвестиции</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onGraph} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors">
            <GitBranch className="w-4 h-4" /> Граф
          </button>
          <button onClick={onNetworkAI} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors">
            <Sparkles className="w-4 h-4" /> ИИ-анализ
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Всего контактов', value: totalCount, icon: Users, color: 'text-stone-700' },
          { label: 'Нужно написать', value: reminders.length, icon: AlertTriangle, color: 'text-amber-600' },
          { label: 'С компанией', value: contacts.filter(c=>c.company).length, icon: Building2, color: 'text-emerald-700' },
          { label: 'С контекстом', value: contacts.filter(c=>c.context||c.interests).length, icon: BookOpen, color: 'text-blue-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-black/5">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <div className="text-2xl font-bold text-stone-900 leading-none">{s.value}</div>
            <div className="text-xs text-stone-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени, компании, тегам…"
          className="w-full pl-11 pr-4 py-3 bg-white border border-black/10 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
      </div>

      {reminders.length > 0 && !search && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="font-bold text-stone-900" style={{fontFamily:'Fraunces, Georgia, serif'}}>Пора написать</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{reminders.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reminders.map(({ c, days }) => (
              <button key={c.id} onClick={() => onOpen(c.id)} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left hover:border-amber-400 transition-all">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-900 truncate text-sm">{c.name}</div>
                    <div className="text-xs text-stone-500 truncate">{c.position || c.company || 'Контакт'}</div>
                  </div>
                  <div className="text-xs text-amber-700 font-bold">{days === null ? 'Не писали' : `${days}д`}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        {contacts.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-12">Ничего не найдено</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map(c => <ContactCard key={c.id} contact={c} onClick={() => onOpen(c.id)} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function ContactCard({ contact, onClick }) {
  const days = daysSince(contact.lastContact);
  const hasContext = contact.context || contact.interests;
  return (
    <button onClick={onClick} className="bg-white rounded-2xl p-4 border border-black/5 text-left hover:border-emerald-400 hover:-translate-y-0.5 hover:shadow-md transition-all group">
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={contact.name} size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-stone-900 truncate text-sm">{contact.name}</div>
          <div className="text-xs text-stone-400 truncate">
            {contact.position && contact.company ? `${contact.position} · ${contact.company}` : contact.position || contact.company || '—'}
          </div>
        </div>
        {hasContext && <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />}
      </div>
      {contact.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {contact.tags.slice(0, 3).map((t, i) => <span key={i} className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-xs">{t}</span>)}
        </div>
      )}
      <div className="text-xs text-stone-400 flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        {days === null ? 'Ещё не общались' : `${days} дн. назад`}
      </div>
    </button>
  );
}

function Avatar({ name, size = 'md' }) {
  const s = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' }[size];
  return (
    <div className={`${s} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`} style={{background: avatarColor(name)}}>
      {initials(name)}
    </div>
  );
}

function EmptyState({ onImport, onAdd }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 rounded-2xl bg-emerald-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-200">
        <Network className="w-9 h-9 text-white" />
      </div>
      <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-3 tracking-tight" style={{fontFamily:'Fraunces, Georgia, serif'}}>Начни строить сеть</h1>
      <p className="text-stone-500 max-w-sm mb-8 text-sm">Импортируй контакты из телефона или добавь вручную. ИИ оценит связи и найдёт возможности.</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onImport} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-stone-900 text-white font-semibold hover:bg-stone-800 transition-colors">
          <Upload className="w-4 h-4" /> Импорт .vcf
        </button>
        <button onClick={onAdd} className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-black/15 text-stone-700 font-semibold hover:bg-black/5 transition-colors">
          <Plus className="w-4 h-4" /> Добавить вручную
        </button>
      </div>
    </div>
  );
}

// ─── DETAIL VIEW ─────────────────────────────────────────────────
function DetailView({ contact, profile, onBack, onUpdate, onDelete, hasKey, onNeedKey }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(contact);
  const [aiTab, setAiTab] = useState('score');
  useEffect(() => { setDraft(contact); }, [contact.id]);
  const days = daysSince(contact.lastContact);
  const saveDraft = () => { onUpdate(draft); setEditing(false); };

  return (
    <div className="max-w-3xl space-y-5">
      <button onClick={onBack} className="hidden md:flex items-center gap-2 text-stone-400 hover:text-stone-700 transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> К списку
      </button>

      <div className="bg-white rounded-2xl p-6 border border-black/5">
        <div className="flex flex-col md:flex-row md:items-start gap-5 mb-6">
          <Avatar name={contact.name} size="lg" />
          <div className="flex-1">
            {editing
              ? <input value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} className="text-3xl font-bold text-stone-900 bg-transparent border-b-2 border-emerald-500 focus:outline-none w-full" style={{fontFamily:'Fraunces, Georgia, serif'}} />
              : <h1 className="text-3xl font-bold text-stone-900 tracking-tight" style={{fontFamily:'Fraunces, Georgia, serif'}}>{contact.name}</h1>}
            {editing
              ? <div className="flex gap-2 mt-2"><input value={draft.position||''} onChange={e=>setDraft({...draft,position:e.target.value})} placeholder="Должность" className="field-sm flex-1"/><input value={draft.company||''} onChange={e=>setDraft({...draft,company:e.target.value})} placeholder="Компания" className="field-sm flex-1"/></div>
              : <p className="text-stone-500 mt-1 text-sm">{contact.position && contact.company ? `${contact.position} · ${contact.company}` : contact.position || contact.company || 'Без должности'}</p>}
          </div>
          <div className="flex gap-2">
            {editing
              ? <><button onClick={saveDraft} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"><Check className="w-4 h-4"/>Сохранить</button><button onClick={()=>{setDraft(contact);setEditing(false);}} className="px-4 py-2 rounded-xl border border-black/15 text-stone-600 text-sm hover:bg-black/5">Отмена</button></>
              : <><button onClick={()=>onUpdate({lastContact:Date.now()})} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700"><Check className="w-4 h-4"/>Записан</button><button onClick={()=>setEditing(true)} className="px-4 py-2 rounded-xl border border-black/15 text-stone-600 text-sm hover:bg-black/5">Ред.</button></>}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 border-t border-black/5">
          <MiniStat label="Последний контакт" value={days === null ? 'Не было' : `${days} дн.`}/>
          <MiniStat label="Напоминание" value={`каждые ${contact.reminderDays||60} дн.`}/>
          <MiniStat label="Телефон" value={contact.phone||'—'} mono/>
          <MiniStat label="Email" value={contact.email||'—'} small/>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-black/5">
        <h2 className="font-bold text-stone-900 mb-4 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}>
          <BookOpen className="w-5 h-5 text-emerald-600"/>Контекст
        </h2>
        <div className="space-y-4">
          {[
            {key:'context',label:'Где познакомились',ph:'ProductCamp 2025…',rows:2},
            {key:'interests',label:'Интересы',ph:'AI, стартапы…',rows:1},
            {key:'canHelpMe',label:'Чем поможет мне',ph:'Интро к инвесторам…',rows:1},
            {key:'canHelpThem',label:'Чем помогу я',ph:'Экспертиза, связи…',rows:1},
            {key:'goals',label:'Цели',ph:'Совместный проект…',rows:1},
            {key:'notes',label:'Заметки',ph:'О чём говорили…',rows:2},
          ].map(f=>(
            <div key={f.key}>
              <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-1">{f.label}</label>
              {editing
                ? <textarea value={draft[f.key]||''} onChange={e=>setDraft({...draft,[f.key]:e.target.value})} className="field resize-none" rows={f.rows} placeholder={f.ph}/>
                : <p className="text-stone-700 text-sm">{contact[f.key]||<span className="text-stone-300 italic">Не указано</span>}</p>}
            </div>
          ))}
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-1">Теги</label>
            {editing
              ? <input value={(draft.tags||[]).join(', ')} onChange={e=>setDraft({...draft,tags:e.target.value.split(',').map(t=>t.trim()).filter(Boolean)})} className="field" placeholder="продукт, ai, фаундер"/>
              : <div className="flex flex-wrap gap-1.5">{(contact.tags||[]).length===0&&<span className="text-stone-300 italic text-sm">Нет тегов</span>}{contact.tags?.map((t,i)=><span key={i} className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-medium">{t}</span>)}</div>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-black/5">
          <h2 className="font-bold text-stone-900 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}>
            <Sparkles className="w-5 h-5 text-emerald-600"/>ИИ-помощник
          </h2>
        </div>
        <div className="flex gap-1 p-2 overflow-x-auto border-b border-black/5">
          {[{id:'score',label:'Оценка',icon:TrendingUp},{id:'icebreaker',label:'Диалог',icon:MessageCircle},{id:'ideas',label:'Встреча',icon:Coffee},{id:'briefing',label:'Брифинг',icon:FileText}].map(t=>(
            <button key={t.id} onClick={()=>setAiTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${aiTab===t.id?'bg-stone-900 text-white':'text-stone-500 hover:text-stone-800 hover:bg-stone-50'}`}>
              <t.icon className="w-3.5 h-3.5"/>{t.label}
            </button>
          ))}
        </div>
        <div className="p-6">
          {aiTab==='score'&&<ScorePanel contact={contact} profile={profile} hasKey={hasKey}/>}
          {aiTab==='icebreaker'&&<IcebreakerPanel contact={contact} profile={profile} hasKey={hasKey}/>}
          {aiTab==='ideas'&&<IdeasPanel contact={contact} profile={profile} hasKey={hasKey}/>}
          {aiTab==='briefing'&&<BriefingPanel contact={contact} profile={profile} hasKey={hasKey}/>}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={()=>{if(confirm('Удалить контакт?'))onDelete();}} className="text-stone-400 hover:text-red-500 text-sm flex items-center gap-1.5 transition-colors">
          <Trash2 className="w-3.5 h-3.5"/>Удалить
        </button>
      </div>
    </div>
  );
}

function MiniStat({label,value,mono,small}){return(<div><div className="text-xs text-stone-400 mb-0.5">{label}</div><div className={`text-stone-800 font-semibold ${mono?'font-mono text-xs':small?'text-xs':'text-sm'} truncate`}>{value}</div></div>);}

// ─── NETWORK GRAPH (D3-style force with SVG) ────────────────────
function NetworkGraphView({ contacts, onSelectContact, onBack }) {
  const svgRef = useRef(null);
  const animRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    if (!svgRef.current || contacts.length === 0) return;
    const svg = svgRef.current;
    const W = svg.clientWidth || 800;
    const H = svg.clientHeight || 560;

    // Build nodes
    const centerX = W / 2, centerY = H / 2;
    const you = { id: '__you__', name: 'Вы', x: centerX, y: centerY, vx: 0, vy: 0, isYou: true, r: 28 };

    const groups = {};
    contacts.forEach(c => {
      const key = c.company || c.tags?.[0] || '—';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    const groupNames = Object.keys(groups);

    const nodes = [you];
    groupNames.forEach((g, gi) => {
      const angle = (gi / groupNames.length) * 2 * Math.PI - Math.PI / 2;
      const rad = Math.min(W, H) * 0.3;
      groups[g].forEach((c, ci) => {
        const spread = (ci - (groups[g].length - 1) / 2) * 0.4;
        const a = angle + spread;
        const r2 = rad + (Math.random() - 0.5) * 60;
        const days = daysSince(c.lastContact);
        nodes.push({
          id: c.id, name: c.name, company: c.company || '', position: c.position || '',
          group: g, color: avatarColor(c.name),
          x: centerX + Math.cos(a) * r2 + (Math.random()-0.5)*30,
          y: centerY + Math.sin(a) * r2 + (Math.random()-0.5)*30,
          vx: 0, vy: 0, r: 14,
          hasContext: !!(c.context || c.interests),
          stale: days !== null && days > (c.reminderDays || 60),
          days,
        });
      });
    });

    // Simple force simulation
    const K = 0.015, REPEL = 2200, LINK = 0.04;
    let frame = 0;

    function tick() {
      // Apply forces
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.isYou) continue;
        // Pull to initial position (weak spring)
        n.vx *= 0.85; n.vy *= 0.85;
        // Repel from other nodes
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const m = nodes[j];
          const dx = n.x - m.x, dy = n.y - m.y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 1;
          const force = REPEL / (dist * dist);
          n.vx += (dx / dist) * force * 0.01;
          n.vy += (dy / dist) * force * 0.01;
        }
        // Attract to center (weak)
        const dcx = centerX - n.x, dcy = centerY - n.y;
        const dc = Math.sqrt(dcx*dcx + dcy*dcy) || 1;
        const ideal = Math.min(W,H) * 0.3;
        n.vx += (dcx / dc) * (dc - ideal) * 0.003;
        n.vy += (dcy / dc) * (dc - ideal) * 0.003;
        n.x += n.vx; n.y += n.vy;
        // Bounds
        n.x = Math.max(n.r+10, Math.min(W-n.r-10, n.x));
        n.y = Math.max(n.r+10, Math.min(H-n.r-10, n.y));
      }
      renderSVG(nodes, W, H, svg, centerX, centerY, onSelectContact, setTooltip, setHoveredId);
      frame++;
      if (frame < 80) animRef.current = requestAnimationFrame(tick);
    }

    // Initial render immediately, then animate
    renderSVG(nodes, W, H, svg, centerX, centerY, onSelectContact, setTooltip, setHoveredId);
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [contacts]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="hidden md:flex items-center gap-2 text-stone-400 hover:text-stone-700 transition-colors text-sm"><ArrowLeft className="w-4 h-4"/>К списку</button>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight" style={{fontFamily:'Fraunces, Georgia, serif'}}>Граф сети</h1>
        <span className="text-sm text-stone-400">{contacts.length} контактов</span>
      </div>
      <div className="bg-stone-900 rounded-2xl overflow-hidden border border-stone-800">
        <div className="relative" style={{height:'520px'}}>
          {contacts.length === 0
            ? <div className="absolute inset-0 flex items-center justify-center text-stone-500 text-sm">Добавь контакты чтобы увидеть граф</div>
            : <svg ref={svgRef} className="w-full h-full" />}
          {tooltip && (
            <div className="absolute pointer-events-none bg-white text-stone-900 rounded-xl px-3 py-2 text-xs shadow-2xl z-10 border border-black/10"
              style={{left: Math.min(tooltip.x+15, 650), top: Math.max(tooltip.y-50, 8)}}>
              <div className="font-bold text-sm">{tooltip.name}</div>
              {tooltip.company && <div className="text-stone-500">{tooltip.company}</div>}
              {tooltip.position && <div className="text-stone-400">{tooltip.position}</div>}
              {tooltip.stale && <div className="text-amber-500 mt-1 font-medium">⚠ Пора написать</div>}
              <div className="text-emerald-500 mt-1 text-xs">Нажми чтобы открыть →</div>
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-stone-800 flex gap-6 text-xs text-stone-500">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/>Есть контекст</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-amber-400"/>Давно не писали</div>
          <div className="text-stone-600">Клик — открыть карточку</div>
        </div>
      </div>
    </div>
  );
}

function renderSVG(nodes, W, H, svg, cx, cy, onSelect, setTooltip, setHoveredId) {
  svg.innerHTML = '';

  // Background grid dots
  const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
  const pattern = document.createElementNS('http://www.w3.org/2000/svg','pattern');
  pattern.setAttribute('id','grid'); pattern.setAttribute('width','30'); pattern.setAttribute('height','30');
  pattern.setAttribute('patternUnits','userSpaceOnUse');
  const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
  dot.setAttribute('cx','1'); dot.setAttribute('cy','1'); dot.setAttribute('r','1'); dot.setAttribute('fill','#374151');
  pattern.appendChild(dot); defs.appendChild(pattern); svg.appendChild(defs);
  const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('width','100%'); bg.setAttribute('height','100%'); bg.setAttribute('fill','url(#grid)');
  svg.appendChild(bg);

  const you = nodes[0];

  // Group cluster backgrounds
  const groups = {};
  nodes.filter(n=>!n.isYou).forEach(n=>{
    if(!groups[n.group]) groups[n.group]=[];
    groups[n.group].push(n);
  });
  Object.entries(groups).forEach(([g, gNodes])=>{
    if(gNodes.length < 2) return;
    const avgX = gNodes.reduce((s,n)=>s+n.x,0)/gNodes.length;
    const avgY = gNodes.reduce((s,n)=>s+n.y,0)/gNodes.length;
    const maxR = Math.max(...gNodes.map(n=>Math.hypot(n.x-avgX,n.y-avgY)))+36;
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',avgX); c.setAttribute('cy',avgY); c.setAttribute('r',maxR);
    c.setAttribute('fill',gNodes[0].color); c.setAttribute('fill-opacity','0.06');
    c.setAttribute('stroke',gNodes[0].color); c.setAttribute('stroke-opacity','0.2'); c.setAttribute('stroke-width','1');
    svg.insertBefore(c, svg.firstChild.nextSibling);
    const t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',avgX); t.setAttribute('y',avgY-maxR-8);
    t.setAttribute('text-anchor','middle'); t.setAttribute('fill',gNodes[0].color);
    t.setAttribute('fill-opacity','0.6'); t.setAttribute('font-size','10'); t.setAttribute('font-weight','600');
    t.setAttribute('letter-spacing','0.08em');
    t.textContent = g.length > 16 ? g.slice(0,15)+'…' : g;
    svg.appendChild(t);
  });

  // Edges
  nodes.filter(n=>!n.isYou).forEach(n=>{
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',you.x); line.setAttribute('y1',you.y);
    line.setAttribute('x2',n.x); line.setAttribute('y2',n.y);
    line.setAttribute('stroke', n.stale ? '#f59e0b' : n.hasContext ? '#10b981' : '#374151');
    line.setAttribute('stroke-width', n.stale ? '1.5' : '1');
    line.setAttribute('stroke-dasharray', n.stale ? '5 4' : '');
    line.setAttribute('stroke-opacity', n.stale ? '0.5' : n.hasContext ? '0.4' : '0.25');
    svg.appendChild(line);
  });

  // Nodes
  nodes.forEach(node=>{
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('transform',`translate(${node.x},${node.y})`);
    g.setAttribute('cursor', node.isYou ? 'default' : 'pointer');

    // Glow for stale
    if(node.stale && !node.isYou){
      const glow = document.createElementNS('http://www.w3.org/2000/svg','circle');
      glow.setAttribute('r',node.r+8); glow.setAttribute('fill','none');
      glow.setAttribute('stroke','#f59e0b'); glow.setAttribute('stroke-width','2');
      glow.setAttribute('stroke-dasharray','3 3'); glow.setAttribute('opacity','0.7');
      g.appendChild(glow);
    }

    // Circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('r', node.r);
    circle.setAttribute('fill', node.isYou ? '#059669' : node.color);
    circle.setAttribute('stroke', node.isYou ? '#34d399' : '#1c1917');
    circle.setAttribute('stroke-width', node.isYou ? '3' : '1.5');
    circle.setAttribute('opacity', '0.95');
    g.appendChild(circle);

    // Initials
    const text = document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('text-anchor','middle'); text.setAttribute('dominant-baseline','central');
    text.setAttribute('fill','#fff'); text.setAttribute('font-size', node.isYou ? '11' : '9');
    text.setAttribute('font-weight','700');
    text.textContent = node.isYou ? 'ВЫ' : initials(node.name);
    g.appendChild(text);

    // Context dot
    if(node.hasContext && !node.isYou){
      const cdot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      cdot.setAttribute('cx',node.r*0.65); cdot.setAttribute('cy',-node.r*0.65);
      cdot.setAttribute('r','4'); cdot.setAttribute('fill','#10b981');
      cdot.setAttribute('stroke','#111827'); cdot.setAttribute('stroke-width','1.5');
      g.appendChild(cdot);
    }

    if(!node.isYou){
      g.addEventListener('click', ()=> onSelect(node.id));
      g.addEventListener('mouseenter', ()=>{
        circle.setAttribute('stroke','#34d399'); circle.setAttribute('stroke-width','2.5');
        setTooltip({name:node.name, company:node.company, position:node.position, stale:node.stale, x:node.x, y:node.y});
      });
      g.addEventListener('mouseleave', ()=>{
        circle.setAttribute('stroke','#1c1917'); circle.setAttribute('stroke-width','1.5');
        setTooltip(null);
      });
    }
    svg.appendChild(g);
  });
}

// ─── NETWORK AI VIEW ────────────────────────────────────────────
function NetworkAIView({ contacts, profile, hasKey, onNeedKey, onBack }) {
  const [activeTab, setActiveTab] = useState('analysis');
  const tabs = [
    {id:'analysis',label:'Анализ сети',icon:BarChart3},
    {id:'jobs',label:'Найти работу',icon:Briefcase},
    {id:'intros',label:'Познакомить',icon:Share2},
  ];
  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="hidden md:flex items-center gap-2 text-stone-400 hover:text-stone-700 transition-colors text-sm"><ArrowLeft className="w-4 h-4"/>К списку</button>
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight" style={{fontFamily:'Fraunces, Georgia, serif'}}>ИИ-анализ сети</h1>
          <p className="text-stone-400 text-sm">Превращаем контакты в возможности</p>
        </div>
      </div>
      <div className="flex gap-1 p-1 bg-white rounded-2xl border border-black/5 mb-6 w-fit">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab===t.id?'bg-stone-900 text-white':'text-stone-500 hover:text-stone-800'}`}>
            <t.icon className="w-4 h-4"/>{t.label}
          </button>
        ))}
      </div>
      {activeTab==='analysis'&&<NetworkAnalysisPanel contacts={contacts} profile={profile} hasKey={hasKey}/>}
      {activeTab==='jobs'&&<JobSearchPanel contacts={contacts} profile={profile} hasKey={hasKey}/>}
      {activeTab==='intros'&&<IntroductionsPanel contacts={contacts} profile={profile} hasKey={hasKey}/>}
    </div>
  );
}

// ─── AI PANELS ──────────────────────────────────────────────────
function useAIPanel(fn) {
  const [state, setState] = useState({loading:false,data:null,error:null});
  const run = useCallback(async (...args) => {
    setState({loading:true,data:null,error:null});
    try { const data = await fn(...args); setState({loading:false,data,error:null}); }
    catch(e) { setState({loading:false,data:null,error:e.message}); }
  }, []);
  return [state, run];
}

function ScorePanel({contact,profile,hasKey}){
  const [s,run]=useAIPanel(()=>scoreContact(contact,profile));
  if(s.loading)return<AILoader text="Анализирую связь…"/>;
  if(s.error)return<AIError text={s.error} onRetry={()=>run()}/>;
  if(!s.data)return<AIIntro title="Оценка контакта" desc="ИИ оценит ценность связи и риск её потерять." btn="Оценить" onRun={()=>run()}/>;
  const{score,risk,strengths=[],weaknesses=[],summary,action}=s.data;
  const rc={low:'text-emerald-600 bg-emerald-50',medium:'text-amber-600 bg-amber-50',high:'text-red-600 bg-red-50'}[risk]||'text-stone-600 bg-stone-100';
  const rl={low:'Низкий риск',medium:'Средний риск',high:'Высокий риск'}[risk]||risk;
  return(
    <div className="space-y-5">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#f5f1e8" strokeWidth="10"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke="#059669" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(score/100)*263.9} 263.9`}/>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-stone-900 leading-none" style={{fontFamily:'Fraunces, Georgia, serif'}}>{score}</div>
            <div className="text-xs text-stone-400">/ 100</div>
          </div>
        </div>
        <div className="flex-1">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${rc}`}>{rl}</span>
          <p className="text-stone-600 text-sm mt-3 leading-relaxed">{summary}</p>
          {action&&<div className="mt-3 flex items-start gap-2 text-sm"><Zap className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5"/><span className="text-emerald-700 font-medium">{action}</span></div>}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-black/5">
        {strengths.length>0&&<div><div className="text-xs uppercase tracking-widest text-emerald-600 font-semibold mb-2">Сильные стороны</div>{strengths.map((s,i)=><div key={i} className="flex gap-2 text-sm text-stone-600 mb-1.5"><Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5"/>{s}</div>)}</div>}
        {weaknesses.length>0&&<div><div className="text-xs uppercase tracking-widest text-red-500 font-semibold mb-2">Зоны риска</div>{weaknesses.map((s,i)=><div key={i} className="flex gap-2 text-sm text-stone-600 mb-1.5"><AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"/>{s}</div>)}</div>}
      </div>
      <button onClick={()=>run()} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3"/>Переоценить</button>
    </div>
  );
}

function IcebreakerPanel({contact,profile,hasKey}){
  const [s,run]=useAIPanel(()=>generateIcebreaker(contact,profile));
  if(s.loading)return<AILoader text="Подбираю слова…"/>;
  if(s.error)return<AIError text={s.error} onRetry={()=>run()}/>;
  if(!s.data)return<AIIntro title="Как начать диалог" desc="3 варианта сообщений под твой стиль." btn="Сгенерировать" onRun={()=>run()}/>;
  return(
    <div className="space-y-3">
      {s.data.messages?.map((m,i)=>(
        <div key={i} className="border border-black/8 rounded-2xl p-4">
          <div className="text-xs uppercase tracking-widest text-emerald-600 font-semibold mb-2">{m.style}</div>
          <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{m.text}</p>
          <button onClick={()=>navigator.clipboard?.writeText(m.text)} className="mt-3 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"><Copy className="w-3 h-3"/>Скопировать</button>
        </div>
      ))}
      <button onClick={()=>run()} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3"/>Ещё варианты</button>
    </div>
  );
}

function IdeasPanel({contact,profile,hasKey}){
  const [s,run]=useAIPanel(()=>generateMeetingIdeas(contact,profile));
  if(s.loading)return<AILoader text="Придумываю идеи…"/>;
  if(s.error)return<AIError text={s.error} onRetry={()=>run()}/>;
  if(!s.data)return<AIIntro title="Идеи для встречи" desc="Нестандартные форматы, полезные обеим сторонам." btn="Придумать" onRun={()=>run()}/>;
  return(
    <div className="grid md:grid-cols-2 gap-3">
      {s.data.ideas?.map((idea,i)=>(
        <div key={i} className="border border-black/8 rounded-2xl p-4 hover:border-emerald-300 transition-colors">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="font-semibold text-stone-900 text-sm">{idea.title}</div>
            <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full whitespace-nowrap">{idea.format}</span>
          </div>
          <p className="text-xs text-stone-500">{idea.description}</p>
          {idea.value&&<div className="mt-2 text-xs text-emerald-600 font-medium">→ {idea.value}</div>}
        </div>
      ))}
      <button onClick={()=>run()} className="col-span-full text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3"/>Ещё идеи</button>
    </div>
  );
}

function BriefingPanel({contact,profile,hasKey}){
  const [s,run]=useAIPanel(()=>generateBriefing(contact,profile));
  if(s.loading)return<AILoader text="Составляю брифинг…"/>;
  if(s.error)return<AIError text={s.error} onRetry={()=>run()}/>;
  if(!s.data)return<AIIntro title="Брифинг перед встречей" desc="Повестка, темы, цель и как начать разговор." btn="Подготовить" onRun={()=>run()}/>;
  const{agenda=[],talkingPoints=[],avoid=[],goal,openingLine}=s.data;
  return(
    <div className="space-y-5">
      {goal&&<div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4"><div className="text-xs uppercase tracking-widest text-emerald-600 font-semibold mb-1">Цель встречи</div><p className="text-emerald-800 font-medium text-sm">{goal}</p></div>}
      {openingLine&&<div className="bg-stone-50 border border-stone-100 rounded-2xl p-4"><div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-1">Как начать</div><p className="text-stone-700 text-sm italic">«{openingLine}»</p></div>}
      <div className="grid md:grid-cols-2 gap-4">
        {agenda.length>0&&<div><div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">Повестка</div>{agenda.map((a,i)=><div key={i} className="flex gap-2 text-sm text-stone-600 mb-1.5"><span className="text-stone-300 font-mono text-xs mt-0.5">{i+1}.</span>{a}</div>)}</div>}
        {talkingPoints.length>0&&<div><div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">Темы</div>{talkingPoints.map((t,i)=><div key={i} className="flex gap-2 text-sm text-stone-600 mb-1.5"><MessageCircle className="w-3.5 h-3.5 text-stone-300 flex-shrink-0 mt-0.5"/>{t}</div>)}</div>}
      </div>
      {avoid.length>0&&<div><div className="text-xs uppercase tracking-widest text-red-400 font-semibold mb-2">Чего избегать</div>{avoid.map((a,i)=><div key={i} className="flex gap-2 text-sm text-stone-500 mb-1"><X className="w-3.5 h-3.5 text-red-300 flex-shrink-0 mt-0.5"/>{a}</div>)}</div>}
      <button onClick={()=>run()} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3"/>Обновить</button>
    </div>
  );
}

function NetworkAnalysisPanel({contacts,profile,hasKey}){
  const [s,run]=useAIPanel(()=>analyzeNetwork(contacts,profile));
  if(contacts.length<3)return<div className="text-center py-12 text-stone-400 text-sm">Добавь хотя бы 3 контакта для анализа</div>;
  if(s.loading)return<AILoader text="Анализирую всю сеть…"/>;
  if(s.error)return<AIError text={s.error} onRetry={()=>run()}/>;
  if(!s.data)return<AIIntro title="Стратегический анализ" desc={`ИИ изучит ${contacts.length} контактов, найдёт дыры и карьерные возможности.`} btn="Запустить анализ" onRun={()=>run()}/>;
  const{networkScore,strengths=[],gaps=[],hotContacts=[],careerOpportunities=[],nextActions=[]}=s.data;
  return(
    <div className="space-y-6">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#f5f1e8" strokeWidth="10"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke="#059669" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(networkScore/100)*263.9} 263.9`}/>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-stone-900 leading-none" style={{fontFamily:'Fraunces, Georgia, serif'}}>{networkScore}</div>
            <div className="text-[10px] text-stone-400">сила сети</div>
          </div>
        </div>
        <div className="flex-1"><div className="font-bold text-stone-900 mb-2" style={{fontFamily:'Fraunces, Georgia, serif'}}>Твоя сеть</div><div className="flex flex-wrap gap-2">{strengths.map((s,i)=><span key={i} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">{s}</span>)}</div></div>
      </div>
      {gaps.length>0&&(<div><div className="font-semibold text-stone-900 mb-3 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}><AlertTriangle className="w-4 h-4 text-amber-500"/>Дыры в сети</div><div className="space-y-2">{gaps.map((g,i)=>(<div key={i} className={`p-4 rounded-2xl border ${g.priority==='high'?'bg-red-50 border-red-100':g.priority==='medium'?'bg-amber-50 border-amber-100':'bg-stone-50 border-stone-100'}`}><div className="flex items-center gap-2 mb-1"><span className="font-semibold text-sm text-stone-900">{g.area}</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.priority==='high'?'bg-red-100 text-red-700':g.priority==='medium'?'bg-amber-100 text-amber-700':'bg-stone-200 text-stone-600'}`}>{g.priority==='high'?'Критично':g.priority==='medium'?'Важно':'Желательно'}</span></div><p className="text-xs text-stone-500">{g.description}</p></div>))}</div></div>)}
      {hotContacts.length>0&&(<div><div className="font-semibold text-stone-900 mb-3 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}><Zap className="w-4 h-4 text-emerald-500"/>Написать срочно</div><div className="space-y-2">{hotContacts.map((h,i)=><div key={i} className="flex gap-2 text-sm text-stone-700 p-3 bg-emerald-50 rounded-xl border border-emerald-100"><Star className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5"/>{h}</div>)}</div></div>)}
      {careerOpportunities.length>0&&(<div><div className="font-semibold text-stone-900 mb-3 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}><Target className="w-4 h-4 text-blue-500"/>Карьерные возможности</div><div className="space-y-2">{careerOpportunities.map((o,i)=><div key={i} className="flex gap-2 text-sm text-stone-700 p-3 bg-blue-50 rounded-xl border border-blue-100"><ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5"/>{o}</div>)}</div></div>)}
      {nextActions.length>0&&(<div className="bg-stone-900 rounded-2xl p-5"><div className="text-white font-semibold mb-3 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}><Check className="w-4 h-4 text-emerald-400"/>Следующие шаги</div><div className="space-y-2">{nextActions.map((a,i)=><div key={i} className="flex gap-2 text-sm text-white/80"><span className="text-emerald-400 font-mono text-xs mt-0.5">{i+1}.</span>{a}</div>)}</div></div>)}
      <button onClick={()=>run()} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3"/>Обновить анализ</button>
    </div>
  );
}

function JobSearchPanel({contacts,profile,hasKey}){
  const [target,setTarget]=useState('');
  const [s,run]=useAIPanel((t)=>findJobConnections(contacts,profile,t));
  if(contacts.length<2)return<div className="text-center py-12 text-stone-400 text-sm">Добавь контакты для поиска возможностей</div>;
  if(s.loading)return<AILoader text="Ищу пути к работе мечты…"/>;
  if(s.error)return<AIError text={s.error} onRetry={()=>run(target)}/>;
  if(!s.data)return(
    <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100 space-y-4">
      <h3 className="font-bold text-stone-900" style={{fontFamily:'Fraunces, Georgia, serif'}}>Найти работу через сеть</h3>
      <input value={target} onChange={e=>setTarget(e.target.value)} placeholder="PM в Яндексе, стартап-фаундер, DevRel в Google…" className="field"/>
      <button onClick={()=>run(target)} className="px-6 py-3 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-700">Найти пути →</button>
    </div>
  );
  const{directConnections=[],referralPath=[],companiesReachable=[],strategyTips=[]}=s.data;
  return(
    <div className="space-y-6">
      {directConnections.length>0&&(<div><div className="font-semibold text-stone-900 mb-3 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}><Star className="w-4 h-4 text-emerald-500"/>Написать прямо сейчас</div><div className="space-y-3">{directConnections.map((d,i)=>(<div key={i} className="border border-black/8 rounded-2xl p-4"><div className="font-semibold text-stone-900 text-sm mb-1">{d.name}</div><p className="text-stone-500 text-xs mb-2">{d.reason}</p>{d.message&&<div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-600 italic">«{d.message}»</div>}</div>))}</div></div>)}
      {referralPath.length>0&&(<div><div className="font-semibold text-stone-900 mb-3" style={{fontFamily:'Fraunces, Georgia, serif'}}>Через рекомендации</div><div className="space-y-2">{referralPath.map((r,i)=>(<div key={i} className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm"><span className="font-medium text-stone-800">{r.contact}</span> → <span className="text-blue-700">{r.theyKnow}</span>{r.ask&&<div className="text-xs text-stone-500 mt-1">Попросить: {r.ask}</div>}</div>))}</div></div>)}
      {companiesReachable.length>0&&(<div><div className="font-semibold text-stone-900 mb-3" style={{fontFamily:'Fraunces, Georgia, serif'}}>Компании в досягаемости</div><div className="flex flex-wrap gap-2">{companiesReachable.map((c,i)=><span key={i} className="text-xs bg-white border border-black/10 text-stone-600 px-3 py-1.5 rounded-xl">{c}</span>)}</div></div>)}
      {strategyTips.length>0&&(<div className="bg-stone-900 rounded-2xl p-5"><div className="text-white font-semibold mb-3" style={{fontFamily:'Fraunces, Georgia, serif'}}>Стратегия</div>{strategyTips.map((t,i)=><div key={i} className="flex gap-2 text-sm text-white/80 mb-2"><ChevronRight className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5"/>{t}</div>)}</div>)}
      <button onClick={()=>run(target)} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3"/>Обновить</button>
    </div>
  );
}

function IntroductionsPanel({contacts,profile,hasKey}){
  const [s,run]=useAIPanel(()=>recommendIntroductions(contacts,profile));
  if(contacts.length<4)return<div className="text-center py-12 text-stone-400 text-sm">Нужно минимум 4 контакта</div>;
  if(s.loading)return<AILoader text="Ищу синергии в сети…"/>;
  if(s.error)return<AIError text={s.error} onRetry={()=>run()}/>;
  if(!s.data)return<AIIntro title="Познакомить правильных людей" desc="ИИ найдёт пары контактов, которым полезно познакомиться — и ты станешь ценным коннектором." btn="Найти пары" onRun={()=>run()}/>;
  const intros=s.data.introductions||[];
  return(
    <div className="space-y-4">
      {intros.map((intro,i)=>(
        <div key={i} className="border border-black/8 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-semibold text-stone-900 text-sm">{intro.person1}</span>
            <div className="flex-1 h-px bg-emerald-200 relative"><div className="absolute inset-0 flex items-center justify-center"><Share2 className="w-3.5 h-3.5 text-emerald-500 bg-white"/></div></div>
            <span className="font-semibold text-stone-900 text-sm">{intro.person2}</span>
          </div>
          <p className="text-stone-500 text-sm mb-3">{intro.synergy}</p>
          {intro.yourBenefit&&<div className="text-xs text-emerald-600 font-medium mb-3">💡 Твоя выгода: {intro.yourBenefit}</div>}
          {intro.template&&(<div className="bg-stone-50 rounded-xl p-3"><div className="text-xs uppercase tracking-widest text-stone-400 font-medium mb-1">Шаблон письма</div><p className="text-xs text-stone-600 italic leading-relaxed">«{intro.template}»</p><button onClick={()=>navigator.clipboard?.writeText(intro.template)} className="mt-2 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"><Copy className="w-3 h-3"/>Скопировать</button></div>)}
        </div>
      ))}
      <button onClick={()=>run()} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3"/>Другие пары</button>
    </div>
  );
}

function AIIntro({title,desc,btn,onRun}){
  return(
    <div className="text-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200"><Sparkles className="w-6 h-6 text-white"/></div>
      <div className="font-bold text-stone-900 text-lg mb-2" style={{fontFamily:'Fraunces, Georgia, serif'}}>{title}</div>
      <p className="text-stone-400 text-sm mb-6 max-w-sm mx-auto">{desc}</p>
      <button onClick={onRun} className="px-6 py-3 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-700 transition-colors">{btn}</button>
    </div>
  );
}
function AILoader({text}){return(<div className="flex items-center justify-center gap-3 py-14 text-stone-400"><Loader2 className="w-5 h-5 animate-spin text-emerald-500"/><span className="text-sm">{text}</span></div>);}
function AIError({text,onRetry}){return(<div className="border border-red-100 bg-red-50 rounded-2xl p-5"><div className="text-red-600 font-semibold mb-1 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>Ошибка</div><div className="text-stone-500 text-xs font-mono break-all mb-3">{text}</div><button onClick={onRetry} className="px-4 py-2 rounded-xl border border-black/10 text-stone-600 text-xs hover:bg-black/5">Попробовать снова</button></div>);}

// ─── IMPORT MODAL (simplified) ──────────────────────────────────
function ImportModal({ onClose, onImport }) {
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file) => {
    setError('');
    try {
      const text = await file.text();
      const list = parseVCard(text);
      if (!list.length) { setError('Контактов в формате vCard не найдено'); return; }
      setParsed(list);
    } catch (e) { setError('Не удалось прочитать файл: ' + e.message); }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <Modal onClose={onClose} title="Импорт контактов">
      {!parsed ? (
        <div className="space-y-5">
          {/* Drag & drop zone */}
          <div
            onDragOver={(e)=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${dragging?'border-emerald-500 bg-emerald-50':'border-stone-200 hover:border-emerald-400 hover:bg-emerald-50/30'}`}
          >
            <Upload className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <div className="font-semibold text-stone-700 mb-1">Перетащи .vcf файл сюда</div>
            <div className="text-stone-400 text-sm mb-4">или выбери файл</div>
            <label className="px-4 py-2 rounded-xl bg-stone-900 text-white text-sm font-medium cursor-pointer hover:bg-stone-700 transition-colors">
              Выбрать файл
              <input type="file" accept=".vcf,text/vcard" className="hidden" onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])}/>
            </label>
          </div>

          {/* How to export */}
          <div className="bg-stone-50 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-semibold text-stone-600 uppercase tracking-widest">Как экспортировать</div>
            <div className="text-xs text-stone-500 space-y-1.5">
              <div className="flex items-start gap-2"><span className="font-medium text-stone-700">iPhone:</span> Контакты → выдели нужных → Поделиться → Сохрани как .vcf</div>
              <div className="flex items-start gap-2"><span className="font-medium text-stone-700">Android:</span> Контакты → ⋮ → Экспорт → Выбери папку → .vcf файл</div>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>}

          <div className="text-center">
            <button onClick={() => setParsed(parseVCard(sampleVCard))} className="text-sm text-stone-400 hover:text-stone-700 underline">
              Загрузить демо-контакты
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-stone-600">Найдено <span className="font-bold text-emerald-600">{parsed.length}</span> контактов</div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">Готово к импорту</span>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 -mx-1 px-1">
            {parsed.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-stone-100 rounded-xl">
                <Avatar name={c.name} size="sm"/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-900 font-medium truncate">{c.name}</div>
                  <div className="text-xs text-stone-400 truncate">{c.company||c.email||c.phone||'—'}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setParsed(null)} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm hover:bg-stone-50">Назад</button>
            <button onClick={()=>{onImport(parsed);onClose();}} className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700">Импортировать всех</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── SETTINGS ───────────────────────────────────────────────────
function SettingsModal({ profile, onUpdateProfile, onClose, useSupabase }) {
  const [bio, setBio] = useState(profile.bio || '');
  const [key, setKey] = useState(getApiKey());
  const [saved, setSaved] = useState(false);
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const save = () => {
    onUpdateProfile({ bio: bio.trim() });
    if (isLocalhost) setApiKey(key);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  return (
    <Modal onClose={onClose} title="Настройки">
      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-2">
            О тебе (контекст для ИИ)
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            className="field"
            rows={4}
            placeholder="Кто ты, чем занимаешься, что ищешь… Например: продакт в финтехе, ищу партнёров для стартапа, интересуюсь AI"
          />
          <p className="text-xs text-stone-400 mt-1.5">ИИ использует это при анализе контактов и генерации сообщений</p>
        </div>
        {isLocalhost && (
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-2">API-ключ (только для localhost)</label>
            <input type="password" value={key} onChange={e => setKey(e.target.value)} className="field font-mono text-xs" placeholder="sk-ant-api03-…" />
          </div>
        )}
        <div className="flex gap-3 pt-2 border-t border-stone-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors">
            Отмена
          </button>
          <button onClick={save} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all ${saved ? 'bg-emerald-600' : 'bg-stone-900 hover:bg-stone-700'}`}>
            {saved ? '✓ Сохранено' : 'Сохранить'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── ADD CONTACT ─────────────────────────────────────────────────
function AddContactModal({ onClose, onSave }) {
  const [c, setC] = useState({
    name:'', position:'', company:'', phone:'', email:'',
    context:'', interests:'', canHelpMe:'', canHelpThem:'',
    goals:'', tags:'', notes:'', reminderDays: 60
  });
  const set = (k) => (e) => setC(prev => ({ ...prev, [k]: e.target.value }));
  const lbl = "text-xs uppercase tracking-widest text-stone-400 font-medium block mb-1.5";
  return (
    <Modal onClose={onClose} title="Новый контакт">
      <div className="space-y-4">
        <div>
          <label className={lbl}>Имя *</label>
          <input value={c.name} onChange={set('name')} className="field" placeholder="Анна Петрова" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Должность</label>
            <input value={c.position} onChange={set('position')} className="field" placeholder="Product Manager" />
          </div>
          <div>
            <label className={lbl}>Компания</label>
            <input value={c.company} onChange={set('company')} className="field" placeholder="TechCorp" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Телефон</label>
            <input value={c.phone} onChange={set('phone')} className="field" placeholder="+7 999…" />
          </div>
          <div>
            <label className={lbl}>Email</label>
            <input value={c.email} onChange={set('email')} className="field" placeholder="email@…" />
          </div>
        </div>
        <div>
          <label className={lbl}>Где познакомились</label>
          <textarea value={c.context} onChange={set('context')} className="field resize-none" rows={2} placeholder="ProductCamp 2025, после доклада про AI…" />
        </div>
        <div>
          <label className={lbl}>Интересы</label>
          <input value={c.interests} onChange={set('interests')} className="field" placeholder="AI, стартапы, продукт…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Чем поможет мне</label>
            <textarea value={c.canHelpMe} onChange={set('canHelpMe')} className="field resize-none" rows={2} placeholder="Интро к инвесторам…" />
          </div>
          <div>
            <label className={lbl}>Чем помогу я</label>
            <textarea value={c.canHelpThem} onChange={set('canHelpThem')} className="field resize-none" rows={2} placeholder="Экспертиза, связи…" />
          </div>
        </div>
        <div>
          <label className={lbl}>Теги через запятую</label>
          <input value={c.tags} onChange={set('tags')} className="field" placeholder="продукт, ai, фаундер" />
        </div>
        <div>
          <label className={lbl}>Заметки</label>
          <textarea value={c.notes} onChange={set('notes')} className="field resize-none" rows={2} placeholder="О чём говорили, общие темы…" />
        </div>
        <div>
          <label className={lbl}>Напоминать каждые</label>
          <div className="flex gap-2">
            {[30, 60, 90].map(d => (
              <button key={d} type="button" onClick={() => setC(prev => ({ ...prev, reminderDays: d }))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${c.reminderDays === d ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                {d} дн.
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2 border-t border-stone-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors">
            Отмена
          </button>
          <button
            onClick={() => c.name.trim() && onSave({ ...c, tags: c.tags.split(',').map(t => t.trim()).filter(Boolean) })}
            disabled={!c.name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Добавить
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────
function Modal({ children, onClose, title }) {
  useEffect(() => {
    const fn = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', fn); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="relative bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e=>e.stopPropagation()}>
        <header className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="font-bold text-stone-900 text-lg" style={{fontFamily:'Fraunces, Georgia, serif'}}>{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1"><X className="w-5 h-5"/></button>
        </header>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}
