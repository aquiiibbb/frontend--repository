/**
 * Backend sync layer
 * ------------------
 * The PMS screens read/write their data through services/dataStore.js (an in-memory store - NO browser
 * localStorage, NO mock / seed data). This layer makes the Node + MongoDB backend the only permanent home of it:
 *
 *   1. On app start  -> download the hotel's data from the backend into the in-memory store (hydrate).
 *   2. On every save -> any change to a PMS key is sent to the backend in the background (write-through).
 *   3. Every few seconds -> ask the backend what changed (other PCs, public booking engine, super admin)
 *      and refresh the open screens through the same events the app already listens to.
 *
 * Backend endpoints used here:
 *   POST /session/login            GET  /store            GET /store/manifest     POST /store/get
 *   PUT  /store                    POST /store/reset      GET /public/snapshot    POST /public/bookings
 *   POST /public/bookings/:id/self-checkin                POST /ai/chat           POST /ocr/google-vision
 *   (notify/* is used by services/notifier.js)
 */

import {
  dataStore,
  setStoreHooks,
  rawSetMemory,
  rawRemoveMemory,
  rawClearMemory,
  syncableKeysInMemory,
  clearSession,
  isSyncableKey,
} from "./dataStore";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

export const USE_BACKEND = true;

const defaultBackendUrl =
  typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000"
    : typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:5000`
      : "http://localhost:5000";

const rawApiUrl = String(env.VITE_API_BASE_URL || env.REACT_APP_API_URL || env.VITE_API_URL || defaultBackendUrl).replace(/\/+$/, "");
export const API_ROOT = rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl}/api`;

export { isSyncableKey };

const PUBLIC_PATHS = [/^\/book(ing-engine)?\/?$/, /^\/guest-checkin(\/|$)/];
export function isPublicPage() {
  if (typeof window === "undefined") return false;
  return PUBLIC_PATHS.some((re) => re.test(window.location.pathname));
}

export const getToken = () => dataStore.getItem("pms_token");

const hotelFromUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get("hotel") || "";
  } catch {
    return "";
  }
};

// ---------- state ----------
const keyRev = new Map(); // key -> last revision known from the server
const lastSent = new Map(); // key -> last value string known to be on the server
const pending = new Map(); // key -> value string | null (waiting to be sent)
let flushTimer = null;
let queue = Promise.resolve();
let ready = false;
let pollTimer = null;
let resetEpoch = 0; // bumps on every "reset all data" so an older poll can never bring old data back
let resetQueued = false;
let resetsRunning = 0;
let listenersAttached = false;

// ---------- http ----------
async function api(path, { method = "GET", body, auth = true, keepalive = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API_ROOT}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (res.status === 401 && auth) handleSessionExpired();
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Generic authenticated call for other services (notifier, misc transactions ...)
export const apiRequest = api;

function handleSessionExpired() {
  if (typeof window === "undefined" || isPublicPage()) return;
  const p = window.location.pathname;
  if (p.startsWith("/login") || p.startsWith("/impersonate")) return;
  clearSession();
  window.location.href = "/login";
}

// ---------- events so open screens refresh ----------
const EVENT_MAP = [
  [/bookings|folios|deposits/, ["pms_bookings_updated", "pms_folio_updated"]],
  [/room_numbers|rooms_list|room_types|room_layout/, ["pms_rooms_updated", "pms_room_types_updated", "pms_room_layout_updated"]],
  [/taxes|tax_inclusive/, ["pms_taxes_updated", "pms_tax_inclusive_updated"]],
  [/rate_plans|daily_rates|yield/, ["pms_rate_plans_updated", "pms_daily_rates_updated", "pms_yield_status_updated", "pms_yield_rules_updated"]],
  [/addons/, ["pms_addons_updated"]],
  [/hotel_info|hotel_profile|hotel_terms/, ["pms_hotel_info_updated", "pms_hotel_profile_updated", "pms_terms_updated"]],
  [/users|roles/, ["pms_users_updated", "pms_roles_updated"]],
  [/company_accounts/, ["pms_company_accounts_updated"]],
  [/working_business_date|night_audit/, ["pms_business_date_updated", "pms_night_audit_config_updated"]],
  [/audit_logs/, ["pms_audit_logs_updated"]],
  [/channel/, ["pms_channel_config_updated", "pms_channel_mappings_updated", "pms_channel_restrictions_updated", "pms_daily_channel_restrictions_updated"]],
  [/colors/, ["pms_status_colors_updated", "pms_hk_colors_updated", "pms_activity_colors_updated"]],
  [
    /categories|business_sources|reservation_sources|sequence|cancellation|payment_gateways|ibe/,
    [
      "pms_categories_updated",
      "pms_business_sources_updated",
      "pms_reservation_sources_updated",
      "pms_sequence_config_updated",
      "pms_cancellation_policies_updated",
      "pms_payment_gateways_updated",
      "pms_ibe_display_updated",
    ],
  ],
];

function notifyRemoteChange(keys) {
  if (typeof window === "undefined") return;
  const names = new Set();
  keys.forEach((k) => EVENT_MAP.forEach(([re, evs]) => re.test(k) && evs.forEach((e) => names.add(e))));
  names.forEach((n) => window.dispatchEvent(new CustomEvent(n)));
  window.dispatchEvent(new CustomEvent("pms_remote_data_updated", { detail: { keys } }));
}

// ---------- write-through ----------
function queueWrite(key, value) {
  if (!ready) return;
  pending.set(key, value);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 400);
}

