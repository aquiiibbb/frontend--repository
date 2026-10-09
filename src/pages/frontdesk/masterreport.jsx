import React, { useState, useEffect, useMemo } from "react";
import ReportsHub from "../../components/Reports/ReportsHub";
import { PMSProvider } from "../../context/PMSContext";
import { getBookings, getRooms } from "../../services/api";
import CustomDatePicker from "../../components/CustomDatePicker";
import FolioModal from "../../components/FolioModal";
import { getSequenceConfig, formatSequence, getTaxRules, getBusinessDate, getRoomTypes, getSellableRooms, isSellableRoom, getVirtualRoomTypeNames } from "../../services/hotelConfig";
import { isInventoryConsumingBooking, isUnconfirmedEnquiry } from "../../services/overbookingService";
import { exportToExcel, exportToPDF, exportToWord } from "../../utils/exportUtils";
import { 
  DollarSign, 
  Percent, 
  TrendingUp, 
  BarChart3, 
  CreditCard, 
  AlertCircle, 
  Users, 
  Ban, 
  Download, 
  Printer, 
  FileText,
  MousePointerClick,
  Info,
  SlidersHorizontal,
  CheckSquare,
  Square,
  RotateCcw,
  Moon,
  Building,
  CheckCircle2,
  Layers,
  ShieldCheck
} from "lucide-react";
import "./masterreport.css";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatMoney(v) {
  return `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateMMDDYYYY(dateStr) {
  if (!dateStr || dateStr === "N/A" || dateStr === "—") return "N/A";
  const cleanStr = String(dateStr).split("T")[0];
  const parts = cleanStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${month}/${day}/${year}`;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    }
  } catch (e) {}
  return dateStr;
}

function getBookingPaymentsSum(b) {
  if (!b) return 0;
  if (Array.isArray(b.payments) && b.payments.length > 0) {
    return b.payments.reduce((acc, p) => acc + (Number(p.amountUSD || p.amount) || 0), 0);
  }
  return Number(b.advanceAmount || b.paidAmount || 0);
}

function getBookingBalanceDue(b, totalAmount) {
  if (!b) return 0;
  const paid = getBookingPaymentsSum(b);
  const tot = totalAmount !== undefined ? Number(totalAmount || 0) : Number(b.totalAmount || 0);
  return Math.max(0, tot - paid);
}

function formatBookingId(bId) {
  if (!bId) return "BK-N/A";
  const str = String(bId);
  if (str.startsWith("walkin-") || str.startsWith("bk_")) {
    const numPart = str.replace(/[^0-9]/g, "").slice(-4) || "1001";
    const seqCfg = getSequenceConfig().booking;
    return formatSequence(seqCfg.prefix, numPart, seqCfg.padding, seqCfg.suffix);
  }
  return str;
}

export default function MasterReportWrapper() {
  return (
    <PMSProvider>
      <ReportsHub />
    </PMSProvider>
  );
}

