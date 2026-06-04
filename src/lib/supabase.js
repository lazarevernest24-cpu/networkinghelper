// Supabase client — auth + data storage
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set in Vercel env vars

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const hasSupabase = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sbAuthFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Auth error');
  return data;
}

function getToken() {
  try {
    const s = localStorage.getItem('sb_session');
    return s ? JSON.parse(s).access_token : SUPABASE_ANON_KEY;
  } catch { return SUPABASE_ANON_KEY; }
}

function getSession() {
  try {
    const s = localStorage.getItem('sb_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function getCurrentUser() {
  const s = getSession();
  return s?.user || null;
}

export async function signUp(email, password, name) {
  const data = await sbAuthFetch('/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { name } }),
  });
  if (data.access_token) {
    localStorage.setItem('sb_session', JSON.stringify(data));
  }
  return data;
}

export async function signIn(email, password) {
  const data = await sbAuthFetch('/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem('sb_session', JSON.stringify(data));
  return data;
}

export async function signOut() {
  try {
    await sbAuthFetch('/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
    });
  } catch {}
  localStorage.removeItem('sb_session');
}

// CONTACTS CRUD
export async function dbLoadContacts() {
  const user = getCurrentUser();
  if (!user) return [];
  const data = await sbFetch(`/contacts?user_id=eq.${user.id}&order=created_at.desc`, { prefer: '' });
  return (data || []).map(row => ({
    ...row.data,
    id: row.id,
    _dbId: row.id,
  }));
}

export async function dbSaveContact(contact, userId) {
  const { _dbId, ...rest } = contact;
  if (_dbId) {
    // update
    await sbFetch(`/contacts?id=eq.${_dbId}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: rest, updated_at: new Date().toISOString() }),
    });
    return contact;
  } else {
    // insert
    const rows = await sbFetch('/contacts', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, data: rest }),
    });
    return { ...rest, id: rows[0].id, _dbId: rows[0].id };
  }
}

export async function dbDeleteContact(dbId) {
  await sbFetch(`/contacts?id=eq.${dbId}`, { method: 'DELETE', prefer: '' });
}

export async function dbSaveAllContacts(contacts, userId) {
  // Upsert all — used after bulk import
  const rows = contacts.map(c => {
    const { _dbId, ...rest } = c;
    return { id: _dbId || undefined, user_id: userId, data: rest };
  }).filter(r => !r.id); // only new ones
  if (!rows.length) return;
  await sbFetch('/contacts', {
    method: 'POST',
    body: JSON.stringify(rows),
    headers: { 'Prefer': 'return=minimal' },
  });
}
