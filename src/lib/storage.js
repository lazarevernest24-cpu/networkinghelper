// Простое хранилище в localStorage
const KEY_CONTACTS = 'nh_contacts_v1';
const KEY_PROFILE = 'nh_profile_v1';

export function loadContacts() {
  try {
    const raw = localStorage.getItem(KEY_CONTACTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
export function saveContacts(contacts) {
  localStorage.setItem(KEY_CONTACTS, JSON.stringify(contacts));
}
export function loadProfile() {
  return localStorage.getItem(KEY_PROFILE) || '';
}
export function saveProfile(text) {
  localStorage.setItem(KEY_PROFILE, text);
}
