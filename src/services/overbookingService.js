/**
 * Overbooking Calculation & Management Service
 */

/**
 * Normalizes category names for consistent comparison
 */
export function normalizeCategoryName(name) {
  if (!name) return "";
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

/**
 * Helper to test if a booking is an unconfirmed enquiry/hold
 */
export function isUnconfirmedEnquiry(b) {
  if (!b) return false;
  if (b.isEnquiry) return true;
  const st = String(b.status || "").toLowerCase().trim();
  return (
    st === "enquiry" ||
    st === "inquiry" ||
    st === "enquiry (hold)" ||
    st === "enquiry_hold" ||
    st === "group enquiry" ||
    st === "group_enquiry"
  );
}

/**
 * Helper to test if a booking consumes physical inventory
 */
export function isInventoryConsumingBooking(b) {
  if (!b || b.isDeleted || b.folioDeleted) return false;
  const st = String(b.status || "").toLowerCase().trim();
  if (st === "cancelled" || st === "cancelled_by_guest" || st === "deleted" || st === "no-show" || st === "noshow" || st === "no_show") return false;
  if (isUnconfirmedEnquiry(b)) return false;
  return true;
}

/**
 * Intelligent helper to determine if a booking belongs to a given category
 */
export function isBookingForCategory(b, categoryType, physicalRoomsInCat = [], allCategoriesInProperty = []) {
  if (!isInventoryConsumingBooking(b)) return false;

  const catKey = normalizeCategoryName(categoryType);
  const validRoomNumbers = new Set((physicalRoomsInCat || []).map((r) => String(r.no || r.number || "").trim()));
  const bRoomNo = String(b.room || b.roomNo || b.roomNumber || "").trim();

  // 1. If assigned to a physical room number in this category
  if (bRoomNo && !bRoomNo.toLowerCase().includes("unassigned") && validRoomNumbers.has(bRoomNo)) {
    return true;
  }

  // 2. Category string check for unassigned or general bookings
  const bCatKey = normalizeCategoryName(b.roomType || b.category || b.type || "");

  // Direct exact or substring match
  if (bCatKey && (bCatKey === catKey || bCatKey.includes(catKey) || catKey.includes(bCatKey))) {
    return true;
  }

  // Keyword overlap match (e.g. "deluxe", "king", "double", "suite", "standard", "room", "bed")
  if (bCatKey) {
    const keywords1 = bCatKey.match(/[a-z]+/g) || [];
    const keywords2 = catKey.match(/[a-z]+/g) || [];
    const commonKeywords = keywords1.filter((k) => k.length > 2 && keywords2.includes(k));
    if (commonKeywords.length > 0) {
      return true;
    }
  }

  // 3. Fallback for unassigned bookings: If b.roomType doesn't match any OTHER category in property,
  // count it towards this category if it is unassigned
  if (!bRoomNo || bRoomNo.toLowerCase().includes("unassigned") || bRoomNo.toLowerCase() === "pending") {
    const matchesOtherCat = (allCategoriesInProperty || []).some((otherCat) => {
      if (otherCat === categoryType) return false;
      const oKey = normalizeCategoryName(otherCat);
      return bCatKey === oKey || (bCatKey && (bCatKey.includes(oKey) || oKey.includes(bCatKey)));
    });

    if (!matchesOtherCat) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates net available physical rooms for a given category on a specific date.
 * Returns negative numbers (e.g. -1, -2) when overbooked instead of flooring at 0.
 *
 * @param {string} categoryType - Room category name (e.g. "King Large Double Bed", "Deluxe Room")
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {Array} bookingsList - List of all bookings
 * @param {Array} roomsList - List of all physical rooms
 * @returns {number} Net available count (e.g. 7, 0, -1, -2)
 */
export function calculateCategoryAvailability(categoryType, dateStr, bookingsList = [], roomsList = []) {
  if (!categoryType || !dateStr) return 0;

  const catKey = normalizeCategoryName(categoryType);

  // 1. Get total physical rooms belonging to this category
  const physicalRoomsInCat = (roomsList || []).filter((r) => {
    const rType = normalizeCategoryName(r.type || r.category || "Standard");
    return rType === catKey || rType.includes(catKey) || catKey.includes(rType);
  });

  const totalPhysicalCount = physicalRoomsInCat.length;
  const allCategoriesInProperty = Array.from(new Set((roomsList || []).map((r) => r.type || r.category || "Standard")));

  // 2. Count active bookings for this category on dateStr
  const activeBookingsOnDate = (bookingsList || []).filter((b) => {
    if (!isInventoryConsumingBooking(b)) return false;

    // Date overlap check: b.checkIn <= dateStr < b.checkOut
    if (b.checkIn > dateStr || b.checkOut <= dateStr) return false;

    return isBookingForCategory(b, categoryType, physicalRoomsInCat, allCategoriesInProperty);
  });

  const totalSold = activeBookingsOnDate.length;

  // Inventory count can be negative (e.g. 8 rooms - 9 sold = -1)
  return totalPhysicalCount - totalSold;
}

/**
 * Returns list of all overbooked or conflicted reservations.
 * An overbooking occurs when:
 * 1. A booking has room = "Unassigned" (or no room) AND total bookings in that category exceed physical room capacity.
 * 2. Two or more active bookings are assigned to the exact same physical room for overlapping stay dates.
 *
 * @param {Array} bookingsList - List of all bookings
 * @param {Array} roomsList - List of all physical rooms
 * @returns {Array} Array of overbooked reservation objects
 */
export function getOverbookedReservations(bookingsList = [], roomsList = []) {
  if (!Array.isArray(bookingsList)) return [];

  const activeBookings = bookingsList.filter(isInventoryConsumingBooking);

  const overbookedMap = new Map();

  // Check 1: Unassigned bookings where requested category has <= 0 net inventory on any stay date
  activeBookings.forEach((b) => {
    const rNo = String(b.room || b.roomNo || b.roomNumber || "").trim();
    const isUnassigned = !rNo || rNo.toLowerCase().includes("unassigned") || rNo.toLowerCase() === "pending";

    if (isUnassigned || b.isOverbooking) {
      const catType = b.roomType || b.category || "King Large Double Bed";

      // Check each stay date
      let isOverbookedOnAnyDate = false;
      const start = new Date(b.checkIn + "T00:00:00");
      const end = new Date(b.checkOut + "T00:00:00");

      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split("T")[0];
        const netAvail = calculateCategoryAvailability(catType, dStr, bookingsList, roomsList);
        if (netAvail < 0 || isUnassigned) {
          isOverbookedOnAnyDate = true;
          break;
        }
      }

      if (isOverbookedOnAnyDate) {
        overbookedMap.set(String(b.id || b.referenceCode || b.otaReference), {
          ...b,
          overbookingReason: isUnassigned
            ? "Unassigned OTA booking exceeding physical room inventory"
            : "No vacant rooms available for stay dates",
        });
      }
    }
  });

  // Check 2: Double-booking assignment conflicts
  for (let i = 0; i < activeBookings.length; i++) {
    for (let j = i + 1; j < activeBookings.length; j++) {
      const b1 = activeBookings[i];
      const b2 = activeBookings[j];

      const r1 = String(b1.room || b1.roomNo || "").trim();
      const r2 = String(b2.room || b2.roomNo || "").trim();

      if (r1 && r2 && r1 === r2 && !r1.toLowerCase().includes("unassigned")) {
        if (b1.checkIn < b2.checkOut && b1.checkOut > b2.checkIn) {
          overbookedMap.set(String(b1.id || b1.referenceCode), {
            ...b1,
            overbookingReason: `Double assignment conflict on Room ${r1} with ${b2.guest || b2.guestName || "another booking"}`,
          });
          overbookedMap.set(String(b2.id || b2.referenceCode), {
            ...b2,
            overbookingReason: `Double assignment conflict on Room ${r2} with ${b1.guest || b1.guestName || "another booking"}`,
          });
        }
      }
    }
  }

  return Array.from(overbookedMap.values());
}
