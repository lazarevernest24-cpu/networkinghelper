import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Users, Upload, Plus, Settings, Search, ArrowLeft, Sparkles,
  Phone, Mail, Building2, Tag, Clock, MessageCircle, Lightbulb,
  TrendingUp, AlertTriangle, Loader2, X, Check, FileText, Trash2,
  Calendar, Briefcase, BookOpen, Network, Target, Zap, User,
  ChevronRight, BarChart3, GitBranch, Share2, MapPin, Star,
  LogOut, UserPlus, Coffee, Send, Copy, RefreshCw, Globe
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
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileIdState] = useState(null);
  const [showProfileSelect, setShowProfileSelect] = useState(false);

  useEffect(() => {
    const p = getProfiles();
    setProfiles(p);
    const aid = getActiveProfileId();
    if (aid && p.find(x => x.id === aid)) {
      setActiveProfileIdState(aid);
    } else if (p.length === 0) {
      setShowProfileSelect(true);
    } else {
      setShowProfileSelect(true);
    }
  }, []);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const handleCreateProfile = (name, bio) => {
    const p = createProfile(name, bio);
    setProfiles(getProfiles());
    setActiveProfileIdState(p.id);
    setActiveProfileId(p.id);
    setShowProfileSelect(false);
  };

  const handleSelectProfile = (id) => {
    setActiveProfileIdState(id);
    setActiveProfileId(id);
    setShowProfileSelect(false);
  };

  const handleLogout = () => {
    setActiveProfileIdState(null);
    setShowProfileSelect(true);
  };

  if (showProfileSelect || !activeProfile) {
    return (
      <ProfileSelectScreen
        profiles={profiles}
        onSelect={handleSelectProfile}
        onCreate={handleCreateProfile}
        onDeleteProfile={(id) => {
          deleteProfile(id);
          setProfiles(getProfiles());
        }}
      />
    );
  }

  return (
    <MainApp
      profile={activeProfile}
      onLogout={handleLogout}
      onUpdateProfile={(patch) => {
        updateProfile(activeProfile.id, patch);
        setProfiles(getProfiles());
      }}
    />
  );
}

// ─── PROFILE SELECT ─────────────────────────────────────────────
function ProfileSelectScreen({ profiles, onSelect, onCreate, onDeleteProfile }) {
  const [creating, setCreating] = useState(profiles.length === 0);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'#0F1A14'}}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/50">
            <Network className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight" style={{fontFamily:'Fraunces, Georgia, serif'}}>NetHelper</h1>
          <p className="text-emerald-400/70 text-sm mt-1">Твоя сеть — твой капитал</p>
        </div>

        {!creating ? (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-widest text-emerald-500/60 mb-4 text-center">Выбери профиль</div>
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{background: avatarColor(p.name)}}>
                  {initials(p.name)}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white font-semibold">{p.name}</div>
                  <div className="text-white/40 text-xs truncate">{p.bio || 'Профиль без описания'}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-emerald-400 transition-colors" />
              </button>
            ))}
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-white/20 text-white/50 hover:border-emerald-500/50 hover:text-emerald-400 transition-all text-sm mt-2"
            >
              <UserPlus className="w-4 h-4" /> Новый профиль
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
            <div className="text-white text-lg font-semibold" style={{fontFamily:'Fraunces, Georgia, serif'}}>
              {profiles.length === 0 ? 'Создай свой профиль' : 'Новый профиль'}
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-emerald-500/60 block mb-2">Твоё имя</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Иван Иванов"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-emerald-500/60 block mb-2">Кто ты (для ИИ-контекста)</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Продакт в FinTech, ищу инвесторов для стартапа, интересуюсь AI-продуктами…"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 text-sm resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              {profiles.length > 0 && (
                <button onClick={() => setCreating(false)} className="flex-1 py-3 rounded-xl border border-white/20 text-white/60 hover:text-white text-sm transition-colors">
                  Назад
                </button>
              )}
              <button
                onClick={() => name.trim() && onCreate(name.trim(), bio.trim())}
                disabled={!name.trim()}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Начать →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────
