import { dataStore } from "../../services/dataStore";
import React, { useState, useEffect, useMemo } from 'react';
import '../folioModal.css';
import PaymentGatewayProcessModal from '../PaymentGateway/PaymentGatewayProcessModal';
import { getPaymentGatewayConfig } from '../../services/paymentGatewayService';
import { usePMS } from '../../context/PMSContext';
import { formatUSD, formatDate, formatDateTime, calculateTaxes } from '../../utils/formatters';
import CustomDatePicker from '../CustomDatePicker';
import { getCompanyAccounts, recordCompanyAccountCharge } from '../../services/companyAccounts';
import { printViaIframe, printElementInPlace } from '../../utils/exportUtils';
import { 
  Receipt, 
  PlusCircle, 
  CreditCard, 
  Printer, 
  Mail, 
  ArrowRightLeft, 
  DollarSign, 
  CheckCircle2,
  Percent,
  FileText,
  Shield,
  History,
  Edit,
  CheckSquare,
  RefreshCw,
  Trash2,
  RotateCcw,
  Ban,
  AlertTriangle,
  FileCheck,
  LogIn,
  LogOut,
  Calendar,
  User,
  Split,
  Tag,
  ShieldCheck,
  Eye,
  Smartphone,
  BedSingle,
  ChevronDown,
  Lock,
  EyeOff,
  Folder,
  Image,
  Camera,
  Upload,
  Download,
  Layers,
  File
} from 'lucide-react';
import SendSelfCheckInModal from '../SendSelfCheckInModal';
import CameraCaptureModal from '../CameraCaptureModal';
import { getSequenceConfig, formatSequence, getHotelProfile, getHotelTerms, getCancellationPolicies, getHotelAddons, getBusinessDate, getTaxRules, getTaxInclusiveSetting, getRatePlans, getBusinessSources, isVirtualRoomOrBooking } from '../../services/hotelConfig';
import { updateDeposit, applyDepositToFolio, refundDeposit, deleteDeposit, updateBooking as apiUpdateBooking } from '../../services/api';

class GRCErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: String(error?.message || error) };
  }
  componentDidCatch(error, info) {
    console.error("GRC Modal Error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: '#ffffff', color: '#dc2626', border: '2px solid #ef4444', borderRadius: 12, margin: '20px auto', maxWidth: 600, textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
          <h3 style={{ fontSize: 18, color: '#991b1b', marginBottom: 8 }}>⚠️ Guest Registration Card Notice</h3>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>{this.state.errorMsg}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => this.props.onClose?.()}>Close</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ Direct Print</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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

export function roundCurrency(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function getRatePlanNights(planObj, planName) {
  let n = Number(planObj?.nights);
  if (!n || isNaN(n) || n <= 0) {
    const nameLower = (planName || planObj?.name || "").toLowerCase();
    const codeLower = (planObj?.code || "").toLowerCase();
    if (nameLower.includes("week") || codeLower === "wr" || codeLower === "weekly") n = 7;
    else if (nameLower.includes("month") || codeLower === "mr" || codeLower === "monthly") n = 30;
    else if (nameLower.includes("weekend")) n = 2;
    else n = 1;
  }
  return n;
}

function calculateCheckOutDate(checkInStr, nightsCount) {
  if (!checkInStr) return null;
  const cleanStr = String(checkInStr).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const inDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    inDate.setDate(inDate.getDate() + Number(nightsCount || 1));
    const yyyy = inDate.getFullYear();
    const mm = String(inDate.getMonth() + 1).padStart(2, '0');
    const dd = String(inDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

export const FolioManager = ({
  selectedResId: rawSelectedResId,
  bookingId: rawBookingId,
  reservationId: rawReservationId,
  onClose,
  onSelectResId,
  booking: propsBooking,
  rooms: propsRooms = [],
  onAddCharge: propsOnAddCharge,
  onAddSettlement: propsOnAddSettlement,
  onCollectDeposit: propsOnCollectDeposit,
  onUpdateDeposit: propsOnUpdateDeposit,
  onApplyDepositToFolio: propsOnApplyDepositToFolio,
  onRefundDeposit: propsOnRefundDeposit,
  onDeleteDeposit: propsOnDeleteDeposit,
  onGetAuditLogs: propsOnGetAuditLogs,
  onDeleteFolio: propsOnDeleteFolio,
  onEditRoomRate: propsOnEditRoomRate,
  onDeletePayment: propsOnDeletePayment,
  onUpdateStatus: propsOnUpdateStatus,
  onUpdateBooking: propsOnUpdateBooking,
  onCancelBooking: propsOnCancelBooking,
  onMarkNoShow: propsOnMarkNoShow
}) => {
  const selectedResId = rawSelectedResId || rawBookingId || rawReservationId;
  let pms = null;
  try {
    pms = usePMS();
  } catch {
    pms = null;
  }
  const { 
    reservations: pmsReservations = [], 
    folios = {}, 
    confirmAction,
    executeCancellationPolicy,
    reverseCancellationPolicy,
    addFolioCharge, 
    addFolioPayment, 
    moveFolioItem, 
    updateBookingStatus,
    updateReservation,
    updateReservation: updateBooking,
    deleteReservation,
    taxRules, 
    showToast 
  } = pms || {};

  const mergedMap = new Map();
  [...(propsBooking ? [propsBooking] : []), ...pmsReservations].forEach((item) => {
    if (!item) return;
    const key = String(item.id || item.resCode || item.room);
    const guestNameVal = item.guestName || item.guest || item.name || 'Guest';
    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        id: item.id || `res_${key}`,
        resCode: item.resCode || item.id || 'GV-1001',
        guestName: guestNameVal,
        guest: guestNameVal,
        roomNumber: item.roomNumber || item.room || '101',
        room: item.room || item.roomNumber || '101',
        roomType: item.roomType || item.type || 'Standard',
        checkIn: item.checkIn || getBusinessDate(),
        checkOut: item.checkOut || getBusinessDate(),
        nightlyRateUSD: Number(item.nightlyRateUSD || item.ratePerNight || item.subtotal || 149),
        ratePerNight: Number(item.ratePerNight || item.nightlyRateUSD || 149),
        isTaxExempt: Boolean(item.isTaxExempt || item.taxExempt),
        status: item.status || 'confirmed',
        extras: Array.isArray(item.extras) ? item.extras : [],
        payments: Array.isArray(item.payments) ? item.payments : [],
        deposits: Array.isArray(item.deposits) ? item.deposits : [],
        securityDeposits: Array.isArray(item.securityDeposits) ? item.securityDeposits : [],
        ...item
      });
    }
  });

  const reservations = Array.from(mergedMap.values());

  const [internalResId, setInternalResId] = useState(() => selectedResId || propsBooking?.id || (reservations[0] ? reservations[0].id : null));

  useEffect(() => {
    if (selectedResId) setInternalResId(selectedResId);
    else if (propsBooking?.id) setInternalResId(propsBooking.id);
  }, [selectedResId, propsBooking]);

  const activeResId = internalResId || selectedResId || propsBooking?.id || (reservations[0] ? reservations[0].id : null);
  
  const currentRes = reservations.find((r) => 
    String(r.id) === String(activeResId) || 
    (r.resCode && String(r.resCode) === String(activeResId))
  ) || (propsBooking && (String(propsBooking.id) === String(activeResId) || String(propsBooking.resCode) === String(activeResId)) ? propsBooking : null) || reservations[0];

  const booking = propsBooking || currentRes || {};

  const folioKey = currentRes ? (currentRes.id || currentRes.resCode) : activeResId;
  const rawFolio = (folios && (folios[folioKey] || folios[activeResId]));
  
  const [localFolio, setLocalFolio] = useState(null);

  useEffect(() => {
    if (rawFolio) {
      setLocalFolio(rawFolio);
    } else if (currentRes) {
      const isCleared = Boolean(currentRes.folioCleared || currentRes.isFolioCleared || currentRes.folioDeleted || currentRes.isDeleted);
      if (isCleared) {
        setLocalFolio({
          folioA: [],
          folioB: [],
          payments: []
        });
        return;
      }

      const checkInStr = currentRes.checkIn || new Date().toISOString().slice(0, 10);
      const checkOutStr = currentRes.checkOut || checkInStr;
      const d1 = new Date(`${checkInStr}T00:00:00`);
      const d2 = new Date(`${checkOutStr}T00:00:00`);
      const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 3600 * 24)));
      const nightsCount = Math.max(1, Number(currentRes.nights) || diffDays || 1);

      const isVirtualStay = isVirtualRoomOrBooking(currentRes);
      const ratesMap = currentRes.nightlyRatesMap || {};
      const baseRate = isVirtualStay ? 0 : Number(currentRes.baseRatePerNight || currentRes.originalRatePerNight || 149);

      const existingRoomRates = (currentRes.folioA || []).filter(item => 
        item.category === 'Room Rate' || 
        (item.description || "").toLowerCase().includes("room tariff") || 
        (item.description || "").toLowerCase().includes("room charge")
      );

      const roomTypeLabel = currentRes.roomType || 'Standard';

      const initialFolioA = [];
      for (let i = 0; i < nightsCount; i++) {
        const nightDateObj = new Date(d1);
        nightDateObj.setDate(nightDateObj.getDate() + i);
        const yyyy = nightDateObj.getFullYear();
        const mm = String(nightDateObj.getMonth() + 1).padStart(2, "0");
        const dd = String(nightDateObj.getDate()).padStart(2, "0");
        const nightDateStr = `${yyyy}-${mm}-${dd}`;

        const nightLabel = nightsCount > 1 
          ? `Room Tariff (${roomTypeLabel} - Night ${i + 1} of ${nightsCount})`
          : `Room Tariff (${roomTypeLabel})`;

        const existingItem = existingRoomRates[i] || existingRoomRates.find(r => r.date === nightDateStr);

        let nightRate = baseRate;
        if (existingItem) {
          nightRate = Number(existingItem.amountUSD || existingItem.amount || baseRate);
        } else if (ratesMap[nightDateStr] !== undefined) {
          nightRate = Number(ratesMap[nightDateStr]);
        } else {
          nightRate = Number(currentRes.nightlyRateUSD || currentRes.ratePerNight || baseRate);
        }

        const exclTaxVal = Math.round(nightRate * 0.88 * 100) / 100;
        const taxAmt = Math.round(nightRate * 0.12 * 100) / 100;

        if (existingItem) {
          initialFolioA.push({
            ...existingItem,
            date: nightDateStr,
            description: nightLabel,
          });
        } else {
          initialFolioA.push({
            id: `chg_night_${i + 1}_${Date.now()}`,
            date: nightDateStr,
            category: 'Room Rate',
            description: nightLabel,
            amountUSD: isVirtualStay ? 0 : nightRate,
            amount: isVirtualStay ? 0 : nightRate,
            exclTax: isVirtualStay ? 0 : exclTaxVal,
            taxAmount: isVirtualStay ? 0 : taxAmt
          });
        }
      }

      const baseFolioA = Array.isArray(currentRes.folioA) && currentRes.folioA.length > 0
        ? currentRes.folioA
        : initialFolioA;

      setLocalFolio({
        folioA: ensureAddonsAndDiscountsMapped(baseFolioA, currentRes),
        folioB: Array.isArray(currentRes.folioB) ? currentRes.folioB : [],
        payments: (currentRes.payments || []).map((p) => ({
          ...p,
          description: p.description || p.note || (p.mode ? `Payment via ${p.mode}` : 'Payment Received')
        }))
      });
    }
  }, [rawFolio, currentRes?.id, currentRes?.checkOut, currentRes?.nights, currentRes?.folioCleared, currentRes?.folioA]);

  const ensureAddonsAndDiscountsMapped = (baseFolioA, resObj) => {
    if (!resObj) return baseFolioA || [];
    let list = Array.isArray(baseFolioA) ? [...baseFolioA] : [];
    const isVirtualStay = isVirtualRoomOrBooking(resObj);
    const resStatus = String(resObj.status || "").toLowerCase();
    const isCancelledOrNoShow = resStatus === 'cancelled' || resStatus === 'no-show' || resStatus === 'noshow' || resStatus === 'cancelled_by_guest';

    if (isVirtualStay || isCancelledOrNoShow) {
      list = list.map((item) => {
        const isRoom = item.category === 'Room Rate' || (item.description || "").toLowerCase().includes("room tariff") || (item.description || "").toLowerCase().includes("room charge");
        if (isRoom) {
          return {
            ...item,
            amountUSD: 0,
            amount: 0,
            exclTax: 0,
            taxAmount: 0
          };
        }
        return item;
      });
    }

    const checkInStr = resObj.checkIn || new Date().toISOString().slice(0, 10);

    // 0. ENSURE NIGHTLY ROOM TARIFF LINE ITEMS ARE PRESENT FOR ALL NIGHTS OF STAY
    const roomRateItems = list.filter((item) => item.category === 'Room Rate' || (item.description || "").toLowerCase().includes("room tariff") || (item.description || "").toLowerCase().includes("room charge"));
    
    const checkOutStr = resObj.checkOut || checkInStr;
    const d1 = new Date(`${checkInStr}T00:00:00`);
    const d2 = new Date(`${checkOutStr}T00:00:00`);
    const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 3600 * 24)));
    const nightsCount = Math.max(1, Number(resObj.nights) || diffDays || 1);

    if (roomRateItems.length !== nightsCount) {
      const roomTypeLabel = resObj.roomType || 'Standard';
      const ratesMap = resObj.nightlyRatesMap || {};
      const baseRate = (isVirtualStay || isCancelledOrNoShow) ? 0 : Number(resObj.baseRatePerNight || resObj.originalRatePerNight || 149);

      // Filter out old room rate items if we need to expand or adjust full nights
      const nonRoomRateList = list.filter((item) => item.category !== 'Room Rate' && !(item.description || "").toLowerCase().includes("room tariff") && !(item.description || "").toLowerCase().includes("room charge"));

      const nightlyItems = [];
      for (let i = 0; i < nightsCount; i++) {
        const nightDateObj = new Date(d1);
        nightDateObj.setDate(nightDateObj.getDate() + i);
        const yyyy = nightDateObj.getFullYear();
        const mm = String(nightDateObj.getMonth() + 1).padStart(2, "0");
        const dd = String(nightDateObj.getDate()).padStart(2, "0");
        const nightDateStr = `${yyyy}-${mm}-${dd}`;

        const nightLabel = nightsCount > 1 
          ? `Room Tariff (${roomTypeLabel} - Night ${i + 1} of ${nightsCount})`
          : `Room Tariff (${roomTypeLabel})`;

        const existingItem = roomRateItems[i] || roomRateItems.find(r => r.date === nightDateStr);

        let nightRate = (isVirtualStay || isCancelledOrNoShow) ? 0 : baseRate;
        if (!isVirtualStay && !isCancelledOrNoShow) {
          if (existingItem) {
            nightRate = Number(existingItem.amountUSD || existingItem.amount || baseRate);
          } else if (ratesMap[nightDateStr] !== undefined) {
            nightRate = Number(ratesMap[nightDateStr]);
          } else {
            nightRate = Number(resObj.nightlyRateUSD || resObj.ratePerNight || baseRate);
          }
        }

        const exclTaxVal = Math.round(nightRate * 0.88 * 100) / 100;
        const taxAmt = Math.round(nightRate * 0.12 * 100) / 100;

        if (existingItem) {
          nightlyItems.push({
            ...existingItem,
            date: nightDateStr,
            description: nightLabel,
          });
        } else {
          nightlyItems.push({
            id: `chg_room_rate_init_${resObj.id || Date.now()}_n${i + 1}`,
            date: nightDateStr,
            category: 'Room Rate',
            description: nightLabel,
            amountUSD: isVirtualStay ? 0 : nightRate,
            amount: isVirtualStay ? 0 : nightRate,
            exclTax: isVirtualStay ? 0 : exclTaxVal,
            taxAmount: isVirtualStay ? 0 : taxAmt
          });
        }
      }

      list = [...nightlyItems, ...nonRoomRateList];
    }

    // 1. MAP DISCOUNTS APPLIED AT RESERVATION OR CHECK-IN
    const discVal = Number(resObj.discountAmount || resObj.discountGiven || resObj.discountValue || resObj.discountUSD || resObj.discount || 0);
    if (discVal > 0) {
      const hasDiscountItem = list.some((item) => 
        item.category === 'Discount / Adjustment' || 
        item.isDiscount || 
        (item.description || "").toLowerCase().includes("discount")
      );

      if (!hasDiscountItem) {
        const isPercent = String(resObj.discountType || "").toUpperCase().includes("PERCENT");
        const discLabel = isPercent
          ? `Discount (${resObj.discountValue || 0}% Off)`
          : `Discount Applied ($${discVal.toFixed(2)} Flat)`;

        list.push({
          id: `disc_init_${resObj.id || Date.now()}`,
          date: checkInStr,
          category: 'Discount / Adjustment',
          description: discLabel,
          amountUSD: -Math.abs(discVal),
          amount: -Math.abs(discVal),
          exclTax: -Math.abs(discVal),
          taxAmount: 0,
          taxPercent: 0,
          isDiscount: true
        });
      }
    }

    // Ensure all discount items in the list have zero tax split
    list = list.map((item) => {
      if (item.isDiscount || item.category === 'Discount / Adjustment' || (item.description || "").toLowerCase().includes("discount")) {
        const amt = Math.abs(Number(item.amountUSD || item.amount || 0));
        return {
          ...item,
          amountUSD: -amt,
          amount: -amt,
          exclTax: -amt,
          taxAmount: 0,
          taxPercent: 0,
        };
      }
      return item;
    });

    // 2. MAP ADDONS / EXTRAS SELECTED AT RESERVATION OR CHECK-IN
    const rawAddons = resObj.extras || resObj.addons || resObj.selectedAddons || resObj.addonServices || [];
    if (!Array.isArray(rawAddons) || rawAddons.length === 0) return list;

    rawAddons.forEach((ad, idx) => {
      if (!ad) return;

      // Handle Discount objects
      if (typeof ad === 'object' && (ad.isDiscount || ad.category === 'Discount / Adjustment')) {
        const discAmt = Number(ad.amountUSD || ad.amount || ad.price || 0);
        if (discAmt > 0) {
          const alreadyHasThisDisc = list.some((item) => item.isDiscount || item.category === 'Discount / Adjustment');
          if (!alreadyHasThisDisc) {
            list.push({
              id: ad.id || `disc_ex_${idx + 1}_${Date.now()}`,
              date: ad.date || checkInStr,
              category: 'Discount / Adjustment',
              description: ad.label || ad.name || ad.description || 'Discount Applied',
              amountUSD: -Math.abs(discAmt),
              amount: -Math.abs(discAmt),
              exclTax: -Math.abs(discAmt),
              taxAmount: 0,
              taxPercent: 0,
              isDiscount: true
            });
          }
        }
        return;
      }

      if (typeof ad === 'object' && ad.isPayment) return;

      const adName = typeof ad === 'string' ? ad : (ad.name || ad.label || ad.title || ad.description || `Addon Service #${idx + 1}`);
      const adPrice = typeof ad === 'object' && ad.price !== undefined ? Number(ad.price) : (typeof ad === 'object' && (ad.amount !== undefined || ad.amountUSD !== undefined) ? Number(ad.amount || ad.amountUSD) : 0);

      if (adPrice <= 0) return;

      const bType = String(ad.billingType || ad.pricingType || ad.type || "").toLowerCase();
      const isPerNight = bType.includes("night") || bType.includes("day") || bType.includes("daily") || 
                         adName.toLowerCase().includes("nightly") || adName.toLowerCase().includes("per night") || adName.toLowerCase().includes("daily");

      const qty = Math.max(1, Number(ad.qty || ad.quantity || ad.count || 1));
      const totalAddonAmt = isPerNight ? adPrice * qty * nightsCount : adPrice * qty;

      const cleanAdName = adName.replace(/^addon:\s*/i, "").trim();
      let descText = "";
      if (isPerNight) {
        if (qty > 1 && nightsCount > 1) {
          descText = `Addon: ${cleanAdName} (Qty: ${qty} • ${nightsCount} Nights @ $${adPrice}/night)`;
        } else if (nightsCount > 1) {
          descText = `Addon: ${cleanAdName} (${nightsCount} Nights @ $${adPrice}/night)`;
        } else if (qty > 1) {
          descText = `Addon: ${cleanAdName} (Qty: ${qty} @ $${adPrice}/night)`;
        } else {
          descText = `Addon: ${cleanAdName}`;
        }
      } else {
        if (qty > 1) {
          descText = `Addon: ${cleanAdName} (Qty: ${qty} @ $${adPrice})`;
        } else {
          descText = `Addon: ${cleanAdName}`;
        }
      }

      const activeTaxRate = typeof getActiveTaxPercent === "function" ? getActiveTaxPercent() / 100 : 0;
      const hasTax = activeTaxRate > 0 && (ad.taxApplicable === true || ad.taxable === true || (ad.taxPercent && ad.taxPercent > 0));
      const taxAmt = hasTax ? Math.round((totalAddonAmt - (totalAddonAmt / (1 + activeTaxRate))) * 100) / 100 : 0;
      const exclTaxVal = hasTax ? Math.round((totalAddonAmt - taxAmt) * 100) / 100 : totalAddonAmt;

      const alreadyExists = list.some((item) => {
        const itemDesc = (item.description || item.label || "").toLowerCase();
        const searchName = cleanAdName.toLowerCase();
        return itemDesc.includes(searchName) || (ad.id && item.id === ad.id);
      });

      if (!alreadyExists) {
        list.push({
          id: ad.id || `chg_addon_${idx + 1}_${Date.now()}`,
          date: ad.date || checkInStr,
          category: 'Addon / Extra Charge',
          description: descText,
          amountUSD: totalAddonAmt,
          amount: totalAddonAmt,
          exclTax: exclTaxVal,
          taxAmount: taxAmt,
          qty,
          unitPrice: adPrice
        });
      }
    });

    return list;
  };

  const fallbackFolioA = (() => {
    if (!currentRes || currentRes.folioCleared || currentRes.isFolioCleared || currentRes.folioDeleted) return [];
    if (Array.isArray(currentRes.folioA) && currentRes.folioA.length > 0) return ensureAddonsAndDiscountsMapped(currentRes.folioA, currentRes);

    const checkInStr = currentRes.checkIn || new Date().toISOString().slice(0, 10);
    const checkOutStr = currentRes.checkOut || checkInStr;
    const d1 = new Date(`${checkInStr}T00:00:00`);
    const d2 = new Date(`${checkOutStr}T00:00:00`);
    const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 3600 * 24)));
    const nightsCount = Math.max(1, Number(currentRes.nights) || diffDays || 1);
    const ratePerNight = Number(currentRes.nightlyRateUSD || currentRes.ratePerNight || currentRes.grossRatePerNight || currentRes.baseRatePerNight || (currentRes.totalAmount && nightsCount ? currentRes.totalAmount / nightsCount : 0) || 111);
    const roomTypeLabel = currentRes.roomType || 'Standard';

    const items = [];
    for (let i = 0; i < nightsCount; i++) {
      const nightDateObj = new Date(d1);
      nightDateObj.setDate(nightDateObj.getDate() + i);
      const yyyy = nightDateObj.getFullYear();
      const mm = String(nightDateObj.getMonth() + 1).padStart(2, "0");
      const dd = String(nightDateObj.getDate()).padStart(2, "0");
      const nightDateStr = `${yyyy}-${mm}-${dd}`;

      const nightLabel = nightsCount > 1 
        ? `Room Tariff (${roomTypeLabel} - Night ${i + 1} of ${nightsCount})`
        : `Room Tariff (${roomTypeLabel})`;

      items.push({
        id: `chg_night_${i + 1}`,
        date: nightDateStr,
        category: 'Room Rate',
        description: nightLabel,
        amountUSD: ratePerNight,
        amount: ratePerNight,
        exclTax: Math.round(ratePerNight * 0.88 * 100) / 100,
        taxAmount: Math.round(ratePerNight * 0.12 * 100) / 100
      });
    }
    return ensureAddonsAndDiscountsMapped(items, currentRes);
  })();

  const currentFolio = localFolio
    ? {
        ...localFolio,
        folioA: ensureAddonsAndDiscountsMapped(localFolio.folioA, currentRes)
      }
    : {
        folioA: fallbackFolioA,
        folioB: [],
        payments: (currentRes?.payments || []).map((p) => ({
          ...p,
          description: p.description || p.note || (p.mode ? `Payment via ${p.mode}` : 'Payment Received')
        }))
      };

  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    function handleSync() {
      setRefreshTick((prev) => prev + 1);
    }
    window.addEventListener('pms_bookings_updated', handleSync);
    window.addEventListener('pms_folio_updated', handleSync);
    window.addEventListener('pms_taxes_updated', handleSync);
    return () => {
      window.removeEventListener('pms_bookings_updated', handleSync);
      window.removeEventListener('pms_folio_updated', handleSync);
      window.removeEventListener('pms_taxes_updated', handleSync);
    };
  }, []);

  const [activeFolioTab, setActiveFolioTab] = useState('folioA_detail');
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showGatewayProcessModal, setShowGatewayProcessModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPrintOptionsModal, setShowPrintOptionsModal] = useState(false);
  const [selectedInvoiceType, setSelectedInvoiceType] = useState('master');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [selectedTransferTargetId, setSelectedTransferTargetId] = useState('');
  const [transferAmountUSD, setTransferAmountUSD] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);

  // Print Customization Controls (Prepaid Invoice Encryption & Hide Rate on GRC)
  const [isPrepaid, setIsPrepaid] = useState(false);
  const [isHideRate, setIsHideRate] = useState(false);

  // 7 New Requested Options State
  const [showDeleteFolioModal, setShowDeleteFolioModal] = useState(false);
  const [showEditRoomRateModal, setShowEditRoomRateModal] = useState(false);
  const [editRateAmount, setEditRateAmount] = useState('');
  const [editingFolioItem, setEditingFolioItem] = useState(null);
  
  const [showDeletePaymentModal, setShowDeletePaymentModal] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  const [showPrintPaymentReceiptModal, setShowPrintPaymentReceiptModal] = useState(false);
  const [selectedPaymentReceipt, setSelectedPaymentReceipt] = useState(null);

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [showCancelBookingModal, setShowCancelBookingModal] = useState(false);
  const [cancelPolicyOption, setCancelPolicyOption] = useState('charge_one_night');
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [noShowPolicyOption, setNoShowPolicyOption] = useState('charge_one_night');

  const handleTriggerInvoicePrint = () => {
    const executePrint = () => {
      const paperEl = document.getElementById("printable-invoice-paper");
      if (paperEl) {
        printViaIframe(paperEl.outerHTML, "Official Tax Invoice");
      } else {
        window.print();
      }
    };

    const existingPaper = document.getElementById("printable-invoice-paper");
    if (existingPaper) {
      executePrint();
    } else {
      setShowPrintModal(true);
      setTimeout(executePrint, 250);
    }
  };

  const handleTriggerGRCPrint = () => {
    const paperEl = document.getElementById("grc-modal-printable-card");
    if (paperEl) {
      printElementInPlace(paperEl.innerHTML, "Guest Registration Card (GRC)");
    } else {
      setShowPrintGRCModal(true);
      setTimeout(() => {
        const paper = document.getElementById("grc-modal-printable-card");
        if (paper) {
          printElementInPlace(paper.innerHTML, "Guest Registration Card (GRC)");
        } else {
          window.print();
        }
      }, 300);
    }
  };

  const [showPrintGRCModal, setShowPrintGRCModal] = useState(false);
  const [showSendSelfCheckInModal, setShowSendSelfCheckInModal] = useState(false);

  // Folio Overpayment Refund State
  const [showFolioRefundModal, setShowFolioRefundModal] = useState(false);
  const [refundMethod, setRefundMethod] = useState('Credit Card (Original Payment Method)');
  const [refundAmountUSD, setRefundAmountUSD] = useState('');
  const [refundDescription, setRefundDescription] = useState('Overpayment Refund to Guest');

  // Security Deposit Interactive Operations State
  const [showEditDepositModal, setShowEditDepositModal] = useState(false);
  const [showApplyDepositModal, setShowApplyDepositModal] = useState(false);
  const [showRefundDepositModal, setShowRefundDepositModal] = useState(false);
  const [activeDepositItem, setActiveDepositItem] = useState(null);
  const [editDepositAmount, setEditDepositAmount] = useState('');
  const [editDepositMode, setEditDepositMode] = useState('Cash');

  // Operational Feature Modals State
  const [showModifyCheckInModal, setShowModifyCheckInModal] = useState(false);
  const [modifyCheckInDate, setModifyCheckInDate] = useState('');

  const [showModifyCheckoutModal, setShowModifyCheckoutModal] = useState(false);
  const [modifyCheckoutDate, setModifyCheckoutDate] = useState('');

  // Apply Discount Modal State
  const [showApplyDiscountModal, setShowApplyDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState('percentage'); // 'percentage' | 'fixed'
  const [discountValue, setDiscountValue] = useState('');
  const [customDiscountReason, setCustomDiscountReason] = useState('');

  const [showRoomMoveModal, setShowRoomMoveModal] = useState(false);
  const [targetMoveRoom, setTargetMoveRoom] = useState('');
  const [moveRoomRate, setMoveRoomRate] = useState('');

  const [showSplitRoomModal, setShowSplitRoomModal] = useState(false);
  const [splitDate, setSplitDate] = useState('');
  const [splitGuestName, setSplitGuestName] = useState('');
  const [splitRoomNumber, setSplitRoomNumber] = useState('');

  const [showEditGuestProfileModal, setShowEditGuestProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileIdType, setProfileIdType] = useState('Passport');
  const [profileIdNumber, setProfileIdNumber] = useState('');
  const [profileCardName, setProfileCardName] = useState('');
  const [profileCardNumber, setProfileCardNumber] = useState('');
  const [profileCardExpiry, setProfileCardExpiry] = useState('');
  const [profileCardCvv, setProfileCardCvv] = useState('');

  // Record Payment New Card State
  const [newCardName, setNewCardName] = useState('');
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');
  const [newCardCvv, setNewCardCvv] = useState('');
  const [saveCardToProfile, setSaveCardToProfile] = useState(true);

  // Corporate Company Accounts for Direct Bill / Post to Company
  const [companyAccountsList, setCompanyAccountsList] = useState([]);
  const [selectedCompanyAccountId, setSelectedCompanyAccountId] = useState('');

  useEffect(() => {
    if (showAddPaymentModal) {
      const list = getCompanyAccounts();
      setCompanyAccountsList(list);
      if (list.length > 0) {
        setSelectedCompanyAccountId(list[0].id);
      }
    }
  }, [showAddPaymentModal]);

  const [showModifyRatePlanModal, setShowModifyRatePlanModal] = useState(false);
  const [selectedRatePlan, setSelectedRatePlan] = useState('EP');
  const [ratePlanNights, setRatePlanNights] = useState(1);
  const [ratePlanTariff, setRatePlanTariff] = useState('');

  // Market Segment State
  const [showModifySegmentModal, setShowModifySegmentModal] = useState(false);
  const [selectedSegmentVal, setSelectedSegmentVal] = useState('DIRECT');
  const [selectedSubSegmentVal, setSelectedSubSegmentVal] = useState('WALK-IN');

  // Tax Exemption State
  const [showTaxExemptModal, setShowTaxExemptModal] = useState(false);
  const [taxExemptScope, setTaxExemptScope] = useState('all'); // 'all' | 'selective'
  const [selectedExemptTaxIds, setSelectedExemptTaxIds] = useState([]);
  const [taxExemptCertNo, setTaxExemptCertNo] = useState('');
  const [taxExemptReason, setTaxExemptReason] = useState('Government Official');
  const [customTaxExemptReason, setCustomTaxExemptReason] = useState('');

  // Reservation Notes & Special Requests State & Handlers
  const [showEditNoteModal, setShowEditNoteModal] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const getReservationNotesList = (res) => {
    if (!res) return [];
    if (Array.isArray(res.notesList) && res.notesList.length > 0) {
      return res.notesList;
    }
    const legacyText = (res.notes || res.specialRequests || res.remark || '').trim();
    if (legacyText) {
      return [{
        id: 'legacy_note_1',
        text: legacyText,
        createdAt: res.createdAt || new Date().toISOString(),
        author: 'Front Desk'
      }];
    }
    return [];
  };

  const handleOpenAddNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
    setShowEditNoteModal(true);
  };

  const handleOpenEditSingleNote = (noteObj) => {
    setEditingNoteId(noteObj.id);
    setEditingNoteText(noteObj.text || '');
    setShowEditNoteModal(true);
  };

  const handleSaveNotesList = async (updatedList, auditAction = "Note Updated", auditDetails = "Updated reservation notes") => {
    const resId = currentRes?.id;
    if (!resId) return;
    const combinedText = updatedList.map((n) => n.text).filter(Boolean).join('\n\n');
    const patchData = {
      notesList: updatedList,
      notes: combinedText,
      specialRequests: combinedText,
      remark: combinedText,
      auditAction,
      auditDetails
    };

    try {
      const { updateBooking: apiUpdateBooking } = await import('../../services/api');
      if (typeof apiUpdateBooking === 'function') {
        await apiUpdateBooking(resId, patchData);
      }
    } catch (err) {
      console.error("API updateBooking notes error:", err);
    }
    if (propsOnUpdateBooking) {
      propsOnUpdateBooking(resId, patchData);
    }
    if (updateBooking) {
      updateBooking(resId, patchData);
    }
    try {
      const pmsB = JSON.parse(dataStore.getItem('pms_bookings') || '[]');
      const idx = pmsB.findIndex((b) => String(b.id) === String(resId) || String(b.resCode) === String(resId));
      if (idx !== -1) {
        pmsB[idx].notesList = updatedList;
        pmsB[idx].notes = combinedText;
        pmsB[idx].specialRequests = combinedText;
        pmsB[idx].remark = combinedText;
        dataStore.setItem('pms_bookings', JSON.stringify(pmsB));
      }
    } catch (e) {}

    window.dispatchEvent(new Event('pms_bookings_updated'));
  };

  const handleSaveSingleNote = async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const currentList = getReservationNotesList(currentRes);
    let newList = [];
    let act = "Note Added";
    let det = `Added Folio Note: "${trimmed}"`;

    if (editingNoteId) {
      newList = currentList.map((n) => (n.id === editingNoteId ? { ...n, text: trimmed, updatedAt: new Date().toISOString() } : n));
      act = "Note Updated";
      det = `Updated Folio Note: "${trimmed}"`;
      recordAuditLog(act, det);
      if (showToast) showToast("Reservation note updated!", "success");
    } else {
      const newNote = {
        id: `note_${Date.now()}_${Math.random().toString().slice(-4)}`,
        text: trimmed,
        createdAt: new Date().toISOString(),
        author: 'Front Desk'
      };
      newList = [newNote, ...currentList];
      act = "Note Added";
      det = `Added Folio Note: "${trimmed}"`;
      recordAuditLog(act, det);
      if (showToast) showToast("New reservation note added!", "success");
    }
    await handleSaveNotesList(newList, act, det);
    setShowEditNoteModal(false);
  };

  const handleDeleteSingleNote = async (noteId) => {
    if (typeof window !== 'undefined' && !window.confirm("Are you sure you want to delete this note?")) {
      return;
    }
    const currentList = getReservationNotesList(currentRes);
    const targetNote = currentList.find((n) => n.id === noteId);
    const newList = currentList.filter((n) => n.id !== noteId);
    const act = "Note Deleted";
    const det = `Deleted Folio Note: "${targetNote?.text || ''}"`;
    recordAuditLog(act, det);
    await handleSaveNotesList(newList, act, det);
    if (showToast) showToast("Note deleted successfully.", "info");
  };

  // Legacy fallbacks for compatibility
  const handleOpenEditNote = handleOpenAddNote;
  const handleSaveNotes = (text) => handleSaveSingleNote(text);
  const handleDeleteNotes = () => {
    const list = getReservationNotesList(currentRes);
    if (list.length > 0) handleDeleteSingleNote(list[0].id);
  };

  // --------------------------------------------------------------------------
  // Guest Documents State & Handlers (1. Scanned Images, 2. Captured Images, 3. Saved Credit Cards)
  // --------------------------------------------------------------------------
  const [docFilterCategory, setDocFilterCategory] = useState('all'); // 'all' | 'scanned' | 'captured' | 'cards'
  const [previewMediaItem, setPreviewMediaItem] = useState(null); // Lightbox modal target
  const [showAddScannedDocModal, setShowAddScannedDocModal] = useState(false);
  const [showAddCapturedPhotoModal, setShowAddCapturedPhotoModal] = useState(false);
  const [showFolioCameraModal, setShowFolioCameraModal] = useState(false);
  const [showAddCardDocModal, setShowAddCardDocModal] = useState(false);
  const [docRerenderTrigger, setDocRerenderTrigger] = useState(0);

  const syncBookingUpdate = (resId, patchData) => {
    if (!resId) return;
    updateLocalBookingCache(resId, (b) => {
      Object.assign(b, patchData);
    });
    if (updateReservation) {
      updateReservation(resId, patchData);
    }
    try {
      apiUpdateBooking(resId, patchData);
    } catch (err) {}
    setDocRerenderTrigger((prev) => prev + 1);
  };

  // New Scanned Doc Form State
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState("US Driver's License");
  const [newDocNumber, setNewDocNumber] = useState('');
  const [newDocCountry, setNewDocCountry] = useState('United States');
  const [newDocFileUrl, setNewDocFileUrl] = useState('');

  // New Captured Photo Form State
  const [newPhotoTitle, setNewPhotoTitle] = useState('');
  const [newPhotoSource, setNewPhotoSource] = useState('Front Desk HD Webcam');
  const [newPhotoFileUrl, setNewPhotoFileUrl] = useState('');

  // New Saved Card Form State
  const [newCardHolderName, setNewCardHolderName] = useState('');
  const [newCardNumVal, setNewCardNumVal] = useState('');
  const [newCardExpVal, setNewCardExpVal] = useState('');
  const [newCardCvvVal, setNewCardCvvVal] = useState('');
  const [newCardTypeBrand, setNewCardTypeBrand] = useState('Visa');

  const getGuestScannedImages = (res) => {
    if (!res) return [];
    let list = [];
    if (Array.isArray(res.scannedImages) && res.scannedImages.length > 0) {
      list = [...res.scannedImages];
    }

    const currentUrls = list.map((item) => item?.url).filter(Boolean);
    const candidateScanUrls = [
      { url: res.scannedIdUrl, label: `${res.idType || res.idProofType || "US Driver's License"} - Scanned ID` },
      { url: res.idFront, label: `${res.idType || res.idProofType || "US Driver's License"} - Front` },
      { url: res.idBack, label: `${res.idType || res.idProofType || "US Driver's License"} - Back (Barcode)` },
      { url: res.idDocumentUrl, label: `${res.idType || res.idProofType || "US Driver's License"} - Document` },
      { url: res.fullScanPhoto, label: `${res.idType || res.idProofType || "US Driver's License"} - Full Scan` },
      { url: res.idScan, label: `${res.idType || res.idProofType || "US Driver's License"} - ID Scan` }
    ];

    candidateScanUrls.forEach((cand, idx) => {
      if (cand.url && !currentUrls.includes(cand.url)) {
        list.push({
          id: `scanned_fallback_${idx}_${Date.now()}`,
          title: cand.label,
          idType: res.idType || res.idProofType || "US Driver's License",
          idNumber: res.idNumber || res.idProofNumber || 'Verified',
          issueCountry: res.idCountry || 'United States',
          url: cand.url,
          uploadedAt: res.createdAt || new Date().toISOString(),
          source: 'AI ID Scanner'
        });
        currentUrls.push(cand.url);
      }
    });

    return list;
  };

  const getGuestCapturedImages = (res) => {
    if (!res) return [];
    const scannedUrls = [
      res.idFront,
      res.scannedIdUrl,
      res.idDocumentUrl,
      res.fullScanPhoto,
      res.idScan,
      ...(Array.isArray(res.scannedImages) ? res.scannedImages.map((s) => s?.url) : [])
    ].filter(Boolean);

    let list = [];
    if (Array.isArray(res.capturedImages) && res.capturedImages.length > 0) {
      list = res.capturedImages.filter((img) => img && img.url && !scannedUrls.includes(img.url));
    }
    
    if (list.length === 0) {
      const candidateUrl = res.capturedPhoto || res.guestPhoto || res.photoUrl;
      if (candidateUrl && !scannedUrls.includes(candidateUrl)) {
        list.push({
          id: 'captured_guest_photo',
          title: 'Guest Check-In Photo',
          url: candidateUrl,
          capturedAt: res.checkInDate || res.createdAt || new Date().toISOString(),
          source: 'Front Desk HD Webcam',
          resolution: '1920x1080'
        });
      }
    }
    return list;
  };

  const getGuestSavedCards = (res) => {
    if (!res) return [];
    let list = [];
    if (Array.isArray(res.savedCards) && res.savedCards.length > 0) {
      list = [...res.savedCards];
    } else if (res.cardNumber || res.cardMasked) {
      const fullNum = String(res.cardNumber || '');
      const last4 = fullNum.slice(-4) || '4242';
      const gName = `${res.firstName || res.guest || 'Guest'} ${res.lastName || ''}`.trim();
      list = [
        {
          id: 'saved_card_primary',
          cardName: res.cardName || gName,
          cardNumber: fullNum,
          cardMasked: res.cardMasked || `•••• •••• •••• ${last4}`,
          cardExpiry: res.cardExpiry || '12/28',
          cardCvv: res.cardCvv || '•••',
          cardBrand: res.cardBrand || (fullNum.startsWith('5') ? 'Mastercard' : fullNum.startsWith('3') ? 'Amex' : 'Visa'),
          savedAt: res.createdAt || new Date().toISOString(),
          isPrimary: true
        }
      ];
    }
    return list;
  };

  const getGuestDocumentsTotalCount = (res) => {
    const s = getGuestScannedImages(res).length;
    const c = getGuestCapturedImages(res).length;
    const k = getGuestSavedCards(res).length;
    return s + c + k;
  };

  const handleSaveNewScannedDoc = (e) => {
    if (e) e.preventDefault();
    if (!currentRes) return;
    const docData = {
      id: `scanned_${Date.now()}`,
      title: newDocTitle || `${newDocType} Document`,
      idType: newDocType,
      idNumber: newDocNumber || 'DL-NEW-ATTACHED',
      issueCountry: newDocCountry,
      url: newDocFileUrl || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
      uploadedAt: new Date().toISOString(),
      source: 'Manual Staff Upload'
    };
    const currentList = getGuestScannedImages(currentRes);
    const updatedList = [docData, ...currentList];
    currentRes.scannedImages = updatedList;
    currentRes.scannedIdUrl = docData.url || currentRes.scannedIdUrl;

    syncBookingUpdate(currentRes.id, {
      scannedImages: updatedList,
      scannedIdUrl: docData.url || currentRes.scannedIdUrl
    });

    setShowAddScannedDocModal(false);
    setNewDocTitle('');
    setNewDocNumber('');
    setNewDocFileUrl('');
    if (showToast) showToast('Scanned document added successfully.', 'success');
  };

  const handleDeleteScannedDoc = (docId) => {
    if (!currentRes) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this scanned document?')) return;
    const currentList = getGuestScannedImages(currentRes);
    const updatedList = currentList.filter(d => d.id !== docId);
    const docToDelete = currentList.find(d => d.id === docId);
    const deletedUrl = docToDelete ? docToDelete.url : null;

    currentRes.scannedImages = updatedList;
    const patchData = { scannedImages: updatedList };

    if (deletedUrl) {
      if (currentRes.scannedIdUrl === deletedUrl) { currentRes.scannedIdUrl = ''; patchData.scannedIdUrl = ''; }
      if (currentRes.idFront === deletedUrl) { currentRes.idFront = ''; patchData.idFront = ''; }
      if (currentRes.idDocumentUrl === deletedUrl) { currentRes.idDocumentUrl = ''; patchData.idDocumentUrl = ''; }
      if (currentRes.fullScanPhoto === deletedUrl) { currentRes.fullScanPhoto = ''; patchData.fullScanPhoto = ''; }
    }

    syncBookingUpdate(currentRes.id, patchData);

    if (showToast) showToast('Scanned document deleted.', 'info');
  };

  const handleSaveNewCapturedPhoto = (e) => {
    if (e) e.preventDefault();
    if (!currentRes) return;
    const photoData = {
      id: `captured_${Date.now()}`,
      title: newPhotoTitle || 'Guest Photo Capture',
      url: newPhotoFileUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      capturedAt: new Date().toISOString(),
      source: newPhotoSource || 'Front Desk HD Webcam',
      resolution: '1920x1080'
    };
    const currentList = getGuestCapturedImages(currentRes).filter(p => p.id !== 'captured_guest_photo');
    const updatedList = [photoData, ...currentList];
    currentRes.capturedImages = updatedList;
    currentRes.guestPhoto = photoData.url || currentRes.guestPhoto;
    currentRes.photoUrl = photoData.url || currentRes.photoUrl;

    syncBookingUpdate(currentRes.id, {
      capturedImages: updatedList,
      guestPhoto: photoData.url || currentRes.guestPhoto,
      photoUrl: photoData.url || currentRes.photoUrl
    });

    setShowAddCapturedPhotoModal(false);
    setNewPhotoTitle('');
    setNewPhotoFileUrl('');
    if (showToast) showToast('Guest photo captured and saved.', 'success');
  };

  const handleFolioCameraCapture = (photoDataUrl) => {
    if (!currentRes || !photoDataUrl) return;
    const photoData = {
      id: `captured_${Date.now()}`,
      title: 'Webcam Live Capture',
      url: photoDataUrl,
      capturedAt: new Date().toISOString(),
      source: 'Front Desk HD Webcam',
      resolution: '1280x720'
    };
    const currentList = getGuestCapturedImages(currentRes).filter(p => p.id !== 'captured_guest_photo');
    const updatedList = [photoData, ...currentList];
    currentRes.capturedImages = updatedList;
    currentRes.guestPhoto = photoDataUrl;
    currentRes.photoUrl = photoDataUrl;

    syncBookingUpdate(currentRes.id, {
      capturedImages: updatedList,
      guestPhoto: photoDataUrl,
      photoUrl: photoDataUrl
    });

    setShowFolioCameraModal(false);
    if (showToast) showToast('Live photo captured and saved to documents.', 'success');
  };

  const handleDeleteCapturedPhoto = (photoId) => {
    if (!currentRes) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this captured photo?')) return;
    const currentList = getGuestCapturedImages(currentRes);
    const updatedList = currentList.filter(p => p.id !== photoId);
    const photoToDelete = currentList.find(p => p.id === photoId);
    const deletedUrl = photoToDelete ? photoToDelete.url : null;

    currentRes.capturedImages = updatedList;
    const patchData = { capturedImages: updatedList };

    if (photoId === 'captured_guest_photo' || (deletedUrl && (currentRes.capturedPhoto === deletedUrl || currentRes.guestPhoto === deletedUrl || currentRes.photoUrl === deletedUrl))) {
      currentRes.capturedPhoto = '';
      currentRes.guestPhoto = '';
      currentRes.photoUrl = '';
      patchData.capturedPhoto = '';
      patchData.guestPhoto = '';
      patchData.photoUrl = '';
    }

    syncBookingUpdate(currentRes.id, patchData);

    if (showToast) showToast('Captured photo deleted.', 'info');
  };

  const handleMovePaymentToSecurityDeposit = (paymentItem) => {
    if (!currentRes || !paymentItem) return;
    const amtUSD = Number(paymentItem.amountUSD || paymentItem.amount || 0);
    if (amtUSD <= 0) return;

    if (typeof window !== 'undefined' && !window.confirm(`Move $${amtUSD.toFixed(2)} payment to Held Security Deposit Vault? This will restore the room tariff balance due.`)) return;

    const existingPayments = currentRes.payments || [];
    const updatedPayments = existingPayments.filter(p => p.id !== paymentItem.id && p !== paymentItem);

    const pMode = paymentItem.mode || paymentItem.method || paymentItem.paymentMethod || 'Cash';
    const depItem = {
      id: `dep_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      amount: amtUSD,
      amountUSD: amtUSD,
      date: paymentItem.date || new Date().toISOString().slice(0, 10),
      status: 'held',
      mode: pMode,
      method: pMode,
      note: paymentItem.description || paymentItem.note || 'Converted to Security Deposit',
      createdAt: new Date().toISOString()
    };

    const existingDeposits = Array.isArray(currentRes.deposits) ? currentRes.deposits : (Array.isArray(currentRes.securityDeposits) ? currentRes.securityDeposits : []);
    const updatedDeposits = [depItem, ...existingDeposits];

    currentRes.payments = updatedPayments;
    currentRes.deposits = updatedDeposits;
    currentRes.securityDeposits = updatedDeposits;
    currentRes.advanceAmount = (updatedPayments.reduce((sum, p) => sum + Number(p.amountUSD || p.amount || 0), 0));

    syncBookingUpdate(currentRes.id, {
      payments: updatedPayments,
      deposits: updatedDeposits,
      securityDeposits: updatedDeposits,
      advanceAmount: currentRes.advanceAmount
    });

    if (showToast) showToast(`$${amtUSD.toFixed(2)} moved to Held Security Deposit Vault. Room tariff balance restored.`, 'success');
  };

  const handleSaveNewCreditCardDoc = (e) => {
    if (e) e.preventDefault();
    if (!currentRes) return;
    const rawNum = newCardNumVal.replace(/\s+/g, '') || '4532891024814242';
    const last4 = rawNum.slice(-4) || '4242';
    const cardData = {
      id: `card_${Date.now()}`,
      cardName: newCardHolderName || `${currentRes.firstName || 'Guest'} ${currentRes.lastName || ''}`.trim() || 'Valued Guest',
      cardNumber: rawNum,
      cardMasked: `•••• •••• •••• ${last4}`,
      cardExpiry: newCardExpVal || '12/28',
      cardCvv: newCardCvvVal || '•••',
      cardBrand: newCardTypeBrand || (rawNum.startsWith('5') ? 'Mastercard' : rawNum.startsWith('3') ? 'Amex' : 'Visa'),
      savedAt: new Date().toISOString(),
      isPrimary: false
    };
    const currentList = getGuestSavedCards(currentRes);
    const updatedList = [cardData, ...currentList];
    currentRes.savedCards = updatedList;
    currentRes.cardNumber = rawNum;
    currentRes.cardName = cardData.cardName;
    currentRes.cardExpiry = cardData.cardExpiry;

    syncBookingUpdate(currentRes.id, {
      savedCards: updatedList,
      cardNumber: rawNum,
      cardName: cardData.cardName,
      cardExpiry: cardData.cardExpiry
    });

    setShowAddCardDocModal(false);
    setNewCardHolderName('');
    setNewCardNumVal('');
    setNewCardExpVal('');
    setNewCardCvvVal('');
    if (showToast) showToast('Credit card saved to guest profile.', 'success');
  };

  const handleDeleteCreditCardDoc = (cardId) => {
    if (!currentRes) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this saved credit card?')) return;
    const currentList = getGuestSavedCards(currentRes);
    const updatedList = currentList.filter(c => c.id !== cardId);
    currentRes.savedCards = updatedList;

    syncBookingUpdate(currentRes.id, { savedCards: updatedList });

    if (showToast) showToast('Saved card removed.', 'info');
  };

  const [auditLogsList, setAuditLogsList] = useState([]);

  const recordAuditLog = (action, details) => {
    const activeUsername = (() => {
      try {
        const raw = dataStore.getItem('pms_user');
        if (raw) {
          const u = JSON.parse(raw);
          if (u.username) return u.username;
          if (u.name) return u.name;
        }
      } catch (e) {}
      return 'admin';
    })();

    const logItem = {
      id: `log_${Date.now()}_${Math.random().toString().slice(-4)}`,
      action,
      details,
      user: activeUsername,
      role: 'Administrator',
      createdAt: new Date().toISOString()
    };
    setAuditLogsList((prev) => [logItem, ...prev]);
  };

  // Load audit logs
  useEffect(() => {
    if (propsOnGetAuditLogs && currentRes?.id) {
      Promise.resolve(propsOnGetAuditLogs(currentRes.id)).then((logs) => {
        if (Array.isArray(logs) && logs.length > 0) {
          setAuditLogsList(logs);
        }
      });
    }
  }, [currentRes?.id, propsOnGetAuditLogs]);

  // Initial audit log generator if list is empty
  useEffect(() => {
    if (currentRes && auditLogsList.length === 0) {
      setAuditLogsList([
        {
          id: `log_init_1`,
          action: 'Reservation Check-In / Booking Created',
          details: `Booking created for ${currentRes.guestName || currentRes.guest} in Room ${currentRes.roomNumber || currentRes.room} (${currentRes.roomType || 'Standard'})`,
          user: 'System Admin',
          role: 'Manager',
          createdAt: currentRes.checkIn ? new Date(currentRes.checkIn).toISOString() : new Date().toISOString()
        },
        {
          id: `log_init_2`,
          action: 'Room Rate Tariff Charge Posted',
          details: `Automated nightly tariff charge of $${currentRes.nightlyRateUSD || currentRes.ratePerNight || 149} posted to Folio A`,
          user: 'Night Audit System',
          role: 'Automated Service',
          createdAt: new Date().toISOString()
        }
      ]);
    }
  }, [currentRes?.id]);

  // Form States
  const [chargeCategory, setChargeCategory] = useState('Room Service');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmountUSD, setChargeAmountUSD] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('Credit Card (Visa)');
  const [paymentAmountUSD, setPaymentAmountUSD] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('Payment Received');

  const [depositAmountUSD, setDepositAmountUSD] = useState('500');
  const [depositMethod, setDepositMethod] = useState('Cash');

  const [emailRecipient, setEmailRecipient] = useState(currentRes?.guestEmail || '');

  const [showTaxesCollapse, setShowTaxesCollapse] = useState(true);

  // Totals & Discount Math
  const isVirtualStay = isVirtualRoomOrBooking(currentRes);
  const totalFolioA = (currentFolio.folioA || []).reduce((acc, c) => acc + (Number(c.amountUSD || c.amount) || 0), 0);
  const totalFolioB = (currentFolio.folioB || []).reduce((acc, c) => acc + (Number(c.amountUSD || c.amount) || 0), 0);
  const allFolioItems = [...(currentFolio.folioA || []), ...(currentFolio.folioB || [])];
  
  const roomSubtotal = isVirtualStay
    ? 0
    : allFolioItems
        .filter((item) => !item.isDiscount && (item.category === 'Room Rate' || (item.description || "").toLowerCase().includes("room tariff") || (item.description || "").toLowerCase().includes("room charge")))
        .reduce((acc, item) => acc + Number(item.amountUSD || item.amount || 0), 0);

  const addonSubtotal = allFolioItems
    .filter((item) => !item.isDiscount && item.category !== 'Room Rate' && !(item.description || "").toLowerCase().includes("room tariff") && !(item.description || "").toLowerCase().includes("room charge") && Number(item.amountUSD || item.amount) > 0)
    .reduce((acc, item) => acc + Number(item.amountUSD || item.amount || 0), 0);

  const grossSubtotal = roomSubtotal + addonSubtotal;

  const totalDiscounts = allFolioItems
    .filter((item) => item.isDiscount || Number(item.amountUSD || item.amount) < 0)
    .reduce((acc, item) => acc + Math.abs(Number(item.amountUSD || item.amount || 0)), 0);

  // Room tax applies strictly to room rate minus discount
  const taxableRoomBase = isVirtualStay ? 0 : Math.max(0, roomSubtotal - totalDiscounts);
  const taxableSubtotal = isVirtualStay ? 0 : Math.max(0, grossSubtotal - totalDiscounts);
  const totalCharges = grossSubtotal;

  // Check Tax Exemption Status
  const isExempt = isVirtualStay || Boolean(
    currentRes?.taxExempt ||
    currentRes?.isTaxExempt ||
    currentRes?.taxExemption?.exemptAll ||
    currentRes?.taxExemptionStatus === "Exempt" ||
    currentRes?.taxExemptStatus === "Exempt"
  );

  // Compute Itemized Tax Lines strictly on taxableRoomBase (Room Charges after discount) & stay length
  const activeTaxRules = typeof getTaxRules === 'function' ? getTaxRules().filter((r) => r.status === "Active" || r.status === "active") : [];
  const activeTaxPct = typeof getActiveTaxPercent === 'function' ? getActiveTaxPercent() : (currentRes.taxPercent || 0);

  const checkInDate = new Date(currentRes?.checkIn || Date.now());
  const checkOutDate = new Date(currentRes?.checkOut || Date.now());
  const resNights = Math.max(1, Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)) || 1);
  
  const itemizedTaxLines = isExempt
    ? []
    : activeTaxRules.length > 0
    ? activeTaxRules.map((rule) => {
        const isFixed = rule.taxType === "fixed";
        if (isFixed) {
          const fixedVal = Number(rule.fixedAmount || rule.amount || 0);
          const isPerStay = rule.fixedCalculation === "per_stay";
          const taxAmt = isPerStay ? fixedVal : Math.round(fixedVal * resNights * 100) / 100;
          return {
            name: rule.name && !rule.name.includes("(") ? `${rule.name} ($${fixedVal.toFixed(2)}/${isPerStay ? "stay" : "night"})` : (rule.name || `Fixed Tax ($${fixedVal.toFixed(2)})`),
            amount: taxAmt
          };
        } else {
          const pct = Number(rule.percent !== undefined ? rule.percent : rule.percentage !== undefined ? rule.percentage : 3);
          return {
            name: rule.name && !rule.name.includes("(") ? `${rule.name} (${pct}%)` : (rule.name || `Tax (${pct}%)`),
            amount: Math.round(taxableRoomBase * (pct / 100) * 100) / 100
          };
        }
      })
    : activeTaxPct > 0 ? [
        {
          name: `Room Tax (${activeTaxPct}%)`,
          amount: Math.round(taxableRoomBase * (activeTaxPct / 100) * 100) / 100
        }
      ] : [];

  const totalTaxes = isExempt ? 0 : itemizedTaxLines.reduce((acc, t) => acc + t.amount, 0);
  const grandTotal = taxableRoomBase + addonSubtotal + totalTaxes;
  const totalPayments = (currentFolio.payments || []).reduce((acc, p) => acc + (Number(p.amountUSD || p.amount) || 0), 0);
  
  const rawBalance = grandTotal - totalPayments;
  const balanceDue = Math.round(rawBalance * 100) / 100;
  const isOverpaid = balanceDue < -0.01;
  const overpaidAmount = Math.abs(balanceDue);

  // Handlers
  const calculateAddonAmountAndDesc = (addonObj) => {
    if (!addonObj) return { name: "", priceStr: "", desc: "", isNightly: false, isTaxZero: false };
    const nameStr = addonObj.name || addonObj.title || addonObj.label || "Addon";
    const unitPrice = Number(addonObj.price ?? addonObj.amount ?? addonObj.rate ?? 0);
    const bType = String(addonObj.billingType || addonObj.pricingType || addonObj.type || "").toLowerCase();
    const isNightly = bType.includes("night") || bType.includes("day") || bType.includes("daily") || nameStr.toLowerCase().includes("nightly") || nameStr.toLowerCase().includes("per night");
    const isTaxZero = addonObj.taxPercent === 0 || addonObj.taxPercent === "0" || addonObj.taxable === false || addonObj.taxApplicable === false;

    const checkInStr = currentRes?.checkIn || new Date().toISOString().slice(0, 10);
    const checkOutStr = currentRes?.checkOut || checkInStr;
    const d1 = new Date(`${checkInStr}T00:00:00`);
    const d2 = new Date(`${checkOutStr}T00:00:00`);
    const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 3600 * 24)));
    const nightsCount = Math.max(1, Number(currentRes?.nights) || diffDays || 1);

    const calcTotal = isNightly ? unitPrice * nightsCount : unitPrice;
    let desc = nameStr;
    if (isNightly && nightsCount > 1) {
      desc = `${nameStr} (${nightsCount} Nights @ $${unitPrice}/night)`;
    }

    return {
      name: nameStr,
      priceStr: calcTotal ? String(calcTotal) : "",
      desc,
      isNightly,
      isTaxZero,
      unitPrice,
      nightsCount
    };
  };

  const handleOpenAddChargeModal = () => {
    const addons = getHotelAddons();
    if (Array.isArray(addons) && addons.length > 0) {
      const info = calculateAddonAmountAndDesc(addons[0]);
      setChargeCategory(info.name);
      setChargeDescription(info.desc);
      setChargeAmountUSD(info.priceStr);
    } else {
      setChargeCategory("Custom Charge");
      setChargeDescription("");
      setChargeAmountUSD("");
    }
    setShowAddChargeModal(true);
  };

  const handleAddCharge = async (e) => {
    e.preventDefault();
    if (chargeAmountUSD === "" || chargeAmountUSD === null || chargeAmountUSD === undefined) return;
    const parsed = parseFloat(chargeAmountUSD);
    if (isNaN(parsed) || parsed < 0) return;
    const amountVal = parsed;
    const labelVal = chargeDescription || `${chargeCategory} Charge`;

    const addons = getHotelAddons();
    const matched = addons.find((a) => (a.name || a.title || a.label || a.id) === chargeCategory);
    const isTaxZero = matched ? (matched.taxPercent === 0 || matched.taxPercent === "0" || matched.taxable === false || matched.taxApplicable === false) : false;
    const activeTaxRate = isTaxZero ? 0 : (typeof getActiveTaxPercent === "function" ? getActiveTaxPercent() / 100 : 0);
    const taxAmt = activeTaxRate > 0 ? Math.round((amountVal - (amountVal / (1 + activeTaxRate))) * 100) / 100 : 0;
    const exclTaxVal = activeTaxRate > 0 ? Math.round((amountVal - taxAmt) * 100) / 100 : amountVal;

    const chargeItem = {
      id: `chg_${Date.now()}`,
      date: getBusinessDate(),
      label: labelVal,
      category: chargeCategory,
      description: labelVal,
      amountUSD: amountVal,
      amount: amountVal,
      exclTax: exclTaxVal,
      taxAmount: taxAmt,
      taxPercent: isTaxZero ? 0 : (activeTaxRate * 100)
    };

    const targetKey = (activeFolioTab === 'folioB' || activeFolioTab === 'folioB_detail') ? 'folioB' : 'folioA';
    const currentList = localFolio?.[targetKey] || currentRes?.[targetKey] || [];
    const updatedList = [...currentList, chargeItem];

    setLocalFolio((prev) => ({
      ...prev,
      [targetKey]: updatedList
    }));

    if (currentRes?.id) {
      currentRes[targetKey] = updatedList;
      const currentExtras = Array.isArray(currentRes.extras) ? currentRes.extras : [];
      const updatedExtras = [...currentExtras, { id: chargeItem.id, label: labelVal, amount: amountVal, addedAt: new Date().toISOString() }];
      currentRes.extras = updatedExtras;

      import('../../services/api').then(({ updateBooking: apiUpdateBooking }) => {
        if (typeof apiUpdateBooking === 'function') {
          apiUpdateBooking(currentRes.id, { [targetKey]: updatedList, extras: updatedExtras, skipAuditLog: true }).catch((err) => {
            console.error("Failed to persist extra charge to Atlas:", err);
          });
        }
      }).catch(() => {});
    }

    if (propsOnAddCharge) {
      propsOnAddCharge(currentRes, { label: labelVal, amount: amountVal });
    } else {
      recordAuditLog(
        'Added Extra Charge',
        `${labelVal} · $${amountVal.toFixed(2)} added for ${currentRes?.guestName || currentRes?.guest || 'Guest'} · Room ${currentRes?.roomNumber || currentRes?.room || ''}`
      );
    }
    showToast?.(`Charge of $${amountVal.toFixed(2)} posted successfully`);

    setChargeDescription('');
    setChargeAmountUSD('');
    setShowAddChargeModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  const handleOpenAddPaymentModal = () => {
    const pendingVal = balanceDue > 0.01 ? balanceDue.toFixed(2) : '';
    setPaymentAmountUSD(pendingVal);
    setPaymentMethod(''); // Prompt user to choose payment method first
    setNewCardName(currentRes?.cardName || currentRes?.guestName || currentRes?.guest || '');
    setNewCardNumber('');
    setNewCardExpiry('');
    setNewCardCvv('');
    setSaveCardToProfile(true);
    setShowAddPaymentModal(true);
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (isSubmittingAction) return;
    if (!paymentAmountUSD || parseFloat(paymentAmountUSD) <= 0) return;
    setIsSubmittingAction(true);
    setTimeout(() => setIsSubmittingAction(false), 1500);
    const amountVal = parseFloat(paymentAmountUSD);
    const activeBizDate = getBusinessDate();

    let methodLabel = "Cash Payment";
    let modeType = "Cash";
    const storedCardNum = currentRes?.cardNumber || currentRes?.cardDetails?.cardNumber || "";
    const storedCardLast4 = storedCardNum ? String(storedCardNum).replace(/\s+/g, "").slice(-4) : "";

    const selectedMethod = paymentMethod || "add_new_card";

    if (selectedMethod === "saved_card") {
      methodLabel = `Saved Card (•••• ${storedCardLast4 || 'Card'})`;
      modeType = "Card";
    } else if (selectedMethod === "add_new_card") {
      const cleanNum = String(newCardNumber).replace(/\s+/g, "");
      const last4 = cleanNum.length >= 4 ? cleanNum.slice(-4) : "Card";
      methodLabel = `New Credit Card (•••• ${last4})`;
      modeType = "Card";

      if (saveCardToProfile && cleanNum) {
        const cardPayload = {
          cardName: newCardName || currentRes?.guestName || currentRes?.guest || "",
          cardNumber: newCardNumber,
          cardExpiry: newCardExpiry,
          cardCvv: newCardCvv,
          cardDetails: {
            cardName: newCardName || currentRes?.guestName || currentRes?.guest || "",
            cardNumber: newCardNumber,
            cardExpiry: newCardExpiry,
            cardCvv: newCardCvv
          }
        };
        Object.assign(currentRes, cardPayload);
        try {
          const { updateBooking: apiUpdateBooking } = await import("../../services/api");
          await apiUpdateBooking(currentRes.id, cardPayload);
        } catch (err) {}
        if (updateBooking) updateBooking(currentRes.id, cardPayload);
      }
    } else if (selectedMethod === "card_offline" || selectedMethod.toLowerCase().includes("card")) {
      methodLabel = "Offline Card Terminal";
      modeType = "Card";
    } else if (selectedMethod === "post_to_company" || selectedMethod === "post_bill" || selectedMethod.includes("Company") || selectedMethod.includes("Direct Bill")) {
      const matchedCompany = companyAccountsList.find((c) => c.id === selectedCompanyAccountId);
      methodLabel = matchedCompany ? `Post to Company (${matchedCompany.name} - ${matchedCompany.accountNo})` : "Post to Company (Direct Bill)";
      modeType = "Direct Bill";
    } else if (selectedMethod === "bank_transfer") {
      methodLabel = "Bank Transfer";
      modeType = "Bank";
    } else if (selectedMethod === "cheque") {
      methodLabel = "Offline Cheque Payment";
      modeType = "Cheque";
    } else if (selectedMethod === "payment_link") {
      methodLabel = "Digital Payment Link";
      modeType = "Online";
    } else if (
      selectedMethod === "security_deposit" ||
      selectedMethod === "Deposit" ||
      selectedMethod.toLowerCase().includes("deposit") ||
      selectedMethod.toLowerCase().includes("security")
    ) {
      const depData = {
        id: `dep_${Date.now()}`,
        amount: amountVal,
        amountUSD: amountVal,
        mode: 'Cash',
        method: 'Cash',
        date: activeBizDate,
        status: 'held',
        note: paymentDescription || 'Security Deposit Collected at Folio',
        createdAt: new Date().toISOString()
      };

      if (currentRes) {
        if (!Array.isArray(currentRes.deposits)) currentRes.deposits = [];
        currentRes.deposits.push(depData);
        currentRes.securityDeposits = [...currentRes.deposits];
        const activeHeldSum = currentRes.deposits
          .filter((d) => String(d.status || 'held').toLowerCase() === 'held')
          .reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);
        currentRes.depositAmount = activeHeldSum;
        currentRes.depositBalance = activeHeldSum;
        currentRes.securityDepositCollected = activeHeldSum > 0;
        currentRes.hasDeposit = activeHeldSum > 0;

        updateLocalBookingCache(currentRes.id, (b) => {
          if (!Array.isArray(b.deposits)) b.deposits = [];
          b.deposits.push(depData);
          b.securityDeposits = [...b.deposits];
          b.depositAmount = activeHeldSum;
          b.depositBalance = activeHeldSum;
          b.securityDepositCollected = activeHeldSum > 0;
          b.hasDeposit = activeHeldSum > 0;
        });
      }

      setLocalFolio((prev) => ({
        ...prev,
        deposits: [...(prev?.deposits || []), depData]
      }));

      try {
        const { updateBooking: apiUpdateBooking } = await import("../../services/api");
        if (typeof apiUpdateBooking === "function") {
          await apiUpdateBooking(activeResId, { deposits: currentRes.deposits, securityDeposits: currentRes.deposits, skipAuditLog: true }).catch(() => {});
        }
        if (typeof updateBooking === "function") {
          updateBooking(activeResId, { deposits: currentRes.deposits, securityDeposits: currentRes.deposits, skipAuditLog: true });
        }
      } catch (err) {}

      setShowAddPaymentModal(false);
      setPaymentAmountUSD("");
      setPaymentDescription("");
      if (showToast) showToast(`Security Deposit of $${amountVal.toFixed(2)} recorded in Vault successfully.`);
      return;
    } else {
      methodLabel = selectedMethod || "Cash Payment";
      modeType = selectedMethod.toLowerCase().includes("card") ? "Card" : "Cash";
    }

    const isCard = modeType === "Card" || selectedMethod.toLowerCase().includes("card");
    const matchedCompanyObj = selectedMethod === "post_to_company" ? companyAccountsList.find((c) => c.id === selectedCompanyAccountId) : null;
    const paymentItem = {
      id: `pay_${Date.now()}`,
      method: methodLabel,
      mode: modeType,
      companyAccountId: matchedCompanyObj?.id || "",
      companyName: matchedCompanyObj?.name || "",
      companyAccountNo: matchedCompanyObj?.accountNo || "",
      description: paymentDescription && paymentDescription !== "Payment Received" 
        ? paymentDescription 
        : (selectedMethod === "security_deposit" ? "Security Deposit Collected (Cash)" : selectedMethod === "post_to_company" && matchedCompanyObj ? `Direct Bill to ${matchedCompanyObj.name}` : isCard ? "Payment via Card" : "Payment via Cash"),
      note: paymentDescription || methodLabel,
      amountUSD: amountVal,
      amount: amountVal,
      date: activeBizDate
    };

    setLocalFolio((prev) => ({
      ...prev,
      payments: [...(prev?.payments || []), paymentItem]
    }));

    if (selectedMethod === "post_to_company" || matchedCompanyObj || selectedCompanyAccountId) {
      const targetComp = selectedCompanyAccountId || matchedCompanyObj?.id || matchedCompanyObj?.name;
      if (targetComp && amountVal > 0) {
        recordCompanyAccountCharge(targetComp, amountVal);
      }
    }

    try {
      if (propsOnAddSettlement) {
        await propsOnAddSettlement(currentRes, paymentItem);
      } else if (addFolioPayment) {
        await addFolioPayment(activeResId, paymentItem);
      }
      const updatedPayments = [...(currentFolio?.payments || []), paymentItem];
      const { updateBooking: apiUpdateBooking } = await import("../../services/api");
      if (typeof apiUpdateBooking === "function") {
        await apiUpdateBooking(activeResId, { payments: updatedPayments, payment: paymentItem, skipAuditLog: true }).catch(() => {});
      }
      if (typeof updateBooking === "function") {
        updateBooking(activeResId, { payments: updatedPayments, skipAuditLog: true });
      }
    } catch (err) {
      console.error("Payment settlement error:", err);
    }

    if (!propsOnAddSettlement && !addFolioPayment) {
      recordAuditLog(
        "Recorded payment",
        `$${amountVal.toFixed(2)} via ${methodLabel} for ${currentRes?.guestName || currentRes?.guest || "Guest"} · Room ${currentRes?.roomNumber || currentRes?.room || ""}`
      );
    }
    showToast?.(`Payment of $${amountVal.toFixed(2)} posted successfully`);

    setShowAddPaymentModal(false);
    window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
  };

  const handleOpenFolioRefundModal = () => {
    const overpaidVal = balanceDue < 0 ? Math.abs(balanceDue) : 0;
    setRefundAmountUSD(overpaidVal > 0 ? overpaidVal.toFixed(2) : "");
    setRefundDescription("Overpayment Refund to Guest");
    setShowFolioRefundModal(true);
  };

  const handleProcessFolioRefund = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const amountVal = parseFloat(refundAmountUSD);
    if (!amountVal || amountVal <= 0) return;

    const activeBizDate = getBusinessDate();
    const refundItem = {
      id: `rfnd_${Date.now()}`,
      type: 'Refund',
      method: refundMethod,
      mode: refundMethod.includes('Card') ? 'Card' : 'Cash',
      description: refundDescription || `Refund via ${refundMethod}`,
      note: refundDescription || `Refund via ${refundMethod}`,
      amountUSD: -Math.abs(amountVal),
      amount: -Math.abs(amountVal),
      isRefund: true,
      date: activeBizDate
    };

    setLocalFolio((prev) => ({
      ...prev,
      payments: [...(prev?.payments || []), refundItem]
    }));

    if (currentRes) {
      if (!Array.isArray(currentRes.payments)) currentRes.payments = [];
      currentRes.payments.push(refundItem);

      let foundApplied = false;
      if (Array.isArray(currentRes.deposits)) {
        currentRes.deposits = currentRes.deposits.map((d) => {
          if (!foundApplied && (d.status === 'applied' || (Number(d.amountUSD || d.amount) === amountVal && d.status !== 'refunded'))) {
            foundApplied = true;
            return { ...d, status: 'refunded' };
          }
          return d;
        });
      }
      if (Array.isArray(currentRes.securityDeposits)) {
        let foundSec = false;
        currentRes.securityDeposits = currentRes.securityDeposits.map((d) => {
          if (!foundSec && (d.status === 'applied' || (Number(d.amountUSD || d.amount) === amountVal && d.status !== 'refunded'))) {
            foundSec = true;
            return { ...d, status: 'refunded' };
          }
          return d;
        });
      }

      const activeHeldSum = (currentRes.deposits || [])
        .filter((d) => String(d.status || 'held').toLowerCase() === 'held')
        .reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);

      currentRes.depositAmount = activeHeldSum;
      currentRes.depositBalance = activeHeldSum;
      currentRes.securityDepositCollected = activeHeldSum > 0;
      currentRes.hasDeposit = activeHeldSum > 0;
      if (activeHeldSum === 0) currentRes.depositStatus = 'refunded';

      syncBookingUpdate(currentRes.id, {
        payments: currentRes.payments,
        deposits: currentRes.deposits,
        securityDeposits: currentRes.securityDeposits,
        depositAmount: activeHeldSum,
        depositBalance: activeHeldSum,
        securityDepositCollected: activeHeldSum > 0,
        hasDeposit: activeHeldSum > 0,
        depositStatus: activeHeldSum === 0 ? 'refunded' : currentRes.depositStatus
      });
    }

    try {
      if (propsOnAddSettlement) {
        await propsOnAddSettlement(currentRes, refundItem);
      }
      if (addFolioPayment) {
        await addFolioPayment(activeResId, refundItem);
      }
    } catch (err) {
      console.error("Refund settlement error:", err);
    }

    recordAuditLog(
      'Folio Refund Processed',
      `Issued refund of $${amountVal.toFixed(2)} via ${refundMethod} (${refundDescription}) to ${currentRes?.guestName || currentRes?.guest}`
    );
    showToast?.(`💸 Refund of $${amountVal.toFixed(2)} issued successfully! Folio balanced.`);

    setRefundAmountUSD('');
    setShowFolioRefundModal(false);
    setRefreshTick((prev) => prev + 1);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    window.dispatchEvent(new CustomEvent('pms_folio_updated'));
  };

  const handleCollectDepositSubmit = async (e) => {
    e.preventDefault();
    if (!depositAmountUSD || parseFloat(depositAmountUSD) <= 0) return;
    const depAmt = parseFloat(depositAmountUSD);
    const depData = {
      id: `dep_${Date.now()}`,
      amount: depositAmountUSD,
      amountUSD: depAmt,
      mode: 'Cash',
      method: 'Cash',
      date: getBusinessDate(),
      status: 'held',
      note: 'Security Deposit Collected'
    };

    if (propsOnCollectDeposit) {
      propsOnCollectDeposit(currentRes, depData);
    } else {
      import('../../services/api').then(({ addDeposit: apiAddDeposit }) => {
        if (typeof apiAddDeposit === 'function' && currentRes?.id) {
          apiAddDeposit(currentRes.id, depData).catch((err) => {
            console.error("API addDeposit failed", err);
          });
        }
      }).catch(() => {});
    }

    if (currentRes) {
      if (!Array.isArray(currentRes.deposits)) currentRes.deposits = [];
      const isAlreadyAdded = currentRes.deposits.some(
        (d) => Number(d.amountUSD || d.amount) === depAmt && (d.mode || 'Cash') === depositMethod
      );
      if (!isAlreadyAdded) {
        currentRes.deposits.push(depData);
      }
      currentRes.securityDeposits = [...currentRes.deposits];
      const activeHeldSum = currentRes.deposits
        .filter((d) => String(d.status || 'held').toLowerCase() === 'held')
        .reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);
      currentRes.depositAmount = activeHeldSum;
      currentRes.depositBalance = activeHeldSum;
      currentRes.securityDepositCollected = activeHeldSum > 0;
      currentRes.hasDeposit = activeHeldSum > 0;

      updateLocalBookingCache(currentRes.id, (b) => {
        if (!Array.isArray(b.deposits)) b.deposits = [];
        const existsInB = b.deposits.some(
          (d) => Number(d.amountUSD || d.amount) === depAmt && (d.mode || 'Cash') === depositMethod
        );
        if (!existsInB) {
          b.deposits.push(depData);
        }
        b.securityDeposits = [...b.deposits];
        b.depositAmount = activeHeldSum;
        b.depositBalance = activeHeldSum;
        b.securityDepositCollected = activeHeldSum > 0;
        b.hasDeposit = activeHeldSum > 0;
      });
    }

    recordAuditLog(
      'Security Deposit Collected',
      `Collected Security Deposit of $${depAmt.toFixed(2)} via ${depositMethod} for Room ${currentRes?.roomNumber || currentRes?.room}`
    );
    showToast?.(`Security Deposit of $${depAmt.toFixed(2)} collected via ${depositMethod} (Status: Held)`);
    setDepositAmountUSD('500');
    setShowDepositModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  // ----------------------------------------------------
  // IMPLEMENTATION OF THE 7 NEW REQUESTED OPTIONS
  // ----------------------------------------------------

  // Option 1: Delete Entire Folio / Remove Reservation Completely
  const handleConfirmDeleteFolio = async () => {
    const resId = currentRes?.id || selectedResId;
    try {
      if (currentRes) {
        currentRes.folioCleared = true;
        currentRes.folioDeleted = true;
        currentRes.folioA = [];
        currentRes.folioB = [];
        currentRes.payments = [];
        currentRes.totalAmount = 0;
        currentRes.balanceDue = 0;
      }
      setLocalFolio({ folioA: [], folioB: [], payments: [] });
      if (propsOnDeleteFolio) {
        propsOnDeleteFolio(resId);
      }
      if (deleteReservation) {
        deleteReservation(resId);
      }

      const { deleteBooking: apiDeleteBooking, cancelBooking: apiCancelBooking, updateRoomHousekeeping: apiUpdateRoomHousekeeping } = await import('../../services/api');
      if (resId) {
        try {
          await apiDeleteBooking(resId);
        } catch (e) {
          await apiCancelBooking(resId, 'Folio & Reservation Removed from System');
        }
        if (currentRes?.room || currentRes?.roomNumber) {
          const rNo = currentRes.room || currentRes.roomNumber;
          await apiUpdateRoomHousekeeping(rNo, { status: 'available', housekeeping: 'Clean', remark: '' });
        }
      }

      window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
      window.dispatchEvent(new CustomEvent('pms_rooms_updated'));

      recordAuditLog(
        'Reservation & Folio Completely Removed',
        `Staff completely deleted reservation & folio for ${currentRes?.guestName || currentRes?.guest} from the system`
      );
      showToast?.('Reservation & Folio completely removed from system');
    } catch (err) {
      console.error('Delete folio error:', err);
      showToast?.(err.message || 'Could not delete reservation');
    } finally {
      setShowDeleteFolioModal(false);
      if (typeof onClose === 'function') {
        onClose();
      }
    }
  };

  const handleDeleteChargeItem = async (itemId, tabName) => {
    const resId = currentRes?.id || selectedResId;
    const tabKey = (tabName === 'folioB' || tabName === 'folioB_detail') ? 'folioB' : 'folioA';
    const currentList = localFolio?.[tabKey] || currentRes?.[tabKey] || [];
    const itemToDelete = currentList.find((item) => item.id === itemId);
    const itemLabel = String(itemToDelete?.description || itemToDelete?.label || itemToDelete?.itemName || 'Charge Item').trim();
    const itemAmount = itemToDelete?.amount || itemToDelete?.price || itemToDelete?.amountUSD || 0;

    const performDelete = async () => {
      const itemLabelLower = itemLabel.toLowerCase();
      const updatedTab = currentList.filter((item) => item.id !== itemId);

      const updatedExtras = (currentRes?.extras || []).filter((e) => {
        if (!e) return false;
        if (e.id && String(e.id) === String(itemId)) return false;
        const eLabel = String(e.label || e.itemName || e.description || '').toLowerCase().trim();
        if (itemLabelLower && eLabel && (itemLabelLower.includes(eLabel) || eLabel.includes(itemLabelLower))) return false;
        return true;
      });

      const updatedExtrasList = (currentRes?.extrasList || []).filter((e) => {
        if (!e) return false;
        if (e.id && String(e.id) === String(itemId)) return false;
        const eLabel = String(e.label || e.itemName || e.description || '').toLowerCase().trim();
        if (itemLabelLower && eLabel && (itemLabelLower.includes(eLabel) || eLabel.includes(itemLabelLower))) return false;
        return true;
      });

      const updatedCharges = (currentRes?.charges || []).filter((c) => {
        if (!c) return false;
        if (c.id && String(c.id) === String(itemId)) return false;
        return true;
      });

      const newExtraCharges = updatedExtras.reduce((sum, e) => sum + Number(e.amount || e.price || 0), 0);

      setLocalFolio((prev) => ({
        ...(prev || {}),
        [tabKey]: updatedTab
      }));

      if (currentRes) {
        currentRes.extras = updatedExtras;
        currentRes.extrasList = updatedExtrasList;
        currentRes.charges = updatedCharges;
        currentRes.extraCharges = newExtraCharges;
        currentRes[tabKey] = updatedTab;
      }

      try {
        const { updateBooking: apiUpdateBooking } = await import('../../services/api');
        if (resId) {
          const updatePayload = {
            [tabKey]: updatedTab,
            extras: updatedExtras,
            extrasList: updatedExtrasList,
            charges: updatedCharges,
            extraCharges: newExtraCharges,
            skipAuditLog: true
          };
          await apiUpdateBooking(resId, updatePayload);
          if (typeof updateBooking === 'function') {
            updateBooking(resId, updatePayload);
          }
        }

        try {
          const savedMisc = dataStore.getItem('pms_misc_transactions');
          if (savedMisc) {
            const parsed = JSON.parse(savedMisc);
            if (Array.isArray(parsed)) {
              const cleanMisc = parsed.filter((m) => {
                if (m.bookingId && String(m.bookingId) === String(resId)) {
                  const mName = String(m.itemName || '').toLowerCase().trim();
                  if (itemLabelLower && mName && (itemLabelLower.includes(mName) || mName.includes(itemLabelLower))) return false;
                }
                return true;
              });
              dataStore.setItem('pms_misc_transactions', JSON.stringify(cleanMisc));
              window.dispatchEvent(new CustomEvent('pms_misc_transactions_updated'));
            }
          }
        } catch (e) {}

        window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
      } catch (err) {
        console.error('Delete charge item error:', err);
      }

      recordAuditLog(
        'Folio Charge Item Deleted',
        `Deleted charge item (ID: ${itemId}) from ${tabName === 'folioA' ? 'Folio A' : 'Folio B'}`
      );
      showToast?.('Charge item deleted');
    };

    if (typeof confirmAction === 'function') {
      confirmAction({
        title: "Delete Extra Charge",
        message: `Are you sure you want to remove this extra charge item from ${tabKey === 'folioB' ? 'Folio B' : 'Folio A'}?`,
        details: [
          { label: "Item Name", value: itemLabel },
          { label: "Amount", value: `$${Number(itemAmount).toFixed(2)}` },
          { label: "Guest / Room", value: `${currentRes?.guestName || 'Guest'} (${currentRes?.room || 'Unassigned'})` }
        ],
        confirmText: "Yes, Delete Charge",
        variant: "danger",
        executionTitle: "Extra Charge Deleted",
        executionMessage: `'${itemLabel}' ($${Number(itemAmount).toFixed(2)}) has been removed from the folio.`,
        onConfirm: performDelete
      });
    } else {
      await performDelete();
    }
  };

  // Option 2: Edit Room Rate
  const handleOpenEditRoomRate = (targetItem) => {
    setEditingFolioItem(targetItem || null);
    const initialAmount = targetItem ? Number(targetItem.amountUSD || targetItem.amount || 0) : Number(currentRes?.nightlyRateUSD || currentRes?.ratePerNight || 149);
    setEditRateAmount(String(initialAmount || 149));
    setShowEditRoomRateModal(true);
  };

  const handleSaveEditRoomRate = (e) => {
    e.preventDefault();
    const rateVal = parseFloat(editRateAmount);
    if (isNaN(rateVal) || rateVal < 0) return;

    let updatedFolioA = [];
    setLocalFolio((prev) => {
      updatedFolioA = (prev?.folioA || []).map((item) => {
        const isMatch = editingFolioItem
          ? item.id === editingFolioItem.id
          : (item.category === 'Room Rate' || (item.description || '').toLowerCase().includes('room tariff'));

        if (isMatch) {
          const exclTaxVal = Math.round(rateVal * 0.88 * 100) / 100;
          const taxAmt = Math.round(rateVal * 0.12 * 100) / 100;
          return {
            ...item,
            amountUSD: rateVal,
            amount: rateVal,
            exclTax: exclTaxVal,
            taxAmount: taxAmt
          };
        }
        return item;
      });
      return { ...prev, folioA: updatedFolioA };
    });

    const roomRateItems = updatedFolioA.filter(i => i.category === 'Room Rate' || (i.description || '').toLowerCase().includes('room tariff'));
    const newSubtotal = roomRateItems.reduce((sum, i) => sum + Number(i.amountUSD || i.amount || 0), 0);
    const taxAmount = Math.round(((newSubtotal * (currentRes?.taxPercent || 12)) / 100) * 100) / 100;
    const totalAmount = Math.round((newSubtotal + taxAmount + (currentRes?.extraCharges || 0)) * 100) / 100;
    const totalPaid = Math.round(((currentRes?.payments || []).reduce((sum, p) => sum + Number(p.amountUSD || p.amount || 0), 0) + Number(currentRes?.advanceAmount || 0)) * 100) / 100;
    const balanceDue = Math.max(0, Math.round((totalAmount - totalPaid) * 100) / 100);

    const updatedRatesMap = { ...(currentRes?.nightlyRatesMap || {}) };
    if (editingFolioItem && editingFolioItem.date) {
      updatedRatesMap[editingFolioItem.date] = rateVal;
    }

    const patchPayload = {
      folioA: updatedFolioA,
      subtotal: newSubtotal,
      taxAmount,
      totalAmount,
      balanceDue,
      nightlyRatesMap: updatedRatesMap
    };

    if (propsOnEditRoomRate) {
      propsOnEditRoomRate(currentRes, rateVal);
    }
    if (updateBooking) {
      updateBooking(currentRes?.id, patchPayload);
    }

    recordAuditLog(
      'Nightly Room Rate Override / Edited',
      `Updated room tariff ${editingFolioItem ? `for ${editingFolioItem.date || editingFolioItem.description}` : ''} to $${rateVal.toFixed(2)}`
    );
    showToast?.(`Room rate updated to $${rateVal.toFixed(2)}`);
    setShowEditRoomRateModal(false);
    setEditingFolioItem(null);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  // Unassign Room Handler (Confirmed Status Only)
  const handleUnassignRoom = async () => {
    if (!currentRes) return;
    const resId = currentRes.id;
    const oldRoom = currentRes.roomNumber || currentRes.room;

    try {
      const { updateBooking: apiUpdateBooking } = await import('../../services/api');
      await apiUpdateBooking(resId, { room: "Unassigned", roomNumber: "Unassigned" });
    } catch (err) {
      console.error("API updateBooking error:", err);
    }

    if (updateBooking) {
      updateBooking(resId, { room: "Unassigned", roomNumber: "Unassigned" });
    }
    
    currentRes.room = "Unassigned";
    currentRes.roomNumber = "Unassigned";
    if (propsBooking) {
      propsBooking.room = "Unassigned";
      propsBooking.roomNumber = "Unassigned";
    }

    recordAuditLog(
      'Room Unassigned',
      `Unassigned room for ${currentRes.guestName || currentRes.guest} (reverted Room ${oldRoom} back to Unassigned)`
    );
    showToast?.(`Room ${oldRoom} unassigned. Booking is now Unassigned.`);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  // Option 3: Delete Payment Entry
  const handleOpenDeletePayment = (paymentItem) => {
    setPaymentToDelete(paymentItem);
    setShowDeletePaymentModal(true);
  };

  const handleConfirmDeletePayment = () => {
    if (!paymentToDelete) return;
    const payId = paymentToDelete.id;
    const payAmt = paymentToDelete.amountUSD || paymentToDelete.amount || 0;

    if (propsOnDeletePayment) {
      propsOnDeletePayment(currentRes, payId);
    }
    setLocalFolio((prev) => ({
      ...prev,
      payments: (prev.payments || []).filter((p) => p.id !== payId)
    }));

    recordAuditLog(
      'Payment Entry Voided & Deleted',
      `Deleted payment entry of $${payAmt} (${paymentToDelete.method || paymentToDelete.mode || 'Cash'})`
    );
    showToast?.(`Payment entry of $${payAmt} deleted`);
    setShowDeletePaymentModal(false);
  };

  // Option 4: Undo Status Transition (Revert Check-In / Check-Out)
  const handleUndoStatus = async (targetStatus) => {
    if (!currentRes) return;
    const resId = currentRes.id || currentRes._id;
    const roomNo = currentRes.roomNumber || currentRes.room;

    setOverrideStatus(targetStatus);
    if (currentRes) {
      currentRes.status = targetStatus;
    }
    if (propsBooking) {
      propsBooking.status = targetStatus;
    }

    try {
      const { updateBooking: apiUpdateBooking, updateRoomHousekeeping: apiUpdateRoomHousekeeping } = await import('../../services/api');
      await apiUpdateBooking(resId, { status: targetStatus });

      if (targetStatus === 'confirmed' && roomNo && String(roomNo).toLowerCase() !== 'unassigned') {
        await apiUpdateRoomHousekeeping(roomNo, { status: 'available', housekeeping: 'Clean' });
      }
    } catch (err) {
      console.error("API updateBooking status error:", err);
    }

    if (propsOnUpdateBooking) {
      propsOnUpdateBooking(currentRes, { status: targetStatus }, "Undo Check-In");
    }
    if (propsOnUpdateStatus) {
      propsOnUpdateStatus(resId, targetStatus);
    }
    if (updateBookingStatus) {
      updateBookingStatus(resId, targetStatus);
    }
    if (updateBooking) {
      updateBooking(resId, { status: targetStatus });
    }

    const labelStr = targetStatus === 'checked-in' ? 'Checked-In' : 'Confirmed';
    recordAuditLog(
      'Status Transition Reverted / Undo',
      `Reverted reservation status back to "${labelStr}"`
    );
    showToast?.(`Status reverted back to ${labelStr}`);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    window.dispatchEvent(new CustomEvent('pms_rooms_updated'));
  };

  // Option 5: Print Receipt for Every Payment Entry
  const handleOpenPrintPaymentReceipt = (paymentItem) => {
    setSelectedPaymentReceipt(paymentItem);
    setShowPrintPaymentReceiptModal(true);
  };

  // Dynamic Policy Calculation Helper
  const getCalculatedCancellationDetails = () => {
    if (!currentRes) return { penaltyAmount: 0, isFree: true, policyName: 'Standard Hotel Policy', actionDetail: 'Free Cancellation ($0.00)' };
    
    const cancelPolicies = getCancellationPolicies?.() || [];
    const activePolicy = cancelPolicies.find((p) => p.isDefault) || cancelPolicies[0] || { noticeHours: 24, refundType: 'one_night', name: '24 Hours Policy' };
    const noticeHours = Number(activePolicy.noticeHours || 24);
    const nightlyRate = Number(currentRes.nightlyRateUSD || currentRes.ratePerNight || 100);

    // Calculate hours between cancellation time and check-in date
    const hotelProfile = getHotelProfile?.() || {};
    const stdCheckInTime = hotelProfile.checkInTime || '15:00';
    const checkInStr = currentRes.checkIn || getBusinessDate();
    const checkInDate = new Date(`${checkInStr}T${stdCheckInTime}:00`);
    const now = new Date();
    const diffHours = (checkInDate - now) / (1000 * 60 * 60);

    // If cancelled before notice cutoff (or if policy is free_cancellation)
    const isFree = noticeHours > 0 ? diffHours >= noticeHours : false;

    let penaltyAmount = 0;
    let detailText = "";

    if (isFree || activePolicy.refundType === 'free_cancellation') {
      penaltyAmount = 0;
      detailText = `100% Free Cancellation (Cancelled prior to ${noticeHours}h cutoff)`;
    } else {
      if (activePolicy.refundType === 'no_refund') {
        penaltyAmount = Number(currentRes.subtotal || currentRes.totalUSD || (nightlyRate * Number(currentRes.nights || 1)));
        detailText = `Non-Refundable Policy Charge ($${penaltyAmount.toFixed(2)})`;
      } else if (activePolicy.refundType === 'half_refund') {
        penaltyAmount = (Number(currentRes.subtotal || currentRes.totalUSD || (nightlyRate * Number(currentRes.nights || 1)))) * 0.5;
        detailText = `50% Stay Penalty ($${penaltyAmount.toFixed(2)})`;
      } else {
        // Default: 1 night penalty
        penaltyAmount = nightlyRate;
        detailText = `1 Night Room & Tax Penalty ($${penaltyAmount.toFixed(2)})`;
      }
    }

    return {
      penaltyAmount,
      isFree: penaltyAmount === 0,
      policyName: activePolicy.name || 'Standard Hotel Policy',
      noticeHours,
      diffHours: Math.max(0, Math.round(diffHours)),
      actionDetail: detailText
    };
  };

  // Option 6: Cancel & No-Show Handlers (Always Evaluated per Hotel Policy)
  const handleExecuteCancelWithPolicy = async () => {
    if (!currentRes) return;
    const resId = currentRes.id || currentRes._id;
    const roomNo = currentRes.roomNumber || currentRes.room;
    
    const nightlyRate = Number(currentRes.nightlyRateUSD || currentRes.ratePerNight || 100);
    const policyDetails = getCalculatedCancellationDetails();
    let penaltyAmount = 0;
    let actionDetail = "";

    if (cancelPolicyOption === "charge_one_night") {
      penaltyAmount = nightlyRate;
      actionDetail = `Charged 1 Night Tariff Penalty ($${penaltyAmount.toFixed(2)})`;
      if (executeCancellationPolicy) {
        executeCancellationPolicy(resId, { selectedOption: 'option1', actionType: 'cancel' });
      }
    } else if (cancelPolicyOption === "charge_per_policy") {
      penaltyAmount = policyDetails.penaltyAmount;
      actionDetail = policyDetails.isFree
        ? `100% Free Cancellation (${policyDetails.policyName})`
        : `Charged Policy Fee (${policyDetails.policyName}: ${policyDetails.actionDetail})`;
      if (executeCancellationPolicy) {
        executeCancellationPolicy(resId, { selectedOption: 'option2', actionType: 'cancel', penaltyAmount });
      }
    } else if (cancelPolicyOption === "void_all_charges") {
      penaltyAmount = 0;
      actionDetail = `Waived Cancellation penalty & voided all charges ($0.00)`;
      if (executeCancellationPolicy) {
        executeCancellationPolicy(resId, { selectedOption: 'option3', actionType: 'cancel' });
      }
    }

    const existingFolioA = currentRes.folioA || [];
    if (!currentRes.originalFolioA) {
      currentRes.originalFolioA = JSON.parse(JSON.stringify(existingFolioA));
    }

    const feeItem = penaltyAmount > 0 ? [{
      id: `chg_cancel_${Date.now()}`,
      date: getBusinessDate(),
      category: 'Cancellation Fee',
      description: `Cancellation Fee (${actionDetail})`,
      amountUSD: penaltyAmount,
      amount: penaltyAmount,
      exclTax: Math.round(penaltyAmount * 0.88 * 100) / 100,
      taxAmount: Math.round(penaltyAmount * 0.12 * 100) / 100
    }] : [];

    // Zero out room rate lines for cancelled stay
    const zeroedRoomRates = existingFolioA.map((item) => {
      if (item.category === 'Room Rate' || (item.description || "").toLowerCase().includes("room tariff")) {
        return { ...item, amountUSD: 0, amount: 0, exclTax: 0, taxAmount: 0 };
      }
      return item;
    });

    const updatedFolioA = [...zeroedRoomRates, ...feeItem];

    setLocalFolio((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        folioA: updatedFolioA
      };
    });

    const advancePaid = Number(currentRes.advanceAmount || (Array.isArray(currentRes.payments) ? currentRes.payments.reduce((acc, p) => acc + (Number(p.amountUSD || p.amount) || 0), 0) : 0));
    const balanceDue = Math.max(0, penaltyAmount - advancePaid);

    try {
      const { cancelBooking: apiCancelBooking, updateRoomHousekeeping: apiUpdateRoomHousekeeping, updateBooking: apiUpdateBooking } = await import('../../services/api');
      await apiCancelBooking(resId, `Cancelled per Policy (${actionDetail})`);
      if (typeof apiUpdateBooking === 'function') {
        await apiUpdateBooking(resId, {
          totalAmount: penaltyAmount,
          balanceDue: balanceDue,
          folioA: updatedFolioA
        }).catch(() => {});
      }
      if (roomNo && String(roomNo).toLowerCase() !== 'unassigned') {
        await apiUpdateRoomHousekeeping(roomNo, { status: 'available', housekeeping: 'Clean', remark: '' });
      }
    } catch (err) {
      console.error("API cancelBooking error:", err);
    }

    if (propsOnCancelBooking) propsOnCancelBooking(resId);
    if (updateBookingStatus) updateBookingStatus(resId, 'cancelled');
    if (currentRes) {
      currentRes.status = 'cancelled';
      currentRes.totalAmount = penaltyAmount;
      currentRes.balanceDue = balanceDue;
      currentRes.folioA = updatedFolioA;
    }
    setOverrideStatus('cancelled');

    recordAuditLog(
      'Reservation Cancelled',
      `Cancelled booking for ${currentRes.guestName || currentRes.guest} - ${actionDetail}`
    );
    showToast?.(`Reservation cancelled (${actionDetail})`);
    setShowCancelBookingModal(false);

    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    window.dispatchEvent(new CustomEvent('pms_rooms_updated'));
  };

  const handleExecuteNoShowWithPolicy = async () => {
    if (!currentRes) return;
    const resId = currentRes.id || currentRes._id;
    const roomNo = currentRes.roomNumber || currentRes.room;
    
    const nightlyRate = Number(currentRes.nightlyRateUSD || currentRes.ratePerNight || 100);
    const policyDetails = getCalculatedCancellationDetails();
    let penaltyAmount = 0;
    let actionDetail = "";

    if (noShowPolicyOption === "charge_one_night") {
      penaltyAmount = nightlyRate;
      actionDetail = `Charged 1 Night Tariff Penalty ($${penaltyAmount.toFixed(2)})`;
      if (executeCancellationPolicy) {
        executeCancellationPolicy(resId, { selectedOption: 'option1', actionType: 'noshow' });
      }
    } else if (noShowPolicyOption === "charge_per_policy") {
      penaltyAmount = policyDetails.penaltyAmount;
      actionDetail = policyDetails.isFree
        ? `100% Free No-Show (${policyDetails.policyName})`
        : `Charged Policy Fee (${policyDetails.policyName}: ${policyDetails.actionDetail})`;
      if (executeCancellationPolicy) {
        executeCancellationPolicy(resId, { selectedOption: 'option2', actionType: 'noshow', penaltyAmount });
      }
    } else if (noShowPolicyOption === "void_all_charges") {
      penaltyAmount = 0;
      actionDetail = `Waived No-Show penalty & voided all charges ($0.00)`;
      if (executeCancellationPolicy) {
        executeCancellationPolicy(resId, { selectedOption: 'option3', actionType: 'noshow' });
      }
    }

    const existingFolioA = currentRes.folioA || [];
    if (!currentRes.originalFolioA) {
      currentRes.originalFolioA = JSON.parse(JSON.stringify(existingFolioA));
    }

    const feeItem = penaltyAmount > 0 ? [{
      id: `chg_noshow_${Date.now()}`,
      date: getBusinessDate(),
      category: 'No-Show Fee',
      description: `No-Show Fee (${actionDetail})`,
      amountUSD: penaltyAmount,
      amount: penaltyAmount,
      exclTax: Math.round(penaltyAmount * 0.88 * 100) / 100,
      taxAmount: Math.round(penaltyAmount * 0.12 * 100) / 100
    }] : [];

    const zeroedRoomRates = existingFolioA.map((item) => {
      if (item.category === 'Room Rate' || (item.description || "").toLowerCase().includes("room tariff")) {
        return { ...item, amountUSD: 0, amount: 0, exclTax: 0, taxAmount: 0 };
      }
      return item;
    });

    const updatedFolioA = [...zeroedRoomRates, ...feeItem];

    setLocalFolio((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        folioA: updatedFolioA
      };
    });

    const advancePaid = Number(currentRes.advanceAmount || (Array.isArray(currentRes.payments) ? currentRes.payments.reduce((acc, p) => acc + (Number(p.amountUSD || p.amount) || 0), 0) : 0));
    const balanceDue = Math.max(0, penaltyAmount - advancePaid);

    try {
      const { updateBooking: apiUpdateBooking, updateRoomHousekeeping: apiUpdateRoomHousekeeping } = await import('../../services/api');
      await apiUpdateBooking(resId, {
        status: 'no-show',
        totalAmount: penaltyAmount,
        balanceDue: balanceDue,
        folioA: updatedFolioA,
        notes: `No-Show (${actionDetail})`
      });
      if (roomNo && String(roomNo).toLowerCase() !== 'unassigned') {
        await apiUpdateRoomHousekeeping(roomNo, { status: 'available', housekeeping: 'Clean', remark: '' });
      }
    } catch (err) {
      console.error("API updateBooking error:", err);
    }

    if (updateBookingStatus) updateBookingStatus(resId, 'no-show');
    if (currentRes) {
      currentRes.status = 'no-show';
      currentRes.totalAmount = penaltyAmount;
      currentRes.balanceDue = balanceDue;
      currentRes.folioA = updatedFolioA;
    }
    setOverrideStatus('no-show');

    recordAuditLog(
      'Reservation Marked No-Show',
      `Marked No-Show booking for ${currentRes.guestName || currentRes.guest} - ${actionDetail}`
    );
    showToast?.(`Reservation marked No-Show (${actionDetail})`);
    setShowNoShowModal(false);

    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    window.dispatchEvent(new CustomEvent('pms_rooms_updated'));
  };

  const handleUndoCancellation = () => {
    if (!currentRes) return;
    const resId = currentRes.id || currentRes.resCode;
    const guestName = currentRes.guestName || currentRes.guest || 'Guest';

    confirmAction?.({
      title: 'Undo Cancellation & Reopen Reservation',
      message: `Are you sure you want to reverse the cancellation policy for ${guestName}?`,
      details: [
        'Restores original room tariff rates ($49.00 / night)',
        'Reclassifies revenue from Cancellation Revenue back to Room Revenue',
        `Restores reservation status to ${currentRes.previousStatus || 'confirmed'}`,
        `Re-blocks Room ${currentRes.roomNumber || currentRes.room || 'Unassigned'} in inventory`
      ],
      confirmText: 'Yes, Undo Cancellation',
      cancelText: 'Cancel',
      variant: 'primary',
      onConfirm: async () => {
        if (reverseCancellationPolicy) {
          reverseCancellationPolicy(resId);
        }

        const checkInStr = currentRes.checkIn || getBusinessDate();
        const checkOutStr = currentRes.checkOut || checkInStr;
        const d1 = new Date(`${checkInStr}T00:00:00`);
        const d2 = new Date(`${checkOutStr}T00:00:00`);
        const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 3600 * 24)));
        const nightsCount = Math.max(1, Number(currentRes.nights) || diffDays || 1);
        const nightlyRate = Number(currentRes.nightlyRateUSD || currentRes.ratePerNight || 49.00);

        let restoredFolioA = currentRes.originalFolioA || [];
        if (!restoredFolioA || restoredFolioA.length === 0) {
          restoredFolioA = [];
          let curDate = new Date(d1);
          for (let i = 0; i < nightsCount; i++) {
            const dateStr = curDate.toISOString().slice(0, 10);
            restoredFolioA.push({
              id: `chg_room_${dateStr}_${i}`,
              date: dateStr,
              category: 'Room Rate',
              description: `Room Tariff (${currentRes.roomType || 'Standard'} - Night ${i + 1} of ${nightsCount})`,
              amountUSD: nightlyRate,
              amount: nightlyRate,
              exclTax: Math.round(nightlyRate * 0.88 * 100) / 100,
              taxAmount: Math.round(nightlyRate * 0.12 * 100) / 100
            });
            curDate.setDate(curDate.getDate() + 1);
          }
        } else {
          restoredFolioA = restoredFolioA.map((item) => {
            if (item.category === 'Room Rate' || (item.description || "").toLowerCase().includes("room tariff")) {
              const r = Number(item.originalAmount || item.amountUSD || item.amount || nightlyRate);
              return {
                ...item,
                amountUSD: r > 0 ? r : nightlyRate,
                amount: r > 0 ? r : nightlyRate,
                exclTax: Math.round((r > 0 ? r : nightlyRate) * 0.88 * 100) / 100,
                taxAmount: Math.round((r > 0 ? r : nightlyRate) * 0.12 * 100) / 100
              };
            }
            return item;
          }).filter((item) => item.category !== 'Cancellation Fee' && item.category !== 'No-Show Fee');
        }

        const restoredStatus = currentRes.previousStatus || 'confirmed';
        currentRes.status = restoredStatus;
        currentRes.cancellationFee = 0;
        currentRes.noShowFee = 0;
        currentRes.folioA = restoredFolioA;

        setLocalFolio({
          folioA: restoredFolioA,
          folioB: currentRes.folioB || [],
          payments: currentRes.payments || []
        });

        setOverrideStatus(restoredStatus);
        if (updateBookingStatus) updateBookingStatus(resId, restoredStatus);

        try {
          const { updateBooking: apiUpdateBooking } = await import('../../services/api');
          await apiUpdateBooking(resId, {
            status: restoredStatus,
            folioA: restoredFolioA
          });
        } catch (e) {
          console.error("Error restoring booking via API:", e);
        }

        showToast?.(`Cancellation reversed & booking reopened for ${guestName}`);
        window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
        window.dispatchEvent(new CustomEvent('pms_rooms_updated'));
      }
    });
  };

  // Security Deposit Handlers
  const handleOpenEditDeposit = (dep) => {
    setActiveDepositItem(dep);
    setEditDepositAmount(dep.amount || '500');
    setEditDepositMode(dep.mode || 'Cash');
    setShowEditDepositModal(true);
  };

  const handleOpenApplyDeposit = (dep) => {
    setActiveDepositItem(dep);
    setShowApplyDepositModal(true);
  };

  const handleOpenRefundDeposit = (dep) => {
    setActiveDepositItem(dep);
    setShowRefundDepositModal(true);
  };

  const updateLocalBookingCache = (resId, updateFn) => {
    if (typeof dataStore === "undefined") return;
    try {
      const keys = ['pms_bookings', 'hotelpms_bookings_v3', 'hotelpms_bookings_v1', 'hotelpms_bookings_v2'];
      for (const k of keys) {
        const raw = dataStore.getItem(k);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const idx = list.findIndex((b) => String(b.id || b.resCode) === String(resId));
            if (idx !== -1) {
              updateFn(list[idx]);
              dataStore.setItem(k, JSON.stringify(list));
            }
          }
        }
      }
    } catch (e) {
      console.error('Error updating local booking cache:', e);
    }
  };

  const handleConfirmEditDeposit = async (e) => {
    e.preventDefault();
    if (!activeDepositItem || !currentRes) return;
    const depId = activeDepositItem.id;
    const amountVal = Number(editDepositAmount);
    const updatedData = { depositId: depId, amount: amountVal, mode: editDepositMode };

    try {
      await updateDeposit(currentRes.id, updatedData);
    } catch (err) {
      console.error("API updateDeposit failed", err);
    }

    propsOnUpdateDeposit?.(currentRes, depId, updatedData);

    currentRes.depositAmount = amountVal;
    currentRes.depositMode = editDepositMode;
    if (Array.isArray(currentRes.deposits)) {
      const target = currentRes.deposits.find((d) => d.id === depId);
      if (target) {
        target.amount = amountVal;
        target.mode = editDepositMode;
      }
    }
    if (Array.isArray(currentRes.securityDeposits)) {
      const target = currentRes.securityDeposits.find((d) => d.id === depId);
      if (target) {
        target.amount = amountVal;
        target.mode = editDepositMode;
      }
    }

    updateLocalBookingCache(currentRes.id, (b) => {
      b.depositAmount = amountVal;
      b.depositMode = editDepositMode;
      if (Array.isArray(b.deposits)) {
        const t = b.deposits.find((d) => d.id === depId);
        if (t) { t.amount = amountVal; t.mode = editDepositMode; }
      }
      if (Array.isArray(b.securityDeposits)) {
        const t = b.securityDeposits.find((d) => d.id === depId);
        if (t) { t.amount = amountVal; t.mode = editDepositMode; }
      }
    });

    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    recordAuditLog(
      'Security Deposit Edited',
      `Updated Security Deposit (ID: ${depId}) to $${editDepositAmount} (${editDepositMode})`
    );
    showToast?.(`Security deposit updated to $${editDepositAmount}`);
    setShowEditDepositModal(false);
  };

  const handleConfirmApplyDeposit = async (e) => {
    e.preventDefault();
    if (!activeDepositItem || !currentRes) return;
    const depId = activeDepositItem.id;
    const amountVal = Number(activeDepositItem.amount || activeDepositItem.amountUSD || 0);

    try {
      await applyDepositToFolio(currentRes.id, { amount: amountVal, note: 'Applied Security Deposit Credit' });
    } catch (err) {
      console.error("API applyDepositToFolio failed", err);
    }

    propsOnApplyDepositToFolio?.(currentRes, depId);

    const paymentEntry = {
      id: `pay_dep_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      method: `Deposit Credit (${activeDepositItem.mode || 'Cash'})`,
      mode: 'Deposit',
      description: `Applied Security Deposit Credit ($${amountVal.toFixed(2)})`,
      amountUSD: amountVal,
      amount: amountVal,
      date: getBusinessDate()
    };

    if (addFolioPayment) {
      addFolioPayment(activeResId, paymentEntry);
    }

    if (!Array.isArray(currentRes.payments)) currentRes.payments = [];
    currentRes.payments.push(paymentEntry);

    if (Array.isArray(currentRes.deposits)) {
      const target = currentRes.deposits.find((d) => d.id === depId || (Number(d.amountUSD || d.amount) === amountVal && String(d.status || 'held').toLowerCase() === 'held'));
      if (target) target.status = 'applied';
    }
    if (Array.isArray(currentRes.securityDeposits)) {
      const target = currentRes.securityDeposits.find((d) => d.id === depId || (Number(d.amountUSD || d.amount) === amountVal && String(d.status || 'held').toLowerCase() === 'held'));
      if (target) target.status = 'applied';
    }

    const activeHeldSum = (currentRes.deposits || [])
      .filter((d) => String(d.status || 'held').toLowerCase() === 'held')
      .reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);

    currentRes.depositAmount = activeHeldSum;
    currentRes.depositBalance = activeHeldSum;
    currentRes.securityDepositCollected = activeHeldSum > 0;
    currentRes.hasDeposit = activeHeldSum > 0;
    if (activeHeldSum === 0) currentRes.depositStatus = 'applied';

    updateLocalBookingCache(currentRes.id, (b) => {
      if (!Array.isArray(b.payments)) b.payments = [];
      b.payments.push(paymentEntry);
      
      let foundInB = false;
      if (Array.isArray(b.deposits)) {
        const t = b.deposits.find((d) => (d.id === depId || Number(d.amountUSD || d.amount) === amountVal) && String(d.status || 'held').toLowerCase() === 'held');
        if (t) { t.status = 'applied'; foundInB = true; }
      }
      if (Array.isArray(b.securityDeposits)) {
        const t = b.securityDeposits.find((d) => (d.id === depId || Number(d.amountUSD || d.amount) === amountVal) && String(d.status || 'held').toLowerCase() === 'held');
        if (t) t.status = 'applied';
      }

      const bActiveHeldSum = (b.deposits || [])
        .filter((d) => String(d.status || 'held').toLowerCase() === 'held')
        .reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);

      b.depositAmount = bActiveHeldSum;
      b.depositBalance = bActiveHeldSum;
      b.securityDepositCollected = bActiveHeldSum > 0;
      b.hasDeposit = bActiveHeldSum > 0;
      if (bActiveHeldSum === 0) b.depositStatus = 'applied';
    });

    setLocalFolio((prev) => {
      if (!prev) return prev;
      const prevPayments = Array.isArray(prev.payments) ? prev.payments : [];
      const prevDeposits = Array.isArray(prev.deposits) ? prev.deposits : (Array.isArray(currentRes?.deposits) ? currentRes.deposits : []);
      const updatedDeposits = prevDeposits.map((d) => {
        if (d.id === depId || (Number(d.amountUSD || d.amount) === amountVal && String(d.status || 'held').toLowerCase() === 'held')) {
          return { ...d, status: 'applied' };
        }
        return d;
      });
      return {
        ...prev,
        deposits: updatedDeposits,
        securityDeposits: updatedDeposits,
        depositStatus: activeHeldSum === 0 ? 'applied' : (prev.depositStatus || 'applied'),
        payments: [...prevPayments, paymentEntry]
      };
    });

    syncBookingUpdate(currentRes.id, {
      payments: currentRes.payments,
      deposits: currentRes.deposits,
      securityDeposits: currentRes.securityDeposits,
      depositAmount: activeHeldSum,
      depositBalance: activeHeldSum,
      securityDepositCollected: activeHeldSum > 0,
      hasDeposit: activeHeldSum > 0,
      depositStatus: activeHeldSum === 0 ? 'applied' : currentRes.depositStatus
    });

    setRefreshTick((prev) => prev + 1);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    window.dispatchEvent(new CustomEvent('pms_folio_updated'));
    recordAuditLog(
      'Security Deposit Applied to Folio',
      `Applied Security Deposit of $${amountVal.toFixed(2)} as direct credit settlement toward Folio balance`
    );
    showToast?.(`Applied $${amountVal.toFixed(2)} deposit credit to guest folio`);
    setShowApplyDepositModal(false);
  };

  const handleConfirmRefundDeposit = async (e) => {
    e.preventDefault();
    if (!activeDepositItem || !currentRes) return;
    const depId = activeDepositItem.id;
    const amountVal = Number(activeDepositItem.amount || activeDepositItem.amountUSD || 0);

    try {
      await refundDeposit(currentRes.id, { amount: amountVal, mode: activeDepositItem.mode || 'Cash' });
      await deleteDeposit(currentRes.id, depId);
    } catch (err) {
      console.error("API refundDeposit failed", err);
    }

    propsOnRefundDeposit?.(currentRes, depId);
    propsOnDeleteDeposit?.(currentRes, depId);

    if (!Array.isArray(currentRes.deposits)) currentRes.deposits = [];
    let foundInDep = false;
    currentRes.deposits = currentRes.deposits.map((d) => {
      if (!foundInDep && (d.id === depId || (Number(d.amountUSD || d.amount) === amountVal && String(d.status || 'held').toLowerCase() === 'held'))) {
        foundInDep = true;
        return { ...d, status: 'refunded' };
      }
      return d;
    });

    if (!Array.isArray(currentRes.securityDeposits)) currentRes.securityDeposits = [];
    let foundInSec = false;
    currentRes.securityDeposits = currentRes.securityDeposits.map((d) => {
      if (!foundInSec && (d.id === depId || (Number(d.amountUSD || d.amount) === amountVal && String(d.status || 'held').toLowerCase() === 'held'))) {
        foundInSec = true;
        return { ...d, status: 'refunded' };
      }
      return d;
    });

    if (!foundInDep) {
      currentRes.deposits.push({
        id: depId,
        amount: amountVal,
        amountUSD: amountVal,
        mode: activeDepositItem.mode || 'Cash',
        method: activeDepositItem.mode || 'Cash',
        status: 'refunded',
        date: activeDepositItem.date || getBusinessDate()
      });
    }

    const activeHeldSum = currentRes.deposits
      .filter((d) => String(d.status || 'held').toLowerCase() === 'held')
      .reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);

    currentRes.depositAmount = activeHeldSum;
    currentRes.depositBalance = activeHeldSum;
    currentRes.securityDepositCollected = activeHeldSum > 0;
    currentRes.hasDeposit = activeHeldSum > 0;
    if (activeHeldSum === 0) currentRes.depositStatus = 'refunded';

    updateLocalBookingCache(currentRes.id, (b) => {
      if (!Array.isArray(b.deposits)) b.deposits = [];
      let foundInB = false;
      b.deposits = b.deposits.map((d) => {
        if (!foundInB && (d.id === depId || (Number(d.amountUSD || d.amount) === amountVal && String(d.status || 'held').toLowerCase() === 'held'))) {
          foundInB = true;
          return { ...d, status: 'refunded' };
        }
        return d;
      });

      if (!Array.isArray(b.securityDeposits)) b.securityDeposits = [];
      let foundInBSec = false;
      b.securityDeposits = b.securityDeposits.map((d) => {
        if (!foundInBSec && (d.id === depId || (Number(d.amountUSD || d.amount) === amountVal && String(d.status || 'held').toLowerCase() === 'held'))) {
          foundInBSec = true;
          return { ...d, status: 'refunded' };
        }
        return d;
      });

      if (!foundInB) {
        b.deposits.push({
          id: depId,
          amount: amountVal,
          amountUSD: amountVal,
          mode: activeDepositItem.mode || 'Cash',
          method: activeDepositItem.mode || 'Cash',
          status: 'refunded',
          date: activeDepositItem.date || getBusinessDate()
        });
      }

      const bActiveHeldSum = b.deposits
        .filter((d) => String(d.status || 'held').toLowerCase() === 'held')
        .reduce((sum, d) => sum + (Number(d.amountUSD || d.amount) || 0), 0);

      b.depositAmount = bActiveHeldSum;
      b.depositBalance = bActiveHeldSum;
      b.securityDepositCollected = bActiveHeldSum > 0;
      b.hasDeposit = bActiveHeldSum > 0;
      if (bActiveHeldSum === 0) b.depositStatus = 'refunded';
    });

    setLocalFolio((prev) => {
      if (!prev) return prev;
      const prevDeposits = Array.isArray(prev.deposits) ? prev.deposits : (Array.isArray(currentRes?.deposits) ? currentRes.deposits : []);
      let foundInPrev = false;
      const updatedDeposits = prevDeposits.map((d) => {
        if (!foundInPrev && (d.id === depId || (Number(d.amountUSD || d.amount) === amountVal && String(d.status || 'held').toLowerCase() === 'held'))) {
          foundInPrev = true;
          return { ...d, status: 'refunded' };
        }
        return d;
      });
      if (!foundInPrev) {
        updatedDeposits.push({
          id: depId,
          amount: amountVal,
          amountUSD: amountVal,
          mode: activeDepositItem.mode || 'Cash',
          status: 'refunded',
          date: activeDepositItem.date || getBusinessDate()
        });
      }
      return {
        ...prev,
        deposits: updatedDeposits,
        securityDeposits: updatedDeposits,
        depositStatus: activeHeldSum === 0 ? 'refunded' : (prev.depositStatus || 'refunded')
      };
    });

    syncBookingUpdate(currentRes.id, {
      deposits: currentRes.deposits,
      securityDeposits: currentRes.securityDeposits,
      depositAmount: activeHeldSum,
      depositBalance: activeHeldSum,
      securityDepositCollected: activeHeldSum > 0,
      hasDeposit: activeHeldSum > 0,
      depositStatus: activeHeldSum === 0 ? 'refunded' : currentRes.depositStatus
    });

    setRefreshTick((prev) => prev + 1);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    window.dispatchEvent(new CustomEvent('pms_folio_updated'));
    recordAuditLog(
      'Security Deposit Refunded',
      `Refunded Security Deposit of $${amountVal.toFixed(2)} via ${activeDepositItem.mode || 'Cash'} to ${currentRes?.guestName || currentRes?.guest}`
    );
    showToast?.(`Refunded $${amountVal.toFixed(2)} deposit to guest`);
    setShowRefundDepositModal(false);
  };

  const handleSendEmail = (e) => {
    e.preventDefault();
    if (!emailRecipient) return;

    const hp = getHotelProfile?.() || {};
    const hotelName = hp.name || "PEA SOUP ANDERSEN'S INN";
    const subject = `Official Folio Receipt & Statement — ${hotelName} (Ref: ${currentRes?.id || ''})`;
    const body = `Dear ${currentRes?.guestName || currentRes?.guest || 'Guest'},\n\n` +
      `Thank you for staying with us at ${hotelName}.\n\n` +
      `Below is your complete itemized Folio Summary Statement:\n` +
      `--------------------------------------------------\n` +
      `Reservation Ref: ${currentRes?.id || 'N/A'}\n` +
      `Guest Name: ${currentRes?.guestName || currentRes?.guest || 'Guest'}\n` +
      `Assigned Room: Room ${currentRes?.roomNumber || currentRes?.room || 'N/A'} (${currentRes?.roomType || 'Standard'})\n` +
      `Check-In Date: ${currentRes?.checkIn || ''}\n` +
      `Check-Out Date: ${currentRes?.checkOut || ''}\n\n` +
      `FINANCIAL SUMMARY STATEMENT:\n` +
      `Total Charges: $${totalCharges.toFixed(2)}\n` +
      `Total Taxes & Fees: $${totalTaxes.toFixed(2)}\n` +
      `Grand Total: $${grandTotal.toFixed(2)}\n` +
      `Total Payments Collected: $${totalPayments.toFixed(2)}\n` +
      `Current Balance Due: $${balanceDue.toFixed(2)}\n` +
      `--------------------------------------------------\n\n` +
      `If you have any questions regarding your stay or receipt, please contact our Front Desk team.\n\n` +
      `Warm regards,\n` +
      `Front Desk Operations Team\n` +
      `${hotelName}`;

    const mailtoUrl = `mailto:${encodeURIComponent(emailRecipient.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');

    recordAuditLog(
      'Folio Receipt Emailed',
      `Emailed complete itemized folio statement to ${emailRecipient}`
    );
    showToast?.(`Folio invoice prepared for ${emailRecipient}`);
    setShowEmailModal(false);
  };

  // ----------------------------------------------------
  // IMPLEMENTATION OF 8 OPERATIONAL FEATURES
  // ----------------------------------------------------

  // 1. Check-In Handler
  const handleExecuteCheckIn = async () => {
    if (!currentRes) return;
    const resId = currentRes.id || currentRes._id;
    const roomNo = currentRes.roomNumber || currentRes.room;
    const checkInDate = currentRes.checkIn;
    const checkOutDate = currentRes.checkOut;

    try {
      const { getBookings, updateBooking: apiUpdateBooking, updateRoomHousekeeping: apiUpdateRoomHousekeeping } = await import('../../services/api');
      const allBks = await getBookings();
      const targetRoomStr = String(roomNo || "").trim();
      
      // Check if room is currently occupied by another active checked-in guest
      if (targetRoomStr && targetRoomStr.toLowerCase() !== "unassigned") {
        const activeOccupant = allBks.find(
          (b) =>
            String(b.id) !== String(resId) &&
            String(b.room || "").trim() === targetRoomStr &&
            (b.status === "checked-in" || b.status === "occupied") &&
            !b.isDeleted &&
            b.checkIn < checkOutDate &&
            b.checkOut > checkInDate
        );
        if (activeOccupant) {
          alert(`⚠️ Cannot check in guest ${currentRes.guestName || currentRes.guest}!\n\nRoom ${targetRoomStr} is currently occupied by active in-house guest (${activeOccupant.guest || activeOccupant.fullName || "Guest"}). Please check out the existing guest before checking in.`);
          return;
        }
      }

      setOverrideStatus('checked-in');
      currentRes.status = 'checked-in';
      if (propsBooking) propsBooking.status = 'checked-in';

      await apiUpdateBooking(resId, { status: 'checked-in' });
      if (roomNo && String(roomNo).toLowerCase() !== 'unassigned') {
        await apiUpdateRoomHousekeeping(roomNo, { status: 'occupied', housekeeping: 'Clean' });
      }
    } catch (err) {
      console.error("API Check-In error:", err);
      if (err.message && err.message.includes("occupied")) {
        alert(`⚠️ ${err.message}`);
        return;
      }
    }

    if (propsOnUpdateBooking) propsOnUpdateBooking(currentRes, { status: 'checked-in' }, "Check-In");
    if (propsOnUpdateStatus) propsOnUpdateStatus(resId, 'checked-in');
    if (updateBookingStatus) updateBookingStatus(resId, 'checked-in');
    if (updateBooking) updateBooking(resId, { status: 'checked-in' });

    recordAuditLog('Guest Checked In', `Checked in guest ${currentRes.guestName || currentRes.guest} into Room ${roomNo}`);
    showToast?.(`✓ Guest ${currentRes.guestName || currentRes.guest} checked in successfully!`);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    window.dispatchEvent(new CustomEvent('pms_rooms_updated'));
  };

  // 2. Checkout Handler
  const handleExecuteCheckout = async () => {
    if (!currentRes) return;
    const resId = currentRes.id || currentRes._id;
    const roomNo = currentRes.roomNumber || currentRes.room;

    if (balanceDue > 0.01) {
      alert(`⚠️ Cannot check out guest! Outstanding balance of ${formatUSD(balanceDue)} must be settled before check-out.`);
      handleOpenAddPaymentModal();
      return;
    }

    setOverrideStatus('checked-out');
    currentRes.status = 'checked-out';
    if (propsBooking) propsBooking.status = 'checked-out';

    try {
      const { updateBooking: apiUpdateBooking, updateRoomHousekeeping: apiUpdateRoomHousekeeping } = await import('../../services/api');
      await apiUpdateBooking(resId, { status: 'checked-out' });
      if (roomNo && String(roomNo).toLowerCase() !== 'unassigned') {
        await apiUpdateRoomHousekeeping(roomNo, { status: 'vacant', housekeeping: 'Dirty' });
      }
    } catch (err) {
      console.error("API Checkout error:", err);
    }

    if (propsOnUpdateBooking) propsOnUpdateBooking(currentRes, { status: 'checked-out' }, "Checkout");
    if (propsOnUpdateStatus) propsOnUpdateStatus(resId, 'checked-out');
    if (updateBookingStatus) updateBookingStatus(resId, 'checked-out');
    if (updateBooking) updateBooking(resId, { status: 'checked-out' });

    recordAuditLog('Guest Checked Out', `Checked out guest ${currentRes.guestName || currentRes.guest} from Room ${roomNo}`);
    showToast?.(`✓ Guest ${currentRes.guestName || currentRes.guest} checked out successfully!`);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    window.dispatchEvent(new CustomEvent('pms_rooms_updated'));
  };

  // 2b. Enquiry Handlers (Confirm & Delete/Cancel)
  const handleConfirmEnquiry = async () => {
    if (!currentRes) return;
    const resId = currentRes.id || currentRes._id;
    setOverrideStatus('confirmed');
    currentRes.status = 'confirmed';
    currentRes.isEnquiry = false;
    if (propsBooking) {
      propsBooking.status = 'confirmed';
      propsBooking.isEnquiry = false;
    }
    try {
      const { updateBooking: apiUpdateBooking } = await import('../../services/api');
      await apiUpdateBooking(resId, { status: 'confirmed', isEnquiry: false });
    } catch (err) {
      console.error("API Confirm Enquiry error:", err);
    }
    if (propsOnUpdateBooking) propsOnUpdateBooking(currentRes, { status: 'confirmed', isEnquiry: false }, "Confirm Enquiry");
    if (propsOnUpdateStatus) propsOnUpdateStatus(resId, 'confirmed');
    if (updateBookingStatus) updateBookingStatus(resId, 'confirmed');
    if (updateBooking) updateBooking(resId, { status: 'confirmed', isEnquiry: false });

    recordAuditLog('Enquiry Confirmed', `Confirmed enquiry for guest ${currentRes.guestName || currentRes.guest} into confirmed reservation`);
    showToast?.(`✅ Enquiry for ${currentRes.guestName || currentRes.guest} confirmed successfully!`);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  const handleCancelDeleteEnquiry = async () => {
    if (!currentRes) return;
    const resId = currentRes.id || currentRes._id;
    const ok = window.confirm(`Are you sure you want to delete/cancel enquiry hold for ${currentRes.guestName || currentRes.guest}?`);
    if (!ok) return;

    try {
      const { deleteBooking: apiDeleteBooking } = await import('../../services/api');
      await apiDeleteBooking(resId);
    } catch (err) {
      console.error("API Delete Enquiry error:", err);
    }

    recordAuditLog('Enquiry Deleted', `Deleted enquiry hold for guest ${currentRes.guestName || currentRes.guest}`);
    showToast?.(`🗑️ Enquiry for ${currentRes.guestName || currentRes.guest} deleted.`);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    if (onClose) onClose();
  };

  // 3. Modify Check-In Handler
  const handleOpenModifyCheckIn = () => {
    setModifyCheckInDate(currentRes?.checkIn || getBusinessDate());
    setShowModifyCheckInModal(true);
  };

  const handleSaveModifyCheckIn = (e) => {
    e.preventDefault();
    if (!modifyCheckInDate || !currentRes) return;
    if (modifyCheckInDate > currentRes.checkOut) {
      showToast?.('Check-In date cannot be after Check-Out date', 'warning');
      return;
    }

    const d1 = new Date(`${modifyCheckInDate}T00:00:00`);
    const d2 = new Date(`${currentRes.checkOut}T00:00:00`);
    const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 3600 * 24)));
    const ratePerNight = Number(currentRes.nightlyRateUSD || currentRes.ratePerNight || 149);
    const roomTypeLabel = currentRes.roomType || 'Standard';

    currentRes.checkIn = modifyCheckInDate;
    currentRes.nights = diffDays;
    currentRes.subtotal = diffDays * ratePerNight;

    const updatedFolioA = [];
    for (let i = 0; i < diffDays; i++) {
      const nObj = new Date(d1);
      nObj.setDate(nObj.getDate() + i);
      const yyyy = nObj.getFullYear();
      const mm = String(nObj.getMonth() + 1).padStart(2, "0");
      const dd = String(nObj.getDate()).padStart(2, "0");
      const nightDateStr = `${yyyy}-${mm}-${dd}`;

      const nightLabel = diffDays > 1 
        ? `Room Tariff (${currentRes.ratePlan ? currentRes.ratePlan + ' - ' : ''}${roomTypeLabel} - Night ${i + 1} of ${diffDays})`
        : `Room Tariff (${currentRes.ratePlan ? currentRes.ratePlan + ' - ' : ''}${roomTypeLabel})`;

      updatedFolioA.push({
        id: `chg_night_${i + 1}_${Date.now()}`,
        date: nightDateStr,
        category: 'Room Rate',
        description: nightLabel,
        amountUSD: ratePerNight,
        amount: ratePerNight,
        exclTax: Math.round(ratePerNight * 0.88 * 100) / 100,
        taxAmount: Math.round(ratePerNight * 0.12 * 100) / 100
      });
    }

    setLocalFolio((prev) => ({
      ...prev,
      folioA: [
        ...updatedFolioA,
        ...(prev?.folioA || []).filter(item => {
          const catLower = (item.category || '').toLowerCase();
          const descLower = (item.description || item.label || '').toLowerCase();
          return !catLower.includes('room rate') && !descLower.includes('room tariff');
        })
      ]
    }));

    if (updateBooking) {
      updateBooking(currentRes.id, { checkIn: modifyCheckInDate, nights: diffDays, subtotal: diffDays * ratePerNight });
    }
    if (propsOnUpdateBooking) {
      propsOnUpdateBooking(currentRes, { checkIn: modifyCheckInDate, nights: diffDays }, "Modify Check-In Date");
    }

    recordAuditLog('Arrival / Check-In Date Modified', `Altered Check-In date to ${modifyCheckInDate} (${diffDays} nights total)`);
    showToast?.(`Check-in date updated to ${modifyCheckInDate}`);
    setShowModifyCheckInModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  // 4. Modify Checkout Handler
  const handleOpenModifyCheckout = () => {
    setModifyCheckoutDate(currentRes?.checkOut || getBusinessDate());
    setShowModifyCheckoutModal(true);
  };

  const handleSaveModifyCheckout = (e) => {
    e.preventDefault();
    if (!modifyCheckoutDate || !currentRes) return;
    if (modifyCheckoutDate < currentRes.checkIn) {
      showToast?.('Checkout date cannot be before Check-In date', 'warning');
      return;
    }

    const d1 = new Date(`${currentRes.checkIn}T00:00:00`);
    const d2 = new Date(`${modifyCheckoutDate}T00:00:00`);
    const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 3600 * 24)));
    const ratePerNight = Number(currentRes.nightlyRateUSD || currentRes.ratePerNight || 149);
    const roomTypeLabel = currentRes.roomType || 'Standard';

    currentRes.checkOut = modifyCheckoutDate;
    currentRes.nights = diffDays;
    currentRes.subtotal = diffDays * ratePerNight;

    const updatedFolioA = [];
    for (let i = 0; i < diffDays; i++) {
      const nObj = new Date(d1);
      nObj.setDate(nObj.getDate() + i);
      const yyyy = nObj.getFullYear();
      const mm = String(nObj.getMonth() + 1).padStart(2, "0");
      const dd = String(nObj.getDate()).padStart(2, "0");
      const nightDateStr = `${yyyy}-${mm}-${dd}`;

      const nightLabel = diffDays > 1 
        ? `Room Tariff (${currentRes.ratePlan ? currentRes.ratePlan + ' - ' : ''}${roomTypeLabel} - Night ${i + 1} of ${diffDays})`
        : `Room Tariff (${currentRes.ratePlan ? currentRes.ratePlan + ' - ' : ''}${roomTypeLabel})`;

      updatedFolioA.push({
        id: `chg_night_${i + 1}_${Date.now()}`,
        date: nightDateStr,
        category: 'Room Rate',
        description: nightLabel,
        amountUSD: ratePerNight,
        amount: ratePerNight,
        exclTax: Math.round(ratePerNight * 0.88 * 100) / 100,
        taxAmount: Math.round(ratePerNight * 0.12 * 100) / 100
      });
    }

    setLocalFolio((prev) => ({
      ...prev,
      folioA: [
        ...updatedFolioA,
        ...(prev?.folioA || []).filter(item => {
          const catLower = (item.category || '').toLowerCase();
          const descLower = (item.description || item.label || '').toLowerCase();
          return !catLower.includes('room rate') && !descLower.includes('room tariff');
        })
      ]
    }));

    if (updateBooking) {
      updateBooking(currentRes.id, { checkOut: modifyCheckoutDate, nights: diffDays, subtotal: diffDays * ratePerNight });
    }
    if (propsOnUpdateBooking) {
      propsOnUpdateBooking(currentRes, { checkOut: modifyCheckoutDate, nights: diffDays }, "Modify Checkout Date");
    }

    recordAuditLog('Departure / Checkout Date Modified', `Altered Checkout date to ${modifyCheckoutDate} (${diffDays} nights total)`);
    showToast?.(`Checkout date updated to ${modifyCheckoutDate}`);
    setShowModifyCheckoutModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  const [roomSearchFilter, setRoomSearchFilter] = useState('');

  // Get 100% Truly Available Rooms for currentRes's stay period
  const getTrulyAvailableTargetRooms = () => {
    if (!currentRes) return [];
    const currentRoomNo = String(currentRes.roomNumber || currentRes.room || "").trim();
    const resCheckIn = currentRes.checkIn;
    const resCheckOut = currentRes.checkOut;
    const resId = String(currentRes.id || currentRes._id);

    const allRooms = (propsRooms && propsRooms.length > 0 ? propsRooms : (pms?.rooms || []));
    const allBks = pmsReservations || [];

    return allRooms.filter((r) => {
      const roomNoStr = String(r.no || r.number || r.id || "").trim();
      
      // 1. Exclude the current room
      if (roomNoStr === currentRoomNo) return false;

      // 2. Exclude out-of-order or maintenance rooms
      const rmStatus = String(r.status || "").toLowerCase();
      if (rmStatus.includes("order") || rmStatus.includes("service") || rmStatus.includes("maintenance")) return false;

      // 3. Exclude rooms that have ANY active/confirmed/checked-in booking for overlapping stay dates
      const hasConflict = allBks.some((b) => {
        if (!b || String(b.id) === resId || b.status === "cancelled" || b.status === "deleted" || b.isDeleted) return false;
        const bRoom = String(b.room || b.roomNumber || "").trim();
        if (bRoom !== roomNoStr) return false;
        
        // Date overlap check: b.checkIn < resCheckOut && b.checkOut > resCheckIn
        return (b.checkIn < resCheckOut && b.checkOut > resCheckIn);
      });

      return !hasConflict;
    });
  };

  // Get Display Folio Items (Detail vs Master Ledger Mode)
  const getDisplayFolioItems = () => {
    const rawItems = currentFolio.folioA || [];

    if (activeFolioTab === 'folioA_master') {
      const roomRateItems = rawItems.filter(item => {
        const catLower = (item.category || '').toLowerCase();
        const descLower = (item.description || item.label || '').toLowerCase();
        return catLower === 'room rate' || descLower.includes('room tariff') || descLower.includes('room rate');
      });
      const extraChargeItems = rawItems.filter(item => {
        const catLower = (item.category || '').toLowerCase();
        const descLower = (item.description || item.label || '').toLowerCase();
        return !(catLower === 'room rate' || descLower.includes('room tariff') || descLower.includes('room rate'));
      });

      if (roomRateItems.length > 0) {
        const sumTotal = roomRateItems.reduce((acc, it) => acc + Number(it.amountUSD || it.amount || 0), 0);
        const sumTax = roomRateItems.reduce((acc, it) => acc + Number(it.taxAmount ?? ((Number(it.amountUSD || it.amount || 0)) * 0.12)), 0);
        const sumExcl = roomRateItems.reduce((acc, it) => acc + Number(it.exclTax ?? ((Number(it.amountUSD || it.amount || 0)) - (it.taxAmount ?? ((Number(it.amountUSD || it.amount || 0)) * 0.12)))), 0);
        const nightlyRate = Number(currentRes?.nightlyRateUSD || currentRes?.ratePerNight || (roomRateItems[0] ? Number(roomRateItems[0].amountUSD || roomRateItems[0].amount || 0) : 149));
        const roomCategory = currentRes?.roomType || 'Standard Room';

        const masterRoomLine = {
          id: 'master_room_rate_consolidated',
          date: currentRes?.checkIn || roomRateItems[0]?.date || getBusinessDate(),
          category: 'Room Rate',
          description: `Master Room Tariff (${roomCategory} - ${roomRateItems.length} Night${roomRateItems.length > 1 ? 's' : ''} @ ${formatUSD(nightlyRate)}/night)`,
          exclTax: sumExcl,
          taxAmount: sumTax,
          amountUSD: sumTotal,
          amount: sumTotal,
          isMasterConsolidated: true
        };

        return [masterRoomLine, ...extraChargeItems];
      }

      return extraChargeItems;
    }

    // Default: Detail view (folioA or folioA_detail)
    return rawItems;
  };

  // 5. Room Move Handler
  const handleOpenRoomMove = () => {
    setRoomSearchFilter('');
    const availableRoomList = getTrulyAvailableTargetRooms();
    const defaultTarget = availableRoomList[0] ? String(availableRoomList[0].no || availableRoomList[0].number || availableRoomList[0].id) : '';
    setTargetMoveRoom(defaultTarget);
    setMoveRoomRate(String(currentRes?.nightlyRateUSD || currentRes?.ratePerNight || 149));
    setShowRoomMoveModal(true);
  };

  const handleSaveRoomMove = async (e) => {
    e.preventDefault();
    if (!targetMoveRoom || !currentRes) return;
    const oldRoom = currentRes.roomNumber || currentRes.room;
    const newRateUSD = parseFloat(moveRoomRate) || Number(currentRes.nightlyRateUSD || currentRes.ratePerNight || 149);

    try {
      const { updateBooking: apiUpdateBooking, updateRoomHousekeeping: apiUpdateRoomHousekeeping } = await import('../../services/api');
      await apiUpdateBooking(currentRes.id, { room: targetMoveRoom, roomNumber: targetMoveRoom, nightlyRateUSD: newRateUSD, ratePerNight: newRateUSD });
      if (oldRoom && String(oldRoom).toLowerCase() !== 'unassigned') {
        await apiUpdateRoomHousekeeping(oldRoom, { status: 'vacant', housekeeping: 'Dirty' });
      }
      await apiUpdateRoomHousekeeping(targetMoveRoom, { status: 'occupied', housekeeping: 'Clean' });
    } catch (err) {
      console.error("API Room Move error:", err);
    }

    currentRes.room = targetMoveRoom;
    currentRes.roomNumber = targetMoveRoom;
    currentRes.nightlyRateUSD = newRateUSD;
    currentRes.ratePerNight = newRateUSD;

    if (updateBooking) {
      updateBooking(currentRes.id, { room: targetMoveRoom, roomNumber: targetMoveRoom, nightlyRateUSD: newRateUSD, ratePerNight: newRateUSD });
    }

    recordAuditLog('Room Move Executed', `Transferred guest from Room ${oldRoom} to Room ${targetMoveRoom} (Rate: $${newRateUSD}/night)`);
    showToast?.(`Guest transferred from Room ${oldRoom} to Room ${targetMoveRoom}`);
    setShowRoomMoveModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
    window.dispatchEvent(new CustomEvent('pms_rooms_updated'));
  };

  // 6. Split Room Handler
  const handleOpenSplitRoom = () => {
    if (!currentRes) return;
    const checkInStr = currentRes.checkIn || getBusinessDate();
    const checkOutStr = currentRes.checkOut || checkInStr;
    const d1 = new Date(`${checkInStr}T00:00:00`);
    const d2 = new Date(`${checkOutStr}T00:00:00`);
    const midTime = d1.getTime() + (d2.getTime() - d1.getTime()) / 2;
    const midDateObj = new Date(midTime);
    const yyyy = midDateObj.getFullYear();
    const mm = String(midDateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(midDateObj.getDate()).padStart(2, "0");

    setSplitDate(`${yyyy}-${mm}-${dd}`);
    setSplitGuestName(`${currentRes.guestName || currentRes.guest} (Split)`);
    setSplitRoomNumber(currentRes.roomNumber || currentRes.room || '101');
    setShowSplitRoomModal(true);
  };

  const handleSaveSplitRoom = async (e) => {
    e.preventDefault();
    if (!splitDate || !currentRes) return;

    const oldCheckout = currentRes.checkOut;
    const targetRoomNo = splitRoomNumber || currentRes.roomNumber || currentRes.room || '';
    const leg2GuestName = splitGuestName || `${currentRes.guestName || currentRes.guest || 'Guest'} (Split Leg 2)`;

    try {
      const { splitStayBooking } = await import('../../services/api');
      if (splitStayBooking) {
        await splitStayBooking(currentRes.id, {
          splitDate,
          targetRoom: targetRoomNo,
          splitRoomNumber: targetRoomNo,
          guestName: leg2GuestName,
          splitGuestName: leg2GuestName,
        });
      }
    } catch (err) {
      console.error("API Split Stay error:", err);
    }

    currentRes.checkOut = splitDate;

    if (updateBooking) {
      updateBooking(currentRes.id, { checkOut: splitDate });
    }

    recordAuditLog('Split Room Executed', `Split booking on ${splitDate}. Leg 1: Room ${currentRes.roomNumber || currentRes.room} (${currentRes.checkIn} to ${splitDate}), Leg 2: Room ${targetRoomNo} (${splitDate} to ${oldCheckout})`);
    showToast?.(`Reservation split successfully on ${splitDate}! Leg 2 assigned to Room ${targetRoomNo}.`);
    setShowSplitRoomModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  // 7. Edit Guest Profile Handler
  const handleOpenEditGuestProfile = () => {
    if (!currentRes) return;
    const cd = currentRes.cardDetails || {};
    setProfileName(currentRes.guestName || currentRes.guest || '');
    setProfilePhone(currentRes.phone || currentRes.phoneNumber || '');
    setProfileEmail(currentRes.email || currentRes.guestEmail || '');
    setProfileAddress(currentRes.address || '');
    setProfileIdType(currentRes.idType || 'Passport');
    setProfileIdNumber(currentRes.idNumber || '');
    setProfileCardName(currentRes.cardName || cd.cardName || currentRes.guestName || currentRes.guest || '');
    setProfileCardNumber(currentRes.cardNumber || cd.cardNumber || '');
    setProfileCardExpiry(currentRes.cardExpiry || cd.cardExpiry || '');
    setProfileCardCvv(currentRes.cardCvv || cd.cardCvv || '');
    setShowEditGuestProfileModal(true);
  };

  const handleSaveEditGuestProfile = async (e) => {
    e.preventDefault();
    if (!profileName || !currentRes) return;

    const profileData = {
      guestName: profileName,
      guest: profileName,
      name: profileName,
      phone: profilePhone,
      phoneNumber: profilePhone,
      email: profileEmail,
      guestEmail: profileEmail,
      address: profileAddress,
      idType: profileIdType,
      idNumber: profileIdNumber,
      cardName: profileCardName,
      cardNumber: profileCardNumber,
      cardExpiry: profileCardExpiry,
      cardCvv: profileCardCvv,
      cardDetails: {
        cardName: profileCardName,
        cardNumber: profileCardNumber,
        cardExpiry: profileCardExpiry,
        cardCvv: profileCardCvv
      }
    };

    Object.assign(currentRes, profileData);

    try {
      const { updateBooking: apiUpdateBooking } = await import('../../services/api');
      await apiUpdateBooking(currentRes.id, profileData);
    } catch (err) {
      console.error("API Guest Profile update error:", err);
    }

    if (updateBooking) {
      updateBooking(currentRes.id, profileData);
    }
    if (propsOnUpdateBooking) {
      propsOnUpdateBooking(currentRes, profileData, "Update Guest Profile");
    }

    recordAuditLog('Guest Profile & Card Updated', `Updated profile and credit card guarantee details for ${profileName}`);
    showToast?.(`Guest profile and credit card for ${profileName} updated successfully`);
    setShowEditGuestProfileModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  // 8. Modify Rate Plan Handler
  const handleOpenModifyRatePlan = () => {
    if (!currentRes) return;
    const configuredPlans = getRatePlans();
    const currentPlanName = currentRes.ratePlan || (configuredPlans.length > 0 ? configuredPlans[0].name : 'Daily Rate');
    const matchedPlan = configuredPlans.find(p => p.name === currentPlanName || p.code === currentPlanName);
    
    let defaultNights = currentRes.nights;
    if (!defaultNights || isNaN(defaultNights)) {
      defaultNights = getRatePlanNights(matchedPlan, currentPlanName);
    }

    setSelectedRatePlan(currentPlanName);
    setRatePlanNights(defaultNights);
    setRatePlanTariff(String(currentRes.nightlyRateUSD || currentRes.ratePerNight || (matchedPlan?.rate || 149)));
    setShowModifyRatePlanModal(true);
  };

  const handleSaveModifyRatePlan = async (e) => {
    e.preventDefault();
    if (!ratePlanTariff || !currentRes) return;
    const tariffVal = parseFloat(ratePlanTariff);
    if (isNaN(tariffVal) || tariffVal < 0) return;

    const nightsVal = Math.max(1, parseInt(ratePlanNights, 10) || 1);
    const newCheckOut = calculateCheckOutDate(currentRes.checkIn, nightsVal) || currentRes.checkOut;

    currentRes.ratePlan = selectedRatePlan;
    currentRes.nightlyRateUSD = tariffVal;
    currentRes.ratePerNight = tariffVal;
    currentRes.nights = nightsVal;
    if (newCheckOut) {
      currentRes.checkOut = newCheckOut;
    }

    const payload = { 
      ratePlan: selectedRatePlan, 
      nightlyRateUSD: tariffVal, 
      ratePerNight: tariffVal,
      nights: nightsVal,
      subtotal: nightsVal * tariffVal,
      ...(newCheckOut ? { checkOut: newCheckOut } : {})
    };

    try {
      const { updateBooking: apiUpdateBooking } = await import('../../services/api');
      await apiUpdateBooking(currentRes.id, payload);
    } catch (err) {
      console.error("API Rate Plan update error:", err);
    }

    if (updateBooking) {
      updateBooking(currentRes.id, payload);
    }

    if (propsOnUpdateBooking) {
      propsOnUpdateBooking(currentRes, payload, "Modify Rate Plan");
    }

    setLocalFolio((prev) => {
      const updatedFolioA = (prev?.folioA || []).map((item) => {
        const catLower = (item.category || '').toLowerCase();
        const descLower = (item.description || item.label || '').toLowerCase();
        if (catLower === 'room rate' || descLower.includes('room tariff')) {
          return {
            ...item,
            description: item.description.includes('Night')
              ? item.description.replace(/\(.*\)/, `(${selectedRatePlan} - ${currentRes.roomType || 'Standard'})`)
              : `Room Tariff (${selectedRatePlan} - ${currentRes.roomType || 'Standard'})`,
            amountUSD: tariffVal,
            amount: tariffVal,
            exclTax: Math.round(tariffVal * 0.88 * 100) / 100,
            taxAmount: Math.round(tariffVal * 0.12 * 100) / 100
          };
        }
        return item;
      });
      return { ...prev, folioA: updatedFolioA };
    });

    recordAuditLog('Rate Plan & Tariff Modified', `Updated Rate Plan to ${selectedRatePlan} (${nightsVal} Nights, Check-Out: ${newCheckOut}) with nightly tariff of $${tariffVal.toFixed(2)}`);
    showToast?.(`Rate plan updated to ${selectedRatePlan} (${nightsVal} ${nightsVal === 1 ? 'night' : 'nights'}, $${tariffVal.toFixed(2)}/night)`);
    setShowModifyRatePlanModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  // 8B. Modify Market Segment & Sub-Segment Handler
  const handleOpenModifySegmentModal = () => {
    const currentSeg = currentRes?.segment || currentRes?.marketSegment || 'DIRECT';
    const currentSub = currentRes?.subSegment || currentRes?.source || 'WALK-IN';
    setSelectedSegmentVal(currentSeg);
    setSelectedSubSegmentVal(currentSub);
    setShowModifySegmentModal(true);
  };

  const handleSaveMarketSegment = async (e) => {
    if (e) e.preventDefault();
    const resId = currentRes?.id;
    if (!resId) return;

    const patchData = {
      segment: selectedSegmentVal,
      marketSegment: selectedSegmentVal,
      subSegment: selectedSubSegmentVal,
      source: selectedSubSegmentVal,
      auditAction: 'Modify Market Segment',
      auditDetails: `Updated Market Segment to ${selectedSegmentVal} (${selectedSubSegmentVal})`
    };

    try {
      const { updateBooking: apiUpdateBooking } = await import('../../services/api');
      if (typeof apiUpdateBooking === 'function') {
        await apiUpdateBooking(resId, patchData);
      }
    } catch (err) {
      console.error('API updateBooking segment error:', err);
    }
    if (propsOnUpdateBooking) {
      propsOnUpdateBooking(resId, patchData);
    }
    if (updateBooking) {
      updateBooking(resId, patchData);
    }

    recordAuditLog(
      'Modify Market Segment',
      `Updated Market Segment to ${selectedSegmentVal} (Sub-Segment: ${selectedSubSegmentVal})`
    );

    if (showToast) showToast('Market Segment updated successfully!', 'success');
    setShowModifySegmentModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  // 9. Apply Discount Handler
  const handleOpenApplyDiscount = () => {
    setDiscountType('percentage');
    setDiscountValue('');
    setCustomDiscountReason('');
    setShowApplyDiscountModal(true);
  };

  const handleConfirmApplyDiscount = async (e) => {
    e.preventDefault();
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) return;

    const finalReason = customDiscountReason.trim() || 'Manager Approval';
    const grossSubtotal = totalCharges > 0 ? totalCharges : (currentFolio.folioA || []).reduce((acc, item) => acc + (Number(item.amountUSD || item.amount) || 0), 0);

    let discountAmt = 0;
    let label = '';

    if (discountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, val));
      discountAmt = Math.round((grossSubtotal * pct / 100) * 100) / 100;
      label = `Discount Applied (${pct}% - ${finalReason})`;
    } else {
      discountAmt = Math.round(val * 100) / 100;
      label = `Discount Applied ($${discountAmt.toFixed(2)} - ${finalReason})`;
    }

    if (discountAmt <= 0) return;

    const discountItem = {
      id: `dsc_${Date.now()}_${Math.random().toString().slice(-4)}`,
      date: activeBusinessDate || new Date().toISOString().slice(0, 10),
      category: 'Discount / Adjustment',
      description: label,
      amountUSD: -Math.abs(discountAmt),
      amount: -Math.abs(discountAmt),
      exclTax: -Math.abs(discountAmt),
      taxAmount: 0,
      taxPercent: 0,
      isDiscount: true
    };

    const currentFolioAList = localFolio?.folioA || currentRes?.folioA || [];
    const updatedFolioA = [...currentFolioAList, discountItem];
    const currentExtras = Array.isArray(currentRes?.extras) ? currentRes.extras : [];
    const updatedExtras = [...currentExtras, discountItem];

    setLocalFolio((prev) => ({
      ...prev,
      folioA: updatedFolioA
    }));

    if (currentRes?.id) {
      currentRes.folioA = updatedFolioA;
      currentRes.extras = updatedExtras;
      const newTotalDiscount = (currentRes.discountAmount || 0) + Math.abs(discountAmt);
      currentRes.discountAmount = newTotalDiscount;

      const dscDetails = `Applied ${discountType === 'percentage' ? val + '%' : '$' + val} discount (${formatUSD(discountAmt)} given) - Reason: ${finalReason}`;
      try {
        const { updateBooking: apiUpdateBooking } = await import('../../services/api');
        await apiUpdateBooking(currentRes.id, { 
          folioA: updatedFolioA, 
          extras: updatedExtras, 
          discountAmount: newTotalDiscount,
          auditAction: 'Apply Discount',
          auditDetails: dscDetails
        });
      } catch (err) {
        console.error("Failed to save discount to Atlas:", err);
      }
    }

    if (propsOnAddCharge) {
      propsOnAddCharge(currentRes, discountItem);
    }

    const dscDetails = `Applied ${discountType === 'percentage' ? val + '%' : '$' + val} discount (${formatUSD(discountAmt)} given) - Reason: ${finalReason}`;
    recordAuditLog('Apply Discount', dscDetails);
    showToast?.(`Applied ${formatUSD(discountAmt)} discount to folio`);
    setShowApplyDiscountModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  // 10. Tax Exemption Handlers
  const availableSystemTaxes = useMemo(() => {
    const configured = typeof getTaxRules === 'function' ? getTaxRules() : [];
    if (configured && Array.isArray(configured) && configured.length > 0) {
      return configured.filter((t) => t.status === 'Active' || t.status === 'active' || t.status === undefined);
    }
    if (taxRules && Array.isArray(taxRules) && taxRules.length > 0) {
      return taxRules.filter((t) => t.status === 'Active' || t.status === 'active' || t.status === undefined);
    }
    return [];
  }, [taxRules, refreshTick]);

  const handleOpenTaxExempt = () => {
    if (!currentRes) return;
    setTaxExemptScope(currentRes.exemptTaxScope || (currentRes.isTaxExempt ? 'all' : 'all'));
    setSelectedExemptTaxIds(Array.isArray(currentRes.exemptTaxIds) ? [...currentRes.exemptTaxIds] : []);
    setTaxExemptCertNo(currentRes.taxExemptCertNumber || '');
    setTaxExemptReason(currentRes.taxExemptReason || 'Government Official');
    setCustomTaxExemptReason('');
    setShowTaxExemptModal(true);
  };

  const handleToggleExemptTaxId = (taxId) => {
    setSelectedExemptTaxIds((prev) =>
      prev.includes(taxId) ? prev.filter((id) => id !== taxId) : [...prev, taxId]
    );
  };

  const handleSaveTaxExempt = async (e) => {
    e.preventDefault();
    if (!currentRes) return;

    const finalReason = taxExemptReason === 'Other' ? (customTaxExemptReason || 'Custom Exemption') : taxExemptReason;
    const isExempt = taxExemptScope === 'all' || selectedExemptTaxIds.length > 0;

    const updatedPatch = {
      isTaxExempt: isExempt,
      taxExempt: isExempt,
      exemptTaxScope: taxExemptScope,
      exemptTaxIds: taxExemptScope === 'all' ? [] : selectedExemptTaxIds,
      taxExemptCertNumber: taxExemptCertNo,
      taxExemptReason: finalReason
    };

    Object.assign(currentRes, updatedPatch);

    try {
      const { updateBooking: apiUpdateBooking } = await import('../../services/api');
      await apiUpdateBooking(currentRes.id, updatedPatch);
    } catch (err) {
      console.error("API Tax Exempt update error:", err);
    }

    if (updateBooking) {
      updateBooking(currentRes.id, updatedPatch);
    }
    if (propsOnUpdateBooking) {
      propsOnUpdateBooking(currentRes, updatedPatch, "Update Tax Exemption");
    }

    const totalActivePct = availableSystemTaxes.reduce((sum, t) => {
      if (taxExemptScope === 'all') return sum;
      if (selectedExemptTaxIds.includes(t.id) || selectedExemptTaxIds.includes(t.name)) return sum;
      return sum + (Number(t.percent || t.rate) || 0);
    }, 0);

    const effectiveTaxRatePct = isExempt ? (taxExemptScope === 'all' ? 0 : totalActivePct) : 12;

    setLocalFolio((prev) => {
      const updatedFolioA = (prev?.folioA || []).map((item) => {
        if (item.isDiscount) return item;
        const rateUSD = Number(item.amountUSD || item.amount || 0);
        const newTaxAmt = Math.round(rateUSD * (effectiveTaxRatePct / 100) * 100) / 100;
        const newExclTax = Math.round((rateUSD - newTaxAmt) * 100) / 100;
        return {
          ...item,
          taxPercent: effectiveTaxRatePct,
          taxAmount: newTaxAmt,
          exclTax: newExclTax
        };
      });
      return { ...prev, folioA: updatedFolioA };
    });

    const scopeText = taxExemptScope === 'all' 
      ? 'All Taxes (100% Tax Exempt)' 
      : `Selective Taxes (${selectedExemptTaxIds.length} tax rules exempted)`;

    recordAuditLog('Tax Exemption Updated', `Set tax exemption status to: ${scopeText} - Certificate #: ${taxExemptCertNo || 'N/A'} (${finalReason})`);
    showToast?.(`Tax Exemption updated: ${scopeText}`);
    setShowTaxExemptModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  const handleClearTaxExempt = async () => {
    if (!currentRes) return;
    const resetPatch = {
      isTaxExempt: false,
      taxExempt: false,
      exemptTaxScope: 'none',
      exemptTaxIds: [],
      taxExemptCertNumber: '',
      taxExemptReason: ''
    };

    Object.assign(currentRes, resetPatch);

    try {
      const { updateBooking: apiUpdateBooking } = await import('../../services/api');
      await apiUpdateBooking(currentRes.id, resetPatch);
    } catch (err) {
      console.error("API Tax Exempt clear error:", err);
    }

    if (updateBooking) updateBooking(currentRes.id, resetPatch);
    if (propsOnUpdateBooking) propsOnUpdateBooking(currentRes, resetPatch, "Remove Tax Exemption");

    setLocalFolio((prev) => {
      const updatedFolioA = (prev?.folioA || []).map((item) => {
        if (item.isDiscount) return item;
        const rateUSD = Number(item.amountUSD || item.amount || 0);
        const newTaxAmt = Math.round(rateUSD * 0.12 * 100) / 100;
        const newExclTax = Math.round((rateUSD - newTaxAmt) * 100) / 100;
        return {
          ...item,
          taxPercent: 12,
          taxAmount: newTaxAmt,
          exclTax: newExclTax
        };
      });
      return { ...prev, folioA: updatedFolioA };
    });

    recordAuditLog('Tax Exemption Removed', 'Cleared tax exemption; standard tax rules restored.');
    showToast?.('Tax exemption removed');
    setShowTaxExemptModal(false);
    window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
  };

  const rawDepositsList = (Array.isArray(currentRes?.deposits) && currentRes.deposits.length > 0
    ? currentRes.deposits
    : Array.isArray(currentRes?.securityDeposits) && currentRes.securityDeposits.length > 0
    ? currentRes.securityDeposits
    : []
  ).filter((dep) => {
    if (!dep) return false;
    return Number(dep.amountUSD || dep.amount || 0) > 0;
  });

  const depMap = new Map();
  rawDepositsList.forEach((dep) => {
    if (!dep) return;
    const st = String(dep.status || 'held').toLowerCase();
    const isAlreadyApplied = st === 'applied';
    const isAlreadyRefunded = st === 'refunded';

    const amtVal = Number(dep.amountUSD || dep.amount || 0);
    const dateVal = String(dep.date || '').slice(0, 10);
    const modeVal = String(dep.mode || 'Cash').toLowerCase();
    const depKey = dep.id ? String(dep.id) : `dep_${dateVal}_${amtVal}_${modeVal}_${st}`;
    if (!depMap.has(depKey)) {
      depMap.set(depKey, {
        ...dep,
        status: st,
        amount: amtVal,
        amountUSD: amtVal
      });
    }
  });

  const mergedDeposits = Array.from(depMap.values());
  if (mergedDeposits.length === 0 && Number(currentRes?.depositAmount || currentRes?.depositBalance || 0) > 0) {
    const mainSt = String(currentRes?.depositStatus || 'held').toLowerCase();
    mergedDeposits.push({
      id: `dep_default_${currentRes?.id || 'res'}`,
      amount: Number(currentRes?.depositAmount || currentRes?.depositBalance || 50),
      mode: currentRes?.depositMethod || currentRes?.depositMode || 'Cash',
      status: mainSt,
      date: currentRes?.checkIn || getBusinessDate()
    });
  }

  const [overrideStatus, setOverrideStatus] = useState(null);
  useEffect(() => {
    setOverrideStatus(null);
  }, [currentRes?.id]);

  const currentStatus = (overrideStatus || (currentRes?.isEnquiry || currentRes?.status === 'enquiry' ? 'enquiry' : currentRes?.status) || 'confirmed').toLowerCase();

  const normalizeDateStr = (d) => {
    if (!d) return '';
    if (typeof d === 'string') return d.slice(0, 10);
    try {
      return new Date(d).toISOString().slice(0, 10);
    } catch {
      return String(d).slice(0, 10);
    }
  };

  const activeBusinessDate = normalizeDateStr(getBusinessDate());
  const resCheckInDate = normalizeDateStr(currentRes?.checkIn);
  const resCheckOutDate = normalizeDateStr(currentRes?.checkOut);

  const isArrivalDate = Boolean(resCheckInDate && activeBusinessDate && resCheckInDate === activeBusinessDate);
  const isCheckoutDate = Boolean(resCheckOutDate && activeBusinessDate && resCheckOutDate === activeBusinessDate);

  return (
    <div className="folio-view">
      <div className="folio-header" style={{ marginBottom: "8px" }}>
        <div>
          <h2 style={{ fontSize: "16.5px", fontWeight: "800", color: "#0f172a", margin: 0, padding: 0 }}>Guest Folio &amp; Financial Ledger</h2>
        </div>
      </div>

      {currentRes ? (
        <>
          {/* Guest Summary Card & Quick Action Controls */}
          <div className="card glassmorphism guest-folio-summary">
            <div className="guest-summary-info">
              <div className="guest-name-badge">
                <h3>{currentRes.guestName || currentRes.guest}</h3>
                <span className="res-code">{currentRes.resCode || currentRes.id}</span>
                <span className={`badge ${currentStatus === 'checked-in' ? 'badge-success' : currentStatus === 'checked-out' ? 'badge-secondary' : 'badge-gold'}`} style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '800' }}>
                  {currentStatus.toUpperCase()}
                </span>
                {currentRes.isTaxExempt && <span className="badge badge-gold">Tax Exempt</span>}
              </div>
              
              <div className="guest-meta-pills">
                <span>Room {currentRes.roomNumber || currentRes.room} ({currentRes.roomType || 'Standard'})</span>
                {(currentStatus === 'cancelled' || currentStatus === 'no-show') ? (
                  <>
                    <span style={{ padding: '3px 9px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>In: {formatDate(currentRes.checkIn)}</span>
                    <span style={{ padding: '3px 9px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>Out: {formatDate(currentRes.checkOut)}</span>
                  </>
                ) : (
                  <>
                    <span 
                      style={{ background: '#f0f9ff', color: '#0284c7', padding: '3px 9px', borderRadius: '6px', border: '1px solid #bae6fd', fontWeight: '700', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Calendar size={12} /> In: {formatDate(currentRes.checkIn)}
                    </span>
                    <span 
                      style={{ background: '#f0f9ff', color: '#0284c7', padding: '3px 9px', borderRadius: '6px', border: '1px solid #bae6fd', fontWeight: '700', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Calendar size={12} /> Out: {formatDate(currentRes.checkOut)}
                    </span>
                  </>
                )}
                <span>Nightly Rate: <strong>{formatUSD(isVirtualStay ? 0 : (currentRes.nightlyRateUSD || currentRes.ratePerNight || 0))}</strong></span>
                <span>Segment: <strong>{currentRes.segment || currentRes.marketSegment || 'DIRECT'}</strong> ({currentRes.subSegment || currentRes.source || 'WALK-IN'})</span>
                {currentStatus === 'confirmed' && currentRes.room && String(currentRes.room).toLowerCase() !== 'unassigned' && (
                  <button 
                    type="button" 
                    className="btn btn-sm btn-secondary" 
                    onClick={handleUnassignRoom} 
                    style={{ padding: '4px 10px', fontSize: '11.5px', color: '#d97706', borderColor: '#fde68a', cursor: 'pointer' }}
                    title="Unassign Room Assignment"
                  >
                    🔓 Unassign Room
                  </button>
                )}
              </div>

              {/* Quick Action Controls Organized into Professional Grouped Control Bars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap', background: '#f8fafc', padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                {/* 1. Main Lifecycle Status Action Button */}
                {currentStatus === 'enquiry' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-emerald"
                      onClick={handleConfirmEnquiry}
                      style={{ padding: '6px 16px', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(16,185,129,0.3)' }}
                      title="Confirm this Enquiry reservation"
                    >
                      <CheckCircle2 size={15} /> ✅ Confirm Reservation
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => { setModifyCheckInDate(currentRes.checkIn || ''); setShowModifyCheckInModal(true); }}
                      style={{ padding: '6px 14px', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      title="Modify Enquiry Arrival & Departure Dates"
                    >
                      <Calendar size={14} /> 📅 Modify Stay Dates
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={handleCancelDeleteEnquiry}
                      style={{ padding: '6px 14px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      title="Cancel / Delete Enquiry"
                    >
                      <Trash2 size={14} /> 🗑️ Delete Enquiry
                    </button>
                  </>
                )}

                {currentStatus === 'confirmed' && (
                  isArrivalDate ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-emerald"
                      onClick={handleExecuteCheckIn}
                      style={{ padding: '6px 16px', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(16,185,129,0.3)' }}
                      title="Check In Guest (Available on arrival date)"
                    >
                      <LogIn size={15} /> Check In Guest
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled
                      style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '700', opacity: 0.65, cursor: 'not-allowed', background: '#e2e8f0', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      title={`Check In available exclusively on arrival date (${currentRes?.checkIn || 'N/A'})`}
                    >
                      <LogIn size={14} /> Check In (Arrival: {formatDate(currentRes?.checkIn)})
                    </button>
                  )
                )}

                {currentStatus === 'checked-in' && (
                  isCheckoutDate ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleExecuteCheckout}
                      style={{ padding: '6px 16px', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}
                      title="Checkout Guest (Available on checkout date)"
                    >
                      <LogOut size={15} /> Checkout Guest
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled
                      style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '700', opacity: 0.65, cursor: 'not-allowed', background: '#e2e8f0', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      title={`Checkout available exclusively on departure date (${currentRes?.checkOut || 'N/A'})`}
                    >
                      <LogOut size={14} /> Checkout (Departure: {formatDate(currentRes?.checkOut)})
                    </button>
                  )
                )}

                {(currentStatus === 'cancelled' || currentStatus === 'no-show') && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleUndoCancellation}
                    style={{ padding: '6px 16px', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer', background: '#f1f5f9', color: '#0f172a', border: '1.5px solid #cbd5e1', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                    title="Undo Cancellation & Reopen Reservation"
                  >
                    <RotateCcw size={15} /> ↩ Undo Cancellation / Reopen Booking
                  </button>
                )}

                {/* Vertical Divider */}
                {(currentStatus === 'confirmed' || currentStatus === 'checked-in') && (
                  <div style={{ height: '22px', width: '1px', background: '#cbd5e1', margin: '0 2px' }} />
                )}

                {/* 2. Stay & Room Adjustments Segmented Pill Bar */}
                {(currentStatus === 'confirmed' || currentStatus === 'checked-in') && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#ffffff', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    {currentStatus === 'confirmed' && (
                      <button type="button" className="btn btn-sm" onClick={handleOpenModifyCheckIn} style={{ border: 'none', background: 'transparent', padding: '4px 10px', fontSize: '12px', fontWeight: '700', color: '#334155', cursor: 'pointer' }} title="Modify Arrival Date">
                        <Calendar size={13} /> Modify Check-In
                      </button>
                    )}
                    <button type="button" className="btn btn-sm" onClick={handleOpenModifyCheckout} style={{ border: 'none', background: 'transparent', padding: '4px 10px', fontSize: '12px', fontWeight: '700', color: '#334155', cursor: 'pointer' }} title="Modify Departure Date">
                      <Calendar size={13} /> Modify Checkout
                    </button>
                    <button type="button" className="btn btn-sm" onClick={handleOpenRoomMove} style={{ border: 'none', background: 'transparent', padding: '4px 10px', fontSize: '12px', fontWeight: '700', color: '#334155', cursor: 'pointer' }} title="Transfer Room Assignment">
                      <ArrowRightLeft size={13} /> Room Move
                    </button>
                    <button type="button" className="btn btn-sm" onClick={handleOpenSplitRoom} style={{ border: 'none', background: 'transparent', padding: '4px 10px', fontSize: '12px', fontWeight: '700', color: '#334155', cursor: 'pointer' }} title="Split Stay Reservation">
                      <Split size={13} /> Split Room
                    </button>
                  </div>
                )}

                <div style={{ height: '22px', width: '1px', background: '#cbd5e1', margin: '0 2px' }} />

                {/* 3. Guest Profile & Pricing Setup Group */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#ffffff', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <button type="button" className="btn btn-sm" onClick={handleOpenEditGuestProfile} style={{ border: 'none', background: 'transparent', padding: '4px 10px', fontSize: '12px', fontWeight: '700', color: '#0f172a', cursor: 'pointer' }}>
                    <User size={13} /> Edit Guest Profile
                  </button>
                  <button type="button" className="btn btn-sm" onClick={handleOpenModifySegmentModal} style={{ border: 'none', background: 'transparent', padding: '4px 10px', fontSize: '12px', fontWeight: '700', color: '#0f172a', cursor: 'pointer' }} title="Modify Market Segment & Business Channel">
                    <Layers size={13} /> Modify Market Segment
                  </button>
                  {(currentStatus === 'confirmed' || currentStatus === 'checked-in') && (
                    <>
                      <button type="button" className="btn btn-sm" onClick={handleOpenModifyRatePlan} style={{ border: 'none', background: 'transparent', padding: '4px 10px', fontSize: '12px', fontWeight: '700', color: '#0f172a', cursor: 'pointer' }}>
                        <Tag size={13} /> Modify Rate Plan
                      </button>
                      <button type="button" className="btn btn-sm" onClick={handleOpenTaxExempt} style={{ border: 'none', background: 'transparent', padding: '4px 10px', fontSize: '12px', fontWeight: '800', color: '#0284c7', cursor: 'pointer' }} title="Manage Tax Exemption Status">
                        <ShieldCheck size={13} /> 🛡️ Tax Exempt
                      </button>
                    </>
                  )}
                </div>

                {/* 4. Revert / Cancellation Exceptions */}
                {(currentStatus === 'confirmed' || currentStatus === 'checked-in' || currentStatus === 'checked-out') && (
                  <>
                    <div style={{ height: '22px', width: '1px', background: '#cbd5e1', margin: '0 2px' }} />
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {currentStatus === 'checked-in' && (
                        <button type="button" className="btn btn-sm btn-warning" onClick={() => handleUndoStatus('confirmed')} style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', borderRadius: '6px' }} title="Undo Check-In -> Revert to Confirmed">
                          <RotateCcw size={12} /> Undo Check-In
                        </button>
                      )}
                      {currentStatus === 'checked-out' && (
                        <button type="button" className="btn btn-sm btn-warning" onClick={() => handleUndoStatus('checked-in')} style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', borderRadius: '6px' }} title="Undo Check-Out -> Revert to Checked-In">
                          <RotateCcw size={12} /> Undo Check-Out
                        </button>
                      )}
                      {(currentStatus === 'confirmed' || currentStatus === 'checked-in') && (
                        <>
                          <button type="button" className="btn btn-sm" onClick={() => setShowCancelBookingModal(true)} style={{ padding: '4px 10px', fontSize: '11.5px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
                            <Ban size={12} /> Cancel
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => setShowNoShowModal(true)} style={{ padding: '4px 10px', fontSize: '11.5px', color: '#d97706', background: '#fffbebeb', border: '1px solid #fde68a', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
                            <AlertTriangle size={12} /> No-Show
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* CLEAN FINANCIAL SUMMARY STACK MATCHING SCREENSHOT 1 */}
            <div className="folio-financial-cards-clean" style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "420px", marginLeft: "auto", margin: "16px 0" }}>
              
              {/* 1. SUBTOTAL CARD */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <BedSingle size={18} style={{ color: "#334155" }} />
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>Subtotal</span>
                </div>
                <span style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>{formatUSD(grossSubtotal)}</span>
              </div>

              {/* 1B. APPLIED DISCOUNT CARD */}
              {totalDiscounts > 0 && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Tag size={18} style={{ color: "#dc2626" }} />
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#991b1b" }}>Applied Discount</span>
                  </div>
                  <span style={{ fontSize: "15px", fontWeight: "800", color: "#dc2626" }}>-{formatUSD(totalDiscounts)}</span>
                </div>
              )}

              {/* 1C. NET TAXABLE SUBTOTAL CARD */}
              {totalDiscounts > 0 && (
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#475569" }}>Net Taxable Subtotal</span>
                  <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>{formatUSD(taxableSubtotal)}</span>
                </div>
              )}

              {/* 2. TAXES AND FEES CARD (COLLAPSIBLE) */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
                <div
                  onClick={() => setShowTaxesCollapse((v) => !v)}
                  style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Percent size={18} style={{ color: "#334155" }} />
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
                      Taxes and Fees ({itemizedTaxLines.length})
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>{formatUSD(totalTaxes)}</span>
                    <ChevronDown size={16} style={{ color: "#64748b", transform: showTaxesCollapse ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }} />
                  </div>
                </div>

                {showTaxesCollapse && (
                  <div style={{ borderTop: "1px solid #e2e8f0", padding: "12px 16px 14px 16px", display: "flex", flexDirection: "column", gap: "10px", background: "#f8fafc" }}>
                    {itemizedTaxLines.map((tax, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13.5px" }}>
                        <span style={{ color: "#475569", fontWeight: "500" }}>{tax.name}</span>
                        <span style={{ fontWeight: "700", color: "#0f172a" }}>{formatUSD(tax.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. GRAND TOTAL, PAYMENTS & BALANCE DUE */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#475569" }}>
                  <span>Grand Total</span>
                  <span style={{ fontWeight: "700", color: "#0f172a" }}>{formatUSD(grandTotal)}</span>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#475569" }}>
                  <span>Payments</span>
                  <span style={{ fontWeight: "700", color: "#0f172a" }}>{formatUSD(totalPayments)}</span>
                </div>

                <div style={{ height: "1px", background: "#e2e8f0" }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "15px", fontWeight: "800", color: balanceDue < -0.01 ? "#dc2626" : "#0f172a" }}>
                    {balanceDue < -0.01 ? "Overpaid / Credit Balance" : "Balance due"}
                  </span>
                  <span style={{ fontSize: "17px", fontWeight: "900", color: balanceDue > 0.01 ? "#0f172a" : balanceDue < -0.01 ? "#dc2626" : "#059669" }}>
                    {balanceDue < -0.01 ? `-USD ${formatUSD(Math.abs(balanceDue)).replace("$", "")}` : `USD ${formatUSD(balanceDue).replace("$", "")}`}
                  </span>
                </div>
                {balanceDue < -0.01 && (
                  <button
                    type="button"
                    onClick={handleOpenFolioRefundModal}
                    style={{
                      marginTop: 4,
                      background: '#ffffff',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    💸 Issue Refund (-{formatUSD(Math.abs(balanceDue))})
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Action Toolbar & Sub-tabs */}
          <div className="folio-toolbar">
            <div className="folio-tabs">
              <button
                type="button"
                className={`folio-tab-btn ${activeFolioTab === 'folioA_detail' || activeFolioTab === 'folioA' ? 'active' : ''}`}
                onClick={() => setActiveFolioTab('folioA_detail')}
              >
                <Receipt size={16} /> Folio Detail Ledger — {formatUSD(grandTotal)}
              </button>
              <button
                type="button"
                className={`folio-tab-btn ${activeFolioTab === 'folioA_master' ? 'active' : ''}`}
                onClick={() => setActiveFolioTab('folioA_master')}
              >
                <FileText size={16} /> Folio Master Ledger — {formatUSD(grandTotal)}
              </button>
              <button
                type="button"
                className={`folio-tab-btn ${activeFolioTab === 'audit' ? 'active' : ''}`}
                onClick={() => setActiveFolioTab('audit')}
              >
                <History size={16} /> Audit Log &amp; Activity
              </button>
              <button
                type="button"
                className={`folio-tab-btn ${activeFolioTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveFolioTab('notes')}
              >
                <FileText size={16} /> 📝 Notes ({getReservationNotesList(currentRes).length})
              </button>
              <button
                type="button"
                className={`folio-tab-btn ${activeFolioTab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveFolioTab('documents')}
              >
                <Folder size={16} /> 📄 Documents ({getGuestDocumentsTotalCount(currentRes)})
              </button>
            </div>

            <div className="folio-actions" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Cluster 1: Primary Money Actions (Bold Colored CTAs) */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <button className="btn btn-emerald" onClick={handleOpenAddPaymentModal} style={{ background: '#15803d', color: '#ffffff', border: 'none', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px' }}>
                  <CreditCard size={14} /> 💳 Record Payment
                </button>
                <button className="btn btn-primary" onClick={handleOpenAddChargeModal} style={{ background: '#d3d3d3', color: '#0f172a', border: '1px solid #b8b8b8', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px' }}>
                  <PlusCircle size={14} /> + Add Extra Charge
                </button>
                {balanceDue < -0.01 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleOpenFolioRefundModal}
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      cursor: 'pointer'
                    }}
                  >
                    <DollarSign size={14} /> Issue Refund ({formatUSD(Math.abs(balanceDue))})
                  </button>
                )}
              </div>

              <div style={{ height: '18px', width: '1px', background: '#cbd5e1', margin: '0 2px' }} />

              {/* Cluster 2: Adjustments & Ledger Segmented Pill Bar */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#ffffff', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <button className="btn btn-sm" onClick={handleOpenApplyDiscount} style={{ border: 'none', background: 'transparent', padding: '3px 8px', fontSize: '11px', fontWeight: '700', color: '#0f172a', cursor: 'pointer' }} title="Apply Percentage (%) or Fixed ($) Discount">
                  <Tag size={13} /> Apply Discount
                </button>
                <button className="btn btn-sm" onClick={() => setShowTransferModal(true)} style={{ border: 'none', background: 'transparent', padding: '3px 8px', fontSize: '11px', fontWeight: '700', color: '#334155', cursor: 'pointer' }} title="Transfer Balance To Company or Room">
                  <ArrowRightLeft size={13} /> Transfer Balance
                </button>
              </div>

              <div style={{ height: '18px', width: '1px', background: '#cbd5e1', margin: '0 2px' }} />

              {/* Cluster 3: Receipts & Document Exports Group */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#ffffff', padding: '2px', borderRadius: 0, border: '1px solid #cbd5e1' }}>
                <button className="btn btn-sm" onClick={() => { setShowPrintOptionsModal(true); recordAuditLog('Print Invoice', 'Opened Print Invoice options & preview'); }} style={{ border: 'none', background: 'transparent', padding: '4px 10px', fontSize: '11px', fontWeight: '800', color: '#0f172a', cursor: 'pointer', borderRadius: 0 }}>
                  <Printer size={13} /> Print Invoice
                </button>
                <button className="btn btn-sm" onClick={() => { setShowEmailModal(true); recordAuditLog('Email Invoice', 'Opened Email Invoice dispatch dialog'); }} style={{ border: 'none', background: 'transparent', padding: '4px 10px', fontSize: '11px', fontWeight: '800', color: '#0f172a', cursor: 'pointer', borderRadius: 0 }}>
                  <Mail size={13} /> Email Invoice
                </button>
                <button className="btn btn-sm" onClick={() => { setShowPrintGRCModal(true); recordAuditLog('Print GRC', 'Generated Guest Registration Card (GRC) for printing'); }} style={{ border: 'none', background: 'transparent', padding: '3px 8px', fontSize: '11px', fontWeight: '700', color: '#0f172a', cursor: 'pointer' }} title="Print Guest Registration Card">
                  <FileCheck size={13} /> Print GRC
                </button>
                {currentStatus !== 'checked-in' && currentStatus !== 'checkedin' && currentStatus !== 'occupied' && currentStatus !== 'checked-out' && currentStatus !== 'checkedout' && (
                  <button className="btn btn-sm" onClick={() => { setShowSendSelfCheckInModal(true); recordAuditLog('Self Check-In Link', 'Opened Self Check-In link dispatch options'); }} style={{ border: 'none', background: '#f1f5f9', padding: '3px 8px', fontSize: '11px', fontWeight: '700', color: '#0f172a', borderRadius: '6px', cursor: 'pointer' }} title="Mobile Self Check-In Link">
                    <Smartphone size={13} /> Self Check-In Link
                  </button>
                )}
              </div>

              {/* Cluster 4: Far Right Danger Zone Action */}
              <div style={{ marginLeft: 'auto' }}>
                <button className="btn btn-sm" onClick={() => { setShowDeleteFolioModal(true); recordAuditLog('Delete Folio', 'Opened Delete Folio confirmation dialog'); }} style={{ color: '#dc2626', background: '#ffffff', border: '1px solid #fca5a5', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }} title="Option 1: Delete Folio Ledger">
                  <Trash2 size={13} /> Delete Folio
                </button>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="card glassmorphism">
            {activeFolioTab === 'notes' ? (
              <div className="notes-tab-content" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleOpenAddNote}
                    style={{ background: '#0284c7', color: '#ffffff', border: 'none', fontWeight: '700', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    + Add Note
                  </button>
                </div>

                {(() => {
                  const notesList = getReservationNotesList(currentRes);
                  if (notesList.length === 0) {
                    return (
                      <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: '10px', padding: '32px 20px', textAlign: 'center' }}>
                        <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>📝</span>
                        <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 14px 0' }}>
                          No notes added for this reservation yet.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleOpenAddNote}
                          style={{ background: '#0284c7', color: '#ffffff', border: 'none', fontWeight: '700', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px' }}
                        >
                          + Add Note
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#ffffff', overflow: 'hidden' }}>
                      {notesList.map((note, idx) => (
                        <div
                          key={note.id || `note_item_${idx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 18px',
                            borderBottom: idx === notesList.length - 1 ? 'none' : '1px solid #f1f5f9',
                            gap: '16px'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', lineHeight: '1.4', marginBottom: '4px', whiteSpace: 'pre-wrap' }}>
                              {note.text}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>
                              📅 {formatDateTime(note.createdAt || new Date().toISOString())} • 👤 {note.author || 'Front Desk'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditSingleNote(note)}
                              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', padding: '4px 8px' }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleNote(note.id)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', padding: '4px 8px' }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : activeFolioTab === 'documents' ? (
              <div className="documents-tab-content" style={{ padding: '24px' }}>
                {/* Section 1: Scanned Images */}
                <div style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🆔 1. Scanned Images (Identity Documents)
                      <span style={{ fontSize: '11.5px', background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                        {getGuestScannedImages(currentRes).length} Scans
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddScannedDocModal(true)}
                      style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Upload size={13} /> + Upload ID
                    </button>
                  </div>

                    {getGuestScannedImages(currentRes).length === 0 ? (
                      <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No scanned identity documents uploaded for this guest yet.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {getGuestScannedImages(currentRes).map((scanned) => (
                          <div key={scanned.id} style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ height: '160px', background: '#0f172a', position: 'relative', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setPreviewMediaItem(scanned)}>
                              <img src={scanned.url} alt={scanned.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(15,23,42,0.75)', color: '#ffffff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backdropFilter: 'blur(4px)' }}>
                                👁️ Click to View
                              </div>
                            </div>
                            <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                              <div>
                                <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
                                  {scanned.title}
                                </div>
                                <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                                  Document ID: <strong>{scanned.idNumber}</strong>
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                  Issued: {scanned.issueCountry} • Source: {scanned.source}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                <button
                                  type="button"
                                  onClick={() => setPreviewMediaItem(scanned)}
                                  style={{ flex: 1, background: '#f1f5f9', color: '#0f172a', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                >
                                  <Eye size={13} /> Preview
                                </button>
                                <a
                                  href={scanned.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  style={{ flex: 1, background: '#f1f5f9', color: '#0284c7', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textDecoration: 'none' }}
                                >
                                  <Download size={13} /> Save
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteScannedDoc(scanned.id)}
                                  style={{ background: '#fef2f2', color: '#dc2626', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                {/* Section 2: Captured Images */}
                <div style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📸 2. Captured Images (Camera &amp; Kiosk Captures)
                      <span style={{ fontSize: '11.5px', background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                        {getGuestCapturedImages(currentRes).length} Photos
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowFolioCameraModal(true)}
                      style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Camera size={13} /> + Capture Photo
                    </button>
                  </div>

                    {getGuestCapturedImages(currentRes).length === 0 ? (
                      <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No guest photo captures saved for this reservation yet.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                        {getGuestCapturedImages(currentRes).map((photo) => (
                          <div key={photo.id} style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ height: '170px', background: '#0f172a', position: 'relative', cursor: 'pointer' }} onClick={() => setPreviewMediaItem(photo)}>
                              <img src={photo.url} alt={photo.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(15,23,42,0.8)', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700' }}>
                                📷 {photo.source}
                              </div>
                            </div>
                            <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{photo.title}</div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                  Captured: {formatDateTime(photo.capturedAt)}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                                <button
                                  type="button"
                                  onClick={() => setPreviewMediaItem(photo)}
                                  style={{ flex: 1, background: '#f1f5f9', color: '#0f172a', border: 'none', padding: '5px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                  View
                                </button>
                                <a
                                  href={photo.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  style={{ flex: 1, background: '#f1f5f9', color: '#059669', border: 'none', padding: '5px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}
                                >
                                  Save
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCapturedPhoto(photo.id)}
                                  style={{ background: '#fef2f2', color: '#dc2626', border: 'none', padding: '5px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                {/* Section 3: Saved Credit Cards */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      💳 3. Saved Credit Cards (PCI-DSS Vault Storage)
                      <span style={{ fontSize: '11.5px', background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                        {getGuestSavedCards(currentRes).length} Cards
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddCardDocModal(true)}
                      style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <CreditCard size={13} /> + Add Card
                    </button>
                  </div>

                    {getGuestSavedCards(currentRes).length === 0 ? (
                      <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No saved credit cards on profile for this reservation.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                        {getGuestSavedCards(currentRes).map((card) => (
                          <div
                            key={card.id}
                            style={{
                              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                              color: '#ffffff',
                              borderRadius: '14px',
                              padding: '20px',
                              boxShadow: '0 4px 14px rgba(15,23,42,0.18)',
                              position: 'relative',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              height: '170px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                  {card.cardBrand || 'CREDIT CARD'}
                                </span>
                                {card.isPrimary && (
                                  <span style={{ marginLeft: '8px', background: '#38bdf8', color: '#0f172a', fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>
                                    PRIMARY
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                                💳
                              </span>
                            </div>

                            <div style={{ fontSize: '17px', fontWeight: '800', letterSpacing: '2px', color: '#f8fafc', margin: '12px 0' }}>
                              {card.cardMasked || `•••• •••• •••• ${String(card.cardNumber || '4242').slice(-4)}`}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                              <div>
                                <div style={{ fontSize: '9.5px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>CARDHOLDER NAME</div>
                                <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#ffffff', textTransform: 'uppercase' }}>
                                  {card.cardName || 'GUEST NAME'}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '9.5px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>EXPIRES</div>
                                <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#ffffff' }}>
                                  {card.cardExpiry || '12/28'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteCreditCardDoc(card.id)}
                                style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', padding: '4px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
              </div>
            ) : activeFolioTab === 'audit' ? (
              <div className="audit-log-tab-content" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1.5px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Audit Log &amp; Detailed Activity Trail</h3>
                  <span className="badge" style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '12px' }}>
                    {auditLogsList.length} Recorded Activity Entries
                  </span>
                </div>

                <div className="audit-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {auditLogsList.map((log) => {
                    const activeUserDisplay = (() => {
                      if (log.user && log.user !== 'Front Desk' && log.user !== 'Front Desk Staff' && log.user !== 'System Admin') return log.user;
                      try {
                        const raw = dataStore.getItem('pms_user');
                        if (raw) {
                          const u = JSON.parse(raw);
                          if (u.username) return u.username;
                          if (u.name) return u.name;
                        }
                      } catch (e) {}
                      return 'admin';
                    })();

                    return (
                      <div key={log.id} className="audit-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                              {log.action || 'System Event'}
                            </span>
                            <span style={{ fontSize: '13.5px', fontWeight: '400', color: '#334155' }}>{log.details || log.action}</span>
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: '400', color: '#64748b' }}>
                            {formatDateTime(log.createdAt || log.timestamp || new Date().toISOString())}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12.5px', color: '#64748b', fontWeight: '400' }}>
                          <span>User: <span style={{ color: '#475569', fontWeight: '400' }}>{activeUserDisplay}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="pms-table">
                  <thead>
                    <tr>
                      <th>Posting Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Excl. Tax ($)</th>
                      <th>Tax Amount ($)</th>
                      <th>Total Incl. Tax ($)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Render Security Deposits directly inside Folio Table */}
                    {mergedDeposits.filter((dep) => Number(dep.amount || dep.amountUSD || 0) > 0).map((dep, idx) => {
                      const depStatus = String(dep.status || 'held').toLowerCase();
                      const isApplied = depStatus === 'applied';
                      const isRefunded = depStatus === 'refunded';
                      const isHeld = !isApplied && !isRefunded;

                      return (
                        <tr key={dep.id || `dep_row_${dep.date}_${idx}`} style={{ background: isApplied ? '#f0fdf4' : isRefunded ? '#fef2f2' : '#f8fafc' }}>
                          <td>{formatDate(dep.date || new Date().toISOString())}</td>
                          <td>
                            <span className="category-pill bg-primary" style={{ background: isApplied ? '#16a34a' : isRefunded ? '#dc2626' : '#4f46e5', color: '#ffffff' }}>
                              Deposit
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong>Security Deposit ({dep.mode || 'Cash'})</strong>
                              {isHeld && (
                                <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                                  Held in Trust
                                </span>
                              )}
                              {isApplied && (
                                <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                                  ✓ Applied to Folio
                                </span>
                              )}
                              {isRefunded && (
                                <span style={{ fontSize: '11px', background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                                  💸 Refunded to Guest
                                </span>
                              )}
                            </div>
                          </td>
                          <td>$0.00</td>
                          <td>$0.00</td>
                          <td className={isApplied ? "text-emerald fw-bold" : isRefunded ? "text-danger fw-bold" : "text-emerald fw-bold"}>
                            {formatUSD(Number(dep.amount || 0))}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {isHeld ? (
                                <>
                                  <button type="button" className="btn btn-sm btn-secondary" style={{ padding: '4px 8px', fontSize: '11.5px', cursor: 'pointer' }} onClick={() => handleOpenEditDeposit(dep)}>✏️ Edit</button>
                                  <button type="button" className="btn btn-sm btn-emerald" style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }} onClick={() => handleOpenApplyDeposit(dep)}>💳 Apply Deposit to Folio</button>
                                  <button type="button" className="btn btn-sm btn-danger" style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '5px', padding: '4px 8px', fontSize: '11.5px', cursor: 'pointer' }} onClick={() => handleOpenRefundDeposit(dep)}>💸 Refund</button>
                                </>
                              ) : isApplied ? (
                                <span style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: '800' }}>✓ Applied to Folio Balance</span>
                              ) : (
                                <span style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: '800' }}>💸 Refunded to Guest</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {(activeFolioTab === 'folioA' || activeFolioTab === 'folioA_detail' || activeFolioTab === 'folioA_master') && (
                      getDisplayFolioItems().map((item) => {
                        const amt = Number(item.amountUSD || item.amount || 0);
                        const isDiscountLine = Boolean(
                          item.isDiscount || 
                          item.category === 'Discount / Adjustment' || 
                          (item.category || '').toLowerCase().includes('discount') || 
                          (item.description || '').toLowerCase().includes('discount') || 
                          amt < 0
                        );
                        const isExempt = Boolean(currentRes?.isTaxExempt || currentRes?.taxExempt);
                        const activeTaxPct = (isExempt || isDiscountLine) ? 0 : (typeof getActiveTaxPercent === 'function' ? getActiveTaxPercent() : 12);
                        const tax = (isExempt || isDiscountLine) ? 0 : (typeof item.taxAmount === 'number' && item.taxAmount >= 0 ? item.taxAmount : Math.round((amt * activeTaxPct / (100 + activeTaxPct)) * 100) / 100);
                        const excl = isDiscountLine ? amt : (amt - tax);
                        const catLower = (item.category || '').toLowerCase();
                        const descLower = (item.description || item.label || '').toLowerCase();
                        const isProtectedLine =
                          catLower === 'room rate' ||
                          catLower.includes('rate') ||
                          catLower.includes('cancellation') ||
                          catLower.includes('no-show') ||
                          catLower.includes('penalty') ||
                          descLower.includes('room tariff') ||
                          descLower.includes('room rate') ||
                          descLower.includes('cancellation fee') ||
                          descLower.includes('no-show fee') ||
                          descLower.includes('penalty') ||
                          item.isMasterConsolidated;

                        return (
                          <tr key={item.id} style={item.isMasterConsolidated ? { background: '#f8fafc', fontWeight: '600' } : {}}>
                            <td>{formatDate(item.date || new Date().toISOString())}</td>
                            <td>
                              <span className={`category-pill ${item.isMasterConsolidated ? 'bg-primary' : ''}`}>{item.category || 'Charge'}</span>
                            </td>
                            <td>
                              {item.isMasterConsolidated ? (
                                <strong style={{ color: '#0f172a' }}>{item.description || item.label}</strong>
                              ) : (
                                item.description || item.label
                              )}
                            </td>
                            <td>{formatUSD(excl)}</td>
                            <td>{formatUSD(tax)}</td>
                            <td className="text-emerald fw-bold">{formatUSD(amt)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {isProtectedLine ? (
                                  /* ROOM RATE / CANCELLATION / NO-SHOW / MASTER LINE ITEM: PENCIL EDIT BUTTON ONLY! CANNOT BE DELETED! */
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    style={{ color: '#0f172a', borderColor: '#cbd5e1', background: '#f1f5f9', padding: '4px 10px', fontSize: '11.5px', cursor: 'pointer', fontWeight: '700' }}
                                    title="Edit Fee / Rate Amount"
                                    onClick={() => handleOpenEditRoomRate(item)}
                                  >
                                    <Edit size={13} /> Edit Rate
                                  </button>
                                ) : (
                                  /* OTHER EXTRA INCIDENTAL CHARGES: DELETE BUTTON ALLOWED */
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                                    title="Delete Charge Item"
                                    onClick={() => handleDeleteChargeItem(item.id, String(activeFolioTab || '').includes('folioB') ? 'folioB' : 'folioA')}
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* PAYMENTS & CREDITS TABLE WITH DEDUPLICATION & ZERO-FILTER */}
                    {(activeFolioTab === 'folioA' || activeFolioTab === 'folioA_detail' || activeFolioTab === 'folioA_master' || activeFolioTab === 'payments') && (
                      (() => {
                        const rawPay = currentFolio.payments || [];
                        const seen = new Set();
                        const displayPayments = [];

                        rawPay.forEach((p) => {
                          if (!p) return;
                          const amt = Number(p.amountUSD || p.amount || 0);
                          if (amt === 0) return; // Skip $0.00 dummy deposit entries!

                          const descLower = (p.description || p.note || p.mode || p.method || '').toLowerCase();
                          const isDep = descLower.includes('deposit') || descLower.includes('security deposit');

                          if (isDep) {
                            const depKey = `dep_pay_${amt}`;
                            if (seen.has(depKey)) return;
                            seen.add(depKey);
                          }
                          displayPayments.push(p);
                        });

                        return displayPayments.map((p, pIdx) => {
                          const amt = Number(p.amountUSD || p.amount || 0);
                          const pMode = p.mode || p.method || p.paymentMethod || p.modeName || '';
                          const rawDesc = p.description || p.note || 'Payment Received';
                          const hasModeInDesc = pMode && rawDesc.toLowerCase().includes(pMode.toLowerCase());
                          const displayDesc = (pMode && !hasModeInDesc) ? `${rawDesc} (${pMode})` : rawDesc;

                          const modeStr = (pMode + ' ' + rawDesc).toLowerCase();
                          const isCardOrOnline = modeStr.includes('card') || modeStr.includes('stripe') || modeStr.includes('online') || modeStr.includes('credit') || modeStr.includes('debit') || modeStr.includes('pos');

                          return (
                            <tr key={p.id || `pay_${p.date}_${pIdx}`} style={{ background: '#f0fdf4' }}>
                              <td>{formatDate(p.date || new Date().toISOString())}</td>
                              <td>
                                <span className="category-pill bg-emerald" style={{ background: '#059669', color: '#ffffff' }}>Payment</span>
                              </td>
                              <td>
                                <div>
                                  <span>{displayDesc}</span>
                                  {p.reference && <div style={{ fontSize: '11px', color: '#64748b' }}>Ref: {p.reference}</div>}
                                </div>
                              </td>
                              <td>$0.00</td>
                              <td>$0.00</td>
                              <td className="text-emerald fw-bold">-{formatUSD(amt)}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => handleOpenPrintPaymentReceipt(p)}
                                    style={{ border: '1px solid #cbd5e1', background: '#ffffff', padding: '3px 8px', fontSize: '11px', fontWeight: '700', color: '#0f172a', borderRadius: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    title="Print Payment Receipt"
                                  >
                                    <Printer size={12} /> Print Receipt
                                  </button>


                                  {isCardOrOnline ? (
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      onClick={() => {
                                        setRefundAmountUSD(String(amt));
                                        setRefundReason(`Refund for Card Transaction: ${displayDesc}`);
                                        setShowFolioRefundModal(true);
                                      }}
                                      style={{ border: '1px solid #fde68a', background: '#fffbe6', padding: '3px 8px', fontSize: '11px', fontWeight: '700', color: '#b45309', borderRadius: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      title="Online/Card transaction must be refunded"
                                    >
                                      <RotateCcw size={12} /> Refund
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      onClick={() => handleOpenDeletePayment(p)}
                                      style={{ border: '1px solid #fca5a5', background: '#ffffff', padding: '3px 8px', fontSize: '11px', fontWeight: '700', color: '#dc2626', borderRadius: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      title="Delete Payment Entry"
                                    >
                                      <Trash2 size={12} /> Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()
                    )}

                    {mergedDeposits.length === 0 &&
                      getDisplayFolioItems().length === 0 &&
                      (!currentFolio.payments || currentFolio.payments.length === 0) && (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          No transactions recorded in this section.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state-card card glassmorphism">
          <p>Please select a guest reservation to view their folio ledger.</p>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL POPUPS FOR ALL 7 NEW REQUESTED OPTIONS        */}
      {/* ---------------------------------------------------- */}

      {/* OPTION 1: DELETE FOLIO CONFIRMATION MODAL */}
      {showDeleteFolioModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: '#dc2626' }}>Delete Guest Folio Ledger</h3>
              <button className="close-btn" onClick={() => setShowDeleteFolioModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to clear and delete the entire folio ledger for <strong>{currentRes?.guestName || currentRes?.guest}</strong>?</p>
              <p className="text-muted text-sm">This will remove all itemized room charges, extra charges, and payment settlements.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteFolioModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmDeleteFolio} style={{ background: '#dc2626', color: '#fff' }}>
                <Trash2 size={16} /> Yes, Delete Folio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPTION 2: EDIT ROOM RATE MODAL */}
      {showEditRoomRateModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Nightly Room Rate ($ USD)</h3>
              <button className="close-btn" onClick={() => setShowEditRoomRateModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveEditRoomRate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Override Room Tariff Rate ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editRateAmount}
                    onChange={(e) => setEditRateAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditRoomRateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Rate Override</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OPTION 3: DELETE PAYMENT ENTRY CONFIRMATION MODAL */}
      {showDeletePaymentModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: '#dc2626' }}>Delete Payment Entry</h3>
              <button className="close-btn" onClick={() => setShowDeletePaymentModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this payment entry of <strong>${paymentToDelete?.amountUSD || paymentToDelete?.amount || 0}</strong> ({paymentToDelete?.method || paymentToDelete?.mode || 'Cash'})?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeletePaymentModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmDeletePayment} style={{ background: '#dc2626', color: '#fff' }}>
                Delete Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Option 5: Print Payment Receipt Modal */}
      {showPrintPaymentReceiptModal && selectedPaymentReceipt && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism print-modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h3>Official Payment Receipt</h3>
              <button className="close-btn" onClick={() => setShowPrintPaymentReceiptModal(false)}>×</button>
            </div>
            <div className="modal-body print-invoice-body">
              <div id="printable-payment-receipt-paper" className="invoice-paper" style={{ padding: '36px', border: '1px solid #cbd5e1', borderRadius: '12px', background: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif', fontSize: '12.5px', lineHeight: '1.4' }}>
                {(() => {
                  let hp = {};
                  try { hp = getHotelProfile?.() || {}; } catch(e) {}
                  
                  const receiptNum = (selectedPaymentReceipt?.id || "").replace(/[^0-9]/g, '') || "1001";
                  const paymentAmount = Number(selectedPaymentReceipt?.amountUSD || selectedPaymentReceipt?.amount || 0);
                  const paymentMethod = selectedPaymentReceipt?.method || selectedPaymentReceipt?.mode || currentRes?.paymentMethod || booking?.paymentMethod || 'Cash';
                  const guestNameStr = currentRes?.guestName || currentRes?.guest || booking?.guestName || booking?.guest || '';
                  const guestEmailStr = currentRes?.email || currentRes?.guestEmail || booking?.guestEmail || booking?.email || '';
                  const guestPhoneStr = currentRes?.phone || currentRes?.phoneNumber || booking?.guestPhone || booking?.phone || '';
                  const folioCode = currentRes?.resCode || currentRes?.id || booking?.resCode || booking?.id || 'N/A';
                  const roomNum = currentRes?.roomNumber || currentRes?.room || booking?.roomNumber || booking?.room || 'N/A';
                  const roomCat = currentRes?.roomType || booking?.roomType || 'Standard';

                  const customTerms = getHotelTerms?.() || "";
                  const cancelPolicies = getCancellationPolicies?.() || [];

                  return (
                    <>
                      {/* HEADER SECTION: HOTEL DETAILS (LEFT) & RECEIPT TITLE + GUEST INFO (RIGHT) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                        {/* Left: Hotel Info */}
                        <div>
                          {(hp.logoUrl || hp.logo) && (
                            <img
                              src={hp.logoUrl || hp.logo}
                              alt="Hotel Logo"
                              style={{ maxHeight: "50px", maxWidth: "180px", objectFit: "contain", marginBottom: "6px", display: "block" }}
                            />
                          )}
                          <h2 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 4px 0', color: '#000000', textTransform: 'uppercase' }}>
                            {hp.name || "Bhopal Grand Palace Hotel"}
                          </h2>
                          <div style={{ fontSize: '12px', color: '#333333', lineHeight: '1.3' }}>
                            {hp.address || "123 MP Nagar, Zone 1"}<br />
                            {hp.city ? `${hp.city}, ${hp.state || ''} ${hp.zipcode || ''}` : "Bhopal, MP 462011"}<br />
                            Email: {hp.email || "info@bhopalgrandpalace.com"}<br />
                            Phone: {hp.phone || "+91 755 123 4567"}
                          </div>
                        </div>

                        {/* Right: Payment Receipt Title & Guest Details */}
                        <div style={{ textAlign: 'right' }}>
                          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#64748b', margin: '0 0 2px 0' }}>
                            Payment Receipt
                          </h1>
                          <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
                            Receipt Date: {formatDate(selectedPaymentReceipt?.date || getBusinessDate())}
                          </div>
                          {guestNameStr && (
                            <div style={{ fontSize: '13px', color: '#000000', fontWeight: '700' }}>
                              {guestNameStr}
                            </div>
                          )}
                          {guestEmailStr && (
                            <div style={{ fontSize: '12px', color: '#333333' }}>
                              {guestEmailStr}
                            </div>
                          )}
                          {guestPhoneStr && (
                            <div style={{ fontSize: '12px', color: '#333333' }}>
                              Phone: {guestPhoneStr}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2-COLUMN METADATA GRID */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px', fontSize: '12.5px', color: '#000000' }}>
                        {/* Left Metadata Column */}
                        <div>
                          <div><strong>Receipt No. : REC-{receiptNum}</strong></div>
                          <div>Folio Ref : {folioCode}</div>
                          <div>Room Number : Room {roomNum}</div>
                          <div>Room Category : {roomCat}</div>
                        </div>

                        {/* Right Metadata Column */}
                        <div style={{ textAlign: 'right' }}>
                          <div>Payment Date : {formatDate(selectedPaymentReceipt?.date || getBusinessDate())}</div>
                          <div>Payment Method : {paymentMethod}</div>
                          <div>Payment Status : <span style={{ fontWeight: '700', color: '#166534' }}>CLEARED &amp; POSTED</span></div>
                          <div>Cashier / Staff : Front Desk (#FD-104)</div>
                        </div>
                      </div>

                      {/* RECEIPT SUMMARY TABLE */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', color: '#000000', borderBottom: '1px solid #cbd5e1' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Date</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Description / Transaction Note</th>
                            <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700' }}>Method</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 10px' }}>{formatDate(selectedPaymentReceipt?.date || getBusinessDate())}</td>
                            <td style={{ padding: '10px 10px', fontWeight: '700' }}>{selectedPaymentReceipt?.description || selectedPaymentReceipt?.note || 'Folio Settlement / Payment Received'}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'center' }}>{paymentMethod}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '800', fontSize: '14px', color: '#166534' }}>$ {paymentAmount.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* TOTAL RECEIVED SUMMARY ROW */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
                        <div style={{ textAlign: 'right', fontSize: '13.5px', lineHeight: '1.8', color: '#000000' }}>
                          <div><span style={{ display: 'inline-block', width: '160px', color: '#333333' }}>Total Amount Paid:</span> <strong style={{ fontSize: '16px', color: '#166534' }}>$ {paymentAmount.toFixed(2)}</strong></div>
                          <div><span style={{ display: 'inline-block', width: '160px', color: '#333333' }}>Remaining Balance Due:</span> <strong>$ {Math.abs(balanceDue).toFixed(2)}</strong></div>
                        </div>
                      </div>

                      {/* DUAL SIGNATURE ROW */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '36px 0 28px 0', fontSize: '12.5px', color: '#000000' }}>
                        <div>
                          Guest Signature : {currentRes?.digitalSignature || booking?.digitalSignature ? (
                            <img src={currentRes?.digitalSignature || booking?.digitalSignature} alt="Signature" style={{ maxHeight: '28px', verticalAlign: 'bottom', marginLeft: '8px' }} />
                          ) : guestNameStr ? (
                            <span style={{ fontFamily: 'cursive', fontSize: '18px', borderBottom: '1px solid #000', paddingBottom: '2px', marginLeft: '8px' }}>{guestNameStr}</span>
                          ) : (
                            <span>_____________________</span>
                          )}
                        </div>
                        <div>Authorized Cashier Stamp &amp; Sign : _____________________</div>
                      </div>

                      {/* TERMS & CANCELLATION POLICIES */}
                      <div style={{ fontSize: '11px', color: '#333333', lineHeight: '1.45', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                        <div style={{ fontWeight: '700', textDecoration: 'underline', marginBottom: '4px' }}>Property Terms &amp; Policies</div>
                        {customTerms ? (
                          <div style={{ whiteSpace: 'pre-wrap', margin: '0 0 6px 0' }}>{customTerms}</div>
                        ) : (
                          <ul style={{ margin: '0', paddingLeft: '16px', listStyleType: 'disc' }}>
                            <li>{hp.name || "Bhopal Grand Palace Hotel"} assumes no responsibility for accidents, injuries, theft, or loss of personal belongings.</li>
                            <li>Guests are responsible for any personal injuries or property damage caused by themselves or their visitors during their stay.</li>
                            <li>In accordance with hotel regulations, smoking in non-smoking rooms or bringing unauthorized pets into rooms will incur additional cleaning or penalty fees.</li>
                          </ul>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPrintPaymentReceiptModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print Receipt PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPTION 6: CANCEL BOOKING MODAL (UNIFIED 3-OPTION FINANCIAL SELECTION) */}
      {showCancelBookingModal && (
        <div className="qam-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }}>
          <div className="qam-card" style={{ maxWidth: 540, width: "92%", padding: 24, borderRadius: 16, background: "#ffffff", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #e2e8f0", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a", fontWeight: 800 }}>Cancel Reservation &amp; Financial Action</h3>
              <button type="button" onClick={() => setShowCancelBookingModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: "#475569", marginBottom: 16, lineHeight: "1.5" }}>
              Select required financial action for cancelling reservation for <strong>{currentRes?.guestName || currentRes?.guest}</strong> (Room {currentRes?.roomNumber || currentRes?.room || "Unassigned"}):
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <label style={{ display: "flex", gap: 12, padding: 12, border: "1.5px solid", borderColor: cancelPolicyOption === "charge_one_night" ? "#0f172a" : "#cbd5e1", background: cancelPolicyOption === "charge_one_night" ? "#f8fafc" : "#ffffff", borderRadius: 10, cursor: "pointer" }}>
                <input type="radio" name="folioCancelPolicy" checked={cancelPolicyOption === "charge_one_night"} onChange={() => setCancelPolicyOption("charge_one_night")} style={{ marginTop: 3 }} />
                <div>
                  <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>Charge 1-Night Tariff Rate</strong>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Post 1 night tariff rate ({formatUSD(Number(currentRes?.nightlyRateUSD || currentRes?.ratePerNight || 100))}) as Cancellation penalty fee.</span>
                </div>
              </label>

              {(() => {
                const pol = getCalculatedCancellationDetails();
                return (
                  <label style={{ display: "flex", gap: 12, padding: 12, border: "1.5px solid", borderColor: cancelPolicyOption === "charge_per_policy" ? "#0f172a" : "#cbd5e1", background: cancelPolicyOption === "charge_per_policy" ? "#f8fafc" : "#ffffff", borderRadius: 10, cursor: "pointer" }}>
                    <input type="radio" name="folioCancelPolicy" checked={cancelPolicyOption === "charge_per_policy"} onChange={() => setCancelPolicyOption("charge_per_policy")} style={{ marginTop: 3 }} />
                    <div>
                      <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>Charge Hotel Policy Fee ({pol.policyName})</strong>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Apply {pol.actionDetail} as per active hotel cancellation policy.</span>
                    </div>
                  </label>
                );
              })()}

              <label style={{ display: "flex", gap: 12, padding: 12, border: "1.5px solid", borderColor: cancelPolicyOption === "void_all_charges" ? "#0f172a" : "#cbd5e1", background: cancelPolicyOption === "void_all_charges" ? "#f8fafc" : "#ffffff", borderRadius: 10, cursor: "pointer" }}>
                <input type="radio" name="folioCancelPolicy" checked={cancelPolicyOption === "void_all_charges"} onChange={() => setCancelPolicyOption("void_all_charges")} style={{ marginTop: 3 }} />
                <div>
                  <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>Cancel &amp; Void All Charges</strong>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Waive Cancellation penalty, void room charges to $0.00, and release room back to inventory.</span>
                </div>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-secondary" style={{ padding: "8px 16px", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }} onClick={() => setShowCancelBookingModal(false)}>Keep Reservation</button>
              <button type="button" className="btn btn-danger" style={{ padding: "10px 20px", background: "#dc2626", color: "#ffffff", border: "none", borderRadius: 8, fontWeight: 800, cursor: "pointer" }} onClick={handleExecuteCancelWithPolicy}>Confirm Cancellation &amp; Execute Policy</button>
            </div>
          </div>
        </div>
      )}

      {/* OPTION 6: NO-SHOW MODAL (UNIFIED WITH NIGHT AUDIT) */}
      {showNoShowModal && (
        <div className="qam-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }}>
          <div className="qam-card" style={{ maxWidth: 540, width: "92%", padding: 24, borderRadius: 16, background: "#ffffff", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #e2e8f0", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a", fontWeight: 800 }}>Mark No-Show &amp; Financial Action</h3>
              <button type="button" onClick={() => setShowNoShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: "#475569", marginBottom: 16, lineHeight: "1.5" }}>
              Select required financial action for marking <strong>{currentRes?.guestName || currentRes?.guest}</strong> (Room {currentRes?.roomNumber || currentRes?.room || "Unassigned"}) as No-Show:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <label style={{ display: "flex", gap: 12, padding: 12, border: "1.5px solid", borderColor: noShowPolicyOption === "charge_one_night" ? "#0f172a" : "#cbd5e1", background: noShowPolicyOption === "charge_one_night" ? "#f8fafc" : "#ffffff", borderRadius: 10, cursor: "pointer" }}>
                <input type="radio" name="folioNoShowPolicy" checked={noShowPolicyOption === "charge_one_night"} onChange={() => setNoShowPolicyOption("charge_one_night")} style={{ marginTop: 3 }} />
                <div>
                  <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>Charge 1-Night Tariff Rate</strong>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Post 1 night tariff rate ({formatUSD(Number(currentRes?.nightlyRateUSD || currentRes?.ratePerNight || 100))}) as No-Show penalty fee.</span>
                </div>
              </label>

              {(() => {
                const pol = getCalculatedCancellationDetails();
                return (
                  <label style={{ display: "flex", gap: 12, padding: 12, border: "1.5px solid", borderColor: noShowPolicyOption === "charge_per_policy" ? "#0f172a" : "#cbd5e1", background: noShowPolicyOption === "charge_per_policy" ? "#f8fafc" : "#ffffff", borderRadius: 10, cursor: "pointer" }}>
                    <input type="radio" name="folioNoShowPolicy" checked={noShowPolicyOption === "charge_per_policy"} onChange={() => setNoShowPolicyOption("charge_per_policy")} style={{ marginTop: 3 }} />
                    <div>
                      <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>Charge Hotel Policy Fee ({pol.policyName})</strong>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Apply {pol.actionDetail} as per active hotel cancellation/no-show policy.</span>
                    </div>
                  </label>
                );
              })()}

              <label style={{ display: "flex", gap: 12, padding: 12, border: "1.5px solid", borderColor: noShowPolicyOption === "void_all_charges" ? "#0f172a" : "#cbd5e1", background: noShowPolicyOption === "void_all_charges" ? "#f8fafc" : "#ffffff", borderRadius: 10, cursor: "pointer" }}>
                <input type="radio" name="folioNoShowPolicy" checked={noShowPolicyOption === "void_all_charges"} onChange={() => setNoShowPolicyOption("void_all_charges")} style={{ marginTop: 3 }} />
                <div>
                  <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>Mark No-Show &amp; Void All Charges</strong>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Waive No-Show penalty, void room charges to $0.00, and release room back to inventory.</span>
                </div>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-secondary" style={{ padding: "8px 16px", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }} onClick={() => setShowNoShowModal(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" style={{ padding: "10px 20px", background: "#0f172a", color: "#ffffff", border: "none", borderRadius: 8, fontWeight: 800, cursor: "pointer" }} onClick={handleExecuteNoShowWithPolicy}>Confirm No-Show &amp; Execute Policy</button>
            </div>
          </div>
        </div>
      )}

      {/* OPTION 7: PRINT GRC (GUEST REGISTRATION CARD) MODAL */}
      {showPrintGRCModal && (
        <div className="modal-backdrop" >
          <div className="modal-content print-modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '840px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 0, padding: 0 }}>
            <GRCErrorBoundary onClose={() => setShowPrintGRCModal(false)}>
              <div className="modal-header" style={{ padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', margin: 0, borderRadius: 0 }}>
                <h3 style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '15px', fontWeight: 700 }}>
                  📋 Official Guest Registration Card (GRC)
                </h3>
                <button className="close-btn" onClick={() => setShowPrintGRCModal(false)}>×</button>
              </div>
              <div className="modal-body print-invoice-body" style={{ padding: '20px', background: '#f8fafc' }}>
                <div className="invoice-paper grc-paper" id="grc-modal-printable-card" style={{ padding: '32px', border: '1px solid #cbd5e1', borderRadius: 0, background: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif', fontSize: '12.5px', lineHeight: '1.4' }}>
                  {(() => {
                    let hp = {};
                    try { hp = getHotelProfile?.() || {}; } catch(e) {}
                    
                    const checkInDate = new Date(currentRes?.checkIn || booking?.checkIn || new Date());
                    const checkOutDate = new Date(currentRes?.checkOut || booking?.checkOut || new Date());
                    const nightsCount = Math.max(1, Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
                    const resId = (currentRes?.resCode || currentRes?.id || booking?.id || "").replace(/[^0-9]/g, '') || "1001";
                    const guestNameStr = currentRes?.guestName || currentRes?.guest || booking?.guestName || booking?.guest || 'Guest';
                    const guestEmailStr = currentRes?.email || currentRes?.guestEmail || booking?.email || booking?.guestEmail || '';
                    const guestPhoneStr = currentRes?.phone || currentRes?.phoneNumber || booking?.phone || booking?.guestPhone || '';
                    const bookingSourceStr = (currentRes?.source || booking?.source || 'Direct').toUpperCase();

                    const customTerms = getHotelTerms?.() || "";
                    const cancelPolicies = getCancellationPolicies?.() || [];

                    return (
                      <>
                        {/* HEADER SECTION: 3 COLUMNS */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', alignItems: 'flex-start', gap: '16px', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
                          {/* Left: Hotel Profile */}
                          <div>
                            {(hp.logoUrl || hp.logo) && (
                              <img
                                src={hp.logoUrl || hp.logo}
                                alt="Hotel Logo"
                                style={{ maxHeight: "48px", maxWidth: "160px", objectFit: "contain", marginBottom: "6px", display: "block" }}
                              />
                            )}
                            <h2 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 4px 0', color: '#64748b', textTransform: 'uppercase' }}>
                              {hp.name || "Bhopal Grand Palace Hotel"}
                            </h2>
                            <div style={{ fontSize: '11.5px', color: '#333333', lineHeight: '1.3' }}>
                              {hp.address || "123 MP Nagar, Zone 1"}<br />
                              {hp.city ? `${hp.city}, ${hp.state || ''} ${hp.zipcode || ''}` : "Bhopal, MP 462011"}<br />
                              Email: {hp.email || "info@bhopalgrandpalace.com"}<br />
                              Phone: {hp.phone || "+91 755 123 4567"}
                            </div>
                          </div>

                          {/* Center: Title */}
                          <div style={{ textAlign: 'center' }}>
                            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#000000', margin: 0 }}>
                              Registration Card
                            </h1>
                          </div>

                          {/* Right: Folio Summary */}
                          <div style={{ textAlign: 'right', fontSize: '12px', color: '#000000', lineHeight: '1.4' }}>
                            <div><strong>Folio# {currentRes?.resCode || currentRes?.id || booking?.resCode || booking?.id || 'N/A'}</strong></div>
                            <div>Check-in: {formatDate(currentRes?.checkIn || booking?.checkIn)} 04:00 PM</div>
                            <div>Check-out: {formatDate(currentRes?.checkOut || booking?.checkOut)} 11:00 AM</div>
                            <div>Nights: {nightsCount} &nbsp; Adults: {currentRes?.adults || booking?.adults || 1} &nbsp; Children: {currentRes?.children || booking?.children || 0}</div>
                            <div>Source: {bookingSourceStr}</div>
                          </div>
                        </div>

                        {/* 2-COLUMN BORDERED FORM TABLE */}
                        <div style={{ border: '1px solid #cbd5e1', borderRadius: 0, marginBottom: '18px', overflow: 'hidden', fontSize: '12px' }}>
                          {[
                            [ `Registration No. : ${resId}`, `Payment mode : ${currentRes?.paymentMethod || booking?.paymentMethod || 'Cash'}` ],
                            [ `Guest name : ${guestNameStr}`, `Nationality : ${currentRes?.nationality || booking?.nationality || 'NA'}` ],
                            [ `Email : ${guestEmailStr}`, `Phone : ${guestPhoneStr}` ],
                            [ `Source : ${bookingSourceStr}`, `Booking amount : ${isHideRate ? '*******' : `$ ${(grandTotal || 0).toFixed(2)}`}` ],
                            [ `Address : ${currentRes?.address || booking?.address || ''}`, `Visa No/Issue/Expiry :` ],
                            [ `DOB : ${currentRes?.dob || booking?.dob || 'NA'}`, `Purpose of visit :` ],
                            [ `Arrived from :`, `Preferences :` ],
                            [ `Company name :`, `Company Tax no:` ],
                            [ `Designation :`, `Company address :` ],
                            [ `Company email :`, `Company contact :` ],
                            [ `Vehicle No. :`, `Anniversary :` ],
                          ].map(([left, right], idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0', background: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                              <div style={{ padding: '6px 12px', borderRight: '1px solid #cbd5e1', color: '#000000' }}>{left}</div>
                              <div style={{ padding: '6px 12px', color: '#000000' }}>{right}</div>
                            </div>
                          ))}
                          <div style={{ padding: '6px 12px', color: '#000000', background: '#ffffff' }}>
                            Remark : {currentRes?.notes || currentRes?.specialRequests || booking?.notes || ''}
                          </div>
                        </div>

                        {/* ROOM TYPE & OCCUPANCY TABLE */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', color: '#000000', borderBottom: '1px solid #cbd5e1' }}>
                              <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '700' }}>Room type</th>
                              <th style={{ padding: '7px 12px', textAlign: 'center', fontWeight: '700' }}>Room Ids.</th>
                              <th style={{ padding: '7px 12px', textAlign: 'center', fontWeight: '700' }}>Rate plan</th>
                              <th style={{ padding: '7px 12px', textAlign: 'right', fontWeight: '700' }}>Room Occupancy</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '7px 12px' }}>{currentRes?.roomType || booking?.roomType || 'Standard Room'}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'center' }}>{currentRes?.roomNumber || currentRes?.room || booking?.roomNumber || booking?.room || 'N/A'}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'center' }}>{currentRes?.ratePlan || booking?.ratePlan || 'Standard Plan'}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right' }}>Adult(s) : {currentRes?.adults || booking?.adults || 1} Children : {currentRes?.children || booking?.children || 0}</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* DUAL SIGNATURE ROW */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '26px 0 20px 0', fontSize: '12.5px', color: '#000000' }}>
                          <div>
                            Guest signature : {currentRes?.digitalSignature || booking?.digitalSignature ? (
                              <img src={currentRes?.digitalSignature || booking?.digitalSignature} alt="Signature" style={{ maxHeight: '28px', verticalAlign: 'bottom', marginLeft: '8px' }} />
                            ) : guestNameStr ? (
                              <span style={{ fontFamily: 'cursive', fontSize: '18px', borderBottom: '1px solid #000', paddingBottom: '2px', marginLeft: '8px' }}>{guestNameStr}</span>
                            ) : (
                              <span>_____________________</span>
                            )}
                          </div>
                          <div>
                            Hotel signature : _____________________
                          </div>
                        </div>

                        {/* TERMS & CANCELLATION POLICIES */}
                        <div style={{ fontSize: '11px', color: '#333333', lineHeight: '1.45', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                          <div style={{ fontWeight: '700', textDecoration: 'underline', marginBottom: '4px' }}>Property Terms &amp; Policies</div>
                          {customTerms ? (
                            <div style={{ whiteSpace: 'pre-wrap', margin: '0 0 6px 0' }}>{customTerms}</div>
                          ) : (
                            <ul style={{ margin: '0', paddingLeft: '16px', listStyleType: 'disc' }}>
                              <li>{hp.name || "Bhopal Grand Palace Hotel"} assumes no responsibility for accidents, injuries, theft, or loss of personal belongings.</li>
                              <li>Guests are responsible for any personal injuries or property damage caused by themselves or their visitors during their stay.</li>
                              <li>In accordance with hotel regulations, smoking in non-smoking rooms or bringing unauthorized pets into rooms will incur additional cleaning or penalty fees.</li>
                            </ul>
                          )}
                          {cancelPolicies.length > 0 && (
                            <>
                              <div style={{ fontWeight: '700', textDecoration: 'underline', marginTop: '8px', marginBottom: '4px' }}>Cancellation Policies</div>
                              <ul style={{ margin: '0', paddingLeft: '16px', listStyleType: 'disc' }}>
                                {cancelPolicies.map((pol, pIdx) => (
                                  <li key={pIdx}><strong>{pol.name || pol.title || 'Policy'}:</strong> {pol.description || pol.detail || JSON.stringify(pol)}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '12px 20px', background: '#f8fafc', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: '700', color: '#0f172a', cursor: 'pointer', background: isHideRate ? '#f1f5f9' : '#ffffff', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={isHideRate} 
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setIsHideRate(nextVal);
                      const resId = currentRes?.id || selectedResId;
                      if (resId) {
                        const act = nextVal ? 'Enabled Hide Rate' : 'Disabled Hide Rate';
                        const det = nextVal ? 'Enabled Hide Rate status (hide room tariff on printed GRC card)' : 'Disabled Hide Rate status (show room tariff on printed GRC card)';
                        recordAuditLog(act, det);
                        try {
                          if (typeof updateBooking === 'function') updateBooking(resId, { isHideRate: nextVal, auditAction: act, auditDetails: det });
                          import('../../services/api').then(({ updateBooking: apiUpdateBooking }) => {
                            if (apiUpdateBooking) apiUpdateBooking(resId, { isHideRate: nextVal, auditAction: act, auditDetails: det });
                          });
                        } catch(err) {}
                      }
                    }} 
                    style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer', margin: 0 }}
                  />
                  <span>🔒 Hide Room Rate on GRC (Display as ********)</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button className="btn-lg-grey" onClick={() => setShowPrintGRCModal(false)} style={{ borderRadius: 0, height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                    Close
                  </button>
                  <button className="btn-lg-grey cr-submit-primary" onClick={handleTriggerGRCPrint} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 0, height: '36px', padding: '0 18px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                    <Printer size={15} /> Print GRC Card PDF
                  </button>
                </div>
              </div>
            </GRCErrorBoundary>
          </div>
        </div>
      )}

      <SendSelfCheckInModal
        isOpen={showSendSelfCheckInModal}
        booking={currentRes || booking}
        onClose={() => setShowSendSelfCheckInModal(false)}
      />

      {/* Add Charge Modal */}
      {showAddChargeModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Post New Folio Charge ($ USD)</h3>
              <button className="close-btn" onClick={() => setShowAddChargeModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddCharge}>
              <div className="modal-body">
                <div className="form-group">
                  <label style={{ fontWeight: '700', color: '#0f172a' }}>
                    Select Configured Hotel Addon
                  </label>
                  <select 
                    value={chargeCategory} 
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      setChargeCategory(selectedVal);
                      if (selectedVal === "Custom Charge") {
                        setChargeDescription("");
                        setChargeAmountUSD("");
                        return;
                      }
                      const addons = getHotelAddons();
                      const matched = addons.find(a => (a.name || a.title || a.label || a.id) === selectedVal);
                      if (matched) {
                        const info = calculateAddonAmountAndDesc(matched);
                        setChargeDescription(info.desc);
                        setChargeAmountUSD(info.priceStr);
                      }
                    }}
                    style={{ border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '10px 12px', fontSize: '13.5px', width: '100%' }}
                  >
                    {(() => {
                      const addons = getHotelAddons();
                      if (Array.isArray(addons) && addons.length > 0) {
                        return (
                          <>
                            {addons.map((addon, idx) => {
                              const nameStr = addon.name || addon.title || addon.label || `Addon ${idx + 1}`;
                              const priceVal = Number(addon.price ?? addon.amount ?? addon.rate ?? 0);
                              return (
                                <option key={addon.id || idx} value={nameStr}>
                                  {nameStr} ({formatUSD(priceVal)})
                                </option>
                              );
                            })}
                            <option value="Custom Charge">+ Custom / Other Charge</option>
                          </>
                        );
                      }
                      return (
                        <option value="Custom Charge">Custom / Other Charge</option>
                      );
                    })()}
                  </select>
                </div>

                <div className="form-group">
                  <label>Description / Item Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Room Service Food / Laundry / Extra Bed"
                    value={chargeDescription}
                    onChange={(e) => setChargeDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Amount in $ USD</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={chargeAmountUSD}
                    onChange={(e) => setChargeAmountUSD(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddChargeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  + Post Charge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record & Settle Payment Modal */}
      {showAddPaymentModal && (
        <div className="modal-backdrop"  style={{ background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)", zIndex: 100000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px", width: "95%", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.15)", overflow: "hidden", padding: 0 }}>
            {/* Modal Header */}
            <div className="modal-header" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16.5px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  💵 Record &amp; Settle Guest Payment
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Select payment mode, charge saved card, add card or post to company
                </span>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowAddPaymentModal(false)} style={{ background: "#e2e8f0", border: "none", color: "#475569", width: "28px", height: "28px", borderRadius: "50%", cursor: "pointer", fontSize: "15px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            <form onSubmit={handleAddPayment}>
              <div className="modal-body" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px", background: "#ffffff" }}>
                {/* Balance Due Banner */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "#475569", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>Folio Balance Due</span>
                    <div style={{ fontSize: "17px", fontWeight: "900", color: "#0f172a", marginTop: "1px" }}>
                      USD ${formatUSD(balanceDue > 0 ? balanceDue : 0).replace("$", "")}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setPaymentAmountUSD(balanceDue > 0 ? balanceDue.toFixed(2) : "0.00")}
                    style={{ background: "#e2e8f0", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                  >
                    Settle Full Balance
                  </button>
                </div>

                {/* US PAYMENT GATEWAY LAUNCHER BANNER */}
                {(() => {
                  const pgConfig = getPaymentGatewayConfig();
                  const enabledGateways = [
                    pgConfig.stripe?.enabled && "Stripe",
                    pgConfig.fortis?.enabled && "Fortis",
                    pgConfig.shift4?.enabled && "Shift4",
                    pgConfig.paybotx?.enabled && "PAYBOTX",
                    pgConfig.venmo?.enabled && "Venmo",
                    pgConfig.zelle?.enabled && "Zelle",
                  ].filter(Boolean);

                  if (enabledGateways.length === 0) return null;

                  return (
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a" }}>💳 US Live Payment Terminal / QR</span>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                          Active Gateways: {enabledGateways.join(", ")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddPaymentModal(false);
                          setShowGatewayProcessModal(true);
                        }}
                        style={{ background: "#0f172a", color: "#ffffff", border: "1px solid #0f172a", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                      >
                        🚀 Launch Terminal &amp; QR
                      </button>
                    </div>
                  );
                })()}

                {/* Payment Method Selector */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: "700", fontSize: "12.5px", color: "#334155", marginBottom: "4px", display: "block" }}>
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaymentMethod(val);
                      if (val === 'security_deposit' || val === 'Deposit' || val.toLowerCase().includes('deposit')) {
                        if (!paymentDescription || paymentDescription === 'Payment Received') {
                          setPaymentDescription('Security Deposit Collected');
                        }
                      } else {
                        if (paymentDescription === 'Security Deposit Collected') {
                          setPaymentDescription('Payment Received');
                        }
                      }
                    }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "13.5px", fontWeight: "700", color: paymentMethod ? "#0f172a" : "#64748b", outline: "none", boxSizing: "border-box" }}
                  >
                    <option value="" disabled style={{ color: "#94a3b8" }}>-- Select Payment Method --</option>
                    {Boolean(currentRes?.cardNumber || currentRes?.cardDetails?.cardNumber) && (
                      <option value="saved_card">
                        💳 Saved Card ({currentRes?.cardNumber ? `•••• ${String(currentRes.cardNumber).replace(/\s+/g, "").slice(-4)}` : "Card on File"})
                      </option>
                    )}
                    <option value="Cash">💵 Cash</option>
                    <option value="security_deposit">🛡️ Security Deposit (Held in Trust)</option>
                    <option value="Card">💳 Card (Manual)</option>
                    
                    {/* ONLY SHOW ENABLED PAYMENT GATEWAYS */}
                    {(() => {
                      const pgConfig = getPaymentGatewayConfig();
                      return (
                        <>
                          {pgConfig.stripe?.enabled && <option value="Stripe">⚡ Stripe Terminal</option>}
                          {pgConfig.fortis?.enabled && <option value="Fortis">🏛️ Fortis Pay</option>}
                          {pgConfig.shift4?.enabled && <option value="Shift4">⚡ Shift4 SkyTab</option>}
                          {pgConfig.paybotx?.enabled && <option value="PAYBOTX">🤖 PAYBOTX Auto</option>}
                          {pgConfig.venmo?.enabled && <option value="Venmo">💙 Venmo QR</option>}
                          {pgConfig.zelle?.enabled && <option value="Zelle">💜 Zelle Express</option>}
                        </>
                      );
                    })()}

                    <option value="Swipe">📲 POS Swipe</option>
                    <option value="OTA Collect">🌐 OTA Collect (Expedia / Booking.com)</option>
                    <option value="City Ledger">🏛️ City Ledger (Corporate Direct Bill)</option>
                    <option value="Company">🏢 Company Account</option>
                  </select>
                </div>

                {/* Option 1: Saved Card Preview */}
                {paymentMethod === "saved_card" && (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px" }}>
                    <div style={{ fontSize: "11.5px", color: "#64748b", fontWeight: "700", marginBottom: "2px" }}>
                      Card Details on File
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>💳</span>
                      <span>{currentRes?.cardName || currentRes?.guestName || "Guest Card"}</span>
                      <span style={{ color: "#2563eb" }}>
                        •••• {String(currentRes?.cardNumber || currentRes?.cardDetails?.cardNumber || "").replace(/\s+/g, "").slice(-4) || "4242"}
                      </span>
                      {(currentRes?.cardExpiry || currentRes?.cardDetails?.cardExpiry) && (
                        <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: "600" }}>
                          (Exp: {currentRes.cardExpiry || currentRes.cardDetails.cardExpiry})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Option 2: Add New Card Inline Fields */}
                {["Card", "Swipe", "add_new_card"].includes(paymentMethod) && (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ fontSize: "12.5px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                      💳 Enter Credit / Swipe Card Details
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontWeight: "700", fontSize: "11.5px", color: "#475569", marginBottom: "2px", display: "block" }}>Cardholder Name</label>
                      <input
                        type="text"
                        value={newCardName}
                        onChange={(e) => setNewCardName(e.target.value)}
                        placeholder="Name as printed on card"
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontWeight: "700", fontSize: "11.5px", color: "#475569", marginBottom: "2px", display: "block" }}>Card Number</label>
                      <input
                        type="text"
                        maxLength="19"
                        value={newCardNumber}
                        onChange={(e) => setNewCardNumber(e.target.value)}
                        placeholder="•••• •••• •••• ••••"
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontWeight: "700", fontSize: "11.5px", color: "#475569", marginBottom: "2px", display: "block" }}>Expiry Date</label>
                        <input
                          type="text"
                          maxLength="5"
                          value={newCardExpiry}
                          onChange={(e) => setNewCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", fontSize: "13px", boxSizing: "border-box" }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontWeight: "700", fontSize: "11.5px", color: "#475569", marginBottom: "2px", display: "block" }}>CVV / CVC</label>
                        <input
                          type="password"
                          maxLength="4"
                          value={newCardCvv}
                          onChange={(e) => setNewCardCvv(e.target.value)}
                          placeholder="•••"
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", fontSize: "13px", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "#475569", cursor: "pointer", marginTop: "2px" }}>
                      <input
                        type="checkbox"
                        checked={saveCardToProfile}
                        onChange={(e) => setSaveCardToProfile(e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                      Save this card to guest profile for future charges
                    </label>
                  </div>
                )}
                {/* Option 3: Post to Company (Direct Bill) Account Selection */}
                {["Company", "post_to_company", "City Ledger"].includes(paymentMethod) && (
                  <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontWeight: "800", fontSize: "12.5px", color: "#0f172a", display: "block" }}>
                      SELECT CORPORATE COMPANY ACCOUNT *
                    </label>
                    <select
                      value={selectedCompanyAccountId}
                      onChange={(e) => setSelectedCompanyAccountId(e.target.value)}
                      required={paymentMethod === "post_to_company"}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1.5px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: "13.5px",
                        fontWeight: "700",
                        color: selectedCompanyAccountId ? "#0f172a" : "#64748b",
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                    >
                      <option value="" disabled>-- Select Company / City Ledger Account --</option>
                      {companyAccountsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          🏢 {c.name} (Acct #{c.accountNo}) {c.creditLimit ? `· Credit Limit: $${Number(c.creditLimit).toLocaleString()}` : ""}
                        </option>
                      ))}
                    </select>
                    {companyAccountsList.length === 0 && (
                      <div style={{ fontSize: "11.5px", color: "#e11d48", fontWeight: "700", marginTop: "2px" }}>
                        ⚠️ No corporate accounts registered. Go to House Accounts to add one.
                      </div>
                    )}
                  </div>
                )}

                {/* Amount to Pay */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: "700", fontSize: "12.5px", color: "#334155", marginBottom: "4px", display: "block" }}>
                    Payment Amount ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={paymentAmountUSD}
                    onChange={(e) => setPaymentAmountUSD(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "14.5px", fontWeight: "800", color: "#0f172a", boxSizing: "border-box", outline: "none" }}
                  />
                </div>

                {/* Reference Note */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: "700", fontSize: "12.5px", color: "#334155", marginBottom: "4px", display: "block" }}>
                    Reference / Transaction Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Receipt #, Terminal Txn ID, Note"
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "13px", color: "#0f172a", boxSizing: "border-box", outline: "none" }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "12px 20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPaymentModal(false)} style={{ padding: "8px 16px", borderRadius: "8px", background: "#ffffff", color: "#475569", border: "1px solid #cbd5e1", fontWeight: "700", cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px",
                    fontWeight: "800",
                    background: (paymentMethod === "security_deposit" || paymentMethod === "Deposit" || (paymentMethod && paymentMethod.toLowerCase().includes("deposit"))) ? "#059669" : "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  {(paymentMethod === "security_deposit" || paymentMethod === "Deposit" || (paymentMethod && paymentMethod.toLowerCase().includes("deposit"))) ? "🛡️ Record Security Deposit" : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* US PAYMENT GATEWAY TERMINAL & QR MODAL */}
      <PaymentGatewayProcessModal
        isOpen={showGatewayProcessModal}
        onClose={() => setShowGatewayProcessModal(false)}
        defaultAmount={balanceDue > 0 ? balanceDue : 0}
        folioId={currentFolio?.id || booking?.id || "FOLIO-1001"}
        roomNo={booking?.roomNo || "101"}
        guestPhone={currentRes?.phone || booking?.phone || ""}
        guestEmail={currentRes?.email || booking?.email || ""}
        onSuccess={({ paymentMethod, amount, transactionId }) => {
          setPaymentMethod(paymentMethod);
          setPaymentAmountUSD(amount.toString());
          setPaymentDescription(`Terminal Txn Ref #${transactionId}`);
          handleOpenAddPaymentModal();
        }}
      />

      {/* Folio Overpayment Refund Modal */}
      {showFolioRefundModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ background: '#fff1f2', borderBottom: '1px solid #fecdd3' }}>
              <h3 style={{ color: '#e11d48', display: 'flex', alignItems: 'center', gap: 8 }}>
                💸 Issue Guest Refund ($ USD)
              </h3>
              <button className="close-btn" onClick={() => setShowFolioRefundModal(false)}>×</button>
            </div>
            <form onSubmit={handleProcessFolioRefund}>
              <div className="modal-body">
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '12px 14px', borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>
                    Guest has an Overpaid Credit Balance of <strong style={{ fontSize: 15, color: '#e11d48' }}>{formatUSD(Math.abs(balanceDue))}</strong>.
                  </div>
                  <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 4 }}>
                    Processing this refund will post an outflow settlement and balance the folio cleanly to $0.00.
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 700 }}>Refund Method</label>
                  <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} style={{ padding: 10, borderRadius: 8 }}>
                    <option value="Credit Card (Original Payment Method)">Credit Card (Original Payment Method)</option>
                    <option value="Cash USD">Cash USD</option>
                    <option value="Bank Transfer / Wire">Bank Transfer / Wire</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Direct Corporate Credit">Direct Corporate Credit</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 700 }}>Refund Amount in $ USD</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount to refund"
                    value={refundAmountUSD}
                    onChange={(e) => setRefundAmountUSD(e.target.value)}
                    required
                    style={{ padding: 10, borderRadius: 8, fontSize: 16, fontWeight: 800, color: '#e11d48' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 700 }}>Reference / Reason</label>
                  <input
                    type="text"
                    value={refundDescription}
                    onChange={(e) => setRefundDescription(e.target.value)}
                    placeholder="Reason for refund"
                    style={{ padding: 10, borderRadius: 8 }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFolioRefundModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-rose" style={{ background: '#e11d48', color: '#ffffff', fontWeight: 800, padding: '10px 20px', cursor: 'pointer' }}>
                  💸 Confirm &amp; Process Refund ({formatUSD(Number(refundAmountUSD) || 0)})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Deposit Manager Submodal */}
      {showDepositModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Security Deposit Manager</h3>
              <button className="close-btn" onClick={() => setShowDepositModal(false)}>×</button>
            </div>
            <form onSubmit={handleCollectDepositSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Deposit Amount ($ USD)</label>
                  <input
                    type="number"
                    value={depositAmountUSD}
                    onChange={(e) => setDepositAmountUSD(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Deposit Method</label>
                  <select value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Credit Card Hold</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDepositModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">💰 Collect Deposit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Security Deposit Modal */}
      {showEditDepositModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Security Deposit</h3>
              <button className="close-btn" onClick={() => setShowEditDepositModal(false)}>×</button>
            </div>
            <form onSubmit={handleConfirmEditDeposit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Deposit Amount ($ USD)</label>
                  <input
                    type="number"
                    value={editDepositAmount}
                    onChange={(e) => setEditDepositAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Deposit Method</label>
                  <select value={editDepositMode} onChange={(e) => setEditDepositMode(e.target.value)}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Credit Card Hold</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditDepositModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Deposit Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply Security Deposit Modal */}
      {showApplyDepositModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Apply Security Deposit to Folio</h3>
              <button className="close-btn" onClick={() => setShowApplyDepositModal(false)}>×</button>
            </div>
            <form onSubmit={handleConfirmApplyDeposit}>
              <div className="modal-body">
                <p>Are you sure you want to apply the <strong>${activeDepositItem?.amount || '500'}</strong> security deposit ({activeDepositItem?.mode || 'Cash'}) toward the folio balance due?</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowApplyDepositModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-emerald">💳 Confirm Apply Deposit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Security Deposit Modal */}
      {showRefundDepositModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Refund Security Deposit</h3>
              <button className="close-btn" onClick={() => setShowRefundDepositModal(false)}>×</button>
            </div>
            <form onSubmit={handleConfirmRefundDeposit}>
              <div className="modal-body">
                <p>Are you sure you want to refund <strong>${activeDepositItem?.amount || '500'}</strong> ({activeDepositItem?.mode || 'Cash'}) back to guest <strong>{currentRes?.guestName || currentRes?.guest}</strong>?</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRefundDepositModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger" style={{ background: '#ef4444', color: '#fff' }}>💸 Confirm Refund</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Balance Modal */}
      {showTransferModal && (() => {
        const curBal = Number(currentRes?.balanceDue ?? 0);
        const list = Array.isArray(pmsReservations) && pmsReservations.length > 0 ? pmsReservations : (JSON.parse(dataStore.getItem('pms_bookings') || '[]'));
        const curId = String(currentRes?.id || '');
        const eligibleList = list.filter((b) => {
          if (!b || String(b.id) === curId) return false;
          const st = String(b.status || '').toLowerCase();
          const isEligibleStatus = st === 'checked-in' || st === 'occupied' || st === 'confirmed' || st === 'reserved';
          if (!isEligibleStatus) return false;

          if (!transferSearchQuery.trim()) return true;
          const q = transferSearchQuery.toLowerCase();
          const gName = String(b.guestName || b.guest || '').toLowerCase();
          const rNo = String(b.roomNumber || b.room || '').toLowerCase();
          const rCode = String(b.resCode || b.id || '').toLowerCase();
          return gName.includes(q) || rNo.includes(q) || rCode.includes(q);
        });

        const handleConfirmTransferSubmit = async () => {
          if (!currentRes || !selectedTransferTargetId) {
            showToast?.('Please select a target in-house or upcoming guest');
            return;
          }

          const targetBk = list.find((b) => String(b.id) === String(selectedTransferTargetId) || String(b.resCode) === String(selectedTransferTargetId));
          if (!targetBk) {
            showToast?.('Selected target reservation not found');
            return;
          }

          const xferAmt = transferAmountUSD ? parseFloat(transferAmountUSD) : curBal;
          if (isNaN(xferAmt) || xferAmt <= 0) {
            showToast?.('Please enter a valid transfer amount');
            return;
          }

          const targetGuestName = targetBk.guestName || targetBk.guest || 'Target Guest';
          const targetRoomNo = targetBk.roomNumber || targetBk.room || 'Unassigned';

          try {
            const { transferBalance: apiTransferBalance } = await import('../../services/api');
            if (typeof apiTransferBalance === 'function') {
              await apiTransferBalance(currentRes.id, { targetBookingId: targetBk.id, amount: xferAmt });
            }
          } catch (err) {
            console.error('API transferBalance error:', err);
          }

          const sourceDebitLine = {
            id: `xfer_out_${Date.now()}`,
            category: 'Transfer Balance',
            description: `Transferred balance out to ${targetGuestName} (Room ${targetRoomNo})`,
            amountUSD: -xferAmt,
            amount: -xferAmt,
            date: getBusinessDate()
          };

          const targetCreditLine = {
            id: `xfer_in_${Date.now()}`,
            category: 'Transfer Balance',
            description: `Transferred balance in from ${currentRes.guestName || currentRes.guest} (Room ${currentRes.roomNumber || currentRes.room})`,
            amountUSD: xferAmt,
            amount: xferAmt,
            date: getBusinessDate()
          };

          setLocalFolio((prev) => ({
            ...prev,
            folioA: [...(prev.folioA || []), sourceDebitLine]
          }));

          updateLocalBookingCache(currentRes.id, (b) => {
            if (!Array.isArray(b.folioA)) b.folioA = [];
            b.folioA.push(sourceDebitLine);
            b.balanceDue = Math.max(0, (Number(b.balanceDue) || 0) - xferAmt);
          });

          updateLocalBookingCache(targetBk.id, (b) => {
            if (!Array.isArray(b.folioA)) b.folioA = [];
            b.folioA.push(targetCreditLine);
            b.balanceDue = (Number(b.balanceDue) || 0) + xferAmt;
          });

          const actTag = "Transfer Balance";
          const actDet = `Transferred $${xferAmt.toFixed(2)} balance to ${targetGuestName} (Room ${targetRoomNo}, Res #${targetBk.id || targetBk.resCode})`;

          recordAuditLog(actTag, actDet);
          showToast?.(`Transferred $${xferAmt.toFixed(2)} balance to ${targetGuestName} (Room ${targetRoomNo})`);

          try {
            const { updateBooking: apiUpdateBooking } = await import('../../services/api');
            if (typeof apiUpdateBooking === 'function') {
              await apiUpdateBooking(currentRes.id, { auditAction: actTag, auditDetails: actDet });
            }
          } catch (e) {}

          setShowTransferModal(false);
          setSelectedTransferTargetId('');
          setTransferAmountUSD('');
          window.dispatchEvent(new Event('pms_bookings_updated'));
        };

        return (
          <div className="modal-backdrop" >
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
              <div className="modal-header" style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', margin: 0, borderRadius: '12px 12px 0 0' }}>
                <h3 style={{ color: '#0f172a', margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowRightLeft size={16} /> Transfer Balance to Guest / Room
                </h3>
                <button className="close-btn" onClick={() => setShowTransferModal(false)}>×</button>
              </div>

              <div className="modal-body" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#334155' }}>
                  Current Folio Balance: <strong style={{ color: curBal > 0 ? '#b45309' : '#059669', fontSize: '15px' }}>${curBal.toFixed(2)}</strong>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Search & Select Target Guest (In-House or Upcoming)
                  </label>
                  <input
                    type="text"
                    placeholder="🔍 Search by guest name, room #, or booking ID..."
                    value={transferSearchQuery}
                    onChange={(e) => setTransferSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '8px' }}
                  />

                  <select
                    value={selectedTransferTargetId}
                    onChange={(e) => setSelectedTransferTargetId(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13.5px', fontWeight: '600', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                  >
                    <option value="">-- Select In-House or Upcoming Guest --</option>
                    {eligibleList.map((b) => {
                      const stLabel = String(b.status || '').toLowerCase().includes('check') ? 'In-House' : 'Upcoming';
                      const gName = b.guestName || b.guest || 'Guest';
                      const rNo = b.roomNumber || b.room || 'Unassigned';
                      const bId = b.id || b.resCode || '';
                      return (
                        <option key={bId} value={bId}>
                          [{stLabel}] {gName} · Room {rNo} (Res #{bId})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Transfer Amount ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Full Balance: $${curBal.toFixed(2)}`}
                    value={transferAmountUSD}
                    onChange={(e) => setTransferAmountUSD(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '14px', fontWeight: '700', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Leave blank to transfer the entire balance (${curBal.toFixed(2)}).
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 12px 12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmTransferSubmit}
                  style={{ background: '#0f172a', color: '#ffffff', border: 'none', fontWeight: '700', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  ⇄ Confirm Balance Transfer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Print Invoice Selection Modal */}
      {showPrintOptionsModal && (
        <div className="modal-backdrop" >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', margin: 0 }}>
              <h3 style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '14.5px', fontWeight: 700 }}>
                🖨️ Select Invoice Type to Print
              </h3>
              <button className="close-btn" onClick={() => setShowPrintOptionsModal(false)}>×</button>
            </div>

            <div className="modal-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Option 1: Master Folio */}
              <div
                onClick={() => setSelectedInvoiceType('master')}
                style={{
                  border: selectedInvoiceType === 'master' ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                  background: selectedInvoiceType === 'master' ? '#f8fafc' : '#ffffff',
                  boxShadow: 'none',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="invType"
                  checked={selectedInvoiceType === 'master'}
                  onChange={() => setSelectedInvoiceType('master')}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0f172a', margin: 0 }}
                />
                <span style={{ fontWeight: selectedInvoiceType === 'master' ? '700' : '600', fontSize: 13, color: '#0f172a' }}>
                  📄 Master Folio Invoice (Combined Room &amp; Extras)
                </span>
              </div>

              {/* Option 2: Detailed Itemized Folio */}
              <div
                onClick={() => setSelectedInvoiceType('detailed')}
                style={{
                  border: selectedInvoiceType === 'detailed' ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                  background: selectedInvoiceType === 'detailed' ? '#f8fafc' : '#ffffff',
                  boxShadow: 'none',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="invType"
                  checked={selectedInvoiceType === 'detailed'}
                  onChange={() => setSelectedInvoiceType('detailed')}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0f172a', margin: 0 }}
                />
                <span style={{ fontWeight: selectedInvoiceType === 'detailed' ? '700' : '600', fontSize: 13, color: '#0f172a' }}>
                  📑 Detailed Itemized Folio Statement
                </span>
              </div>

              {/* Option 3: Incidentals & F&B Only Folio */}
              <div
                onClick={() => setSelectedInvoiceType('incidental')}
                style={{
                  border: selectedInvoiceType === 'incidental' ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                  background: selectedInvoiceType === 'incidental' ? '#f8fafc' : '#ffffff',
                  boxShadow: 'none',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="invType"
                  checked={selectedInvoiceType === 'incidental'}
                  onChange={() => setSelectedInvoiceType('incidental')}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0f172a', margin: 0 }}
                />
                <span style={{ fontWeight: selectedInvoiceType === 'incidental' ? '700' : '600', fontSize: 13, color: '#0f172a' }}>
                  🥐 Incidentals &amp; F&amp;B Only Folio Invoice
                </span>
              </div>

              {/* Option 4: Room & Tax Only Folio */}
              <div
                onClick={() => setSelectedInvoiceType('room_tax')}
                style={{
                  border: selectedInvoiceType === 'room_tax' ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                  background: selectedInvoiceType === 'room_tax' ? '#f8fafc' : '#ffffff',
                  boxShadow: 'none',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="invType"
                  checked={selectedInvoiceType === 'room_tax'}
                  onChange={() => setSelectedInvoiceType('room_tax')}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0f172a', margin: 0 }}
                />
                <span style={{ fontWeight: selectedInvoiceType === 'room_tax' ? '700' : '600', fontSize: 13, color: '#0f172a' }}>
                  🛏️ Room &amp; Tax Only Folio Invoice
                </span>
              </div>

              {/* Option 5: Prepaid Invoice Encryption Toggle */}
              <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: '700', color: '#0f172a', cursor: 'pointer', background: isPrepaid ? '#f1f5f9' : '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <input 
                    type="checkbox" 
                    checked={isPrepaid} 
                    onChange={(e) => setIsPrepaid(e.target.checked)} 
                    style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer', margin: 0 }}
                  />
                  <span>🔒 Mark as Prepaid (Encrypt Room Rate as ******** on Invoice)</span>
                </label>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '12px 20px', background: '#f8fafc', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 16px 16px' }}>
              <button
                type="button"
                className="btn-lg-grey"
                onClick={() => setShowPrintOptionsModal(false)}
                style={{ borderRadius: '8px', height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-lg-grey"
                  onClick={() => {
                    setShowPrintOptionsModal(false);
                    setShowPrintModal(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: '8px', height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
                >
                  <Eye size={15} /> Preview Invoice
                </button>
                <button
                  type="button"
                  className="btn-lg-grey cr-submit-primary"
                  onClick={() => {
                    setShowPrintOptionsModal(false);
                    setShowPrintModal(true);
                    setTimeout(() => handleTriggerInvoicePrint(), 300);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: '8px', height: '36px', padding: '0 18px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
                >
                  <Printer size={15} /> Print Selected Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice PDF Preview Modal */}
      {showPrintModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism print-modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '860px' }}>
            <div className="modal-header">
              <h3>
                {selectedInvoiceType === 'incidental' ? '🥐 Incidental & F&B Expense Folio Invoice' :
                 selectedInvoiceType === 'room_tax' ? '🛏️ Room Tariff & Tax Folio Invoice' :
                 selectedInvoiceType === 'detailed' ? '📑 Detailed Itemized Folio Audit Statement' :
                 '📄 Official Master Tax Invoice & Settlement Statement'}
              </h3>
              <button className="close-btn" onClick={() => setShowPrintModal(false)}>×</button>
            </div>
            <div className="modal-body print-invoice-body">
              <div id="printable-invoice-paper" className="invoice-paper" style={{ padding: '36px', border: '1px solid #cbd5e1', borderRadius: '12px', background: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: '1.4' }}>
                {(() => {
                  const hp = getHotelProfile();
                  const fA = currentFolio && Array.isArray(currentFolio.folioA) ? currentFolio.folioA : [];

                  const checkInDate = new Date(currentRes?.checkIn || new Date());
                  const checkOutDate = new Date(currentRes?.checkOut || new Date());
                  const nightsCount = Math.max(1, Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
                  const roomNo = currentRes?.roomNumber || currentRes?.room || 'N/A';

                  // Separate room items from non-room items (incidentals, extras, etc.)
                  const roomItems = [];
                  const nonRoomItems = [];

                  fA.forEach((item) => {
                    const cat = (item.category || '').toLowerCase();
                    const desc = (item.description || item.label || '').toLowerCase();
                    const isRoom = cat === 'room rate' || cat.includes('room charge') || cat.includes('rate') || desc.includes('room tariff') || desc.includes('nightly rate') || desc.includes('room accommodation');
                    if (isRoom) {
                      roomItems.push(item);
                    } else {
                      nonRoomItems.push(item);
                    }
                  });

                  let displayPrintItems = [];
                  let printSubtotal = 0;
                  let printTaxes = 0;
                  let printGrandTotal = 0;
                  let printBalance = 0;

                  if (selectedInvoiceType === 'incidental') {
                    displayPrintItems = nonRoomItems;
                    printSubtotal = addonSubtotal;
                    printTaxes = 0;
                    printGrandTotal = printSubtotal + printTaxes;
                    printBalance = Math.max(0, printGrandTotal - totalPayments);
                  } else if (selectedInvoiceType === 'room_tax') {
                    const rSub = roomSubtotal;
                    const rTax = totalTaxes;
                    const rTot = rSub + rTax;
                    if (roomItems.length > 0) {
                      displayPrintItems = [{
                        id: 'consolidated_room_line',
                        date: `${formatDate(currentRes?.checkIn)} - ${formatDate(currentRes?.checkOut)}`,
                        description: `Room Accommodation Charges (${nightsCount} Night${nightsCount > 1 ? 's' : ''}) - Room ${roomNo}`,
                        type: 'DEBIT',
                        exclTax: rSub,
                        taxAmount: rTax,
                        amountUSD: rTot,
                        amount: rTot
                      }];
                    }
                    printSubtotal = rSub;
                    printTaxes = rTax;
                    printGrandTotal = rTot;
                    printBalance = Math.max(0, printGrandTotal - totalPayments);
                  } else if (selectedInvoiceType === 'detailed') {
                    displayPrintItems = fA;
                    printSubtotal = grossSubtotal;
                    printTaxes = totalTaxes;
                    printGrandTotal = grandTotal;
                    printBalance = balanceDue;
                  } else {
                    // Default: Master Folio Invoice ('master')
                    const rSub = roomSubtotal;
                    const rTax = totalTaxes;
                    const rTot = rSub + rTax;
                    if (roomItems.length > 0) {
                      displayPrintItems = [{
                        id: 'consolidated_room_line',
                        date: `${formatDate(currentRes?.checkIn)} - ${formatDate(currentRes?.checkOut)}`,
                        description: `Room Accommodation Charges (${nightsCount} Night${nightsCount > 1 ? 's' : ''}) - Room ${roomNo}`,
                        type: 'DEBIT',
                        exclTax: rSub,
                        taxAmount: rTax,
                        amountUSD: rTot,
                        amount: rTot
                      }, ...nonRoomItems];
                    } else {
                      displayPrintItems = nonRoomItems;
                    }
                    printSubtotal = grossSubtotal;
                    printTaxes = totalTaxes;
                    printGrandTotal = grandTotal;
                    printBalance = balanceDue;
                  }

                  const guestNameStr = currentRes?.guestName || currentRes?.guest || booking?.guestName || booking?.guest || '';
                  const guestEmailStr = currentRes?.email || currentRes?.guestEmail || booking?.guestEmail || booking?.email || '';
                  const guestPhoneStr = currentRes?.phone || currentRes?.phoneNumber || booking?.guestPhone || booking?.phone || '';
                  const bookingSourceStr = (currentRes?.source || booking?.source || 'Direct').toUpperCase();
                  const paymentMethodStr = currentRes?.paymentMethod || booking?.paymentMethod || selectedPaymentReceipt?.method || 'Cash';

                  const customTerms = getHotelTerms?.() || "";
                  const cancelPolicies = getCancellationPolicies?.() || [];

                  return (
                    <>
                      {/* HEADER SECTION: HOTEL DETAILS (LEFT) & INVOICE TITLE + GUEST INFO (RIGHT) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                        {/* Left: Hotel Info */}
                        <div>
                          {(hp.logoUrl || hp.logo) && (
                            <img
                              src={hp.logoUrl || hp.logo}
                              alt="Hotel Logo"
                              style={{ maxHeight: "50px", maxWidth: "180px", objectFit: "contain", marginBottom: "6px", display: "block" }}
                            />
                          )}
                          <h2 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 4px 0', color: '#000000', textTransform: 'uppercase' }}>
                            {hp.name || "Bhopal Grand Palace Hotel"}
                          </h2>
                          <div style={{ fontSize: '12px', color: '#333333', lineHeight: '1.3' }}>
                            {hp.address || "123 MP Nagar, Zone 1"}<br />
                            {hp.city ? `${hp.city}, ${hp.state || ''} ${hp.zipcode || ''}` : "Bhopal, MP 462011"}<br />
                            Email: {hp.email || "info@bhopalgrandpalace.com"}<br />
                            Phone: {hp.phone || "+91 755 123 4567"}
                          </div>
                        </div>

                        {/* Right: Folio Invoice Title & Guest Contact */}
                        <div style={{ textAlign: 'right' }}>
                          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#64748b', margin: '0 0 2px 0' }}>
                            Folio Invoice
                          </h1>
                          <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
                            Invoice Date: {getBusinessDate()}
                          </div>
                          {guestNameStr && (
                            <div style={{ fontSize: '13px', color: '#000000', fontWeight: '700' }}>
                              {guestNameStr}
                            </div>
                          )}
                          {guestEmailStr && (
                            <div style={{ fontSize: '12px', color: '#333333' }}>
                              {guestEmailStr}
                            </div>
                          )}
                          {guestPhoneStr && (
                            <div style={{ fontSize: '12px', color: '#333333' }}>
                              Phone: {guestPhoneStr}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* STAY METADATA 2-COLUMN GRID */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px', fontSize: '12.5px', color: '#000000' }}>
                        {/* Left Metadata Column */}
                        <div>
                          <div><strong>{currentRes?.resCode || currentRes?.id || booking?.resCode || booking?.id || 'N/A'}</strong></div>
                          <div>Booking date: {formatDate(currentRes?.checkIn || booking?.checkIn)}</div>
                          <div>Check-in: {formatDate(currentRes?.checkIn || booking?.checkIn)} 04:00 PM</div>
                          <div>Check-out: {formatDate(currentRes?.checkOut || booking?.checkOut)} 11:00 AM</div>
                          <div>Room Types: {currentRes?.roomType || booking?.roomType || 'Standard'}</div>
                          <div>Booking ID: {currentRes?.resCode ? currentRes.resCode.replace(/[^0-9]/g, '') || currentRes?.id : 'N/A'}</div>
                        </div>

                        {/* Right Metadata Column */}
                        <div style={{ textAlign: 'right' }}>
                          <div>Nights: {nightsCount}</div>
                          <div>Adults: {currentRes?.adults || booking?.adults || 1}</div>
                          <div>Children: {currentRes?.children || booking?.children || 0}</div>
                          <div>Rate plan(s): {currentRes?.ratePlan || booking?.ratePlan || 'Standard'}</div>
                          <div>Room No.(s): {roomNo}</div>
                          <div>Source: {bookingSourceStr}</div>
                          <div>Payment Status: {printBalance <= 0.01 ? 'Paid' : 'Unpaid'}</div>
                          <div>Booking Status: {(currentRes?.status || booking?.status || 'CHECKED_IN').toUpperCase()}</div>
                        </div>
                      </div>

                      {/* CHARGES TABLE */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', color: '#000000', borderBottom: '1px solid #cbd5e1' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Date</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Description</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Type</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>Sub-total</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>Tax</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayPrintItems.length === 0 ? (
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td colSpan={6} style={{ padding: '12px 10px', color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
                                No charges recorded for this invoice category.
                              </td>
                            </tr>
                          ) : (
                            displayPrintItems.map((item, idx) => {
                              const dateStr = item.date ? (String(item.date).includes('-') && String(item.date).length > 10 ? item.date : formatDate(item.date)) : formatDate(currentRes?.checkIn);
                              const subtotalVal = Number(item.exclTax !== undefined ? item.exclTax : (item.amountUSD || item.amount || 0));
                              const taxVal = Number(item.taxAmount !== undefined ? item.taxAmount : 0);
                              const totalVal = Number(item.amountUSD || item.amount || (subtotalVal + taxVal));

                              const cat = (item.category || '').toLowerCase();
                              const desc = (item.description || item.label || '').toLowerCase();
                              const isRoomLine = cat === 'room rate' || cat.includes('room charge') || cat.includes('rate') || desc.includes('room tariff') || desc.includes('nightly rate') || desc.includes('room accommodation') || item.id === 'consolidated_room_line';
                              const shouldMask = isPrepaid && (isRoomLine || selectedInvoiceType === 'room_tax' || selectedInvoiceType === 'master');

                              return (
                                <tr key={item.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '8px 10px' }}>{dateStr}</td>
                                  <td style={{ padding: '8px 10px' }}>{item.description || item.label || 'Booking Price'}</td>
                                  <td style={{ padding: '8px 10px' }}>DEBIT</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{shouldMask ? '********' : `$ ${subtotalVal.toFixed(2)}`}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{shouldMask ? '********' : `$ ${taxVal.toFixed(2)}`}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>{shouldMask ? '********' : `$ ${totalVal.toFixed(2)}`}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>

                      {/* TAX BREAKDOWN & FINANCIAL SUMMARY SIDE-BY-SIDE */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', margin: '20px 0 28px 0' }}>
                        {/* Left: Tax Breakdown */}
                        <div>
                          <div style={{ fontWeight: '700', marginBottom: '6px', fontSize: '13px', color: '#000000' }}>Tax breakdown</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '700' }}>Tax Name</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>Tax Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemizedTaxLines.length > 0 ? (
                                itemizedTaxLines.map((tax, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '6px 8px' }}>{tax.name.toUpperCase()}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{isPrepaid ? '********' : `$ ${tax.amount.toFixed(2)}`}</td>
                                  </tr>
                                ))
                              ) : (
                                <>
                                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '6px 8px' }}>OCCUPANCY TAX</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{isPrepaid ? '********' : `$ ${(printTaxes * 0.25).toFixed(2)}`}</td>
                                  </tr>
                                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '6px 8px' }}>STATE TAX</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{isPrepaid ? '********' : `$ ${(printTaxes * 0.75).toFixed(2)}`}</td>
                                  </tr>
                                </>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Right: Summary Totals */}
                        <div style={{ textAlign: 'right', fontSize: '13px', lineHeight: '1.7', color: '#000000' }}>
                          <div><span style={{ display: 'inline-block', width: '150px', color: '#333333' }}>Sub total:</span> <strong>{isPrepaid ? '********' : `$ ${printSubtotal.toFixed(2)}`}</strong></div>
                          <div><span style={{ display: 'inline-block', width: '150px', color: '#333333' }}>Tax &amp; Fees:</span> <strong>{isPrepaid ? '********' : `$ ${printTaxes.toFixed(2)}`}</strong></div>
                          <div><span style={{ display: 'inline-block', width: '150px', color: '#333333' }}>Total:</span> <strong>{isPrepaid ? '********' : `$ ${printGrandTotal.toFixed(2)}`}</strong></div>
                          <div><span style={{ display: 'inline-block', width: '150px', color: '#333333' }}>Paid via {paymentMethodStr}:</span> <strong>{isPrepaid ? '********' : `$ ${totalPayments.toFixed(2)}`}</strong></div>
                          <div style={{ fontSize: '13.5px', fontWeight: '800', marginTop: '4px' }}>
                            <span style={{ display: 'inline-block', width: '150px', color: '#000000' }}>Balance due:</span> <strong>{isPrepaid ? '********' : `$ ${Math.max(0, printBalance).toFixed(2)}`}</strong>
                          </div>
                        </div>
                      </div>

                      {/* SIGNATURES ROW */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '36px 0 28px 0', fontSize: '12.5px', color: '#000000' }}>
                        <div>
                          Guest Signature : {currentRes?.digitalSignature || booking?.digitalSignature ? (
                            <img src={currentRes?.digitalSignature || booking?.digitalSignature} alt="Signature" style={{ maxHeight: '28px', verticalAlign: 'bottom', marginLeft: '8px' }} />
                          ) : guestNameStr ? (
                            <span style={{ fontFamily: 'cursive', fontSize: '18px', borderBottom: '1px solid #000', paddingBottom: '2px', marginLeft: '8px' }}>{guestNameStr}</span>
                          ) : (
                            <span>_____________________</span>
                          )}
                        </div>
                        <div>Authorized Signature : _____________________</div>
                      </div>

                      {/* TERMS & CANCELLATION POLICIES */}
                      <div style={{ fontSize: '11px', color: '#333333', lineHeight: '1.45', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                        <div style={{ fontWeight: '700', textDecoration: 'underline', marginBottom: '4px' }}>Property Terms &amp; Policies</div>
                        {customTerms ? (
                          <div style={{ whiteSpace: 'pre-wrap', margin: '0 0 6px 0' }}>{customTerms}</div>
                        ) : (
                          <ul style={{ margin: '0', paddingLeft: '16px', listStyleType: 'disc' }}>
                            <li>{hp.name || "Bhopal Grand Palace Hotel"} assumes no responsibility for accidents, injuries, theft, or loss of personal belongings.</li>
                            <li>Guests are responsible for any personal injuries or property damage caused by themselves or their visitors during their stay.</li>
                            <li>In accordance with hotel regulations, smoking in non-smoking rooms or bringing unauthorized pets into rooms will incur additional cleaning or penalty fees.</li>
                          </ul>
                        )}
                        {cancelPolicies.length > 0 && (
                          <>
                            <div style={{ fontWeight: '700', textDecoration: 'underline', marginTop: '8px', marginBottom: '4px' }}>Cancellation Policies</div>
                            <ul style={{ margin: '0', paddingLeft: '16px', listStyleType: 'disc' }}>
                              {cancelPolicies.map((pol, pIdx) => (
                                <li key={pIdx}><strong>{pol.name || pol.title || 'Policy'}:</strong> {pol.description || pol.detail || JSON.stringify(pol)}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPrintModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={handleTriggerInvoicePrint}>
                <Printer size={16} /> Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-backdrop" >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', margin: 0 }}>
              <h3 style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '15px', fontWeight: 700 }}>
                ✉️ Email Guest Invoice
              </h3>
              <button className="close-btn" onClick={() => setShowEmailModal(false)}>×</button>
            </div>

            <div className="modal-body" style={{ padding: '18px 20px', background: '#ffffff' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="guest@example.com"
                  style={{ width: '100%', height: '38px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: '#0f172a', fontWeight: '600', boxSizing: 'border-box' }}
                  required
                />
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '12px 20px', background: '#f8fafc', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 16px 16px' }}>
              <button
                type="button"
                className="btn-lg-grey"
                onClick={() => setShowEmailModal(false)}
                style={{ borderRadius: '8px', height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
              >
                Cancel
              </button>

              {(() => {
                const hp = getHotelProfile?.() || {};
                const hotelName = hp.name || "PEA SOUP ANDERSEN'S INN";
                const subject = `Official Folio Receipt & Statement — ${hotelName} (Ref: ${currentRes?.id || ''})`;
                const body = `Dear ${currentRes?.guestName || currentRes?.guest || 'Guest'},\n\n` +
                  `Thank you for staying with us at ${hotelName}.\n\n` +
                  `Below is your complete itemized Folio Summary Statement:\n` +
                  `--------------------------------------------------\n` +
                  `Reservation Ref: ${currentRes?.id || 'N/A'}\n` +
                  `Guest Name: ${currentRes?.guestName || currentRes?.guest || 'Guest'}\n` +
                  `Assigned Room: Room ${currentRes?.roomNumber || currentRes?.room || 'N/A'} (${currentRes?.roomType || 'Standard'})\n` +
                  `Check-In Date: ${currentRes?.checkIn || ''}\n` +
                  `Check-Out Date: ${currentRes?.checkOut || ''}\n\n` +
                  `FINANCIAL SUMMARY STATEMENT:\n` +
                  `Total Charges: $${totalCharges.toFixed(2)}\n` +
                  `Total Taxes & Fees: $${totalTaxes.toFixed(2)}\n` +
                  `Grand Total: $${grandTotal.toFixed(2)}\n` +
                  `Total Payments Collected: $${totalPayments.toFixed(2)}\n` +
                  `Current Balance Due: $${balanceDue.toFixed(2)}\n` +
                  `--------------------------------------------------\n\n` +
                  `Warm regards,\n` +
                  `Front Desk Operations Team\n` +
                  `${hotelName}`;
                const mailtoUrl = emailRecipient.trim() ? `mailto:${encodeURIComponent(emailRecipient.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : "#";

                return (
                  <a
                    href={mailtoUrl}
                    className="btn-lg-grey cr-submit-primary"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: '8px', height: '36px', padding: '0 20px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
                    onClick={(e) => {
                      if (!emailRecipient.trim()) {
                        e.preventDefault();
                        showToast?.("⚠️ Please enter a valid recipient email address.");
                      } else {
                        recordAuditLog(
                          'Folio Invoice Emailed',
                          `Emailed complete itemized folio statement to ${emailRecipient}`
                        );
                        showToast?.(`Folio invoice sent to ${emailRecipient}`);
                        setShowEmailModal(false);
                      }
                    }}
                  >
                    <Mail size={15} /> Send Email
                  </a>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 1. MODIFY CHECK-IN MODAL */}
      {showModifyCheckInModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>📅 Modify Arrival / Check-In Date</h3>
              <button className="close-btn" onClick={() => setShowModifyCheckInModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveModifyCheckIn}>
              <div className="modal-body">
                <p style={{ fontSize: '13.5px', color: '#64748b', marginBottom: '16px' }}>
                  Update the arrival date for <strong>{currentRes?.guestName || currentRes?.guest}</strong> (Room {currentRes?.roomNumber || currentRes?.room}). Nightly room tariffs will be dynamically adjusted.
                </p>
                <div className="form-group">
                  <label style={{ fontWeight: '700' }}>New Arrival / Check-In Date</label>
                  <CustomDatePicker
                    value={modifyCheckInDate}
                    onChange={(e) => setModifyCheckInDate(e.target.value)}
                    required
                  />
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '12.5px', color: '#475569' }}>
                  <span>Current Check-Out: <strong>{formatDate(currentRes?.checkOut)}</strong></span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModifyCheckInModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Check-In Date</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODIFY CHECKOUT MODAL */}
      {showModifyCheckoutModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>📅 Modify Departure / Checkout Date</h3>
              <button className="close-btn" onClick={() => setShowModifyCheckoutModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveModifyCheckout}>
              <div className="modal-body">
                <p style={{ fontSize: '13.5px', color: '#64748b', marginBottom: '16px' }}>
                  Extend or shorten the stay for <strong>{currentRes?.guestName || currentRes?.guest}</strong> (Room {currentRes?.roomNumber || currentRes?.room}). Room charges will update automatically.
                </p>
                <div className="form-group">
                  <label style={{ fontWeight: '700' }}>New Departure / Checkout Date</label>
                  <CustomDatePicker
                    value={modifyCheckoutDate}
                    onChange={(e) => setModifyCheckoutDate(e.target.value)}
                    required
                  />
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '12.5px', color: '#475569' }}>
                  <span>Current Check-In: <strong>{formatDate(currentRes?.checkIn)}</strong></span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModifyCheckoutModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Checkout Date</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ROOM MOVE MODAL WITH CUSTOM ROOM PICKER UI */}
      {showRoomMoveModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', borderRadius: '16px', padding: '24px' }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🚪 Transfer Guest / Room Move
              </h3>
              <button className="close-btn" onClick={() => setShowRoomMoveModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleSaveRoomMove}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* GUEST & CURRENT STAY BANNER */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>GUEST &amp; CURRENT ROOM</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {currentRes?.guestName || currentRes?.guest} <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: '700' }}>(Room {currentRes?.roomNumber || currentRes?.room})</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>STAY PERIOD</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                      {currentRes?.checkIn} ➔ {currentRes?.checkOut} ({currentRes?.nights || 1} Nights)
                    </div>
                  </div>
                </div>

                {/* TARGET ROOM SELECTION CONTAINER */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontWeight: '800', fontSize: '13.5px', color: '#0f172a', margin: 0 }}>
                      Select Target Available Room
                    </label>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                      {getTrulyAvailableTargetRooms().length} Available
                    </span>
                  </div>

                  {/* SEARCH INPUT */}
                  <input
                    type="text"
                    placeholder="🔍 Filter by room number or type..."
                    value={roomSearchFilter}
                    onChange={(e) => setRoomSearchFilter(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />

                  {/* SCROLLABLE CUSTOM ROOM SELECTION CARDS LIST */}
                  <div style={{ maxHeight: '210px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '6px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(() => {
                      const availRooms = getTrulyAvailableTargetRooms().filter((r) => {
                        if (!roomSearchFilter) return true;
                        const q = roomSearchFilter.toLowerCase();
                        const rNo = String(r.no || r.number || r.id || "").toLowerCase();
                        const rType = String(r.type || r.roomType || "").toLowerCase();
                        return rNo.includes(q) || rType.includes(q);
                      });

                      if (availRooms.length === 0) {
                        return (
                          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>
                            {roomSearchFilter ? "No rooms match search criteria." : "⚠️ No available rooms found for this stay period. All other rooms are currently occupied."}
                          </div>
                        );
                      }

                      return availRooms.map((r) => {
                        const rmId = String(r.no || r.number || r.id);
                        const isSelected = String(targetMoveRoom) === rmId;
                        const isClean = String(r.housekeeping || "").toLowerCase() === 'clean';

                        return (
                          <div
                            key={rmId}
                            onClick={() => {
                              setTargetMoveRoom(rmId);
                              if (r.rate || r.price || r.ratePerNight) {
                                setMoveRoomRate(String(r.rate || r.price || r.ratePerNight));
                              }
                            }}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              background: isSelected ? '#eff6ff' : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                border: isSelected ? '6px solid #2563eb' : '2px solid #cbd5e1',
                                background: '#ffffff',
                                boxSizing: 'border-box'
                              }} />
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '800', color: isSelected ? '#1e40af' : '#0f172a' }}>
                                  Room {rmId}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                                  {r.type || r.roomType || 'Standard Room'}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: isClean ? '#dcfce7' : '#fef3c7',
                                color: isClean ? '#166534' : '#92400e'
                              }}>
                                {isClean ? '✓ Clean' : '🧹 Dirty'}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                                ${r.rate || r.price || r.ratePerNight || 149}/night
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* NIGHTLY TARIFF RATE */}
                <div className="form-group">
                  <label style={{ fontWeight: '800', fontSize: '13.5px', color: '#0f172a' }}>
                    Nightly Tariff Rate ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={moveRoomRate}
                    onChange={(e) => setMoveRoomRate(e.target.value)}
                    required
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

              </div>

              <div className="modal-footer" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRoomMoveModal(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!targetMoveRoom || getTrulyAvailableTargetRooms().length === 0}
                  style={{ fontWeight: '800' }}
                >
                  Confirm Room Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. SPLIT ROOM MODAL */}
      {showSplitRoomModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3>✂️ Split Reservation / Room Nights</h3>
              <button className="close-btn" onClick={() => setShowSplitRoomModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveSplitRoom}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
                  Split the stay for <strong>{currentRes?.guestName || currentRes?.guest}</strong> into two separate booking legs starting on the split date.
                </p>

                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '12.5px', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    1. Split Effective Date (Second Leg Starts On) *
                  </label>
                  <CustomDatePicker
                    value={splitDate}
                    min={currentRes?.checkIn}
                    max={currentRes?.checkOut}
                    onChange={(e) => setSplitDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '12.5px', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    2. Second Leg Room Number (Move To) *
                  </label>
                  <select
                    value={splitRoomNumber || (currentRes?.roomNumber || currentRes?.room || '')}
                    onChange={(e) => setSplitRoomNumber(e.target.value)}
                    required
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%', fontWeight: 700, color: '#0f172a', background: '#ffffff' }}
                  >
                    <option value={currentRes?.roomNumber || currentRes?.room || ''}>
                      Room {currentRes?.roomNumber || currentRes?.room} (Same Room - Split Reservation)
                    </option>
                    {getTrulyAvailableTargetRooms().map((r) => {
                      const rNo = String(r.no || r.number || r.id);
                      return (
                        <option key={rNo} value={rNo}>
                          Room {rNo} {r.type ? `(${r.type})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '12.5px', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    3. Second Leg Guest Name *
                  </label>
                  <input
                    type="text"
                    value={splitGuestName}
                    onChange={(e) => setSplitGuestName(e.target.value)}
                    required
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%', fontWeight: 700 }}
                  />
                </div>

                {/* STAY LEGS BREAKDOWN SUMMARY BOX */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                    📋 Stay Legs Breakdown Preview
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                    <span><strong>Leg 1 (Original):</strong> Room {currentRes?.roomNumber || currentRes?.room}</span>
                    <span>{currentRes?.checkIn} ➔ {splitDate}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#0f172a', fontWeight: '700', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                    <span><strong>Leg 2 (Remaining):</strong> Room {splitRoomNumber || (currentRes?.roomNumber || currentRes?.room)} ({splitGuestName || "Guest"})</span>
                    <span>{splitDate} ➔ {currentRes?.checkOut}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSplitRoomModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>✂️ Confirm Split Stay</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. EDIT GUEST PROFILE MODAL */}
      {showEditGuestProfileModal && (
        <div className="modal-backdrop" >
          <div className="modal-content glassmorphism" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>👤 Edit Guest Profile &amp; Contact Details</h3>
              <button className="close-btn" onClick={() => setShowEditGuestProfileModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveEditGuestProfile}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontWeight: '700' }}>Guest Full Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '14px', width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700' }}>Phone Number</label>
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '14px', width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700' }}>Email Address</label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="guest@example.com"
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '14px', width: '100%' }}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontWeight: '700' }}>Physical / Residential Address</label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    placeholder="Street, City, Country"
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '14px', width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700' }}>ID Document Type</label>
                  <select
                    value={profileIdType}
                    onChange={(e) => setProfileIdType(e.target.value)}
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '14px', width: '100%' }}
                  >
                    <option value="Passport">Passport</option>
                    <option value="Driver License">Driver License</option>
                    <option value="National ID">National ID Card</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700' }}>ID / Passport Number</label>
                  <input
                    type="text"
                    value={profileIdNumber}
                    onChange={(e) => setProfileIdNumber(e.target.value)}
                    placeholder="Document Number"
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '14px', width: '100%' }}
                  />
                </div>

                {/* Credit Card Guarantee Details */}
                <div style={{ gridColumn: 'span 2', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    💳 Credit Card &amp; Payment Guarantee Details
                  </h4>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontWeight: '700' }}>Cardholder Name</label>
                  <input
                    type="text"
                    value={profileCardName}
                    onChange={(e) => setProfileCardName(e.target.value)}
                    placeholder="Name as printed on card"
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '14px', width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700' }}>Card Number</label>
                  <input
                    type="text"
                    maxLength="19"
                    value={profileCardNumber}
                    onChange={(e) => setProfileCardNumber(e.target.value)}
                    placeholder="•••• •••• •••• ••••"
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '14px', width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: '700' }}>Expiry Date</label>
                    <input
                      type="text"
                      maxLength="5"
                      value={profileCardExpiry}
                      onChange={(e) => setProfileCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '14px', width: '100%' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: '700' }}>CVV / CVC</label>
                    <input
                      type="password"
                      maxLength="4"
                      value={profileCardCvv}
                      onChange={(e) => setProfileCardCvv(e.target.value)}
                      placeholder="•••"
                      style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '14px', width: '100%' }}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditGuestProfileModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Profile Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODIFY RATE PLAN MODAL - White & Light Grey Theme */}
      {showModifyRatePlanModal && (
        <div className="modal-backdrop"  style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', padding: 0 }}>
            <div className="modal-header" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏷️ Modify Rate Plan &amp; Nightly Tariff
              </h3>
              <button type="button" className="close-btn" onClick={() => setShowModifyRatePlanModal(false)} style={{ background: '#e2e8f0', border: 'none', color: '#475569', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <form onSubmit={handleSaveModifyRatePlan}>
              <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff' }}>
                <div className="form-group">
                  <label style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: '#334155', fontSize: '13.5px' }}>Select Rate Plan Package</label>
                  <select
                    value={selectedRatePlan}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      setSelectedRatePlan(selectedVal);
                      const plans = getRatePlans();
                      const matched = plans.find(p => p.name === selectedVal || p.code === selectedVal);
                      const newNights = getRatePlanNights(matched, selectedVal);
                      setRatePlanNights(newNights);
                      if (matched && (matched.rate || matched.adjustment || matched.price)) {
                        setRatePlanTariff(String(matched.rate || matched.adjustment || matched.price));
                      }
                    }}
                    style={{ width: '100%', padding: '10px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', color: '#0f172a', outline: 'none' }}
                  >
                    {(() => {
                      const plans = getRatePlans();
                      const list = plans.length > 0 ? plans : [{ id: 'daily-rate', name: 'Daily Rate', code: 'DAILY', description: 'Standard Daily Rate' }];
                      
                      const hasCurrent = selectedRatePlan && list.some(p => p.name === selectedRatePlan || p.code === selectedRatePlan);
                      const fullList = (!hasCurrent && selectedRatePlan) ? [{ id: 'custom-current', name: selectedRatePlan, code: selectedRatePlan }, ...list] : list;
                      
                      return fullList.map((plan, idx) => (
                        <option key={plan.id || plan.name || idx} value={plan.name}>
                          {plan.name} {plan.code ? `(${plan.code})` : ''} {plan.description ? `— ${plan.description}` : ''}
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: '#334155', fontSize: '13.5px' }}>Stay Duration (Nights)</label>
                    <input
                      type="number"
                      min="1"
                      value={ratePlanNights}
                      onChange={(e) => setRatePlanNights(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', color: '#0f172a', outline: 'none' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: '#334155', fontSize: '13.5px' }}>Nightly Tariff Rate ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ratePlanTariff}
                      onChange={(e) => setRatePlanTariff(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', color: '#0f172a', outline: 'none' }}
                    />
                  </div>
                </div>

                {currentRes?.checkIn && (
                  <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: '600', color: '#334155' }}>Check-In:</span> {formatDate(currentRes.checkIn)}
                    </div>
                    <div style={{ color: '#94a3b8' }}>➔</div>
                    <div>
                      <span style={{ fontWeight: '600', color: '#334155' }}>New Check-Out:</span> {formatDate(calculateCheckOutDate(currentRes.checkIn, Math.max(1, parseInt(ratePlanNights, 10) || 1)) || currentRes.checkOut)}
                    </div>
                    <div style={{ fontWeight: '700', color: '#0f172a', background: '#e2e8f0', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      {Math.max(1, parseInt(ratePlanNights, 10) || 1)} {parseInt(ratePlanNights, 10) === 1 ? 'Night' : 'Nights'}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModifyRatePlanModal(false)} style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', fontWeight: '700', borderRadius: '8px', padding: '9px 18px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn" style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: '800', borderRadius: '8px', padding: '9px 20px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>Save Rate Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6B. MODIFY MARKET SEGMENT MODAL - White & Light Grey Theme */}
      {showModifySegmentModal && (
        <div className="modal-backdrop"  style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 99999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', padding: 0 }}>
            <div className="modal-header" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏷️ Modify Market Segment &amp; Channel Source
              </h3>
              <button type="button" className="close-btn" onClick={() => setShowModifySegmentModal(false)} style={{ background: '#e2e8f0', border: 'none', color: '#475569', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <form onSubmit={handleSaveMarketSegment}>
              <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff' }}>
                <div className="form-group">
                  <label style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: '#334155', fontSize: '13.5px' }}>Market Segment Category</label>
                  <select
                    value={selectedSegmentVal}
                    onChange={(e) => {
                      const nextSeg = e.target.value;
                      setSelectedSegmentVal(nextSeg);
                      const bSources = typeof getBusinessSources === 'function' ? getBusinessSources() : [];
                      const matched = bSources.find(b => b.segment === nextSeg || b.id === nextSeg);
                      if (matched && Array.isArray(matched.subSegments) && matched.subSegments.length > 0) {
                        setSelectedSubSegmentVal(matched.subSegments[0]);
                      }
                    }}
                    style={{ width: '100%', padding: '10px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', color: '#0f172a', outline: 'none', fontWeight: '600' }}
                  >
                    {(() => {
                      const bSources = typeof getBusinessSources === 'function' ? getBusinessSources() : [];
                      const list = bSources.length > 0 ? bSources : [
                        { id: 'src_direct', segment: 'DIRECT', subSegments: ['WALK-IN', 'PHONE', 'WEBSITE'] },
                        { id: 'src_ota', segment: 'OTA', subSegments: ['BOOKING.COM', 'EXPEDIA', 'AGODA', 'AIRBNB'] },
                        { id: 'src_company', segment: 'COMPANY', subSegments: ['CORPORATE ACCOUNT'] },
                        { id: 'src_agent', segment: 'TRAVEL AGENT', subSegments: ['EXPEDIA TAAP', 'LOCAL AGENT'] }
                      ];
                      return list.map((bs, idx) => (
                        <option key={bs.id || bs.segment || idx} value={bs.segment}>
                          {bs.segment}
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: '#334155', fontSize: '13.5px' }}>Sub-Segment / Channel Source</label>
                  <input
                    type="text"
                    list="sub-segment-options-list"
                    value={selectedSubSegmentVal}
                    onChange={(e) => setSelectedSubSegmentVal(e.target.value)}
                    placeholder="e.g. WALK-IN, BOOKING.COM, PHONE"
                    required
                    style={{ width: '100%', padding: '10px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', color: '#0f172a', outline: 'none', fontWeight: '600' }}
                  />
                  <datalist id="sub-segment-options-list">
                    {(() => {
                      const bSources = typeof getBusinessSources === 'function' ? getBusinessSources() : [];
                      const matched = bSources.find(b => b.segment === selectedSegmentVal);
                      if (matched && Array.isArray(matched.subSegments)) {
                        return matched.subSegments.map((sub, idx) => (
                          <option key={idx} value={sub} />
                        ));
                      }
                      return null;
                    })()}
                  </datalist>
                  <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Select a suggested channel or type a custom sub-segment name.
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModifySegmentModal(false)} style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>Save Market Segment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. APPLY DISCOUNT MODAL (% & $ options) - White & Grey Theme */}
      {showApplyDiscountModal && (
        <div className="modal-backdrop"  style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', padding: 0 }}>
            <div className="modal-header" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎟️ Apply Guest Folio Discount
              </h3>
              <button type="button" className="close-btn" onClick={() => setShowApplyDiscountModal(false)} style={{ background: '#e2e8f0', border: 'none', color: '#475569', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <form onSubmit={handleConfirmApplyDiscount}>
              <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff' }}>
                
                {/* Discount Mode Selector: Percentage (%) vs Fixed ($) */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', marginBottom: '8px', display: 'block', color: '#334155', fontSize: '13.5px' }}>Select Discount Mode</label>
                  <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        fontWeight: '800',
                        fontSize: '13.5px',
                        borderRadius: '7px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: discountType === 'percentage' ? '#ffffff' : 'transparent',
                        color: discountType === 'percentage' ? '#0f172a' : '#64748b',
                        border: discountType === 'percentage' ? '1px solid #cbd5e1' : 'none',
                        boxShadow: discountType === 'percentage' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      % Percentage Discount
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        fontWeight: '800',
                        fontSize: '13.5px',
                        borderRadius: '7px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: discountType === 'fixed' ? '#ffffff' : 'transparent',
                        color: discountType === 'fixed' ? '#0f172a' : '#64748b',
                        border: discountType === 'fixed' ? '1px solid #cbd5e1' : 'none',
                        boxShadow: discountType === 'fixed' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      $ Fixed Dollar Discount
                    </button>
                  </div>
                </div>

                {/* Value Input */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: '#334155', fontSize: '13.5px' }}>
                    {discountType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Dollar Amount ($ USD)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={discountType === 'percentage' ? '100' : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'percentage' ? 'e.g. 10 for 10%' : 'e.g. 25.00 for $25.00'}
                    required
                    style={{ background: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '15px', fontWeight: '700', width: '100%' }}
                  />
                </div>

                {/* Reason Input */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: '#334155', fontSize: '13.5px' }}>Discount Reason / Justification</label>
                  <input
                    type="text"
                    value={customDiscountReason}
                    onChange={(e) => setCustomDiscountReason(e.target.value)}
                    placeholder="Enter discount reason or justification (e.g. VIP Special, Service Recovery)..."
                    style={{ background: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', width: '100%' }}
                  />
                </div>

                {/* Live Preview Box */}
                {(() => {
                  const val = parseFloat(discountValue) || 0;
                  const grossSubtotal = totalCharges > 0 ? totalCharges : (currentFolio.folioA || []).reduce((acc, item) => acc + (Number(item.amountUSD || item.amount) || 0), 0);
                  const calcAmt = discountType === 'percentage' ? (grossSubtotal * val / 100) : val;
                  const netCharges = Math.max(0, grossSubtotal - calcAmt);

                  return (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', fontSize: '13.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: '#64748b', fontWeight: '500' }}>Current Gross Charges:</span>
                        <strong style={{ color: '#0f172a' }}>{formatUSD(grossSubtotal)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#16a34a', fontWeight: '800' }}>
                        <span>Discount Deduction ({discountType === 'percentage' ? `${val}%` : formatUSD(val)}):</span>
                        <span>-{formatUSD(calcAmt)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontWeight: '800', color: '#0f172a' }}>
                        <span>New Estimated Charges:</span>
                        <span style={{ color: '#0f172a', fontSize: '15px' }}>{formatUSD(netCharges)}</span>
                      </div>
                    </div>
                  );
                })()}

              </div>
              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowApplyDiscountModal(false)} style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', fontWeight: '700', borderRadius: '8px', padding: '9px 18px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn" style={{ background: '#0f172a', color: '#ffffff', border: 'none', fontWeight: '800', borderRadius: '8px', padding: '9px 20px', cursor: 'pointer' }}>Confirm &amp; Apply Discount</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. TAX EXEMPTION MODAL (All Taxes vs Selective Taxes) */}
      {showTaxExemptModal && (
        <div className="modal-backdrop" >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
            <div className="modal-header" style={{ padding: '12px 18px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', margin: 0 }}>🛡️ Manage Guest Tax Exemption</h3>
              <button className="close-btn" onClick={() => setShowTaxExemptModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveTaxExempt}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px 18px' }}>
                
                {/* Exemption Scope Selector: All Taxes vs Selective Taxes */}
                <div className="form-group">
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>
                    Tax Exemption Scope
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTaxExemptScope('all')}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        fontSize: '12px',
                        fontWeight: '700',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        background: taxExemptScope === 'all' ? '#0f172a' : '#ffffff',
                        color: taxExemptScope === 'all' ? '#ffffff' : '#475569',
                        border: taxExemptScope === 'all' ? '1px solid #0f172a' : '1px solid #cbd5e1',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      🛡️ Exempt All Taxes (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxExemptScope('selective')}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        fontSize: '12px',
                        fontWeight: '700',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        background: taxExemptScope === 'selective' ? '#0f172a' : '#ffffff',
                        color: taxExemptScope === 'selective' ? '#ffffff' : '#475569',
                        border: taxExemptScope === 'selective' ? '1px solid #0f172a' : '1px solid #cbd5e1',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      📝 Selective Tax Exemption
                    </button>
                  </div>
                </div>

                {/* Selective Taxes List */}
                {taxExemptScope === 'selective' && (
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 12px' }}>
                    <span style={{ fontWeight: '700', marginBottom: '8px', display: 'block', color: '#0f172a', fontSize: '12px' }}>
                      Select Specific Configured Taxes to Exempt:
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {availableSystemTaxes.length > 0 ? (
                        availableSystemTaxes.map((tax) => {
                          const taxId = tax.id || tax.name;
                          const isChecked = selectedExemptTaxIds.includes(taxId) || selectedExemptTaxIds.includes(tax.name);
                          const taxValDisplay = tax.taxType === 'fixed'
                            ? `$${tax.fixedAmount || tax.amount || 0} Fixed`
                            : `${tax.percent || tax.percentage || tax.rate || 0}%`;

                          return (
                            <div
                              key={taxId}
                              onClick={() => handleToggleExemptTaxId(taxId)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                background: '#ffffff',
                                border: isChecked ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                                boxShadow: isChecked ? '0 1px 3px rgba(15,23,42,0.06)' : 'none',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  style={{
                                    width: '15px',
                                    height: '15px',
                                    accentColor: '#0f172a',
                                    cursor: 'pointer',
                                    margin: 0,
                                    flexShrink: 0
                                  }}
                                />
                                <span style={{ fontSize: '12.5px', fontWeight: isChecked ? '700' : '600', color: isChecked ? '#0f172a' : '#334155' }}>
                                  {tax.name}
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: isChecked ? '#0f172a' : '#64748b', background: isChecked ? '#f1f5f9' : '#f8fafc', padding: '2px 7px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                {taxValDisplay}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', padding: '6px 0', textAlign: 'center' }}>
                          No active tax rules configured in System Settings.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tax Exemption Certificate / ID Number */}
                <div className="form-group">
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Tax Exemption Certificate / ID Number
                  </label>
                  <input
                    type="text"
                    value={taxExemptCertNo}
                    onChange={(e) => setTaxExemptCertNo(e.target.value)}
                    placeholder="e.g. EXEMPT-GOV-9821 or TAX-8842"
                    style={{ padding: '7px 11px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', width: '100%' }}
                  />
                </div>

                {/* Reason Selector */}
                <div className="form-group">
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Exemption Justification / Category
                  </label>
                  <select
                    value={taxExemptReason}
                    onChange={(e) => setTaxExemptReason(e.target.value)}
                    style={{ padding: '7px 11px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', width: '100%' }}
                  >
                    <option value="Government Official">Government Official / Agency</option>
                    <option value="Diplomatic Status">Diplomatic Immunity / Embassy</option>
                    <option value="Non-Profit Organization">Charitable / Non-Profit Org</option>
                    <option value="State Employee">State / Federal Employee on Duty</option>
                    <option value="Corporate Exemption">Reseller / Corporate Tax Exemption</option>
                    <option value="Other">Other / Custom Reason</option>
                  </select>
                </div>

                {taxExemptReason === 'Other' && (
                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Custom Reason Details
                    </label>
                    <input
                      type="text"
                      value={customTaxExemptReason}
                      onChange={(e) => setCustomTaxExemptReason(e.target.value)}
                      placeholder="Enter justification..."
                      required
                      style={{ padding: '7px 11px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', width: '100%' }}
                    />
                  </div>
                )}

              </div>
              <div className="modal-footer" style={{ padding: '10px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {currentRes?.isTaxExempt ? (
                  <button type="button" onClick={handleClearTaxExempt} style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', fontWeight: '700', fontSize: '11.5px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                    Remove Exemption
                  </button>
                ) : <div />}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowTaxExemptModal(false)} style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '12px', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: '#0f172a', color: '#ffffff', border: '1px solid #0f172a', fontWeight: '700', fontSize: '12px', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                    Save Tax Exemption
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Add Reservation Note Modal */}
      {showEditNoteModal && (
        <div className="modal-backdrop"  style={{ zIndex: 999999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📝 {editingNoteId ? 'Edit Reservation Note' : 'Add New Reservation Note'}
              </h3>
              <button type="button" className="close-btn" onClick={() => setShowEditNoteModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', fontWeight: '700', color: '#64748b', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveSingleNote(editingNoteText); }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '18px 20px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    Note Text / Special Request
                  </label>
                  <textarea
                    rows={4}
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    placeholder="e.g. Quiet room requested, High floor, Extra pillows, Arriving late after 8 PM..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: '1.5'
                    }}
                    autoFocus
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditNoteModal(false)}
                  style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', fontWeight: '700', borderRadius: '8px', padding: '9px 18px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#0284c7', color: '#ffffff', border: 'none', fontWeight: '800', borderRadius: '8px', padding: '9px 20px', cursor: 'pointer', fontSize: '13px' }}
                >
                  {editingNoteId ? 'Save Changes' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Preview Media Lightbox Modal */}
      {previewMediaItem && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '750px', width: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '16px 20px', background: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: '15px' }}>
                👁️ Document Preview: {previewMediaItem.title || 'Guest Image'}
              </div>
              <button
                type="button"
                onClick={() => setPreviewMediaItem(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '18px', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '20px', background: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '300px', maxHeight: '60vh', overflow: 'auto' }}>
              <img src={previewMediaItem.url} alt={previewMediaItem.title} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '12.5px', color: '#475569' }}>
                {previewMediaItem.idNumber && <div>Document ID: <strong>{previewMediaItem.idNumber}</strong> ({previewMediaItem.issueCountry})</div>}
                {previewMediaItem.source && <div>Source: <strong>{previewMediaItem.source}</strong></div>}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={previewMediaItem.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{ background: '#0284c7', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}
                >
                  📥 Download Full Image
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewMediaItem(null)}
                  style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Upload / Add Scanned Doc Modal */}
      {showAddScannedDocModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '500px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: '#ffffff', color: '#0f172a', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>➕ Upload Scanned Identity Document</h3>
              <button type="button" onClick={() => setShowAddScannedDocModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <form onSubmit={handleSaveNewScannedDoc} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Document Type</label>
                <select value={newDocType} onChange={(e) => setNewDocType(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontWeight: 600 }}>
                  <option value="US Driver's License">US Driver's License</option>
                  <option value="Passport">Passport</option>
                  <option value="State ID">State ID Card</option>
                  <option value="National ID">National ID Card</option>
                  <option value="Aadhaar Card">Aadhaar Card</option>
                  <option value="Other Document">Other Document</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Document Title / Description</label>
                <input type="text" value={newDocTitle} onChange={(e) => setNewDocTitle(e.target.value)} placeholder="e.g. California Driver License - Front" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Document ID Number</label>
                  <input type="text" value={newDocNumber} onChange={(e) => setNewDocNumber(e.target.value)} placeholder="e.g. DL-9840214-CA" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Issuing State / Country</label>
                  <input type="text" value={newDocCountry} onChange={(e) => setNewDocCountry(e.target.value)} placeholder="e.g. United States (CA)" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Image URL or File Attachment</label>
                <input type="text" value={newDocFileUrl} onChange={(e) => setNewDocFileUrl(e.target.value)} placeholder="https://example.com/scanned-id.jpg (or drop file)" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddScannedDocModal(false)} style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>Save Scanned Document</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Capture Guest Photo Modal */}
      {showAddCapturedPhotoModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '500px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: '#ffffff', color: '#0f172a', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>📸 Capture Guest Check-In Photo</h3>
              <button type="button" onClick={() => setShowAddCapturedPhotoModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <form onSubmit={handleSaveNewCapturedPhoto} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Photo Title</label>
                <input type="text" value={newPhotoTitle} onChange={(e) => setNewPhotoTitle(e.target.value)} placeholder="e.g. Guest Check-In Selfie" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Camera / Device Source</label>
                <select value={newPhotoSource} onChange={(e) => setNewPhotoSource(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontWeight: 600 }}>
                  <option value="Front Desk HD Webcam">Front Desk HD Webcam (Terminal 1)</option>
                  <option value="Self Check-In Kiosk Camera">Self Check-In Kiosk Camera</option>
                  <option value="Mobile App Scan">Mobile Check-In App</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Photo Image URL</label>
                <input type="text" value={newPhotoFileUrl} onChange={(e) => setNewPhotoFileUrl(e.target.value)} placeholder="https://example.com/guest-photo.jpg" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddCapturedPhotoModal(false)} style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>Save Captured Photo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Saved Credit Card Modal */}
      {showAddCardDocModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '500px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: '#ffffff', color: '#0f172a', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>💳 Save Credit Card to Guest Profile</h3>
              <button type="button" onClick={() => setShowAddCardDocModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <form onSubmit={handleSaveNewCreditCardDoc} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Cardholder Full Name *</label>
                <input type="text" value={newCardHolderName} onChange={(e) => setNewCardHolderName(e.target.value)} placeholder="e.g. ALEX JOHNSON" required style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontWeight: 700 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Card Number (16 Digits) *</label>
                <input type="text" maxLength="19" value={newCardNumVal} onChange={(e) => setNewCardNumVal(e.target.value)} placeholder="4532 8910 2481 4242" required style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontWeight: 700, letterSpacing: '1px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Expiry (MM/YY) *</label>
                  <input type="text" maxLength="5" value={newCardExpVal} onChange={(e) => setNewCardExpVal(e.target.value)} placeholder="12/28" required style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>CVV / CVC *</label>
                  <input type="password" maxLength="4" value={newCardCvvVal} onChange={(e) => setNewCardCvvVal(e.target.value)} placeholder="•••" required style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Network</label>
                  <select value={newCardTypeBrand} onChange={(e) => setNewCardTypeBrand(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontWeight: 700 }}>
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Amex">Amex</option>
                    <option value="Discover">Discover</option>
                  </select>
                </div>
              </div>
              <div style={{ fontSize: '11.5px', color: '#334155', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '8px', fontWeight: 700 }}>
                🔒 Card details will be encrypted using PCI-DSS tokenization standards.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddCardDocModal(false)} style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>Save Card to Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CameraCaptureModal
        isOpen={showFolioCameraModal}
        onClose={() => setShowFolioCameraModal(false)}
        onCapture={handleFolioCameraCapture}
        guestName={currentRes?.guestName || currentRes?.guest || `${currentRes?.firstName || ''} ${currentRes?.lastName || ''}`.trim() || 'Guest'}
      />
    </div>
  );
};
