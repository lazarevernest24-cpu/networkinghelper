const MODEL = 'claude-haiku-4-5-20251001';

// Общий контекст для всех промптов — Россия, без LinkedIn
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
    system: system + '\n\n' + RU_CONTEXT + '\n\nCRITICAL RULES:\n1. Return ONLY raw JSON object. Nothing else.\n2. No markdown, no ```json fences, no explanation.\n3. No text before { or after }.\n4. All string values must be on ONE line - no newlines inside strings.\n5. No trailing commas.\n6. Start your response with { and end with }',
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
  // 1. Strip markdown fences
  let s = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // 2. Extract outermost { ... }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('ИИ вернул неожиданный ответ, попробуй снова');
  s = s.slice(start, end + 1);

  // 3. Fix trailing commas
  s = s.replace(/,\s*([}\]])/g, '$1');

  // 4. Try direct parse
  try { return JSON.parse(s); } catch {}

  // 5. Fix newlines inside string values
  try {
    const fixed = s.replace(/"((?:[^"\\]|\\.)*)"/gs, (match, val) => {
      return '"' + val
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .replace(/\t/g, ' ')
        + '"';
    });
    return JSON.parse(fixed);
  } catch {}

  // 6. Fix unescaped quotes inside strings (last resort)
  try {
    const fixed = s
      .replace(/:\s*"(.*?)(?<!\\)"(\s*[,}\]])/gs, (m, val, end) =>
        ': "' + val.replace(/"/g, '\\"') + '"' + end
      );
    return JSON.parse(fixed);
  } catch {}

  throw new Error('Не удалось разобрать ответ ИИ, попробуй снова');
}

function fmtContact(c) {
  const p = [];
  p.push(`Name: ${c.name}`);
  if (c.position) p.push(`Role: ${c.position}`);
  if (c.company) p.push(`Company: ${c.company}`);
  if (c.context) p.push(`How we met: ${c.context}`);
  if (c.interests) p.push(`Interests: ${c.interests}`);
  if (c.canHelpMe) p.push(`Can help me with: ${c.canHelpMe}`);
  if (c.canHelpThem) p.push(`I can help them with: ${c.canHelpThem}`);
  if (c.goals) p.push(`My goals for this contact: ${c.goals}`);
  if (c.tags?.length) p.push(`Tags: ${c.tags.join(', ')}`);
  if (c.notes) p.push(`Notes: ${c.notes}`);
  if (c.lastContact) {
    const days = Math.floor((Date.now() - c.lastContact) / 86400000);
    p.push(`Last contact: ${days} days ago`);
  } else {
    p.push(`Last contact: never`);
  }
  return p.join('\n');
}

export async function scoreContact(contact, userProfile = '') {
  const system = `Ты — аналитик по нетворкингу. Оцениваешь профессиональные контакты в российском контексте.
Учитывай ценность связи для карьеры, бизнеса и профессионального роста в России.
Для следующего шага предлагай конкретные действия через Telegram, личную встречу, общих знакомых — не LinkedIn.
Return ONLY this JSON structure:
{"score": 0-100, "risk": "low|medium|high", "strengths": ["..."], "weaknesses": ["..."], "summary": "1-2 предложения", "action": "конкретное следующее действие"}`;
  const user = `Профиль пользователя: ${userProfile || 'профессионал, развивает сеть контактов в России'}\nКонтакт:\n${fmtContact(contact)}`;
  const raw = await callClaude({ system, user, maxTokens: 600 });
  return parseJSON(raw);
}

export async function generateIcebreaker(contact, userProfile = '') {
  const system = `Ты — опытный нетворкер в России. Пишешь живые, естественные сообщения на русском.
Без канцелярита, без "надеюсь это письмо найдёт вас в добром здравии", без официоза.
Сообщения отправляются через Telegram или WhatsApp — пиши соответственно, коротко и по-человечески.
Учитывай контекст знакомства — конференции, общие знакомые, профессиональные чаты.
Return ONLY this JSON:
{"messages": [{"style": "Тёплый", "text": "..."}, {"style": "Деловой", "text": "..."}, {"style": "С поводом", "text": "..."}]}
Каждое сообщение: 2-4 предложения, как будто пишешь другу-коллеге.`;
  const user = `Профиль: ${userProfile || 'профессионал'}\nКонтакт:\n${fmtContact(contact)}`;
  const raw = await callClaude({ system, user, maxTokens: 700 });
  return parseJSON(raw);
}

export async function generateMeetingIdeas(contact, userProfile = '') {
  const system = `Ты — нетворкинг-консультант, знаешь российскую деловую среду.
Предлагай форматы встреч актуальные для России: совместный поход на конференцию (ProductCamp, TechTrain, VC-митапы), кофе в Москве/Питере, созвон в Telegram, совместный пост на vc.ru или в Telegram-канале, коллаборация в профессиональном сообществе.
Не предлагай LinkedIn, западные платформы недоступные в РФ.
Return ONLY this JSON:
{"ideas": [{"title": "...", "description": "...", "format": "онлайн|офлайн|звонок", "value": "конкретная польза для обоих"}]}
Ровно 4 идеи, нестандартные и конкретные.`;
  const user = `Профиль: ${userProfile}\nКонтакт:\n${fmtContact(contact)}`;
  const raw = await callClaude({ system, user, maxTokens: 800 });
  return parseJSON(raw);
}

