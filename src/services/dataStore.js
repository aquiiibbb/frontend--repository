/**
 * dataStore
 * ---------
 * Replaces the browser's localStorage for the whole PMS.
 *
 *  - Hotel data (bookings, rooms, rates, taxes, users, folios ...) lives ONLY in memory while the app is open.
 *    It is downloaded from the backend (MongoDB) when the app starts and every change is written back
 *    to the backend by services/backendSync.js. Nothing is kept in the browser after the tab is closed.
 *  - Only the login session (token, logged-in user, a few per-tab UI flags) is kept in sessionStorage,
 *    so a page refresh does not log the user out. It is cleared when the tab is closed.
 *
 * The API (getItem / setItem / removeItem / clear / key / length) is the same as Storage,
 * so every screen keeps working exactly as before.
 */

const SESSION_KEYS = new Set([
  "pms_token",
  "pms_user",
  "pms_authenticated",
  "pms_tenant_id",
  "pms_synced_tenant",
  "pms_hotel_id",
  "pms_public_hotel",
  "pms_last_hotel",
  "pms_theme",
  "pms_active_shift",
  "pms_impersonating",
  "pms_night_audit_prompt_dismissed_time_v1",
]);

// Keys that never leave this browser tab and are never sent to the backend (API keys typed by the user, etc.)
const MEMORY_ONLY_KEYS = new Set(["GOOGLE_VISION_API_KEY", "MINDEE_API_KEY"]);

const memory = new Map();

const session = (() => {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      const probe = "__pms_probe__";
      window.sessionStorage.setItem(probe, "1");
      window.sessionStorage.removeItem(probe);
      return window.sessionStorage;
    }
  } catch {
    /* sessionStorage blocked - fall back to memory */
  }
  return null;
})();

const sessionFallback = new Map();

export const isSessionKey = (key) => SESSION_KEYS.has(key);
export const isMemoryOnlyKey = (key) => MEMORY_ONLY_KEYS.has(key);

// A key is sent to the backend when it belongs to the PMS and is not session / memory-only
export function isSyncableKey(key) {
  if (typeof key !== "string" || SESSION_KEYS.has(key) || MEMORY_ONLY_KEYS.has(key)) return false;
  return key.startsWith("hotelpms_") || key.startsWith("pms_");
}

// hooks installed by backendSync.js
let hooks = { onSet: null, onRemove: null, onClear: null };
export function setStoreHooks(next) {
  hooks = { ...hooks, ...next };
}

const sessionGet = (k) => {
  if (session) {
    const v = session.getItem(k);
    return v === null ? null : v;
  }
  return sessionFallback.has(k) ? sessionFallback.get(k) : null;
};
const sessionSet = (k, v) => (session ? session.setItem(k, v) : sessionFallback.set(k, v));
const sessionRemove = (k) => (session ? session.removeItem(k) : sessionFallback.delete(k));

function sessionKeysPresent() {
  const out = [];
  SESSION_KEYS.forEach((k) => {
    if (sessionGet(k) !== null) out.push(k);
  });
  return out;
}

export const dataStore = {
  getItem(key) {
    const k = String(key);
    if (SESSION_KEYS.has(k)) return sessionGet(k);
    return memory.has(k) ? memory.get(k) : null;
  },
  setItem(key, value) {
    const k = String(key);
    const v = String(value);
    if (SESSION_KEYS.has(k)) {
      sessionSet(k, v);
      return;
    }
    memory.set(k, v);
    if (hooks.onSet && isSyncableKey(k)) hooks.onSet(k, v);
  },
  removeItem(key) {
    const k = String(key);
    if (SESSION_KEYS.has(k)) {
      sessionRemove(k);
      return;
    }
    const existed = memory.delete(k);
    if (existed && hooks.onRemove && isSyncableKey(k)) hooks.onRemove(k);
  },
  // "Reset all data": wipes the hotel data (memory) - the login session is kept.
  clear() {
    memory.clear();
    if (hooks.onClear) hooks.onClear();
  },
  key(index) {
    const keys = [...memory.keys(), ...sessionKeysPresent()];
    return index >= 0 && index < keys.length ? keys[index] : null;
  },
  get length() {
    return memory.size + sessionKeysPresent().length;
  },
};

// ---- raw helpers for backendSync (do not trigger the write-through hooks) ----
export const rawSetMemory = (k, v) => {
  if (SESSION_KEYS.has(k)) sessionSet(k, String(v));
  else memory.set(k, String(v));
};
export const rawRemoveMemory = (k) => {
  if (SESSION_KEYS.has(k)) sessionRemove(k);
  else memory.delete(k);
};
export const rawClearMemory = () => memory.clear();
export const syncableKeysInMemory = () => [...memory.keys()].filter(isSyncableKey);
export const clearSession = () => {
  [...SESSION_KEYS].forEach((k) => sessionRemove(k));
  memory.clear();
};

export default dataStore;
