import { dataStore } from "./dataStore";
/**
 * REPORT ANALYTICS SERVICE
 * Helper service to compute Today, MTD, YTD, YoY (SPLY), Forecast, Channel Production, AR Aging, and Payment Audits.
 * 
 * @see PMS_BUSINESS_LOGIC_AND_TROUBLESHOOTING_GUIDE.md for master accounting & inventory logic definitions.
 */

import { getCompanyAccounts } from "./companyAccounts";
import { getPaymentGatewayConfig } from "./paymentGatewayService";
import { getRoomsList, getRoomTypes, getRatePlans, getDailyRatesMap, getSellableRooms, isSellableRoom } from "./hotelConfig";

function formatLocalDateISO(d) {
  if (!d || isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Helper to get all bookings from the data store
function getAllBookings() {
  let list = [];
  try {
    const raw = dataStore.getItem("hotelpms_bookings_v3") || dataStore.getItem("hotelpms_bookings_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
    }
  } catch (e) {}


  return (list || []).filter(
    (b) =>
      b &&
      !b.folioDeleted &&
      !b.isDeleted &&
      !b.folioCleared &&
      b.status !== "Deleted" &&
      b.status !== "deleted"
  );
}

function getDailySalesList() {
  if (typeof dataStore === "undefined") return [];
  try {
    const saved = dataStore.getItem("pms_daily_sales");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function getDailyExpensesList() {
  if (typeof dataStore === "undefined") return [];
  try {
    const saved = dataStore.getItem("pms_daily_expenses");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function getMiscTransactionsList() {
  if (typeof dataStore === "undefined") return [];
  try {
    const saved = dataStore.getItem("pms_misc_transactions");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

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
    st === "group_enquiry" ||
    st === "held" ||
    st === "hold" ||
    st === "on hold" ||
    st === "on_hold"
  );
}

export function isInventoryConsumingBooking(b) {
  if (!b || b.isDeleted || b.folioDeleted) return false;
  const st = String(b.status || "").toLowerCase().trim();
  if (st === "cancelled" || st === "cancelled_by_guest" || st === "deleted" || st === "no-show" || st === "noshow" || st === "no_show") return false;
  if (isUnconfirmedEnquiry(b)) return false;
  return true;
}

/**
 * 1. Executive YoY & MTD/YTD Report Data
 */
export function getExecutiveYoYReportData(refDateStr = formatLocalDateISO(new Date())) {
  const bookings = getAllBookings();
  const sellableRooms = getSellableRooms();
  const totalRooms = sellableRooms.length > 0 ? sellableRooms.length : (getRoomsList().length || 1);


// Helper to calculate extras total from booking
function getBookingExtrasTotal(b) {
  if (Array.isArray(b.extras) && b.extras.length > 0) {
    return b.extras.reduce((sum, e) => {
      if (e && !e.isDiscount) {
        return sum + Number(e.amount || e.price || e.amountUSD || 0);
      }
      return sum;
    }, 0);
  }
  if (typeof b.extras === "number" && !isNaN(b.extras)) {
    return b.extras;
  }
  if (b.extraCharges !== undefined && !isNaN(Number(b.extraCharges))) {
    return Number(b.extraCharges);
  }
  if (b.addonTotal !== undefined && !isNaN(Number(b.addonTotal))) {
    return Number(b.addonTotal);
  }
  if (b.foodExtras !== undefined || b.miscExtras !== undefined) {
    return Number(b.foodExtras || 0) + Number(b.miscExtras || 0);
  }
  return 0;
}

// Helper to calculate room tariff revenue (without tax and extras)
function getBookingRoomRevenue(b, extrasTotal) {
  if (b.subtotal !== undefined && !isNaN(Number(b.subtotal)) && Number(b.subtotal) > 0) {
    return Number(b.subtotal);
  }
  if (b.roomRevenue !== undefined && !isNaN(Number(b.roomRevenue)) && Number(b.roomRevenue) > 0) {
    return Number(b.roomRevenue);
  }
  if (b.ratePerNight !== undefined && !isNaN(Number(b.ratePerNight)) && Number(b.ratePerNight) > 0) {
    return Number(b.ratePerNight) * Number(b.nights || 1);
  }
  if (b.rate !== undefined && !isNaN(Number(b.rate)) && Number(b.rate) > 0) {
    return Number(b.rate) * Number(b.nights || 1);
  }
  if (b.amount !== undefined && !isNaN(Number(b.amount)) && Number(b.amount) > 0) {
    return Number(b.amount);
  }
  if (b.totalAmount !== undefined && !isNaN(Number(b.totalAmount)) && Number(b.totalAmount) > 0) {
    const tot = Number(b.totalAmount);
    if (b.taxAmount !== undefined && !isNaN(Number(b.taxAmount))) {
      return Math.max(0, tot - Number(b.taxAmount) - extrasTotal);
    }
    return Math.max(0, tot - extrasTotal);
  }
  return 0;
}

// Helper to calculate taxes collected
function getBookingTaxes(b, roomRev, extrasTotal) {
  if (b.taxAmount !== undefined && !isNaN(Number(b.taxAmount))) {
    return Number(b.taxAmount);
  }
  if (b.tax !== undefined && !isNaN(Number(b.tax))) {
    return Number(b.tax);
  }
  if (b.taxes !== undefined && !isNaN(Number(b.taxes))) {
    return Number(b.taxes);
  }
  const taxPct = b.taxPercent !== undefined && b.taxPercent !== null ? Number(b.taxPercent) : 12;
  return (roomRev + extrasTotal) * (taxPct / 100);
}

// Helper for computing metric bucket for a date range
  const computeDateRangeBucket = (startObj, endObj) => {
    let roomsSold = 0;
    let roomRevenue = 0;
    let extraRevenue = 0;
    let cancellationRevenue = 0;
    let noShowRevenue = 0;
    let taxes = 0;

    const diffTime = Math.max(0, endObj.getTime() - startObj.getTime());
    const totalDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const startStr = formatLocalDateISO(startObj);
    const endStr = formatLocalDateISO(endObj);

    // Process cancellations and no-shows once per booking if their checkIn falls in range
    bookings.forEach((b) => {
      const status = String(b.status || "").toLowerCase().trim();
      const isCancelled = status.includes("cancel");
      const isNoShow = status.includes("no-show") || status.includes("noshow") || status.includes("no show");

      const cInRaw = b.checkIn || b.startDate || "";
      const cInStr = String(cInRaw).slice(0, 10);

      if (isCancelled) {
        if (cInStr >= startStr && cInStr <= endStr) {
          const fee = Number(
            b.cancellationFee ||
            b.cancellationCharge ||
            b.penaltyAmount ||
            b.cancellationPenalty ||
            b.paidAmount ||
            b.amountPaid ||
            (b.isNonRefundable ? (b.totalAmount || b.subtotal || 0) : 0) ||
            0
          );
          cancellationRevenue += fee;
        }
        return;
      }

      if (isNoShow) {
        if (cInStr >= startStr && cInStr <= endStr) {
          const fee = Number(
            b.noShowFee ||
            b.noShowCharge ||
            b.penaltyAmount ||
            b.noShowPenalty ||
            b.paidAmount ||
            b.amountPaid ||
            b.totalAmount ||
            b.subtotal ||
            0
          );
          noShowRevenue += fee;
        }
        return;
      }
    });

    // Loop day-by-day across the date range to count active stay nights
    const curr = new Date(startObj);
    while (curr <= endObj) {
      const dStr = formatLocalDateISO(curr);

      bookings.forEach((b) => {
        const status = String(b.status || "").toLowerCase().trim();
        if (status.includes("cancel") || status.includes("no-show") || status.includes("noshow") || status.includes("delete") || isUnconfirmedEnquiry(b)) return;

        const rNo = b.room || b.roomNo || b.roomNumber;
        if (rNo && !isSellableRoom(rNo, getRoomsList(), getRoomTypes())) return;

        const cInRaw = b.checkIn || b.startDate || "";
        const cOutRaw = b.checkOut || b.endDate || "";
        const cInStr = String(cInRaw).slice(0, 10);
        const cOutStr = String(cOutRaw).slice(0, 10);

        if (!cInStr || !cOutStr) return;

        if (cInStr <= dStr && cOutStr > dStr) {
          roomsSold += 1;
          const startDate = new Date(cInStr + "T00:00:00");
          const endDate = new Date(cOutStr + "T00:00:00");
          const stayNights = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));

          const extrasTotal = getBookingExtrasTotal(b);
          const roomRevTotal = getBookingRoomRevenue(b, extrasTotal);
          const taxTotal = getBookingTaxes(b, roomRevTotal, extrasTotal);

          roomRevenue += roomRevTotal / stayNights;
          extraRevenue += extrasTotal / stayNights;
          taxes += taxTotal / stayNights;
        }
      });

      curr.setDate(curr.getDate() + 1);
    }

    let dailySalesRevenue = 0;
    let operationalExpenses = 0;

    const dailySales = getDailySalesList();
    const dailyExpenses = getDailyExpensesList();
    const miscTransactions = getMiscTransactionsList();

    dailySales.forEach((s) => {
      if (!s || s.status === "voided" || s.status === "cancelled") return;
      const dStr = String(s.date || s.createdAt || "").slice(0, 10);
      if (dStr >= startStr && dStr <= endStr) {
        const amt = Number(s.totalAmountUSD || s.totalUSD || s.amountUSD || s.totalAmount || s.amount || 0);
        dailySalesRevenue += amt;
      }
    });

    dailyExpenses.forEach((e) => {
      if (!e) return;
      const dStr = String(e.date || e.createdAt || "").slice(0, 10);
      if (dStr >= startStr && dStr <= endStr) {
        const amt = Number(e.amountUSD || e.amount || e.totalAmountUSD || 0);
        operationalExpenses += amt;
      }
    });

    miscTransactions.forEach((t) => {
      if (!t) return;
      const dStr = String(t.date || t.createdAt || "").slice(0, 10);
      if (dStr >= startStr && dStr <= endStr) {
        const amt = Number(t.amountUSD || t.amount || t.totalAmountUSD || 0);
        if (t.type === "SALE" || t.type === "sale") {
          dailySalesRevenue += amt;
        } else if (t.type === "EXPENSE" || t.type === "expense") {
          operationalExpenses += amt;
        }
      }
    });

    const totalAvailable = totalRooms * totalDays;
    const occPercent = totalAvailable > 0 ? (roomsSold / totalAvailable) * 100 : 0;
    const adr = roomsSold > 0 ? roomRevenue / roomsSold : 0;
    const revpar = totalAvailable > 0 ? roomRevenue / totalAvailable : 0;
    const grossRevenue = roomRevenue;
    const netIncome = roomRevenue + extraRevenue + dailySalesRevenue + taxes - operationalExpenses;

    return {
      availableRooms: totalAvailable,
      roomsSold,
      occPercent,
      adr,
      revpar,
      roomRevenue,
      extraRevenue,
      dailySalesRevenue,
      cancellationRevenue,
      noShowRevenue,
      operationalExpenses,
      grossRevenue,
      netIncome,
      taxes,
    };
  };

  const refDate = new Date(refDateStr + "T00:00:00");
  const currentYear = refDate.getFullYear();
  const currentMonth = refDate.getMonth();
  const lastYear = currentYear - 1;

  // 1. TODAY
  const todayStart = new Date(refDate);
  const todayEnd = new Date(refDate);

  const lastYearTodayRef = new Date(lastYear, currentMonth, refDate.getDate());
  const lastYearTodayStart = new Date(lastYearTodayRef);
  const lastYearTodayEnd = new Date(lastYearTodayRef);

  const todayCurrent = computeDateRangeBucket(todayStart, todayEnd);
  const todayLastYear = computeDateRangeBucket(lastYearTodayStart, lastYearTodayEnd);

  // 2. MTD (1st of current month to refDate)
  const mtdStart = new Date(currentYear, currentMonth, 1);
  const mtdEnd = new Date(refDate);

  const mtdLastYearStart = new Date(lastYear, currentMonth, 1);
  const mtdLastYearEnd = new Date(lastYearTodayRef);

  const mtdCurrent = computeDateRangeBucket(mtdStart, mtdEnd);
  const mtdLastYear = computeDateRangeBucket(mtdLastYearStart, mtdLastYearEnd);

  // 3. YTD (Jan 1 of current year to refDate)
  const ytdStart = new Date(currentYear, 0, 1);
  const ytdEnd = new Date(refDate);

  const ytdLastYearStart = new Date(lastYear, 0, 1);
  const ytdLastYearEnd = new Date(lastYearTodayRef);

  const ytdCurrent = computeDateRangeBucket(ytdStart, ytdEnd);
  const ytdLastYear = computeDateRangeBucket(ytdLastYearStart, ytdLastYearEnd);

  return {
    todayCurrent,
    todayLastYear,
    mtdCurrent,
    mtdLastYear,
    ytdCurrent,
    ytdLastYear,
  };
}

/**


/**
 * 3. 30/60/90-Day Occupancy & Revenue Forecast
 */
export function getOccupancyForecastData(numDays = 30) {
  const bookings = getAllBookings();
  const rooms = getRoomsList();
  const roomTypes = getRoomTypes();
  const sellableRooms = getSellableRooms(rooms, roomTypes);
  const totalRooms = sellableRooms.length > 0 ? sellableRooms.length : (rooms.length || 1);
  const forecastList = [];
  const today = new Date();

  for (let i = 0; i < numDays; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    const dStr = d.toISOString().slice(0, 10);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });

    let bookedCount = 0;
    let otbRevenue = 0;

    bookings.forEach((b) => {
      const statusLower = String(b.status || "").toLowerCase().trim();
      if (statusLower.includes("cancel") || statusLower.includes("no-show") || statusLower.includes("noshow") || statusLower.includes("no show") || isUnconfirmedEnquiry(b)) return;
      const rNo = b.room || b.roomNo || b.roomNumber;
      if (rNo && !isSellableRoom(rNo, rooms, roomTypes)) return;
      const cIn = b.checkIn || b.startDate;
      const cOut = b.checkOut || b.endDate;
      if (cIn <= dStr && cOut > dStr) {
        bookedCount++;
        otbRevenue += Number(b.totalAmount || b.subtotal || b.rate || 0);
      }
    });

    const occPercent = totalRooms > 0 ? (bookedCount / totalRooms) * 100 : 0;
    const projAdr = bookedCount > 0 ? otbRevenue / bookedCount : 0;
    const availableRooms = Math.max(0, totalRooms - bookedCount);

    forecastList.push({
      date: dStr,
      dayName,
      available: availableRooms,
      booked: bookedCount,
      totalRooms,
      occPercent,
      otbRevenue,
      projAdr,
    });
  }

  return forecastList;
}

/**
 * 4. OTA Channel Production & Net Revenue Report
 */
export function getChannelProductionData() {
  const bookings = getAllBookings();

  const channelMap = {
    "Direct Web": { name: "Direct Website", bookings: 0, nights: 0, grossRev: 0, commPercent: 0 },
    "Walk-in": { name: "Front Desk Walk-in", bookings: 0, nights: 0, grossRev: 0, commPercent: 0 },
    "Booking.com": { name: "Booking.com", bookings: 0, nights: 0, grossRev: 0, commPercent: 15 },
    "Expedia": { name: "Expedia Group", bookings: 0, nights: 0, grossRev: 0, commPercent: 18 },
    "Agoda": { name: "Agoda", bookings: 0, nights: 0, grossRev: 0, commPercent: 15 },
    "Airbnb": { name: "Airbnb", bookings: 0, nights: 0, grossRev: 0, commPercent: 3 },
    "Corporate": { name: "Corporate Direct", bookings: 0, nights: 0, grossRev: 0, commPercent: 0 },
  };

  bookings.forEach((b) => {
    const channelKey = b.channel || b.source || "Direct Web";
    const ch = channelMap[channelKey] || channelMap["Direct Web"];
    ch.bookings += 1;
    ch.nights += Math.max(1, Number(b.nights || 1));
    ch.grossRev += Number(b.totalAmount || b.subtotal || b.rate || 0);
  });

  return Object.values(channelMap).map((ch) => {
    const commAmt = ch.grossRev * (ch.commPercent / 100);
    const netRev = ch.grossRev - commAmt;
    const alos = ch.bookings > 0 ? ch.nights / ch.bookings : 0;

    return {
      ...ch,
      commAmt,
      netRev,
      alos,
    };
  });
}

/**
 * 5. City Ledger & AR Aging Report
 */
export function getCityLedgerAgingData() {
  const accounts = getCompanyAccounts();

  return accounts.map((acc) => {
    const totalOwed = Number(acc.currentBalance || acc.balance || 0);
    const current030 = Number(acc.current030 !== undefined ? acc.current030 : totalOwed);
    const days3160 = Number(acc.days3160 || 0);
    const days6190 = Number(acc.days6190 || 0);
    const days90Plus = Number(acc.days90Plus || 0);

    return {
      id: acc.id,
      name: acc.name,
      accountNo: acc.accountNo || "ACC-101",
      creditLimit: Number(acc.creditLimit || 5000),
      current030,
      days3160,
      days6190,
      days90Plus,
      totalOwed,
    };
  });
}

/**
 * 6. Payment Collection & Gateway Audit Report
 */
export function getPaymentAuditData() {
  const bookings = getAllBookings();
  const pgConfig = getPaymentGatewayConfig();

  const methodsMap = {
    Cash: { name: "💵 Cash", count: 0, total: 0 },
    Deposit: { name: "🛡️ Deposit Hold", count: 0, total: 0 },
    Card: { name: "💳 Manual Card", count: 0, total: 0 },
    Stripe: { name: "⚡ Stripe Terminal", count: 0, total: 0, enabled: pgConfig.stripe?.enabled },
    Fortis: { name: "🏛️ Fortis Pay", count: 0, total: 0, enabled: pgConfig.fortis?.enabled },
    Shift4: { name: "⚡ Shift4 SkyTab", count: 0, total: 0, enabled: pgConfig.shift4?.enabled },
    PAYBOTX: { name: "🤖 PAYBOTX Auto", count: 0, total: 0, enabled: pgConfig.paybotx?.enabled },
    Venmo: { name: "💙 Venmo QR", count: 0, total: 0, enabled: pgConfig.venmo?.enabled },
    Zelle: { name: "💜 Zelle Express", count: 0, total: 0, enabled: pgConfig.zelle?.enabled },
    Company: { name: "🏢 Corporate Account", count: 0, total: 0 },
    Cheque: { name: "📝 Cheque", count: 0, total: 0 },
  };

  bookings.forEach((b) => {
    if (Array.isArray(b.payments) && b.payments.length > 0) {
      b.payments.forEach((p) => {
        const pmRaw = String(p.paymentMethod || p.method || b.paymentMethod || "Cash");
        let pm = "Cash";
        const lower = pmRaw.toLowerCase();
        if (lower.includes("stripe")) pm = "Stripe";
        else if (lower.includes("fortis")) pm = "Fortis";
        else if (lower.includes("shift4")) pm = "Shift4";
        else if (lower.includes("paybot")) pm = "PAYBOTX";
        else if (lower.includes("venmo")) pm = "Venmo";
        else if (lower.includes("zelle")) pm = "Zelle";
        else if (lower.includes("card") || lower.includes("credit")) pm = "Card";
        else if (lower.includes("deposit")) pm = "Deposit";
        else if (lower.includes("company") || lower.includes("corporate")) pm = "Company";
        else if (lower.includes("cheque") || lower.includes("check")) pm = "Cheque";
        else if (methodsMap[pmRaw]) pm = pmRaw;

        const methodObj = methodsMap[pm] || methodsMap["Cash"];
        methodObj.count += 1;
        methodObj.total += Number(p.amount || 0);
      });
    } else {
      const pmRaw = String(b.paymentMethod || "Cash");
      let pm = "Cash";
      if (methodsMap[pmRaw]) pm = pmRaw;
      const methodObj = methodsMap[pm] || methodsMap["Cash"];
      methodObj.count += 1;
      methodObj.total += Number(b.amountPaid || b.totalAmount || b.rate || 0);
    }
  });

  return Object.values(methodsMap);
}

/**
 * 8. Daily Rate Report (Room Type & Rate Plan Wise)
 */
export function getDailyRateReportData(numDays = 30) {
  const roomTypes = getRoomTypes();
  const ratePlans = getRatePlans();
  const dailyRatesMap = getDailyRatesMap();
  const today = new Date();

  const datesList = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    datesList.push({ date: dateStr, dayName });
  }

  const matrix = [];
  let highestPeakRate = 0;
  let globalRateSum = 0;
  let globalRateCount = 0;

  roomTypes.forEach((rt) => {
    ratePlans.forEach((rp) => {
      const planNights = Math.max(1, Number(rp?.nights) || 1);
      const rpRawPrice = Number(
        rp?.adjustment !== undefined && rp?.adjustment !== ""
          ? rp.adjustment
          : rp?.price !== undefined && rp?.price !== ""
          ? rp.price
          : rp?.rate !== undefined && rp?.rate !== ""
          ? rp.rate
          : rp?.baseRate || 0
      );
      const planNightlyRate = rpRawPrice > 0 ? (rpRawPrice / planNights) : 0;
      const rtNightlyRate = Number(rt.price || rt.basePrice || rt.rate || rt.baseRate || 0);

      const basePrice = planNightlyRate > 0 ? planNightlyRate : rtNightlyRate;

      const row = {
        roomType: rt.name,
        ratePlan: rp.name,
        code: rp.code || rp.name.slice(0, 3).toUpperCase(),
        baseRate: basePrice,
        dailyRates: {},
        avgRate: 0,
        minRate: Infinity,
        maxRate: -Infinity
      };

      let sum = 0;
      datesList.forEach(({ date }) => {
        const key = `${rt.name}_${rp.name}_${date}`;
        const keyAlt = `${rt.name}_${date}`;
        const override = dailyRatesMap[key] || dailyRatesMap[keyAlt];
        
        let price = basePrice;
        if (override && override.price !== undefined && override.price !== "") {
          price = Number(override.price);
        } else if (rp.multiplier && Number(rp.multiplier) > 0) {
          price = Math.round(basePrice * Number(rp.multiplier));
        }
        
        row.dailyRates[date] = price;
        sum += price;
        globalRateSum += price;
        globalRateCount++;

        if (price < row.minRate) row.minRate = price;
        if (price > row.maxRate) row.maxRate = price;
        if (price > highestPeakRate) highestPeakRate = price;
      });

      row.avgRate = datesList.length > 0 ? Math.round((sum / datesList.length) * 100) / 100 : basePrice;
      if (row.minRate === Infinity) row.minRate = basePrice;
      if (row.maxRate === -Infinity) row.maxRate = basePrice;

      matrix.push(row);
    });
  });

  const avgGlobalRate = globalRateCount > 0 ? Math.round((globalRateSum / globalRateCount) * 100) / 100 : 0;

  return {
    numDays,
    dates: datesList,
    matrix,
    roomTypes,
    ratePlans,
    avgGlobalRate,
    highestPeakRate
  };
}
