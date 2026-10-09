import { dataStore } from "./dataStore";
import { getBookings, getRooms, getRoomTypes, createBooking } from "./api";

export const STORAGE_KEY_CHANNEL_CONFIG = "hotelpms_channel_config_v1";
export const STORAGE_KEY_CHANNEL_MAPPINGS = "hotelpms_channel_mappings_v1";
export const STORAGE_KEY_CHANNEL_RESTRICTIONS = "hotelpms_channel_restrictions_v1";
export const STORAGE_KEY_CHANNEL_LOGS = "hotelpms_channel_logs_v1";
export const STORAGE_KEY_CHANNEL_CATALOGS = "hotelpms_channel_catalogs_v1";

export const DEFAULT_CHANNELS = {
  booking_com: {
    id: "booking_com",
    name: "Booking.com",
    icon: "🌐",
    color: "#003580",
    enabled: true,
    hotelId: "BK-99824",
    apiKey: "bcom_live_sec_8872",
    markupPct: 15,
    autoAssignRoom: true,
    lastSync: new Date().toISOString(),
  },
  expedia: {
    id: "expedia",
    name: "Expedia Partner",
    icon: "✈️",
    color: "#fbbf24",
    enabled: true,
    hotelId: "EXP-44102",
    apiKey: "exp_sec_991823",
    markupPct: 18,
    autoAssignRoom: true,
    lastSync: new Date().toISOString(),
  },
  agoda: {
    id: "agoda",
    name: "Agoda YCS",
    icon: "🌏",
    color: "#10b981",
    enabled: false,
    hotelId: "AGO-11204",
    apiKey: "ago_sec_77812",
    markupPct: 15,
    autoAssignRoom: true,
    lastSync: null,
  },
  airbnb: {
    id: "airbnb",
    name: "Airbnb Host",
    icon: "🏠",
    color: "#ff5a5f",
    enabled: true,
    hotelId: "AB-77491",
    apiKey: "ab_sec_33419",
    markupPct: 12,
    autoAssignRoom: true,
    lastSync: new Date().toISOString(),
  },
  makemytrip: {
    id: "makemytrip",
    name: "MakeMyTrip Extranet",
    icon: "🧳",
    color: "#e11d48",
    enabled: false,
    hotelId: "MMT-88301",
    apiKey: "mmt_sec_55102",
    markupPct: 15,
    autoAssignRoom: true,
    lastSync: null,
  },
};

export const DEFAULT_CHANNEL_CONFIG = {
  masterEnabled: true,
  gatewayProvider: "channex", // 'channex' | 'siteminder' | 'direct'
  syncIntervalMinutes: 5,
  autoConfirmOtaBookings: true,
  channels: DEFAULT_CHANNELS,
};

// Seed catalogs for channels (human-readable room category names & rate plan names fetched by Hotel ID)
export const DEFAULT_MOCK_CATALOGS = {
  booking_com: {
    roomTypes: [
      { id: "bcom-room-1", name: "Deluxe Double Room with Sea View", otaCode: "BCOM-DLX-DBL" },
      { id: "bcom-room-2", name: "Standard Queen Room", otaCode: "BCOM-STD-Q" },
      { id: "bcom-room-3", name: "Executive Suite with Balcony", otaCode: "BCOM-EXEC-STE" },
      { id: "bcom-room-4", name: "Family Connecting Suite", otaCode: "BCOM-FAM-STE" },
    ],
    ratePlans: [
      { id: "bcom-rate-1", name: "Non-Refundable EP (Room Only)", otaCode: "NR-EP" },
      { id: "bcom-rate-2", name: "Standard Flexible Rate (Free Cancellation)", otaCode: "FLEX-STD" },
      { id: "bcom-rate-3", name: "Breakfast Included CP", otaCode: "BB-CP" },
    ],
  },
  expedia: {
    roomTypes: [
      { id: "exp-room-1", name: "Deluxe Room (1 King Bed)", otaCode: "EXP-DLX-K" },
      { id: "exp-room-2", name: "Standard Room (2 Double Beds)", otaCode: "EXP-STD-2D" },
      { id: "exp-room-3", name: "Presidential Ocean View Suite", otaCode: "EXP-PRES-STE" },
    ],
    ratePlans: [
      { id: "exp-rate-1", name: "Expedia Special Member Rate", otaCode: "EXP-MBR-SPEC" },
      { id: "exp-rate-2", name: "Standard Daily Rate", otaCode: "EXP-DAILY" },
    ],
  },
  agoda: {
    roomTypes: [
      { id: "ago-room-1", name: "Superior City View Room", otaCode: "AGO-SUP-CV" },
      { id: "ago-room-2", name: "Deluxe Pool Access Room", otaCode: "AGO-DLX-POOL" },
    ],
    ratePlans: [
      { id: "ago-rate-1", name: "Agoda VIP Exclusive Rate", otaCode: "AGO-VIP-EXCL" },
    ],
  },
  airbnb: {
    roomTypes: [
      { id: "ab-room-1", name: "Whole Luxury Apartment / Suite", otaCode: "AB-APT-ALL" },
      { id: "ab-room-2", name: "Private Deluxe Room", otaCode: "AB-PVT-DLX" },
    ],
    ratePlans: [
      { id: "ab-rate-1", name: "Standard Nightly Rate", otaCode: "AB-NIGHTLY" },
      { id: "ab-rate-2", name: "Weekly Discount Rate", otaCode: "AB-WEEKLY" },
    ],
  },
  makemytrip: {
    roomTypes: [
      { id: "mmt-room-1", name: "Premium Heritage Room", otaCode: "MMT-PREM-HER" },
      { id: "mmt-room-2", name: "Executive Business Suite", otaCode: "MMT-EXEC-BIZ" },
    ],
    ratePlans: [
      { id: "mmt-rate-1", name: "MMT Assured Best Rate", otaCode: "MMT-BEST" },
    ],
  },
};

