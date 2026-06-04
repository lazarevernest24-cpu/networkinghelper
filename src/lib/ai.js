const MODEL = 'claude-haiku-4-5-20251001';

const RU_CONTEXT = `
ВАЖНЫЙ КОНТЕКСТ: Все пользователи находятся в России.
- LinkedIn недоступен и не используется — никогда не упоминай его
- Для профессионального общения используются: Telegram, ВКонтакте, WhatsApp, электронная почта, личные встречи, отраслевые мероприятия
- Для нетворкинга актуальны: Telegram-каналы и чаты, профессиональные сообщества ВКонтакте, Хабр, vc.ru, отраслевые конференции (ProductCamp, RIF, TechTrain, GoTo, TeamLead Conf и тд)
- Для поиска работы: hh.ru, Telegram-каналы с вакансиями, реферальные программы, личные рекомендации
- Российская деловая культура: ценится прямое живое общение, личные рекомендации важнее резюме, тёплые вводные через общих знакомых работают лучше холодных обращений
- Упоминай реальные российские платформы и каналы где уместно
`;

async function callClaude({ system, user, maxTokens = 800 }) {
  const useProxy = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const userKey = localStorage.getItem('nh_api_key') || '';

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    system: system + '\n\n' + RU_CONTEXT + '\n\nOTVECAJ TOLKO CHISTYM JSON BEZ MARKDOWN. Ne ispolzuj ```json. Nachni s { i zakончи s }.',
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
  let s = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('ИИ вернул неожиданный ответ, попробуй снова');
  s = s.slice(start, end + 1);

  s = s.replace(/,(\s*[}\]])/g, '$1');

  s = s.replace(/"([^"]*)"/g, (m, v) =>
    '"' + v.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ') + '"'
  );

  try {
    return JSON.parse(s);
  } catch {
    throw new Error('Не удалось разобрать ответ ИИ, попробуй снова');
  }
}

function fmtContact(c) {
  const p = [];
  p.push(`Имя: ${c.name}`);
  if (c.position) p.push(`Должность: ${c.position}`);
  if (c.company) p.push(`Компания: ${c.company}`);
  if (c.context) p.push(`Как познакомились: ${c.context}`);
  if (c.interests) p.push(`Интересы: ${c.interests}`);
  if (c.canHelpMe) p.push(`Чем может помочь мне: ${c.canHelpMe}`);
  if (c.canHelpThem) p.push(`Чем я могу помочь: ${c.canHelpThem}`);
  if (c.goals) p.push(`Цели по контакту: ${c.goals}`);
  if (c.tags?.length) p.push(`Теги: ${c.tags.join(', ')}`);
  if (c.notes) p.push(`Заметки: ${c.notes}`);
  if (c.lastContact) {
    const days = Math.floor((Date.now() - c.lastContact) / 86400000);
    p.push(`Последний контакт: ${days} дней назад`);
  } else {
    p.push(`Последний контакт: никогда`);
  }
  return p.join('\n');
}

export async function scoreContact(contact, userProfile = '') {
  const system = `Ты аналитик по нетворкингу. Оцени контакт. Ответь JSON:
{"score":75,"risk":"low","strengths":["пример"],"weaknesses":["пример"],"summary":"краткий вывод","action":"следующий шаг через Telegram или встречу"}`;
  const user = `Профиль: ${userProfile || 'профессионал в России'}\nКонтакт:\n${fmtContact(contact)}`;
  const raw = await callClaude({ system, user, maxTokens: 600 });
  return parseJSON(raw);
}

export async function generateIcebreaker(contact, userProfile = '') {
  const system = `Ты нетворкер в России. Напиши 3 сообщения для Telegram/WhatsApp. Ответь JSON:
{"messages":[{"style":"Тёплый","text":"текст"},{"style":"Деловой","text":"текст"},{"style":"С поводом","text":"текст"}]}`;
  const user = `Профиль: ${userProfile || 'профессионал'}\nКонтакт:\n${fmtContact(contact)}`;
  const raw = await callClaude({ system, user, maxTokens: 700 });
  return parseJSON(raw);
}

export async function generateMeetingIdeas(contact, userProfile = '') {
  const system = `Ты нетворкинг-консультант в России. Предложи 4 идеи встреч (без LinkedIn). Ответь JSON:
{"ideas":[{"title":"название","description":"описание","format":"офлайн","value":"польза"}]}`;
  const user = `Профиль: ${userProfile}\nКонтакт:\n${fmtContact(contact)}`;
  const raw = await callClaude({ system, user, maxTokens: 800 });
  return parseJSON(raw);
}

export async function generateBriefing(contact, userProfile = '') {
  const system = `Ты ассистент, готовишь брифинг перед встречей. Ответь JSON:
{"agenda":["пункт"],"talkingPoints":["тема"],"avoid":["избегать"],"goal":"цель встречи","openingLine":"как начать"}`;
  const user = `Профиль: ${userProfile}\nКонтакт:\n${fmtContact(contact)}`;
  const raw = await callClaude({ system, user, maxTokens: 800 });
  return parseJSON(raw);
}

export async function analyzeNetwork(contacts, userProfile = '') {
  const summary = contacts.slice(0, 40).map(c =>
    `${c.name} (${c.position || '?'} в ${c.company || '?'})`
  ).join('\n');

  const system = `Ты карьерный советник в России. Проанализируй сеть контактов. Ответь JSON:
{"networkScore":70,"strengths":["сильная сторона"],"gaps":[{"area":"область","description":"описание","priority":"high"}],"hotContacts":["имя - причина"],"careerOpportunities":["возможность"],"nextActions":["действие"]}`;
  const user = `Профиль: ${userProfile || 'профессионал'}\nСеть (${contacts.length} чел):\n${summary}`;
  const raw = await callClaude({ system, user, maxTokens: 1000 });
  return parseJSON(raw);
}

export async function findJobConnections(contacts, userProfile = '', targetRole = '') {
  const summary = contacts.slice(0, 40).map(c =>
    `${c.name}: ${c.position || '?'} в ${c.company || '?'}`
  ).join('\n');

  const system = `Ты карьерный консультант в России (без LinkedIn, используй hh.ru и Telegram). Ответь JSON:
{"directConnections":[{"name":"имя","reason":"причина","message":"текст в Telegram"}],"referralPath":[{"contact":"имя","theyKnow":"компания","ask":"просьба"}],"companiesReachable":["компания - через кого"],"strategyTips":["совет"]}`;
  const user = `Профиль: ${userProfile}\nЦель: ${targetRole || 'не указана'}\nКонтакты:\n${summary}`;
  const raw = await callClaude({ system, user, maxTokens: 900 });
  return parseJSON(raw);
}

export async function recommendIntroductions(contacts, userProfile = '') {
  const summary = contacts.slice(0, 30).map(c =>
    `${c.name}: ${c.position || '?'} в ${c.company || '?'}, интересы: ${c.interests || c.tags?.join(',') || 'не указаны'}`
  ).join('\n');

  const system = `Ты коннектор в России. Найди 5 пар людей для знакомства. Ответь JSON:
{"introductions":[{"person1":"имя","person2":"имя","synergy":"зачем познакомить","yourBenefit":"твоя выгода","template":"Привет! Хочу познакомить тебя с X — он делает Y, думаю вам есть о чём поговорить."}]}`;
  const user = `Профиль: ${userProfile}\nКонтакты:\n${summary}`;
  const raw = await callClaude({ system, user, maxTokens: 1000 });
  return parseJSON(raw);
}

export { getApiKey, setApiKey } from './storage.js';
