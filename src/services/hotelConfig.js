import { dataStore } from "./dataStore";
export const STORAGE_KEY_HOTEL_INFO = "hotelpms_hotel_info_v3";
export const STORAGE_KEY_RATE_PLANS = "hotelpms_rate_plans_v3";
export const STORAGE_KEY_ADDONS = "hotelpms_addons_v3";
export const STORAGE_KEY_TAXES = "hotelpms_taxes_v3";
export const STORAGE_KEY_DAILY_RATES = "hotelpms_daily_rates_matrix_v3";
export const STORAGE_KEY_ROOM_TYPES = "hotelpms_room_types_v3";
export const STORAGE_KEY_ROOM_NUMBERS = "hotelpms_room_numbers_v3";
export const STORAGE_KEY_CANCELLATION_POLICIES = "hotelpms_cancellation_policies_v3";
export const STORAGE_KEY_HOTEL_TERMS = "hotelpms_hotel_terms_v3";
export const STORAGE_KEY_BUSINESS_DATE = "hotelpms_working_business_date_v3";
export const STORAGE_KEY_NIGHT_AUDIT_CONFIG = "hotelpms_night_audit_config_v3";
export const STORAGE_KEY_SEQUENCE_CONFIG = "hotelpms_sequence_config_v1";
export const STORAGE_KEY_ROOM_LAYOUT_ORDER = "hotelpms_room_layout_order_v1";
export const STORAGE_KEY_ROOM_LAYOUT_DIMENSIONS = "hotelpms_room_layout_dimensions_v1";
export const STORAGE_KEY_ROOM_LAYOUT_COORDS = "hotelpms_room_layout_coords_v1";
export const STORAGE_KEY_STATUS_COLORS = "hotelpms_status_colors_v1";
export const STORAGE_KEY_HK_COLORS = "hotelpms_hk_colors_v1";
export const STORAGE_KEY_ACTIVITY_COLORS = "hotelpms_activity_colors_v1";
export const STORAGE_KEY_TAX_INCLUSIVE = "hotelpms_tax_inclusive_v1";
export const STORAGE_KEY_TRANSACTION_CATEGORIES = "hotelpms_transaction_categories_v1";

export const DEFAULT_STATUS_COLORS = {
  confirmed: { bg: "#2563eb", text: "#ffffff" },
  checked_in: { bg: "#16a34a", text: "#ffffff" },
  checked_out: { bg: "#64748b", text: "#ffffff" },
  blocked: { bg: "#dc2626", text: "#ffffff" },
  enquiry: { bg: "#f59e0b", text: "#ffffff" },
};

export const DEFAULT_HK_COLORS = {
  total: { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" },
  clean: { bg: "#ffffff", text: "#16a34a", border: "#bbf7d0" },
  dirty: { bg: "#ffffff", text: "#dc2626", border: "#fecaca" },
  outOfOrder: { bg: "#ffffff", text: "#d97706", border: "#fef08a" },
  occupied: { bg: "#ffffff", text: "#2563eb", border: "#bfdbfe" },
  vacant: { bg: "#ffffff", text: "#475569", border: "#e2e8f0" },
  checkoutToday: { bg: "#ffffff", text: "#7c2d12", border: "#fde68a" },
};

export const DEFAULT_ACTIVITY_COLORS = {
  arrivals: { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" },
  departures: { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" },
  inHouse: { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" },
  stayovers: { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" },
  bookings: { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" },
  cancelations: { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" },
  noShow: { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" },
  blocked: { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" },
};

if (typeof window !== "undefined") {
  [
    "hotelpms_hotel_info_v1", "hotelpms_rate_plans_v1", "hotelpms_addons_v1", "hotelpms_taxes_v1", "hotelpms_daily_rates_matrix_v1", "hotelpms_room_types_v1", "hotelpms_room_numbers_v1",
    "hotelpms_hotel_info_v2", "hotelpms_rate_plans_v2", "hotelpms_addons_v2", "hotelpms_taxes_v2", "hotelpms_daily_rates_matrix_v2", "hotelpms_room_types_v2", "hotelpms_room_numbers_v2"
  ].forEach((k) => {
    try { dataStore.removeItem(k); } catch {}
  });
}

const DEFAULT_HOTEL_PROFILE = {
  name: "My Hotel",
  website: "",
  taxId: "",
  totalRooms: "0",
  contactName: "",
  currency: "US Dollar ($)",
  phone: "",
  email: "",
  city: "",
  state: "",
  country: "United States",
  address: "",
  zipcode: "",
  rating: 5,
  logoUrl: "",
  logo: "",
  checkInTime: "15:00",
  checkOutTime: "11:00",
};

const DEFAULT_SEED_ROOMS = [];

export function logSystemAuditAction({ module = "System Configuration", action = "Updated", details = "", status = "success", user, role }) {
  try {
    const isTestEnv = typeof process !== "undefined" && (process.env.NODE_ENV === "test" || process.env.VITEST);
    if (isTestEnv || typeof dataStore === "undefined") return;

    let activeUser = user || "admin";
    let activeRole = role || "System Admin";
    try {
      const uStr = dataStore.getItem("pms_user");
      if (uStr) {
        const u = JSON.parse(uStr);
        activeUser = u.name || u.username || activeUser;
        activeRole = u.role || activeRole;
      }
    } catch (e) {}

    const rawLogs = dataStore.getItem("hotelpms_audit_logs_v1");
    let logs = [];
    if (rawLogs) {
      try { logs = JSON.parse(rawLogs) || []; } catch (e) {}
    }
    if (!Array.isArray(logs)) logs = [];

    const newLog = {
      id: "sal_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
      user: activeUser,
      role: activeRole,
      module,
      action,
      details,
      status,
      ipAddress: "192.168.1.100"
    };

    logs.unshift(newLog);
    dataStore.setItem("hotelpms_audit_logs_v1", JSON.stringify(logs));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_audit_logs_updated", { detail: logs }));
    }
    return newLog;
  } catch (err) {
    console.error("Failed to log system audit action:", err);
  }
}

export function getRoomsList() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_ROOM_NUMBERS);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error reading rooms list:", e);
  }
  return DEFAULT_SEED_ROOMS;
}

export function saveRoomsList(rooms) {
  try {
    const prevList = getRoomsList();
    const list = Array.isArray(rooms) ? rooms : [];
    const isTestEnv = typeof process !== "undefined" && (process.env.NODE_ENV === "test" || process.env.VITEST);
    if (!isTestEnv && typeof dataStore !== "undefined") {
      dataStore.setItem(STORAGE_KEY_ROOM_NUMBERS, JSON.stringify(list));
      dataStore.setItem("hotelpms_room_numbers_v3", JSON.stringify(list));
      dataStore.setItem("hotelpms_rooms_list_v1", JSON.stringify(list));

      if (list.length > prevList.length) {
        const prevIds = new Set(prevList.map((r) => String(r.no || r.number || r.id)));
        const added = list.filter((r) => !prevIds.has(String(r.no || r.number || r.id)));
        const addedNames = added.map((r) => `Room ${r.no || r.number || r.id} (${r.type || "Standard"})`).join(", ");

        logSystemAuditAction({
          module: "System Configuration",
          action: "Room Added",
          details: `Added new room(s) to property inventory: ${addedNames || "New Room"}. Total active rooms: ${list.length}.`
        });
      } else if (list.length < prevList.length) {
        const currentIds = new Set(list.map((r) => String(r.no || r.number || r.id)));
        const removed = prevList.filter((r) => !currentIds.has(String(r.no || r.number || r.id)));
        const removedNames = removed.map((r) => `Room ${r.no || r.number || r.id}`).join(", ");

        logSystemAuditAction({
          module: "System Configuration",
          action: "Room Removed",
          details: `Deleted room(s) from property inventory: ${removedNames || "Room"}. Total active rooms: ${list.length}.`
        });
      } else {
        logSystemAuditAction({
          module: "System Configuration",
          action: "Room Configuration Updated",
          details: `Updated property room inventory details (Total: ${list.length} active rooms).`
        });
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_rooms_updated", { detail: list }));
    }
    if (!isTestEnv) {
      triggerBackendConfigSync();
    }
    return list;
  } catch (e) {
    console.error("Error saving rooms list:", e);
    return [];
  }
}

export function getRoomLayoutOrder() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_ROOM_LAYOUT_ORDER);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error reading room layout order:", e);
  }
  return {};
}

// Room layout (coords / sizes / order) is stored under its own keys in the data store and reaches the backend
// automatically through services/backendSync.js (/api/store). Kept as a function so every caller keeps working.
export function syncLayoutToBackend() {
  return undefined;
}

export function saveRoomLayoutOrder(orderMap) {
  try {
    const data = orderMap && typeof orderMap === "object" ? orderMap : {};
    dataStore.setItem(STORAGE_KEY_ROOM_LAYOUT_ORDER, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_room_layout_updated", { detail: data }));
    }
    syncLayoutToBackend();
    return data;
  } catch (e) {
    console.error("Error saving room layout order:", e);
    return {};
  }
}

export const DEFAULT_TRANSACTION_CATEGORIES = {
  sale: ['Room Tariff', 'Food & Beverage', 'Laundry', 'Parking & Transport', 'Misc / Other'],
  expense: ['Housekeeping & Cleaning', 'Maintenance & Repairs', 'Utilities & Fuel', 'Staff & Operational', 'Misc / Other']
};

export function getTransactionCategories() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_TRANSACTION_CATEGORIES);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          sale: Array.isArray(parsed.sale) ? parsed.sale : [...DEFAULT_TRANSACTION_CATEGORIES.sale],
          expense: Array.isArray(parsed.expense) ? parsed.expense : [...DEFAULT_TRANSACTION_CATEGORIES.expense]
        };
      }
    }
  } catch (e) {
    console.error("Error reading transaction categories:", e);
  }
  return {
    sale: [...DEFAULT_TRANSACTION_CATEGORIES.sale],
    expense: [...DEFAULT_TRANSACTION_CATEGORIES.expense]
  };
}