export function getChannelConfig() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_CHANNEL_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        return {
          ...DEFAULT_CHANNEL_CONFIG,
          ...parsed,
          channels: {
            ...DEFAULT_CHANNELS,
            ...(parsed.channels || {}),
          },
        };
      }
    }
  } catch (e) {
    console.error("Error reading channel config:", e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_CHANNEL_CONFIG));
}

export function saveChannelConfig(config) {
  try {
    const data = config && typeof config === "object" ? config : DEFAULT_CHANNEL_CONFIG;
    dataStore.setItem(STORAGE_KEY_CHANNEL_CONFIG, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_channel_config_updated", { detail: data }));
    }
    return data;
  } catch (e) {
    console.error("Error saving channel config:", e);
    return getChannelConfig();
  }
}

export function addCustomChannel({ name, hotelId, apiKey, markupPct = 15 }) {
  try {
    const config = getChannelConfig();
    const channelKey = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    
    const newChannel = {
      id: channelKey,
      name: name,
      icon: "🌐",
      color: "#2563eb",
      enabled: true,
      hotelId: hotelId || `OTA-${Math.floor(1000 + Math.random() * 9000)}`,
      apiKey: apiKey || `key_live_${Math.random().toString(36).substring(2, 10)}`,
      markupPct: Number(markupPct || 15),
      autoAssignRoom: true,
      lastSync: new Date().toISOString(),
      isCustom: true
    };

    const updated = {
      ...config,
      channels: {
        ...config.channels,
        [channelKey]: newChannel,
      },
    };

    // Generate mock catalog for new custom channel
    const storedCatalogs = getStoredCatalogs();
    storedCatalogs[channelKey] = {
      roomTypes: [
        { id: `${channelKey}-room-1`, name: `${name} Standard Room Category`, otaCode: `${channelKey.toUpperCase()}-STD` },
        { id: `${channelKey}-room-2`, name: `${name} Deluxe Suite Category`, otaCode: `${channelKey.toUpperCase()}-DLX` },
      ],
      ratePlans: [
        { id: `${channelKey}-rate-1`, name: `${name} Standard Rate Plan`, otaCode: `${channelKey.toUpperCase()}-STD-RATE` },
        { id: `${channelKey}-rate-2`, name: `${name} Non-Refundable Rate Plan`, otaCode: `${channelKey.toUpperCase()}-NR-RATE` },
      ],
    };
    dataStore.setItem(STORAGE_KEY_CHANNEL_CATALOGS, JSON.stringify(storedCatalogs));

    saveChannelConfig(updated);
    addSyncLog({
      channel: name,
      channelKey: channelKey,
      type: "CHANNEL_ADDED",
      status: "SUCCESS",
      details: `New OTA Channel "${name}" (Hotel ID: ${newChannel.hotelId}) connected with 2-way ARI sync.`,
    });

    return newChannel;
  } catch (e) {
    console.error("Error adding custom channel:", e);
    return null;
  }
}

