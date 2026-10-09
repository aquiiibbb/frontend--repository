import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { Smartphone, ShieldCheck, Gift, GitBranch, Users, CheckCircle2, AlertTriangle, Filter, MessageSquare, Dog, CigaretteOff, Cigarette } from "lucide-react";
import { PageHeader } from "../../components/UI";
import { IconChevronRight, IconCalendar, IconRefresh } from "../../components/Icons";
import OtaBadge from "../../components/OtaBadge";
import WalkinGuest from "./WalkinGuest";
import ReservationActionMenu from "./ReservationActionMenu";
import QuickActionModal from "./QuickActionModal";
import BookingSlip from "./BookingSlip";
import ActivityDashboard from "./ActivityDashboard";
import GroupBookingModal from "../../components/GroupBookingModal";
import GroupOperationsModal from "../../components/GroupOperationsModal";
import AIIDScannerModal, { extractFacePhotoFromID } from "../../components/AIIDScannerModal";
import FolioModal from "../../components/FolioModal";
import SplitStayWizardModal from "../../components/SplitStayWizardModal";
import SendSelfCheckInModal from "../../components/SendSelfCheckInModal";
import CustomDatePicker from "../../components/CustomDatePicker";
import RoomViewGrid from "../../components/RoomViewGrid";
import PropertyStatsSummary from "../../components/PropertyStatsSummary";
import ReviewManagement from "./ReviewManagement";
import OverbookingModal from "../../components/OverbookingModal";
import { getHotelProfile, getStatusColors, isVirtualRoomOrBooking } from "../../services/hotelConfig";
import { calculateCategoryAvailability, getOverbookedReservations } from "../../services/overbookingService";
import { ACTION_FORMS, resolveActionId } from "./quickActionConfig";
import {
  getRooms,
  getRoomTypes,
  getBookings,
  getRoomsSync,
  getRoomTypesSync,
  getBookingsSync,
  createBooking,
  createGroupBooking,
  updateBooking,
  moveBooking as apiMoveBooking,
  splitStayBooking as apiSplitStayBooking,
  transferBalance as apiTransferBalance,
  addDeposit as apiAddDeposit,
  refundDeposit as apiRefundDeposit,
  applyDepositToFolio as apiApplyDepositToFolio,
  updateDeposit as apiUpdateDeposit,
  deleteDeposit as apiDeleteDeposit,
  deleteBooking as apiDeleteBooking,
  cancelBooking as apiCancelBooking,
  noShowBooking as apiNoShowBooking,
  addExtra,
  addSettlement,
  emailBooking,
  slipPdfUrl,
  getAuditLogs,
  updateRoomHousekeeping,
  saveRoomsList,
} from "../../services/api";
import { getBusinessDate } from "../../services/hotelConfig";
import { printViaIframe } from "../../utils/exportUtils";
import "./Calendar.css";
import "./quickActionModal.css";

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_META = {
  available: { label: "Clean", cls: "status-clean" },
  cleaning: { label: "Dirty", cls: "status-dirty" },
  occupied: { label: "Occupied", cls: "status-occupied" },
  maintenance: { label: "Maintenance", cls: "status-maintenance" },
};

const QUICK_STATUS_FILTERS = [
  { value: "available", label: "Available Rooms" },
  { value: "blocked", label: "Blocked Rooms" },
  { value: "dirty", label: "Dirty Rooms" },
  { value: "clean", label: "Clean Rooms" },
  { value: "occupied", label: "Occupied Rooms" },
];