function MainApp({ profile, onLogout, onUpdateProfile }) {
  const [contacts, setContacts] = useState([]);
  const [view, setView] = useState('list'); // list | detail | graph | network-ai
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasKey, setHasKey] = useState(true); // proxy handles it on prod

  useEffect(() => {
    setContacts(loadContacts(profile.id));
    // on localhost require key
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setHasKey(!!getApiKey());
      if (!getApiKey()) setShowSettings(true);
    }
  }, [profile.id]);

  useEffect(() => { saveContacts(profile.id, contacts); }, [contacts, profile.id]);

  const selected = contacts.find(c => c.id === selectedId);

  const reminders = useMemo(() => {
    return contacts
      .map(c => ({ c, days: daysSince(c.lastContact) }))
      .filter(({ c, days }) => days === null || days >= (c.reminderDays || 60))
      .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))
      .slice(0, 5);
  }, [contacts]);

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

  const updateContact = (id, patch) => setContacts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  const deleteContact = (id) => { setContacts(prev => prev.filter(c => c.id !== id)); setView('list'); setSelectedId(null); };
  const addContact = (c) => {
    const newC = { id: uid(), tags: [], reminderDays: 60, lastContact: null, createdAt: Date.now(), context: '', notes: '', interests: '', canHelpMe: '', canHelpThem: '', goals: '', ...c };
    setContacts(prev => [newC, ...prev]);
  };
  const importContacts = (list) => setContacts(prev => [...list, ...prev]);

  const navTo = (v, id) => { setView(v); if (id) setSelectedId(id); setSidebarOpen(false); };

  return (
    <div className="min-h-screen flex" style={{background:'#F5F1E8'}}>
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <Sidebar
        profile={profile}
        contactsCount={contacts.length}
        view={view}
        isOpen={sidebarOpen}
        onImport={() => { setShowImport(true); setSidebarOpen(false); }}
        onAdd={() => { setShowAdd(true); setSidebarOpen(false); }}
        onSettings={() => { setShowSettings(true); setSidebarOpen(false); }}
        onHome={() => navTo('list')}
        onGraph={() => navTo('graph')}
        onNetworkAI={() => navTo('network-ai')}
        onLogout={onLogout}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-black/10 bg-white/60 backdrop-blur-sm sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-1 rounded-xl hover:bg-black/5">
            <div className="space-y-1"><div className="w-5 h-0.5 bg-stone-700"/><div className="w-5 h-0.5 bg-stone-700"/><div className="w-5 h-0.5 bg-stone-700"/></div>
          </button>
          <span className="font-bold text-stone-800 text-sm" style={{fontFamily:'Fraunces, Georgia, serif'}}>NetHelper</span>
          {view !== 'list' && view !== 'graph' && view !== 'network-ai' && (
            <button onClick={() => navTo('list')} className="ml-auto text-stone-500 text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>
          )}
        </div>

        <main className="flex-1 overflow-auto px-4 md:px-8 py-6 md:py-8">
          {view === 'list' && (
            <ListView
              search={search} setSearch={setSearch}
              reminders={reminders}
              contacts={filtered}
              totalCount={contacts.length}
              onOpen={(id) => navTo('detail', id)}
              onImport={() => setShowImport(true)}
              onAdd={() => setShowAdd(true)}
              onGraph={() => navTo('graph')}
              onNetworkAI={() => navTo('network-ai')}
            />
          )}
          {view === 'detail' && selected && (
            <DetailView
              contact={selected}
              profile={profile.bio}
              onBack={() => navTo('list')}
              onUpdate={(patch) => updateContact(selected.id, patch)}
              onDelete={() => deleteContact(selected.id)}
              hasKey={hasKey}
              onNeedKey={() => setShowSettings(true)}
            />
          )}
          {view === 'graph' && (
            <NetworkGraphView
              contacts={contacts}
              onSelectContact={(id) => navTo('detail', id)}
              onBack={() => navTo('list')}
            />
          )}
          {view === 'network-ai' && (
            <NetworkAIView
              contacts={contacts}
              profile={profile.bio}
              hasKey={hasKey}
              onNeedKey={() => setShowSettings(true)}
              onBack={() => navTo('list')}
            />
          )}
        </main>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importContacts} />}
      {showSettings && (
        <SettingsModal
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          onClose={() => { setShowSettings(false); if (window.location.hostname === 'localhost') setHasKey(!!getApiKey()); }}
        />
      )}
      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} onSave={(c) => { addContact(c); setShowAdd(false); }} />}
    </div>
  );
}