function flush(keepalive = false) {
  clearTimeout(flushTimer);
  flushTimer = null;
  if (pending.size === 0) return queue;
  const batch = [...pending.entries()];
  pending.clear();

  const changes = [];
  for (const [key, value] of batch) {
    if (value !== null && lastSent.get(key) === value) continue; // unchanged
    if (value === null && !lastSent.has(key) && !keyRev.has(key)) continue; // never existed on the server
    changes.push({ key, value, baseRev: keyRev.get(key) ?? 0 });
  }
  if (changes.length === 0) return queue;

  queue = queue.then(async () => {
    try {
      const data = await api("/store", { method: "PUT", body: { changes }, keepalive });
      const merged = [];
      for (const r of data?.results || []) {
        if (r.error) {
          console.error(`[sync] "${r.key}" not saved: ${r.error}`);
          continue;
        }
        if (r.deleted) {
          keyRev.delete(r.key);
          lastSent.delete(r.key);
          continue;
        }
        if (typeof r.rev === "number") keyRev.set(r.key, r.rev);
        const sent = changes.find((c) => c.key === r.key);
        if (r.merged) {
          // another PC added records meanwhile - adopt the merged list
          rawSetMemory(r.key, r.merged);
          lastSent.set(r.key, r.merged);
          merged.push(r.key);
        } else if (sent) {
          lastSent.set(r.key, sent.value);
        }
      }
      if (merged.length) notifyRemoteChange(merged);
    } catch (err) {
      console.warn("[sync] save failed, will retry:", err.message);
      // put back (only if nothing newer was queued) and retry later
      changes.forEach((c) => {
        if (!pending.has(c.key)) pending.set(c.key, c.value);
      });
      if (err.status !== 401 && err.status !== 403) {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(flush, 5000);
      }
    }
  });
  return queue;
}

function resetServerStore() {
  pending.clear();
  clearTimeout(flushTimer);
  keyRev.clear();
  lastSent.clear();
  resetEpoch += 1;
  if (!ready) return queue;
  // The reset flow calls clear() several times in a row - one queued server reset is enough
  if (resetQueued) return queue;
  resetQueued = true;
  resetsRunning += 1;
  queue = queue.then(async () => {
    resetQueued = false;
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // keepalive: the request still completes if the page reloads right after "Reset"
          await api("/store/reset", { method: "POST", keepalive: true });
          break;
        } catch (err) {
          console.error("[sync] reset failed:", err.message);
          if (attempt === 3 || err.status === 401 || err.status === 403) break;
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
      keyRev.clear();
      lastSent.clear();
    } finally {
      resetsRunning -= 1;
    }
  });
  return queue;
}