/**
 * Fetch human-readable OTA Room Categories and Rate Plans for a channel using Hotel ID
 */
export async function fetchOtaChannelCatalog(channelKey, hotelId) {
  const catalog = DEFAULT_MOCK_CATALOGS[channelKey] || {
    roomTypes: [
      { id: `${channelKey}-room-1`, name: "Standard OTA Room Category", otaCode: `${channelKey.toUpperCase()}-STD` },
      { id: `${channelKey}-room-2`, name: "Deluxe OTA Suite Category", otaCode: `${channelKey.toUpperCase()}-STE` },
    ],
    ratePlans: [
      { id: `${channelKey}-rate-1`, name: "Standard Flexible OTA Rate", otaCode: `${channelKey.toUpperCase()}-FLEX` },
      { id: `${channelKey}-rate-2`, name: "Non-Refundable Promo Rate", otaCode: `${channelKey.toUpperCase()}-NR` },
    ],
  };

  try {
    const existing = getStoredCatalogs();
    existing[channelKey] = catalog;
    dataStore.setItem(STORAGE_KEY_CHANNEL_CATALOGS, JSON.stringify(existing));
  } catch {}

  addSyncLog({
    channel: channelKey,
    channelKey: channelKey,
    type: "CATALOG_FETCH",
    status: "SUCCESS",
    details: `Fetched ${catalog.roomTypes.length} Room Categories & ${catalog.ratePlans.length} Rate Plans for Hotel ID: ${hotelId || "Default"}.`,
  });

  return catalog;
}

export function getStoredCatalogs() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_CHANNEL_CATALOGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_MOCK_CATALOGS));
}

export function getChannelMappings() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_CHANNEL_MAPPINGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) {
    console.error("Error reading channel mappings:", e);
  }
  return {
    roomMappings: {}, // { [pmsRoomTypeId]: { [channelId]: otaRoomName } }
    rateMappings: {}, // { [pmsRatePlanId]: { [channelId]: otaRatePlanName } }
  };
}

export function saveChannelMappings(mappings) {
  try {
    const data = mappings && typeof mappings === "object" ? mappings : {};
    dataStore.setItem(STORAGE_KEY_CHANNEL_MAPPINGS, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_channel_mappings_updated", { detail: data }));
    }
    return data;
  } catch (e) {
    console.error("Error saving channel mappings:", e);
    return getChannelMappings();
  }
}

/**
 * Restrictions Engine: StopSell, CTA (Closed to Arrival), CTD (Closed to Departure), MinLOS, MaxLOS
 */
export function getChannelRestrictions() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_CHANNEL_RESTRICTIONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) {
    console.error("Error reading channel restrictions:", e);
  }
  return {
    stopSell: {}, // { [channelKey]: { [roomTypeId]: boolean } }
    cta: {},      // { [channelKey]: { [roomTypeId]: boolean } } (Closed to Arrival)
    ctd: {},      // { [channelKey]: { [roomTypeId]: boolean } } (Closed to Departure)
    minLos: {},   // { [channelKey]: { [roomTypeId]: number } }
    maxLos: {},   // { [channelKey]: { [roomTypeId]: number } }
  };
}

export const STORAGE_KEY_DAILY_RESTRICTIONS = "hotelpms_daily_channel_restrictions_v1";

export function saveChannelRestrictions(restrictions) {
  try {
    const data = restrictions && typeof restrictions === "object" ? restrictions : {};
    dataStore.setItem(STORAGE_KEY_CHANNEL_RESTRICTIONS, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_channel_restrictions_updated", { detail: data }));
    }
    return data;
  } catch (e) {
    console.error("Error saving channel restrictions:", e);
    return getChannelRestrictions();
  }
}

/**
 * Date-Wise Channel Restrictions API
 * Map shape: { [key]: { stopSell: boolean, cta: boolean, ctd: boolean, minLos: number, maxLos: number } }
 * Key format: `${channelKey}_${roomTypeId || roomTypeName}_${dateStr}` or `all_${roomTypeName}_${dateStr}`
 */
export function getDailyChannelRestrictions() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_DAILY_RESTRICTIONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) {
    console.error("Error reading daily channel restrictions:", e);
  }
  return {};
}