// ─── SIDEBAR ────────────────────────────────────────────────────
function Sidebar({ profile, contactsCount, view, isOpen, onImport, onAdd, onSettings, onHome, onGraph, onNetworkAI, onLogout }) {
  const navItems = [
    { icon: Users, label: 'Контакты', view: 'list', action: onHome, count: contactsCount },
    { icon: GitBranch, label: 'Граф сети', view: 'graph', action: onGraph },
    { icon: BarChart3, label: 'ИИ-анализ сети', view: 'network-ai', action: onNetworkAI },
  ];

  return (
    <aside className={`
      fixed md:sticky top-0 h-screen z-40 md:z-auto
      w-72 flex flex-col
      bg-stone-900 text-white
      transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
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
          <button onClick={onLogout} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors" title="Сменить профиль">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <button
            key={item.view}
            onClick={item.action}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              view === item.view
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
            {item.count !== undefined && (
              <span className="ml-auto text-xs font-mono opacity-60">{item.count}</span>
            )}
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
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-none" style={{fontFamily:'Fraunces, Georgia, serif'}}>
            Карьерная сеть
          </h1>
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

      {/* Quick stats */}
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

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени, компании, тегам…"
          className="w-full pl-11 pr-4 py-3 bg-white border border-black/10 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Reminders */}
      {reminders.length > 0 && !search && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="font-bold text-stone-900" style={{fontFamily:'Fraunces, Georgia, serif'}}>Пора написать</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{reminders.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reminders.map(({ c, days }) => (
              <button key={c.id} onClick={() => onOpen(c.id)} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left hover:border-amber-400 transition-all group">
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

      {/* Contacts grid */}
      <section>
        {contacts.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-12">Ничего не найдено</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map((c) => (
              <ContactCard key={c.id} contact={c} onClick={() => onOpen(c.id)} />
            ))}
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
            {contact.position && contact.company ? `${contact.position} · ${contact.company}` : (contact.position || contact.company || '—')}
          </div>
        </div>
        {hasContext && <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1" title="Есть контекст" />}
      </div>
      {contact.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {contact.tags.slice(0, 3).map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-xs">{t}</span>
          ))}
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
      <p className="text-stone-500 max-w-sm mb-8 text-sm">Импорт из телефона или добавь вручную. ИИ оценит связи и найдёт карьерные возможности.</p>
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
  const [aiTab, setAiTab] = useState('chat');

  useEffect(() => { setDraft(contact); }, [contact.id]);

  const saveDraft = () => { onUpdate(draft); setEditing(false); };
  const markContacted = () => onUpdate({ lastContact: Date.now() });
  const days = daysSince(contact.lastContact);

  return (
    <div className="max-w-3xl space-y-5">
      <button onClick={onBack} className="hidden md:flex items-center gap-2 text-stone-400 hover:text-stone-700 transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> К списку
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl p-6 border border-black/5">
        <div className="flex flex-col md:flex-row md:items-start gap-5 mb-6">
          <Avatar name={contact.name} size="lg" />
          <div className="flex-1">
            {editing ? (
              <input value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})}
                className="text-3xl font-bold text-stone-900 bg-transparent border-b-2 border-emerald-500 focus:outline-none w-full"
                style={{fontFamily:'Fraunces, Georgia, serif'}} />
            ) : (
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight" style={{fontFamily:'Fraunces, Georgia, serif'}}>{contact.name}</h1>
            )}
            {editing ? (
              <div className="flex gap-2 mt-2">
                <input value={draft.position || ''} onChange={e => setDraft({...draft, position: e.target.value})} placeholder="Должность" className="field-sm" />
                <input value={draft.company || ''} onChange={e => setDraft({...draft, company: e.target.value})} placeholder="Компания" className="field-sm" />
              </div>
            ) : (
              <p className="text-stone-500 mt-1 text-sm">{contact.position && contact.company ? `${contact.position} · ${contact.company}` : (contact.position || contact.company || 'Без должности')}</p>
            )}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={saveDraft} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500">
                  <Check className="w-4 h-4" /> Сохранить
                </button>
                <button onClick={() => { setDraft(contact); setEditing(false); }} className="px-4 py-2 rounded-xl border border-black/15 text-stone-600 text-sm hover:bg-black/5">Отмена</button>
              </>
            ) : (
              <>
                <button onClick={markContacted} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700">
                  <Check className="w-4 h-4" /> Контакт записан
                </button>
                <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-xl border border-black/15 text-stone-600 text-sm hover:bg-black/5">Ред.</button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 border-t border-black/5">
          <MiniStat label="Последний контакт" value={days === null ? 'Не было' : `${days} дн.`} />
          <MiniStat label="Напоминание" value={`каждые ${contact.reminderDays || 60} дн.`} />
          <MiniStat label="Телефон" value={contact.phone || '—'} mono />
          <MiniStat label="Email" value={contact.email || '—'} small />
        </div>
      </div>

      {/* Context fields */}
      <div className="bg-white rounded-2xl p-6 border border-black/5">
        <h2 className="font-bold text-stone-900 mb-4 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}>
          <BookOpen className="w-5 h-5 text-emerald-600" /> Контекст
        </h2>
        <div className="space-y-4">
          {[
            { key: 'context', label: 'Где познакомились', ph: 'ProductCamp 2025, после доклада про AI…', rows: 2 },
            { key: 'interests', label: 'Профессиональные интересы', ph: 'AI, стартапы, маркетинг…', rows: 1 },
            { key: 'canHelpMe', label: 'Чем может помочь мне', ph: 'Интро к инвесторам, совет по найму…', rows: 1 },
            { key: 'canHelpThem', label: 'Чем я могу помочь ему', ph: 'UX-экспертиза, связи в медиа…', rows: 1 },
            { key: 'goals', label: 'Цели по контакту', ph: 'Совместный проект, рекомендация…', rows: 1 },
            { key: 'notes', label: 'Заметки', ph: 'О чём говорили, планы…', rows: 2 },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-1">{f.label}</label>
              {editing ? (
                <textarea value={draft[f.key] || ''} onChange={e => setDraft({...draft, [f.key]: e.target.value})} className="field" rows={f.rows} placeholder={f.ph} />
              ) : (
                <p className="text-stone-700 text-sm">{contact[f.key] || <span className="text-stone-300 italic">Не указано</span>}</p>
              )}
            </div>
          ))}
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-1">Теги</label>
            {editing ? (
              <input value={(draft.tags||[]).join(', ')} onChange={e => setDraft({...draft, tags: e.target.value.split(',').map(t=>t.trim()).filter(Boolean)})} className="field" placeholder="продукт, ai, фаундер" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(contact.tags||[]).length === 0 && <span className="text-stone-300 italic text-sm">Нет тегов</span>}
                {contact.tags?.map((t, i) => <span key={i} className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-medium">{t}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Panel */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-black/5">
          <h2 className="font-bold text-stone-900 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}>
            <Sparkles className="w-5 h-5 text-emerald-600" /> ИИ-помощник
          </h2>
        </div>
        <div className="flex gap-1 p-2 overflow-x-auto">
          {[
            { id: 'score', label: 'Оценка', icon: TrendingUp },
            { id: 'icebreaker', label: 'Диалог', icon: MessageCircle },
            { id: 'ideas', label: 'Встреча', icon: Coffee },
            { id: 'briefing', label: 'Брифинг', icon: FileText },
          ].map(t => (
            <button key={t.id} onClick={() => setAiTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${aiTab === t.id ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <div className="p-6">
          {aiTab === 'score' && <ScorePanel contact={contact} profile={profile} hasKey={hasKey} />}
          {aiTab === 'icebreaker' && <IcebreakerPanel contact={contact} profile={profile} hasKey={hasKey} />}
          {aiTab === 'ideas' && <IdeasPanel contact={contact} profile={profile} hasKey={hasKey} />}
          {aiTab === 'briefing' && <BriefingPanel contact={contact} profile={profile} hasKey={hasKey} />}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => { if (confirm('Удалить контакт?')) onDelete(); }} className="text-stone-400 hover:text-red-500 text-sm flex items-center gap-1.5 transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> Удалить
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value, mono, small }) {
  return (
    <div>
      <div className="text-xs text-stone-400 mb-0.5">{label}</div>
      <div className={`text-stone-800 font-semibold ${mono ? 'font-mono text-xs' : small ? 'text-xs' : 'text-sm'} truncate`}>{value}</div>
    </div>
  );
}

// ─── NETWORK GRAPH ──────────────────────────────────────────────
function NetworkGraphView({ contacts, onSelectContact, onBack }) {
  const svgRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!svgRef.current || contacts.length === 0) return;
    drawGraph();
  }, [contacts]);

  const drawGraph = () => {
    const svg = svgRef.current;
    const W = svg.clientWidth || 800;
    const H = svg.clientHeight || 600;
    svg.innerHTML = '';

    // Group contacts by company/tag
    const groups = {};
    contacts.forEach(c => {
      const key = c.company || c.tags?.[0] || 'Другие';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    const groupNames = Object.keys(groups);
    const nodeRadius = Math.max(8, Math.min(18, 200 / contacts.length));
    const centerX = W / 2, centerY = H / 2;

    // Build nodes with force-like positions
    const nodes = [];
    const YOU = { id: '__you__', name: 'Вы', x: centerX, y: centerY, isYou: true };
    nodes.push(YOU);

    groupNames.forEach((gName, gi) => {
      const gAngle = (gi / groupNames.length) * 2 * Math.PI - Math.PI / 2;
      const gRadius = Math.min(W, H) * 0.32;
      const gx = centerX + Math.cos(gAngle) * gRadius;
      const gy = centerY + Math.sin(gAngle) * gRadius;

      groups[gName].forEach((c, ci) => {
        const spreadAngle = gAngle + (ci - groups[gName].length / 2) * 0.35;
        const spread = Math.min(W, H) * 0.13;
        const days = daysSince(c.lastContact);
        const hasContext = !!(c.context || c.interests);
        nodes.push({
          id: c.id,
          name: c.name,
          company: c.company || '',
          group: gName,
          x: gx + Math.cos(spreadAngle) * spread + (Math.random() - 0.5) * 20,
          y: gy + Math.sin(spreadAngle) * spread + (Math.random() - 0.5) * 20,
          days,
          hasContext,
          color: avatarColor(c.name),
          position: c.position || '',
          stale: days !== null && days > (c.reminderDays || 60),
        });
      });
    });

    // Defs
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    ['__you__', ...contacts.map(c=>c.id)].forEach((id, i) => {
      const node = nodes.find(n => n.id === id);
      if (!node) return;
      const grad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
      grad.setAttribute('id', `ng_${id.replace(/[^a-z0-9]/gi,'_')}`);
      const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', node.isYou ? '#10b981' : node.color); s1.setAttribute('stop-opacity', '1');
      const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', node.isYou ? '#059669' : node.color); s2.setAttribute('stop-opacity', '0.8');
      grad.appendChild(s1); grad.appendChild(s2);
      defs.appendChild(grad);
    });
    svg.appendChild(defs);

    // Edges from YOU to each node
    const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodes.filter(n => !n.isYou).forEach(n => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', YOU.x); line.setAttribute('y1', YOU.y);
      line.setAttribute('x2', n.x); line.setAttribute('y2', n.y);
      line.setAttribute('stroke', n.stale ? '#fbbf24' : '#e5e7eb');
      line.setAttribute('stroke-width', n.stale ? '1.5' : '1');
      line.setAttribute('stroke-dasharray', n.stale ? '4 4' : '');
      line.setAttribute('stroke-opacity', '0.6');
      edgeGroup.appendChild(line);
    });
    svg.appendChild(edgeGroup);

    // Group hulls (simple circles)
    groupNames.forEach((gName, gi) => {
      const gNodes = nodes.filter(n => n.group === gName);
      if (gNodes.length < 2) return;
      const avgX = gNodes.reduce((s,n)=>s+n.x,0)/gNodes.length;
      const avgY = gNodes.reduce((s,n)=>s+n.y,0)/gNodes.length;
      const maxR = Math.max(...gNodes.map(n => Math.hypot(n.x-avgX, n.y-avgY))) + 30;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', avgX); circle.setAttribute('cy', avgY); circle.setAttribute('r', maxR);
      circle.setAttribute('fill', avatarColor(gName)); circle.setAttribute('fill-opacity', '0.04');
      circle.setAttribute('stroke', avatarColor(gName)); circle.setAttribute('stroke-opacity', '0.15');
      circle.setAttribute('stroke-width', '1');
      svg.insertBefore(circle, edgeGroup);
      // label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', avgX); text.setAttribute('y', avgY - maxR - 6);
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('fill', avatarColor(gName));
      text.setAttribute('fill-opacity', '0.7'); text.setAttribute('font-size', '10');
      text.setAttribute('font-weight', '600'); text.setAttribute('letter-spacing', '0.05em');
      text.textContent = gName.length > 14 ? gName.slice(0,13)+'…' : gName;
      svg.appendChild(text);
    });

    // Nodes
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodes.forEach(node => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('cursor', node.isYou ? 'default' : 'pointer');
      g.setAttribute('transform', `translate(${node.x},${node.y})`);

      const r = node.isYou ? 24 : nodeRadius;

      // Stale ring
      if (node.stale && !node.isYou) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('r', r + 5); ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', '#f59e0b'); ring.setAttribute('stroke-width', '2');
        ring.setAttribute('stroke-dasharray', '3 3'); ring.setAttribute('opacity', '0.6');
        g.appendChild(ring);
      }

      // Circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', r);
      circle.setAttribute('fill', `url(#ng_${node.id.replace(/[^a-z0-9]/gi,'_')})`);
      circle.setAttribute('stroke', node.isYou ? '#fff' : '#fff');
      circle.setAttribute('stroke-width', node.isYou ? '3' : '2');
      g.appendChild(circle);

      // Initials
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('fill', '#fff');
      text.setAttribute('font-size', node.isYou ? '11' : Math.max(7, r * 0.55));
      text.setAttribute('font-weight', '700');
      text.textContent = node.isYou ? 'ВЫ' : initials(node.name);
      g.appendChild(text);

      // Context dot
      if (node.hasContext && !node.isYou) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', r * 0.7); dot.setAttribute('cy', -r * 0.7);
        dot.setAttribute('r', '4'); dot.setAttribute('fill', '#10b981');
        dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', '1.5');
        g.appendChild(dot);
      }

      if (!node.isYou) {
        g.addEventListener('click', () => onSelectContact(node.id));
        g.addEventListener('mouseenter', (e) => {
          circle.setAttribute('stroke-width', '3');
          setTooltip({ name: node.name, company: node.company, position: node.position, x: node.x, y: node.y, stale: node.stale });
        });
        g.addEventListener('mouseleave', () => {
          circle.setAttribute('stroke-width', '2');
          setTooltip(null);
        });
      }

      nodeGroup.appendChild(g);
    });
    svg.appendChild(nodeGroup);
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="hidden md:flex items-center gap-2 text-stone-400 hover:text-stone-700 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> К списку
        </button>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight" style={{fontFamily:'Fraunces, Georgia, serif'}}>Граф сети</h1>
        <span className="text-sm text-stone-400">{contacts.length} контактов</span>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="relative" style={{height: '520px'}}>
          {contacts.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-sm">
              Добавь контакты чтобы увидеть граф
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full" />
          )}
          {tooltip && (
            <div className="absolute pointer-events-none bg-stone-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl z-10"
              style={{ left: Math.min(tooltip.x + 15, 600), top: Math.max(tooltip.y - 40, 10) }}>
              <div className="font-semibold">{tooltip.name}</div>
              {tooltip.company && <div className="text-stone-400">{tooltip.company}</div>}
              {tooltip.stale && <div className="text-amber-400 mt-0.5">⚠ Давно не писали</div>}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-black/5 flex gap-6 text-xs text-stone-500">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Есть контекст</div>
          <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-amber-400" style={{borderTop:'2px dashed #f59e0b', height:0, width:16}} /> Нужно написать</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border-2 border-dashed border-amber-400" /> Стагнирует</div>
          <div className="text-stone-300">Клик — открыть карточку</div>
        </div>
      </div>
    </div>
  );
}

