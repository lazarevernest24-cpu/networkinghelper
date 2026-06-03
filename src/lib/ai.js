// AI client — uses /api/ai proxy (no key needed in browser)
// Falls back to direct Anthropic call with user's own key if proxy unavailable

const MODEL = 'claude-haiku-4-5-20251001';

async function callClaude({ system, user, maxTokens = 800 }) {
  // Try server proxy first (key hidden, shared for all users)
  const useProxy = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const userKey = localStorage.getItem('nh_api_key') || '';

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  };

  let res;
  if (useProxy) {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } else {
    if (!userKey) throw new Error('Локальный запуск: добавь API-ключ в настройках');
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': userKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ошибка API (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.content?.[0]?.text || '';
}

function parseJSON(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Не удалось распарсить ответ ИИ');
  return JSON.parse(match[0]);
}

function parseJSONArray(raw) {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    // try object with array field
    return parseJSON(raw);
  }
  return JSON.parse(match[0]);
}

function fmtContact(c) {
  const p = [];
  p.push(`Имя: ${c.name}`);
  if (c.position) p.push(`Должность: ${c.position}`);
  if (c.company) p.push(`Компания: ${c.company}`);
  if (c.context) p.push(`Контекст знакомства: ${c.context}`);
  if (c.interests) p.push(`Профессиональные интересы: ${c.interests}`);
  if (c.canHelpMe) p.push(`Чем может помочь мне: ${c.canHelpMe}`);
  if (c.canHelpThem) p.push(`Чем я могу помочь ему: ${c.canHelpThem}`);
  if (c.goals) p.push(`Цели по контакту: ${c.goals}`);
  if (c.tags?.length) p.push(`Теги: ${c.tags.join(', ')}`);
  if (c.notes) p.push(`Заметки: ${c.notes}`);
  if (c.lastContact) {
    const days = Math.floor((Date.now() - c.lastContact) / 86400000);
    p.push(`Последний контакт: ${days} дней назад`);
  } else {
    p.push(`Последний контакт: ещё не было`);
  }
  return p.join('\n');
}

// 1. ОЦЕНКА КОНТАКТА
export async function scoreContact(contact, userProfile = '') {
  const system = `Ты — аналитический помощник по нетворкингу. Оцениваешь профессиональные контакты.
Анализируй холодно и по делу. Отвечай ТОЛЬКО валидным JSON без markdown.
Структура: {"score": число 0-100, "risk": "low"|"medium"|"high", "strengths": ["..."], "weaknesses": ["..."], "summary": "1-2 предложения", "action": "конкретное следующее действие"}`;
  const user = `Профиль пользователя: ${userProfile || 'специалист, развивает профессиональную сеть'}
Контакт:\n${fmtContact(contact)}\nОцени и верни JSON.`;
  const raw = await callClaude({ system, user, maxTokens: 600 });
  return parseJSON(raw);
}

// 2. КАК НАЧАТЬ ОБЩЕНИЕ
export async function generateIcebreaker(contact, userProfile = '') {
  const system = `Ты — опытный нетворкер. Пиши на русском, естественно, без канцелярита.
Отвечай ТОЛЬКО валидным JSON: {"messages": [{"style": "...", "text": "..."}]}
Дай 3 варианта: "Тёплый", "Деловой", "С поводом".`;
  const user = `Профиль: ${userProfile || 'профессионал'}\nКонтакт:\n${fmtContact(contact)}\nСгенерируй 3 коротких сообщения (2-4 предложения).`;
  const raw = await callClaude({ system, user, maxTokens: 800 });
  return parseJSON(raw);
}

// 3. ИДЕИ ДЛЯ ВСТРЕЧИ
export async function generateMeetingIdeas(contact, userProfile = '') {
  const system = `Ты — нетворкинг-консультант. Предлагай нестандартные идеи, не банальное кофе.
JSON: {"ideas": [{"title": "...", "description": "...", "format": "онлайн|офлайн|звонок", "value": "конкретная польза"}]}
Дай 4 идеи.`;
  const user = `Профиль: ${userProfile}\nКонтакт:\n${fmtContact(contact)}`;
  const raw = await callClaude({ system, user, maxTokens: 900 });
  return parseJSON(raw);
}

