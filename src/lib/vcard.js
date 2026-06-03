// vCard parser — handles iOS/Android exports with UTF-8 and quoted-printable encoding
function decodeQP(str) {
  return str.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

function decodeValue(val, encoding, charset) {
  let s = val;
  if (encoding === 'QUOTED-PRINTABLE') s = decodeQP(s);
  if (charset === 'UTF-8' || !charset) {
    try {
      if (encoding === 'QUOTED-PRINTABLE') {
        const bytes = s.split('').map(c => c.charCodeAt(0));
        s = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
      }
    } catch {}
  }
  return s.trim();
}

export function parseVCard(text) {
  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  const contacts = [];

  for (const card of cards) {
    const lines = [];
    const rawLines = card.split(/\r?\n/);
    // unfold continuation lines
    for (const line of rawLines) {
      if (/^[ \t]/.test(line) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
    }

    const get = (key) => {
      for (const line of lines) {
        const upper = line.toUpperCase();
        if (!upper.startsWith(key.toUpperCase())) continue;
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) continue;
        const params = line.slice(0, colonIdx).split(';').slice(1);
        const paramObj = {};
        for (const p of params) {
          const [k, v] = p.split('=');
          if (k && v) paramObj[k.toUpperCase()] = v.toUpperCase();
        }
        const val = line.slice(colonIdx + 1);
        return decodeValue(val, paramObj['ENCODING'], paramObj['CHARSET']);
      }
      return '';
    };

    const getAll = (key) => {
      const results = [];
      for (const line of lines) {
        if (line.toUpperCase().startsWith(key.toUpperCase())) {
          const colonIdx = line.indexOf(':');
          if (colonIdx >= 0) results.push(line.slice(colonIdx + 1).trim());
        }
      }
      return results;
    };

    const fnRaw = get('FN');
    const nRaw = get('N');
    let name = fnRaw;
    if (!name && nRaw) {
      const parts = nRaw.split(';');
      name = [parts[1], parts[0]].filter(Boolean).join(' ');
    }
    if (!name) continue;

    const phones = getAll('TEL');
    const emails = getAll('EMAIL');
    const org = get('ORG').split(';')[0];
    const title = get('TITLE');

    contacts.push({
      id: 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: name.trim(),
      phone: phones[0] || '',
      email: emails[0] || '',
      company: org || '',
      position: title || '',
      tags: [],
      reminderDays: 60,
      lastContact: null,
      createdAt: Date.now(),
      context: '',
      notes: '',
      interests: '',
      canHelpMe: '',
      canHelpThem: '',
      goals: '',
    });
  }

  return contacts;
}

export const sampleVCard = `BEGIN:VCARD
VERSION:3.0
FN:Анна Петрова
N:Петрова;Анна;;;
ORG:ТехКорп
TITLE:Product Manager
TEL:+7 999 123-45-67
EMAIL:anna@techcorp.ru
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Дмитрий Козлов
N:Козлов;Дмитрий;;;
ORG:Стартап Лаб
TITLE:Founder & CEO
TEL:+7 916 234-56-78
EMAIL:dk@startuplab.ru
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Мария Смирнова
N:Смирнова;Мария;;;
ORG:Яндекс
TITLE:Senior Engineer
TEL:+7 903 345-67-89
EMAIL:m.smirnova@yandex.ru
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Алексей Волков
N:Волков;Алексей;;;
ORG:SberTech
TITLE:Head of Growth
TEL:+7 926 456-78-90
EMAIL:a.volkov@sbertech.ru
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Екатерина Новикова
N:Новикова;Екатерина;;;
ORG:Tinkoff
TITLE:UX Director
TEL:+7 967 567-89-01
EMAIL:e.novikova@tinkoff.ru
END:VCARD`;