const TYPE_COLOR_CLASS = {
  Standard: "type-standard",
  Deluxe: "type-deluxe",
  "Executive Suite": "type-executive",
  "Presidential Suite": "type-presidential",
};
function typeColorClass(type) {
  return TYPE_COLOR_CLASS[type] || "";
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function dateToKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function todayISO() {
  return getBusinessDate();
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}
function isSameDay(first, second) {
  return dateToKey(first) === dateToKey(second);
}
function parseLocalDate(dateStr) {
  if (!dateStr) return startOfDay(new Date());
  if (dateStr instanceof Date) return startOfDay(dateStr);
  const str = String(dateStr).trim();
  const parts = str.substring(0, 10).split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 0, 0, 0, 0);
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? startOfDay(new Date()) : startOfDay(d);
}
function dayOffset(fromKey, toKey) {
  const d1 = parseLocalDate(fromKey);
  const d2 = parseLocalDate(toKey);
  return Math.round((d2.getTime() - d1.getTime()) / DAY_MS);
}
export function getBookingNightlyRate(booking) {
  if (!booking) return 149;
  if (booking.ratePerNight !== undefined && Number(booking.ratePerNight) > 0) return Number(booking.ratePerNight);
  if (booking.nightlyRateUSD !== undefined && Number(booking.nightlyRateUSD) > 0) return Number(booking.nightlyRateUSD);
  if (booking.nightlyRate !== undefined && Number(booking.nightlyRate) > 0) return Number(booking.nightlyRate);
  if (booking.roomRate !== undefined && Number(booking.roomRate) > 0) return Number(booking.roomRate);
  if (booking.baseRatePerNight !== undefined && Number(booking.baseRatePerNight) > 0) return Number(booking.baseRatePerNight);
  if (booking.grossRatePerNight !== undefined && Number(booking.grossRatePerNight) > 0) return Number(booking.grossRatePerNight);

  const folioItems = booking.folioA || booking.folio?.folioA || booking.charges || [];
  const roomRateItem = (folioItems || []).find(i => 
    (i.category || '').toLowerCase().includes('room rate') || 
    (i.description || '').toLowerCase().includes('room tariff') || 
    (i.description || '').toLowerCase().includes('room charge')
  );
  if (roomRateItem) {
    const itemRate = Number(roomRateItem.amountUSD || roomRateItem.amount || roomRateItem.totalInclTax || roomRateItem.subtotal || 0);
    if (itemRate > 0) return itemRate;
  }

  const nights = Number(booking.nights || dayOffset(booking.checkIn, booking.checkOut) || 1);
  if (booking.subtotal && nights > 0 && Number(booking.subtotal) > 0) {
    return Math.round(Number(booking.subtotal) / nights);
  }
  if (booking.totalAmount && nights > 0 && Number(booking.totalAmount) > 0) {
    const exclTax = Number(booking.totalAmount) / 1.12;
    return Math.round(exclTax / nights);
  }

  return 149;
}
function initials(name) {
  if (!name || typeof name !== "string") return "G";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part && part[0] ? part[0].toUpperCase() : ""))
    .join("") || "G";
}
const AVATAR_PALETTE = ["#2E5C8A", "#7A4FB5", "#B5544F", "#3D8A6B", "#A5762F", "#5A5FC7"];
function avatarColor(name) {
  if (!name || typeof name !== "string") return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function getBookingStatusClass(booking) {
  const isEnquiryFlag = Boolean(booking?.isEnquiry || booking?.isGroupEnquiry);
  const s = String(typeof booking === "string" ? booking : booking?.status || "").toLowerCase().trim();
  const g = String(booking?.guest || "").toLowerCase();

  if (isEnquiryFlag || s === "enquiry" || s === "inquiry" || s === "group enquiry" || s === "group_enquiry") {
    return "status-enquiry";
  }
  if (s === "checked-out") {
    return "status-checked-out";
  }
  if (
    s === "blocked" ||
    s === "block" ||
    s === "maintenance" ||
    s === "out-of-order" ||
    s === "ooo" ||
    g.includes("blocked") ||
    g.includes("maintenance") ||
    g.includes("out of order")
  ) {
    return "status-blocked";
  }
  if (s === "checked-in" || s === "occupied" || s === "in-house") {
    return "status-checked-in";
  }
  if (s === "confirmed" || s === "reserved" || s === "booked") {
    return "status-confirmed";
  }
  return "status-confirmed";
}

export function getBookingStatusColors(booking, colors) {
  const cls = getBookingStatusClass(booking);
  let item = colors?.confirmed;
  if (cls === "status-enquiry") item = colors?.enquiry;
  else if (cls === "status-checked-in") item = colors?.checked_in;
  else if (cls === "status-checked-out") item = colors?.checked_out;
  else if (cls === "status-blocked") item = colors?.blocked;

  if (!item) {
    if (cls === "status-enquiry") return { bg: "#f59e0b", text: "#ffffff" };
    if (cls === "status-checked-in") return { bg: "#16a34a", text: "#ffffff" };
    if (cls === "status-checked-out") return { bg: "#64748b", text: "#ffffff" };
    if (cls === "status-blocked") return { bg: "#dc2626", text: "#ffffff" };
    return { bg: "#2563eb", text: "#ffffff" };
  }

  if (typeof item === "string") return { bg: item, text: "#ffffff" };
  return {
    bg: item.bg || "#2563eb",
    text: item.text || "#ffffff",
  };
}

export function getBookingBgColor(booking, colors) {
  return getBookingStatusColors(booking, colors).bg;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const cleanStr = dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr;
  const d = new Date(cleanStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  let suffix = "th";
  if (day === 1 || day === 21 || day === 31) suffix = "st";
  else if (day === 2 || day === 22) suffix = "nd";
  else if (day === 3 || day === 23) suffix = "rd";

  return `${day}${suffix} ${month}, ${year}`;
}

export function formatHoverDate(dateStr) {
  if (!dateStr) return "N/A";
  const cleanStr = String(dateStr).length === 10 ? dateStr + "T00:00:00" : dateStr;
  const d = new Date(cleanStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getHoverBadgeBg(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('enquir') || s.includes('inquir')) return '#fef3c7';
  if (s.includes('check') && s.includes('in')) return '#dcfce7';
  if (s.includes('check') && s.includes('out')) return '#f1f5f9';
  if (s.includes('cancel')) return '#fef2f2';
  return '#dbeafe';
}

export function getHoverBadgeColor(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('enquir') || s.includes('inquir')) return '#b45309';
  if (s.includes('check') && s.includes('in')) return '#15803d';
  if (s.includes('check') && s.includes('out')) return '#475569';
  if (s.includes('cancel')) return '#b91c1c';
  return '#1d4ed8';
}

export function calcHoverNights(checkIn, checkOut) {
  try {
    if (!checkIn || !checkOut) return 1;
    const d1 = new Date(String(checkIn).substring(0, 10) + "T00:00:00");
    const d2 = new Date(String(checkOut).substring(0, 10) + "T00:00:00");
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;
    const diffTime = d2.getTime() - d1.getTime();
    return Math.max(1, Math.round(diffTime / (1000 * 3600 * 24)));
  } catch (err) {
    return 1;
  }
}

function isInactiveBooking(b) {
  if (!b) return true;
  if (b.isDeleted) return true;
  const statusLower = String(b.status || "").toLowerCase().trim();
  return (
    statusLower === "cancelled" ||
    statusLower === "no-show" ||
    statusLower === "noshow" ||
    statusLower === "no_show"
  );
}

function highlightMatch(text = "", query = "") {
  if (!query || !text) return text;
  const strText = String(text);
  const strQuery = String(query).toLowerCase();
  const idx = strText.toLowerCase().indexOf(strQuery);
  if (idx === -1) return strText;

  const before = strText.slice(0, idx);
  const match = strText.slice(idx, idx + strQuery.length);
  const after = strText.slice(idx + strQuery.length);

  return (
    <>
      {before}
      <span style={{ color: "#06b6d4", fontWeight: 900 }}>{match}</span>
      {after}
    </>
  );
}

function getStatusBg(status = "") {
  const s = String(status).toLowerCase();
  if (s.includes("cancel")) return "#fee2e2";
  if (s.includes("checked-in") || s.includes("checkin")) return "#dcfce7";
  if (s.includes("confirm")) return "#dbeafe";
  if (s.includes("checkout") || s.includes("checked-out")) return "#f3f4f6";
  return "#f1f5f9";
}

function getStatusColor(status = "") {
  const s = String(status).toLowerCase();
  if (s.includes("cancel")) return "#991b1b";
  if (s.includes("checked-in") || s.includes("checkin")) return "#166534";
  if (s.includes("confirm")) return "#1e40af";
  if (s.includes("checkout") || s.includes("checked-out")) return "#374151";
  return "#475569";
}

export default function Calendar() {
  const { searchTerm = "", setSearchTerm } = useOutletContext() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekStart, setWeekStart] = useState(() => parseLocalDate(getBusinessDate()));
  const [viewMode, setViewMode] = useState("calendar"); // "calendar" | "room_grid"

  // Synchronously initialize state from instant local cache so UI renders in 0ms!
  const [rooms, setRooms] = useState(() => (typeof getRoomsSync === "function" ? getRoomsSync() : []));
  const [roomTypes, setRoomTypes] = useState(() => (typeof getRoomTypesSync === "function" ? getRoomTypesSync() : []));
  const [allBookingsList, setAllBookingsList] = useState(() => (typeof getBookingsSync === "function" ? getBookingsSync() : []));
  const [bookingsList, setBookingsList] = useState(() => {
    const cached = typeof getBookingsSync === "function" ? getBookingsSync() : [];
    return cached.filter((b) => !isInactiveBooking(b));
  });
  const [dataLoading, setDataLoading] = useState(() => {
    const cached = typeof getRoomsSync === "function" ? getRoomsSync() : [];
    return cached.length === 0;
  });
  const [dataError, setDataError] = useState("");

  const [showCalOverbookingModal, setShowCalOverbookingModal] = useState(false);
  const overbookedReservations = useMemo(() => {
    return getOverbookedReservations(allBookingsList.length > 0 ? allBookingsList : bookingsList, rooms);
  }, [allBookingsList, bookingsList, rooms]);

  const query = searchTerm.trim().toLowerCase();

  const globalSearchResults = useMemo(() => {
    if (!query || query.length < 1) return [];
    return allBookingsList.filter((b) => {
      if (!b) return false;
      const matchGuest = b.guest && b.guest.toLowerCase().includes(query);
      const matchPhone = b.phone && String(b.phone).toLowerCase().includes(query);
      const matchEmail = b.email && b.email.toLowerCase().includes(query);
      const matchId = b.id && b.id.toLowerCase().includes(query);
      const matchRoom = b.room && String(b.room).toLowerCase().includes(query);
      const matchStatus = b.status && b.status.toLowerCase().includes(query);
      const matchCompany = b.companyName && b.companyName.toLowerCase().includes(query);
      return matchGuest || matchPhone || matchEmail || matchId || matchRoom || matchStatus || matchCompany;
    });
  }, [allBookingsList, query]);

  function handleSelectGlobalSearchResult(b) {
    if (b?.checkIn) {
      const cleanStr = b.checkIn.length === 10 ? b.checkIn + "T00:00:00" : b.checkIn;
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) setWeekStart(d);
    }
    setSelectedFolioBooking(b);
    if (setSearchTerm) setSearchTerm("");
  }

  // Open Folio Modal if searchId is passed in URL query parameters
  useEffect(() => {
    const searchId = searchParams.get("searchId");
    if (searchId && bookingsList.length > 0) {
      const found = bookingsList.find(
        (b) => String(b.id) === String(searchId) || String(b.referenceCode || "") === String(searchId)
      );
      if (found) {
        setSelectedFolioBooking(found);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, bookingsList, setSearchParams]);

  const [activeCell, setActiveCell] = useState(null); // { roomNo, date, booking }
  const [toast, setToast] = useState("");

  // The full, centered "slip" / folio popup, now opened from the "View Folio" menu item.
  const [slipInfo, setSlipInfo] = useState(null); // { booking, room }

  // Click a reservation bar -> pill + ⋮ mega menu. Click a menu item -> small quick-action form.
  const [menuInfo, setMenuInfo] = useState(null); // { booking, room, style }
  const [quickAction, setQuickAction] = useState(null); // { id, booking, room }
  const [logInfo, setLogInfo] = useState(null); // { booking, logs, loading }
  const [showAIScannerModal, setShowAIScannerModal] = useState(false);
  const [aiScannerTargetBooking, setAIScannerTargetBooking] = useState(null);
  const [showGroupBookingModal, setShowGroupBookingModal] = useState(false);
  const [groupOpsTarget, setGroupOpsTarget] = useState(null);
  const [sendCheckInBooking, setSendCheckInBooking] = useState(null);
  const [selectedFolioBooking, setSelectedFolioBooking] = useState(null);
  const [splitStayTargetBooking, setSplitStayTargetBooking] = useState(null);
  const [hkModalRoom, setHkModalRoom] = useState(null);
  const [dragSelection, setDragSelection] = useState(null); // { room, roomNo, startIdx, endIdx, isSelecting }
  const [cellChoice, setCellChoice] = useState(null); // { roomNo, date, room }
  const [pendingMove, setPendingMove] = useState(null);
  const [pendingResize, setPendingResize] = useState(null);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [pendingBlockEdit, setPendingBlockEdit] = useState(null);
  const [hoveredBooking, setHoveredBooking] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [hoverFaceMap, setHoverFaceMap] = useState({});
  const [imgErrorMap, setImgErrorMap] = useState({});
  const hoverTimeoutRef = useRef(null);
  const lastActionRef = useRef(null); // { bookingId, previousData, label } for the Undo action



  const calculateCornerPosition = (barElement) => {
    if (!barElement) return { x: 12, y: 100 };
    const rect = barElement.getBoundingClientRect();
    const cardWidth = 310;
    const cardHeight = 350;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Default: position at top-right corner of the Gantt bar (just past rect.right)
    let posX = rect.right + 12;
    let posY = rect.top - 6;

    // If placing on the right corner exceeds screen width, try placing at top-left corner of the bar
    if (posX + cardWidth > vw - 16) {
      const leftCornerX = rect.left - cardWidth - 12;
      if (leftCornerX >= 200) {
        posX = leftCornerX;
      } else {
        posX = Math.max(12, vw - cardWidth - 16);
        if (rect.top - cardHeight - 12 >= 55) {
          posY = rect.top - cardHeight - 12;
        } else {
          posY = rect.bottom + 12;
        }
      }
    }

    if (posY + cardHeight > vh - 16) {
      posY = Math.max(55, vh - cardHeight - 16);
    }
    if (posY < 55) {
      posY = 55;
    }

    return { x: Math.round(posX), y: Math.round(posY) };
  };

  async function handleCleanRoom(roomNo, newStatus = "clean") {
    setHkModalRoom(null);

    const safeRooms = Array.isArray(rooms) ? rooms : [];
    const targetRoom = safeRooms.find((r) => String(r.no).trim() === String(roomNo).trim());
    const updatedRooms = safeRooms.map((r) => {
      if (String(r.no).trim() === String(roomNo).trim()) {
        return {
          ...r,
          housekeeping: newStatus,
          status: newStatus === "clean" ? "available" : newStatus === "dirty" ? "cleaning" : r.status,
        };
      }
      return r;
    });

    setRooms(updatedRooms);

    try {
      if (typeof saveRoomsList === "function") {
        await saveRoomsList(updatedRooms);
      }
      if (typeof updateRoomHousekeeping === "function") {
        await updateRoomHousekeeping(roomNo, {
          housekeeping: newStatus,
          status: newStatus === "clean" ? "available" : newStatus === "dirty" ? "cleaning" : targetRoom?.status || "available",
        });
      }

      window.dispatchEvent(new CustomEvent("pms_rooms_updated"));

      setToast(
        newStatus === "clean"
          ? `Room ${roomNo} marked Clean & Ready 🟢`
          : `Room ${roomNo} marked Dirty (Needs Cleaning) 🔴`
      );
    } catch (err) {
      setToast(err.message || "Could not update room housekeeping");
    }
  }

  async function handleGroupBookingCreated(groupBookings, meta) {
    try {
      const result = await createGroupBooking(groupBookings, meta);
      const createdList = Array.isArray(result)
        ? result
        : Array.isArray(result?.bookings)
        ? result.bookings
        : Array.isArray(result?.data)
        ? result.data
        : groupBookings;

      // Ensure newly booked room types are included in active typeFilter so bars never get filtered out
      const newTypes = createdList.map((b) => b.roomType).filter(Boolean);
      if (newTypes.length > 0) {
        setTypeFilter((prev) => {
          const nextSet = new Set(prev);
          newTypes.forEach((t) => nextSet.add(t));
          return nextSet;
        });
      }

      await refreshBookings();
      setToast(`Group reservation created: ${meta?.groupName || "Group"} (${meta?.totalRooms || createdList.length} rooms) 👥`);
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    } catch (err) {
      setToast(err.message || "Could not create group booking");
    }
  }

  const handleAIScanForBooking = async (scanned) => {
    if (!aiScannerTargetBooking) return;
    try {
      const fullDocUrl = scanned.fullScanPhoto || scanned.scannedIdUrl || scanned.idFront || scanned.photo;
      const faceUrl = scanned.facePhoto || scanned.guestPhoto || scanned.capturedPhoto || "";
      const idNum = scanned.idProofNumber || scanned.govtIdNumber || aiScannerTargetBooking.idNumber || 'Verified';

      const existingScanned = Array.isArray(aiScannerTargetBooking.scannedImages) ? aiScannerTargetBooking.scannedImages : [];
      const newScannedDoc = {
        id: `scanned_${Date.now()}`,
        title: `${scanned.type || "Identity Document"} - Front`,
        idType: scanned.type || "Driver's License",
        idNumber: idNum,
        issueCountry: scanned.state || 'United States',
        url: fullDocUrl,
        uploadedAt: new Date().toISOString(),
        source: scanned.scanSource || 'AI ID Scanner'
      };
      const updatedScannedImages = [newScannedDoc, ...existingScanned.filter(d => d.url !== fullDocUrl)];

      const existingCaptured = Array.isArray(aiScannerTargetBooking.capturedImages) ? aiScannerTargetBooking.capturedImages : [];
      const newCapturedPhoto = faceUrl ? {
        id: `captured_${Date.now()}`,
        title: 'Guest Check-In Photo (Extracted Face)',
        url: faceUrl,
        capturedAt: new Date().toISOString(),
        source: 'AI ID Scanner (Face Extraction)',
        resolution: '400x400'
      } : null;
      const updatedCapturedImages = newCapturedPhoto
        ? [newCapturedPhoto, ...existingCaptured.filter(p => p.url !== faceUrl)]
        : existingCaptured;

      await applyBookingUpdate(aiScannerTargetBooking, {
        guest: scanned.fullName || aiScannerTargetBooking.guest,
        firstName: scanned.firstName || aiScannerTargetBooking.firstName,
        lastName: scanned.lastName || aiScannerTargetBooking.lastName,
        email: scanned.email || aiScannerTargetBooking.email,
        phone: scanned.phoneNumber || aiScannerTargetBooking.phone,
        address: scanned.address || aiScannerTargetBooking.address,
        streetAddress: scanned.address || aiScannerTargetBooking.streetAddress,
        city: scanned.city || aiScannerTargetBooking.city,
        state: scanned.state || aiScannerTargetBooking.state,
        zip: scanned.zip || aiScannerTargetBooking.zip,
        dob: scanned.dob || aiScannerTargetBooking.dob,
        idType: scanned.type || aiScannerTargetBooking.idType,
        idNumber: idNum,
        govtIdNumber: idNum,
        idScanned: true,

        idFront: fullDocUrl,
        scannedIdUrl: fullDocUrl,
        idDocumentUrl: fullDocUrl,
        scannedImages: updatedScannedImages
      }, "Scan ID");

      const targetId = aiScannerTargetBooking.id || aiScannerTargetBooking._id;
      if (targetId && faceUrl) {
        setHoverFaceMap((prev) => ({ ...prev, [targetId]: faceUrl }));
      }

      setToast(`AI ID Scanned & Saved for ${scanned.fullName || aiScannerTargetBooking.guest}`);
    } catch (err) {
      setToast(err.message || "Could not save scanned ID");
    } finally {
      setShowAIScannerModal(false);
      setAIScannerTargetBooking(null);
    }
  };

  async function refreshBookings() {
    try {
      const rawData = await getBookings();
      const map = new Map();
      (rawData || []).forEach((b) => {
        if (!b) return;
        const bId = String(b.id || b._id || "").trim();
        const rNo = String(b.room || b.roomNo || b.roomNumber || "").trim();
        const checkIn = String(b.checkIn || "").substring(0, 10).trim();
        const checkOut = String(b.checkOut || "").substring(0, 10).trim();
        const guest = String(b.guest || b.guestName || "").trim().toLowerCase();
        const compositeKey = `${rNo}_${checkIn}_${checkOut}_${guest}`;
        const primaryKey = bId || compositeKey;
        if (!map.has(primaryKey) && !map.has(compositeKey)) {
          map.set(primaryKey, b);
          map.set(compositeKey, b);
        }
      });
      const data = Array.from(new Set(map.values()));
      setAllBookingsList(data);
      setBookingsList(data.filter((b) => !isInactiveBooking(b)));
    } catch (err) {
      setToast(err.message || "Could not refresh bookings");
    }
  }

  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [navbarTarget, setNavbarTarget] = useState(null);

  const [statusColors, setStatusColors] = useState(() => getStatusColors());

  useEffect(() => {
    function updateColors() {
      setStatusColors(getStatusColors());
    }
    window.addEventListener("pms_status_colors_updated", updateColors);
    return () => window.removeEventListener("pms_status_colors_updated", updateColors);
  }, []);

  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(() => new Set());
  const filterRef = useRef(null);

  const initialLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      if (!initialLoadedRef.current) {
        setDataLoading(true);
      }
      setDataError("");
      try {
        const [roomsData, typesData, bookingsData] = await Promise.all([
          getRooms(),
          getRoomTypes(),
          getBookings(),
        ]);
        if (cancelled) return;
        setRooms(roomsData);
        setRoomTypes(typesData);
        setAllBookingsList(bookingsData);
        const activeBookings = bookingsData.filter((b) => !isInactiveBooking(b));
        setBookingsList(activeBookings);

        // Sync open folio booking modal state with fresh data
        setSelectedFolioBooking((prev) => {
          if (!prev) return null;
          const fresh = bookingsData.find((b) => String(b.id || "").trim() === String(prev.id || "").trim());
          return fresh ? { ...fresh } : prev;
        });

        // Ensure type filter includes all active room types on load or data update
        const allTypeNames = new Set([
          ...(typesData || []).map((t) => t.name),
          ...(roomsData || []).map((r) => r.type).filter(Boolean),
        ]);
        setTypeFilter((prev) => {
          if (!prev || prev.size === 0 || !initialLoadedRef.current) return allTypeNames;
          const merged = new Set(prev);
          allTypeNames.forEach((t) => merged.add(t));
          return merged;
        });
      } catch (err) {
        if (!cancelled) setDataError(err.message || "Could not load calendar data. Is the backend running?");
      } finally {
        if (!cancelled) {
          initialLoadedRef.current = true;
          setDataLoading(false);
        }
      }
    }
    loadAll();
    const handleOpenGroupModal = () => setShowGroupBookingModal(true);
    const handleOpenGroupOps = (e) => {
      setGroupOpsTarget(e.detail || true);
    };
    const handleBusinessDateChange = () => {
      setWeekStart(parseLocalDate(getBusinessDate()));
      loadAll();
    };
    window.addEventListener("pms_bookings_updated", loadAll);
    window.addEventListener("pms_rooms_updated", loadAll);
    window.addEventListener("pms_business_date_updated", handleBusinessDateChange);
    window.addEventListener("pms_open_group_booking", handleOpenGroupModal);
    window.addEventListener("pms_open_group_ops", handleOpenGroupOps);
    window.addEventListener("storage", loadAll);
    window.addEventListener("focus", loadAll);

    return () => {
      cancelled = true;
      window.removeEventListener("pms_bookings_updated", loadAll);
      window.removeEventListener("pms_rooms_updated", loadAll);
      window.removeEventListener("pms_business_date_updated", handleBusinessDateChange);
      window.removeEventListener("pms_open_group_booking", handleOpenGroupModal);
      window.removeEventListener("pms_open_group_ops", handleOpenGroupOps);
      window.removeEventListener("storage", loadAll);
      window.removeEventListener("focus", loadAll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [draggingId, setDraggingId] = useState(null);
  const [resizingId, setResizingId] = useState(null);
  const dragGrabOffsetRef = useRef(0);

  const [showPropertyStats, setShowPropertyStats] = useState(true);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerViewDate, setPickerViewDate] = useState(() => {
    const base = parseLocalDate(getBusinessDate());
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const datePickerRef = useRef(null);

  function toggleDatePicker() {
    setDatePickerOpen((open) => {
      const next = !open;
      if (next) setPickerViewDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
      return next;
    });
  }
  function shiftPickerMonth(amount) {
    setPickerViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
  }
  function selectPickerDate(dateObj) {
    setWeekStart(startOfDay(dateObj));
    setDatePickerOpen(false);
  }

  const [viewDays, setViewDays] = useState(7);
  const today = parseLocalDate(getBusinessDate());

  const days = useMemo(
    () => Array.from({ length: viewDays }, (_, index) => {
      const date = addDays(weekStart, index);
      return {
        date: dateToKey(date),
        label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
        dayNum: date.getDate(),
        monthShort: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date),
        isToday: isSameDay(date, today),
        isWeekend: date.getDay() === 5 || date.getDay() === 6,
      };
    }),
    [weekStart, today, viewDays]
  );
  const weekStartKey = days[0].date;

  const propertyDailyStats = useMemo(() => {
    const validRoomNumbers = new Set((rooms || []).map((r) => String(r.no || "").trim()));
    const totalPhysicalRooms = rooms.length;

    return (days || []).map((day) => {
      const activeBookings = (bookingsList || []).filter((b) => {
        const st = String(b?.status || "").toLowerCase().trim();
        if (!b || st === "cancelled" || st === "enquiry" || st === "inquiry" || st === "group enquiry" || st === "group_enquiry" || b.isEnquiry) return false;
        const bRoomStr = String(b.room || b.roomNo || b.roomNumber || "").trim();
        if (!validRoomNumbers.has(bRoomStr)) return false;
        const isCheckedInOnBizDate = (st === "checked-in" || st === "occupied" || st === "checkedin") && day.date === todayISO();
        return isCheckedInOnBizDate || (b.checkIn <= day.date && b.checkOut > day.date);
      });

      const soldCount = activeBookings.length;
      const availableCount = Math.max(0, totalPhysicalRooms - soldCount);
      const occupancyPct = totalPhysicalRooms > 0 ? Math.round((soldCount / totalPhysicalRooms) * 100) : 0;

      // 💰 Calculate daily room revenue (Sum of nightly rates for active bookings on this date)
      const dailyRevenue = activeBookings.reduce((sum, b) => {
        const nightRate = Number(
          b.ratePerNight ||
            (b.subtotal && b.nights ? Math.round(b.subtotal / b.nights) : Math.round((b.totalAmount || 0) / Math.max(1, b.nights || 1))) ||
            0
        );
        return sum + nightRate;
      }, 0);

      // 💳 Calculate payments collected on this actual transaction date
      const dailyPayment = (bookingsList || []).reduce((sum, b) => {
        if (!b || b.status === "cancelled") return sum;
        let pSum = 0;

        if (Array.isArray(b.payments) && b.payments.length > 0) {
          const paysForDay = b.payments.filter((p) => {
            const pDate = String(p.date || p.createdAt || p.timestamp || "").slice(0, 10);
            return pDate === day.date;
          });
          pSum += paysForDay.reduce((acc, p) => acc + Number(p.amountUSD || p.amount || 0), 0);
        } else if (Number(b.advanceAmount || b.paidAmount || 0) > 0) {
          const advanceTxnDate = String(
            b.advancePaymentDate || b.paymentDate || b.bookingDate || b.createdAt || b.createdDate || b.date || ""
          ).slice(0, 10);
          if (advanceTxnDate === day.date) {
            pSum += Number(b.advanceAmount || b.paidAmount || 0);
          }
        }

        return sum + pSum;
      }, 0);

      return {
        date: day.date,
        sold: soldCount,
        available: availableCount,
        occupancy: occupancyPct,
        revenue: dailyRevenue,
        payment: dailyPayment,
      };
    });
  }, [days, rooms, bookingsList]);

  const handlePrintPropertyStats = () => {
    const activeBDate = getBusinessDate();
    const startDateStr = days[0]?.date || activeBDate;
    const endDateStr = days[days.length - 1]?.date || activeBDate;

    const reportHtml = `
        <div class="header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; font-size: 20px; color: #0f172a;">📊 Property Stats & Daily Inventory Summary Report</h2>
            <div class="sub" style="font-size: 12px; color: #64748b; margin-top: 4px;">Period: ${startDateStr} to ${endDateStr} (${days.length} Days) • PMS Business Date: ${activeBDate}</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            Printed: ${new Date().toLocaleString()}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;">
          <thead>
            <tr>
              <th class="lbl-col" style="background: #0f172a; color: #ffffff; padding: 10px; text-align: left; font-weight: 800;">METRIC / DATE</th>
              ${days.map((d) => `<th style="background: #0f172a; color: #ffffff; padding: 10px; text-align: center; font-weight: 800;">${d.dayNum} ${d.monthShort}<br/><small style="font-weight:400; opacity:0.8;">${d.label}</small></th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="lbl-col" style="border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: 800; color: #334155;">👁️ OCCUPANCY (%)</td>
              ${propertyDailyStats.map((s) => `<td style="border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: 800; color: #0284c7;">${s.occupancy}%</td>`).join("")}
            </tr>
            <tr>
              <td class="lbl-col" style="border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: 800; color: #334155;">🛡️ TOTAL AVAILABLE</td>
              ${propertyDailyStats.map((s) => `<td style="border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: 700;">${s.available}</td>`).join("")}
            </tr>
            <tr>
              <td class="lbl-col" style="border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: 800; color: #334155;">⚡ TOTAL SOLD</td>
              ${propertyDailyStats.map((s) => `<td style="border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: 800; color: #d97706;">${s.sold}</td>`).join("")}
            </tr>
            <tr>
              <td class="lbl-col" style="border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: 800; color: #334155;">💰 ROOM REVENUE</td>
              ${propertyDailyStats.map((s) => `<td style="border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: 800; color: #d97706;">$${s.revenue.toLocaleString()}</td>`).join("")}
            </tr>
            <tr>
              <td class="lbl-col" style="border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: 800; color: #334155;">💳 PAYMENT COLLECTED</td>
              ${propertyDailyStats.map((s) => `<td style="border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: 800; color: #16a34a;">$${s.payment.toLocaleString()}</td>`).join("")}
            </tr>
          </tbody>
        </table>

        <div class="footer" style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 11px; color: #94a3b8;">Confidential Internal Property Report • Generated by Hotel PMS</div>
    `;

    printViaIframe(reportHtml, "Property Stats Report");
  };

  useEffect(() => {
    function handleGlobalMouseUp() {
      if (dragSelection && dragSelection.isSelecting && days && days.length > 0) {
        try {
          const minIdx = Math.max(0, Math.min(dragSelection.startIdx, dragSelection.endIdx));
          const maxIdx = Math.max(0, Math.min(Math.max(dragSelection.startIdx, dragSelection.endIdx), days.length - 1));
          const startDay = days[minIdx];
          const endDay = days[maxIdx];
          if (startDay && endDay) {
            const checkInKey = startDay.date;
            const checkOutKey = minIdx === maxIdx
              ? dateToKey(addDays(parseLocalDate(startDay.date), 1))
              : endDay.date;
            const nightsCount = minIdx === maxIdx ? 1 : Math.max(1, maxIdx - minIdx);
            setCellChoice({
              roomNo: dragSelection.roomNo,
              room: dragSelection.room,
              checkIn: checkInKey,
              checkOut: checkOutKey,
              date: checkInKey,
              nights: nightsCount,
            });
          }
        } catch (err) {
          console.error("Drag selection error:", err);
        } finally {
          setDragSelection(null);
        }
      }
    }
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [dragSelection, days]);

  const rangeLabel = `${new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(weekStart)} – ${new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", year: "numeric" }).format(addDays(weekStart, days.length - 1))}`;

  const pickerMonthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(pickerViewDate);
  const pickerSelectedKey = weekStartKey;
  const pickerCells = useMemo(() => {
    const year = pickerViewDate.getFullYear();
    const month = pickerViewDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      const dayNum = daysInPrevMonth - firstWeekday + 1 + i;
      cells.push({ dateObj: new Date(year, month - 1, dayNum), dayNum, outside: true });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push({ dateObj: new Date(year, month, d), dayNum: d, outside: false });
    }
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ dateObj: new Date(year, month + 1, nextDay), dayNum: nextDay, outside: true });
      nextDay += 1;
    }
    return cells.map((cell) => {
      const key = dateToKey(cell.dateObj);
      return { ...cell, key, isToday: key === dateToKey(today), isSelected: key === pickerSelectedKey };
    });
  }, [pickerViewDate, pickerSelectedKey, today]);

  // Treat the checkout date as free for a NEW booking, so the same room can be
  // checked in again on its checkout day (same-day turnover). The gantt bar
  // still visually spans through the checkout day; this only affects whether
  // a day-cell is clickable to start a new reservation.
  const bookingFor = (roomNo, date) =>
    bookingsList.find((booking) => booking.room === roomNo && date >= booking.checkIn && date < booking.checkOut);

  // Close the filter panel on outside click.
  useEffect(() => {
    if (!filterOpen) return;
    function onDocClick(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [filterOpen]);

  // Close the custom date picker on outside click / Escape.
  useEffect(() => {
    if (!datePickerOpen) return;
    function onDocClick(e) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) setDatePickerOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setDatePickerOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [datePickerOpen]);

  useEffect(() => {
    setNavbarTarget(document.getElementById("calendar-navbar-controls"));
  }, []);

  const todayKey = todayISO();

  const filteredRooms = useMemo(() => {
    const rangeStartKey = days[0]?.date || todayKey;
    const rangeEndKey = days[days.length - 1]?.date || todayKey;

    return rooms.filter((room) => {
      const roomNoStr = String(room.no || "").trim();
      const hkStatus = String(room.housekeeping || "clean").toLowerCase();
      const rmStatus = String(room.status || "").toLowerCase();

      const isOccupiedInView = bookingsList.some(
        (b) =>
          String(b.room || "").trim() === roomNoStr &&
          b.status !== "cancelled" &&
          b.checkIn <= rangeEndKey &&
          b.checkOut > rangeStartKey
      );

      if (statusFilter === "available") {
        if (isOccupiedInView || rmStatus === "maintenance" || rmStatus === "out_of_order" || rmStatus === "blocked") {
          return false;
        }
      } else if (statusFilter === "blocked" || statusFilter === "maintenance") {
        const isBlockedRoom =
          rmStatus === "maintenance" ||
          rmStatus === "out_of_order" ||
          rmStatus === "blocked" ||
          rmStatus === "ooo" ||
          hkStatus === "blocked";
        const hasBlockBooking = bookingsList.some(
          (b) =>
            String(b.room || "").trim() === roomNoStr &&
            b.status !== "cancelled" &&
            b.checkIn <= rangeEndKey &&
            b.checkOut > rangeStartKey &&
            (b.status === "blocked" ||
              b.status === "maintenance" ||
              b.status === "out_of_order" ||
              b.isBlocked === true ||
              b.type === "block" ||
              String(b.guest || "").toLowerCase().includes("block") ||
              String(b.guest || "").toLowerCase().includes("maintenance") ||
              String(b.guest || "").toLowerCase().includes("out of order"))
        );
        if (!isBlockedRoom && !hasBlockBooking) {
          return false;
        }
      } else if (statusFilter === "dirty" || statusFilter === "cleaning") {
        if (hkStatus !== "dirty" && hkStatus !== "cleaning") {
          return false;
        }
      } else if (statusFilter === "clean" || statusFilter === "available-clean") {
        if (hkStatus !== "clean" && hkStatus !== "inspected") {
          return false;
        }
      } else if (statusFilter === "occupied") {
        if (!isOccupiedInView && rmStatus !== "occupied") {
          return false;
        }
      }

      if (typeFilter.size > 0 && room.type && !typeFilter.has(room.type)) {
        return false;
      }
      return true;
    });
  }, [rooms, statusFilter, typeFilter, bookingsList, todayKey, days]);

  const groupedRooms = useMemo(() => {
    const groups = new Map();
    filteredRooms.forEach((room) => {
      const typeName = room.type || "General";
      if (!groups.has(typeName)) groups.set(typeName, []);
      groups.get(typeName).push(room);
    });
    groups.forEach((list) => {
      list.sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
    });
    return Array.from(groups.entries());
  }, [filteredRooms]);

  function toggleGroup(type) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleTypeFilter(name) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const filterLabel = statusFilter
    ? QUICK_STATUS_FILTERS.find((f) => f.value === statusFilter)?.label
    : typeFilter.size === roomTypes.length
    ? "All Rooms"
    : typeFilter.size === 0
    ? "None Selected"
    : `${typeFilter.size} Room Types`;

  function openNewBooking(roomNo, date, customCheckOut) {
    const checkOut = customCheckOut || dateToKey(addDays(parseLocalDate(date), 1));
    setActiveCell({ roomNo, date, checkOut, booking: null, mode: "form" });
  }
  function handleQuickBlockEmptyRoom(roomInput, date, customCheckOut) {
    const roomObj =
      typeof roomInput === "object" && roomInput !== null
        ? roomInput
        : (rooms || []).find((r) => String(r.no).trim() === String(roomInput).trim()) || { no: roomInput };
    const checkIn = date || todayISO();
    const checkOut = customCheckOut || dateToKey(addDays(parseLocalDate(checkIn), 1));
    const dummyBooking = {
      id: `temp-${Date.now()}`,
      room: roomObj.no,
      guest: "Available Room",
      checkIn,
      checkOut,
      status: "available",
    };
    setQuickAction({ id: "block", booking: dummyBooking, room: roomObj });
  }
  function handleBarClick(booking) {
    if (resizingId || pendingResize) return;
    const statusCls = getBookingStatusClass(booking);
    const isBlocked =
      statusCls === "status-blocked" ||
      booking.status === "blocked" ||
      booking.status === "maintenance" ||
      String(booking.guest || "").toLowerCase().includes("blocked");

    if (isBlocked) {
      setPendingBlockEdit({
        ...booking,
        editCheckIn: booking.checkIn,
        editCheckOut: booking.checkOut,
        editNotes: booking.notes ? booking.notes.replace(/\[Blocked:.*?\]\s*/g, "") : "Maintenance",
      });
    } else {
      setSelectedFolioBooking(booking);
    }
  }

  async function handleUnblockRoom(blockRecord) {
    setPendingBlockEdit(null);
    try {
      await apiDeleteBooking(blockRecord.id);
      setBookingsList((prev) => prev.filter((b) => b.id !== blockRecord.id));
      if (typeof updateRoomHousekeeping === "function") {
        await updateRoomHousekeeping(blockRecord.room, "available");
      }
      setToast(`Room ${blockRecord.room} unblocked & set to Available (Clean)`);
    } catch (err) {
      setToast(err.message || "Could not unblock room");
    }
  }

  async function handleSaveBlockDates(blockRecord, newCheckIn, newCheckOut, newNotes) {
    try {
      const rawNotes = newNotes || blockRecord.notes || "";
      const cleanedReason = rawNotes
        .replace(/\[Blocked:.*?\]/gi, "")
        .replace(/[\[\]]/g, "")
        .trim() || "Maintenance";
      const finalNotes = `[Blocked: ${cleanedReason}] ${cleanedReason}`;

      const payload = {
        id: blockRecord.id,
        room: blockRecord.room,
        guest: blockRecord.guest || "🔒 Blocked (Maintenance)",
        status: "blocked",
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        notes: finalNotes,
      };
      const updated = await updateBooking(blockRecord.id, payload);
      const merged = { ...blockRecord, ...payload, ...(updated || {}) };
      setBookingsList((prev) => prev.map((b) => (b.id === blockRecord.id || b.id === updated?.id ? merged : b)));
      setToast(`Updated maintenance block dates for Room ${blockRecord.room} (${newCheckIn} to ${newCheckOut})`);
      setPendingBlockEdit(null);
      window.dispatchEvent(new Event("pms_bookings_updated"));
    } catch (err) {
      setToast(err.message || "Could not update block dates");
    }
  }
  function handleKebabClick(e, booking, room) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 820;
    const menuHeight = 340;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
    const openBelow = rect.bottom + menuHeight + 8 <= window.innerHeight;
    const top = openBelow ? rect.bottom + 8 : Math.max(8, rect.top - menuHeight - 8);
    setMenuInfo({ booking, room, style: { top, left } });
  }
  function closeSlip() {
    setSlipInfo(null);
  }

  // --- ⋮ mega menu -> individual quick-action forms ---
  function handleSelectAction(actionId, booking, room) {
    const resolvedId = resolveActionId(actionId);
    const cfg = ACTION_FORMS[resolvedId];
    if (!cfg) return;

    if (resolvedId === "sendSelfCheckIn") {
      setMenuInfo(null);
      setSendCheckInBooking(booking);
      return;
    }

    if (resolvedId === "scanId") {
      setMenuInfo(null);
      setAIScannerTargetBooking(booking);
      setShowAIScannerModal(true);
      return;
    }

    if (cfg.external === "editReservation") {
      setMenuInfo(null);
      setActiveCell({ roomNo: booking.room, date: booking.checkIn, booking, mode: "form" });
      return;
    }
    if (cfg.external === "viewFolio") {
      setMenuInfo(null);
      setSlipInfo({ booking, room });
      return;
    }
    if (cfg.external === "printInvoice") {
      setMenuInfo(null);
      handlePrintFromSlip(booking);
      return;
    }
    if (cfg.external === "email") {
      setMenuInfo(null);
      handleEmailFromSlip(booking);
      return;
    }
    if (cfg.external === "log") {
      setMenuInfo(null);
      openLogViewer(booking);
      return;
    }

    setMenuInfo(null);
    setQuickAction({ id: resolvedId, booking, room });
  }

  async function openLogViewer(booking) {
    setLogInfo({ booking, logs: [], loading: true });
    try {
      const all = await getAuditLogs();
      const logs = all.filter((entry) => entry.bookingId === booking.id).slice(0, 20);
      setLogInfo({ booking, logs, loading: false });
    } catch (err) {
      setLogInfo({ booking, logs: [], loading: false });
      setToast(err.message || "Could not load activity log");
    }
  }

  function pick(obj, keys) {
    const out = {};
    keys.forEach((k) => { out[k] = obj?.[k]; });
    return out;
  }

  async function applyBookingUpdate(booking, patch, label) {
    lastActionRef.current = { bookingId: booking.id, previousData: pick(booking, Object.keys(patch)), label };
    const updated = await updateBooking(booking.id, { ...patch, logLabel: label });
    if (isInactiveBooking(updated)) {
      setBookingsList((prev) => prev.filter((b) => b.id !== updated.id));
    } else {
      setBookingsList((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    }
    return updated;
  }

  async function handleQuickAction(actionId, booking, values) {
    try {
      switch (actionId) {
        case "modifyCheckIn": {
          const newCheckIn = values.checkIn || booking.checkIn;
          const roomNoStr = String(booking.room || "").trim();
          if (roomNoStr && roomNoStr.toLowerCase() !== "unassigned") {
            const overlap = bookingsList.find(
              (b) =>
                b &&
                b.id !== booking.id &&
                !isInactiveBooking(b) &&
                String(b.room || "").trim() === roomNoStr &&
                b.checkIn < booking.checkOut &&
                b.checkOut > newCheckIn
            );
            if (overlap) {
              setToast(`❌ Cannot modify check-in: Room ${booking.room} is occupied/blocked by ${overlap.guest} (${overlap.checkIn} to ${overlap.checkOut})`);
              return;
            }
          }
          await applyBookingUpdate(booking, { checkIn: newCheckIn, checkInTime: values.checkInTime }, "Modify Check In");
          setToast(`Check-in updated: ${booking.guest}`);
          break;
        }
        case "modifyCheckout": {
          const newCheckOut = values.checkOut || booking.checkOut;
          const roomNoStr = String(booking.room || "").trim();
          if (roomNoStr && roomNoStr.toLowerCase() !== "unassigned") {
            const overlap = bookingsList.find(
              (b) =>
                b &&
                b.id !== booking.id &&
                !isInactiveBooking(b) &&
                String(b.room || "").trim() === roomNoStr &&
                b.checkIn < newCheckOut &&
                b.checkOut > booking.checkIn
            );
            if (overlap) {
              setToast(`❌ Cannot extend stay: Room ${booking.room} is occupied/blocked by ${overlap.guest} (${overlap.checkIn} to ${overlap.checkOut})`);
              return;
            }
          }
          await applyBookingUpdate(booking, { checkOut: newCheckOut, checkOutTime: values.checkOutTime }, "Modify Checkout");
          setToast(`Checkout updated: ${booking.guest}`);
          break;
        }
        case "moveRoom":
        case "assignRoom": {
          if (!values.room) { setToast("Pick a room first"); return; }
          const targetRoomStr = String(values.room).trim();
          if (targetRoomStr.toLowerCase() !== "unassigned") {
            const overlap = bookingsList.find(
              (b) =>
                b &&
                b.id !== booking.id &&
                !isInactiveBooking(b) &&
                String(b.room || "").trim() === targetRoomStr &&
                b.checkIn < booking.checkOut &&
                b.checkOut > booking.checkIn
            );
            if (overlap) {
              setToast(`❌ Cannot move to Room ${values.room}: Room is occupied/blocked by ${overlap.guest} (${overlap.checkIn} to ${overlap.checkOut})`);
              return;
            }
          }
          lastActionRef.current = { bookingId: booking.id, previousData: { room: booking.room }, label: "Move Room" };
          const updated = await apiMoveBooking(booking.id, { room: values.room });
          setBookingsList((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          setToast(`Moved to Room ${values.room}: ${booking.guest}`);
          break;
        }
        case "unassign":
          setQuickAction({ id: "moveRoom", booking, room: null });
          return;
        case "undo": {
          const last = lastActionRef.current;
          if (!last || last.bookingId !== booking.id) {
            setToast("Nothing to undo");
            break;
          }
          const restored = await updateBooking(booking.id, last.previousData);
          if (isInactiveBooking(restored)) {
            setBookingsList((prev) => prev.filter((b) => b.id !== restored.id));
          } else {
            setBookingsList((prev) => prev.map((b) => (b.id === restored.id ? restored : b)));
          }
          setToast(`Undone: ${last.label}`);
          lastActionRef.current = null;
          break;
        }
        case "delete":
          await apiDeleteBooking(booking.id);
          setBookingsList((prev) => prev.filter((b) => b.id !== booking.id));
          setToast(`Booking deleted: ${booking.guest}`);
          break;
        case "noShow":
          if (!values.confirmArrival) { setToast("Please confirm the guest did not arrive"); return; }
          await applyBookingUpdate(booking, { status: "no-show" }, "No Show");
          setToast(`Marked No Show: ${booking.guest}`);
          break;
        case "block": {
          const reason = values.blockReason || "Maintenance";
          const newNotes = values.notes ? `[Blocked: ${reason}] ${values.notes}` : `[Blocked: ${reason}]`;
          const checkIn = values.checkIn || booking.checkIn;
          const checkOut = values.checkOut || booking.checkOut;
          const targetRoom = rooms.find((r) => r.no === booking.room);
          const roomType = targetRoom?.type || "Standard";

          const roomNoStr = String(booking.room || "").trim();
          const overlapBooking = bookingsList.find(
            (b) =>
              b &&
              b.id !== booking.id &&
              !isInactiveBooking(b) &&
              String(b.room || "").trim() === roomNoStr &&
              b.checkIn < checkOut &&
              b.checkOut > checkIn
          );

          if (overlapBooking) {
            setToast(`❌ Cannot block Room ${booking.room}: Overlaps with guest booking for ${overlapBooking.guest} (${overlapBooking.checkIn} to ${overlapBooking.checkOut})`);
            return;
          }

          if (booking.id && !booking.id.startsWith("temp-")) {
            await applyBookingUpdate(booking, {
              status: "blocked",
              guest: `🔒 Blocked (${reason})`,
              checkIn,
              checkOut,
              notes: newNotes,
              color: "#64748b"
            }, "Block Room");
          } else {
            const blockRecord = {
              guest: `🔒 Blocked (${reason})`,
              room: booking.room,
              roomType: roomType,
              checkIn,
              checkOut,
              status: "blocked",
              color: "#64748b",
              notes: newNotes,
              source: "Maintenance"
            };
            const created = await createBooking(blockRecord);
            setBookingsList((prev) => [...prev, created]);
          }
          setToast(`Room ${booking.room} blocked for ${reason} (${checkIn} to ${checkOut})`);
          break;
        }
        case "unblock":
          await applyBookingUpdate(booking, {
            status: "confirmed",
            guest: booking.guest.replace(/^🔒 Blocked \([^)]*\)\s*/, "") || "Guest",
            color: "#2E9E6D"
          }, "Unblock Room");
          setToast(`Room ${booking.room} unblocked and made available`);
          break;
        case "enquiry": {
          const stamp = new Date().toLocaleString();
          const notes = `${booking.notes ? `${booking.notes}\n` : ""}[Enquiry ${stamp}] ${values.message}`;
          await applyBookingUpdate(booking, { notes }, "Enquiry");
          setToast(`Enquiry saved: ${booking.guest}`);
          break;
        }
        case "addGuest":
          await applyBookingUpdate(booking, {
            adults: Number(values.adults) || booking.adults,
            children: Number(values.children) || 0,
            infants: Number(values.infants) || 0,
          }, "Add Guest");
          setToast(`Guests updated: ${booking.guest}`);
          break;
        case "editGuest":
          await applyBookingUpdate(booking, {
            guest: values.guest, email: values.email, phone: values.phone, address: values.address,
          }, "Edit Guest");
          setToast("Contact info updated");
          break;
        case "guestDetails":
          await applyBookingUpdate(booking, {
            nationality: values.nationality, companyName: values.companyName, idType: values.idType, idNumber: values.idNumber,
          }, "Guest Details");
          setToast(`Guest details saved: ${booking.guest}`);
          break;
        case "scanId":
          await applyBookingUpdate(booking, { idType: values.idType, idNumber: values.idNumber, idScanned: true }, "Scan ID");
          setToast(`ID saved: ${booking.guest}`);
          break;
        case "scanSignature":
          await applyBookingUpdate(booking, { signatureOnFile: Boolean(values.signatureOnFile) }, "Scan Signature");
          setToast(`Signature saved: ${booking.guest}`);
          break;
        case "addNotes":
          await applyBookingUpdate(booking, { notes: values.notes }, "Add Notes");
          setToast(`Notes saved: ${booking.guest}`);
          break;
        case "settleDue":
        case "deposit": {
          if (!Number(values.amount)) { setToast("Enter an amount"); return; }
          const updated = await addSettlement(booking.id, {
            amount: Number(values.amount),
            mode: values.mode || "Cash",
            note: actionId === "deposit" ? "Deposit" : "",
          });
          setBookingsList((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          setToast(`$${values.amount} recorded for ${booking.guest}`);
          break;
        }
        case "charges":
        case "addExtra": {
          if (!values.label || !Number(values.amount)) { setToast("Enter a label and amount"); return; }
          const updated = await addExtra(booking.id, { label: values.label, amount: Number(values.amount) });
          setBookingsList((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          setToast(`Charge added: ${values.label}`);
          break;
        }
        case "discount":
          await applyBookingUpdate(booking, { discountPercent: Number(values.discountPercent) || 0 }, "Discount");
          setToast(`Discount applied: ${booking.guest}`);
          break;
        case "exemptTax":
          await applyBookingUpdate(booking, { taxExempt: true, taxPercent: 0, taxAmount: 0 }, "Exempt Tax");
          setToast(`Tax exempted: ${booking.guest}`);
          break;
        case "markPrepaid": {
          const due = Number(booking.balanceDue || 0);
          if (due <= 0) { setToast("No balance due"); break; }
          const updated = await addSettlement(booking.id, { amount: due, mode: "Prepaid", note: "Marked prepaid" });
          setBookingsList((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          setToast(`Marked prepaid: ${booking.guest}`);
          break;
        }
        case "checkIn": {
          const currentBizDate = getBusinessDate();
          if (booking.checkIn > currentBizDate) {
            alert(`⚠️ Future Check-In Warning!\n\nThis reservation is scheduled for ${booking.checkIn}, but the current PMS working business date is ${currentBizDate}. Guest cannot be checked in prior to their arrival date.`);
            break;
          }
          const targetRoomStr = String(booking.room || "").trim();
          if (targetRoomStr && targetRoomStr.toLowerCase() !== "unassigned") {
            const activeOccupant = bookingsList.find(
              (b) =>
                String(b.id) !== String(booking.id) &&
                String(b.room || "").trim() === targetRoomStr &&
                (b.status === "checked-in" || b.status === "occupied") &&
                !b.isDeleted &&
                b.checkIn < booking.checkOut &&
                b.checkOut > booking.checkIn
            );
            if (activeOccupant) {
              alert(`⚠️ Cannot check in guest ${booking.guest}!\n\nRoom ${targetRoomStr} is currently occupied by active in-house guest (${activeOccupant.guest || activeOccupant.fullName || "Guest"}). Please check out the existing guest before checking in.`);
              break;
            }
          }
          await applyBookingUpdate(booking, { status: "checked-in" }, "Check In");
          setToast(`Checked in: ${booking.guest}`);
          break;
        }
        case "checkOut": {
          const bal = Number(booking.balanceDue || 0);
          if (bal > 0.01) {
            alert(`⚠️ Cannot check out guest ${booking.guest}! Outstanding balance of $${bal.toFixed(2)} must be settled before check-out.`);
            setFolioModalBooking(booking);
            return;
          }
          await applyBookingUpdate(booking, { status: "checked-out" }, "Check Out");
          setToast(`Checked out: ${booking.guest}`);
          break;
        }
        case "documents":
          break;
        case "confirmEnquiry": {
          const updated = await applyBookingUpdate(booking, { status: "confirmed", isEnquiry: false }, "Confirm Reservation");
          setBookingsList((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: "confirmed", isEnquiry: false } : b)));
          setToast(`✅ Enquiry confirmed as active reservation for ${booking.guest}`);
          break;
        }
        case "deleteEnquiry": {
          const ok = window.confirm(`Delete enquiry hold for ${booking.guest}? This will free Room ${booking.room}.`);
          if (!ok) break;
          await apiDeleteBooking(booking.id);
          setBookingsList((prev) => prev.filter((b) => b.id !== booking.id));
          setToast(`🗑️ Enquiry deleted: ${booking.guest}`);
          break;
        }
        default:
          break;
      }
      setQuickAction(null);
    } catch (err) {
      setToast(err.message || "Could not complete action");
    }
  }
  function handleEditFromSlip(booking) {
    setSlipInfo(null);
    setActiveCell({ roomNo: booking.room, date: booking.checkIn, booking, mode: "form" });
  }
  async function handleCancelFromSlip(booking) {
    const ok = window.confirm(`Cancel the booking for ${booking.guest} (Room ${booking.room})? The room will be freed and the booking kept in Master Data as cancelled.`);
    if (!ok) return;
    try {
      const updated = await apiCancelBooking(booking.id);
      setBookingsList((prev) => prev.filter((b) => b.id !== updated.id)); // frees the calendar cell; still lives in Master Data
      setToast(`Booking cancelled: ${booking.guest} · Room ${booking.room}`);
      closeSlip();
    } catch (err) {
      setToast(err.message || "Could not cancel booking");
    }
  }
  async function handleAddExtraFromSlip(booking, extra) {
    try {
      const updated = await addExtra(booking.id, extra);
      setBookingsList((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setSlipInfo((prev) => (prev && prev.booking.id === updated.id ? { ...prev, booking: updated } : prev));
      if (updated) setSelectedFolioBooking({ ...updated });
      setToast(`Extra added: ${extra.label} · $${extra.amount}`);
      return updated;
    } catch (err) {
      setToast(err.message || "Could not add extra charge");
    }
  }
  async function handleSettlementFromSlip(booking, payment) {
    try {
      const updated = await addSettlement(booking.id, payment);
      setBookingsList((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setSlipInfo((prev) => (prev && prev.booking.id === updated.id ? { ...prev, booking: updated } : prev));
      if (updated) setSelectedFolioBooking({ ...updated });
      setToast(payment.isRefund ? `Refund recorded: $${Math.abs(payment.amount)} via ${payment.mode}` : `Settlement recorded: $${payment.amount} via ${payment.mode}`);
      return updated;
    } catch (err) {
      setToast(err.message || "Could not record settlement");
    }
  }
  async function handleEmailFromSlip(booking) {
    try {
      const result = await emailBooking(booking.id);
      setToast(result.message || "Email sent");
    } catch (err) {
      setToast(err.message || "Could not send email");
    }
  }
  function handlePrintFromSlip(booking) {
    if (!booking) return;
    setSlipInfo({ booking, room: booking.room });
    setTimeout(() => {
      window.print();
    }, 300);
  }
  function handleContactFromSlip(booking) {
    if (booking.phone) window.open(`tel:${booking.phone}`, "_self");
    else setToast("No phone number on file for this guest");
  }
  function closeModal() {
    setActiveCell(null);
  }
  function cancelForm() {
    setActiveCell(null);
  }
  async function handleDeleteBooking(booking) {
    if (!booking) return;
    const ok = window.confirm(`Delete the booking for ${booking.guest} (Room ${booking.room})? This can't be undone.`);
    if (!ok) return;
    try {
      await apiDeleteBooking(booking.id);
      setBookingsList((prev) => prev.filter((b) => b.id !== booking.id));
      setToast(`Booking deleted: ${booking.guest} · Room ${booking.room}`);
    } catch (err) {
      setToast(err.message || "Could not delete booking");
    }
    closeModal();
    closeSlip();
  }

  async function handleBookingSaved(bookingRecord) {
    const wasEditing = Boolean(activeCell?.booking);
    try {
      const saved = wasEditing
        ? await updateBooking(activeCell.booking.id, bookingRecord)
        : await createBooking(bookingRecord);
      setBookingsList((prev) => {
        const idx = prev.findIndex((b) => b.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      setToast(
        wasEditing
          ? `Booking updated: ${saved.guest} · Room ${saved.room}`
          : saved.status === "checked-in"
          ? `Check-in saved: ${saved.guest} · Room ${saved.room}`
          : `Reservation booked: ${saved.guest} · Room ${saved.room}`
      );
      setActiveCell(null);
      return saved;
    } catch (err) {
      const errMsg = err.message || "Could not save booking";
      setToast(errMsg);
      if (typeof window !== "undefined") window.alert(errMsg);
      throw err;
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!activeCell) return;
    function onKeyDown(e) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCell]);

  // --- Drag to move a booking to another room/date ---
  function handleBarDragStart(e, booking) {
    const barRect = e.currentTarget.getBoundingClientRect();
    dragGrabOffsetRef.current = e.clientX - barRect.left;
    const bId = String(booking.id || booking._id || "").trim();
    e.dataTransfer.setData("text/plain", bId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(bId);
  }
  function handleBarDragEnd() {
    setDraggingId(null);
  }
  // --- Confirm Room Move Action ---
  async function confirmRoomMove(shouldUpdateRate) {
    if (!pendingMove) return;
    const { booking, newRoomNo, newCheckIn, newCheckOut, newRate, newCategory, nights } = pendingMove;

    try {
      const patch = {
        room: newRoomNo,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        roomType: newCategory,
      };

      if (shouldUpdateRate) {
        patch.ratePerNight = newRate;
        patch.subtotal = nights * newRate;
        const taxAmount = (patch.subtotal * (booking.taxPercent || 12)) / 100;
        patch.taxAmount = taxAmount;
        patch.totalAmount = patch.subtotal + taxAmount + (booking.extraCharges || 0);
        patch.balanceDue = patch.totalAmount - (booking.advanceAmount || 0);
      }

      const updated = await updateBooking(booking.id, patch);
      setBookingsList((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setToast(`Moved ${booking.guest} → Room ${newRoomNo} (${shouldUpdateRate ? "Rate Updated" : "Original Rate Maintained"})`);
      setPendingMove(null);
    } catch (err) {
      setToast(err.message || "Could not move booking");
      setPendingMove(null);
    }
  }

  // --- Confirm Stay Resize Action ---
  async function confirmStayResize() {
    if (!pendingResize) return;
    const { booking, isBlock, newCheckIn, newCheckOut, newNights, ratePerNight } = pendingResize;

    const isMaintenanceBlock = Boolean(
      isBlock &&
      (booking.isBlocked ||
        booking.status === "blocked" ||
        booking.status === "maintenance" ||
        booking.status === "Out of Order")
    );

    if (isMaintenanceBlock) {
      await handleSaveBlockDates(booking, newCheckIn, newCheckOut, booking.notes);
      setPendingResize(null);
      setIsEditingRate(false);
      return;
    }

    try {
      // Get existing room rate items from booking or context folios
      const existingFolioA = booking.folioA || booking.folio?.folioA || (typeof folios !== 'undefined' && folios ? folios[booking.id]?.folioA : null) || [];
      const existingRoomRates = existingFolioA.filter(item => 
        item.category === 'Room Rate' || 
        (item.description || "").toLowerCase().includes("room tariff") || 
        (item.description || "").toLowerCase().includes("room charge")
      );
      const ratesMap = booking.nightlyRatesMap || {};
      const oldNights = pendingResize.oldNights || dayOffset(booking.checkIn, booking.checkOut) || 1;

      // Calculate original rate per night for existing stay nights
      const oldSubtotal = Number(booking.subtotal || 0);
      const originalNightRate = (oldSubtotal > 0 && oldNights > 0)
        ? Math.round(oldSubtotal / oldNights)
        : getBookingNightlyRate(booking);

      const d1 = parseLocalDate(newCheckIn);
      const updatedRoomRates = [];
      const roomTypeLabel = booking.roomType || 'Standard';

      for (let i = 0; i < newNights; i++) {
        const nightDateObj = addDays(d1, i);
        const nightDateStr = dateToKey(nightDateObj);

        const nightLabel = newNights > 1 
          ? `Room Tariff (${booking.ratePlan ? booking.ratePlan + ' - ' : ''}${roomTypeLabel} - Night ${i + 1} of ${newNights})`
          : `Room Tariff (${booking.ratePlan ? booking.ratePlan + ' - ' : ''}${roomTypeLabel})`;

        const existingItem = existingRoomRates[i] || existingRoomRates.find(r => r.date === nightDateStr);

        if (i < oldNights) {
          // Existing night: preserve existing item rate, ratesMap rate, or originalNightRate
          const existingRate = existingItem
            ? Number(existingItem.amountUSD || existingItem.amount || originalNightRate)
            : (ratesMap[nightDateStr] !== undefined ? Number(ratesMap[nightDateStr]) : originalNightRate);

          const exclTaxVal = Math.round(existingRate * 0.88 * 100) / 100;
          const taxAmt = Math.round(existingRate * 0.12 * 100) / 100;

          if (existingItem) {
            updatedRoomRates.push({
              ...existingItem,
              date: nightDateStr,
              description: nightLabel,
            });
          } else {
            updatedRoomRates.push({
              id: `chg_night_${i + 1}_${Date.now()}`,
              date: nightDateStr,
              category: 'Room Rate',
              description: nightLabel,
              amountUSD: existingRate,
              amount: existingRate,
              exclTax: exclTaxVal,
              taxAmount: taxAmt
            });
          }
        } else {
          // Extended night: use newly specified ratePerNight
          const nightRate = ratePerNight;
          const exclTaxVal = Math.round(nightRate * 0.88 * 100) / 100;
          const taxAmt = Math.round(nightRate * 0.12 * 100) / 100;

          updatedRoomRates.push({
            id: `chg_night_${i + 1}_${Date.now()}`,
            date: nightDateStr,
            category: 'Room Rate',
            description: nightLabel,
            amountUSD: nightRate,
            amount: nightRate,
            exclTax: exclTaxVal,
            taxAmount: taxAmt
          });
        }
      }

      const existingOtherFolioA = (booking.folioA || booking.folio?.folioA || []).filter(item => {
        const catLower = (item.category || '').toLowerCase();
        const descLower = (item.description || item.label || '').toLowerCase();
        return !catLower.includes('room rate') && !descLower.includes('room tariff') && !descLower.includes('room charge');
      });

      const finalFolioA = [...updatedRoomRates, ...existingOtherFolioA];

      // Calculate totals by summing each night's rate
      const subtotal = updatedRoomRates.reduce((sum, item) => sum + Number(item.amountUSD || item.amount || 0), 0);
      const taxAmount = Math.round(((subtotal * (booking.taxPercent || 12)) / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount + (booking.extraCharges || 0)) * 100) / 100;
      const balanceDue = Math.max(0, Math.round((totalAmount - (booking.advanceAmount || 0)) * 100) / 100);

      const patch = {
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        nights: newNights,
        subtotal,
        taxAmount,
        totalAmount,
        balanceDue,
        folioA: finalFolioA,
        nightlyRatesMap: finalFolioA.filter(i => i.category === 'Room Rate' || (i.description || '').toLowerCase().includes('room tariff')).reduce((acc, item) => {
          if (item.date) acc[item.date] = Number(item.amountUSD || item.amount || 0);
          return acc;
        }, {})
      };

      const updated = await updateBooking(booking.id || booking._id, patch);
      const targetId = String(updated?.id || updated?._id || booking.id || booking._id).trim();
      setBookingsList((prev) => prev.map((b) => (String(b.id || b._id).trim() === targetId ? { ...b, ...patch, ...updated } : b)));
      window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
      setToast(`Updated stay length for ${booking.guest} (${newNights} Nights @ $${ratePerNight}/night)`);
      setPendingResize(null);
      setIsEditingRate(false);
    } catch (err) {
      setToast(err.message || "Could not update stay length");
      setPendingResize(null);
      setIsEditingRate(false);
    }
  }

  function handleTrackDrop(e, room) {
    e.preventDefault();
    const id = String(e.dataTransfer.getData("text/plain") || "").trim();
    const booking = bookingsList.find((b) => String(b.id || b._id || "").trim() === id);
    setDraggingId(null);
    if (!booking) return;

    const bookingIdStr = String(booking.id || booking._id || "").trim();
    const trackRect = e.currentTarget.getBoundingClientRect();
    const dayWidth = trackRect.width / days.length;
    const dropLeftPx = e.clientX - trackRect.left - dragGrabOffsetRef.current;
    const nights = dayOffset(booking.checkIn, booking.checkOut) || 1;

    let newStartIdx = Math.round(dropLeftPx / dayWidth);
    newStartIdx = Math.max(0, Math.min(newStartIdx, (days.length - 1) - nights));

    const newCheckInKey = dateToKey(addDays(new Date(weekStartKey), newStartIdx));
    const newCheckOutKey = dateToKey(addDays(new Date(weekStartKey), newStartIdx + nights));

    if (String(booking.room).trim() === String(room.no).trim() && booking.checkIn === newCheckInKey) return;

    const conflict = bookingsList.some(
      (b) =>
        String(b.id || b._id || "").trim() !== bookingIdStr &&
        String(b.room || "").trim() === String(room.no).trim() &&
        b.status !== "cancelled" &&
        !b.isDeleted &&
        newCheckInKey < b.checkOut &&
        newCheckOutKey > b.checkIn
    );
    if (conflict) {
      setToast(`Can't move here — Room ${room.no} is already booked for those dates.`);
      return;
    }

    const sourceRoom = rooms.find((r) => r.no === booking.room) || {};
    const targetRoom = room;

    const oldRate = Number(booking.ratePerNight || sourceRoom.ratePerNight || 3200);
    const newRate = Number(targetRoom.ratePerNight || oldRate);
    const rateDiffPerNight = newRate - oldRate;
    const totalRateDiff = rateDiffPerNight * nights;
    const sourceCat = sourceRoom.type || booking.roomType || "Standard";
    const targetCat = targetRoom.type || targetRoom.category || "Standard";
    const isCategoryChange = sourceCat !== targetCat;

    setPendingMove({
      booking,
      targetRoom: room,
      newCheckIn: newCheckInKey,
      newCheckOut: newCheckOutKey,
      oldRoomNo: booking.room,
      newRoomNo: room.no,
      oldCategory: sourceCat,
      newCategory: targetCat,
      oldRate,
      newRate,
      rateDiffPerNight,
      totalRateDiff,
      isCategoryChange,
      nights,
    });
  }

  // --- Drag the right edge to extend/shrink the stay ---
  function handleResizeStart(e, booking, rawStartDay) {
    return handleResizeStartRight(e, booking, rawStartDay);
  }

  function handleResizeStartRight(e, booking, rawStartDay) {
    e.preventDefault();
    e.stopPropagation();
    const trackEl = e.currentTarget.closest(".calendar-room-track");
    if (!trackEl) return;
    const trackRect = trackEl.getBoundingClientRect();
    const dayWidth = trackRect.width / days.length;
    const startClientX = e.clientX;
    const roomNo = String(booking.room || "").trim();
    const bookingIdStr = String(booking.id || booking._id || "").trim();
    const checkInKey = booking.checkIn;
    const originalEndIdx = rawStartDay + dayOffset(checkInKey, booking.checkOut);
    let lastAppliedCheckOutKey = booking.checkOut;

    const isBlock = Boolean(
      booking.isBlocked ||
      booking.status === "blocked" ||
      booking.status === "maintenance" ||
      booking.status === "Out of Order"
    );

    setResizingId(bookingIdStr);

    function onMouseMove(ev) {
      const deltaPx = ev.clientX - startClientX;
      const deltaDays = Math.round(deltaPx / dayWidth);
      let newEndIdx = originalEndIdx + deltaDays;
      newEndIdx = Math.max(rawStartDay, Math.min(newEndIdx, days.length - 1));
      const newCheckOutKey = dateToKey(addDays(new Date(weekStartKey), newEndIdx));
      if (newCheckOutKey === lastAppliedCheckOutKey) return;

      const conflict = bookingsList.some((b) => {
        const curIdStr = String(b.id || b._id || "").trim();
        if (curIdStr === bookingIdStr) return false;
        return (
          String(b.room || "").trim() === roomNo &&
          b.status !== "cancelled" &&
          !b.isDeleted &&
          checkInKey < b.checkOut &&
          newCheckOutKey > b.checkIn
        );
      });
      if (conflict) return;

      lastAppliedCheckOutKey = newCheckOutKey;
      setBookingsList((prev) => prev.map((b) => (String(b.id || b._id).trim() === bookingIdStr ? { ...b, checkOut: newCheckOutKey } : b)));
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setResizingId(null);

      if (lastAppliedCheckOutKey !== booking.checkOut) {
        setBookingsList((prev) => prev.map((b) => (String(b.id || b._id || "").trim() === bookingIdStr ? booking : b))); // revert visual until confirmed

        const oldNights = dayOffset(booking.checkIn, booking.checkOut) || 1;
        const newNights = dayOffset(booking.checkIn, lastAppliedCheckOutKey) || 1;
        const diffNights = newNights - oldNights;
        const isVirt = isBlock || isVirtualRoomOrBooking(booking);
        const ratePerNight = isVirt ? 0 : getBookingNightlyRate(booking);
        const diffAmount = isVirt ? 0 : diffNights * ratePerNight;

        setPendingBlockEdit(null);
        setPendingResize({
          booking,
          isBlock,
          newCheckIn: booking.checkIn,
          newCheckOut: lastAppliedCheckOutKey,
          oldCheckIn: booking.checkIn,
          oldCheckOut: booking.checkOut,
          oldNights,
          newNights,
          diffNights,
          ratePerNight,
          diffAmount,
        });
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // --- Drag the left edge to move check-in earlier/later (checkout stays fixed) ---
  function handleResizeStartLeft(e, booking, rawEndDay) {
    e.preventDefault();
    e.stopPropagation();
    const trackEl = e.currentTarget.closest(".calendar-room-track");
    if (!trackEl) return;
    const trackRect = trackEl.getBoundingClientRect();
    const dayWidth = trackRect.width / days.length;
    const startClientX = e.clientX;
    const roomNo = String(booking.room || "").trim();
    const bookingIdStr = String(booking.id || booking._id || "").trim();
    const checkOutKey = booking.checkOut;
    const originalStartIdx = rawEndDay - dayOffset(booking.checkIn, checkOutKey);
    let lastAppliedCheckInKey = booking.checkIn;

    const isBlock = Boolean(
      booking.isBlocked ||
      booking.status === "blocked" ||
      booking.status === "maintenance" ||
      booking.status === "Out of Order"
    );

    setResizingId(bookingIdStr);

    function onMouseMove(ev) {
      const deltaPx = ev.clientX - startClientX;
      const deltaDays = Math.round(deltaPx / dayWidth);
      let newStartIdx = originalStartIdx + deltaDays;
      newStartIdx = Math.max(0, Math.min(newStartIdx, rawEndDay - 1));
      const newCheckInKey = dateToKey(addDays(new Date(weekStartKey), newStartIdx));
      if (newCheckInKey === lastAppliedCheckInKey) return;

      const conflict = bookingsList.some((b) => {
        const curIdStr = String(b.id || b._id || "").trim();
        if (curIdStr === bookingIdStr) return false;
        return (
          String(b.room || "").trim() === roomNo &&
          b.status !== "cancelled" &&
          !b.isDeleted &&
          newCheckInKey < b.checkOut &&
          checkOutKey > b.checkIn
        );
      });
      if (conflict) return;

      lastAppliedCheckInKey = newCheckInKey;
      setBookingsList((prev) => prev.map((b) => (String(b.id || b._id || "").trim() === bookingIdStr ? { ...b, checkIn: newCheckInKey } : b)));
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setResizingId(null);

      if (lastAppliedCheckInKey !== booking.checkIn) {
        setBookingsList((prev) => prev.map((b) => (String(b.id || b._id || "").trim() === bookingIdStr ? booking : b))); // revert visual until confirmed

        const oldNights = dayOffset(booking.checkIn, booking.checkOut) || 1;
        const newNights = dayOffset(lastAppliedCheckInKey, booking.checkOut) || 1;
        const diffNights = newNights - oldNights;
        const isVirt = isBlock || isVirtualRoomOrBooking(booking);
        const ratePerNight = isVirt ? 0 : getBookingNightlyRate(booking);
        const diffAmount = isVirt ? 0 : diffNights * ratePerNight;

        setPendingBlockEdit(null);
        setPendingResize({
          booking,
          isBlock,
          newCheckIn: lastAppliedCheckInKey,
          newCheckOut: booking.checkOut,
          oldCheckIn: booking.checkIn,
          oldCheckOut: booking.checkOut,
          oldNights,
          newNights,
          diffNights,
          ratePerNight,
          diffAmount,
        });
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleHighlightDirectBookings() {
    const directBookings = bookingsList.filter(
      (b) => b.source === "Direct Web Booking Engine" || b.segment === "DIRECT"
    );
    if (directBookings.length === 0) {
      setToast("No Direct Web Bookings found yet.");
      return;
    }
    const latest = directBookings[0];
    if (latest?.checkIn) {
      const cleanStr = latest.checkIn.length === 10 ? latest.checkIn + "T00:00:00" : latest.checkIn;
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) setWeekStart(d);
    }
    setSelectedFolioBooking(latest);
    setToast(`Highlighted Direct Web Booking: ${latest.guest} (Room ${latest.room}) 🌐`);
  }

  const activeRoom = activeCell ? rooms.find((r) => r.no === activeCell.roomNo) : null;

  return (
    <div className="calendar-page">
      {navbarTarget && createPortal(
        <PageHeader
          title=""
          action={(
            <div className="calendar-controls-tier2" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {/* LEFT GROUP: VIEW SWITCHER */}
              <div className="tier2-left-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* VIEW MODE SWITCHER (TAPE CHART vs ROOM VIEW) */}
                <div className="view-mode-switcher" style={{ display: "flex", gap: 2, background: "#f8fafc", padding: 3, borderRadius: 8, border: "1px solid #e2e8f0", alignItems: "center" }}>
                  <button
                    type="button"
                    className={`btn btn-xs ${viewMode === "calendar" ? "btn-primary" : "btn-link"}`}
                    onClick={() => setViewMode("calendar")}
                    style={viewMode === "calendar" ? { fontWeight: 800, padding: "5px 14px", borderRadius: "6px", fontSize: "12.5px", background: "#d3d3d3", color: "#0f172a", border: "1px solid #b8b8b8", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { fontWeight: 700, padding: "5px 14px", borderRadius: "6px", fontSize: "12.5px", color: "#64748b", background: "transparent", border: "none" }}
                  >
                    📅 Tape Chart
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${viewMode === "room_grid" ? "btn-primary" : "btn-link"}`}
                    onClick={() => setViewMode("room_grid")}
                    style={viewMode === "room_grid" ? { fontWeight: 800, padding: "5px 14px", borderRadius: "6px", fontSize: "12.5px", background: "#d3d3d3", color: "#0f172a", border: "1px solid #b8b8b8", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { fontWeight: 700, padding: "5px 14px", borderRadius: "6px", fontSize: "12.5px", color: "#64748b", background: "transparent", border: "none" }}
                  >
                    🏨 Room View
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${viewMode === "data" ? "btn-primary" : "btn-link"}`}
                    onClick={() => setViewMode("data")}
                    style={viewMode === "data" ? { fontWeight: 800, padding: "5px 14px", borderRadius: "6px", fontSize: "12.5px", background: "#d3d3d3", color: "#0f172a", border: "1px solid #b8b8b8", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { fontWeight: 700, padding: "5px 14px", borderRadius: "6px", fontSize: "12.5px", color: "#64748b", background: "transparent", border: "none" }}
                  >
                    📊 Data
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${viewMode === "daily" ? "btn-primary" : "btn-link"}`}
                    onClick={() => setViewMode("daily")}
                    style={viewMode === "daily" ? { fontWeight: 800, padding: "5px 14px", borderRadius: "6px", fontSize: "12.5px", background: "#d3d3d3", color: "#0f172a", border: "1px solid #b8b8b8", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { fontWeight: 700, padding: "5px 14px", borderRadius: "6px", fontSize: "12.5px", color: "#64748b", background: "transparent", border: "none" }}
                  >
                    🗓️ Daily
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${viewMode === "reviews" ? "btn-primary" : "btn-link"}`}
                    onClick={() => setViewMode("reviews")}
                    style={viewMode === "reviews" ? { fontWeight: 800, padding: "5px 14px", borderRadius: "6px", fontSize: "12.5px", background: "#d3d3d3", color: "#0f172a", border: "1px solid #b8b8b8", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { fontWeight: 700, padding: "5px 14px", borderRadius: "6px", fontSize: "12.5px", color: "#64748b", background: "transparent", border: "none" }}
                  >
                    ⭐ Reviews
                  </button>
                </div>
              </div>

              {/* MIDDLE GROUP: DATE NAV & VIEW DAYS RANGE */}
              <div className="tier2-middle-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" className="calendar-nav-arrow" onClick={() => setWeekStart((date) => addDays(date, -days.length))} aria-label="Previous dates">
                  <IconChevronRight style={{ transform: "rotate(180deg)" }} />
                </button>
                <div className="date-picker-wrap" ref={datePickerRef}>
                  <button
                    type="button"
                    className="calendar-nav-arrow"
                    onClick={toggleDatePicker}
                    aria-label="Jump to date"
                    aria-expanded={datePickerOpen}
                    style={datePickerOpen ? { background: "#d3d3d3", color: "#0f172a", borderColor: "#a3a3a3" } : {}}
                  >
                    <IconCalendar />
                  </button>
                  {datePickerOpen && (
                    <div className="date-picker-panel" role="dialog" aria-label="Choose a date">
                      <div className="date-picker-head">
                        <button type="button" className="date-picker-arrow-btn" onClick={() => shiftPickerMonth(-1)} aria-label="Previous month">‹</button>
                        <span className="date-picker-month-label">{pickerMonthLabel}</span>
                        <button type="button" className="date-picker-arrow-btn" onClick={() => shiftPickerMonth(1)} aria-label="Next month">›</button>
                      </div>
                      <div className="date-picker-weekdays">
                        {WEEKDAY_LABELS.map((d) => <span key={d}>{d}</span>)}
                      </div>
                      <div className="date-picker-grid">
                        {pickerCells.map((cell) => (
                          <button
                            key={cell.key}
                            type="button"
                            className={`date-picker-day ${cell.outside ? "is-outside" : ""} ${cell.isToday ? "is-today" : ""} ${cell.isSelected ? "is-selected" : ""}`}
                            onClick={() => selectPickerDate(cell.dateObj)}
                          >
                            {cell.dayNum}
                          </button>
                        ))}
                      </div>
                      <div className="date-picker-footer">
                        <button type="button" className="date-picker-footer-link" onClick={() => selectPickerDate(parseLocalDate(getBusinessDate()))}>Today</button>
                        <button type="button" className="date-picker-footer-link" onClick={() => setDatePickerOpen(false)}>Close</button>
                      </div>
                    </div>
                  )}
                </div>
                <button className="calendar-nav-arrow" onClick={() => setWeekStart((date) => addDays(date, days.length))} aria-label="Next dates">
                  <IconChevronRight />
                </button>

                {/* VIEW DAYS RANGE SWITCHER */}
                <div className="view-mode-switcher" style={{ display: "flex", gap: 2, background: "#f8fafc", padding: 3, borderRadius: 8, border: "1px solid #e2e8f0", marginLeft: 6, alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={viewDays === 7 ? { fontSize: 12, padding: "4px 10px", fontWeight: 800, height: 28, borderRadius: 6, background: "#d3d3d3", color: "#0f172a", border: "1px solid #b8b8b8", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { fontSize: 12, padding: "4px 10px", fontWeight: 700, height: 28, borderRadius: 6, background: "transparent", color: "#64748b", border: "none" }}
                    onClick={() => setViewDays(7)}
                  >
                    📅 7 Days
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={viewDays === 15 ? { fontSize: 12, padding: "4px 10px", fontWeight: 800, height: 28, borderRadius: 6, background: "#d3d3d3", color: "#0f172a", border: "1px solid #b8b8b8", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { fontSize: 12, padding: "4px 10px", fontWeight: 700, height: 28, borderRadius: 6, background: "transparent", color: "#64748b", border: "none" }}
                    onClick={() => setViewDays(15)}
                  >
                    📅 15 Days
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={viewDays === 30 ? { fontSize: 12, padding: "4px 10px", fontWeight: 800, height: 28, borderRadius: 6, background: "#d3d3d3", color: "#0f172a", border: "1px solid #b8b8b8", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { fontSize: 12, padding: "4px 10px", fontWeight: 700, height: 28, borderRadius: 6, background: "transparent", color: "#64748b", border: "none" }}
                    onClick={() => setViewDays(30)}
                  >
                    📅 30 Days
                  </button>
                </div>
              </div>

              {/* RIGHT GROUP: FILTERS DROPDOWN */}
              <div className="tier2-right-group">
                <div className="filter-dropdown" ref={filterRef}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm filter-toggle"
                    onClick={() => setFilterOpen((o) => !o)}
                    aria-expanded={filterOpen}
                    title="Filter rooms by category & status"
                    style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Filter size={15} /> <span className={`filter-caret ${filterOpen ? "open" : ""}`}>▾</span>
                  </button>
                  {filterOpen && (
                    <div className="filter-panel">
                      <div className="filter-section">
                        {QUICK_STATUS_FILTERS.map((f) => (
                          <button
                            key={f.value}
                            type="button"
                            className={`filter-option ${statusFilter === f.value ? "active" : ""}`}
                            onClick={() => setStatusFilter((prev) => (prev === f.value ? null : f.value))}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <div className="filter-divider" />
                      <div className="filter-section filter-section-row">
                        <button type="button" className="filter-option" onClick={() => setTypeFilter(new Set(roomTypes.map((t) => t.name)))}>
                          All
                        </button>
                        <button type="button" className="filter-option" onClick={() => setTypeFilter(new Set())}>
                          Unselect
                        </button>
                      </div>
                      <div className="filter-divider" />
                      <div className="filter-section filter-scroll">
                        {roomTypes.map((t) => (
                          <label key={t.id} className="filter-checkbox-row">
                            <input
                              type="checkbox"
                              checked={typeFilter.has(t.name)}
                              onChange={() => toggleTypeFilter(t.name)}
                            />
                            {t.name}
                          </label>
                        ))}
                      </div>
                      <div className="filter-divider" />
                      <div className="filter-reset-row">
                        <button
                          type="button"
                          className="filter-reset-btn"
                          onClick={() => {
                            setStatusFilter(null);
                            setTypeFilter(new Set(roomTypes.map((t) => t.name)));
                          }}
                        >
                          <IconRefresh /> Reset Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        />,
        navbarTarget
      )}

      {dataLoading && rooms.length === 0 && <p className="calendar-search-hint">Loading calendar…</p>}
      {dataError && (
        <p className="calendar-search-hint" style={{ color: "var(--danger)" }}>
          {dataError}
        </p>
      )}

      {viewMode === "room_grid" ? (
        <RoomViewGrid
          rooms={rooms}
          roomTypes={roomTypes}
          bookings={bookingsList}
          onOpenFolio={(bk) => {
            if (bk) setSelectedFolioBooking(bk);
          }}
          onOpenWalkin={(roomNo) => openNewBooking(roomNo, getBusinessDate())}
          onBlockRoom={(roomObj) => handleQuickBlockEmptyRoom(roomObj, getBusinessDate())}
          onEditBlock={(blockBk) => handleBarClick(blockBk)}
          onRoomsUpdated={refreshBookings}
        />
      ) : viewMode === "data" ? (
        <PropertyStatsSummary
          rooms={rooms}
          bookings={bookingsList}
          roomTypes={roomTypes}
        />
      ) : viewMode === "daily" ? (
        <ActivityDashboard />
      ) : viewMode === "reviews" ? (
        <ReviewManagement />
      ) : (
        <div className="calendar-scroll" tabIndex="0" aria-label="Room booking calendar. Scroll to view all rooms and dates.">
        <div
          className="calendar-wrap"
          style={{
            gridTemplateColumns: `220px repeat(${days.length}, minmax(${viewDays > 10 ? '90px' : '110px'}, 1fr))`,
            minWidth: `${220 + days.length * (viewDays > 10 ? 90 : 110)}px`,
          }}
        >
          <div className="calendar-head calendar-room-head" style={{ gridColumn: 1, position: "sticky", left: 0, zIndex: 60 }}>ROOM / CATEGORY</div>
          {days.map((day) => (
            <div key={day.date} className={`calendar-head ${day.isToday ? "is-today" : ""} ${day.isWeekend ? "is-weekend" : ""}`}>
              <span className="head-daynum">{day.dayNum} {day.monthShort}</span>
              <span className="head-weekday">{day.label}</span>
            </div>
          ))}



          {groupedRooms.length === 0 && !dataLoading && (
            <div className="calendar-empty-row" style={{ gridColumn: "1 / -1" }}>No rooms match your filters.</div>
          )}

          {groupedRooms.map(([type, roomsInGroup], groupIdx) => {
            const collapsed = collapsedGroups.has(type);
            const bandCls = groupIdx % 2 === 1 ? "group-band-alt" : "";
            const categoryTypeObj = roomTypes.find((t) => t.name === type);
            const nightlyPrice = categoryTypeObj?.price ? Number(categoryTypeObj.price).toFixed(2) : "299.99";

            return (
              <Fragment key={type}>
                {/* CATEGORY SUMMARY ROW */}
                <div
                  className={`calendar-category-summary-label ${bandCls}`}
                  onClick={() => toggleGroup(type)}
                  style={{
                    gridColumn: 1,
                    position: "sticky",
                    left: 0,
                    zIndex: 50,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 14px",
                    height: "44px",
                    minHeight: "44px",
                    maxHeight: "44px",
                    boxSizing: "border-box",
                    background: "linear-gradient(90deg, #f1f5f9, #e2e8f0)",
                    borderBottom: "1px solid #cbd5e1",
                    borderRight: "1px solid #cbd5e1",
                  }}
                  title={`Click to ${collapsed ? "Expand" : "Collapse"} ${type}`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                    <span className={`group-chevron ${collapsed ? "collapsed" : ""}`} style={{ fontSize: "11px", color: "#0284c7", flexShrink: 0 }}>
                      {collapsed ? "▶" : "▼"}
                    </span>
                    <span
                      className="cat-summary-title"
                      title={type}
                      style={{
                        fontSize: "13px",
                        fontWeight: "800",
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "block",
                        width: "100%",
                      }}
                    >
                      {type}
                    </span>
                  </div>
                </div>

                {/* CATEGORY DAILY AVAILABILITY BADGES (1 Cell per Date Column) */}
                {days.map((day) => {
                  const availInCat = calculateCategoryAvailability(type, day.date, bookingsList, rooms);
                  const isOverbooked = availInCat < 0;
                  const isZero = availInCat === 0;

                  return (
                    <div key={`cat-avail-${type}-${day.date}`} className={`cat-avail-cell ${isOverbooked ? "is-overbooked" : isZero ? "is-zero" : ""}`}>
                      <span
                        className={`avail-badge ${isOverbooked ? "overbooked" : isZero ? "zero" : "avail"}`}
                        style={
                          isOverbooked
                            ? {
                                background: "#fee2e2",
                                color: "#dc2626",
                                border: "1px solid #fca5a5",
                                fontWeight: "900",
                              }
                            : {}
                        }
                        title={isOverbooked ? `⚠️ ${Math.abs(availInCat)} Overbooking(s) on ${day.date}` : `Available: ${availInCat}`}
                      >
                        {availInCat}
                      </span>
                    </div>
                  );
                })}

                {/* EXPANDED PHYSICAL ROOM ROWS */}
                {!collapsed &&
                  roomsInGroup.map((room) => {
                    const roomBookingsRaw = bookingsList.filter((b) => {
                      const bRoom = String(b.room || b.roomNo || b.roomNumber || "").trim();
                      const rNo = String(room.no || "").trim();
                      if (bRoom !== rNo) return false;
                      const startOffset = dayOffset(weekStartKey, b.checkIn);
                      const endOffset = dayOffset(weekStartKey, b.checkOut);
                      return endOffset >= 0 && startOffset <= days.length - 1;
                    });

                    // Deduplicate room bookings so duplicate records render exactly ONE bar
                    const roomBookingsMap = new Map();
                    roomBookingsRaw.forEach((b) => {
                      if (!b) return;
                      const bId = String(b.id || b._id || "").trim();
                      const guest = String(b.guest || b.guestName || "").trim();
                      const key = bId || `${room.no}_${b.checkIn}_${b.checkOut}_${guest}`;
                      if (!roomBookingsMap.has(key)) {
                        roomBookingsMap.set(key, b);
                      }
                    });
                    const roomBookings = Array.from(roomBookingsMap.values());
                  const isBlocked = room.status === "maintenance";
                  const hkNormalized = String(room.housekeeping || "clean").toLowerCase();
                  const isDirty = hkNormalized === "dirty";
                  const isOOO = hkNormalized === "out_of_order" || hkNormalized === "ooo" || hkNormalized === "maintenance" || isBlocked;

                  return (
                    <Fragment key={room.no}>
                      <div
                        className={`calendar-room-label ${bandCls} ${typeColorClass(type)} ${isBlocked ? "is-blocked" : ""}`}
                        title={`Room ${room.no}${room.petFriendly ? " · Pet Friendly (Dog Allowed)" : ""}${room.nonSmoking ? " · Non-Smoking" : room.smoking ? " · Smoking Allowed" : ""} · Click to manage housekeeping`}
                        onClick={() => setHkModalRoom(room)}
                        style={{
                          gridColumn: 1,
                          position: "sticky",
                          left: 0,
                          zIndex: 3,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0 14px",
                          height: "44px",
                          minHeight: "44px",
                          maxHeight: "44px",
                          boxSizing: "border-box",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="room-no-text" style={{ fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>
                            {room.no}
                          </span>
                        </div>
                        
                        {/* HORIZONTAL ICONS SIDE-BY-SIDE ON THE RIGHT */}
                        <div className="room-feature-icons-row" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "6px" }}>
                          {Boolean(room.petFriendly) && (
                            <span title="Pet Friendly Room (Dog Allowed)" style={{ cursor: "help", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                              <Dog size={16} style={{ color: "#1e293b", strokeWidth: 2.2 }} />
                            </span>
                          )}
                          {Boolean(room.nonSmoking) && (
                            <span title="Non-Smoking Room" style={{ cursor: "help", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                              <CigaretteOff size={16} style={{ color: "#dc2626", strokeWidth: 2.2 }} />
                            </span>
                          )}
                          {Boolean(room.smoking) && (
                            <span title="Smoking Allowed Room" style={{ cursor: "help", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                              <Cigarette size={16} style={{ color: "#d97706", strokeWidth: 2.2 }} />
                            </span>
                          )}

                          {isDirty ? (
                            <span
                              className="room-hk-badge dirty"
                              title="🔴 Dirty - Click to Mark Clean & Ready!"
                              style={{ cursor: "pointer" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCleanRoom(room.no, "clean");
                              }}
                            >
                              🔴
                            </span>
                          ) : isOOO ? (
                            <span className="room-hk-badge ooo" title="Blocked / Out of Order">⚠️</span>
                          ) : (
                            <span
                              className="room-hk-badge clean"
                              title="🟢 Clean & Ready - Click to Mark Dirty!"
                              style={{ cursor: "pointer" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCleanRoom(room.no, "dirty");
                              }}
                            >
                              🟢
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className={`calendar-room-track ${bandCls} ${typeColorClass(type)}`}
                        style={{ gridColumn: "2 / -1" }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleTrackDrop(e, room)}
                      >
                        {days.map((day, dayIdx) => (
                          <div
                            key={day.date}
                            className={`track-daycell ${day.isToday ? "is-today" : ""}`}
                            style={{ left: `${(dayIdx / days.length) * 100}%`, width: `${(1 / days.length) * 100}%` }}
                            onMouseDown={(e) => {
                              if (e.button !== 0) return;
                              if (bookingFor(room.no, day.date)) return;
                              setDragSelection({
                                room,
                                roomNo: room.no,
                                startIdx: dayIdx,
                                endIdx: dayIdx,
                                isSelecting: true,
                              });
                            }}
                            onMouseEnter={() => {
                              if (dragSelection && dragSelection.isSelecting && dragSelection.roomNo === room.no) {
                                setDragSelection((prev) => ({ ...prev, endIdx: dayIdx }));
                              }
                            }}
                            role="button"
                            tabIndex={-1}
                            aria-hidden="true"
                          />
                        ))}

                        {dragSelection && dragSelection.roomNo === room.no && (() => {
                          const diff = Math.abs(dragSelection.endIdx - dragSelection.startIdx);
                          const selNights = diff === 0 ? 1 : diff;
                          return (
                            <div
                              className="cell-drag-selection-overlay"
                              style={{
                                left: `${(Math.min(dragSelection.startIdx, dragSelection.endIdx) / days.length) * 100}%`,
                                width: `${(selNights / days.length) * 100}%`,
                              }}
                            >
                              <span className="selection-label">
                                {selNights} Night{selNights === 1 ? "" : "s"}
                              </span>
                            </div>
                          );
                        })()}

                        {roomBookings.map((booking) => {
                          const rawStart = dayOffset(weekStartKey, booking.checkIn);
                          const rawEnd = dayOffset(weekStartKey, booking.checkOut);

                          let startIdx = rawStart <= 0 ? 0 : rawStart + 0.5;
                          let endIdx = rawEnd >= days.length ? days.length : rawEnd + 0.5;

                          if (rawEnd <= rawStart) {
                            endIdx = startIdx + 0.5;
                          }

                          startIdx = Math.max(0, Math.min(startIdx, days.length));
                          endIdx = Math.max(startIdx + 0.1, Math.min(endIdx, days.length));

                          if (endIdx <= startIdx) return null;
                          const left = (startIdx / days.length) * 100;
                          const width = ((endIdx - startIdx) / days.length) * 100;

                          const statusCls = getBookingStatusClass(booking);
                          const isBlocked = statusCls === "status-blocked";
                          const balanceDue = Number(booking.balanceDue || 0);
                          const advanceAmount = Number(booking.advanceAmount || 0);
                          const barColors = getBookingStatusColors(booking, statusColors);

                          return (
                            <div
                              key={booking.id}
                              className={`gantt-bar ${statusCls} ${draggingId === booking.id ? "is-dragging" : ""}`}
                              style={{
                                left: `calc(${left}% + 1px)`,
                                width: `calc(${width}% - 2px)`,
                                background: barColors.bg,
                                backgroundColor: barColors.bg,
                                color: barColors.text,
                                borderColor: barColors.bg,
                              }}
                              onMouseEnter={(e) => {
                                if (hoverTimeoutRef.current) {
                                  clearTimeout(hoverTimeoutRef.current);
                                  hoverTimeoutRef.current = null;
                                }
                                const pos = calculateCornerPosition(e.currentTarget);
                                setHoverPos(pos);
                                setHoveredBooking(booking);
                              }}
                              onMouseMove={(e) => {
                                if (hoverTimeoutRef.current) {
                                  clearTimeout(hoverTimeoutRef.current);
                                  hoverTimeoutRef.current = null;
                                }
                                if (!hoveredBooking || hoveredBooking.id !== booking.id) {
                                  const pos = calculateCornerPosition(e.currentTarget);
                                  setHoverPos(pos);
                                  setHoveredBooking(booking);
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                hoverTimeoutRef.current = setTimeout(() => {
                                  setHoveredBooking(null);
                                }, 150);
                              }}
                              draggable={resizingId !== booking.id}
                              onDragStart={(e) => handleBarDragStart(e, booking)}
                              onDragEnd={handleBarDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBarClick(booking);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleBarClick(booking);
                                }
                              }}
                            >
                              <span className="gantt-avatar">
                                {initials(booking.guest)}
                              </span>

                              <span className="gantt-name">{booking.guest}</span>

                              {!isBlocked && (() => {
                                const s = String(booking.source || booking.channel || '').toLowerCase();
                                const isOta = s.includes('booking') || s.includes('expedia') || s.includes('airbnb') || s.includes('agoda') || s.includes('mmt') || s.includes('makemytrip') || s.includes('tripadvisor') || s.includes('hotels.com') || s.includes('orbitz') || s.includes('travelocity') || s.includes('goibibo');
                                return isOta ? (
                                  <OtaBadge 
                                    source={booking.source || booking.channel} 
                                    size="xs" 
                                    showText={false} 
                                    otaBookingId={booking.otaBookingId || booking.confirmationCode} 
                                  />
                                ) : null;
                              })()}

                              {!isBlocked && (() => {
                                const hasDepositCollected = Boolean(
                                  booking.hasDeposit ||
                                  booking.depositCollected ||
                                  booking.securityDepositCollected ||
                                  (Array.isArray(booking.deposits) && booking.deposits.some((d) => d.status === "held" || Number(d.amount) > 0)) ||
                                  (Array.isArray(booking.securityDeposits) && booking.securityDeposits.length > 0) ||
                                  Number(booking.depositBalance || booking.depositAmount || booking.deposit || 0) > 0
                                );

                                const isSelfCheckIn = Boolean(
                                  booking.signature ||
                                  booking.digitalSignature ||
                                  booking.signatureOnFile ||
                                  (booking.notes && (booking.notes.includes("Self Check-In") || booking.notes.includes("Contactless"))) ||
                                  booking.isSelfCheckIn
                                );

                                const notesList = (() => {
                                  if (Array.isArray(booking.notesList) && booking.notesList.length > 0) {
                                    const valid = booking.notesList.filter((n) => n && (typeof n === 'string' ? n.trim() : (n.text && String(n.text).trim())));
                                    if (valid.length > 0) return valid;
                                  }
                                  if (Array.isArray(booking.notes) && booking.notes.length > 0) {
                                    const valid = booking.notes.filter((n) => n && (typeof n === 'string' ? n.trim() : (n.text && String(n.text).trim())));
                                    if (valid.length > 0) return valid;
                                  }
                                  const txt = (
                                    (typeof booking.notes === 'string' ? booking.notes : '') ||
                                    (typeof booking.specialRequests === 'string' ? booking.specialRequests : '') ||
                                    (typeof booking.remark === 'string' ? booking.remark : '') ||
                                    (typeof booking.remarks === 'string' ? booking.remarks : '') ||
                                    (typeof booking.folioNotes === 'string' ? booking.folioNotes : '') ||
                                    ''
                                  ).replace(/\[Blocked:.*?\]/gi, '').replace(/[\[\]]/g, '').trim();

                                  return txt ? [{ text: txt }] : [];
                                })();

                                const hasNotes = notesList.length > 0;
                                const firstNoteText = typeof notesList[0] === 'string' ? notesList[0] : (notesList[0]?.text || 'Guest Note Attached');

                                const srcLower = String(booking.source || booking.channel || '').toLowerCase();
                                 const segUpper = String(booking.segment || '').toUpperCase();
                                 const subLower = String(booking.subSegment || '').toLowerCase();

                                 const isDirectWalkIn = srcLower.includes('walk') || srcLower.includes('direct') || segUpper === 'DIRECT' || subLower === 'walk-in';
                                 const isCorporateBooking = Boolean(booking.companyName || booking.companyId || booking.isCorporate || segUpper === 'CORPORATE');
                                 const isSplitStay = (Array.isArray(booking.splitSegments) && booking.splitSegments.length > 1) || Boolean(booking.isSplit);
                                 const isGroupBooking = Boolean(booking.groupId || booking.groupName || segUpper === 'GROUP');

                                 return (
                                   <>
                                     {isSelfCheckIn && (
                                       <span
                                         className="pro-symbol-badge pro-badge-sky"
                                         title="📱 Mobile Self Check-In Verified (Digital Signature on File)"
                                       >
                                         <Smartphone size={11} strokeWidth={2.5} />
                                       </span>
                                     )}

                                     {hasDepositCollected && (() => {
                                       const dStatus = String(booking.depositStatus || '').toLowerCase();
                                       const heldDep = (booking.deposits || booking.securityDeposits || []).find(d => String(d.status || 'held').toLowerCase() === 'held');
                                       const appliedDep = (booking.deposits || booking.securityDeposits || []).find(d => String(d.status).toLowerCase() === 'applied');
                                       const refundedDep = (booking.deposits || booking.securityDeposits || []).find(d => String(d.status).toLowerCase() === 'refunded');
                                       
                                       let titleText = `🛡️ Security Deposit Held in Trust: $${booking.depositBalance || booking.depositAmount || (heldDep ? (heldDep.amountUSD || heldDep.amount) : 200)}`;
                                       let badgeClass = "pro-symbol-badge pro-badge-emerald";
                                       
                                       if (dStatus === 'applied' || (appliedDep && !heldDep)) {
                                         const amt = appliedDep ? (appliedDep.amountUSD || appliedDep.amount) : (booking.depositAmount || 200);
                                         titleText = `💳 Security Deposit ($${amt}) Applied to Folio Balance`;
                                         badgeClass = "pro-symbol-badge pro-badge-sky";
                                       } else if (dStatus === 'refunded' || (refundedDep && !heldDep)) {
                                         const amt = refundedDep ? (refundedDep.amountUSD || refundedDep.amount) : (booking.depositAmount || 200);
                                         titleText = `💸 Security Deposit ($${amt}) Refunded to Guest`;
                                         badgeClass = "pro-symbol-badge pro-badge-rose";
                                       }

                                       return (
                                         <span
                                           className={badgeClass}
                                           title={titleText}
                                         >
                                           <ShieldCheck size={11} strokeWidth={2.5} />
                                         </span>
                                       );
                                     })()}

                                     {isDirectWalkIn && (
                                       <span
                                         className="pro-symbol-badge pro-badge-transparent"
                                         title={`🚶 Direct / Walk-In Booking (${booking.source || booking.channel || "Direct"})`}
                                         style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0, margin: "0 2px", fontSize: "13px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                       >
                                         🚶
                                       </span>
                                     )}

                                     {isCorporateBooking && (
                                       <span
                                         className="pro-symbol-badge pro-badge-transparent"
                                         title={`👔 Corporate Booking: ${booking.companyName || "Corporate Account"}`}
                                         style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0, margin: "0 2px", fontSize: "13px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                       >
                                         👔
                                       </span>
                                     )}

                                     {isSplitStay && (
                                       <span
                                         className="pro-symbol-badge pro-badge-transparent"
                                         title="✂️ Mid-Stay Split Room Transfer"
                                         style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0, margin: "0 2px", fontSize: "13px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                       >
                                         ✂️
                                       </span>
                                     )}

                                     {isGroupBooking && (
                                       <span
                                         className="pro-symbol-badge pro-badge-transparent"
                                         title={`👥 Group Booking: ${booking.groupName || booking.groupId || "Group"}`}
                                         style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0, margin: "0 2px", fontSize: "13px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                       >
                                         👥
                                       </span>
                                     )}

                                     {hasNotes && (
                                       <span
                                         className="pro-symbol-badge pro-badge-amber pro-badge-transparent"
                                         title={`💬 Folio Note (${notesList.length}): ${firstNoteText}`}
                                         style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0, margin: "0 2px", fontSize: "13px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                       >
                                         💬
                                       </span>
                                     )}

                                     {balanceDue > 0 && !booking.isPaid && (
                                       <span className="pro-symbol-badge pro-badge-due pro-badge-transparent" title={`💲 Balance Due: $${balanceDue}`} style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0, margin: "0 2px", fontSize: "13px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                         💲
                                       </span>
                                     )}
                                   </>
                                 );
                              })()}
                              <span
                                className="gantt-resize-handle-left"
                                onMouseDown={(e) => handleResizeStartLeft(e, booking, rawEnd)}
                                onClick={(e) => e.stopPropagation()}
                                title="Drag to move check-in earlier/later"
                              />
                              <span
                                className="gantt-resize-handle"
                                onMouseDown={(e) => handleResizeStart(e, booking, rawStart)}
                                onClick={(e) => e.stopPropagation()}
                                title="Drag to extend/shrink stay"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </Fragment>
                  );
                })}
            </Fragment>
          );
        })}
        </div>
      </div>
    )}

      {toast && (
        <div className="pms-confirm-backdrop" onClick={() => setToast("")}>
          <div className="pms-confirm-card pms-execution-card" onClick={(e) => e.stopPropagation()}>
            <div className="pms-execution-icon-wrapper">
              <CheckCircle2 size={44} className="pms-execution-icon" />
            </div>
            <h3 className="pms-execution-title">Operation Successful</h3>
            <p className="pms-execution-message">{toast}</p>
            <div className="pms-confirm-footer justify-center margin-top-20">
              <button type="button" className="pms-btn pms-btn-light-grey width-100" onClick={() => setToast("")}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCell && activeCell.mode === "form" && (
        <div className="cal-modal-overlay">
          <div
            className="cal-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="walkin-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cal-modal-head">
              <div>
                <h3 id="walkin-modal-title">
                  {activeCell.booking
                    ? "Edit Reservation"
                    : (activeCell.checkOut || activeCell.date) <= todayISO()
                    ? "📥 Insert Past Transaction"
                    : activeCell.date < todayISO()
                    ? "🔑 Insert Active Stay"
                    : "Create Reservation"}
                </h3>
                <p className="cal-modal-subtitle">
                  Room {activeCell.roomNo}{activeRoom ? ` · ${activeRoom.type}` : ""} · {activeCell.date ? activeCell.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1") : ""}
                </p>
              </div>
              <button className="cal-modal-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>
            <div className="cal-modal-body">
              <WalkinGuest
                key={`${activeCell.roomNo}-${activeCell.date}-${activeCell.booking?.id || "new"}`}
                embedded
                initialRoomNo={activeCell.roomNo}
                initialDate={activeCell.date}
                initialCheckOut={activeCell.checkOut}
                initialBooking={activeCell.booking}
                existingBookings={bookingsList}
                rooms={rooms}
                roomTypes={roomTypes}
                onSubmit={handleBookingSaved}
                onCancel={cancelForm}
              />
            </div>
          </div>
        </div>
      )}

      {slipInfo && (
        <div className="cal-modal-overlay slip-modal-overlay">
          <div
            className="cal-modal-card slip-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="slip-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cal-modal-head">
              <div>
                <h3 id="slip-modal-title">Booking Slip</h3>
                <p className="cal-modal-subtitle">
                  Room {slipInfo.booking.room}{slipInfo.room ? ` · ${slipInfo.room.type}` : ""}
                </p>
              </div>
              <button className="cal-modal-close" onClick={closeSlip} aria-label="Close">✕</button>
            </div>
            <div className="cal-modal-body">
              <BookingSlip
                booking={slipInfo.booking}
                room={slipInfo.room}
                onEdit={() => handleEditFromSlip(slipInfo.booking)}
                onDelete={() => handleDeleteBooking(slipInfo.booking)}
                onClose={closeSlip}
                onCancelBooking={() => handleCancelFromSlip(slipInfo.booking)}
                onAddExtra={(extra) => handleAddExtraFromSlip(slipInfo.booking, extra)}
                onAddSettlement={(payment) => handleSettlementFromSlip(slipInfo.booking, payment)}
                onEmail={() => handleEmailFromSlip(slipInfo.booking)}
                onPrint={() => handlePrintFromSlip(slipInfo.booking)}
                onContact={() => handleContactFromSlip(slipInfo.booking)}
                onSendMobileLink={(b) => setSendCheckInBooking(b)}
              />
            </div>
          </div>
        </div>
      )}

      <SendSelfCheckInModal
        isOpen={Boolean(sendCheckInBooking)}
        booking={sendCheckInBooking}
        onClose={() => setSendCheckInBooking(null)}
      />

      {quickAction && ACTION_FORMS[quickAction.id] && (
        <QuickActionModal
          actionId={quickAction.id}
          config={ACTION_FORMS[quickAction.id]}
          booking={quickAction.booking}
          rooms={rooms}
          ctx={{ lastActionLabel: lastActionRef.current?.label }}
          onClose={() => setQuickAction(null)}
          onSubmit={(values) => handleQuickAction(quickAction.id, quickAction.booking, values)}
        />
      )}

      {logInfo && (
        <div className="qam-overlay">
          <div className="qam-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="qam-head">
              <h3>Log - {logInfo.booking.guest}</h3>
              <button type="button" className="qam-close" onClick={() => setLogInfo(null)} aria-label="Close">✕</button>
            </div>
            <div className="qam-body" style={{ paddingBottom: 16 }}>
              {logInfo.loading && <p className="qam-infoline">Loading activity…</p>}
              {!logInfo.loading && logInfo.logs.length === 0 && (
                <p className="qam-infoline">No activity recorded yet for this reservation.</p>
              )}
              {!logInfo.loading && logInfo.logs.map((entry) => (
                <div key={entry.id} className="qam-infoline" style={{ textAlign: "left" }}>
                  <strong>{entry.action}</strong>
                  <div style={{ color: "var(--text-400)", fontSize: 11.5, margin: "2px 0 4px" }}>
                    {entry.user} · {new Date(entry.createdAt).toLocaleString()}
                  </div>
                  {entry.details}
                </div>
              ))}
            </div>
            <div className="qam-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setLogInfo(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <AIIDScannerModal
        isOpen={showAIScannerModal}
        onClose={() => {
          setShowAIScannerModal(false);
          setAIScannerTargetBooking(null);
        }}
        onScanComplete={handleAIScanForBooking}
      />

      {cellChoice && (() => {
        const isConflicted = (bookingsList || []).some((b) => {
          const st = String(b?.status || "").toLowerCase().trim();
          if (!b || st === "cancelled" || st === "enquiry" || st === "inquiry" || st === "group enquiry" || st === "group_enquiry" || b.isEnquiry) return false;
          const bRoom = String(b.room || b.roomNumber || "").trim();
          if (bRoom !== String(cellChoice.roomNo).trim()) return false;
          const inDate = cellChoice.checkIn || cellChoice.date;
          const outDate = cellChoice.checkOut || dateToKey(addDays(parseLocalDate(inDate), 1));
          return b.checkIn < outDate && b.checkOut > inDate;
        });

        return (
          <div className="qam-overlay">
            <div className="qam-card cell-choice-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="qam-head">
                <h3>
                  Room {cellChoice.roomNo} · {cellChoice.checkIn || cellChoice.date}
                  {cellChoice.nights && cellChoice.nights > 1 ? ` (${cellChoice.nights} Nights)` : ""}
                </h3>
                <button type="button" className="qam-close" onClick={() => setCellChoice(null)} aria-label="Close">✕</button>
              </div>

              <div className="cell-choice-body">
                {isConflicted && (
                  <div style={{ background: "#fffbeb", border: "1.5px solid #f59e0b", color: "#b45309", padding: "10px 14px", borderRadius: "10px", fontSize: "12.5px", fontWeight: "700", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>⚠️</span>
                    <span>Room {cellChoice.roomNo} is booked or blocked for these dates. Booking will open with an <strong>Unassigned Room</strong>.</span>
                  </div>
                )}

                <button
                  type="button"
                  className="choice-tile create-booking-tile"
                  onClick={() => {
                    const { roomNo, checkIn, checkOut, date } = cellChoice;
                    setCellChoice(null);
                    openNewBooking(isConflicted ? "Unassigned" : roomNo, checkIn || date, checkOut);
                  }}
                >
                  <div className="choice-icon">🏨</div>
                  <div className="choice-info">
                    <strong>Create Guest Booking</strong>
                    <span>Register a new guest stay, scan ID &amp; collect payment</span>
                  </div>
                  <span className="choice-arrow">›</span>
                </button>

                <button
                  type="button"
                  className="choice-tile block-room-tile"
                  disabled={isConflicted}
                  style={isConflicted ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                  onClick={() => {
                    if (isConflicted) return;
                    const { room, checkIn, checkOut, date } = cellChoice;
                    setCellChoice(null);
                    handleQuickBlockEmptyRoom(room, checkIn || date, checkOut);
                  }}
                >
                  <div className="choice-icon">🔒</div>
                  <div className="choice-info">
                    <strong>Block Room (Out of Order)</strong>
                    <span>{isConflicted ? "Cannot block — Room has existing booking/block" : "Mark room unavailable for maintenance or deep cleaning"}</span>
                  </div>
                  <span className="choice-arrow">›</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <GroupBookingModal
        isOpen={showGroupBookingModal}
        onClose={() => setShowGroupBookingModal(false)}
        rooms={rooms}
        roomTypes={roomTypes}
        bookingsList={bookingsList}
        onGroupBookingCreated={handleGroupBookingCreated}
      />

      <FolioModal
        isOpen={Boolean(selectedFolioBooking)}
        onClose={() => setSelectedFolioBooking(null)}
        booking={selectedFolioBooking}
        room={(rooms || []).find((r) => String(r.no || r.number || r.id).trim() === String(selectedFolioBooking?.room).trim()) || { no: selectedFolioBooking?.room, type: selectedFolioBooking?.roomType || "Standard" }}
        rooms={rooms || []}
        onUpdateBooking={async (b, patch, label) => {
          const updated = await applyBookingUpdate(b, patch, label);
          if (updated) setSelectedFolioBooking({ ...updated });
          return updated;
        }}
        onAddCharge={async (b, extra) => {
          const updated = await handleAddExtraFromSlip(b, extra);
          if (updated) setSelectedFolioBooking({ ...updated });
          return updated;
        }}
        onAddSettlement={async (b, payment) => {
          const updated = await handleSettlementFromSlip(b, payment);
          if (updated) setSelectedFolioBooking({ ...updated });
          return updated;
        }}
        onCheckIn={async (b) => {
          await handleQuickAction("checkIn", b, {});
          const updated = (bookingsList || []).find((bk) => bk.id === b.id);
          if (updated) setSelectedFolioBooking({ ...updated });
          return updated;
        }}
        onCheckOut={async (b) => {
          await handleQuickAction("checkOut", b, {});
          setToast(`✅ Check-out complete for ${b.guest} · Room ${b.room}`);
          setSelectedFolioBooking(null);
        }}
        onMoveRoom={async (b, targetRoomNo) => {
          await handleQuickAction("moveRoom", b, { room: targetRoomNo });
          const updated = (bookingsList || []).find((bk) => bk.id === b.id);
          if (updated) setSelectedFolioBooking({ ...updated });
          return updated;
        }}
        onCollectDeposit={async (b, depositData) => {
          const updated = await apiAddDeposit(b.id, depositData);
          if (updated && updated.id) {
            setBookingsList((prev) => (prev || []).map((bk) => (bk.id === updated.id ? updated : bk)));
            setSelectedFolioBooking({ ...updated });
          }
          return updated;
        }}
        onRefundDeposit={async (b, depositData) => {
          const updated = await apiRefundDeposit(b.id, depositData);
          if (updated && updated.id) {
            setBookingsList((prev) => (prev || []).map((bk) => (bk.id === updated.id ? updated : bk)));
            setSelectedFolioBooking({ ...updated });
          }
          return updated;
        }}
        onApplyDepositToFolio={async (b, depositData) => {
          const updated = await apiApplyDepositToFolio(b.id, depositData);
          if (updated && updated.id) {
            setBookingsList((prev) => (prev || []).map((bk) => (bk.id === updated.id ? updated : bk)));
            setSelectedFolioBooking({ ...updated });
          }
          return updated;
        }}
        onUpdateDeposit={async (b, depositData) => {
          const updated = await apiUpdateDeposit(b.id, depositData);
          if (updated && updated.id) {
            setBookingsList((prev) => (prev || []).map((bk) => (bk.id === updated.id ? updated : bk)));
            setSelectedFolioBooking({ ...updated });
          }
          return updated;
        }}
        onDeleteDeposit={async (b, depId) => {
          const updated = await apiDeleteDeposit(b.id, depId);
          if (updated && updated.id) {
            setBookingsList((prev) => (prev || []).map((bk) => (bk.id === updated.id ? updated : bk)));
            setSelectedFolioBooking({ ...updated });
          }
          return updated;
        }}
        onGetAuditLogs={async (bookingId) => {
          return await getAuditLogs(bookingId);
        }}
        onScanID={(b) => {
          setSelectedFolioBooking(null);
          setAIScannerTargetBooking(b);
          setShowAIScannerModal(true);
        }}
        onPrintInvoice={(b) => handlePrintFromSlip(b)}
        onEmailInvoice={async (b, targetEmail) => {
          await handleEmailFromSlip(b, targetEmail);
        }}
        onCancelBooking={async (b, policyOption) => {
          await apiCancelBooking(b.id, policyOption);
          const updatedList = await getBookings();
          setBookingsList(updatedList);
          const updated = updatedList.find((bk) => bk.id === b.id);
          if (updated) setSelectedFolioBooking(updated);
          setToast(`Reservation cancelled for ${b.guest} (${policyOption?.label || "Policy Applied"})`);
        }}
        onNoShowBooking={async (b, policyOption) => {
          await apiNoShowBooking(b.id, policyOption);
          const updatedList = await getBookings();
          setBookingsList(updatedList);
          const updated = updatedList.find((bk) => bk.id === b.id);
          if (updated) setSelectedFolioBooking(updated);
          setToast(`Reservation marked No-Show for ${b.guest} (${policyOption?.label || "Policy Applied"})`);
        }}
        onDeleteBooking={async (b) => {
          await handleDeleteBooking(b);
          setSelectedFolioBooking(null);
        }}
        onRevertBookingStatus={async (b) => {
          const updated = await updateBooking(b.id, { status: "confirmed" });
          const updatedList = await getBookings();
          setBookingsList(updatedList);
          setSelectedFolioBooking(updated);
          setToast(`Status reverted to Confirmed for ${b.guest}`);
        }}
        onGetAuditLogs={async (bId) => {
          const logs = await getAuditLogs();
          return logs.filter((l) => l.bookingId === bId);
        }}
        onOpenSplitWizard={(b) => {
          setSelectedFolioBooking(null);
          setSplitStayTargetBooking(b);
        }}
        onTransferBalance={async (b, transferData) => {
          await apiTransferBalance(b.id, transferData);
          const updatedList = await getBookings();
          setBookingsList(updatedList);
          const updated = updatedList.find((bk) => bk.id === b.id);
          if (updated) setSelectedFolioBooking(updated);
          setToast(`⇄ Transferred $${transferData.amount} balance to Room ${transferData.targetRoomNo}`);
        }}
        onCollectDeposit={async (b, depData) => {
          const updated = await apiAddDeposit(b.id, depData);
          const updatedList = await getBookings();
          setBookingsList(updatedList);
          setSelectedFolioBooking(updated);
          setToast(`💰 Security deposit collected: $${depData.amount} via ${depData.mode}`);
        }}
        onRefundDeposit={async (b, depData) => {
          const updated = await apiRefundDeposit(b.id, depData);
          const updatedList = await getBookings();
          setBookingsList(updatedList);
          setSelectedFolioBooking(updated);
          setToast(`💸 Security deposit refunded: $${depData.amount} via ${depData.mode}`);
        }}
        onApplyDepositToFolio={async (b, depData) => {
          const updated = await apiApplyDepositToFolio(b.id, depData);
          const updatedList = await getBookings();
          setBookingsList(updatedList);
          setSelectedFolioBooking(updated);
          setToast(`💳 Security deposit of $${depData.amount} applied to folio dues`);
        }}
        onUpdateDeposit={async (b, depData) => {
          const updated = await apiUpdateDeposit(b.id, depData);
          const updatedList = await getBookings();
          setBookingsList(updatedList);
          setSelectedFolioBooking(updated);
          setToast(`✏️ Security deposit updated to $${depData.amount}`);
        }}
        onDeleteDeposit={async (b, depId) => {
          const updated = await apiDeleteDeposit(b.id, depId);
          const updatedList = await getBookings();
          setBookingsList(updatedList);
          setSelectedFolioBooking(updated);
          setToast(`🗑️ Security deposit entry deleted`);
        }}
      />

      {/* MID-STAY ROOM TRANSFER & SPLIT STAY WIZARD MODAL */}
      {splitStayTargetBooking && (
        <SplitStayWizardModal
          booking={splitStayTargetBooking}
          rooms={rooms}
          roomTypes={roomTypes}
          onClose={() => setSplitStayTargetBooking(null)}
          onConfirmSplit={async (splitData) => {
            const updated = await apiSplitStayBooking(splitStayTargetBooking.id, splitData);
            const updatedList = await getBookings();
            setBookingsList(updatedList);
            setSplitStayTargetBooking(null);
            setToast(`🔀 Split stay created for ${updated.guest}! Stay split between Room ${splitData.targetRoom} starting ${splitData.splitDate}.`);
          }}
        />
      )}

      {/* ROOM MOVE CONFIRMATION & RATE DIFFERENCE MODAL */}
      {pendingMove && (
        <div className="fm-submodal-overlay">
          <div
            className="fm-submodal-card"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "24px",
              borderRadius: "16px",
              background: "#ffffff",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
              border: "1px solid #cbd5e1"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "18px" }}>
              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "12px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  flexShrink: 0
                }}
              >
                🔀
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.3px" }}>Confirm Room Move?</h3>
                <p style={{ margin: "3px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                  Guest: <strong style={{ color: "#0f172a" }}>{pendingMove.booking.guest}</strong>
                </p>
              </div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "20px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>ROOM CHANGE</span>
                <strong style={{ color: "#0f172a" }}>Room {pendingMove.oldRoomNo} ➔ Room {pendingMove.newRoomNo}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>STAY DATES</span>
                <span style={{ color: "#334155" }}>{pendingMove.newCheckIn} to {pendingMove.newCheckOut} ({pendingMove.nights} Nights)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>CATEGORY SHIFT</span>
                <span>{pendingMove.oldCategory} ➔ <strong style={{ color: "#0284c7" }}>{pendingMove.newCategory}</strong></span>
              </div>

              {pendingMove.isCategoryChange && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    marginTop: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                    <span>Category Tariff Difference:</span>
                    <strong className={pendingMove.rateDiffPerNight >= 0 ? "txt-pos" : "txt-neg"}>
                      {pendingMove.rateDiffPerNight >= 0 ? "+" : ""}${pendingMove.rateDiffPerNight.toLocaleString()} / night
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13.5px", fontWeight: "700", borderTop: "1.5px dashed #e2e8f0", paddingTop: "8px" }}>
                    <span>Total Tariff Adjustment ({pendingMove.nights} Nights):</span>
                    <strong className={pendingMove.totalRateDiff >= 0 ? "txt-pos" : "txt-neg"}>
                      {pendingMove.totalRateDiff >= 0 ? "+" : ""}${pendingMove.totalRateDiff.toLocaleString()} Total
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #f1f5f9" }}>
              {pendingMove.isCategoryChange ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%", padding: "10px 16px", borderRadius: "8px", fontWeight: "800" }}
                    onClick={() => confirmRoomMove(true)}
                  >
                    ✅ Update Rate to ${pendingMove.newRate}/nt ({pendingMove.totalRateDiff >= 0 ? "+" : ""}${pendingMove.totalRateDiff.toLocaleString()}) &amp; Move Room
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ width: "100%", padding: "10px 16px", borderRadius: "8px", fontWeight: "700" }}
                    onClick={() => confirmRoomMove(false)}
                  >
                    🔒 Maintain Original Rate (${pendingMove.oldRate}/nt) &amp; Move Room
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "10px 16px", borderRadius: "8px", fontWeight: "800" }}
                  onClick={() => confirmRoomMove(false)}
                >
                  ✅ Confirm Room Move
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ width: "100%", padding: "8px 14px", borderRadius: "8px", fontWeight: "700", color: "#64748b" }}
                onClick={() => setPendingMove(null)}
              >
                ❌ Cancel Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAY RESIZE & DATE EXTENSION/SHORTENING MODAL */}
      {pendingResize && (
        <div className="fm-submodal-overlay">
          <div
            className="fm-submodal-card"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "24px",
              borderRadius: "16px",
              background: "#ffffff",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
              border: "1px solid #cbd5e1"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "18px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  flexShrink: 0
                }}
              >
                {pendingResize.isBlock || (pendingResize.booking && (pendingResize.booking.isBlocked || pendingResize.booking.status === 'blocked' || pendingResize.booking.status === 'maintenance')) ? '🛠️' : '📅'}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.3px" }}>
                  {pendingResize.isBlock || (pendingResize.booking && (pendingResize.booking.isBlocked || pendingResize.booking.status === 'blocked' || pendingResize.booking.status === 'maintenance')) ? 'Confirm Room Block Extension?' : 'Confirm Stay Date Adjustment?'}
                </h3>
                <p style={{ margin: "3px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                  {pendingResize.isBlock || (pendingResize.booking && (pendingResize.booking.isBlocked || pendingResize.booking.status === 'blocked' || pendingResize.booking.status === 'maintenance')) ? (
                    <>Block Reason: <strong style={{ color: "#0f172a" }}>Out of Order (Maintenance)</strong> · Room {pendingResize.booking.room}</>
                  ) : (
                    <>Guest: <strong style={{ color: "#0f172a" }}>{pendingResize.booking.guest}</strong> · Room {pendingResize.booking.room}</>
                  )}
                </p>
              </div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "20px"
              }}
            >
              {pendingResize.isBlock || (pendingResize.booking && (pendingResize.booking.isBlocked || pendingResize.booking.status === 'blocked' || pendingResize.booking.status === 'maintenance')) ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>ORIGINAL BLOCK DATES</span>
                    <span style={{ fontWeight: "600", color: "#334155" }}>
                      {pendingResize.oldCheckIn} to {pendingResize.oldCheckOut} ({pendingResize.oldNights} Days)
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>NEW BLOCK DATES</span>
                    <strong style={{ color: "#0f172a", fontWeight: "800" }}>
                      {pendingResize.newCheckIn} to {pendingResize.newCheckOut} ({pendingResize.newNights} Days)
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>BLOCK ADJUSTMENT</span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "800",
                        padding: "3px 10px",
                        borderRadius: "6px",
                        background: pendingResize.diffNights >= 0 ? "#e0f2fe" : "#fef2f2",
                        color: pendingResize.diffNights >= 0 ? "#0369a1" : "#b91c1c",
                        border: pendingResize.diffNights >= 0 ? "1px solid #bae6fd" : "1px solid #fecaca"
                      }}
                    >
                      {pendingResize.diffNights >= 0 ? `+${pendingResize.diffNights} Days Extended` : `${pendingResize.diffNights} Days Shortened`}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>ORIGINAL STAY DATES</span>
                    <span style={{ fontWeight: "600", color: "#334155" }}>
                      {pendingResize.oldCheckIn} to {pendingResize.oldCheckOut} ({pendingResize.oldNights} Nights)
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>NEW STAY DATES</span>
                    <strong style={{ color: "#0f172a", fontWeight: "800" }}>
                      {pendingResize.newCheckIn} to {pendingResize.newCheckOut} ({pendingResize.newNights} Nights)
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>NIGHTS ADJUSTMENT</span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "800",
                        padding: "3px 10px",
                        borderRadius: "6px",
                        background: pendingResize.diffNights >= 0 ? "#ecfdf5" : "#fef2f2",
                        color: pendingResize.diffNights >= 0 ? "#047857" : "#b91c1c",
                        border: pendingResize.diffNights >= 0 ? "1px solid #a7f3d0" : "1px solid #fecaca"
                      }}
                    >
                      {pendingResize.diffNights >= 0 ? `+${pendingResize.diffNights} Nights Extended` : `${pendingResize.diffNights} Nights Shortened`}
                    </span>
                  </div>
                </>
              )}

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  marginTop: "6px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
                }}
              >
                {pendingResize.isBlock || (pendingResize.booking && (pendingResize.booking.isBlocked || pendingResize.booking.status === 'blocked' || pendingResize.booking.status === 'maintenance')) ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                      <span style={{ color: "#475569" }}>Block Type:</span>
                      <strong style={{ color: "#0f172a" }}>🛠️ Room Maintenance / Out of Order</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13.5px", fontWeight: "700", borderTop: "1.5px dashed #e2e8f0", paddingTop: "8px" }}>
                      <span style={{ color: "#0f172a" }}>Financial Impact:</span>
                      <strong style={{ color: "#047857", fontSize: "13.5px", fontWeight: "800" }}>
                        $0.00 (Maintenance Hold)
                      </strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                      <span style={{ color: "#475569", fontWeight: "600" }}>Nightly Rate:</span>
                      {isEditingRate ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={pendingResize.ratePerNight}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setPendingResize((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      ratePerNight: val,
                                      diffAmount: prev.diffNights * val,
                                    }
                                  : null
                              );
                            }}
                            style={{
                              width: "85px",
                              padding: "3px 7px",
                              borderRadius: "6px",
                              border: "1.5px solid #0284c7",
                              fontSize: "13px",
                              fontWeight: "700",
                              color: "#0f172a",
                              outline: "none",
                              background: "#ffffff"
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setIsEditingRate(false)}
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: "#0284c7",
                              color: "#ffffff",
                              border: "none",
                              fontSize: "11px",
                              fontWeight: "700",
                              cursor: "pointer"
                            }}
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ color: "#0f172a" }}>${(pendingResize.ratePerNight || 0).toLocaleString()} / night</strong>
                          <button
                            type="button"
                            onClick={() => setIsEditingRate(true)}
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: "#f1f5f9",
                              color: "#0284c7",
                              border: "1px solid #bae6fd",
                              fontSize: "11px",
                              fontWeight: "700",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            ✏️ Edit Rate
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13.5px", fontWeight: "700", borderTop: "1.5px dashed #e2e8f0", paddingTop: "8px" }}>
                      <span style={{ color: "#0f172a" }}>Financial Adjustment:</span>
                      <strong
                        style={{
                          color: pendingResize.diffAmount >= 0 ? "#047857" : "#dc2626",
                          fontSize: "14px",
                          fontWeight: "800"
                        }}
                      >
                        {pendingResize.diffAmount >= 0 ? "+" : ""}${pendingResize.diffAmount.toLocaleString()} Tariff Difference
                      </strong>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "12px",
                paddingTop: "14px",
                borderTop: "1px solid #f1f5f9"
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "13px",
                  color: "#475569",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  cursor: "pointer"
                }}
                onClick={() => { setPendingResize(null); setIsEditingRate(false); }}
              >
                ❌ Cancel &amp; Revert
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  fontWeight: "800",
                  fontSize: "13px",
                  color: "#0f172a",
                  background: "#d3d3d3",
                  border: "1px solid #b8b8b8",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
                }}
                onClick={confirmStayResize}
              >
                {pendingResize.isBlock || (pendingResize.booking && (pendingResize.booking.isBlocked || pendingResize.booking.status === 'blocked' || pendingResize.booking.status === 'maintenance')) ? '✅ Confirm Block Extension' : '✅ Confirm Stay Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAINTENANCE / ROOM BLOCK EDIT MODAL */}
      {pendingBlockEdit && !pendingResize && (
        <div className="fm-submodal-overlay">
          <div className="block-edit-card" onClick={(e) => e.stopPropagation()}>
            <div className="block-edit-header">
              <div className="block-header-title">
                <span className="icon">🔧</span>
                <div>
                  <h3>Edit Maintenance Block</h3>
                  <p className="sub">
                    Room <strong>{pendingBlockEdit.room}</strong> ({rooms.find((r) => r.no === pendingBlockEdit.room)?.type || "Standard"})
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="block-close-btn"
                onClick={() => setPendingBlockEdit(null)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <form
              className="block-edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveBlockDates(
                  pendingBlockEdit,
                  pendingBlockEdit.editCheckIn,
                  pendingBlockEdit.editCheckOut,
                  pendingBlockEdit.editNotes
                );
              }}
            >
              <div className="block-form-group">
                <label>Block Start Date (Check-In)</label>
                <CustomDatePicker
                  value={pendingBlockEdit.editCheckIn}
                  onChange={(e) =>
                    setPendingBlockEdit((prev) => ({ ...prev, editCheckIn: e.target.value }))
                  }
                />
              </div>

              <div className="block-form-group">
                <label>Block End Date (Check-Out)</label>
                <CustomDatePicker
                  value={pendingBlockEdit.editCheckOut}
                  onChange={(e) =>
                    setPendingBlockEdit((prev) => ({ ...prev, editCheckOut: e.target.value }))
                  }
                />
              </div>

              <div className="block-form-group">
                <label>Maintenance Reason / Remarks</label>
                <input
                  type="text"
                  value={pendingBlockEdit.editNotes}
                  onChange={(e) =>
                    setPendingBlockEdit((prev) => ({ ...prev, editNotes: e.target.value }))
                  }
                  placeholder="e.g. AC Repair, Painting, Deep Cleaning"
                />
              </div>

              <div className="block-edit-actions">
                <button
                  type="button"
                  className="btn-unblock-danger"
                  onClick={() => handleUnblockRoom(pendingBlockEdit)}
                >
                  🔓 Unblock Room
                </button>
                <div className="block-right-btns">
                  <button
                    type="button"
                    className="btn-cancel-soft"
                    onClick={() => setPendingBlockEdit(null)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-save-primary">
                    💾 Save Block Dates
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK HOUSEKEEPING STATUS MODAL */}
      {hkModalRoom && (
        <div className="fm-submodal-overlay" style={{ zIndex: 99999 }}>
          <div className="block-edit-card" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="block-edit-header">
              <div className="block-header-title">
                <span className="icon">🧹</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
                    Room {hkModalRoom.no} Housekeeping
                  </h3>
                  <p className="sub" style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                    {hkModalRoom.type || "Room"} · Status:{" "}
                    <strong style={{ color: hkModalRoom.housekeeping === "dirty" ? "#ef4444" : "#10b981" }}>
                      {(hkModalRoom.housekeeping || "clean").toUpperCase()}
                    </strong>
                  </p>
                </div>
              </div>
              <button type="button" className="block-close-btn" onClick={() => setHkModalRoom(null)}>✕</button>
            </div>

            <div style={{ padding: "16px 0 8px", display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                Select Housekeeping Status:
              </label>
              <button
                type="button"
                className="btn btn-success"
                style={{ justifyContent: "center", padding: "12px", fontSize: 13, fontWeight: 800, borderRadius: 8 }}
                onClick={() => handleCleanRoom(hkModalRoom.no, "clean")}
              >
                🟢 Mark Clean &amp; Ready
              </button>
              <button
                type="button"
                className="btn btn-warning"
                style={{ justifyContent: "center", padding: "12px", fontSize: 13, fontWeight: 800, borderRadius: 8, background: "#fef2f2", color: "#ef4444", borderColor: "#fca5a5" }}
                onClick={() => handleCleanRoom(hkModalRoom.no, "dirty")}
              >
                🔴 Mark Dirty (Needs Cleaning)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GUEST & BLOCKED ROOM HOVER CARD OVERLAY */}
      {hoveredBooking && !draggingId && !resizingId && (() => {
        const isBlocked = hoveredBooking.status === "blocked" ||
          hoveredBooking.status === "maintenance" ||
          String(hoveredBooking.guest || "").toLowerCase().includes("blocked");

        const fullDocUrls = [
          hoveredBooking.idFront,
          hoveredBooking.scannedIdUrl,
          hoveredBooking.idDocumentUrl,
          hoveredBooking.fullScanPhoto,
          ...(Array.isArray(hoveredBooking.scannedImages) ? hoveredBooking.scannedImages.map((s) => s.url) : [])
        ].filter(Boolean);

        const isFullDoc = (url) => !url || fullDocUrls.includes(url);

        const bId = hoveredBooking.id || hoveredBooking._id;
        const hoverPhotoUrl =
          (Array.isArray(hoveredBooking.capturedImages) && hoveredBooking.capturedImages[0]?.url ? hoveredBooking.capturedImages[0].url : null) ||
          (hoveredBooking.capturedPhoto && !isFullDoc(hoveredBooking.capturedPhoto) ? hoveredBooking.capturedPhoto : null) ||
          (hoveredBooking.guestPhoto && !isFullDoc(hoveredBooking.guestPhoto) ? hoveredBooking.guestPhoto : null) ||
          (hoveredBooking.photoUrl && !isFullDoc(hoveredBooking.photoUrl) ? hoveredBooking.photoUrl : null) ||
          null;

        return (
          <div
            className="gantt-hover-card"
            style={{
              position: "fixed",
              left: Math.max(12, hoverPos.x),
              top: hoverPos.y,
              zIndex: 99999,
              width: "310px",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 40px -8px rgba(15, 23, 42, 0.25), 0 0 1px 1px rgba(15, 23, 42, 0.08)",
              borderLeft: `4px solid ${getHoverBadgeColor(hoveredBooking.status)}`,
              padding: "18px",
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              pointerEvents: "none",
              animation: "hoverCardFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            {isBlocked ? (
              /* DEDICATED BLOCKED / OUT OF ORDER ROOM HOVER CARD */
              <div>
                {/* Header Section */}
                <div style={{ marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.3px", lineHeight: "1.2" }}>
                    🔒 {hoveredBooking.guest || "Blocked (Maintenance)"}
                  </h4>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", margin: "4px 0 8px 0", letterSpacing: "0.5px", fontFamily: "monospace" }}>
                    {hoveredBooking.id || hoveredBooking.resCode || "RESERVATION"} · Room {hoveredBooking.room || "Unassigned"}
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "10.5px",
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      padding: "3.5px 12px",
                      borderRadius: "12px",
                      background: "#f1f5f9",
                      color: "#475569"
                    }}
                  >
                    BLOCKED (OUT OF ORDER)
                  </span>
                </div>

                {/* Dates & Hold Duration Section */}
                <div style={{ borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", padding: "12px 0", margin: "12px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>START DATE</div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "3px" }}>
                        {formatHoverDate(hoveredBooking.checkIn)}
                      </div>
                    </div>
                    <div style={{ fontSize: "15px", color: "#cbd5e1", fontWeight: "700" }}>➔</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>END DATE</div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "3px" }}>
                        {formatHoverDate(hoveredBooking.checkOut)}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px dashed #e2e8f0", margin: "10px 0 8px 0" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#475569", fontWeight: "700" }}>
                    {(() => {
                      const n = calcHoverNights(hoveredBooking.checkIn, hoveredBooking.checkOut);
                      return <span>🗓️ {n} day{n === 1 ? "" : "s"} hold</span>;
                    })()}
                    <span>🛠️ Maintenance Hold</span>
                  </div>
                </div>

                {/* Block Reason / Notes Section */}
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "10px 12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "10px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                    BLOCK REASON / NOTES
                  </div>
                  <div style={{ fontSize: "12.5px", fontWeight: "700", color: "#1e293b", lineHeight: "1.3" }}>
                    {hoveredBooking.notes
                      ? (hoveredBooking.notes.replace(/\[Blocked:.*?\]/gi, "").replace(/[\[\]]/g, "").trim() || "Out of Order Maintenance Hold")
                      : "Out of Order Maintenance Hold"}
                  </div>
                </div>
              </div>
            ) : (
              /* REGULAR GUEST RESERVATION HOVER CARD */
              <div>
                {/* Header Section */}
                <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.3px", lineHeight: "1.2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {hoveredBooking.guest || "Guest"}
                    </h4>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", margin: "4px 0 8px 0", letterSpacing: "0.5px", fontFamily: "monospace" }}>
                      {hoveredBooking.id || "R10001"} · Room {hoveredBooking.room || "Unassigned"}
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "10.5px",
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        padding: "3.5px 12px",
                        borderRadius: "12px",
                        background: getHoverBadgeBg(hoveredBooking.isEnquiry || hoveredBooking.status === "enquiry" ? "enquiry" : hoveredBooking.status),
                        color: getHoverBadgeColor(hoveredBooking.isEnquiry || hoveredBooking.status === "enquiry" ? "enquiry" : hoveredBooking.status)
                      }}
                    >
                      {hoveredBooking.isEnquiry || hoveredBooking.status === "enquiry"
                        ? "ENQUIRY (HOLD)"
                        : hoveredBooking.status
                        ? String(hoveredBooking.status).replace("-", " ").toUpperCase()
                        : "CONFIRMED"}
                    </span>
                    {hoveredBooking.expiryDate && (
                      <div style={{ marginTop: "4px", fontSize: "11px", fontWeight: "700", color: "#b45309" }}>
                        ⏱️ Expiry: {formatHoverDate(hoveredBooking.expiryDate)} {hoveredBooking.expiryTime || ""}
                      </div>
                    )}
                  </div>

                  {/* GUEST PHOTO / ID PHOTO SQUARE BOX */}
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "8px",
                      border: "1.5px solid #cbd5e1",
                      background: "#f8fafc",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
                    }}
                  >
                    {hoverPhotoUrl && !imgErrorMap[hoverPhotoUrl] ? (
                      <img
                        src={hoverPhotoUrl}
                        alt={hoveredBooking.guest || "Guest"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={() => setImgErrorMap((prev) => ({ ...prev, [hoverPhotoUrl]: true }))}
                      />
                    ) : (
                      <div style={{ textAlign: "center", color: "#94a3b8", padding: "2px" }}>
                        <div style={{ fontSize: "20px", lineHeight: "1" }}>👤</div>
                        <span style={{ fontSize: "9px", fontWeight: 700, display: "block", marginTop: "2px" }}>No Photo</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates & Details Section */}
                <div style={{ borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", padding: "12px 0", margin: "12px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>CHECK IN</div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "3px" }}>
                        {formatHoverDate(hoveredBooking.checkIn)}
                      </div>
                    </div>
                    <div style={{ fontSize: "15px", color: "#cbd5e1", fontWeight: "700" }}>➔</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>CHECK OUT</div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "3px" }}>
                        {formatHoverDate(hoveredBooking.checkOut)}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px dashed #e2e8f0", margin: "10px 0 8px 0" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#475569", fontWeight: "700" }}>
                    {(() => {
                      const n = calcHoverNights(hoveredBooking.checkIn, hoveredBooking.checkOut);
                      return <span>🌙 {n} night{n === 1 ? "" : "s"}</span>;
                    })()}
                    <span>👥 {hoveredBooking.adults || 1}A {hoveredBooking.children ? `${hoveredBooking.children}C` : ""}</span>
                    <OtaBadge 
                      source={hoveredBooking.source || hoveredBooking.channel} 
                      size="sm" 
                      showText={true} 
                      otaBookingId={hoveredBooking.otaBookingId || hoveredBooking.confirmationCode} 
                    />
                  </div>
                </div>

                {/* Financial Progress Section */}
                {(() => {
                  const isVirtualStay = isVirtualRoomOrBooking(hoveredBooking, rooms, roomTypes);
                  const rawTotal = isVirtualStay ? 0 : Number(hoveredBooking.totalAmount || hoveredBooking.subtotal || 0);
                  const rawDue = isVirtualStay ? 0 : Number(hoveredBooking.balanceDue ?? 0);
                  const rawPaid = isVirtualStay ? 0 : Number(hoveredBooking.advanceAmount ?? hoveredBooking.paidAmount ?? (rawTotal - rawDue));
                  
                  const total = Math.round(rawTotal * 100) / 100;
                  const paid = Math.round(rawPaid * 100) / 100;
                  const due = Math.max(0, Math.round((total - paid) * 100) / 100);
                  const percentPaid = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 100;

                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#475569" }}>Trip Total</span>
                        <strong style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                          ${total.toFixed(2)}
                        </strong>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ height: "6px", width: "100%", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden", margin: "6px 0 8px 0" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${percentPaid}%`,
                            background: due <= 0.01 ? "#059669" : "#f59e0b",
                            borderRadius: "4px",
                            transition: "width 0.3s ease"
                          }}
                        />
                      </div>

                      {/* Payment Breakdown */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: "700" }}>
                        <span style={{ color: "#475569" }}>
                          Paid ${paid.toFixed(2)} of ${total.toFixed(2)}
                        </span>
                        <span style={{ color: due > 0.01 && !isVirtualStay ? "#d97706" : "#059669", fontWeight: "800" }}>
                          {isVirtualStay ? "✓ Non-Revenue Stay" : due > 0.01 ? `$${due.toFixed(2)} due` : "✓ Paid in Full"}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Folio / Guest Notes Section in Hover Card */}
                {(() => {
                  const hNotesList = (() => {
                    if (!hoveredBooking) return [];
                    if (Array.isArray(hoveredBooking.notesList) && hoveredBooking.notesList.length > 0) {
                      const valid = hoveredBooking.notesList.filter((n) => n && (typeof n === 'string' ? n.trim() : (n.text && String(n.text).trim())));
                      if (valid.length > 0) return valid;
                    }
                    if (Array.isArray(hoveredBooking.notes) && hoveredBooking.notes.length > 0) {
                      const valid = hoveredBooking.notes.filter((n) => n && (typeof n === 'string' ? n.trim() : (n.text && String(n.text).trim())));
                      if (valid.length > 0) return valid;
                    }
                    const txt = (
                      (typeof hoveredBooking.notes === 'string' ? hoveredBooking.notes : '') ||
                      (typeof hoveredBooking.specialRequests === 'string' ? hoveredBooking.specialRequests : '') ||
                      (typeof hoveredBooking.remark === 'string' ? hoveredBooking.remark : '') ||
                      (typeof hoveredBooking.remarks === 'string' ? hoveredBooking.remarks : '') ||
                      (typeof hoveredBooking.folioNotes === 'string' ? hoveredBooking.folioNotes : '') ||
                      ''
                    ).replace(/\[Blocked:.*?\]/gi, '').replace(/[\[\]]/g, '').trim();

                    return txt ? [{ text: txt }] : [];
                  })();

                  if (hNotesList.length === 0) return null;
                  const firstNote = typeof hNotesList[0] === 'string' ? hNotesList[0] : (hNotesList[0]?.text || '');

                  return (
                    <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "800", color: "#b45309", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                        <MessageSquare size={12} strokeWidth={2.5} /> FOLIO NOTES ({hNotesList.length})
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "#451a03", background: "#fffbeb", border: "1px solid #fef3c7", padding: "6px 10px", borderRadius: "6px", maxHeight: "60px", overflowY: "auto", lineHeight: "1.3" }}>
                        {firstNote}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })()}

      {/* OVERBOOKING RESOLUTION MODAL FOR CALENDAR */}
      <OverbookingModal
        isOpen={showCalOverbookingModal}
        onClose={() => setShowCalOverbookingModal(false)}
        overbookedReservations={overbookedReservations}
        roomsList={rooms}
        onOpenFolio={setSelectedFolioBooking}
        onRefreshBookings={() => {
          if (typeof getBookingsSync === "function") {
            const fresh = getBookingsSync();
            setAllBookingsList(fresh);
            setBookingsList(fresh.filter((b) => !isInactiveBooking(b)));
          }
        }}
      />
    </div>
  );
}