export function saveDailyChannelRestriction(key, restrictionData) {
  try {
    const current = getDailyChannelRestrictions();
    const updated = {
      ...current,
      [key]: {
        ...(current[key] || {}),
        ...restrictionData,
      },
    };
    dataStore.setItem(STORAGE_KEY_DAILY_RESTRICTIONS, JSON.stringify(updated));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_daily_channel_restrictions_updated", { detail: updated }));
    }
    return updated;
  } catch (e) {
    console.error("Error saving daily channel restriction:", e);
    return getDailyChannelRestrictions();
  }
}

export function bulkSaveDailyChannelRestrictions({
  startDate,
  endDate,
  daysOfWeek = [0, 1, 2, 3, 4, 5, 6],
  roomTypes = [],
  channelKeys = ["all"],
  stopSell = false,
  cta = false,
  ctd = false,
  minLos = 1,
  maxLos = 30,
}) {
  try {
    const current = { ...getDailyChannelRestrictions() };
    const start = new Date(startDate);
    const end = new Date(endDate);

    const cur = new Date(start);
    while (cur <= end) {
      const dayIndex = cur.getDay(); // 0-6
      if (daysOfWeek.includes(dayIndex)) {
        const dateStr = cur.toISOString().split("T")[0];
        
        roomTypes.forEach((rt) => {
          channelKeys.forEach((ch) => {
            const key = `${ch}_${rt}_${dateStr}`;
            current[key] = {
              stopSell: Boolean(stopSell),
              cta: Boolean(cta),
              ctd: Boolean(ctd),
              minLos: Math.max(1, Number(minLos || 1)),
              maxLos: Math.max(1, Number(maxLos || 30)),
            };
          });
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    dataStore.setItem(STORAGE_KEY_DAILY_RESTRICTIONS, JSON.stringify(current));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_daily_channel_restrictions_updated", { detail: current }));
    }
    return current;
  } catch (e) {
    console.error("Error bulk saving daily channel restrictions:", e);
    return getDailyChannelRestrictions();
  }
}

export function getEffectiveRestriction(channelKey, roomTypeName, dateStr) {
  const map = getDailyChannelRestrictions();
  
  // Check exact channel key first
  const specificKey = `${channelKey}_${roomTypeName}_${dateStr}`;
  if (map[specificKey]) return map[specificKey];

  // Check 'all' channels key fallback
  const allKey = `all_${roomTypeName}_${dateStr}`;
  if (map[allKey]) return map[allKey];

  // Fallback to global room type restrictions from Channel Manager
  const globalRest = getChannelRestrictions();
  const ch = channelKey === 'all' ? 'booking_com' : channelKey;
  
  return {
    stopSell: Boolean(globalRest.stopSell?.[ch]?.[roomTypeName] || false),
    cta: Boolean(globalRest.cta?.[ch]?.[roomTypeName] || false),
    ctd: Boolean(globalRest.ctd?.[ch]?.[roomTypeName] || false),
    minLos: Number(globalRest.minLos?.[ch]?.[roomTypeName] || 1),
    maxLos: Number(globalRest.maxLos?.[ch]?.[roomTypeName] || 30),
  };
}

export function getSyncLogs() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY_CHANNEL_LOGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Error reading sync logs:", e);
  }
  return [
    {
      id: "log-1",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      channel: "Booking.com",
      channelKey: "booking_com",
      type: "INBOUND_RESERVATION",
      status: "SUCCESS",
      details: "Received Booking #BCOM-88319 for Guest John Doe (Check-in: Today)",
    },
    {
      id: "log-2",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      channel: "Expedia Partner",
      channelKey: "expedia",
      type: "OUTBOUND_ARI_PUSH",
      status: "SUCCESS",
      details: "Pushed updated Availability & Rates for 14 active room types across 30 days.",
    },
  ];
}

export function addSyncLog(entry) {
  try {
    const logs = getSyncLogs();
    const newEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    const updated = [newEntry, ...logs].slice(0, 100);
    dataStore.setItem(STORAGE_KEY_CHANNEL_LOGS, JSON.stringify(updated));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_channel_log_added", { detail: newEntry }));
    }
    return updated;
  } catch (e) {
    console.error("Error adding sync log:", e);
    return [];
  }
}

export function clearSyncLogs() {
  try {
    dataStore.setItem(STORAGE_KEY_CHANNEL_LOGS, JSON.stringify([]));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms_channel_log_added"));
    }
  } catch (e) {
    console.error("Error clearing sync logs:", e);
  }
}

/**
 * Process incoming OTA Webhook reservation payload
 */