function installHooks() {
  setStoreHooks({
    onSet: (key, value) => queueWrite(key, value),
    onRemove: (key) => queueWrite(key, null),
    onClear: () => resetServerStore(),
  });
}

// Wait until everything the app saved (and any reset) has really reached the server. Call before window.location.reload().
export async function settleBackendSync() {
  try {
    await flush();
    await queue;
  } catch {
    /* ignore */
  }
}

export function resetBackendStore() {
  return resetServerStore();
}

// ---------- hydrate ----------
function applyEntries(entries) {
  Object.entries(entries).forEach(([key, e]) => {
    rawSetMemory(key, e.value);
    keyRev.set(key, e.rev);
    lastSent.set(key, e.value);
  });
}

async function hydrateAuthenticated() {
  const data = await api("/store");
  keyRev.clear();
  lastSent.clear();
  // the server is the only source of truth: drop whatever is in memory, then load the hotel's data
  syncableKeysInMemory().forEach((k) => rawRemoveMemory(k));
  applyEntries(data.entries || {});
  notifyRemoteChange(Object.keys(data.entries || {}));
  dataStore.setItem("pms_synced_tenant", dataStore.getItem("pms_tenant_id") || "default");
}

async function hydratePublic() {
  const hotel = hotelFromUrl() || dataStore.getItem("pms_last_hotel") || "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  const bookingId = parts[0] === "guest-checkin" && parts[1] ? parts[1] : "";
  const qs = new URLSearchParams();
  if (hotel) qs.set("hotel", hotel);
  if (bookingId) qs.set("booking", bookingId);
  const data = await api(`/public/snapshot?${qs.toString()}`, { auth: false });
  if (hotel) dataStore.setItem("pms_last_hotel", hotel);
  syncableKeysInMemory().forEach((k) => rawRemoveMemory(k));
  Object.entries(data.entries || {}).forEach(([k, v]) => rawSetMemory(k, v));
  if (data.tenantId) dataStore.setItem("pms_public_hotel", data.tenantId);
}

// ---------- polling ----------
async function pollOnce() {
  if (!ready || document.hidden || !getToken() || resetsRunning > 0) return;
  const epoch = resetEpoch;
  try {
    await flush();
    const { entries } = await api("/store/manifest");
    if (epoch !== resetEpoch || resetsRunning > 0) return;
    const serverMap = new Map(entries.map((e) => [e.key, e.rev]));
    const changed = [];
    for (const [key, rev] of serverMap) if ((keyRev.get(key) ?? -1) !== rev) changed.push(key);
    const removed = [...keyRev.keys()].filter((k) => !serverMap.has(k));

    // Don't overwrite something the user is saving right now
    const toFetch = changed.filter((k) => !pending.has(k));
    if (toFetch.length) {
      const data = await api("/store/get", { method: "POST", body: { keys: toFetch.slice(0, 300) } });
      if (epoch !== resetEpoch || resetsRunning > 0) return;
      const applied = [];
      Object.entries(data.entries || {}).forEach(([key, e]) => {
        if (pending.has(key)) return;
        const current = dataStore.getItem(key);
        keyRev.set(key, e.rev);
        lastSent.set(key, e.value);
        if (current !== e.value) {
          rawSetMemory(key, e.value);
          applied.push(key);
        }
      });
      if (applied.length) notifyRemoteChange(applied);
    }
    const gone = removed.filter((k) => !pending.has(k));
    if (gone.length) {
      gone.forEach((k) => {
        keyRev.delete(k);
        lastSent.delete(k);
        rawRemoveMemory(k);
      });
      notifyRemoteChange(gone);
    }
  } catch {
    /* offline - try again next tick */
  }
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(pollOnce, 6000);
  if (listenersAttached) return;
  listenersAttached = true;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) pollOnce();
  });
  window.addEventListener("online", pollOnce);
  window.addEventListener("pagehide", () => flush(true));
  window.addEventListener("beforeunload", () => flush(true));
}

// Check the server for changes right now (also used by the 6-second timer)
export const syncNow = () => pollOnce();

