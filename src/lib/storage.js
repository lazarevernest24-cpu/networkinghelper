// Мульти-профильное хранилище
// Каждый "профиль" = изолированный пространство контактов (как аккаунт, но без сервера)

const KEY_PROFILES = 'nh_profiles_v2';
const KEY_ACTIVE = 'nh_active_profile_v2';

export function getProfiles() {
  try {
    return JSON.parse(localStorage.getItem(KEY_PROFILES) || '[]');
  } catch { return []; }
}

export function saveProfiles(profiles) {
  localStorage.setItem(KEY_PROFILES, JSON.stringify(profiles));
}

export function getActiveProfileId() {
  return localStorage.getItem(KEY_ACTIVE) || null;
}

export function setActiveProfileId(id) {
  localStorage.setItem(KEY_ACTIVE, id);
}

export function createProfile(name, bio = '') {
  const id = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const profile = { id, name, bio, createdAt: Date.now() };
  const profiles = getProfiles();
  profiles.push(profile);
  saveProfiles(profiles);
  return profile;
}

export function updateProfile(id, patch) {
  const profiles = getProfiles().map(p => p.id === id ? { ...p, ...patch } : p);
  saveProfiles(profiles);
}

export function deleteProfile(id) {
  const profiles = getProfiles().filter(p => p.id !== id);
  saveProfiles(profiles);
  localStorage.removeItem(`nh_contacts_${id}`);
  if (getActiveProfileId() === id) localStorage.removeItem(KEY_ACTIVE);
}

export function loadContacts(profileId) {
  try {
    return JSON.parse(localStorage.getItem(`nh_contacts_${profileId}`) || '[]');
  } catch { return []; }
}

export function saveContacts(profileId, contacts) {
  localStorage.setItem(`nh_contacts_${profileId}`, JSON.stringify(contacts));
}

// legacy key support (one global API key if user wants it)
export function getApiKey() {
  return localStorage.getItem('nh_api_key') || '';
}
export function setApiKey(key) {
  localStorage.setItem('nh_api_key', key.trim());
}