export function saveTransactionCategories(categories) {
  try {
    const data = {
      sale: Array.isArray(categories?.sale) ? categories.sale : [],
      expense: Array.isArray(categories?.expense) ? categories.expense : []
    };
    dataStore.setItem(STORAGE_KEY_TRANSACTION_CATEGORIES, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_categories_updated", { detail: data }));
    }
    return data;
  } catch (e) {
    console.error("Error saving transaction categories:", e);
    return DEFAULT_TRANSACTION_CATEGORIES;
  }
}

export function addCustomTransactionCategory(type, categoryName) {
  if (!categoryName || !categoryName.trim()) return getTransactionCategories();
  const catStr = categoryName.trim();
  const current = getTransactionCategories();
  const key = (type === 'SALE' || type === 'sale') ? 'sale' : 'expense';
  
  if (!current[key].includes(catStr)) {
    current[key] = [...current[key], catStr];
    saveTransactionCategories(current);
  }
  return current;
}

export function getRoomLayoutDimensions() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_ROOM_LAYOUT_DIMENSIONS);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error reading room layout dimensions:", e);
  }
  return {};
}

export function saveRoomLayoutDimensions(dimMap) {
  try {
    const data = dimMap && typeof dimMap === "object" ? dimMap : {};
    dataStore.setItem(STORAGE_KEY_ROOM_LAYOUT_DIMENSIONS, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_room_dimensions_updated", { detail: data }));
    }
    syncLayoutToBackend();
    return data;
  } catch (e) {
    console.error("Error saving room layout dimensions:", e);
    return {};
  }
}

export function getRoomLayoutCoords() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_ROOM_LAYOUT_COORDS);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error reading room layout coords:", e);
  }
  return {};
}

export function saveRoomLayoutCoords(coordsMap) {
  try {
    const data = coordsMap && typeof coordsMap === "object" ? coordsMap : {};
    dataStore.setItem(STORAGE_KEY_ROOM_LAYOUT_COORDS, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_room_coords_updated", { detail: data }));
    }
    syncLayoutToBackend();
    return data;
  } catch (e) {
    console.error("Error saving room layout coords:", e);
    return {};
  }
}

// Rooms, room types, rates, add-ons, taxes, profile and colours are saved through the data store, which
// services/backendSync.js writes to the tenant-aware backend (/api/store). No extra call is needed here.
export async function triggerBackendConfigSync() {
  return undefined;
}

// Hotel data is loaded from the backend at app start (kept for compatibility)
export const autoSyncAtlasToLocalStorage = async () => {
  // The hotel's data is loaded from the backend when the app starts (services/backendSync.js).
  return;
};

// Run auto-sync immediately if window is available
if (typeof window !== "undefined") {
  setTimeout(() => {
    autoSyncAtlasToLocalStorage().catch(() => {});
  }, 300);
}

const DEFAULT_ROOM_TYPES = [];

export function getRoomTypes() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_ROOM_TYPES);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Error reading room types:", e);
  }
  return [];
}

const VIRTUAL_ROOM_KEYWORDS = [
  "virtual",
  "owner",
  "house use",
  "house-use",
  "houseuse",
  "staff",
  "non-revenue",
  "non revenue",
  "nonrevenue",
  "out of order",
  "maintenance",
  "posting master",
  "dummy",
  "comp",
  "complimentary"
];

export function isVirtualRoomOrBooking(target, roomsInput, roomTypesInput) {
  if (!target) return false;

  if (typeof target === "string" || typeof target === "number") {
    const targetStr = String(target).trim().toLowerCase();
    return VIRTUAL_ROOM_KEYWORDS.some((kw) => targetStr.includes(kw));
  }

  if (typeof target === "object") {
    if (
      target.isVirtual ||
      target.isStaff ||
      target.isStaffRoom ||
      target.isOwner ||
      target.isOwnerRoom ||
      target.isHouseUse ||
      target.isNonRevenue ||
      target.isVirtualStay ||
      target.isComplimentary
    ) {
      return true;
    }

    const fields = [
      target.room,
      target.roomNumber,
      target.roomNo,
      target.roomId,
      target.roomType,
      target.type,
      target.category,
      target.name,
      target.guest,
      target.guestName,
      target.ratePlan
    ];

    const combinedStr = fields.filter(Boolean).join(" ").toLowerCase();
    if (VIRTUAL_ROOM_KEYWORDS.some((kw) => combinedStr.includes(kw))) {
      return true;
    }
  }

  return false;
}

export function getVirtualRoomTypeNames(roomTypesInput) {
  const roomTypes = Array.isArray(roomTypesInput) ? roomTypesInput : getRoomTypes();
  return roomTypes
    .filter((rt) => Boolean(rt.isVirtual || rt.isStaffRoom || rt.isHouseUse || isVirtualRoomOrBooking(rt)))
    .map((rt) => String(rt.name || "").trim().toLowerCase());
}

export function getSellableRooms(roomsInput, roomTypesInput) {
  const rooms = Array.isArray(roomsInput) ? roomsInput : getRoomsList();
  const roomTypes = Array.isArray(roomTypesInput) ? roomTypesInput : getRoomTypes();
  
  const virtualTypeNames = roomTypes
    .filter((rt) => Boolean(rt.isVirtual || rt.isStaffRoom || rt.isHouseUse || isVirtualRoomOrBooking(rt)))
    .map((rt) => String(rt.name || "").trim().toLowerCase());

  return rooms.filter((r) => {
    const rType = String(r.type || r.roomType || "").trim().toLowerCase();
    const rNo = String(r.no || r.roomNumber || r.roomNo || r.name || "").trim().toLowerCase();
    if (virtualTypeNames.includes(rType) || r.isVirtual || r.isStaffRoom || r.isHouseUse || r.isOwner) {
      return false;
    }
    if (VIRTUAL_ROOM_KEYWORDS.some((kw) => rType.includes(kw) || rNo.includes(kw))) {
      return false;
    }
    return true;
  });
}

export function findRoomByNumber(roomsInput, roomNo) {
  if (!roomNo) return null;
  const rooms = Array.isArray(roomsInput) && roomsInput.length > 0 ? roomsInput : getRoomsList();
  const target = String(roomNo).trim().toLowerCase();
  return rooms.find((r) => {
    const rNo = String(r.no ?? r.number ?? r.roomNumber ?? r.roomNo ?? r.id ?? "").trim().toLowerCase();
    return rNo === target;
  }) || null;
}

export function findRoomTypeByName(roomTypesInput, typeName) {
  if (!typeName) return null;
  const roomTypes = Array.isArray(roomTypesInput) && roomTypesInput.length > 0 ? roomTypesInput : getRoomTypes();
  const target = String(typeName).trim().toLowerCase();
  return roomTypes.find((t) => {
    const tName = String(t.name ?? t.type ?? t.category ?? t.title ?? "").trim().toLowerCase();
    return tName === target;
  }) || null;
}

