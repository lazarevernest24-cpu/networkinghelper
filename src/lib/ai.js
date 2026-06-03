// Клиент Anthropic API: 3 фичи нетворкинг-ассистента
// Ключ хранится в localStorage — пользователь вводит его в настройках при первом запуске
// На защите: вставил ключ → ИИ работает. После — Delete на console.anthropic.com

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001'; // быстрая и дешёвая модель — идеально для демо

export function getApiKey() {
  return localStorage.getItem('nh_api_key') || '';
}
export function setApiKey(key) {
  localStorage.setItem('nh_api_key', key.trim());
}

async function callClaude({ system, user, maxTokens = 600 }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Нет API-ключа. Открой настройки и вставь ключ Anthropic.');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ошибка API (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// Формат контакта для промптов
function formatContact(c) {
  const parts = [];
  parts.push(`Имя: ${c.name}`);
  if (c.position) parts.push(`Должность: ${c.position}`);
  if (c.company) parts.push(`Компания: ${c.company}`);
  if (c.context) parts.push(`Контекст знакомства: ${c.context}`);
  if (c.tags?.length) parts.push(`Теги: ${c.tags.join(', ')}`);
  if (c.notes) parts.push(`Заметки: ${c.notes}`);
  if (c.lastContact) {
    const days = Math.floor((Date.now() - c.lastContact) / 86400000);
    parts.push(`Последний контакт: ${days} дней назад`);
  } else {
    parts.push(`Последний контакт: ещё не было`);
  }
  return parts.join('\n');
}

// ============ ФИЧА 1: ОЦЕНКА КОНТАКТА ============
// Возвращает JSON: { score, risk, strengths, weaknesses, summary }
export async function scoreContact(contact, userProfile = '') {
  const system = `Ты — аналитический помощник по нетворкингу. Оцениваешь профессиональные контакты пользователя.
Анализируй холодно и по делу. Отвечай ТОЛЬКО валидным JSON без markdown-обёрток.
Структура: {"score": число 0-100, "risk": "low" | "medium" | "high", "strengths": ["..."], "weaknesses": ["..."], "summary": "коротко 1-2 предложения"}
Score = ценность поддержания связи для пользователя × вероятность сохранить контакт активным.
Risk = риск потерять связь (high если давно не общались или мало контекста).`;

  const user = `Профиль пользователя: ${userProfile || 'специалист, активно развивает профессиональную сеть'}

Контакт:
${formatContact(contact)}

Оцени контакт и верни JSON.`;

  const raw = await callClaude({ system, user, maxTokens: 500 });
  // вытаскиваем JSON даже если модель добавила лишнее
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Не удалось распарсить ответ ИИ');
  return JSON.parse(match[0]);
}

// ============ ФИЧА 2: КАК НАЧАТЬ ОБЩЕНИЕ ============
// Генерит 3 варианта ice-breaker сообщений
export async function generateIcebreaker(contact, userProfile = '') {
  const system = `Ты — опытный нетворкер. Помогаешь пользователю возобновить или начать диалог с контактом.
Пиши на русском, естественно, без канцелярита и без слов вроде "касательно", "посредством".
Тон — дружелюбно-профессиональный, без подхалимажа.
Отвечай ТОЛЬКО валидным JSON: {"messages": [{"style": "название стиля", "text": "сообщение"}, ...]}
Дай ровно 3 варианта разных стилей: "Тёплый", "Деловой", "С поводом".`;

  const user = `Профиль пользователя: ${userProfile || 'профессионал, развивающий сеть контактов'}

Контакт:
${formatContact(contact)}

Сгенерируй 3 коротких сообщения (по 2-4 предложения), которыми можно начать или возобновить общение. Учитывай контекст знакомства.`;

  const raw = await callClaude({ system, user, maxTokens: 700 });
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Не удалось распарсить ответ ИИ');
  return JSON.parse(match[0]);
}

// ============ ФИЧА 3: ИДЕИ ДЛЯ ВСТРЕЧИ ============
export async function generateMeetingIdeas(contact, userProfile = '') {
  const system = `Ты — креативный нетворкинг-консультант. Предлагаешь идеи совместных встреч и активностей, которые принесут пользу обеим сторонам.
Не банальности типа "сходить на кофе". Думай: пересечения интересов, общие задачи, обмен экспертизой.
Отвечай ТОЛЬКО валидным JSON: {"ideas": [{"title": "короткое название", "description": "1-2 предложения почему именно это", "format": "формат: онлайн/офлайн/звонок"}, ...]}
Дай 4 идеи разной степени формальности.`;

  const user = `Профиль пользователя: ${userProfile || 'профессионал, развивающий сеть контактов'}

Контакт:
${formatContact(contact)}

Сгенерируй 4 идеи для совместной встречи или активности.`;

  const raw = await callClaude({ system, user, maxTokens: 800 });
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Не удалось распарсить ответ ИИ');
  return JSON.parse(match[0]);
}