// ─── NETWORK AI VIEW ────────────────────────────────────────────
function NetworkAIView({ contacts, profile, hasKey, onNeedKey, onBack }) {
  const [activeTab, setActiveTab] = useState('analysis');

  const tabs = [
    { id: 'analysis', label: 'Анализ сети', icon: BarChart3 },
    { id: 'jobs', label: 'Найти работу', icon: Briefcase },
    { id: 'intros', label: 'Познакомить', icon: Share2 },
  ];

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="hidden md:flex items-center gap-2 text-stone-400 hover:text-stone-700 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> К списку
        </button>
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight" style={{fontFamily:'Fraunces, Georgia, serif'}}>ИИ-анализ сети</h1>
          <p className="text-stone-400 text-sm">Превращаем контакты в возможности</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-white rounded-2xl border border-black/5 mb-6 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === t.id ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'analysis' && <NetworkAnalysisPanel contacts={contacts} profile={profile} hasKey={hasKey} />}
      {activeTab === 'jobs' && <JobSearchPanel contacts={contacts} profile={profile} hasKey={hasKey} />}
      {activeTab === 'intros' && <IntroductionsPanel contacts={contacts} profile={profile} hasKey={hasKey} />}
    </div>
  );
}

// ─── AI PANELS ──────────────────────────────────────────────────
function useAIPanel(fn, deps = []) {
  const [state, setState] = useState({ loading: false, data: null, error: null });
  const run = useCallback(async (...args) => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await fn(...args);
      setState({ loading: false, data, error: null });
    } catch (e) {
      setState({ loading: false, data: null, error: e.message });
    }
  }, deps);
  return [state, run];
}