export function getRoomTypePrice(roomTypeObj, presetRoomObj) {
  if (
    roomTypeObj?.isVirtual ||
    roomTypeObj?.isStaffRoom ||
    roomTypeObj?.isStaff ||
    roomTypeObj?.virtual ||
    roomTypeObj?.isOwner ||
    presetRoomObj?.isVirtual ||
    presetRoomObj?.isOwner ||
    isVirtualRoomOrBooking(roomTypeObj) ||
    isVirtualRoomOrBooking(presetRoomObj)
  ) {
    return 0;
  }
  const val = roomTypeObj?.price ?? roomTypeObj?.basePrice ?? roomTypeObj?.rate ?? roomTypeObj?.baseRate ?? roomTypeObj?.rateUSD ?? presetRoomObj?.price ?? presetRoomObj?.rateUSD ?? presetRoomObj?.baseRate;
  const num = Number(val);
  return !isNaN(num) && num > 0 ? num : 150;
}

export function isSellableRoom(roomNo, roomsInput, roomTypesInput) {
  if (!roomNo) return false;
  if (isVirtualRoomOrBooking(roomNo, roomsInput, roomTypesInput)) return false;
  const sellableRooms = getSellableRooms(roomsInput, roomTypesInput);
  const rNoStr = String(roomNo || "").trim().toLowerCase();
  return sellableRooms.some((r) => String(r.no || r.roomNumber || r.roomNo || r.name || "").trim().toLowerCase() === rNoStr);
}

export function compressImageFile(file, maxWidth = 350, maxHeight = 140, quality = 0.9) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result;
      if (!src) return resolve("");
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/png", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

export function getHotelProfile() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_HOTEL_INFO);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        const logoVal = parsed.logo || parsed.logoUrl || "";
        return {
          name: parsed.name ?? "",
          website: parsed.website ?? "",
          taxId: parsed.taxId ?? "",
          totalRooms: parsed.totalRooms ?? "",
          contactName: parsed.contactName ?? "",
          currency: parsed.currency || "US Dollar ($)",
          phone: parsed.phone ?? "",
          email: parsed.email ?? "",
          city: parsed.city ?? "",
          state: parsed.state ?? "",
          country: parsed.country ?? "",
          address: parsed.address ?? "",
          zipcode: parsed.zipcode ?? "",
          rating: Number(parsed.rating) || 0,
          logoUrl: logoVal,
          logo: logoVal,
          checkInTime: parsed.checkInTime || "15:00",
          checkOutTime: parsed.checkOutTime || "11:00",
        };
      }
    }
  } catch (e) {
    console.error("Error reading hotel profile:", e);
  }
  return DEFAULT_HOTEL_PROFILE;
}

function normalizeStatusItem(val, defaultObj) {
  if (!val) return { ...defaultObj };
  if (typeof val === "string") return { bg: val, text: "#ffffff" };
  return {
    bg: val.bg || defaultObj.bg,
    text: val.text || defaultObj.text,
  };
}

export function getStatusColors() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_STATUS_COLORS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        return {
          confirmed: normalizeStatusItem(parsed.confirmed, DEFAULT_STATUS_COLORS.confirmed),
          checked_in: normalizeStatusItem(parsed.checked_in, DEFAULT_STATUS_COLORS.checked_in),
          checked_out: normalizeStatusItem(parsed.checked_out, DEFAULT_STATUS_COLORS.checked_out),
          blocked: normalizeStatusItem(parsed.blocked, DEFAULT_STATUS_COLORS.blocked),
          enquiry: normalizeStatusItem(parsed.enquiry, DEFAULT_STATUS_COLORS.enquiry),
        };
      }
    }
  } catch (e) {
    console.error("Error reading status colors:", e);
  }
  return {
    confirmed: { ...DEFAULT_STATUS_COLORS.confirmed },
    checked_in: { ...DEFAULT_STATUS_COLORS.checked_in },
    checked_out: { ...DEFAULT_STATUS_COLORS.checked_out },
    blocked: { ...DEFAULT_STATUS_COLORS.blocked },
    enquiry: { ...DEFAULT_STATUS_COLORS.enquiry },
  };
}

export function saveStatusColors(colors) {
  try {
    const data = {
      confirmed: normalizeStatusItem(colors?.confirmed, DEFAULT_STATUS_COLORS.confirmed),
      checked_in: normalizeStatusItem(colors?.checked_in, DEFAULT_STATUS_COLORS.checked_in),
      checked_out: normalizeStatusItem(colors?.checked_out, DEFAULT_STATUS_COLORS.checked_out),
      blocked: normalizeStatusItem(colors?.blocked, DEFAULT_STATUS_COLORS.blocked),
      enquiry: normalizeStatusItem(colors?.enquiry, DEFAULT_STATUS_COLORS.enquiry),
    };
    dataStore.setItem(STORAGE_KEY_STATUS_COLORS, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_status_colors_updated", { detail: data }));
    }
    triggerBackendConfigSync();
    return data;
  } catch (e) {
    console.error("Error saving status colors:", e);
    return getStatusColors();
  }
}

function normalizeColorBoxItem(item, fallback) {
  if (!item || typeof item !== "object") return { ...fallback };
  return {
    bg: typeof item.bg === "string" && item.bg.trim() ? item.bg.trim() : fallback.bg,
    text: typeof item.text === "string" && item.text.trim() ? item.text.trim() : fallback.text,
    border: typeof item.border === "string" && item.border.trim() ? item.border.trim() : (fallback.border || "#cbd5e1"),
  };
}

export function getHkColors() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_HK_COLORS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        const result = {};
        Object.keys(DEFAULT_HK_COLORS).forEach((key) => {
          result[key] = normalizeColorBoxItem(parsed[key], DEFAULT_HK_COLORS[key]);
        });
        return result;
      }
    }
  } catch (e) {
    console.error("Error reading HK colors:", e);
  }
  const result = {};
  Object.keys(DEFAULT_HK_COLORS).forEach((key) => {
    result[key] = { ...DEFAULT_HK_COLORS[key] };
  });
  return result;
}

export function saveHkColors(colors) {
  try {
    const data = {};
    Object.keys(DEFAULT_HK_COLORS).forEach((key) => {
      data[key] = normalizeColorBoxItem(colors?.[key], DEFAULT_HK_COLORS[key]);
    });
    dataStore.setItem(STORAGE_KEY_HK_COLORS, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_hk_colors_updated", { detail: data }));
    }
    triggerBackendConfigSync();
    return data;
  } catch (e) {
    console.error("Error saving HK colors:", e);
    return getHkColors();
  }
}

export function getActivityColors() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_ACTIVITY_COLORS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        const result = {};
        Object.keys(DEFAULT_ACTIVITY_COLORS).forEach((key) => {
          result[key] = normalizeColorBoxItem(parsed[key], DEFAULT_ACTIVITY_COLORS[key]);
        });
        return result;
      }
    }
  } catch (e) {
    console.error("Error reading Activity colors:", e);
  }
  const result = {};
  Object.keys(DEFAULT_ACTIVITY_COLORS).forEach((key) => {
    result[key] = { ...DEFAULT_ACTIVITY_COLORS[key] };
  });
  return result;
}

export function saveActivityColors(colors) {
  try {
    const data = {};
    Object.keys(DEFAULT_ACTIVITY_COLORS).forEach((key) => {
      data[key] = normalizeColorBoxItem(colors?.[key], DEFAULT_ACTIVITY_COLORS[key]);
    });
    dataStore.setItem(STORAGE_KEY_ACTIVITY_COLORS, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_activity_colors_updated", { detail: data }));
    }
    triggerBackendConfigSync();
    return data;
  } catch (e) {
    console.error("Error saving Activity colors:", e);
    return getActivityColors();
  }
}

export function saveHotelProfile(profile) {
  try {
    const currentLocal = getHotelProfile();
    const data = profile && typeof profile === "object" ? { ...profile } : { ...DEFAULT_HOTEL_PROFILE };

    let logoVal = "";
    if (data.isLogoRemoved) {
      logoVal = "";
    } else {
      logoVal = data.logo || data.logoUrl || currentLocal.logo || currentLocal.logoUrl || "";
    }

    data.logo = logoVal;
    data.logoUrl = logoVal;

    try {
      dataStore.setItem(STORAGE_KEY_HOTEL_INFO, JSON.stringify(data));
    } catch (quotaErr) {
      console.warn("⚠️ Could not save hotel profile logo", quotaErr);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_hotel_profile_updated", { detail: data }));
      window.dispatchEvent(new CustomEvent("pms_hotel_info_updated", { detail: data }));
    }
    logSystemAuditAction({
      module: "System Configuration",
      action: "Hotel Profile Updated",
      details: `Updated property information for ${data.name || "Hotel"}.`
    });
    triggerBackendConfigSync();
    return data;
  } catch (e) {
    console.error("Error saving hotel profile:", e);
    return DEFAULT_HOTEL_PROFILE;
  }
}

