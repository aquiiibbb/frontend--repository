import { API_ROOT, getToken } from "./backendSync";

// Tells the server that something happened to a booking, so it can e-mail the guest (and alert the staff).
// The server decides everything (template, whether it is enabled, limits, never twice) - this file only reports the event.
// It never blocks or breaks the booking: all errors are swallowed and shown as a small toast instead.

const EVENT_LABEL = {
  confirmation: "Booking confirmation",
  checkIn: "Check-in welcome",
  checkOut: "Check-out thank-you",
  cancellation: "Cancellation notice",
};

// only what the e-mail needs (no ID photos, signatures or folios)
const SLIM = ["id", "guest", "email", "phone", "room", "roomType", "checkIn", "checkOut", "nights", "totalAmount", "status", "source", "segment", "subSegment", "otaId"];
const slimBooking = (b) => Object.fromEntries(SLIM.filter((k) => b?.[k] !== undefined && typeof b[k] !== "object").map((k) => [k, b[k]]));

const isRealReservation = (b) => {
  if (!b || !b.id || !b.guest) return false;
  const st = String(b.status || "").toLowerCase();
  if (["blocked", "block", "out-of-order", "maintenance"].includes(st)) return false;
  if (String(b.source || "").toLowerCase() === "maintenance" || String(b.guest).includes("🔒")) return false;
  return true;
};

const alreadyReported = new Set(); // this browser session: do not report the same event of a booking again and again

function announce(detail) {
  try {
    window.dispatchEvent(new CustomEvent("pms_email_result", { detail }));
  } catch {
    /* no window (tests / SSR) */
  }
}

async function post(path, body) {
  const res = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, data };
}

export async function notifyBooking(event, booking, { force = false } = {}) {
  try {
    if (!getToken() || !isRealReservation(booking)) return null;
    const key = `${event}:${booking.id}:${booking.guest}:${booking.email || ""}`;
    if (!force && alreadyReported.has(key)) return null;
    alreadyReported.add(key);
    const r = await post("/notify/event", { event, booking: slimBooking(booking), force });
    if (!r.ok || !r.data) return null;
    const g = r.data.guest || {};
    if (g.status === "sent") announce({ event, label: EVENT_LABEL[event], status: "sent", to: g.to });
    else if (g.status === "failed") announce({ event, label: EVENT_LABEL[event], status: "failed", to: booking.email, error: g.error });
    else if (g.reason === "daily_limit" || g.reason === "recipient_limit" || g.reason === "email_disabled") announce({ event, label: EVENT_LABEL[event], status: "blocked", reason: g.reason, to: booking.email });
    return r.data;
  } catch {
    alreadyReported.delete(`${event}:${booking?.id}:${booking?.guest}:${booking?.email || ""}`); // network problem: allow another try later
    return null;
  }
}

// What happened to a booking after an update -> which mail (only when the status really is the new one)
export function notifyAfterUpdate(updated, requested) {
  const st = String(requested?.status || "").toLowerCase();
  if (!updated || !st) return;
  if (st === "checked-in" || st === "occupied") notifyBooking("checkIn", updated);
  else if (st === "checked-out") notifyBooking("checkOut", updated);
  else if (st === "no-show") notifyBooking("noShow", updated);
}

export async function sendTestEmail(to, config) {
  try {
    const r = await post("/notify/test", { to, config });
    return { ok: r.ok && r.data?.success !== false, message: r.data?.error || r.data?.message || "", to };
  } catch {
    return { ok: false, message: "Cannot reach the server.", to };
  }
}

export async function getEmailServiceStatus() {
  try {
    const res = await fetch(`${API_ROOT}/notify/status`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    return Boolean(data?.platformConfigured);
  } catch {
    return null; // unknown (offline)
  }
}