export async function generateBriefing(contact, userProfile = '') {
  const system = `Ты — персональный ассистент, готовишь брифинг перед встречей в российском деловом контексте.
Учитывай: в России ценится живое общение, личные договорённости, неформальная обстановка.
Хорошее начало встречи — общий знакомый, общая конференция, общая боль в индустрии.
Return ONLY this JSON:
{"agenda": ["пункт 1", "пункт 2"], "talkingPoints": ["тема 1", "тема 2"], "avoid": ["чего избегать"], "goal": "главная цель встречи", "openingLine": "как начать разговор по-русски, живо и без официоза"}`;
  const user = `Профиль: ${userProfile}\nКонтакт:\n${fmtContact(contact)}`;
  const raw = await callClaude({ system, user, maxTokens: 800 });
  return parseJSON(raw);
}

export async function analyzeNetwork(contacts, userProfile = '') {
  const summary = contacts.slice(0, 40).map(c =>
    `${c.name} (${c.position || '?'} в ${c.company || '?'})${c.tags?.length ? ` [${c.tags.join(',')}]` : ''}`
  ).join('\n');

  const system = `Ты — стратегический советник по карьере и нетворкингу в России.
Анализируй сеть контактов с учётом российского рынка труда и бизнеса.
Дыры в сети — отсутствие контактов в ключевых для России индустриях и ролях.
Карьерные возможности — реальные пути через российские компании, стартапы, госструктуры, медиа.
Горячие контакты — люди которым нужно написать в Telegram прямо сейчас.
Return ONLY this JSON:
{"networkScore": 0-100, "strengths": ["сильная сторона"], "gaps": [{"area": "область", "description": "что missing", "priority": "high|medium|low"}], "hotContacts": ["имя — почему срочно написать"], "careerOpportunities": ["конкретная возможность"], "nextActions": ["действие 1", "действие 2", "действие 3"]}`;
  const user = `Профиль: ${userProfile || 'профессионал в России'}\nСеть (${contacts.length} человек):\n${summary}`;
  const raw = await callClaude({ system, user, maxTokens: 1000 });
  return parseJSON(raw);
}

export async function findJobConnections(contacts, userProfile = '', targetRole = '') {
  const summary = contacts.slice(0, 40).map(c =>
    `${c.name}: ${c.position || '?'} в ${c.company || '?'}`
  ).join('\n');

  const system = `Ты — карьерный консультант, специализируешься на российском рынке труда.
Ищи работу через личные рекомендации — в России это работает лучше всего.
Каналы: личное сообщение в Telegram, рекомендация через общего знакомого, реферальная программа компании, отраслевые Telegram-чаты.
НЕ упоминай LinkedIn — он недоступен в России.
Для поиска вакансий используй: hh.ru, Telegram-каналы компаний, реферальные программы, личные рекомендации.
Return ONLY this JSON:
{"directConnections": [{"name": "...", "reason": "...", "message": "готовый текст сообщения в Telegram"}], "referralPath": [{"contact": "...", "theyKnow": "компания/сфера", "ask": "что конкретно попросить"}], "companiesReachable": ["компания — через кого попасть"], "strategyTips": ["совет 1", "совет 2"]}`;
  const user = `Профиль: ${userProfile}\nЦель: ${targetRole || 'не указана'}\nКонтакты:\n${summary}`;
  const raw = await callClaude({ system, user, maxTokens: 900 });
  return parseJSON(raw);
}

export async function recommendIntroductions(contacts, userProfile = '') {
  const summary = contacts.slice(0, 30).map(c =>
    `${c.name}: ${c.position || '?'} в ${c.company || '?'}, интересы: ${c.interests || c.tags?.join(',') || 'не указаны'}`
  ).join('\n');

  const system = `Ты — суперконнектор в российской профессиональной среде.
Находишь пары людей, которым реально полезно познакомиться — общие проекты, синергия бизнесов, взаимовыгодный обмен экспертизой.
Шаблон письма-интро пиши как сообщение в Telegram — живо, коротко, по-русски. Формат: "Привет! Хочу познакомить тебя с [имя] — [1 предложение кто он и почему вам стоит поговорить]."
Return ONLY this JSON:
{"introductions": [{"person1": "...", "person2": "...", "synergy": "почему им полезно познакомиться", "yourBenefit": "что ты получишь как коннектор", "template": "готовый текст сообщения-интро в Telegram"}]}
Ровно 5 пар, только осмысленные совпадения.`;
  const user = `Профиль: ${userProfile}\nКонтакты:\n${summary}`;
  const raw = await callClaude({ system, user, maxTokens: 1000 });
  return parseJSON(raw);
}

export { getApiKey, setApiKey } from './storage.js';
