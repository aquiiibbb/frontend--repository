// Single entry point used by every page for hotel data operations.
//
//  * Booking / room / folio logic runs in services/api.store.js on the in-memory hotel data.
//  * That data is loaded from, and saved to, the backend (MongoDB) by services/backendSync.js  -> /api/store
//  * Guest e-mails (confirmation, check-in, check-out, cancellation, no-show)                  -> /api/notify/event
//  * Public Booking Engine & Guest Self Check-in (no staff login)                              -> /api/public/*
//  * Misc transactions                                                                         -> /api/misc-transactions
//
// No mock data and no browser storage are used anywhere.

import * as storeApi from "./api.store.js";
import { notifyBooking, notifyAfterUpdate } from "./notifier.js";
import { apiRequest, getToken, isPublicPage, publicCreateBooking, publicSelfCheckIn } from "./backendSync.js";

// A guest on the public pages has no staff token: their action goes to the public endpoints instead
const isGuestSession = () => isPublicPage() && !getToken();

const SELF_CHECKIN_FIELDS = [
  "guest", "phone", "email", "address", "city", "idType", "idNumber", "room",
  "digitalSignature", "signature", "signatureOnFile", "notes",
];

export const getRooms = (...args) => storeApi.getRooms(...args);
export const getRoomTypes = (...args) => storeApi.getRoomTypes(...args);
export const getRoomsSync = storeApi.getRoomsSync;
export const getRoomTypesSync = storeApi.getRoomTypesSync;
export const getBookingsSync = storeApi.getBookingsSync;
export const saveRoomTypes = (...args) => storeApi.saveRoomTypes(...args);
export const saveRoomsList = (...args) => storeApi.saveRoomsList(...args);
export const updateRoomHousekeeping = (...args) => storeApi.updateRoomHousekeeping(...args);

export const getBookings = (...args) => storeApi.getBookings(...args);
export const getBooking = (...args) => storeApi.getBooking(...args);

export const createBooking = async (...args) => {
  const booking = await storeApi.createBooking(...args);
  if (isGuestSession()) {
    try {
      await publicCreateBooking(booking);
    } catch (err) {
      // the hotel's server refused it (e.g. the room was just taken): do not keep it on this page either
      try {
        await storeApi.deleteBooking(booking.id);
      } catch {
        /* ignore */
      }
      throw new Error(err?.message || "Could not complete the reservation. Please try again.");
    }
    return booking; // the server e-mails the confirmation to the guest
  }
  const st = String(booking?.status || "").toLowerCase();
  notifyBooking(st === "checked-in" || st === "occupied" ? "checkIn" : "confirmation", booking);
  return booking;
};

export const createGroupBooking = async (...args) => {
  const list = await storeApi.createGroupBooking(...args);
  (Array.isArray(list) ? list : []).slice(0, 30).forEach((b) => notifyBooking("confirmation", b));
  return list;
};

export const updateBooking = async (...args) => {
  const updated = await storeApi.updateBooking(...args);
  if (isGuestSession()) {
    const patch = args[1] || {};
    const fields = {};
    SELF_CHECKIN_FIELDS.forEach((f) => {
      if (patch[f] !== undefined) fields[f] = patch[f];
    });
    try {
      await publicSelfCheckIn(args[0], fields);
    } catch (err) {
      throw new Error(err?.message || "Could not complete check-in. Please try again or visit the front desk.");
    }
    return updated;
  }
  notifyAfterUpdate(updated, args[1]);
  return updated;
};

export const moveBooking = (...args) => storeApi.moveBooking(...args);

export const cancelBooking = async (...args) => {
  const booking = await storeApi.cancelBooking(...args);
  notifyBooking("cancellation", booking);
  return booking;
};

export const noShowBooking = async (...args) => {
  const booking = await storeApi.noShowBooking(...args);
  notifyBooking("noShow", booking);
  return booking;
};

export const splitStayBooking = (...args) => storeApi.splitStayBooking(...args);
export const transferBalance = (...args) => storeApi.transferBalance(...args);
export const addExtra = storeApi.addExtra;
export const addSettlement = storeApi.addSettlement;
export const addPayment = (...args) => (typeof storeApi.addPayment === "function" ? storeApi.addPayment(...args) : storeApi.addSettlement(...args));
export const postFolioPayment = addPayment;
export const addDeposit = (...args) => storeApi.addDeposit(...args);
export const applyDepositToFolio = (...args) => storeApi.applyDepositToFolio(...args);
export const updateDeposit = (...args) => storeApi.updateDeposit(...args);
export const deleteDeposit = (...args) => storeApi.deleteDeposit(...args);
export const refundDeposit = (...args) => storeApi.refundDeposit(...args);
export const deleteBooking = (...args) => storeApi.deleteBooking(...args);
export const resetAllData = (...args) => storeApi.resetAllData(...args);
export const resetSystemData = (...args) => storeApi.resetAllData(...args);

export const getAuditLogs = storeApi.getAuditLogs;

// ---- Misc transactions (tenant-aware backend endpoint) ----
export const getMiscTransactions = async (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  const res = await apiRequest(`/misc-transactions${qs ? `?${qs}` : ""}`);
  return Array.isArray(res?.data) ? res.data : [];
};
export const addMiscTransaction = async (data) => {
  const res = await apiRequest("/misc-transactions", { method: "POST", body: data });
  return res?.data || data;
};
export const deleteMiscTransaction = async (id) => {
  const res = await apiRequest(`/misc-transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
  return { success: Boolean(res?.success), deleted: Boolean(res?.deleted) };
};

// ---- Guest e-mail from the booking slip: really sent by the backend (/api/notify/event) ----
export const emailBooking = async (id) => {
  const booking = await storeApi.getBooking(id);
  const result = await notifyBooking("confirmation", booking, { force: true });
  if (!result) throw new Error("Could not reach the e-mail service. Please try again.");
  const g = result.guest || {};
  if (g.status === "sent") {
    await storeApi.emailBooking(id);
    return { message: `Confirmation email sent to ${g.to || booking.email || "the guest"}`, sent: true };
  }
  if (g.status === "failed") throw new Error(g.error || "The email could not be sent.");
  const reasons = {
    email_disabled: "Email is turned off for this hotel.",
    disabled: "This guest email is turned off in Email & Notifications settings.",
    daily_limit: "Daily email limit reached for this hotel.",
    recipient_limit: "This guest already received the maximum number of emails today.",
    no_guest_email: "This booking has no valid guest email address.",
    already_sent: "This email was already sent to the guest.",
  };

  throw new Error(reasons[g.reason] || "The email was not sent.");
};

export const slipPdfUrl = storeApi.slipPdfUrl;
export const regCardPdfUrl = () => "#";
export const folioPdfUrl = () => "#";
export const importBatchBookings = (...args) => storeApi.importBatchBookings(...args);
export const getMasterData = storeApi.getMasterData;

const api = {
  ...storeApi,
  getRooms, getRoomTypes, saveRoomTypes, saveRoomsList, updateRoomHousekeeping,
  getBookings, getBooking, createBooking, createGroupBooking, updateBooking, moveBooking,
  cancelBooking, noShowBooking, splitStayBooking, transferBalance, addExtra, addSettlement,
  addPayment, postFolioPayment, addDeposit, applyDepositToFolio, updateDeposit, deleteDeposit,
  refundDeposit, deleteBooking, resetAllData, resetSystemData,
  getAuditLogs, getMiscTransactions, addMiscTransaction, deleteMiscTransaction, emailBooking,
  slipPdfUrl, regCardPdfUrl, folioPdfUrl, importBatchBookings, getMasterData,
};

export default api;