const DEFAULT_RATE_PLANS = [];

export function getRatePlans() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_RATE_PLANS);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((p) => {
          let n = Number(p.nights);
          if (!n || isNaN(n)) {
            const nameLower = (p.name || "").toLowerCase();
            const codeLower = (p.code || "").toLowerCase();
            if (nameLower.includes("week") || codeLower === "wr") n = 7;
            else if (nameLower.includes("month") || codeLower === "mr") n = 30;
            else if (nameLower.includes("weekend")) n = 2;
            else n = 1;
          }
          const rateVal = Number(p.adjustment !== undefined && p.adjustment !== "" ? p.adjustment : p.price !== undefined ? p.price : p.rate || 100);
          return {
            ...p,
            nights: n,
            adjustment: String(rateVal),
            rate: rateVal,
            price: rateVal,
          };
        });
      }
    }
  } catch (e) {
    console.error("Error reading rate plans:", e);
  }
  return [];
}

export function saveRatePlans(plans) {
  try {
    const list = Array.isArray(plans) ? plans : [];
    dataStore.setItem(STORAGE_KEY_RATE_PLANS, JSON.stringify(list));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_rate_plans_updated", { detail: list }));
    }
    logSystemAuditAction({
      module: "Rates & Inventory",
      action: "Rate Plans Updated",
      details: `Updated property rate plans configuration (${list.length} active plans).`
    });
    triggerBackendConfigSync();
    return list;
  } catch (e) {
    console.error("Error saving rate plans:", e);
    return [];
  }
}

export const STORAGE_KEY_RESERVATION_SOURCES = "hotelpms_reservation_sources_v3";

const DEFAULT_ADDONS = [];

const DEFAULT_RESERVATION_SOURCES = [
  "Walk-In",
  "Direct Phone",
  "Hotel Website",
  "Booking.com",
  "Expedia",
  "Agoda",
  "Corporate / Travel Agent",
  "Referral",
  "Other"
];

export function getHotelAddons() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_ADDONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error reading hotel addons:", e);
  }
  return DEFAULT_ADDONS;
}

export function saveHotelAddons(addons) {
  try {
    const list = Array.isArray(addons) ? addons : [];
    dataStore.setItem(STORAGE_KEY_ADDONS, JSON.stringify(list));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_addons_updated", { detail: list }));
    }
    logSystemAuditAction({
      module: "System Configuration",
      action: "Addons & Amenities Updated",
      details: `Updated hotel addons & POS items list (${list.length} items).`
    });
    triggerBackendConfigSync();
    return list;
  } catch (e) {
    console.error("Error saving hotel addons:", e);
    return [];
  }
}

export function getReservationSources() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_RESERVATION_SOURCES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error reading reservation sources:", e);
  }
  return DEFAULT_RESERVATION_SOURCES;
}

export function saveReservationSources(sources) {
  try {
    dataStore.setItem(STORAGE_KEY_RESERVATION_SOURCES, JSON.stringify(sources));
    window.dispatchEvent(new CustomEvent("pms_reservation_sources_updated"));
    return true;
  } catch (e) {
    console.error("Error saving reservation sources:", e);
    return false;
  }
}

export const STORAGE_KEY_BUSINESS_SOURCES = "hotelpms_business_sources_v1";

export const DEFAULT_BUSINESS_SOURCES = [
  {
    id: "src_company",
    segment: "COMPANY",
    subSegments: []
  },
  {
    id: "src_direct",
    segment: "DIRECT",
    subSegments: ["WALK IN", "EMAIL", "CALL"]
  },
  {
    id: "src_ota",
    segment: "OTA",
    subSegments: ["EXPEDIA", "BOOKING.COM", "AGODA"]
  },
  {
    id: "src_corporate",
    segment: "CORPORATE",
    subSegments: ["COMPANY DIRECT", "CONTRACTED RATE", "EVENT / DELEGATE"]
  },
  {
    id: "src_travel_agent",
    segment: "TRAVEL AGENT",
    subSegments: ["LOCAL AGENT", "WHOLESALER", "TOUR OPERATOR"]
  }
];

export function getBusinessSources() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_BUSINESS_SOURCES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasCompany = parsed.some(
          (s) => (s.segment || "").toUpperCase() === "COMPANY" || (s.segment || "").toUpperCase() === "CORPORATE"
        );
        if (!hasCompany) {
          return [
            { id: "src_company", segment: "COMPANY", subSegments: [] },
            ...parsed
          ];
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading business sources:", e);
  }
  return DEFAULT_BUSINESS_SOURCES;
}

export function saveBusinessSources(sources) {
  try {
    let list = Array.isArray(sources) ? sources : [];
    const hasCompany = list.some(
      (s) => (s.segment || "").toUpperCase() === "COMPANY" || (s.segment || "").toUpperCase() === "CORPORATE"
    );
    if (!hasCompany) {
      list = [{ id: "src_company", segment: "COMPANY", subSegments: [] }, ...list];
    }
    dataStore.setItem(STORAGE_KEY_BUSINESS_SOURCES, JSON.stringify(list));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_business_sources_updated", { detail: list }));
    }
    logSystemAuditAction({
      module: "System Configuration",
      action: "Business Sources Updated",
      details: `Updated market segment & channel source rules.`
    });
    triggerBackendConfigSync();
    return list;
  } catch (e) {
    console.error("Error saving business sources:", e);
    return [];
  }
}

export function getTaxRules() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_TAXES);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Error reading tax rules:", e);
  }
  return [];
}

export function saveTaxRules(rules) {
  try {
    const list = Array.isArray(rules) ? rules : [];
    dataStore.setItem(STORAGE_KEY_TAXES, JSON.stringify(list));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_taxes_updated", { detail: list }));
    }
    logSystemAuditAction({
      module: "System Configuration",
      action: "Tax Rules Updated",
      details: `Updated property tax rules & percentages (${list.length} active rules).`
    });
    triggerBackendConfigSync();
    return list;
  } catch (e) {
    console.error("Error saving tax rules:", e);
    return [];
  }
}

export function getActiveTaxPercent() {
  const rules = getTaxRules();
  const active = rules.filter((r) => r.status === "Active" || r.status === "active" || r.active !== false);
  if (active.length === 0) return 0;
  const total = active.reduce((sum, r) => sum + (Number(r.percent || r.taxPercent || r.rate) || 0), 0);
  return Math.round(total * 100) / 100;
}

export function getActiveTaxSummaryText() {
  const rules = getTaxRules();
  const active = rules.filter((r) => r.status === "Active" || r.status === "active" || r.active !== false);
  if (active.length === 0) return "No Active Tax (0%)";
  const names = active.map((r) => {
    if (r.taxType === "fixed") {
      const fixedVal = Number(r.fixedAmount || r.amount || 0).toFixed(2);
      const isPerStay = r.fixedCalculation === "per_stay";
      return `${r.name} ($${fixedVal}/${isPerStay ? "stay" : "night"})`;
    }
    return `${r.name} (${r.percent || r.percentage || 0}%)`;
  }).join(" + ");
  return names;
}

export function getTaxInclusiveSetting() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_TAX_INCLUSIVE);
    if (saved !== null) {
      return saved === "true";
    }
  } catch (e) {
    console.error("Error reading tax inclusive setting:", e);
  }
  return false; // Default: Tax Exclusive
}

export function saveTaxInclusiveSetting(isInclusive) {
  try {
    const val = Boolean(isInclusive);
    dataStore.setItem(STORAGE_KEY_TAX_INCLUSIVE, String(val));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_tax_inclusive_updated", { detail: val }));
    }
    triggerBackendConfigSync();
    return val;
  } catch (e) {
    console.error("Error saving tax inclusive setting:", e);
    return false;
  }
}

export function getDailyRatesMap() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_DAILY_RATES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) {
    console.error("Error reading daily rates map:", e);
  }
  return {};
}

export function saveDailyRate(key, rateData) {
  try {
    const map = getDailyRatesMap();
    map[key] = rateData;
    dataStore.setItem(STORAGE_KEY_DAILY_RATES, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("pms_daily_rates_updated"));
    logSystemAuditAction({
      module: "Rates & Inventory",
      action: "Daily Rate Updated",
      details: `Updated daily pricing entry for ${key}.`
    });
    return true;
  } catch (e) {
    console.error("Error saving daily rate:", e);
    return false;
  }
}