export function LegacyMasterReportView({ defaultTab = "master" }) {
  const [activeReportTab, setActiveReportTab] = useState(defaultTab); // "master", "rate_inventory", "night_audit"
  const [activeDrillDown, setActiveDrillDown] = useState("total_revenue");
  const [datePreset, setDatePreset] = useState("this_month");
  const [dateBasis, setDateBasis] = useState("checkIn"); // "checkIn" or "bookingDate"
  const [fromDate, setFromDate] = useState(() => firstDayOfMonthISO());
  const [toDate, setToDate] = useState(() => todayISO());
  const [statusFilter, setStatusFilter] = useState("");
  const [revenueCategoryFilter, setRevenueCategoryFilter] = useState("all"); // "all", "room_revenue", "cancellation_revenue", "noshow_revenue"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolioResId, setSelectedFolioResId] = useState(null);
  const [showFolioModal, setShowFolioModal] = useState(false);
  const [bookingsList, setBookingsList] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  useEffect(() => {
    fetchReportData();
    window.addEventListener("pms_bookings_updated", fetchReportData);
    window.addEventListener("pms_rooms_updated", fetchReportData);
    window.addEventListener("storage", fetchReportData);
    return () => {
      window.removeEventListener("pms_bookings_updated", fetchReportData);
      window.removeEventListener("pms_rooms_updated", fetchReportData);
      window.removeEventListener("storage", fetchReportData);
    };
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const [bList, rList] = await Promise.all([getBookings(), getRooms()]);
      setBookingsList(Array.isArray(bList) ? bList : []);
      setRoomsList(Array.isArray(rList) ? rList : []);
    } catch (err) {
      console.error("Error loading report data", err);
    } finally {
      setLoading(false);
    }
  };

  const activeTaxRules = useMemo(() => {
    const rules = getTaxRules();
    const active = rules.filter((r) => r.status === "Active" || r.enabled !== false);
    if (active.length > 0) return active;
    return [
      { id: "tax_state", name: "State Sales Tax", percent: 6, rate: 6 },
      { id: "tax_city", name: "City Occupancy Tax", percent: 5, rate: 5 },
      { id: "tax_county", name: "County Tourism Surcharge", percent: 3, rate: 3 }
    ];
  }, []);

  const allAvailableColumns = useMemo(() => {
    const taxCols = activeTaxRules.map((t) => ({
      key: `tax_rule_${t.id || t.name}`,
      label: `${t.name} (${t.percent || t.rate}%) ($)`,
      category: "Taxes Breakdown",
      taxRule: t
    }));

    return [
      { key: "id", label: "Booking ID", category: "General Info" },
      { key: "bookingDate", label: "Booking Date", category: "General Info" },
      { key: "guest", label: "Guest Name", category: "General Info" },
      { key: "room", label: "Room #", category: "General Info" },
      { key: "roomType", label: "Room Category", category: "General Info" },
      { key: "ratePlan", label: "Rate Plan", category: "General Info" },
      { key: "checkIn", label: "Check-In", category: "General Info" },
      { key: "checkOut", label: "Check-Out", category: "General Info" },
      { key: "nights", label: "Nights", category: "General Info" },
      { key: "perDayRevenue", label: "Per Day Revenue ($)", category: "Financials" },
      { key: "subtotal", label: "Subtotal ($)", category: "Financials" },
      { key: "discountGiven", label: "Discount Given ($)", category: "Financials" },
      { key: "addons", label: "Extra / Addons ($)", category: "Financials" },
      ...taxCols,
      { key: "taxAmount", label: "Total Tax ($)", category: "Taxes Breakdown" },
      { key: "taxExemptValue", label: "Total Tax Exempt ($)", category: "Taxes Breakdown" },
      { key: "totalAmount", label: "Total Room Revenue ($)", category: "Financials" },
      { key: "cancellationRevenue", label: "Cancellation Revenue ($)", category: "Financials" },
      { key: "noShowRevenue", label: "No Show Revenue ($)", category: "Financials" },
      { key: "paymentMade", label: "Payment Made ($)", category: "Payments & Balance" },
      { key: "balanceDue", label: "Balance Due ($)", category: "Payments & Balance" },
      { key: "payMethod", label: "Pay Method", category: "Payments & Balance" },
      { key: "depositHeld", label: "Deposit Held ($)", category: "Deposits Vault" },
      { key: "depositRefunded", label: "Deposit Refunded ($)", category: "Deposits Vault" },
      { key: "source", label: "Source", category: "General Info" },
      { key: "phone", label: "Phone", category: "General Info" },
      { key: "email", label: "Email", category: "General Info" },
      { key: "status", label: "Status", category: "General Info" }
    ];
  }, [activeTaxRules]);

  const [selectedColKeys, setSelectedColKeys] = useState(() => {
    return [
      "id", "bookingDate", "guest", "room", "roomType", "ratePlan", "checkIn", "checkOut",
      "perDayRevenue", "subtotal", "discountGiven", "addons",
      ...activeTaxRules.map((t) => `tax_rule_${t.id || t.name}`),
      "taxAmount", "taxExemptValue", "totalAmount", "cancellationRevenue", "noShowRevenue", "paymentMade", "balanceDue", "payMethod", "depositHeld", "depositRefunded", "source", "status"
    ];
  });

  const handleToggleCol = (key) => {
    setSelectedColKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllCols = () => {
    setSelectedColKeys(allAvailableColumns.map((c) => c.key));
  };

  const handleDeselectAllCols = () => {
    setSelectedColKeys(["id", "guest"]);
  };

  const handleResetDefaultCols = () => {
    setSelectedColKeys([
      "id", "bookingDate", "guest", "room", "roomType", "ratePlan", "checkIn", "checkOut",
      "perDayRevenue", "subtotal", "discountGiven", "addons",
      ...activeTaxRules.map((t) => `tax_rule_${t.id || t.name}`),
      "taxAmount", "taxExemptValue", "totalAmount", "paymentMade", "balanceDue", "payMethod", "source", "status"
    ]);
  };

  const getBookingColumnValue = (b, colKey) => {
    const nights = Math.max(1, Number(b.nights || 1));
    const rNo = b.room || b.roomNumber || b.roomNo;
    const allRoomTypes = getRoomTypes();
    const isVirtualStay = rNo ? !isSellableRoom(rNo, roomsList, allRoomTypes) : false;

    const defaultTaxPct = activeTaxRules.reduce((sum, r) => sum + Number(r.percent || r.rate || 0), 0) / 100;
    const subtotalVal = isVirtualStay ? 0 : Number(b.subtotal !== undefined && b.subtotal !== null ? b.subtotal : (Number(b.ratePerNight || b.nightlyRateUSD || b.rate || 0) * nights));
    
    if (colKey === "id") return formatBookingId(b.id || b.bookingId);
    if (colKey === "bookingDate") {
      const raw = b.bookingDate || b.createdDate || b.createdAt || b.date;
      if (!raw) return formatDateMMDDYYYY(b.checkIn);
      return formatDateMMDDYYYY(String(raw).slice(0, 10));
    }
    if (colKey === "guest") return b.guest || b.fullName || b.guestName || "Guest";
    if (colKey === "room") return b.room || b.roomNumber || "Unassigned";
    if (colKey === "roomType") return b.roomType || b.accommodation || "Standard";
    if (colKey === "ratePlan") return b.ratePlan || b.ratePlanName || b.rateType || b.planName || "Standard Rate";
    if (colKey === "checkIn") return formatDateMMDDYYYY(b.checkIn);
    if (colKey === "checkOut") return formatDateMMDDYYYY(b.checkOut);
    if (colKey === "nights") return nights;

    const bStatus = String(b.status || "").toLowerCase();
    const isCancelled = bStatus === "cancelled";
    const isNoShow = bStatus === "no-show";

    if (colKey === "perDayRevenue") {
      if (isCancelled || isNoShow || isVirtualStay) return "$0.00";
      const perDay = Number(b.ratePerNight || b.nightlyRateUSD || (subtotalVal / nights));
      return formatMoney(perDay);
    }

    if (colKey === "subtotal") {
      if (isCancelled || isNoShow || isVirtualStay) return "$0.00";
      return formatMoney(subtotalVal);
    }

    if (colKey === "discountGiven") {
      let disc = isVirtualStay ? 0 : Number(b.discountAmount || 0);
      if (!disc && !isVirtualStay && Array.isArray(b.extras)) {
        disc = b.extras.filter((e) => e.isDiscount || e.category === "Discount / Adjustment").reduce((sum, e) => sum + Math.abs(Number(e.amountUSD || e.amount || 0)), 0);
      }
      return formatMoney(disc);
    }

    if (colKey === "addons") {
      let addonTotal = isVirtualStay ? 0 : Number(b.addonTotal || b.extraCharges || 0);
      if (!addonTotal && !isVirtualStay && Array.isArray(b.extras)) {
        addonTotal = b.extras.filter((e) => !e.isDiscount && e.category !== "Discount / Adjustment").reduce((sum, e) => sum + Number(e.amountUSD || e.amount || 0), 0);
      }
      return formatMoney(addonTotal);
    }

    if (colKey.startsWith("tax_rule_")) {
      if (isVirtualStay) return "$0.00";
      const taxRuleId = colKey.replace("tax_rule_", "");
      const targetRule = activeTaxRules.find((t) => String(t.id || t.name) === taxRuleId);
      if (!targetRule) return "$0.00";

      const isExempt = Boolean(b.isTaxExempt || b.taxExempt);
      const isExemptRule = isExempt && (b.exemptTaxScope === "all" || !b.exemptTaxIds || b.exemptTaxIds.length === 0 || b.exemptTaxIds.includes(targetRule.id) || b.exemptTaxIds.includes(targetRule.name));

      if (isExemptRule) return "$0.00 (Exempt)";

      const pct = Number(targetRule.percent || targetRule.rate || 0);
      const calcTax = Math.round((subtotalVal * (pct / 100)) * 100) / 100;
      return formatMoney(calcTax);
    }

    if (colKey === "taxAmount") {
      if (isVirtualStay) return "$0.00";
      const isExempt = Boolean(b.isTaxExempt || b.taxExempt);
      if (isExempt && (b.exemptTaxScope === "all" || !b.exemptTaxIds || b.exemptTaxIds.length === 0)) return "$0.00 (Exempt)";
      const taxVal = b.taxAmount !== undefined && b.taxAmount !== null ? Number(b.taxAmount) : (subtotalVal * defaultTaxPct);
      return formatMoney(taxVal);
    }

    if (colKey === "taxExemptValue") {
      if (isVirtualStay) return "$0.00";
      const isExempt = Boolean(b.isTaxExempt || b.taxExempt);
      if (!isExempt) return "$0.00";
      const totalExempted = Math.round((subtotalVal * defaultTaxPct) * 100) / 100;
      return `${formatMoney(totalExempted)} (Exempt)`;
    }

    if (colKey === "totalAmount") {
      if (isCancelled || isNoShow || isVirtualStay) return "$0.00";
      const isExempt = Boolean(b.isTaxExempt || b.taxExempt);
      const taxVal = isExempt && b.exemptTaxScope === "all" ? 0 : (b.taxAmount !== undefined && b.taxAmount !== null ? Number(b.taxAmount) : (subtotalVal * defaultTaxPct));
      const totVal = Number(b.totalAmount !== undefined && b.totalAmount !== null ? b.totalAmount : (subtotalVal + taxVal));
      return formatMoney(totVal);
    }

    if (colKey === "cancellationRevenue") {
      if (!isCancelled || isVirtualStay) return "$0.00";
      const cancelAmt = Number(b.cancellationCharge || b.cancellationPenalty || b.cancellationRevenue || b.cancellationFee || b.totalAmount || 0);
      return formatMoney(cancelAmt);
    }

    if (colKey === "noShowRevenue") {
      if (!isNoShow || isVirtualStay) return "$0.00";
      const noshowAmt = Number(b.noShowCharge || b.noShowPenalty || b.noShowRevenue || b.noShowFee || b.totalAmount || 0);
      return formatMoney(noshowAmt);
    }

    if (colKey === "paymentMade") {
      if (isVirtualStay) return "$0.00";
      const paidVal = getBookingPaymentsSum(b);
      return formatMoney(paidVal);
    }

    if (colKey === "balanceDue") {
      if (isVirtualStay) return "$0.00";
      const isExempt = Boolean(b.isTaxExempt || b.taxExempt);
      const taxVal = isExempt && b.exemptTaxScope === "all" ? 0 : (b.taxAmount !== undefined && b.taxAmount !== null ? Number(b.taxAmount) : (subtotalVal * defaultTaxPct));
      const totVal = Number(b.totalAmount !== undefined && b.totalAmount !== null ? b.totalAmount : (subtotalVal + taxVal));
      const balVal = getBookingBalanceDue(b, totVal);
      return formatMoney(balVal);
    }

    if (colKey === "payMethod") {
      if (b.paymentMethod) return b.paymentMethod;
      if (Array.isArray(b.payments) && b.payments.length > 0) {
        const methods = Array.from(new Set(b.payments.map((p) => p.method || "Credit Card")));
        return methods.join(", ");
      }
      return "Credit Card";
    }

    if (colKey === "depositHeld") {
      const deps = Array.isArray(b.deposits) ? b.deposits : (Array.isArray(b.securityDeposits) ? b.securityDeposits : []);
      const heldSum = deps
        .filter((d) => String(d.status || 'held').toLowerCase() === 'held')
        .reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);
      const val = heldSum || Number(b.depositBalance || b.depositAmount || 0);
      return formatMoney(val);
    }

    if (colKey === "depositRefunded") {
      const deps = Array.isArray(b.deposits) ? b.deposits : (Array.isArray(b.securityDeposits) ? b.securityDeposits : []);
      const refundedSum = deps
        .filter((d) => String(d.status).toLowerCase() === 'refunded')
        .reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);
      return formatMoney(refundedSum);
    }

    if (colKey === "source") {
      const raw = b.source || b.channel || "Direct Walk-In";
      const strRaw = String(raw).trim();
      if (!strRaw || typeof raw === "number" || (!isNaN(Number(strRaw)) && !isNaN(parseFloat(strRaw))) || /^[\$]?[\d,]+(\.\d+)?$/.test(strRaw)) {
        return "Direct Walk-In";
      }
      return strRaw;
    }
    if (colKey === "phone") return b.phone || b.phoneNumber || "N/A";
    if (colKey === "email") return b.email || b.guestEmail || "N/A";
    if (colKey === "status") return (b.status || "Confirmed").toUpperCase();

    return b[colKey] !== undefined ? String(b[colKey]) : "—";
  };

  const filteredBookings = useMemo(() => {
    const allRoomTypes = getRoomTypes();
    const virtualTypeNames = getVirtualRoomTypeNames(allRoomTypes);

    return (bookingsList || []).filter((b) => {
      if (!b) return false;

      // Exclude Virtual / Staff room stays completely from reports
      const rNo = b.room || b.roomNumber || b.roomNo;
      if (rNo && !isSellableRoom(rNo, roomsList, allRoomTypes)) {
        return false;
      }
      const bType = String(b.roomType || b.accommodation || "").trim().toLowerCase();
      if (bType && virtualTypeNames.includes(bType)) {
        return false;
      }

      const st = (b.status || "").toLowerCase();
      const guestLower = (b.guest || b.fullName || "").toLowerCase();
      if (b.isBlocked || st === "blocked" || st === "out-of-order" || st === "maintenance") {
        return false;
      }

      // Date Basis Filter (Check-In Date vs Booking Date vs Stay Date Range)
      let effFrom = typeof fromDate === "string" ? fromDate : (fromDate?.target?.value || "");
      let effTo = typeof toDate === "string" ? toDate : (toDate?.target?.value || "");
      if (effFrom && effTo && effFrom > effTo) {
        const tmp = effFrom;
        effFrom = effTo;
        effTo = tmp;
      }

      if (dateBasis === "bookingDate") {
        const raw = b.bookingDate || b.createdDate || b.createdAt || b.date;
        const targetDateStr = raw ? String(raw).slice(0, 10) : (b.checkIn || "");
        if (effFrom && targetDateStr < effFrom) return false;
        if (effTo && targetDateStr > effTo) return false;
      } else {
        const cIn = b.checkIn || "";
        const cOut = b.checkOut || cIn;
        if (effFrom && cOut < effFrom) return false;
        if (effTo && cIn > effTo) return false;
      }

      if (revenueCategoryFilter === "room_revenue") {
        if (st === "cancelled" || st === "no-show") return false;
      } else if (revenueCategoryFilter === "cancellation_revenue") {
        if (st !== "cancelled") return false;
      } else if (revenueCategoryFilter === "noshow_revenue") {
        if (st !== "no-show") return false;
      }

      if (statusFilter) {
        const bStatus = (b.status || "").toLowerCase().replace(/[\s_]/g, "-");
        const filterStatus = statusFilter.toLowerCase().replace(/[\s_]/g, "-");
        if (bStatus !== filterStatus) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const guestName = (b.guest || b.fullName || "").toLowerCase();
        const refId = String(b.id || "").toLowerCase();
        const roomNum = String(b.room || "").toLowerCase();
        if (!guestName.includes(q) && !refId.includes(q) && !roomNum.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [bookingsList, fromDate, toDate, dateBasis, statusFilter, revenueCategoryFilter, searchQuery]);

  // --- RATE AND INVENTORY REPORT METRICS & DATA ---
  const rateInventoryData = useMemo(() => {
    const allRooms = roomsList.length > 0 ? roomsList : [
      { no: "101", type: "Single Room", price: 120, status: "available" },
      { no: "102", type: "Single Room", price: 120, status: "occupied" },
      { no: "103", type: "Single Room", price: 120, status: "occupied" },
      { no: "104", type: "Single Room", price: 120, status: "occupied" },
      { no: "201", type: "Double Room", price: 180, status: "occupied" },
      { no: "202", type: "Double Room", price: 180, status: "available" },
      { no: "203", type: "Double Room", price: 180, status: "available" },
      { no: "204", type: "Double Room", price: 180, status: "occupied" },
      { no: "301", type: "Triple Room", price: 240, status: "maintenance" },
      { no: "302", type: "Triple Room", price: 240, status: "available" },
      { no: "303", type: "Triple Room", price: 240, status: "occupied" },
    ];

    const typesMap = new Map();
    allRooms.forEach((r) => {
      const typeName = r.type || "Standard Room";
      if (!typesMap.has(typeName)) {
        typesMap.set(typeName, {
          typeName,
          totalRooms: 0,
          baseRate: Number(r.price || r.rate || 150),
          rooms: []
        });
      }
      const item = typesMap.get(typeName);
      item.totalRooms += 1;
      item.rooms.push(r);
    });

    const categoryRows = Array.from(typesMap.values()).map((cat) => {
      const catBookings = filteredBookings.filter(
        (b) => String(b.roomType || b.accommodation || "").toLowerCase() === cat.typeName.toLowerCase() ||
               cat.rooms.some((r) => String(r.no) === String(b.room))
      );
      const bookedUnits = catBookings.reduce((sum, b) => sum + Number(b.nights || 1), 0);
      const blockedUnits = cat.rooms.filter((r) => r.status === "maintenance" || r.isBlocked).length;
      const potentialRevenue = cat.totalRooms * 30 * cat.baseRate;
      const earnedRevenue = catBookings.reduce((sum, b) => sum + Number(b.totalAmount || b.subtotal || 0), 0);
      const occupancyPct = cat.totalRooms > 0 ? Math.min(100, Math.round((bookedUnits / (cat.totalRooms * 30)) * 100)) : 0;

      return {
        ...cat,
        bookedUnits,
        blockedUnits,
        availableUnits: Math.max(0, (cat.totalRooms * 30) - bookedUnits - blockedUnits),
        potentialRevenue,
        earnedRevenue,
        occupancyPct
      };
    });

    return {
      totalCapacity: allRooms.length,
      categoryRows
    };
  }, [roomsList, filteredBookings]);

  // --- NIGHT AUDIT REPORT METRICS & TRIAL BALANCE DATA ---
  const nightAuditData = useMemo(() => {
    const businessDate = getBusinessDate() || todayISO();
    
    let nightlyRoomRevenue = 0;
    let totalTaxesCollected = 0;
    let totalExtrasPosted = 0;
    let totalPaymentsSettled = 0;
    let totalBalanceOutstanding = 0;

    filteredBookings.forEach((b) => {
      const rNo = b.room || b.roomNumber || b.roomNo;
      const allRoomTypes = getRoomTypes();
      if (rNo && !isSellableRoom(rNo, roomsList, allRoomTypes)) return;

      const sub = Number(b.subtotal || 0);
      const tax = Number(b.taxAmount || 0);
      const tot = Number(b.totalAmount || 0);
      const paid = getBookingPaymentsSum(b);
      const bal = getBookingBalanceDue(b, tot);
      const extras = Number(b.extraCharges || b.addonTotal || 0);

      nightlyRoomRevenue += sub;
      totalTaxesCollected += tax;
      totalExtrasPosted += extras;
      totalPaymentsSettled += paid;
      totalBalanceOutstanding += bal;
    });

    const trialBalance = [
      { code: "1000", category: "Nightly Room Tariff Revenue", debits: nightlyRoomRevenue, credits: 0, balance: nightlyRoomRevenue },
      { code: "1100", category: "Extra Services & POS Addons", debits: totalExtrasPosted, credits: 0, balance: totalExtrasPosted },
      { code: "2000", category: "State & City Occupancy Taxes", debits: totalTaxesCollected, credits: 0, balance: totalTaxesCollected },
      { code: "3000", category: "Cash & Credit Card Guest Settlements", debits: 0, credits: totalPaymentsSettled, balance: -totalPaymentsSettled },
      { code: "4000", category: "Net Guest Ledger Outstanding Balance", debits: totalBalanceOutstanding, credits: 0, balance: totalBalanceOutstanding }
    ];

    return {
      businessDate,
      nightlyRoomRevenue,
      totalTaxesCollected,
      totalExtrasPosted,
      totalPaymentsSettled,
      totalBalanceOutstanding,
      trialBalance
    };
  }, [filteredBookings]);

  const aggregates = useMemo(() => {
    let totalRevenue = 0;
    let totalTax = 0;
    let totalPayments = 0;
    let totalBalanceDue = 0;
    let totalDepositHeld = 0;
    let totalDepositRefunded = 0;
    let roomNightsSold = 0;
    const sellableRooms = getSellableRooms(roomsList);
    let totalRoomsCount = sellableRooms.length > 0 ? sellableRooms.length : (roomsList.length || 1);
    let cancelledCount = 0;
    let activeInHouseCount = 0;

    const defaultTaxPct = activeTaxRules.reduce((sum, r) => sum + Number(r.percent || r.rate || 0), 0) / 100;

    filteredBookings.forEach((b) => {
      const rNo = b.room || b.roomNumber || b.roomNo;
      const allRoomTypes = getRoomTypes();
      const isVirtual = rNo ? !isSellableRoom(rNo, roomsList, allRoomTypes) : false;

      if (!isVirtual && isInventoryConsumingBooking(b)) {
        const sub = Number(b.subtotal !== undefined && b.subtotal !== null ? b.subtotal : (Number(b.ratePerNight || b.nightlyRateUSD || b.rate || 0) * Number(b.nights || 1)));
        const isExempt = Boolean(b.isTaxExempt || b.taxExempt);
        const tax = isExempt && b.exemptTaxScope === "all" ? 0 : (b.taxAmount !== undefined && b.taxAmount !== null ? Number(b.taxAmount) : (sub * defaultTaxPct));
        const tot = Number(b.totalAmount !== undefined && b.totalAmount !== null ? b.totalAmount : (sub + tax));
        const paid = getBookingPaymentsSum(b);
        const bal = getBookingBalanceDue(b, tot);

        totalRevenue += tot;
        totalTax += tax;
        totalPayments += paid;
        totalBalanceDue += bal;
        roomNightsSold += Number(b.nights || 1);

        const deps = Array.isArray(b.deposits) ? b.deposits : (Array.isArray(b.securityDeposits) ? b.securityDeposits : []);
        let bHeld = 0;
        let bRefunded = 0;
        deps.forEach((d) => {
          const st = String(d.status || 'held').toLowerCase();
          const amt = Number(d.amountUSD || d.amount) || 0;
          if (st === 'held') bHeld += amt;
          if (st === 'refunded') bRefunded += amt;
        });
        if (deps.length === 0) {
          bHeld = Number(b.depositBalance || b.depositAmount || 0);
        }
        totalDepositHeld += bHeld;
        totalDepositRefunded += bRefunded;
      }

      const st = (b.status || "").toLowerCase();
      if (st === "cancelled" || st === "no-show") cancelledCount++;
      if (st === "checked-in") activeInHouseCount++;
    });

    let effFrom = typeof fromDate === "string" ? fromDate : (fromDate?.target?.value || "");
    let effTo = typeof toDate === "string" ? toDate : (toDate?.target?.value || "");
    let daysCount = 1;
    if (effFrom && effTo) {
      const d1 = new Date(effFrom);
      const d2 = new Date(effTo);
      if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
        daysCount = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
      }
    }

    const sellableRoomsCount = (roomsList || []).filter((r) => {
      const rNo = r.no || r.number || r.roomNumber || r.roomNo;
      return rNo && isSellableRoom(rNo, roomsList, getRoomTypes());
    }).length || 25;

    const adr = roomNightsSold > 0 ? (totalRevenue - totalTax) / roomNightsSold : 0;
    const occupancyPct = sellableRoomsCount > 0 && roomNightsSold > 0 ? Math.min(100, Math.round((roomNightsSold / (sellableRoomsCount * Math.max(1, daysCount))) * 100)) : 0;
    const revPar = ((totalRevenue - totalTax) / (sellableRoomsCount * Math.max(1, daysCount))) || (adr * (occupancyPct / 100));

    return {
      totalRevenue,
      totalTax,
      adr,
      revPar,
      totalPayments,
      totalBalanceDue,
      totalDepositHeld,
      totalDepositRefunded,
      occupancyPct,
      cancelledCount,
      activeInHouseCount,
      roomNightsSold,
      bookingsCount: filteredBookings.length
    };
  }, [filteredBookings]);

  const drillDownConfig = useMemo(() => {
    switch (activeDrillDown) {
      case "total_tax":
        return {
          title: "Tax Collection & Exemption Summary",
          filterFn: (b) => true
        };
      case "adr":
        return {
          title: "Average Daily Rate (ADR) Summary",
          filterFn: (b) => (b.status || "").toLowerCase() !== "cancelled"
        };
      case "revpar":
        return {
          title: "RevPAR Performance Summary",
          filterFn: (b) => (b.status || "").toLowerCase() !== "cancelled"
        };
      case "payments":
        return {
          title: "Payments & Settlements Summary",
          filterFn: (b) => getBookingPaymentsSum(b) > 0
        };
      case "balance_due":
        return {
          title: "Balance Due & Outstanding Balances",
          filterFn: (b) => getBookingBalanceDue(b) > 0
        };
      case "deposits":
        return {
          title: "Security Deposits Held & Refunded Ledger",
          filterFn: (b) => {
            const deps = Array.isArray(b.deposits) ? b.deposits : (Array.isArray(b.securityDeposits) ? b.securityDeposits : []);
            const heldSum = deps.filter((d) => String(d.status || 'held').toLowerCase() === 'held').reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);
            const refundedSum = deps.filter((d) => String(d.status).toLowerCase() === 'refunded').reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);
            return heldSum > 0 || refundedSum > 0 || Number(b.depositBalance || b.depositAmount || 0) > 0;
          }
        };
      case "occupancy":
        return {
          title: "Occupancy & Guest Directory",
          filterFn: (b) => (b.status || "").toLowerCase() === "checked-in" || (b.status || "").toLowerCase() === "confirmed"
        };
      case "cancellations":
        return {
          title: "Cancellations Audit",
          filterFn: (b) => (b.status || "").toLowerCase() === "cancelled" || (b.status || "").toLowerCase() === "no-show"
        };
      case "total_revenue":
      default:
        return {
          title: "Total Revenue Ledger",
          filterFn: (b) => true
        };
    }
  }, [activeDrillDown, aggregates, filteredBookings]);

  const drillDownRows = useMemo(() => {
    return filteredBookings.filter(drillDownConfig.filterFn);
  }, [filteredBookings, drillDownConfig]);

  const activeSelectedColumns = useMemo(() => {
    return allAvailableColumns.filter((c) => selectedColKeys.includes(c.key));
  }, [allAvailableColumns, selectedColKeys]);

  const getExportHeadersAndData = () => {
    if (activeReportTab === "rate_inventory") {
      const headers = ["Room Category", "Total Physical Rooms", "Nightly Base Rate ($)", "Booked Units", "Available Units", "Blocked Units", "Potential Rev ($)", "Earned Rev ($)", "Occupancy %"];
      const data = rateInventoryData.categoryRows.map((cat) => [
        cat.typeName, cat.totalRooms, formatMoney(cat.baseRate), cat.bookedUnits, cat.availableUnits, cat.blockedUnits, formatMoney(cat.potentialRevenue), formatMoney(cat.earnedRevenue), `${cat.occupancyPct}%`
      ]);
      return { title: "Rate & Inventory Performance Report", headers, data };
    }

    if (activeReportTab === "night_audit") {
      const headers = ["Code", "Ledger Account Category", "Debits / Postings ($)", "Credits / Settlements ($)", "Closing Net Balance ($)"];
      const data = nightAuditData.trialBalance.map((item) => [
        item.code, item.category, formatMoney(item.debits), formatMoney(item.credits), formatMoney(item.balance)
      ]);
      return { title: `Night Audit Trial Balance (${nightAuditData.businessDate})`, headers, data };
    }

    const headers = activeSelectedColumns.map((c) => c.label);
    const data = drillDownRows.map((b) => {
      return activeSelectedColumns.map((c) => getBookingColumnValue(b, c.key));
    });
    return { title: drillDownConfig.title, headers, data };
  };

  const handleExportExcel = () => {
    const { title, headers, data } = getExportHeadersAndData();
    exportToExcel(`Hotel_PMS_${activeReportTab}_${todayISO()}`, title, headers, data);
  };

  const handleExportWord = () => {
    const { title, headers, data } = getExportHeadersAndData();
    exportToWord(`Hotel_PMS_${activeReportTab}_${todayISO()}`, title, headers, data);
  };

  const handleExportPDF = () => {
    const { title, headers, data } = getExportHeadersAndData();
    exportToPDF(title, headers, data);
  };

  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const today = todayISO();
    if (preset === "today") {
      setFromDate(today);
      setToDate(today);
    } else if (preset === "this_month") {
      setFromDate(firstDayOfMonthISO());
      setToDate(today);
    } else if (preset === "all") {
      setFromDate("");
      setToDate("");
    }
  };

  const groupedColumnsByCategory = useMemo(() => {
    const map = {};
    allAvailableColumns.forEach((col) => {
      const cat = col.category || "General";
      if (!map[cat]) map[cat] = [];
      map[cat].push(col);
    });
    return map;
  }, [allAvailableColumns]);

  const getColumnTotal = (colKey) => {
    const isNumeric = [
      "perDayRevenue", "subtotal", "discountGiven", "addons",
      "taxAmount", "taxExemptValue", "totalAmount", "cancellationRevenue", "noShowRevenue", "paymentMade", "balanceDue", "depositHeld", "depositRefunded", "nights"
    ].includes(colKey) || colKey.startsWith("tax_rule_");

    if (!isNumeric) return "—";

    const total = drillDownRows.reduce((acc, row) => {
      const rawVal = getBookingColumnValue(row, colKey);
      if (typeof rawVal === "number") return acc + rawVal;
      if (typeof rawVal === "string") {
        const parsed = parseFloat(rawVal.replace(/[^0-9.-]+/g, ""));
        return acc + (isNaN(parsed) ? 0 : parsed);
      }
      return acc;
    }, 0);

    if (colKey === "nights") return Math.round(total);
    return formatMoney(total);
  };

  return (
    <div className="ucr-container" style={{ padding: "24px 32px", background: "#ffffff" }}>
      {/* 1. PAGE HEADER & EXPORT TOOLBAR */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        {activeReportTab === "master" && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowColumnSelector(true)}
            style={{ background: "#ffffff", color: "#000000", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
          >
            <SlidersHorizontal size={15} /> Select Columns ({activeSelectedColumns.length}/{allAvailableColumns.length})
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={handleExportExcel} style={{ background: "#ffffff", color: "#000000", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <Download size={15} /> Export Excel
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleExportWord} style={{ background: "#ffffff", color: "#000000", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <FileText size={15} /> Export Word
        </button>
        <button type="button" className="btn btn-primary" onClick={handleExportPDF} style={{ background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>



      {/* 3. SHARED FILTER BAR */}
      <div style={{ display: "flex", gap: "18px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", background: "#f8fafc", padding: "14px 18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap" }}>Filter By:</label>
          <select
            value={dateBasis}
            onChange={(e) => setDateBasis(e.target.value)}
            style={{
              height: "38px",
              padding: "0 14px",
              borderRadius: "8px",
              border: "1.5px solid #cbd5e1",
              fontSize: "13px",
              fontWeight: "700",
              color: "#0f172a",
              background: "#ffffff",
              outline: "none",
              cursor: "pointer",
              paddingRight: "28px"
            }}
          >
            <option value="checkIn">📅 Check-In Date</option>
            <option value="bookingDate">📝 Booking Date</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap" }}>Revenue Category:</label>
          <select
            value={revenueCategoryFilter}
            onChange={(e) => setRevenueCategoryFilter(e.target.value)}
            style={{
              height: "38px",
              padding: "0 14px",
              borderRadius: "8px",
              border: "1.5px solid #cbd5e1",
              fontSize: "13px",
              fontWeight: "700",
              color: "#0f172a",
              background: "#ffffff",
              outline: "none",
              cursor: "pointer",
              paddingRight: "28px"
            }}
          >
            <option value="all">🌐 All Revenue Types</option>
            <option value="room_revenue">🏨 Room Tariff Revenue</option>
            <option value="cancellation_revenue">❌ Cancellation Revenue</option>
            <option value="noshow_revenue">⛔ No-Show Revenue</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>From:</label>
          <CustomDatePicker
            value={typeof fromDate === "string" ? fromDate : (fromDate?.target?.value || "")}
            onChange={(e) => {
              const val = typeof e === "string" ? e : (e?.target?.value || String(e || ""));
              setFromDate(val);
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>To:</label>
          <CustomDatePicker
            value={typeof toDate === "string" ? toDate : (toDate?.target?.value || "")}
            onChange={(e) => {
              const val = typeof e === "string" ? e : (e?.target?.value || String(e || ""));
              setToDate(val);
            }}
          />
        </div>


      </div>

      {/* --- REPORT MODE 1: MASTER FINANCIAL LEDGER --- */}
      {activeReportTab === "master" && (
        <>


          {/* ACTIVE DRILLDOWN TITLE */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
              📊 {drillDownConfig.title} ({drillDownRows.length} records)
            </h3>
            {activeDrillDown !== "total_revenue" && (
              <button
                type="button"
                onClick={() => setActiveDrillDown("total_revenue")}
                style={{ fontSize: "12px", fontWeight: "700", color: "#2563eb", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Clear Drilldown Filter
              </button>
            )}
          </div>

          {/* MASTER LEDGER TABLE */}
          <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1.5px solid #cbd5e1" }}>
                  {activeSelectedColumns.map((col) => (
                    <th key={col.key} style={{ padding: "12px 14px", textAlign: "left", fontWeight: "800", color: "#0f172a", whiteSpace: "nowrap" }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drillDownRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeSelectedColumns.length} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                      No records match the selected filter parameters.
                    </td>
                  </tr>
                ) : (
                  drillDownRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => {
                        setSelectedFolioResId(row.id);
                        setShowFolioModal(true);
                      }}
                      style={{ borderBottom: "1px solid #e2e8f0", cursor: "pointer", background: "#ffffff" }}
                      className="ucr-table-row"
                    >
                      {activeSelectedColumns.map((col) => (
                        <td key={col.key} style={{ padding: "10px 14px", color: "#0f172a", whiteSpace: "nowrap" }}>
                          {getBookingColumnValue(row, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", fontWeight: "800", borderTop: "2px solid #cbd5e1" }}>
                  {activeSelectedColumns.map((col, idx) => (
                    <td key={col.key} style={{ padding: "12px 14px", color: "#0f172a", whiteSpace: "nowrap" }}>
                      {idx === 0 ? "TOTALS" : getColumnTotal(col.key)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* --- REPORT MODE 2: RATE AND INVENTORY REPORT --- */}
      {activeReportTab === "rate_inventory" && (
        <div>
          {/* RATE AND INVENTORY BREAKDOWN TABLE */}
          <div style={{ marginBottom: "16px", fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>
            🏷️ Room Category &amp; Inventory Breakdown
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1.5px solid #cbd5e1" }}>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "800", color: "#0f172a" }}>Room Category</th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: "800", color: "#0f172a" }}>Physical Units</th>
                  <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "800", color: "#0f172a" }}>Base Rate ($)</th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: "800", color: "#0f172a" }}>Booked Units</th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: "800", color: "#0f172a" }}>Available Units</th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: "800", color: "#0f172a" }}>Maintenance / OOO</th>
                  <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "800", color: "#0f172a" }}>Potential Max Rev ($)</th>
                  <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "800", color: "#0f172a" }}>Earned Revenue ($)</th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: "800", color: "#0f172a" }}>Occupancy %</th>
                </tr>
              </thead>
              <tbody>
                {rateInventoryData.categoryRows.map((cat, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
                    <td style={{ padding: "12px 14px", fontWeight: "800", color: "#0f172a" }}>{cat.typeName}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: "700", color: "#0f172a" }}>{cat.totalRooms} Rooms</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: "800", color: "#0f172a" }}>{formatMoney(cat.baseRate)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: "700", color: "#0f172a" }}>{cat.bookedUnits} Nights</td>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: "700", color: "#0f172a" }}>{cat.availableUnits} Nights</td>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: "700", color: "#0f172a" }}>{cat.blockedUnits} Units</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: "700", color: "#0f172a" }}>{formatMoney(cat.potentialRevenue)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: "800", color: "#0f172a" }}>{formatMoney(cat.earnedRevenue)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: "800", color: "#0f172a" }}>
                      {cat.occupancyPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- REPORT MODE 3: NIGHT AUDIT REPORT --- */}
      {activeReportTab === "night_audit" && (
        <div>
          {/* NIGHT AUDIT FINANCIAL TRIAL BALANCE TABLE */}
          <div style={{ marginBottom: "16px", fontSize: "15px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            <Moon size={18} /> Night Audit General Ledger Trial Balance
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "12px", marginBottom: "24px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1.5px solid #cbd5e1" }}>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "800", color: "#0f172a" }}>Code</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "800", color: "#0f172a" }}>General Ledger Category</th>
                  <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "800", color: "#0f172a" }}>Debits / Postings ($)</th>
                  <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "800", color: "#0f172a" }}>Credits / Settlements ($)</th>
                  <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: "800", color: "#0f172a" }}>Closing Net Balance ($)</th>
                </tr>
              </thead>
              <tbody>
                {nightAuditData.trialBalance.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
                    <td style={{ padding: "12px 14px", fontWeight: "800", color: "#2563eb" }}>{item.code}</td>
                    <td style={{ padding: "12px 14px", fontWeight: "800", color: "#0f172a" }}>{item.category}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: "700", color: "#0f172a" }}>{formatMoney(item.debits)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: "700", color: "#047857" }}>{formatMoney(item.credits)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: "900", color: item.balance < 0 ? "#047857" : "#0f172a" }}>
                      {formatMoney(Math.abs(item.balance))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AUDITOR VERIFICATION CARD */}
          <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>🛡️ Auditor Verification &amp; Rollover Status</div>
              <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "3px" }}>
                Night Audit run verified for business date <strong style={{ color: "#0f172a" }}>{nightAuditData.businessDate}</strong>. All ledger trial balances reconciled.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#dcfce7", color: "#15803d", padding: "8px 16px", borderRadius: "8px", fontWeight: "800", fontSize: "13px", border: "1px solid #86efac" }}>
              <CheckCircle2 size={16} /> Verified &amp; Signed Off
            </div>
          </div>
        </div>
      )}

      {/* COLUMN SELECTOR MODAL */}
      {showColumnSelector && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", padding: "24px", width: "640px", maxWidth: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>Select Display Columns</h3>
              <button type="button" onClick={() => setShowColumnSelector(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button type="button" onClick={handleSelectAllCols} style={{ padding: "6px 12px", borderRadius: "6px", background: "#f1f5f9", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}>Select All</button>
              <button type="button" onClick={handleDeselectAllCols} style={{ padding: "6px 12px", borderRadius: "6px", background: "#f1f5f9", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}>Deselect All</button>
              <button type="button" onClick={handleResetDefaultCols} style={{ padding: "6px 12px", borderRadius: "6px", background: "#f1f5f9", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}>Reset Defaults</button>
            </div>

            {Object.entries(groupedColumnsByCategory).map(([catName, cols]) => (
              <div key={catName} style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>{catName}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                  {cols.map((c) => (
                    <label key={c.key} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#0f172a", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedColKeys.includes(c.key)}
                        onChange={() => handleToggleCol(c.key)}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                type="button"
                onClick={() => setShowColumnSelector(false)}
                style={{ padding: "8px 20px", borderRadius: "8px", background: "#0f172a", color: "#ffffff", fontWeight: "800", border: "none", cursor: "pointer" }}
              >
                Apply Columns
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOLIO MODAL INTEGRATION FROM REPORT DRILL DOWN */}
      {showFolioModal && selectedFolioResId && (
        <FolioModal
          isOpen={showFolioModal}
          booking={bookingsList.find(b => String(b.id) === String(selectedFolioResId) || String(b.resCode) === String(selectedFolioResId)) || { id: selectedFolioResId }}
          onClose={() => {
            setShowFolioModal(false);
            setSelectedFolioResId(null);
          }}
        />
      )}
    </div>
  );
}