// ---------- public API ----------
export async function initBackendSync() {
  if (typeof window === "undefined") return { mode: "none" };
  installHooks();

  if (getToken()) {
    try {
      await hydrateAuthenticated();
      ready = true;
      startPolling();
      return { mode: "backend" };
    } catch (err) {
      console.error("[sync] could not load hotel data:", err.message);
      if (err.status === 401) {
        handleSessionExpired();
        return { mode: "logged-out" };
      }
      window.__PMS_BACKEND_ERROR__ = err.message;
      throw err; // main.jsx shows a "cannot reach server" screen with a Retry button
    }
  }

  if (isPublicPage()) {
    try {
      await hydratePublic();
      return { mode: "public" };
    } catch (err) {
      console.error("[sync] could not load public hotel data:", err.message);
      window.__PMS_BACKEND_ERROR__ = err.message;
      throw err;
    }
  }
  return { mode: "anonymous" };
}

// Called by the Login page right after the backend accepted the credentials
export async function startSessionAfterLogin({ token, tenantId }) {
  installHooks();
  const previous = dataStore.getItem("pms_synced_tenant");
  dataStore.setItem("pms_token", token);
  dataStore.setItem("pms_tenant_id", tenantId || "default");
  if (previous && previous !== (tenantId || "default")) {
    // switching to a different hotel: never carry the previous hotel's data over
    syncableKeysInMemory().forEach((k) => rawRemoveMemory(k));
  }
  ready = false;
  await hydrateAuthenticated();
  ready = true;
  startPolling();
}

export async function loginToBackend(username, password, hotel) {
  const hotelCode = String(hotel || hotelFromUrl() || dataStore.getItem("pms_last_hotel") || "").trim();
  const data = await api("/session/login", {
    method: "POST",
    auth: false,
    body: { username, password, hotel: hotelCode || undefined },
  });
  if (hotelCode) dataStore.setItem("pms_last_hotel", hotelCode);
  return data;
}

// Super admin opens a hotel: same clean switch as a normal login (the previous hotel's data is never carried over)
export async function startImpersonation({ token, tenantId, user, hotelName, adminUrl }) {
  await flush(true).catch(() => {});
  await startSessionAfterLogin({ token, tenantId });
  dataStore.setItem("pms_user", JSON.stringify(user));
  dataStore.setItem("pms_authenticated", "true");
  dataStore.setItem("pms_impersonating", JSON.stringify({ tenantId, hotelName: hotelName || tenantId, adminUrl: adminUrl || "" }));
}

// Back to the admin panel: save pending changes, then leave nothing of this hotel in the browser
export async function endImpersonation() {
  await flush(true).catch(() => {});
  ready = false;
  syncableKeysInMemory().forEach((k) => rawRemoveMemory(k));
  clearSession();
}

// Logout: push the last unsaved change, then forget the hotel completely (memory + session)
export function logoutFromBackend() {
  return flush(true)
    .catch(() => {})
    .finally(() => {
      ready = false;
      clearInterval(pollTimer);
      pending.clear();
      keyRev.clear();
      lastSent.clear();
      syncableKeysInMemory().forEach((k) => rawRemoveMemory(k));
      clearSession();
    });
}

// Public pages (no staff login) -> backend
export async function publicCreateBooking(booking) {
  const hotel = dataStore.getItem("pms_public_hotel") || hotelFromUrl() || "";
  return api(`/public/bookings${hotel ? `?hotel=${encodeURIComponent(hotel)}` : ""}`, { method: "POST", auth: false, body: { booking } });
}

export async function publicSelfCheckIn(bookingId, fields) {
  const hotel = dataStore.getItem("pms_public_hotel") || hotelFromUrl() || "";
  return api(`/public/bookings/${encodeURIComponent(bookingId)}/self-checkin${hotel ? `?hotel=${encodeURIComponent(hotel)}` : ""}`, {
    method: "POST",
    auth: false,
    body: fields,
  });
}

// AI helpers (the API keys stay on the server)
export async function askClaude(message, context, history) {
  return api("/ai/chat", { method: "POST", body: { message, context, history } });
}

export async function googleVisionViaServer(imageBase64) {
  return api("/ocr/google-vision", { method: "POST", body: { imageBase64 } });
}
