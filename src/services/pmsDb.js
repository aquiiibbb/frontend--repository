// In-memory working copy of the hotel's rooms / room types / bookings / audit logs.
//
// There is NO seed data and NO browser storage here. The data is read from the data store
// (services/dataStore.js), which is filled from the backend (MongoDB) when the app starts and
// written back to the backend by services/backendSync.js whenever persist() saves it.

import { dataStore } from "./dataStore";

let counter = 1;
export function genId(prefix = "id") {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const asArray = (v) => (Array.isArray(v) ? v : []);

function readList(...keys) {
  for (const key of keys) {
    try {
      const raw = dataStore.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore broken value
    }
  }
  return null;
}

function load() {
  return {
    roomTypes: asArray(readList("hotelpms_room_types_v1", "hotelpms_room_types_v3")),
    rooms: asArray(readList("hotelpms_rooms_list_v1", "hotelpms_room_numbers_v3")),
    bookings: asArray(readList("hotelpms_bookings_v1")),
    auditLogs: asArray(readList("hotelpms_audit_logs_v1")),
  };
}

const db = load();

function stripLargeBase64Images(val) {
  if (!val) return val;
  if (typeof val === "string") {
    if (val.startsWith("data:image") && val.length > 50000) {
      return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80";
    }
    return val;
  }
  if (Array.isArray(val)) return val.map((item) => stripLargeBase64Images(item));
  if (typeof val === "object" && val !== null) {
    const cleanObj = {};
    for (const key of Object.keys(val)) cleanObj[key] = stripLargeBase64Images(val[key]);
    return cleanObj;
  }
  return val;
}

// Re-read rooms / room types / bookings from the data store (it may have been changed by another screen,
// another PC, or the public booking engine).
export function syncFromDataStore() {
  const bookings = readList("hotelpms_bookings_v1");
  if (bookings) db.bookings = bookings;
  const rooms = readList("hotelpms_rooms_list_v1", "hotelpms_room_numbers_v3");
  if (rooms) db.rooms = rooms;
  const types = readList("hotelpms_room_types_v1", "hotelpms_room_types_v3");
  if (types) db.roomTypes = types;
}

export function persist() {
  try {
    const cleanBookings = (db.bookings || []).map((b) => stripLargeBase64Images(b));
    dataStore.setItem("hotelpms_bookings_v1", JSON.stringify(cleanBookings));
    dataStore.setItem("hotelpms_rooms_list_v1", JSON.stringify(db.rooms || []));
    dataStore.setItem("hotelpms_room_numbers_v3", JSON.stringify(db.rooms || []));
    dataStore.setItem("hotelpms_room_types_v1", JSON.stringify(db.roomTypes || []));
    dataStore.setItem("hotelpms_room_types_v3", JSON.stringify(db.roomTypes || []));
    dataStore.setItem("hotelpms_audit_logs_v1", JSON.stringify(db.auditLogs || []));
  } catch (e) {
    console.error("Error saving hotel data:", e);
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
      window.dispatchEvent(new CustomEvent("pms_rooms_updated"));
    } catch {
      // ignore
    }
  }
}

// "Reset all data": empties the working copy and the whole hotel store (this also clears the data on the backend).
export function resetAllData() {
  db.roomTypes = [];
  db.rooms = [];
  db.bookings = [];
  db.auditLogs = [];
  dataStore.clear();
  persist();
}

export default db;
