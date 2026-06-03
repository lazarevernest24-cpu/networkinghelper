// Парсер vCard 2.1/3.0/4.0 файлов из экспорта телефонной книги iOS/Android
// Поддерживает несколько контактов в одном .vcf файле + базовые поля

function unfold(text) {
  // RFC 6350: продолжение строки начинается с пробела/таба
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function decodeQuotedPrintable(str) {
  return str.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseLine(line) {
  // FORMAT: PROPERTY[;PARAM=val][;PARAM=val]:VALUE
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;
  const left = line.substring(0, colonIdx);
  let value = line.substring(colonIdx + 1);
  const parts = left.split(';');
  const property = parts[0].toUpperCase();
  const params = {};
  for (let i = 1; i < parts.length; i++) {
    const [k, v] = parts[i].split('=');
    params[k.toUpperCase()] = (v || '').toUpperCase();
  }
  if (params.ENCODING === 'QUOTED-PRINTABLE') {
    value = decodeQuotedPrintable(value);
  }
  if (params.CHARSET === 'UTF-8' || params.ENCODING === 'QUOTED-PRINTABLE') {
    try { value = decodeURIComponent(escape(value)); } catch (_) {}
  }
  return { property, params, value };
}

function uid() {
  return 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function parseVCard(text) {
  text = unfold(text);
  const lines = text.split(/\r?\n/);
  const contacts = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.toUpperCase() === 'BEGIN:VCARD') {
      current = { id: uid(), name: '', firstName: '', lastName: '', phone: '', email: '', company: '', position: '', notes: '', tags: [], context: '', reminderDays: 60, lastContact: null, createdAt: Date.now() };
      continue;
    }
    if (line.toUpperCase() === 'END:VCARD') {
      if (current) {
        // если имя пустое — собираем из first/last или подставляем заглушку
        if (!current.name) {
          current.name = (current.firstName + ' ' + current.lastName).trim() || 'Без имени';
        }
        contacts.push(current);
        current = null;
      }
      continue;
    }
    if (!current) continue;
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { property, value } = parsed;

    if (property === 'FN') {
      current.name = value;
    } else if (property === 'N') {
      // Структура: Фамилия;Имя;Отчество;Приставка;Суффикс
      const parts = value.split(';');
      current.lastName = parts[0] || '';
      current.firstName = parts[1] || '';
    } else if (property === 'TEL' && !current.phone) {
      current.phone = value.replace(/[^\d+]/g, '');
    } else if (property === 'EMAIL' && !current.email) {
      current.email = value;
    } else if (property === 'ORG' && !current.company) {
      current.company = value.split(';')[0];
    } else if (property === 'TITLE' && !current.position) {
      current.position = value;
    } else if (property === 'NOTE' && !current.notes) {
      current.notes = value;
    }
  }
  return contacts;
}

// Демо-файл для скачивания, если у пользователя нет .vcf под рукой
export const sampleVCard = `BEGIN:VCARD
VERSION:3.0
FN:Анна Петрова
N:Петрова;Анна;;;
TEL:+79991234567
EMAIL:anna.petrova@example.com
ORG:TechCorp
TITLE:Product Manager
NOTE:Познакомились на конференции ProductCamp 2025
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Михаил Соколов
N:Соколов;Михаил;;;
TEL:+79165554433
EMAIL:m.sokolov@startup.io
ORG:GreenStartup
TITLE:CEO & Founder
NOTE:Встретились на демо-дне акселератора
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Елена Новикова
N:Новикова;Елена;;;
TEL:+79263332211
EMAIL:elena.n@consulting.com
ORG:McKinsey
TITLE:Senior Consultant
NOTE:Однокурсница из ВШЭ, работает с FMCG-сектором
END:VCARD`;