export function bulkUpdateDailyRates({ startDate, endDate, daysOfWeek, roomTypes, ratePlans, adjustmentType, fixedPrice, adjustmentVal, customRatesMap, minStay, stopSell }) {
  try {
    const map = getDailyRatesMap();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const dayNum = d.getDay();
      
      if (daysOfWeek && daysOfWeek.length > 0 && !daysOfWeek.includes(dayNum)) {
        continue;
      }

      (roomTypes || []).forEach((rt) => {
        (ratePlans || []).forEach((rp) => {
          const key = `${rt}_${rp}_${dateStr}`;
          const existing = map[key] || {};
          let newPrice = Number(existing.price || 0);

          const customIndividualRate = customRatesMap && customRatesMap[`${rt}_${rp}`];
          if (customIndividualRate !== undefined && customIndividualRate !== "") {
            newPrice = Number(customIndividualRate);
          } else if (adjustmentType === "fixed" && fixedPrice !== undefined && fixedPrice !== "") {
            newPrice = Number(fixedPrice);
          } else if (adjustmentType === "percent" && adjustmentVal !== undefined && adjustmentVal !== "") {
            const current = newPrice > 0 ? newPrice : 150;
            newPrice = Math.max(0, current + (current * Number(adjustmentVal) / 100));
          } else if (adjustmentType === "flat" && adjustmentVal !== undefined && adjustmentVal !== "") {
            const current = newPrice > 0 ? newPrice : 150;
            newPrice = Math.max(0, current + Number(adjustmentVal));
          }

          map[key] = {
            ...existing,
            price: Math.round(newPrice * 100) / 100,
            minStay: minStay !== undefined && minStay !== "" ? Number(minStay) : (existing.minStay || 1),
            stopSell: stopSell !== undefined ? stopSell : (existing.stopSell || false),
          };
        });
      });
    }

    dataStore.setItem(STORAGE_KEY_DAILY_RATES, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("pms_daily_rates_updated"));
    logSystemAuditAction({
      module: "Rates & Inventory",
      action: "Bulk Rate Matrix Updated",
      details: `Bulk rate matrix update applied for period ${startDate} to ${endDate}.`
    });
    return true;
  } catch (e) {
    console.error("Error performing bulk rate update:", e);
    return false;
  }
}

const DEFAULT_CANCELLATION_POLICIES = [
  {
    id: "cp_24h",
    name: "24 Hours Standard Policy",
    noticeHours: 24,
    refundType: "one_night",
    description: "Cancellations made 24+ hours prior to check-in receive a 100% Full Refund. Cancellations made within 24 hours of check-in or No-Shows incur a 1 Night Room & Tax penalty.",
    isDefault: true
  },
  {
    id: "cp_nonref",
    name: "Non-Refundable Policy",
    noticeHours: 0,
    refundType: "no_refund",
    description: "Non-Refundable: 100% total booking amount charged at time of reservation and non-refundable upon cancellation.",
    isDefault: false
  }
];

export function getCancellationPolicies() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_CANCELLATION_POLICIES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error reading cancellation policies:", e);
  }
  return DEFAULT_CANCELLATION_POLICIES;
}

export function saveCancellationPolicies(policies) {
  try {
    const list = Array.isArray(policies) ? policies : [];
    dataStore.setItem(STORAGE_KEY_CANCELLATION_POLICIES, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("pms_cancellation_policies_updated"));

    const policySummary = list
      .map((p) => `'${p.name}' (${p.noticeHours || 0}h notice, ${p.refundType === "one_night" ? "1 Night Fee" : p.refundType === "no_refund" ? "Non-Refundable" : "Full Refund"}${p.isDefault ? " [Default]" : ""})`)
      .join("; ");

    logSystemAuditAction({
      module: "System Configuration",
      action: "Cancellation Policy Updated",
      details: `Updated cancellation policy rules (${list.length} active policies): ${policySummary || "No active policies"}.`
    });
  } catch (e) {
    console.error("Error saving cancellation policies:", e);
  }
}

export function getHotelTerms() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_HOTEL_TERMS);
    if (saved !== null) return saved;
  } catch (e) {
    console.error("Error reading hotel terms:", e);
  }
  return "";
}

export function saveHotelTerms(terms) {
  try {
    dataStore.setItem(STORAGE_KEY_HOTEL_TERMS, terms);
    window.dispatchEvent(new CustomEvent("pms_terms_updated"));
    logSystemAuditAction({
      module: "System Configuration",
      action: "Hotel Terms Updated",
      details: `Updated property terms, conditions, & house rules.`
    });
  } catch (e) {
    console.error("Error saving hotel terms:", e);
  }
}

export function formatMMDDYYYY(dateStr) {
  if (!dateStr) return "";
  const str = String(dateStr).trim().substring(0, 10);
  const parts = str.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [yyyy, mm, dd] = parts;
    return `${mm}/${dd}/${yyyy}`;
  }
  return str;
}

export function getBusinessDate() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_BUSINESS_DATE);
    if (saved && saved.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
      return saved;
    }
  } catch (e) {
    console.error("Error reading business date:", e);
  }

  // Initial fallback: If no business date has ever been saved, initialize ONCE to current system date
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const initialDate = `${yyyy}-${mm}-${dd}`;

  try {
    dataStore.setItem(STORAGE_KEY_BUSINESS_DATE, initialDate);
  } catch {}
  return initialDate;
}

export function setBusinessDate(newDate) {
  if (!newDate || typeof newDate !== "string" || newDate.length !== 10) return;
  try {
    dataStore.setItem(STORAGE_KEY_BUSINESS_DATE, newDate);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_business_date_updated"));
    }
  } catch (e) {
    console.error("Error setting business date:", e);
  }
}

export function advanceBusinessDate() {
  try {
    const current = getBusinessDate();
    const parts = current.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const nextDate = `${yyyy}-${mm}-${dd}`;

    dataStore.setItem(STORAGE_KEY_BUSINESS_DATE, nextDate);

    const cfg = getNightAuditConfig();
    cfg.lastAuditCompletedDate = current;
    dataStore.setItem(STORAGE_KEY_NIGHT_AUDIT_CONFIG, JSON.stringify(cfg));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_business_date_updated"));
    }
    return nextDate;
  } catch (e) {
    console.error("Error advancing business date:", e);
    return getBusinessDate();
  }
}

export function getNightAuditConfig() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_NIGHT_AUDIT_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        return {
          nightAuditTime: parsed.nightAuditTime || "06:00",
          autoPrompt: parsed.autoPrompt !== undefined ? Boolean(parsed.autoPrompt) : true,
          lastAuditCompletedDate: parsed.lastAuditCompletedDate || "",
        };
      }
    }
  } catch (e) {
    console.error("Error reading night audit config:", e);
  }
  return {
    nightAuditTime: "06:00",
    autoPrompt: true,
    lastAuditCompletedDate: "",
  };
}

export function saveNightAuditConfig(cfg) {
  try {
    const current = getNightAuditConfig();
    const updated = { ...current, ...cfg };
    dataStore.setItem(STORAGE_KEY_NIGHT_AUDIT_CONFIG, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("pms_night_audit_config_updated"));
    return updated;
  } catch (e) {
    console.error("Error saving night audit config:", e);
    return null;
  }
}

export const DEFAULT_SEQUENCE_CONFIG = {
  booking: { prefix: "BK-", suffix: "", nextNumber: 1001, padding: 5 },
  splitBooking: { prefix: "SPL-", suffix: "", nextNumber: 1001, padding: 5 },
  group: { prefix: "GRP-", suffix: "", nextNumber: 3001, padding: 5 },
  invoice: { prefix: "INV-", suffix: "", nextNumber: 5001, padding: 5 },
  receipt: { prefix: "RCT-", suffix: "", nextNumber: 2001, padding: 5 },
  grc: { prefix: "GRC-", suffix: "", nextNumber: 101, padding: 5 },
  cancellation: { prefix: "CNL-", suffix: "", nextNumber: 7001, padding: 5 },
  noshow: { prefix: "NS-", suffix: "", nextNumber: 8001, padding: 5 },
  misc: { prefix: "MSC-", suffix: "", nextNumber: 1001, padding: 5 },
  cityLedger: { prefix: "CL-", suffix: "", nextNumber: 1001, padding: 4 },
};

