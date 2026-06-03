import { useState, useEffect, useMemo } from 'react';
import {
  Users, Upload, Plus, Settings, Search, ArrowLeft, Sparkles,
  Phone, Mail, Building2, Tag, Clock, MessageCircle, Lightbulb,
  TrendingUp, AlertTriangle, Loader2, X, Check, FileText, Trash2,
  Calendar, Briefcase, BookOpen
} from 'lucide-react';
import { parseVCard, sampleVCard } from './lib/vcard.js';
import { scoreContact, generateIcebreaker, generateMeetingIdeas, getApiKey, setApiKey } from './lib/ai.js';
import { loadContacts, saveContacts, loadProfile, saveProfile } from './lib/storage.js';

// ───────────────────────────────────────────────────────────
// Утилиты
// ───────────────────────────────────────────────────────────
function uid() { return 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function daysSince(ts) { return ts ? Math.floor((Date.now() - ts) / 86400000) : null; }
function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
}
function avatarColor(name) {
  const palette = ['#1F4E3D', '#B8451C', '#B8893A', '#3A5478', '#7A4B6B', '#3F6B4F'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

// ───────────────────────────────────────────────────────────
// Корневой компонент
// ───────────────────────────────────────────────────────────
export default function App() {
  const [contacts, setContacts] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [profile, setProfile] = useState('');
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    setContacts(loadContacts());
    setProfile(loadProfile());
    setHasKey(!!getApiKey());
    if (!getApiKey()) setShowSettings(true);
  }, []);

  useEffect(() => { saveContacts(contacts); }, [contacts]);

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

  const updateContact = (id, patch) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };
  const deleteContact = (id) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    setView('list'); setSelectedId(null);
  };
  const addContact = (c) => {
    const newC = { id: uid(), tags: [], reminderDays: 60, lastContact: null, createdAt: Date.now(), ...c };
    setContacts(prev => [newC, ...prev]);
  };
  const importContacts = (list) => {
    setContacts(prev => [...list, ...prev]);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Сайдбар */}
      <Sidebar
        contactsCount={contacts.length}
        onImport={() => setShowImport(true)}
        onAdd={() => setShowAdd(true)}
        onSettings={() => setShowSettings(true)}
        onHome={() => { setView('list'); setSelectedId(null); }}
      />

      {/* Основное содержимое */}
      <main className="flex-1 px-4 md:px-10 py-6 md:py-10 max-w-5xl">
        {view === 'list' && (
          <ListView
            search={search} setSearch={setSearch}
            reminders={reminders}
            contacts={filtered}
            totalCount={contacts.length}
            onOpen={(id) => { setSelectedId(id); setView('detail'); }}
            onImport={() => setShowImport(true)}
            onAdd={() => setShowAdd(true)}
          />
        )}
        {view === 'detail' && selected && (
          <DetailView
            contact={selected}
            profile={profile}
            onBack={() => { setView('list'); setSelectedId(null); }}
            onUpdate={(patch) => updateContact(selected.id, patch)}
            onDelete={() => deleteContact(selected.id)}
            hasKey={hasKey}
            onNeedKey={() => setShowSettings(true)}
          />
        )}
      </main>

      {/* Модалки */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importContacts} />}
      {showSettings && (
        <SettingsModal
          profile={profile} setProfile={(p) => { setProfile(p); saveProfile(p); }}
          onClose={() => { setShowSettings(false); setHasKey(!!getApiKey()); }}
        />
      )}
      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} onSave={(c) => { addContact(c); setShowAdd(false); }} />}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Сайдбар