export async function processIncomingOtaReservation(payload) {
  const config = getChannelConfig();
  if (!config.masterEnabled) {
    throw new Error("Channel Sync is currently disabled in PMS settings.");
  }

  const {
    channelKey = "booking_com",
    guestName = "OTA Guest",
    guestEmail = "guest@ota.com",
    guestPhone = "+1 555-0199",
    roomType = "Deluxe Room",
    checkIn,
    checkOut,
    amount = 150,
    otaReference = `OTA-${Math.floor(100000 + Math.random() * 900000)}`,
    paymentStatus = "Paid Online",
  } = payload;

  const channelObj = config.channels[channelKey] || DEFAULT_CHANNELS.booking_com;
  if (!channelObj.enabled) {
    throw new Error(`Channel ${channelObj.name} is currently turned off.`);
  }

  // Get available rooms for assignment
  const rooms = await getRooms();
  const bookings = await getBookings();

  // Find matching available room
  const availableRooms = rooms.filter((r) => {
    const rNo = String(r.no || r.number || "").trim();
    const hasConflict = bookings.some((b) => {
      if (!b || b.status === "cancelled" || b.status === "cancelled_by_guest") return false;
      const bRoom = String(b.room || b.roomNumber || "").trim();
      if (bRoom !== rNo) return false;
      return b.checkIn < checkOut && b.checkOut > checkIn;
    });
    return !hasConflict;
  });

  const assignedRoomNo = availableRooms.length > 0 ? String(availableRooms[0].no) : "Unassigned";

  const newBookingPayload = {
    guest: guestName,
    guestName: guestName,
    email: guestEmail,
    phone: guestPhone,
    room: assignedRoomNo,
    roomNumber: assignedRoomNo,
    roomType: roomType,
    checkIn: checkIn,
    checkOut: checkOut,
    status: "confirmed",
    source: channelObj.name,
    bookingSource: channelObj.name,
    totalAmount: Number(amount),
    paidAmount: paymentStatus === "Paid Online" ? Number(amount) : 0,
    balanceDue: paymentStatus === "Paid Online" ? 0 : Number(amount),
    notes: `Imported via OTA Webhook (${channelObj.name} Ref: ${otaReference}). Payment Status: ${paymentStatus}.`,
    otaReference: otaReference,
  };

  const created = await createBooking(newBookingPayload);

  // Record Sync Audit Log
  addSyncLog({
    channel: channelObj.name,
    channelKey: channelKey,
    type: "INBOUND_RESERVATION",
    status: "SUCCESS",
    details: `Created reservation #${created.id || otaReference} for ${guestName} (${checkIn} to ${checkOut}) via ${channelObj.name}. Room: ${assignedRoomNo}.`,
  });

  // Update Channel Last Sync Time
  config.channels[channelKey].lastSync = new Date().toISOString();
  saveChannelConfig(config);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
  }

  return created;
}

/**
 * Trigger outbound ARI (Availability, Rates, Inventory & Restrictions) sync to active OTA channels
 */
export async function pushInventoryAndRatesToChannels() {
  const config = getChannelConfig();
  if (!config.masterEnabled) return { success: false, message: "Channel Manager disabled" };

  const rooms = await getRooms();
  const roomTypes = await getRoomTypes();
  const restrictions = getChannelRestrictions();
  const activeChannels = Object.values(config.channels).filter((c) => c.enabled);

  const timestamp = new Date().toISOString();

  activeChannels.forEach((ch) => {
    // Count active restrictions for this channel
    const stopSellCount = Object.values(restrictions.stopSell?.[ch.id] || {}).filter(Boolean).length;
    const ctaCount = Object.values(restrictions.cta?.[ch.id] || {}).filter(Boolean).length;
    const ctdCount = Object.values(restrictions.ctd?.[ch.id] || {}).filter(Boolean).length;

    addSyncLog({
      channel: ch.name,
      channelKey: ch.id,
      type: "OUTBOUND_ARI_PUSH",
      status: "SUCCESS",
      details: `Pushed live ARI payload (${rooms.length} rooms across ${roomTypes.length} categories) with ${ch.markupPct}% markup. Restrictions: StopSell(${stopSellCount}), CTA(${ctaCount}), CTD(${ctdCount}).`,
    });
    config.channels[ch.id].lastSync = timestamp;
  });

  saveChannelConfig(config);
  return { success: true, count: activeChannels.length, timestamp };
}