export function getSequenceConfig() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_SEQUENCE_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        return {
          booking: { ...DEFAULT_SEQUENCE_CONFIG.booking, ...(parsed.booking || {}) },
          splitBooking: { ...DEFAULT_SEQUENCE_CONFIG.splitBooking, ...(parsed.splitBooking || {}) },
          group: { ...DEFAULT_SEQUENCE_CONFIG.group, ...(parsed.group || {}) },
          invoice: { ...DEFAULT_SEQUENCE_CONFIG.invoice, ...(parsed.invoice || {}) },
          receipt: { ...DEFAULT_SEQUENCE_CONFIG.receipt, ...(parsed.receipt || {}) },
          grc: { ...DEFAULT_SEQUENCE_CONFIG.grc, ...(parsed.grc || {}) },
          cancellation: { ...DEFAULT_SEQUENCE_CONFIG.cancellation, ...(parsed.cancellation || {}) },
          noshow: { ...DEFAULT_SEQUENCE_CONFIG.noshow, ...(parsed.noshow || {}) },
          misc: { ...DEFAULT_SEQUENCE_CONFIG.misc, ...(parsed.misc || {}) },
          cityLedger: { ...DEFAULT_SEQUENCE_CONFIG.cityLedger, ...(parsed.cityLedger || {}) },
        };
      }
    }
  } catch (e) {
    console.error("Error reading sequence config:", e);
  }
  return DEFAULT_SEQUENCE_CONFIG;
}

export function saveSequenceConfig(cfg) {
  try {
    const current = getSequenceConfig();
    const updated = {
      booking: { ...current.booking, ...(cfg.booking || {}) },
      splitBooking: { ...current.splitBooking, ...(cfg.splitBooking || {}) },
      group: { ...current.group, ...(cfg.group || {}) },
      invoice: { ...current.invoice, ...(cfg.invoice || {}) },
      receipt: { ...current.receipt, ...(cfg.receipt || {}) },
      grc: { ...current.grc, ...(cfg.grc || {}) },
      cancellation: { ...current.cancellation, ...(cfg.cancellation || {}) },
      noshow: { ...current.noshow, ...(cfg.noshow || {}) },
      misc: { ...current.misc, ...(cfg.misc || {}) },
      cityLedger: { ...current.cityLedger, ...(cfg.cityLedger || {}) },
    };
    dataStore.setItem(STORAGE_KEY_SEQUENCE_CONFIG, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("pms_sequence_config_updated"));
    return updated;
  } catch (e) {
    console.error("Error saving sequence config:", e);
    return DEFAULT_SEQUENCE_CONFIG;
  }
}

export function formatSequence(prefix = "", nextNum = 1, padding = 5, suffix = "") {
  const numVal = Number(nextNum) || 1;
  const padVal = Math.max(1, Math.min(10, Number(padding) || 1));
  const paddedStr = String(numVal).padStart(padVal, "0");
  return `${prefix || ""}${paddedStr}${suffix || ""}`;
}

export function generateNextSequence(type = "booking", autoIncrement = true) {
  const config = getSequenceConfig();
  const item = config[type] || DEFAULT_SEQUENCE_CONFIG[type] || { prefix: "", suffix: "", nextNumber: 1, padding: 5 };
  const formatted = formatSequence(item.prefix, item.nextNumber, item.padding, item.suffix);

  if (autoIncrement) {
    const updatedNext = (Number(item.nextNumber) || 1) + 1;
    saveSequenceConfig({
      ...config,
      [type]: { ...item, nextNumber: updatedNext },
    });
  }

  return formatted;
}

const STORAGE_KEY_IBE_ROOM_DISPLAY = "hotelpms_ibe_room_displays_v1";

export function getBookingEngineRoomDisplays() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_IBE_ROOM_DISPLAY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) {
    console.error("Error reading booking engine room displays:", e);
  }
  return {};
}

export function saveBookingEngineRoomDisplays(data) {
  try {
    dataStore.setItem(STORAGE_KEY_IBE_ROOM_DISPLAY, JSON.stringify(data || {}));
    window.dispatchEvent(new CustomEvent("pms_ibe_display_updated"));
    return true;
  } catch (e) {
    console.error("Error saving booking engine room displays:", e);
    return false;
  }
}

export const STORAGE_KEY_USERS = "hotelpms_users_v1";

export const DEFAULT_USER_RIGHTS = {
  // Page Access Rights
  dashboard: true,
  calendar: true,
  reservations: true,
  ratesAvailability: true,
  masterReport: false,
  profiles: true,
  groupsEvents: true,
  housekeeping: true,
  nightAudit: false,
  houseAccounts: false,
  misc: false,
  bookingEngine: true,
  configuration: false,

  // Operational Action Rights
  rateOverride: false,
  folioPayments: true,
  discountsTaxes: false,
  voidRefund: false,
  manageUsers: false,

  // Legacy compatibility keys
  frontDesk: true,
  hotelSettings: false,
  reportsAudit: false,
};

export const ALL_YES_RIGHTS = {
  dashboard: true,
  calendar: true,
  reservations: true,
  ratesAvailability: true,
  masterReport: true,
  profiles: true,
  groupsEvents: true,
  housekeeping: true,
  nightAudit: true,
  houseAccounts: true,
  misc: true,
  bookingEngine: true,
  configuration: true,
  rateOverride: true,
  folioPayments: true,
  discountsTaxes: true,
  voidRefund: true,
  manageUsers: true,
  frontDesk: true,
  hotelSettings: true,
  reportsAudit: true,
};

export const USER_RIGHTS_LABELS = [
  // Page Access Permissions
  { key: "dashboard", category: "Page Access", label: "Dashboard Page", desc: "View property performance dashboard & key metrics" },
  { key: "calendar", category: "Page Access", label: "Calendar & Tape Chart", desc: "Access 7/15/30 day frontdesk tape chart grid" },
  { key: "reservations", category: "Page Access", label: "Reservations Page", desc: "View activity stream, guest bookings & walk-in entry" },
  { key: "ratesAvailability", category: "Page Access", label: "Rates & Availability", desc: "Access daily rates matrix and room category pricing" },
  { key: "masterReport", category: "Page Access", label: "Master Financial Report", desc: "Access master revenue reports, daily sales & occupancy statistics" },
  { key: "profiles", category: "Page Access", label: "Profiles (Guest DB)", desc: "Access guest directory, customer profiles & history" },
  { key: "groupsEvents", category: "Page Access", label: "Groups & Events", desc: "Create & manage group block reservations and events" },
  { key: "housekeeping", category: "Page Access", label: "Housekeeping Board", desc: "View & update room cleaning statuses (Clean, Dirty, Inspected, Out of Order)" },
  { key: "nightAudit", category: "Page Access", label: "Night Audit Page", desc: "Perform daily night audit rollover, room status updates & audit logs" },
  { key: "houseAccounts", category: "Page Access", label: "House Accounts", desc: "Access corporate company ledgers & house accounts" },
  { key: "misc", category: "Page Access", label: "Misc Operations & POS", desc: "Record daily miscellaneous expenses, POS sales & cash transactions" },
  { key: "bookingEngine", category: "Page Access", label: "Direct Booking Engine", desc: "Access public direct booking engine link" },
  { key: "configuration", category: "Page Access", label: "Configuration & Setup", desc: "Access hotel profile, room types, taxes & system setup" },

  // Operational Action Permissions
  { key: "rateOverride", category: "Operational Actions", label: "Override Room Rates", desc: "Modify base room prices during reservation editing or walk-in entry" },
  { key: "folioPayments", category: "Operational Actions", label: "Process Folio Payments", desc: "Post payments, extra folio charges & account settlements" },
  { key: "discountsTaxes", category: "Operational Actions", label: "Discounts & Tax Exemptions", desc: "Apply custom line item discounts or tax-exempt statuses" },
  { key: "voidRefund", category: "Operational Actions", label: "Void & Refund Operations", desc: "Void posted charges or process payment refunds on folios" },
  { key: "manageUsers", category: "Operational Actions", label: "Manage Users & Roles", desc: "Create, edit, suspend or assign privileges to staff accounts & roles" },
];