// ───────────────────────────────────────────────────────────
function Sidebar({ contactsCount, onImport, onAdd, onSettings, onHome }) {
  return (
    <aside className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-line bg-cream/70 backdrop-blur-sm px-5 py-5 md:py-8 flex md:flex-col items-center md:items-stretch justify-between md:justify-start gap-4">
      <button onClick={onHome} className="flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-lg bg-forest flex items-center justify-center glow-emerald">
          <Sparkles className="w-4 h-4 text-cream" strokeWidth={2.5} />
        </div>
        <div className="text-left">
          <div className="font-display text-lg leading-none tracking-tight text-ink">НетворкингХелпер</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted mt-0.5">Personal CRM</div>
        </div>
      </button>

      <nav className="hidden md:flex flex-col gap-1 mt-8">
        <button onClick={onHome} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-ink hover:bg-cream2 transition-colors text-sm font-medium">
          <Users className="w-4 h-4" /> Все контакты
          <span className="ml-auto text-xs text-muted font-mono">{contactsCount}</span>
        </button>
        <button onClick={onAdd} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-ink2 hover:bg-cream2 transition-colors text-sm">
          <Plus className="w-4 h-4" /> Добавить контакт
        </button>
        <button onClick={onImport} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-ink2 hover:bg-cream2 transition-colors text-sm">
          <Upload className="w-4 h-4" /> Импорт с телефона
        </button>
      </nav>

      <div className="md:mt-auto flex md:flex-col gap-2 items-center md:items-stretch">
        <button onClick={onSettings} className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted hover:text-ink hover:bg-cream2 transition-colors text-sm">
          <Settings className="w-4 h-4" /> <span className="hidden md:inline">Настройки</span>
        </button>
        <button onClick={onAdd} className="md:hidden btn-primary !py-2 !px-3">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}

// ───────────────────────────────────────────────────────────
// Список контактов
// ───────────────────────────────────────────────────────────
function ListView({ search, setSearch, reminders, contacts, totalCount, onOpen, onImport, onAdd }) {
  if (totalCount === 0) {
    return <EmptyState onImport={onImport} onAdd={onAdd} />;
  }
  return (
    <div className="animate-fade-in space-y-8">
      <header>
        <div className="flex items-end justify-between mb-1">
          <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight text-ink">Карьерная сеть</h1>
          <span className="text-sm text-muted font-mono">{totalCount} контактов</span>
        </div>
        <p className="text-muted">Превращайте случайные знакомства в карьерные возможности.</p>
      </header>

      {/* Поиск */}
      <div className="relative">
        <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени, компании, должности, тегам…"
          className="w-full pl-10 pr-4 py-3 bg-white border border-line rounded-xl text-sm focus:outline-none focus:border-forest transition-colors"
        />
      </div>

      {/* Напоминания */}
      {reminders.length > 0 && !search && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-rust rounded-full" />
            <h2 className="font-display text-xl text-ink">Пора напомнить о себе</h2>
            <span className="tag !bg-rust/10 !text-rust">{reminders.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reminders.map(({ c, days }) => (
              <button key={c.id} onClick={() => onOpen(c.id)} className="card p-4 text-left hover:border-forest transition-all group">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink truncate">{c.name}</div>
                    <div className="text-xs text-muted truncate">
                      {c.position || c.company || 'Контакт'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-rust font-medium">
                      {days === null ? 'Ещё не общались' : `${days} дн.`}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Сетка контактов */}
      <section className="space-y-3">
        {(!reminders.length || search) ? null : (
          <div className="flex items-center gap-2 pt-2">
            <div className="w-1 h-4 bg-forest rounded-full" />
            <h2 className="font-display text-xl text-ink">Все контакты</h2>
          </div>
        )}
        {contacts.length === 0 ? (
          <p className="text-muted text-sm py-12 text-center">Ничего не найдено по запросу «{search}»</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map((c, i) => (
              <ContactCard key={c.id} contact={c} onClick={() => onOpen(c.id)} delay={i * 30} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Карточка контакта (в списке)
// ───────────────────────────────────────────────────────────
function ContactCard({ contact, onClick, delay }) {
  const days = daysSince(contact.lastContact);
  return (
    <button
      onClick={onClick}
      className="card p-4 text-left hover:border-forest hover:-translate-y-0.5 transition-all animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={contact.name} size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-ink truncate">{contact.name}</div>
          <div className="text-xs text-muted truncate">
            {contact.position && contact.company ? `${contact.position} · ${contact.company}` : (contact.position || contact.company || '—')}
          </div>
        </div>
      </div>
      {contact.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {contact.tags.slice(0, 3).map((t, i) => <span key={i} className="tag">{t}</span>)}
        </div>
      )}
      <div className="text-xs text-muted flex items-center gap-1.5 pt-2 border-t border-line">
        <Clock className="w-3 h-3" />
        {days === null ? 'Ещё не общались' : `${days} дн. назад`}
      </div>
    </button>
  );
}

function Avatar({ name, size = 'md' }) {
  const sizeClass = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' }[size];
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-medium flex-shrink-0`} style={{ background: avatarColor(name) }}>
      {initials(name)}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Пустое состояние
// ───────────────────────────────────────────────────────────
function EmptyState({ onImport, onAdd }) {
  return (
    <div className="animate-fade-in min-h-[70vh] flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 rounded-2xl bg-forest flex items-center justify-center mb-6 glow-emerald">
        <Sparkles className="w-9 h-9 text-cream" />
      </div>
      <h1 className="font-display text-3xl md:text-4xl text-ink mb-3 tracking-tight">Начните строить свою сеть</h1>
      <p className="text-muted max-w-md mb-8">Импортируйте контакты из телефона или добавьте первого вручную. ИИ поможет оценить связи, придумать повод для разговора и предложит идеи для встреч.</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onImport} className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" /> Импорт с телефона (.vcf)
        </button>
        <button onClick={onAdd} className="btn-outline flex items-center gap-2">
          <Plus className="w-4 h-4" /> Добавить вручную
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Детальная карточка контакта + ИИ-фичи
// ───────────────────────────────────────────────────────────
function DetailView({ contact, profile, onBack, onUpdate, onDelete, hasKey, onNeedKey }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(contact);
  const [aiTab, setAiTab] = useState('score'); // 'score' | 'icebreaker' | 'ideas'

  useEffect(() => { setDraft(contact); }, [contact.id]);

  const days = daysSince(contact.lastContact);

  const saveDraft = () => {
    onUpdate(draft);
    setEditing(false);
  };

  const markContacted = () => onUpdate({ lastContact: Date.now() });

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl">
      <button onClick={onBack} className="flex items-center gap-2 text-muted hover:text-ink transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> К списку контактов
      </button>

      {/* Шапка карточки */}
      <header className="card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6 mb-6">
          <Avatar name={contact.name} size="lg" />
          <div className="flex-1">
            {editing ? (
              <input value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} className="font-display text-3xl text-ink bg-transparent border-b border-line focus:border-forest outline-none w-full" />
            ) : (
              <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">{contact.name}</h1>
            )}
            <div className="text-muted mt-1">
              {editing ? (
                <div className="flex gap-2 mt-2">
                  <input value={draft.position || ''} onChange={e => setDraft({...draft, position: e.target.value})} placeholder="Должность" className="field !py-1.5 !text-sm" />
                  <input value={draft.company || ''} onChange={e => setDraft({...draft, company: e.target.value})} placeholder="Компания" className="field !py-1.5 !text-sm" />
                </div>
              ) : (
                <span>{contact.position && contact.company ? `${contact.position} · ${contact.company}` : (contact.position || contact.company || 'Без должности')}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            {editing ? (
              <>
                <button onClick={saveDraft} className="btn-primary flex items-center gap-2"><Check className="w-4 h-4" /> Сохранить</button>
                <button onClick={() => { setDraft(contact); setEditing(false); }} className="btn-ghost text-xs">Отмена</button>
              </>
            ) : (
              <>
                <button onClick={markContacted} className="btn-primary flex items-center gap-2"><Check className="w-4 h-4" /> Записать контакт</button>
                <button onClick={() => setEditing(true)} className="btn-ghost text-xs">Редактировать</button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-line">
          <Stat icon={<Clock />} label="Последний контакт" value={days === null ? 'Не было' : `${days} дн. назад`} />
          <Stat icon={<Calendar />} label="Напоминание" value={`${contact.reminderDays || 60} дн.`} />
          <Stat icon={<Phone />} label="Телефон" value={contact.phone || '—'} mono />
          <Stat icon={<Mail />} label="Email" value={contact.email || '—'} small />
        </div>
      </header>

      {/* Контекст и заметки */}
      <section className="card p-6 md:p-8">
        <h2 className="font-display text-xl text-ink mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-forest" /> Контекст и заметки
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label">Где и при каких обстоятельствах познакомились</label>
            {editing ? (
              <textarea value={draft.context || ''} onChange={e => setDraft({...draft, context: e.target.value})} className="field" rows={2} placeholder="Конференция ProductCamp 2025, секция AI-продуктов…" />
            ) : (
              <p className="text-ink2 text-sm">{contact.context || <span className="text-muted italic">Не указан</span>}</p>
            )}
          </div>
          <div>
            <label className="label">Заметки</label>
            {editing ? (
              <textarea value={draft.notes || ''} onChange={e => setDraft({...draft, notes: e.target.value})} className="field" rows={3} placeholder="О чём говорили, что интересно, какие общие темы…" />
            ) : (
              <p className="text-ink2 text-sm whitespace-pre-wrap">{contact.notes || <span className="text-muted italic">Пусто</span>}</p>
            )}
          </div>
          <div>
            <label className="label">Теги</label>
            {editing ? (
              <input
                value={(draft.tags || []).join(', ')}
                onChange={e => setDraft({...draft, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                className="field" placeholder="продукт, ai, фаундер"
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(contact.tags || []).length === 0 && <span className="text-muted italic text-sm">Нет тегов</span>}
                {contact.tags?.map((t, i) => <span key={i} className="tag"><Tag className="w-3 h-3" />{t}</span>)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ИИ-панель */}
      <section className="card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-forest/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="font-display text-xl text-ink flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-forest" /> ИИ-помощник по нетворкингу
            </h2>
            {!hasKey && (
              <button onClick={onNeedKey} className="text-xs text-rust hover:underline flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Нужен API-ключ
              </button>
            )}
          </div>

          <div className="flex gap-1 p-1 bg-cream rounded-xl mb-5 w-fit">
            <TabBtn active={aiTab === 'score'} onClick={() => setAiTab('score')} icon={<TrendingUp />}>Оценка</TabBtn>
            <TabBtn active={aiTab === 'icebreaker'} onClick={() => setAiTab('icebreaker')} icon={<MessageCircle />}>Начать диалог</TabBtn>
            <TabBtn active={aiTab === 'ideas'} onClick={() => setAiTab('ideas')} icon={<Lightbulb />}>Идеи встреч</TabBtn>
          </div>

          {aiTab === 'score' && <ScorePanel contact={contact} profile={profile} hasKey={hasKey} />}
          {aiTab === 'icebreaker' && <IcebreakerPanel contact={contact} profile={profile} hasKey={hasKey} />}
          {aiTab === 'ideas' && <IdeasPanel contact={contact} profile={profile} hasKey={hasKey} />}
        </div>
      </section>

      {/* Удалить */}
      <div className="flex justify-end pt-2">
        <button onClick={() => confirm('Удалить контакт?') && onDelete()} className="text-muted hover:text-rust text-sm flex items-center gap-1.5 transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> Удалить контакт
        </button>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, mono, small }) {
  return (
    <div>
      <div className="text-xs text-muted flex items-center gap-1.5 mb-1">
        <span className="[&>svg]:w-3 [&>svg]:h-3">{icon}</span> {label}
      </div>
      <div className={`text-ink ${mono ? 'font-mono text-sm' : small ? 'text-xs' : 'text-sm'} font-medium truncate`}>{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
      <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span> {children}
    </button>
  );
}

// ───────────────────────────────────────────────────────────
// ИИ-панели
// ───────────────────────────────────────────────────────────
function ScorePanel({ contact, profile, hasKey }) {
  const [state, setState] = useState({ loading: false, data: null, error: null });

  const run = async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await scoreContact(contact, profile);
      setState({ loading: false, data, error: null });
    } catch (e) {
      setState({ loading: false, data: null, error: e.message });
    }
  };

  if (state.loading) return <AILoader text="Анализирую связь…" />;
  if (state.error) return <AIError text={state.error} onRetry={run} />;
  if (!state.data) return <AIIntro
    title="Холодная оценка контакта"
    desc="ИИ проанализирует данные и оценит ценность связи и риск её потерять."
    btn="Оценить контакт"
    onRun={run} disabled={!hasKey}
  />;

  const { score, risk, strengths = [], weaknesses = [], summary } = state.data;
  const riskColor = { low: 'text-forest', medium: 'text-gold', high: 'text-rust' }[risk] || 'text-muted';
  const riskLabel = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }[risk] || risk;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative">
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#E5DECF" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#1F4E3D" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${(score/100) * 263.9} 263.9`} className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-3xl text-ink leading-none">{score}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5">из 100</div>
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Риск потерять связь</div>
          <div className={`font-display text-2xl ${riskColor}`}>{riskLabel}</div>
          <p className="text-sm text-ink2 mt-3">{summary}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 pt-2">
        {strengths.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-forest font-medium">Сильные стороны</div>
            {strengths.map((s, i) => <div key={i} className="flex gap-2 text-sm text-ink2"><Check className="w-4 h-4 text-forest flex-shrink-0 mt-0.5" /> {s}</div>)}
          </div>
        )}
        {weaknesses.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-rust font-medium">Зоны риска</div>
            {weaknesses.map((s, i) => <div key={i} className="flex gap-2 text-sm text-ink2"><AlertTriangle className="w-4 h-4 text-rust flex-shrink-0 mt-0.5" /> {s}</div>)}
          </div>
        )}
      </div>

      <button onClick={run} className="btn-ghost text-xs">Переоценить</button>
    </div>
  );
}

function IcebreakerPanel({ contact, profile, hasKey }) {
  const [state, setState] = useState({ loading: false, data: null, error: null });

  const run = async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await generateIcebreaker(contact, profile);
      setState({ loading: false, data, error: null });
    } catch (e) {
      setState({ loading: false, data: null, error: e.message });
    }
  };

  if (state.loading) return <AILoader text="Подбираю слова…" />;
  if (state.error) return <AIError text={state.error} onRetry={run} />;
  if (!state.data) return <AIIntro
    title="Как начать общение"
    desc="3 варианта сообщений разных стилей с учётом контекста знакомства."
    btn="Сгенерировать варианты"
    onRun={run} disabled={!hasKey}
  />;

  return (
    <div className="animate-fade-in space-y-3">
      {state.data.messages?.map((m, i) => (
        <div key={i} className="border border-line rounded-xl p-4 bg-cream/30">
          <div className="text-xs uppercase tracking-wider text-forest font-medium mb-2">{m.style}</div>
          <p className="text-sm text-ink2 whitespace-pre-wrap">{m.text}</p>
          <button onClick={() => navigator.clipboard.writeText(m.text)} className="mt-3 text-xs text-muted hover:text-ink flex items-center gap-1">
            <FileText className="w-3 h-3" /> Скопировать
          </button>
        </div>
      ))}
      <button onClick={run} className="btn-ghost text-xs">Сгенерировать ещё</button>
    </div>
  );
}

function IdeasPanel({ contact, profile, hasKey }) {
  const [state, setState] = useState({ loading: false, data: null, error: null });

  const run = async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await generateMeetingIdeas(contact, profile);
      setState({ loading: false, data, error: null });
    } catch (e) {
      setState({ loading: false, data: null, error: e.message });
    }
  };

  if (state.loading) return <AILoader text="Подбираю идеи…" />;
  if (state.error) return <AIError text={state.error} onRetry={run} />;
  if (!state.data) return <AIIntro
    title="Идеи для совместной встречи"
    desc="ИИ предложит форматы, которые принесут пользу обеим сторонам."
    btn="Сгенерировать идеи"
    onRun={run} disabled={!hasKey}
  />;

  return (
    <div className="animate-fade-in grid md:grid-cols-2 gap-3">
      {state.data.ideas?.map((idea, i) => (
        <div key={i} className="border border-line rounded-xl p-4 hover:border-forest transition-colors">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="font-display text-base text-ink">{idea.title}</div>
            <span className="tag text-[10px]">{idea.format}</span>
          </div>
          <p className="text-xs text-ink2">{idea.description}</p>
        </div>
      ))}
      <button onClick={run} className="btn-ghost text-xs col-span-full">Сгенерировать ещё</button>
    </div>
  );
}

function AIIntro({ title, desc, btn, onRun, disabled }) {
  return (
    <div className="text-center py-6">
      <div className="font-display text-xl text-ink mb-1">{title}</div>
      <p className="text-muted text-sm mb-5 max-w-md mx-auto">{desc}</p>
      <button onClick={onRun} disabled={disabled} className="btn-primary inline-flex items-center gap-2">
        <Sparkles className="w-4 h-4" /> {btn}
      </button>
      {disabled && <div className="text-xs text-rust mt-3">Сначала добавьте API-ключ в настройках</div>}
    </div>
  );
}
function AILoader({ text }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-muted">
      <Loader2 className="w-5 h-5 animate-spin text-forest" /> <span className="text-sm">{text}</span>
    </div>
  );
}
function AIError({ text, onRetry }) {
  return (
    <div className="border border-rust/20 bg-rust/5 rounded-xl p-4 text-sm">
      <div className="text-rust font-medium mb-1 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Не получилось</div>
      <div className="text-ink2 text-xs mb-3 font-mono break-all">{text}</div>
      <button onClick={onRetry} className="btn-outline text-xs">Попробовать снова</button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Модалка импорта vCard
// ───────────────────────────────────────────────────────────
function ImportModal({ onClose, onImport }) {
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    setError('');
    try {
      const text = await file.text();
      const list = parseVCard(text);
      if (!list.length) { setError('В файле не найдено контактов в формате vCard'); return; }
      setParsed(list);
    } catch (e) {
      setError('Не удалось прочитать файл: ' + e.message);
    }
  };

  const useDemo = () => {
    const list = parseVCard(sampleVCard);
    setParsed(list);
  };

  const confirm = () => {
    onImport(parsed);
    onClose();
  };

  return (
    <Modal onClose={onClose} title="Импорт контактов с телефона">
      {!parsed ? (
        <div className="space-y-5">
          <div>
            <p className="text-sm text-ink2 mb-3">Экспортируйте контакты из телефона в формате <code className="font-mono text-xs bg-cream2 px-1.5 py-0.5 rounded">.vcf</code>:</p>
            <ul className="text-xs text-muted space-y-1.5 ml-4 list-disc">
              <li><span className="text-ink2">iPhone:</span> Контакты → выделите → Поделиться → AirDrop/Mail</li>
              <li><span className="text-ink2">Android:</span> Контакты → Меню → Экспорт в .vcf</li>
            </ul>
          </div>

          <label className="block border-2 border-dashed border-line rounded-xl p-8 text-center cursor-pointer hover:border-forest hover:bg-cream/50 transition-all">
            <input type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <Upload className="w-8 h-8 text-muted mx-auto mb-2" />
            <div className="text-sm text-ink2 font-medium">Выбрать .vcf файл</div>
            <div className="text-xs text-muted mt-1">или перетащите сюда</div>
          </label>

          {error && <div className="text-rust text-sm border border-rust/20 bg-rust/5 rounded-lg p-3">{error}</div>}

          <div className="text-center pt-2 border-t border-line">
            <div className="text-xs text-muted mb-2">Нет файла под рукой?</div>
            <button onClick={useDemo} className="btn-outline text-xs">Загрузить демо-контакты</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-ink2">Найдено <span className="font-medium text-forest">{parsed.length}</span> {parsed.length === 1 ? 'контакт' : parsed.length < 5 ? 'контакта' : 'контактов'}:</div>
          <div className="max-h-72 overflow-y-auto space-y-2 -mx-2 px-2">
            {parsed.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 border border-line rounded-lg">
                <Avatar name={c.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted truncate">{c.company || c.email || c.phone || '—'}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setParsed(null)} className="btn-ghost">Назад</button>
            <button onClick={confirm} className="btn-primary">Импортировать всех</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────
// Модалка настроек (ИИ-ключ + профиль)
// ───────────────────────────────────────────────────────────
function SettingsModal({ profile, setProfile, onClose }) {
  const [key, setKey] = useState(getApiKey());
  const [profileText, setProfileText] = useState(profile);

  const save = () => {
    setApiKey(key);
    setProfile(profileText);
    onClose();
  };

  return (
    <Modal onClose={onClose} title="Настройки">
      <div className="space-y-5">
        <div>
          <label className="label">API-ключ Anthropic</label>
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="sk-ant-api03-…"
            className="field font-mono text-xs"
          />
          <p className="text-xs text-muted mt-2">
            Получить на <span className="font-mono">console.anthropic.com</span> → API Keys.
            Ключ хранится только в вашем браузере (localStorage), никуда не отправляется кроме API Anthropic.
          </p>
        </div>

        <div>
          <label className="label">Ваш профиль (для контекста ИИ)</label>
          <textarea
            value={profileText}
            onChange={e => setProfileText(e.target.value)}
            placeholder="Например: продакт-менеджер в FinTech, ищу заказчиков на консалтинг, интересуюсь AI-продуктами…"
            className="field"
            rows={3}
          />
          <p className="text-xs text-muted mt-2">ИИ будет учитывать ваш контекст при оценке контактов и генерации сообщений.</p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button onClick={onClose} className="btn-ghost">Отмена</button>
          <button onClick={save} className="btn-primary">Сохранить</button>
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────
// Модалка добавления контакта вручную
// ───────────────────────────────────────────────────────────
function AddContactModal({ onClose, onSave }) {
  const [c, setC] = useState({
    name: '', position: '', company: '', phone: '', email: '',
    context: '', tags: '', notes: '', reminderDays: 60
  });

  const handleSubmit = () => {
    if (!c.name.trim()) return;
    onSave({
      ...c,
      tags: c.tags.split(',').map(t => t.trim()).filter(Boolean)
    });
  };

  return (
    <Modal onClose={onClose} title="Новый контакт">
      <div className="space-y-3">
        <div><label className="label">Имя *</label><input value={c.name} onChange={e => setC({...c, name: e.target.value})} className="field" placeholder="Анна Петрова" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Должность</label><input value={c.position} onChange={e => setC({...c, position: e.target.value})} className="field" placeholder="Product Manager" /></div>
          <div><label className="label">Компания</label><input value={c.company} onChange={e => setC({...c, company: e.target.value})} className="field" placeholder="TechCorp" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Телефон</label><input value={c.phone} onChange={e => setC({...c, phone: e.target.value})} className="field" placeholder="+7 999 …" /></div>
          <div><label className="label">Email</label><input value={c.email} onChange={e => setC({...c, email: e.target.value})} className="field" placeholder="email@…" /></div>
        </div>
        <div><label className="label">Где познакомились</label><textarea value={c.context} onChange={e => setC({...c, context: e.target.value})} className="field" rows={2} placeholder="ProductCamp 2025, после доклада про AI-продукты…" /></div>
        <div><label className="label">Теги через запятую</label><input value={c.tags} onChange={e => setC({...c, tags: e.target.value})} className="field" placeholder="продукт, ai, фаундер" /></div>
        <div><label className="label">Заметки</label><textarea value={c.notes} onChange={e => setC({...c, notes: e.target.value})} className="field" rows={2} placeholder="О чём говорили, общие интересы…" /></div>
        <div>
          <label className="label">Напоминать каждые (дни)</label>
          <div className="flex gap-2">
            {[30, 60, 90].map(d => (
              <button key={d} type="button" onClick={() => setC({...c, reminderDays: d})} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${c.reminderDays === d ? 'bg-forest text-cream' : 'bg-cream2 text-ink2 hover:bg-line'}`}>{d} дн.</button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-line">
          <button onClick={onClose} className="btn-ghost">Отмена</button>
          <button onClick={handleSubmit} disabled={!c.name.trim()} className="btn-primary">Добавить</button>
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────
// Универсальная модалка
// ───────────────────────────────────────────────────────────
function Modal({ children, onClose, title }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div className="relative bg-cream w-full md:max-w-lg rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-5 border-b border-line">
          <h2 className="font-display text-xl text-ink">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink p-1 -m-1"><X className="w-5 h-5" /></button>
        </header>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}