function ScorePanel({ contact, profile, hasKey }) {
  const [s, run] = useAIPanel(() => scoreContact(contact, profile));
  if (s.loading) return <AILoader text="Анализирую связь…" />;
  if (s.error) return <AIError text={s.error} onRetry={() => run()} />;
  if (!s.data) return <AIIntro title="Оценка контакта" desc="ИИ оценит ценность связи и риск её потерять." btn="Оценить" onRun={() => run()} />;
  const { score, risk, strengths = [], weaknesses = [], summary, action } = s.data;
  const riskC = { low: 'text-emerald-600 bg-emerald-50', medium: 'text-amber-600 bg-amber-50', high: 'text-red-600 bg-red-50' }[risk] || 'text-stone-600 bg-stone-100';
  const riskL = { low: 'Низкий риск', medium: 'Средний риск', high: 'Высокий риск' }[risk] || risk;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#f5f1e8" strokeWidth="10" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#059669" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${(score/100)*263.9} 263.9`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-stone-900 leading-none" style={{fontFamily:'Fraunces, Georgia, serif'}}>{score}</div>
            <div className="text-xs text-stone-400">/ 100</div>
          </div>
        </div>
        <div className="flex-1">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${riskC}`}>{riskL}</span>
          <p className="text-stone-600 text-sm mt-3 leading-relaxed">{summary}</p>
          {action && <div className="mt-3 flex items-start gap-2 text-sm"><Zap className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /><span className="text-emerald-700 font-medium">{action}</span></div>}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-black/5">
        {strengths.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-600 font-semibold mb-2">Сильные стороны</div>
            {strengths.map((s, i) => <div key={i} className="flex gap-2 text-sm text-stone-600 mb-1.5"><Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />{s}</div>)}
          </div>
        )}
        {weaknesses.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-red-500 font-semibold mb-2">Зоны риска</div>
            {weaknesses.map((s, i) => <div key={i} className="flex gap-2 text-sm text-stone-600 mb-1.5"><AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />{s}</div>)}
          </div>
        )}
      </div>
      <button onClick={() => run()} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Переоценить</button>
    </div>
  );
}

function IcebreakerPanel({ contact, profile, hasKey }) {
  const [s, run] = useAIPanel(() => generateIcebreaker(contact, profile));
  if (s.loading) return <AILoader text="Подбираю слова…" />;
  if (s.error) return <AIError text={s.error} onRetry={() => run()} />;
  if (!s.data) return <AIIntro title="Как начать диалог" desc="3 варианта сообщений под твой стиль и контекст знакомства." btn="Сгенерировать" onRun={() => run()} />;
  return (
    <div className="space-y-3">
      {s.data.messages?.map((m, i) => (
        <div key={i} className="border border-black/8 rounded-2xl p-4">
          <div className="text-xs uppercase tracking-widest text-emerald-600 font-semibold mb-2">{m.style}</div>
          <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{m.text}</p>
          <button onClick={() => navigator.clipboard?.writeText(m.text)} className="mt-3 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"><Copy className="w-3 h-3" /> Скопировать</button>
        </div>
      ))}
      <button onClick={() => run()} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Ещё варианты</button>
    </div>
  );
}

function IdeasPanel({ contact, profile, hasKey }) {
  const [s, run] = useAIPanel(() => generateMeetingIdeas(contact, profile));
  if (s.loading) return <AILoader text="Придумываю идеи…" />;
  if (s.error) return <AIError text={s.error} onRetry={() => run()} />;
  if (!s.data) return <AIIntro title="Идеи для встречи" desc="Нестандартные форматы, полезные обеим сторонам." btn="Придумать" onRun={() => run()} />;
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {s.data.ideas?.map((idea, i) => (
        <div key={i} className="border border-black/8 rounded-2xl p-4 hover:border-emerald-300 transition-colors">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="font-semibold text-stone-900 text-sm">{idea.title}</div>
            <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full whitespace-nowrap">{idea.format}</span>
          </div>
          <p className="text-xs text-stone-500">{idea.description}</p>
          {idea.value && <div className="mt-2 text-xs text-emerald-600 font-medium">→ {idea.value}</div>}
        </div>
      ))}
      <button onClick={() => run()} className="col-span-full text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Ещё идеи</button>
    </div>
  );
}

function BriefingPanel({ contact, profile, hasKey }) {
  const [s, run] = useAIPanel(() => generateBriefing(contact, profile));
  if (s.loading) return <AILoader text="Составляю брифинг…" />;
  if (s.error) return <AIError text={s.error} onRetry={() => run()} />;
  if (!s.data) return <AIIntro title="Брифинг перед встречей" desc="Повестка, темы для разговора, цель встречи и как начать." btn="Подготовить брифинг" onRun={() => run()} />;
  const { agenda = [], talkingPoints = [], avoid = [], goal, openingLine } = s.data;
  return (
    <div className="space-y-5">
      {goal && <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4"><div className="text-xs uppercase tracking-widest text-emerald-600 font-semibold mb-1">Цель встречи</div><p className="text-emerald-800 font-medium text-sm">{goal}</p></div>}
      {openingLine && <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4"><div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-1">Как начать</div><p className="text-stone-700 text-sm italic">«{openingLine}»</p></div>}
      <div className="grid md:grid-cols-2 gap-4">
        {agenda.length > 0 && <div><div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">Повестка</div>{agenda.map((a,i) => <div key={i} className="flex gap-2 text-sm text-stone-600 mb-1.5"><span className="text-stone-300 font-mono text-xs mt-0.5">{i+1}.</span>{a}</div>)}</div>}
        {talkingPoints.length > 0 && <div><div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">Темы для разговора</div>{talkingPoints.map((t,i) => <div key={i} className="flex gap-2 text-sm text-stone-600 mb-1.5"><MessageCircle className="w-3.5 h-3.5 text-stone-300 flex-shrink-0 mt-0.5" />{t}</div>)}</div>}
      </div>
      {avoid.length > 0 && <div><div className="text-xs uppercase tracking-widest text-red-400 font-semibold mb-2">Чего избегать</div>{avoid.map((a,i) => <div key={i} className="flex gap-2 text-sm text-stone-500 mb-1"><X className="w-3.5 h-3.5 text-red-300 flex-shrink-0 mt-0.5" />{a}</div>)}</div>}
      <button onClick={() => run()} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Обновить</button>
    </div>
  );
}

function NetworkAnalysisPanel({ contacts, profile, hasKey }) {
  const [s, run] = useAIPanel(() => analyzeNetwork(contacts, profile));
  if (contacts.length < 3) return <div className="text-center py-12 text-stone-400 text-sm">Добавь хотя бы 3 контакта для анализа сети</div>;
  if (s.loading) return <AILoader text="Анализирую всю сеть…" />;
  if (s.error) return <AIError text={s.error} onRetry={() => run()} />;
  if (!s.data) return (
    <AIIntro
      title="Стратегический анализ сети"
      desc={`ИИ изучит все ${contacts.length} контактов, найдёт дыры, горячие связи и карьерные возможности.`}
      btn="Запустить анализ"
      onRun={() => run()}
    />
  );
  const { networkScore, strengths = [], gaps = [], hotContacts = [], introductions = [], careerOpportunities = [], nextActions = [] } = s.data;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#f5f1e8" strokeWidth="10" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#059669" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(networkScore/100)*263.9} 263.9`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-stone-900 leading-none" style={{fontFamily:'Fraunces, Georgia, serif'}}>{networkScore}</div>
            <div className="text-[10px] text-stone-400">сила сети</div>
          </div>
        </div>
        <div className="flex-1">
          <div className="font-bold text-stone-900 mb-2" style={{fontFamily:'Fraunces, Georgia, serif'}}>Твоя сеть</div>
          <div className="flex flex-wrap gap-2">{strengths.map((s,i) => <span key={i} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">{s}</span>)}</div>
        </div>
      </div>

      {gaps.length > 0 && (
        <div>
          <div className="font-semibold text-stone-900 mb-3 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}><AlertTriangle className="w-4 h-4 text-amber-500" /> Дыры в сети</div>
          <div className="space-y-2">
            {gaps.map((g,i) => (
              <div key={i} className={`p-4 rounded-2xl border ${g.priority==='high' ? 'bg-red-50 border-red-100' : g.priority==='medium' ? 'bg-amber-50 border-amber-100' : 'bg-stone-50 border-stone-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-stone-900">{g.area}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.priority==='high' ? 'bg-red-100 text-red-700' : g.priority==='medium' ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-600'}`}>{g.priority==='high'?'Критично':g.priority==='medium'?'Важно':'Желательно'}</span>
                </div>
                <p className="text-xs text-stone-500">{g.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {hotContacts.length > 0 && (
        <div>
          <div className="font-semibold text-stone-900 mb-3 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}><Zap className="w-4 h-4 text-emerald-500" /> Написать срочно</div>
          <div className="space-y-2">{hotContacts.map((h,i) => <div key={i} className="flex gap-2 text-sm text-stone-700 p-3 bg-emerald-50 rounded-xl border border-emerald-100"><Star className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />{h}</div>)}</div>
        </div>
      )}

      {careerOpportunities.length > 0 && (
        <div>
          <div className="font-semibold text-stone-900 mb-3 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}><Target className="w-4 h-4 text-blue-500" /> Карьерные возможности</div>
          <div className="space-y-2">{careerOpportunities.map((o,i) => <div key={i} className="flex gap-2 text-sm text-stone-700 p-3 bg-blue-50 rounded-xl border border-blue-100"><ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />{o}</div>)}</div>
        </div>
      )}

      {nextActions.length > 0 && (
        <div className="bg-stone-900 rounded-2xl p-5">
          <div className="text-white font-semibold mb-3 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}><Check className="w-4 h-4 text-emerald-400" /> Следующие шаги</div>
          <div className="space-y-2">{nextActions.map((a,i) => <div key={i} className="flex gap-2 text-sm text-white/80"><span className="text-emerald-400 font-mono text-xs mt-0.5">{i+1}.</span>{a}</div>)}</div>
        </div>
      )}

      <button onClick={() => run()} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Обновить анализ</button>
    </div>
  );
}

function JobSearchPanel({ contacts, profile, hasKey }) {
  const [target, setTarget] = useState('');
  const [s, run] = useAIPanel((t) => findJobConnections(contacts, profile, t));
  if (contacts.length < 2) return <div className="text-center py-12 text-stone-400 text-sm">Добавь контакты для поиска возможностей</div>;
  if (s.loading) return <AILoader text="Ищу пути к работе мечты…" />;
  if (s.error) return <AIError text={s.error} onRetry={() => run(target)} />;
  if (!s.data) return (
    <div className="space-y-5">
      <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
        <h3 className="font-bold text-stone-900 mb-1" style={{fontFamily:'Fraunces, Georgia, serif'}}>Найти работу через сеть</h3>
        <p className="text-stone-500 text-sm mb-4">ИИ найдёт кто из твоих контактов может помочь с трудоустройством.</p>
        <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-2">Куда хочешь попасть?</label>
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder="PM в Яндексе, стартап-фаундер, DevRel в Google…" className="field mb-4" />
        <button onClick={() => run(target)} className="px-6 py-3 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-700">Найти пути →</button>
      </div>
    </div>
  );
  const { directConnections = [], referralPath = [], companiesReachable = [], strategyTips = [] } = s.data;
  return (
    <div className="space-y-6">
      {directConnections.length > 0 && (
        <div>
          <div className="font-semibold text-stone-900 mb-3 flex items-center gap-2" style={{fontFamily:'Fraunces, Georgia, serif'}}><Star className="w-4 h-4 text-emerald-500" /> Написать прямо сейчас</div>
          <div className="space-y-3">{directConnections.map((d,i) => (
            <div key={i} className="border border-black/8 rounded-2xl p-4">
              <div className="font-semibold text-stone-900 text-sm mb-1">{d.name}</div>
              <p className="text-stone-500 text-xs mb-2">{d.reason}</p>
              {d.message && <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-600 italic">«{d.message}»</div>}
            </div>
          ))}</div>
        </div>
      )}
      {referralPath.length > 0 && (
        <div>
          <div className="font-semibold text-stone-900 mb-3" style={{fontFamily:'Fraunces, Georgia, serif'}}>Через рекомендации</div>
          <div className="space-y-2">{referralPath.map((r,i) => (
            <div key={i} className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm">
              <span className="font-medium text-stone-800">{r.contact}</span> <span className="text-stone-400">→</span> <span className="text-blue-700">{r.theyKnow}</span>
              {r.ask && <div className="text-xs text-stone-500 mt-1">Попросить: {r.ask}</div>}
            </div>
          ))}</div>
        </div>
      )}
      {companiesReachable.length > 0 && (
        <div>
          <div className="font-semibold text-stone-900 mb-3" style={{fontFamily:'Fraunces, Georgia, serif'}}>Компании в досягаемости</div>
          <div className="flex flex-wrap gap-2">{companiesReachable.map((c,i) => <span key={i} className="text-xs bg-white border border-black/10 text-stone-600 px-3 py-1.5 rounded-xl">{c}</span>)}</div>
        </div>
      )}
      {strategyTips.length > 0 && (
        <div className="bg-stone-900 rounded-2xl p-5">
          <div className="text-white font-semibold mb-3" style={{fontFamily:'Fraunces, Georgia, serif'}}>Стратегия</div>
          {strategyTips.map((t,i) => <div key={i} className="flex gap-2 text-sm text-white/80 mb-2"><ChevronRight className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />{t}</div>)}
        </div>
      )}
      <button onClick={() => run(target)} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Обновить</button>
    </div>
  );
}

function IntroductionsPanel({ contacts, profile, hasKey }) {
  const [s, run] = useAIPanel(() => recommendIntroductions(contacts, profile));
  if (contacts.length < 4) return <div className="text-center py-12 text-stone-400 text-sm">Нужно минимум 4 контакта для рекомендаций</div>;
  if (s.loading) return <AILoader text="Ищу синергии в сети…" />;
  if (s.error) return <AIError text={s.error} onRetry={() => run()} />;
  if (!s.data) return (
    <AIIntro
      title="Познакомить правильных людей"
      desc="ИИ найдёт пары контактов, которым полезно познакомиться — и ты станешь ценным коннектором."
      btn="Найти пары"
      onRun={() => run()}
    />
  );
  const intros = s.data.introductions || [];
  return (
    <div className="space-y-4">
      {intros.map((intro, i) => (
        <div key={i} className="border border-black/8 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-semibold text-stone-900 text-sm">{intro.person1}</span>
            <div className="flex-1 h-px bg-emerald-200 relative"><div className="absolute inset-0 flex items-center justify-center"><Share2 className="w-4 h-4 text-emerald-500 bg-white px-0.5" /></div></div>
            <span className="font-semibold text-stone-900 text-sm">{intro.person2}</span>
          </div>
          <p className="text-stone-500 text-sm mb-3">{intro.synergy}</p>
          {intro.yourBenefit && <div className="text-xs text-emerald-600 font-medium mb-3">💡 Твоя выгода: {intro.yourBenefit}</div>}
          {intro.template && (
            <div className="bg-stone-50 rounded-xl p-3">
              <div className="text-xs uppercase tracking-widest text-stone-400 font-medium mb-1">Шаблон письма</div>
              <p className="text-xs text-stone-600 italic leading-relaxed">«{intro.template}»</p>
              <button onClick={() => navigator.clipboard?.writeText(intro.template)} className="mt-2 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"><Copy className="w-3 h-3" /> Скопировать</button>
            </div>
          )}
        </div>
      ))}
      <button onClick={() => run()} className="text-stone-400 hover:text-stone-700 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Другие пары</button>
    </div>
  );
}

function AIIntro({ title, desc, btn, onRun }) {
  return (
    <div className="text-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
        <Sparkles className="w-6 h-6 text-white" />
      </div>
      <div className="font-bold text-stone-900 text-lg mb-2" style={{fontFamily:'Fraunces, Georgia, serif'}}>{title}</div>
      <p className="text-stone-400 text-sm mb-6 max-w-sm mx-auto">{desc}</p>
      <button onClick={onRun} className="px-6 py-3 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-700 transition-colors">
        {btn}
      </button>
    </div>
  );
}

function AILoader({ text }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-stone-400">
      <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

function AIError({ text, onRetry }) {
  return (
    <div className="border border-red-100 bg-red-50 rounded-2xl p-5">
      <div className="text-red-600 font-semibold mb-1 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Ошибка</div>
      <div className="text-stone-500 text-xs font-mono break-all mb-3">{text}</div>
      <button onClick={onRetry} className="px-4 py-2 rounded-xl border border-black/10 text-stone-600 text-xs hover:bg-black/5">Попробовать снова</button>
    </div>
  );
}

// ─── MODALS ──────────────────────────────────────────────────────
function ImportModal({ onClose, onImport }) {
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    setError('');
    try {
      const text = await file.text();
      const list = parseVCard(text);
      if (!list.length) { setError('Контактов в формате vCard не найдено'); return; }
      setParsed(list);
    } catch (e) { setError('Не удалось прочитать файл: ' + e.message); }
  };

  return (
    <Modal onClose={onClose} title="Импорт контактов">
      {!parsed ? (
        <div className="space-y-5">
          <div className="text-sm text-stone-500 space-y-1.5">
            <p>Экспортируй из телефона в формат <code className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded">.vcf</code>:</p>
            <p className="text-xs">iOS: Контакты → выделить → Поделиться → .vcf</p>
            <p className="text-xs">Android: Контакты → Меню → Экспорт в .vcf</p>
          </div>
          <label className="block border-2 border-dashed border-stone-200 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all">
            <input type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <Upload className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <div className="text-sm text-stone-600 font-medium">Выбрать .vcf файл</div>
          </label>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>}
          <div className="text-center border-t border-stone-100 pt-4">
            <button onClick={() => setParsed(parseVCard(sampleVCard))} className="text-sm text-stone-400 hover:text-stone-700 underline">Загрузить демо-контакты</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-stone-600">Найдено <span className="font-bold text-emerald-600">{parsed.length}</span> контактов</div>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {parsed.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-stone-100 rounded-xl">
                <Avatar name={c.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-900 font-medium truncate">{c.name}</div>
                  <div className="text-xs text-stone-400 truncate">{c.company || c.email || c.phone || '—'}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setParsed(null)} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm hover:bg-stone-50">Назад</button>
            <button onClick={() => { onImport(parsed); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700">Импортировать всех</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SettingsModal({ profile, onUpdateProfile, onClose }) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio || '');
  const [key, setKey] = useState(getApiKey());
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const save = () => {
    onUpdateProfile({ name: name.trim() || profile.name, bio: bio.trim() });
    if (isLocalhost) setApiKey(key);
    onClose();
  };

  return (
    <Modal onClose={onClose} title="Настройки профиля">
      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-2">Имя</label>
          <input value={name} onChange={e => setName(e.target.value)} className="field" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-2">О тебе (контекст для ИИ)</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} className="field" rows={3} placeholder="Кто ты, чем занимаешься, что ищешь…" />
        </div>
        {isLocalhost && (
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-2">API-ключ Anthropic (для localhost)</label>
            <input type="password" value={key} onChange={e => setKey(e.target.value)} className="field font-mono text-xs" placeholder="sk-ant-api03-…" />
            <p className="text-xs text-stone-400 mt-1">На Vercel ключ захардкожен на сервере — вводить не нужно.</p>
          </div>
        )}
        <div className="flex gap-2 pt-2 border-t border-stone-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm hover:bg-stone-50">Отмена</button>
          <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700">Сохранить</button>
        </div>
      </div>
    </Modal>
  );
}

function AddContactModal({ onClose, onSave }) {
  const [c, setC] = useState({ name: '', position: '', company: '', phone: '', email: '', context: '', interests: '', canHelpMe: '', canHelpThem: '', goals: '', tags: '', notes: '', reminderDays: 60 });
  const handleSubmit = () => {
    if (!c.name.trim()) return;
    onSave({ ...c, tags: c.tags.split(',').map(t => t.trim()).filter(Boolean) });
  };
  const F = ({ k, label, ph, type = 'text' }) => (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-1">{label}</label>
      <input type={type} value={c[k]} onChange={e => setC({...c, [k]: e.target.value})} className="field" placeholder={ph} />
    </div>
  );
  const T = ({ k, label, ph, rows = 2 }) => (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-1">{label}</label>
      <textarea value={c[k]} onChange={e => setC({...c, [k]: e.target.value})} className="field resize-none" rows={rows} placeholder={ph} />
    </div>
  );
  return (
    <Modal onClose={onClose} title="Новый контакт">
      <div className="space-y-3">
        <F k="name" label="Имя *" ph="Анна Петрова" />
        <div className="grid grid-cols-2 gap-2">
          <F k="position" label="Должность" ph="Product Manager" />
          <F k="company" label="Компания" ph="TechCorp" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <F k="phone" label="Телефон" ph="+7 999…" />
          <F k="email" label="Email" ph="email@…" />
        </div>
        <T k="context" label="Где познакомились" ph="ProductCamp 2025…" />
        <F k="interests" label="Интересы" ph="AI, стартапы, продукт…" />
        <div className="grid grid-cols-2 gap-2">
          <T k="canHelpMe" label="Чем поможет мне" ph="Интро к инвесторам…" rows={2} />
          <T k="canHelpThem" label="Чем помогу я" ph="Экспертиза, связи…" rows={2} />
        </div>
        <T k="goals" label="Цели по контакту" ph="Совместный проект…" rows={1} />
        <F k="tags" label="Теги (через запятую)" ph="продукт, ai, фаундер" />
        <T k="notes" label="Заметки" ph="О чём говорили…" rows={2} />
        <div>
          <label className="text-xs uppercase tracking-widest text-stone-400 font-medium block mb-2">Напоминать каждые</label>
          <div className="flex gap-2">{[30,60,90].map(d => (
            <button key={d} type="button" onClick={() => setC({...c, reminderDays: d})} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${c.reminderDays === d ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{d} дн.</button>
          ))}</div>
        </div>
        <div className="flex gap-2 pt-3 border-t border-stone-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm hover:bg-stone-50">Отмена</button>
          <button onClick={handleSubmit} disabled={!c.name.trim()} className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed">Добавить</button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title }) {
  useEffect(() => {
    const fn = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', fn); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="font-bold text-stone-900 text-lg" style={{fontFamily:'Fraunces, Georgia, serif'}}>{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1"><X className="w-5 h-5" /></button>
        </header>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}