export const DEFAULT_ROLES = [
  {
    id: "role_sys_admin",
    name: "System Admin",
    description: "Full administrative access across all modules, rate overrides, settings, and user management",
    isBuiltIn: true,
    rights: { ...ALL_YES_RIGHTS }
  },
  {
    id: "role_manager",
    name: "Manager",
    description: "Full operational and management privileges across front desk, folios, reports, and staff",
    isBuiltIn: true,
    rights: { ...ALL_YES_RIGHTS }
  },
  {
    id: "role_front_desk",
    name: "Front Desk Staff",
    description: "Daily front desk operations, tape chart, check-in/out, and folio payment collection",
    isBuiltIn: false,
    rights: {
      dashboard: true,
      calendar: true,
      reservations: true,
      ratesAvailability: true,
      masterReport: false,
      profiles: true,
      groupsEvents: true,
      housekeeping: true,
      nightAudit: false,
      houseAccounts: true,
      misc: true,
      bookingEngine: true,
      configuration: false,
      rateOverride: false,
      folioPayments: true,
      discountsTaxes: false,
      voidRefund: false,
      manageUsers: false,
      frontDesk: true,
      hotelSettings: false,
      reportsAudit: false
    }
  },
  {
    id: "role_night_auditor",
    name: "Night Auditor",
    description: "Night audit closing, daily revenue posting, room status updates, and audit report generation",
    isBuiltIn: false,
    rights: {
      dashboard: true,
      calendar: true,
      reservations: true,
      ratesAvailability: true,
      masterReport: true,
      profiles: true,
      groupsEvents: true,
      housekeeping: true,
      nightAudit: true,
      houseAccounts: true,
      misc: true,
      bookingEngine: true,
      configuration: false,
      rateOverride: false,
      folioPayments: true,
      discountsTaxes: false,
      voidRefund: false,
      manageUsers: false,
      frontDesk: true,
      hotelSettings: false,
      reportsAudit: true
    }
  },
  {
    id: "role_hk_supervisor",
    name: "Housekeeping Supervisor",
    description: "Full management of housekeeping board, room inspections, and staff assignments",
    isBuiltIn: false,
    rights: {
      dashboard: false,
      calendar: false,
      reservations: false,
      ratesAvailability: false,
      masterReport: false,
      profiles: false,
      groupsEvents: false,
      housekeeping: true,
      nightAudit: false,
      houseAccounts: false,
      misc: false,
      bookingEngine: false,
      configuration: false,
      rateOverride: false,
      folioPayments: false,
      discountsTaxes: false,
      voidRefund: false,
      manageUsers: false,
      frontDesk: false,
      hotelSettings: false,
      reportsAudit: false
    }
  },
  {
    id: "role_housekeeper",
    name: "Housekeeper",
    description: "Dedicated housekeeper staff account for updating room cleaning statuses and remarks",
    isBuiltIn: false,
    rights: {
      dashboard: false,
      calendar: false,
      reservations: false,
      ratesAvailability: false,
      masterReport: false,
      profiles: false,
      groupsEvents: false,
      housekeeping: true,
      nightAudit: false,
      houseAccounts: false,
      misc: false,
      bookingEngine: false,
      configuration: false,
      rateOverride: false,
      folioPayments: false,
      discountsTaxes: false,
      voidRefund: false,
      manageUsers: false,
      frontDesk: false,
      hotelSettings: false,
      reportsAudit: false
    }
  },
  {
    id: "role_accountant",
    name: "Accountant",
    description: "Access to folios, audit logs, financial summaries, and revenue reports",
    isBuiltIn: false,
    rights: {
      dashboard: true,
      calendar: false,
      reservations: false,
      ratesAvailability: false,
      masterReport: true,
      profiles: false,
      groupsEvents: false,
      housekeeping: false,
      nightAudit: true,
      houseAccounts: true,
      misc: true,
      bookingEngine: false,
      configuration: false,
      rateOverride: false,
      folioPayments: true,
      discountsTaxes: true,
      voidRefund: false,
      manageUsers: false,
      frontDesk: false,
      hotelSettings: false,
      reportsAudit: true
    }
  }
];

export const STORAGE_KEY_ROLES = "hotelpms_roles_v1";

export function getRoles() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_ROLES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading PMS roles:", e);
  }
  return DEFAULT_ROLES;
}

export function saveRoles(rolesList) {
  try {
    const list = Array.isArray(rolesList) ? rolesList : DEFAULT_ROLES;
    dataStore.setItem(STORAGE_KEY_ROLES, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("pms_roles_updated"));
    logSystemAuditAction({
      module: "User Security",
      action: "Role Permissions Updated",
      details: `Updated staff role security permissions matrix (${list.length} active roles).`
    });
    triggerBackendConfigSync();
    return list;
  } catch (e) {
    console.error("Error saving PMS roles:", e);
    return DEFAULT_ROLES;
  }
}

export function getUserRights(user) {
  if (!user) return { ...DEFAULT_USER_RIGHTS };
  if (user.role === "Manager" || user.role === "System Admin" || user.username === "admin") {
    return user.rights ? { ...ALL_YES_RIGHTS, ...user.rights } : { ...ALL_YES_RIGHTS };
  }
  const roles = getRoles();
  const matched = roles.find((r) => r.name?.toLowerCase() === user.role?.toLowerCase());
  let res = { ...DEFAULT_USER_RIGHTS };
  if (matched && matched.rights) {
    res = { ...res, ...matched.rights };
  }
  if (user.rights) {
    res = { ...res, ...user.rights };
  }

  // Ensure explicit page access keys resolve with legacy fallbacks if necessary
  if (res.calendar === undefined) res.calendar = Boolean(res.frontDesk);
  if (res.reservations === undefined) res.reservations = Boolean(res.frontDesk);
  if (res.profiles === undefined) res.profiles = Boolean(res.frontDesk);
  if (res.groupsEvents === undefined) res.groupsEvents = Boolean(res.frontDesk);
  if (res.ratesAvailability === undefined) res.ratesAvailability = Boolean(res.frontDesk || res.rateOverride || res.hotelSettings);
  if (res.masterReport === undefined) res.masterReport = Boolean(res.reportsAudit);
  if (res.nightAudit === undefined) res.nightAudit = Boolean(res.reportsAudit || res.frontDesk);
  if (res.houseAccounts === undefined) res.houseAccounts = Boolean(res.folioPayments || res.reportsAudit);
  if (res.misc === undefined) res.misc = Boolean(res.folioPayments || res.frontDesk);
  if (res.configuration === undefined) res.configuration = Boolean(res.hotelSettings || res.manageUsers);
  if (res.dashboard === undefined) res.dashboard = true;
  if (res.bookingEngine === undefined) res.bookingEngine = true;

  return res;
}

const DEFAULT_USERS = [
  {
    id: "usr_admin",
    username: "admin",
    password: "admin",
    name: "System Administrator",
    email: "admin@hotelpms.com",
    role: "System Admin",
    status: "Active",
    rights: { ...ALL_YES_RIGHTS }
  }
];

export function getUsers() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_USERS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasAdmin = parsed.some((u) => u.username?.toLowerCase() === "admin");
        return hasAdmin ? parsed : [...DEFAULT_USERS, ...parsed];
      }
    }
  } catch (e) {
    console.error("Error reading PMS users:", e);
  }
  return DEFAULT_USERS;
}

export function saveUsers(usersList) {
  try {
    const list = Array.isArray(usersList) ? usersList : DEFAULT_USERS;
    dataStore.setItem(STORAGE_KEY_USERS, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("pms_users_updated"));
    logSystemAuditAction({
      module: "User Security",
      action: "User Credentials Updated",
      details: `Updated staff user accounts & security access rights (${list.length} active users).`
    });
    triggerBackendConfigSync();
    return list;
  } catch (e) {
    console.error("Error saving PMS users:", e);
    return DEFAULT_USERS;
  }
}

export function getHousekeepers() {
  const users = getUsers();
  return users.filter(
    (u) =>
      u &&
      u.status === "Active" &&
      (u.role === "Housekeeper" ||
       u.role === "Housekeeping Supervisor" ||
       Boolean(u.rights?.housekeeping))
  );
}

export const STORAGE_KEY_YIELD_RULES = "hotelpms_yield_rules_v1";
export const STORAGE_KEY_YIELD_STATUS = "hotelpms_yield_status_v1";

const DEFAULT_YIELD_RULES = [];

export function getYieldManagementStatus() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_YIELD_STATUS);
    if (saved !== null) {
      return saved === "true";
    }
  } catch (e) {
    console.error("Error reading yield status:", e);
  }
  return true;
}

export function setYieldManagementStatus(enabled) {
  try {
    dataStore.setItem(STORAGE_KEY_YIELD_STATUS, String(Boolean(enabled)));
    window.dispatchEvent(new CustomEvent("pms_yield_status_updated", { detail: Boolean(enabled) }));
    return Boolean(enabled);
  } catch (e) {
    console.error("Error saving yield status:", e);
    return true;
  }
}

export function getYieldRules() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_YIELD_RULES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error reading yield rules:", e);
  }
  return DEFAULT_YIELD_RULES;
}