// 4. БРИФИНГ ПЕРЕД ВСТРЕЧЕЙ
export async function generateBriefing(contact, userProfile = '') {
  const system = `Ты — персональный ассистент, готовишь брифинг перед встречей. Будь конкретным.
JSON: {"agenda": ["пункт 1", "..."], "talkingPoints": ["тема 1", "..."], "avoid": ["чего избегать"], "goal": "главная цель встречи", "openingLine": "как начать разговор"}`;
  const user = `Профиль: ${userProfile}\nКонтакт:\n${fmtContact(contact)}\nСоставь брифинг для встречи.`;
  const raw = await callClaude({ system, user, maxTokens: 900 });
  return parseJSON(raw);
}

// 5. АНАЛИЗ ВСЕЙ СЕТИ — дыры и возможности
export async function analyzeNetwork(contacts, userProfile = '') {
  const contactSummary = contacts.slice(0, 40).map(c =>
    `${c.name}${c.position ? ` (${c.position}` : ''}${c.company ? ` в ${c.company})` : ')'}${c.tags?.length ? ` [${c.tags.join(', ')}]` : ''}`
  ).join('\n');

  const system = `Ты — стратегический советник по карьере и нетворкингу. Анализируй сеть контактов и давай практические советы.
JSON: {
  "networkScore": число 0-100,
  "strengths": ["сильная сторона сети"],
  "gaps": [{"area": "область", "description": "что missing", "priority": "high|medium|low"}],
  "hotContacts": ["имя - почему срочно написать"],
  "introductions": [{"person1": "...", "person2": "...", "reason": "почему познакомить"}],
  "careerOpportunities": ["конкретная возможность через эту сеть"],
  "nextActions": ["действие 1", "действие 2", "действие 3"]
}`;
  const user = `Профиль пользователя: ${userProfile || 'профессионал'}\n\nСеть контактов (${contacts.length} человек):\n${contactSummary}\n\nПроанализируй сеть.`;
  const raw = await callClaude({ system, user, maxTokens: 1200 });
  return parseJSON(raw);
}

// 6. ПОИСК РАБОТЫ — кто может помочь
export async function findJobConnections(contacts, userProfile = '', targetRole = '') {
  const contactSummary = contacts.slice(0, 40).map(c =>
    `${c.name}: ${c.position || '?'} в ${c.company || '?'}${c.tags?.length ? ` [${c.tags.join(', ')}]` : ''}`
  ).join('\n');

  const system = `Ты — карьерный консультант. Анализируешь сеть контактов для поиска работы.
JSON: {
  "directConnections": [{"name": "...", "reason": "...", "message": "как написать"}],
  "referralPath": [{"contact": "...", "theyKnow": "компания/сфера", "ask": "что попросить"}],
  "companiesReachable": ["компания - через кого"],
  "strategyTips": ["совет 1", "совет 2"]
}`;
  const user = `Профиль: ${userProfile}\nЦелевая роль/сфера: ${targetRole || 'не указана'}\n\nКонтакты:\n${contactSummary}\n\nНайди пути к работе мечты.`;
  const raw = await callClaude({ system, user, maxTokens: 1000 });
  return parseJSON(raw);
}

// 7. РЕКОМЕНДАЦИЯ КОГО ПОЗНАКОМИТЬ
export async function recommendIntroductions(contacts, userProfile = '') {
  const contactSummary = contacts.slice(0, 30).map(c =>
    `${c.name}: ${c.position || '?'} в ${c.company || '?'}, интересы: ${c.interests || c.tags?.join(', ') || 'не указаны'}`
  ).join('\n');

  const system = `Ты — коннектор. Находишь синергии между людьми в сети. Рекомендуй только осмысленные знакомства.
JSON: {"introductions": [{"person1": "...", "person2": "...", "synergy": "почему им будет полезно", "yourBenefit": "что ты получишь как коннектор", "template": "шаблон письма-интро"}]}
Дай 5 лучших пар.`;
  const user = `Профиль: ${userProfile}\n\nКонтакты:\n${contactSummary}\n\nНайди 5 пар для знакомства.`;
  const raw = await callClaude({ system, user, maxTokens: 1200 });
  return parseJSON(raw);
}

export { getApiKey, setApiKey } from './storage.js';