export function saveYieldRules(rulesList) {
  try {
    const list = Array.isArray(rulesList) ? rulesList : DEFAULT_YIELD_RULES;
    dataStore.setItem(STORAGE_KEY_YIELD_RULES, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("pms_yield_rules_updated"));
    logSystemAuditAction({
      module: "Rates & Inventory",
      action: "Yield Rules Updated",
      details: `Updated dynamic yield management & restriction rules (${list.length} active rules).`
    });
    return list;
  } catch (e) {
    console.error("Error saving yield rules:", e);
    return DEFAULT_YIELD_RULES;
  }
}

export function calculateYieldPrice(basePrice, occupancyPercent = 50, roomTypeId = null) {
  const base = Number(basePrice || 100);
  const isEnabled = getYieldManagementStatus();

  if (!isEnabled) {
    return { adjustedPrice: base, ruleApplied: null, adjustmentText: "Base Rate (Yield Disabled)" };
  }

  const rules = getYieldRules();
  const occ = Math.max(0, Math.min(100, Number(occupancyPercent || 0)));

  const matchedRule = rules.find((r) => {
    if (r.status !== "Active") return false;
    if (r.appliesTo && r.appliesTo !== "All" && roomTypeId && r.appliesTo !== roomTypeId) return false;
    const min = Number(r.minOccupancy || 0);
    const max = Number(r.maxOccupancy || 100);
    return occ >= min && occ <= max;
  });

  if (!matchedRule) {
    return { adjustedPrice: base, ruleApplied: null, adjustmentText: "Standard Base Tariff" };
  }

  let finalPrice = base;
  let text = "Standard Rate";
  const val = Number(matchedRule.adjustmentValue || 0);

  if (matchedRule.adjustmentType === "percentage") {
    finalPrice = Math.round(base * (1 + val / 100));
    text = val >= 0 ? `⚡ Surge (+${val}%)` : `🏷️ Discount (${val}%)`;
  } else if (matchedRule.adjustmentType === "fixed") {
    finalPrice = Math.max(1, base + val);
    text = val >= 0 ? `⚡ Surge (+$${val})` : `🏷️ Discount (-$${Math.abs(val)})`;
  } else if (matchedRule.adjustmentType === "flat") {
    finalPrice = Math.max(1, val);
    text = `🎯 Tier Flat Rate ($${val})`;
  }

  return {
    adjustedPrice: finalPrice,
    ruleApplied: matchedRule,
    adjustmentText: text,
  };
}

// ==========================================
// EMAIL & NOTIFICATIONS CONFIGURATION
// ==========================================
export const STORAGE_KEY_EMAIL_CONFIG = "hotelpms_email_config_v1";
export const STORAGE_KEY_GUEST_NOTIFICATIONS = "hotelpms_guest_notifications_v1";
export const STORAGE_KEY_HOTELIER_NOTIFICATIONS = "hotelpms_hotelier_notifications_v1";

export const DEFAULT_EMAIL_CONFIG = {
  sendingMode: "builtin",
  fromName: "Best Value Inn",
  fromEmail: "reservations@bestvalueinn.com",
  replyTo: "frontdesk@bestvalueinn.com",
  smtpHost: "email-smtp.us-east-1.amazonaws.com",
  smtpPort: "587",
  security: "TLS",
  smtpUser: "AKIAXXXXXXXXXXXXXXXX",
  smtpPass: "••••••••••••••••••••",
  provider: "AWS SES (Central System Gateway)"
};

export const DEFAULT_GUEST_NOTIFICATIONS = {
  confirmation: {
    enabled: true,
    attachVoucher: true,
    subject: "Booking Confirmation - {HotelName} (Res #{BookingID})",
    body: "Dear {GuestName},\n\nThank you for choosing {HotelName}! Your reservation #{BookingID} has been successfully confirmed.\n\nCheck-In Date: {CheckInDate}\nCheck-Out Date: {CheckOutDate}\nRoom Type: {RoomType}\nTotal Stay Amount: ${TotalAmount}\n\nWe look forward to welcoming you soon!\n\nWarm regards,\n{HotelName} Front Desk Team\nPhone: {HotelPhone}\nAddress: {HotelAddress}"
  },
  preArrival: {
    enabled: true,
    leadDays: 2,
    subject: "Pre-Arrival Information for Your Stay at {HotelName}",
    body: "Dear {GuestName},\n\nWe are excited to welcome you to {HotelName} on {CheckInDate}!\n\nStandard check-in begins at 3:00 PM. Please present a valid photo ID upon arrival.\n\nIf you have any special requests, feel free to reply to this email or call us at {HotelPhone}.\n\nSafe travels,\n{HotelName} Management"
  },
  checkOut: {
    enabled: true,
    attachFolio: true,
    subject: "Thank You for Staying with Us - {HotelName}",
    body: "Dear {GuestName},\n\nThank you for spending your stay with us at {HotelName}! We hope you had a comfortable experience.\n\nYour final folio receipt is attached for your records. We would deeply appreciate your feedback:\nReview us on TripAdvisor / Google: https://g.page/review/bestvalueinn\n\nWe hope to see you again soon!\n\nBest regards,\n{HotelName}"
  },
  cancellation: {
    enabled: true,
    subject: "Reservation Cancellation Notice - {HotelName} (Res #{BookingID})",
    body: "Dear {GuestName},\n\nThis email confirms that your reservation #{BookingID} at {HotelName} for check-in on {CheckInDate} has been cancelled.\n\nIf you have any questions regarding your refund status or wish to rebook, please contact our team at {HotelPhone}.\n\nSincerely,\n{HotelName} Team"
  }
};

export const DEFAULT_HOTELIER_NOTIFICATIONS = {
  staffEmails: "frontdesk@bestvalueinn.com, manager@bestvalueinn.com",
  alertNewDirectBooking: true,
  alertNewOtaBooking: true,
  alertCancellation: true,
  alertNoShow: true,
  dailyNightAuditReport: {
    enabled: true,
    sendTime: "06:00"
  },
  lowInventoryAlert: {
    enabled: true,
    threshold: 2
  }
};

export function getEmailConfig() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_EMAIL_CONFIG);
    if (saved) return { ...DEFAULT_EMAIL_CONFIG, ...JSON.parse(saved) };
  } catch (e) {}
  return DEFAULT_EMAIL_CONFIG;
}

export function saveEmailConfig(config) {
  try {
    const data = { ...DEFAULT_EMAIL_CONFIG, ...config };
    dataStore.setItem(STORAGE_KEY_EMAIL_CONFIG, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_email_config_updated", { detail: data }));
    }
    logSystemAuditAction({
      module: "Property Setup",
      action: "Email Config Updated",
      details: `Updated SMTP email gateway settings for From Address: ${data.fromEmail}.`
    });
    return data;
  } catch (e) {
    console.error("Error saving email config:", e);
    return DEFAULT_EMAIL_CONFIG;
  }
}

export function getGuestNotifications() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_GUEST_NOTIFICATIONS);
    if (saved) return { ...DEFAULT_GUEST_NOTIFICATIONS, ...JSON.parse(saved) };
  } catch (e) {}
  return DEFAULT_GUEST_NOTIFICATIONS;
}

export function saveGuestNotifications(config) {
  try {
    const data = { ...DEFAULT_GUEST_NOTIFICATIONS, ...config };
    dataStore.setItem(STORAGE_KEY_GUEST_NOTIFICATIONS, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_guest_notifications_updated", { detail: data }));
    }
    logSystemAuditAction({
      module: "Property Setup",
      action: "Guest Notifications Updated",
      details: "Updated automated guest email notification templates and triggers."
    });
    return data;
  } catch (e) {
    console.error("Error saving guest notifications:", e);
    return DEFAULT_GUEST_NOTIFICATIONS;
  }
}

export function getHotelierNotifications() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_HOTELIER_NOTIFICATIONS);
    if (saved) return { ...DEFAULT_HOTELIER_NOTIFICATIONS, ...JSON.parse(saved) };
  } catch (e) {}
  return DEFAULT_HOTELIER_NOTIFICATIONS;
}

export function saveHotelierNotifications(config) {
  try {
    const data = { ...DEFAULT_HOTELIER_NOTIFICATIONS, ...config };
    dataStore.setItem(STORAGE_KEY_HOTELIER_NOTIFICATIONS, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_hotelier_notifications_updated", { detail: data }));
    }
    logSystemAuditAction({
      module: "Property Setup",
      action: "Hotelier Notifications Updated",
      details: "Updated staff alert settings, night audit summary schedule, and low inventory thresholds."
    });
    return data;
  } catch (e) {
    console.error("Error saving hotelier notifications:", e);
    return DEFAULT_HOTELIER_NOTIFICATIONS;
  }
}
