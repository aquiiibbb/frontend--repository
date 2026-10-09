import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { getBookings, getRooms, getRoomTypes, updateBooking } from "../../services/api";
import { getBusinessDate, getActivityColors, isSellableRoom, getVirtualRoomTypeNames, findRoomTypeByName, findRoomByNumber, getRoomTypePrice } from "../../services/hotelConfig";
import FolioModal from "../../components/FolioModal";
import CustomCalendarPopover from "../../components/CustomCalendarPopover";
import CustomDatePicker from "../../components/CustomDatePicker";
import GroupOperationsModal from "../../components/GroupOperationsModal";
import OtaBadge from "../../components/OtaBadge";
import "./ActivityDashboard.css";

const todayISO = () => {
  return getBusinessDate();
};

export default function ActivityDashboard() {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);

  // Single Date Filter State (defaults to Local Today's date)
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);
  const iconBtnRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [activeCategory, setActiveCategory] = useState("arrivals"); // default active card ("arrivals")
  const [activityColors, setActivityColors] = useState(() => getActivityColors());

  useEffect(() => {
    const handleColorsUpdate = () => setActivityColors(getActivityColors());
    window.addEventListener("pms_activity_colors_updated", handleColorsUpdate);
    window.addEventListener("storage", handleColorsUpdate);
    return () => {
      window.removeEventListener("pms_activity_colors_updated", handleColorsUpdate);
      window.removeEventListener("storage", handleColorsUpdate);
    };
  }, []);

  const getActivityCardStyle = (key, isActive) => {
    const c = activityColors[key] || { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" };
    return {
      backgroundColor: c.bg,
      color: c.text,
      borderWidth: "1.5px",
      borderStyle: "solid",
      borderColor: c.border,
      boxShadow: isActive ? `0 0 0 2.5px ${c.border}, 0 4px 12px rgba(0,0,0,0.08)` : "0 1px 3px rgba(0,0,0,0.05)",
    };
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolioBooking, setSelectedFolioBooking] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
  const [groupOpsTarget, setGroupOpsTarget] = useState(null);
  const dateInputRef = React.useRef(null);

  // Room Assignment State
  const [showAssignRoomModal, setShowAssignRoomModal] = useState(false);
  const [assignRoomTargetBooking, setAssignRoomTargetBooking] = useState(null);
  const [assignRoomSelectedNo, setAssignRoomSelectedNo] = useState("");

  // Multi-select bulk action state
  const [selectedBookingIds, setSelectedBookingIds] = useState([]);

  // Settle Due Balance Popup State
  const [settleBalanceTargetBooking, setSettleBalanceTargetBooking] = useState(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settlePaymentMethod, setSettlePaymentMethod] = useState("Credit Card");
  const [settleNotes, setSettleNotes] = useState("");
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  // Extend Stay Popup State
  const [extendTargetBooking, setExtendTargetBooking] = useState(null);
  const [extendNewDate, setExtendNewDate] = useState("");
  const [extendSubmitting, setExtendSubmitting] = useState(false);

  // Calculate truly vacant rooms for target booking stay dates
  const trulyAvailableRooms = useMemo(() => {
    if (!assignRoomTargetBooking) return rooms;
    const inDate = assignRoomTargetBooking.checkIn;
    const outDate = assignRoomTargetBooking.checkOut;
    const targetId = assignRoomTargetBooking.id;
    const targetType = (assignRoomTargetBooking.roomType || "").toLowerCase();

    const avail = rooms.filter((r) => {
      const rNo = String(r.no || r.number || "").trim();
      const hasConflict = bookings.some((b) => {
        if (!b || b.id === targetId || b.status === "cancelled" || b.status === "enquiry" || b.status === "inquiry" || b.isEnquiry) return false;
        const bRoom = String(b.room || b.roomNumber || "").trim();
        if (bRoom !== rNo) return false;
        return b.checkIn < outDate && b.checkOut > inDate;
      });
      return !hasConflict;
    });

    // Sort matching room types to top
    return avail.sort((a, b) => {
      const matchA = (a.type || "").toLowerCase() === targetType ? -1 : 1;
      const matchB = (b.type || "").toLowerCase() === targetType ? -1 : 1;
      if (matchA !== matchB) return matchA - matchB;
      return String(a.no).localeCompare(String(b.no), undefined, { numeric: true });
    });
  }, [assignRoomTargetBooking, rooms, bookings]);

  const handleConfirmAssignRoom = async (e) => {
    if (e) e.preventDefault();
    if (!assignRoomTargetBooking) return;

    const targetRoomNo = assignRoomSelectedNo || (trulyAvailableRooms.length > 0 ? String(trulyAvailableRooms[0].no) : "");
    if (!targetRoomNo) {
      alert("No vacant rooms available in system for these stay dates.");
      return;
    }

    try {
      await updateBooking(assignRoomTargetBooking.id, { room: targetRoomNo, roomNumber: targetRoomNo });



      setBookings((prev) =>
        prev.map((b) => (b.id === assignRoomTargetBooking.id ? { ...b, room: targetRoomNo, roomNumber: targetRoomNo } : b))
      );
      setShowAssignRoomModal(false);
      setAssignRoomTargetBooking(null);
      setAssignRoomSelectedNo("");
      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    } catch (err) {
      alert(err.message || "Failed to assign room");
    }
  };

  const handleCheckIn = async (b) => {
    const isUnassigned = !b.room || String(b.room).toLowerCase() === "unassigned" || String(b.room) === "0";
    if (isUnassigned) {
      alert(`⚠️ Cannot check in ${b.guest || "Guest"} yet: Please assign a room number first.`);
      const defaultNo = trulyAvailableRooms.length > 0 ? String(trulyAvailableRooms[0].no) : "";
      setAssignRoomTargetBooking(b);
      setAssignRoomSelectedNo(defaultNo);
      setShowAssignRoomModal(true);
      return;
    }

    try {
      await updateBooking(b.id, { status: "checked-in" });
      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    } catch (err) {
      alert(err.message || "Failed to check in guest.");
    }
  };

  const handleCheckOut = async (b) => {
    const balanceNum = Number(b.balanceDue ?? (b.totalAmount ? Number(b.totalAmount) - Number(b.deposit || 0) : 0));
    if (balanceNum > 0) {
      alert(`⚠️ Cannot check out guest ${b.guest || "Guest"} yet: Outstanding balance of $${balanceNum.toFixed(2)} must be settled first.`);
      setSelectedFolioBooking(b);
      return;
    }

    try {
      await updateBooking(b.id, { status: "checked-out" });
      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    } catch (err) {
      alert(err.message || "Failed to check out guest.");
    }
  };

  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedBookingIds(displayedBookings.map((b) => b.id));
    } else {
      setSelectedBookingIds([]);
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedBookingIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkCheckIn = async () => {
    if (selectedBookingIds.length === 0) return;
    const targetBookings = displayedBookings.filter((b) => selectedBookingIds.includes(b.id));

    const unassignedItem = targetBookings.find((b) => !b.room || String(b.room).toLowerCase() === "unassigned" || String(b.room) === "0");
    if (unassignedItem) {
      alert(`⚠️ Bulk Check-In stopped: Reservation for ${unassignedItem.guest || "Guest"} is unassigned. Please assign a room first.`);
      return;
    }

    try {
      await Promise.all(targetBookings.map((b) => updateBooking(b.id, { status: "checked-in" })));
      setSelectedBookingIds([]);
      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
      alert(`✅ Bulk Check-In completed for ${targetBookings.length} guests.`);
    } catch (err) {
      alert(err.message || "Failed to perform bulk check-in.");
    }
  };

  const handleBulkCheckOut = async () => {
    if (selectedBookingIds.length === 0) return;
    const targetBookings = displayedBookings.filter((b) => selectedBookingIds.includes(b.id));

    const unpaidItem = targetBookings.find((b) => {
      const bal = Number(b.balanceDue ?? (b.totalAmount ? Number(b.totalAmount) - Number(b.deposit || 0) : 0));
      return bal > 0;
    });
    if (unpaidItem) {
      alert(`⚠️ Bulk Check-Out stopped: Guest ${unpaidItem.guest || "Guest"} has an outstanding balance due. Please settle balance first.`);
      setSelectedFolioBooking(unpaidItem);
      return;
    }

    try {
      await Promise.all(targetBookings.map((b) => updateBooking(b.id, { status: "checked-out" })));
      setSelectedBookingIds([]);
      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
      alert(`✅ Bulk Check-Out completed for ${targetBookings.length} guests.`);
    } catch (err) {
      alert(err.message || "Failed to perform bulk check-out.");
    }
  };

  const handleCancelBooking = async (b) => {
    if (!window.confirm(`Cancel reservation for ${b.guest || "Guest"}?`)) return;
    try {
      await updateBooking(b.id, { status: "cancelled" });
      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    } catch (err) {
      alert(err.message || "Failed to cancel booking.");
    }
  };

  const handleNoShowBooking = async (b) => {
    if (!window.confirm(`Mark ${b.guest || "Guest"} as No Show?`)) return;
    try {
      await updateBooking(b.id, { status: "no-show" });
      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    } catch (err) {
      alert(err.message || "Failed to mark no-show.");
    }
  };

  const handleUnblock = async (b) => {
    if (!window.confirm(`Unblock Room ${b.room}?`)) return;
    try {
      if (typeof deleteBooking === "function") {
        await deleteBooking(b.id || b._id);
      } else {
        await updateBooking(b.id || b._id, { status: "cancelled", isDeleted: true });
      }
      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    } catch (err) {
      alert(err.message || "Failed to unblock room.");
    }
  };

  const handleOpenExtendModal = (b) => {
    setExtendTargetBooking(b);
    const parts = (b.checkOut || todayISO()).split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() + 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setExtendNewDate(`${yyyy}-${mm}-${dd}`);
    } else {
      setExtendNewDate(b.checkOut || todayISO());
    }
  };

  const handleConfirmExtendStay = async (e) => {
    if (e) e.preventDefault();
    if (!extendTargetBooking || !extendNewDate) return;

    if (extendNewDate <= extendTargetBooking.checkIn) {
      alert("New check-out date must be after check-in date.");
      return;
    }
    if (extendNewDate <= extendTargetBooking.checkOut) {
      alert("New check-out date must be after current check-out date.");
      return;
    }

    const targetRoomStr = String(extendTargetBooking.room || "").trim();
    if (targetRoomStr && targetRoomStr.toLowerCase() !== "unassigned") {
      const hasConflict = bookings.some(
        (other) =>
          other &&
          other.id !== extendTargetBooking.id &&
          other.status !== "cancelled" &&
          String(other.room || "").trim() === targetRoomStr &&
          other.checkIn < extendNewDate &&
          other.checkOut > extendTargetBooking.checkIn
      );
      if (hasConflict) {
        alert(`❌ Cannot extend stay: Room ${extendTargetBooking.room} is occupied or blocked by another reservation during those dates.`);
        return;
      }
    }

    setExtendSubmitting(true);
    try {
      const inDate = new Date(extendTargetBooking.checkIn);
      const outDate = new Date(extendNewDate);
      const newNights = Math.max(1, Math.round((outDate - inDate) / (1000 * 60 * 60 * 24)));

      await updateBooking(extendTargetBooking.id, {
        checkOut: extendNewDate,
        nights: newNights,
      });

      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
      setExtendTargetBooking(null);
    } catch (err) {
      alert(err.message || "Failed to extend stay.");
    } finally {
      setExtendSubmitting(false);
    }
  };

  const handleOpenDatePicker = (e) => {
    if (e) e.stopPropagation();
    if (!showCalendarPopover && iconBtnRef.current) {
      const rect = iconBtnRef.current.getBoundingClientRect();
      let top = rect.bottom + 8;
      let left = rect.left;
      if (left + 260 > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - 260 - 12);
      }
      setPopoverPos({ top, left });
    }
    setShowCalendarPopover((prev) => !prev);
  };

  const handlePrevDay = () => {
    const parts = selectedDate.split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setSelectedDate(`${yyyy}-${mm}-${dd}`);
    }
  };

  const handleNextDay = () => {
    const parts = selectedDate.split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() + 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setSelectedDate(`${yyyy}-${mm}-${dd}`);
    }
  };

  // Load real live bookings, rooms, and room types from PMS database
  const loadData = async () => {
    try {
      const [bList, rList, tList] = await Promise.all([getBookings(), getRooms(), getRoomTypes()]);
      setBookings(bList || []);
      setRooms(rList || []);
      setRoomTypes(tList || []);
    } catch (e) {
      console.error("Error loading activity dashboard data:", e);
    }
  };

  const handleConfirmSettleBalance = async (e) => {
    e.preventDefault();
    if (!settleBalanceTargetBooking) return;
    const payVal = Number(settleAmount);
    if (isNaN(payVal) || payVal <= 0) {
      alert("Please enter a valid positive payment amount.");
      return;
    }

    setSettleSubmitting(true);
    try {
      const existingDeposit = Number(settleBalanceTargetBooking.deposit || 0);
      const existingPaid = Number(settleBalanceTargetBooking.paidAmount || 0);
      const newPaidAmount = existingPaid + payVal;
      const totalAmount = Number(settleBalanceTargetBooking.totalAmount || settleBalanceTargetBooking.subtotal || payVal);
      const newBalance = Math.max(0, totalAmount - (existingDeposit + newPaidAmount));

      const updatedData = {
        ...settleBalanceTargetBooking,
        paidAmount: newPaidAmount,
        balanceDue: newBalance,
        paymentStatus: newBalance <= 0 ? "Paid" : "Partial",
        payments: [
          ...(settleBalanceTargetBooking.payments || []),
          {
            id: `pay_${Date.now()}`,
            date: todayISO(),
            amount: payVal,
            method: settlePaymentMethod,
            type: "Settlement",
            notes: settleNotes || "Front Desk Settle Due Balance",
          },
        ],
      };

      await updateBooking(settleBalanceTargetBooking.id, updatedData);

      setBookings((prev) =>
        prev.map((b) => (b.id === settleBalanceTargetBooking.id ? { ...b, ...updatedData } : b))
      );

      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
      setSettleBalanceTargetBooking(null);
    } catch (err) {
      alert(err.message || "Failed to process settlement payment");
    } finally {
      setSettleSubmitting(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleBusinessDateChange = () => {
      setSelectedDate(todayISO());
      loadData();
    };
    window.addEventListener("pms_bookings_updated", loadData);
    window.addEventListener("pms_rooms_updated", loadData);
    window.addEventListener("pms_business_date_updated", handleBusinessDateChange);
    window.addEventListener("storage", loadData);
    return () => {
      window.removeEventListener("pms_bookings_updated", loadData);
      window.removeEventListener("pms_rooms_updated", loadData);
      window.removeEventListener("pms_business_date_updated", handleBusinessDateChange);
      window.removeEventListener("storage", loadData);
    };
  }, []);

  // Single Date Navigation Handlers
  function handlePrevDate() {
    const parts = selectedDate.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }

  function handleNextDate() {
    const parts = selectedDate.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }

  function handleTodayDate() {
    setSelectedDate(todayISO());
  }

  // Format date label for date badge (e.g. Thu, Aug 13, 2026) in LOCAL timezone
  function formatSelectedDateLabel(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(d);
    }
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(d);
  }

  // Helper to test if a record is a room block / maintenance hold
  function isRoomBlock(b) {
    if (!b) return false;
    const statusLower = (b.status || "").toLowerCase();
    return (
      statusLower === "blocked" ||
      statusLower === "out_of_order" ||
      statusLower === "out-of-order" ||
      statusLower === "maintenance" ||
      Boolean(b.isBlocked)
    );
  }

  // Helper to test if guest is currently checked-in
  function isCheckedInGuest(b) {
    if (!b) return false;
    const statusLower = (b.status || "").toLowerCase();
    return statusLower === "checked-in" || statusLower === "checked_in" || statusLower === "in-house";
  }

  // Helper to test if guest is already checked-out
  function isCheckedOutGuest(b) {
    if (!b) return false;
    const statusLower = (b.status || "").toLowerCase();
    return statusLower === "checked-out" || statusLower === "checked_out" || statusLower === "completed" || Boolean(b.checkedOut);
  }

  // Helper to test if booking is an unconfirmed enquiry
  function isEnquiry(b) {
    if (!b) return false;
    const statusLower = (b.status || "").toLowerCase().trim();
    return Boolean(b.isEnquiry) || statusLower === "enquiry" || statusLower === "inquiry" || statusLower === "group enquiry" || statusLower === "group_enquiry";
  }

  // Helper to get booking creation date (YYYY-MM-DD)
  function getBookingCreationDate(b) {
    if (!b) return "";
    const raw = b.bookingDate || b.createdDate || b.createdAt || b.created_at || b.date;
    if (raw) {
      const str = String(raw).trim();
      if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.substring(0, 10);
      }
    }
    return b.checkIn || "";
  }

  // Compute metrics dynamically according to explicit user directives
  const metrics = useMemo(() => {
    const targetDate = selectedDate;
    const isToday = targetDate === todayISO();

    // Filter real active guest reservations (excluding virtual/staff rooms, cancellations, no-shows, room blocks, and unconfirmed enquiries)
    const virtualTypeNames = getVirtualRoomTypeNames(roomTypes);
    const realBookings = bookings.filter((b) => {
      if (!b || b.isDeleted || isRoomBlock(b) || isEnquiry(b)) return false;
      const rNo = b.room || b.roomNumber || b.roomNo;
      if (rNo && !isSellableRoom(rNo, rooms, roomTypes)) return false;
      const bType = String(b.roomType || b.accommodation || "").trim().toLowerCase();
      if (bType && virtualTypeNames.includes(bType)) return false;

      const statusLower = (b.status || "").toLowerCase();
      return statusLower !== "cancelled" && statusLower !== "no-show" && statusLower !== "noshow" && statusLower !== "no_show";
    });

    // 1. ARRIVALS on selectedDate: Guests checking in on targetDate who have NOT checked in yet
    const arrivals = realBookings.filter((b) => {
      if (b.checkIn !== targetDate) return false;
      return !isCheckedInGuest(b);
    });

    // 2. DEPARTURES on selectedDate: Guests checking out on targetDate who have NOT checked out yet
    const departures = realBookings.filter((b) => {
      if (b.checkOut !== targetDate) return false;
      return !isCheckedOutGuest(b);
    });

    // 3. IN-HOUSE on selectedDate:
    // On today (13th Aug): Only guests who are ALREADY checked in (green status = 1)
    // On future dates (14th Aug): All active non-cancelled guests occupying rooms on that date (= 3)
    const inHouse = realBookings.filter((b) => {
      if (b.checkIn > targetDate || b.checkOut < targetDate) return false;
      if (isToday) {
        return isCheckedInGuest(b);
      }
      return b.checkIn <= targetDate && b.checkOut > targetDate;
    });

    // 4. STAYOVERS on selectedDate: Active guests on targetDate who arrived BEFORE targetDate and stay past targetDate
    const stayovers = realBookings.filter((b) => {
      return b.checkIn < targetDate && b.checkOut > targetDate && !isCheckedOutGuest(b);
    });

    // 5. BOOKINGS TAKEN on selectedDate: New reservations created/booked on targetDate (based on booking date)
    const bookingsTaken = realBookings.filter((b) => getBookingCreationDate(b) === targetDate);

    // 6. CANCELLATION covering selectedDate
    const cancellations = bookings.filter((b) => {
      const rNo = b.room || b.roomNumber || b.roomNo;
      if (rNo && !isSellableRoom(rNo, rooms, roomTypes)) return false;
      const statusLower = (b.status || "").toLowerCase();
      return statusLower === "cancelled" && b.checkIn <= targetDate && b.checkOut >= targetDate;
    });

    // 7. NO SHOW covering selectedDate
    const noShows = bookings.filter((b) => {
      if (b.isDeleted) return false;
      const rNo = b.room || b.roomNumber || b.roomNo;
      if (rNo && !isSellableRoom(rNo, rooms, roomTypes)) return false;
      const statusLower = (b.status || "").toLowerCase();
      return (statusLower === "no-show" || statusLower === "noshow" || statusLower === "no_show") && b.checkIn <= targetDate && b.checkOut >= targetDate;
    });

    // 8. BLOCKED ROOMS covering selectedDate (excluding cancelled/deleted blocks)
    const blockedRooms = bookings.filter((b) => {
      const statusLower = (b.status || "").toLowerCase();
      if (statusLower === "cancelled" || b.isDeleted) return false;
      if (!isRoomBlock(b)) return false;
      const rNo = b.room || b.roomNumber || b.roomNo;
      if (rNo && !isSellableRoom(rNo, rooms, roomTypes)) return false;
      return b.checkIn <= targetDate && b.checkOut >= targetDate;
    });

    return {
      arrivalsCount: arrivals.length,
      arrivalsBadge: arrivals.length,
      departuresCount: departures.length,
      inHouseCount: inHouse.length,
      stayoversCount: stayovers.length,
      bookingsCount: bookingsTaken.length,
      cancellationsCount: cancellations.length,
      noShowCount: noShows.length,
      blockedRoomsCount: blockedRooms.length,

      // Filter lists (Every card count matches its table list 1:1)
      arrivalsList: arrivals,
      departuresList: departures,
      inHouseList: inHouse,
      stayoversList: stayovers,
      bookingsList: bookingsTaken,
      cancellationsList: cancellations,
      noShowList: noShows,
      blockedRoomsList: blockedRooms,
    };
  }, [bookings, selectedDate]);

  // Determine current active list based on selected category card
  const filteredListByCategory = useMemo(() => {
    switch (activeCategory) {
      case "arrivals":
        return metrics.arrivalsList;
      case "departures":
        return metrics.departuresList;
      case "in-house":
        return metrics.inHouseList;
      case "stayovers":
        return metrics.stayoversList;
      case "cancellations":
        return metrics.cancellationsList;
      case "no-show":
      case "noshow":
        return metrics.noShowList;
      case "blocked":
        return metrics.blockedRoomsList;
      case "bookings":
      default:
        return metrics.bookingsList;
    }
  }, [activeCategory, metrics]);

  // Apply search query filter
  const displayedBookings = useMemo(() => {
    if (!searchQuery.trim()) return filteredListByCategory;
    const q = searchQuery.toLowerCase().trim();
    return filteredListByCategory.filter((b) => {
      const guestName = (b.guest || b.fullName || "").toLowerCase();
      const refCode = (b.id || b.referenceCode || "").toLowerCase();
      const roomCat = (b.roomType || b.accommodation || "").toLowerCase();
      const roomNum = String(b.room || "");
      return (
        guestName.includes(q) ||
        refCode.includes(q) ||
        roomCat.includes(q) ||
        roomNum.includes(q)
      );
    });
  }, [filteredListByCategory, searchQuery]);

  // Format date range (e.g. 08/13/2026 - 08/16/2026)
  function formatDateRange(checkIn, checkOut) {
    if (!checkIn) return "08/13/2026 - 08/16/2026";
    const format = (dStr) => {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
      }
      return dStr;
    };
    return `${format(checkIn)} - ${format(checkOut || checkIn)}`;
  }

  // Get confirmation ref code like KMSPQGBM2
  function getRefCode(b) {
    if (b.id && b.id.length > 5) return b.id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-10);
    return `KMS${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  // Channel / Block badge renderer
  function renderChannelBadge(b) {
    if (isRoomBlock(b)) {
      return <span className="channel-badge default" title="Room Block / Maintenance Hold">🔒 Block</span>;
    }
    return (
      <OtaBadge
        source={b.source || b.channel}
        size="xs"
        showText={true}
        otaBookingId={b.otaBookingId || b.confirmationCode}
      />
    );
  }

  return (
    <div className="activity-dashboard-container">
      {/* 1. TOP HEADER & SINGLE DATE FILTER BAR */}
      <div className="act-header-bar">
        <div className="act-header-left" style={{ position: "relative" }}>
          <h1 className="act-title">Daily Activities List</h1>

          {/* PURE CALENDAR ICON ONLY BUTTON */}
          <button
            ref={iconBtnRef}
            type="button"
            className="act-pure-icon-btn"
            onClick={handleOpenDatePicker}
            title="Select Date"
          >
            <svg width="30" height="30" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="10" width="36" height="32" rx="6" fill="#FFFFFF" stroke="#475569" strokeWidth="2.5" />
              <path d="M6 16C6 12.6863 8.68629 10 12 10H36C39.3137 10 42 12.6863 42 16V18H6V16Z" fill="#EF4444" />
              <rect x="14" y="6" width="4" height="8" rx="2" fill="#1E293B" />
              <rect x="30" y="6" width="4" height="8" rx="2" fill="#1E293B" />
              <circle cx="14" cy="25" r="2.5" fill="#1E293B" />
              <circle cx="24" cy="25" r="2.5" fill="#1E293B" />
              <circle cx="34" cy="25" r="2.5" fill="#1E293B" />
              <circle cx="14" cy="33" r="2.5" fill="#1E293B" />
              <circle cx="24" cy="33" r="2.5" fill="#1E293B" />
              <circle cx="34" cy="33" r="2.5" fill="#1E293B" />
            </svg>
          </button>

          {showCalendarPopover && createPortal(
            <div style={{ position: "fixed", top: `${popoverPos.top}px`, left: `${popoverPos.left}px`, zIndex: 999999 }}>
              <CustomCalendarPopover
                selectedDate={selectedDate}
                onSelectDate={(newDate) => setSelectedDate(newDate)}
                onClose={() => setShowCalendarPopover(false)}
                todayISO={todayISO()}
              />
            </div>,
            document.body
          )}
        </div>

        <div className="act-header-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            style={{ background: "#000000", color: "#ffffff", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: "800", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
            onClick={() => {
              const groupBk = (bookings || []).find((b) => b.groupId || b.groupName);
              if (groupBk) {
                setGroupOpsTarget(groupBk);
              } else {
                alert("No group reservations found. Create a group reservation via Group Booking Modal.");
              }
            }}
          >
            🏢 Group Operations Hub
          </button>

          <div className="act-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search guest or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 2. TOP METRIC TAB CARDS ROW (8 UNIFORM CARDS WITH DYNAMIC COLOR SETUP) */}
      <div className="act-metric-cards-row">
        {/* CARD 1: ARRIVALS */}
        <div
          className={`act-metric-card ${activeCategory === "arrivals" ? "active" : ""}`}
          onClick={() => setActiveCategory("arrivals")}
          style={getActivityCardStyle("arrivals", activeCategory === "arrivals")}
        >
          <div className="act-card-num-row">
            <span className="act-big-num" style={{ color: "inherit" }}>{metrics.arrivalsCount}</span>
            <span className="act-card-icon-badge blue-bg">📥</span>
          </div>
          <span className="act-card-label" style={{ color: "inherit" }}>Arrivals</span>
        </div>

        {/* CARD 2: DEPARTURES */}
        <div
          className={`act-metric-card ${activeCategory === "departures" ? "active" : ""}`}
          onClick={() => setActiveCategory("departures")}
          style={getActivityCardStyle("departures", activeCategory === "departures")}
        >
          <div className="act-card-num-row">
            <span className="act-big-num" style={{ color: "inherit" }}>{metrics.departuresCount}</span>
            <span className="act-card-icon-badge green-bg">📤</span>
          </div>
          <span className="act-card-label" style={{ color: "inherit" }}>Departures</span>
        </div>

        {/* CARD 3: IN-HOUSE */}
        <div
          className={`act-metric-card ${activeCategory === "in-house" ? "active" : ""}`}
          onClick={() => setActiveCategory("in-house")}
          style={getActivityCardStyle("inHouse", activeCategory === "in-house")}
        >
          <div className="act-card-num-row">
            <span className="act-big-num" style={{ color: "inherit" }}>{metrics.inHouseCount}</span>
            <span className="act-card-icon-badge purple-bg">👤</span>
          </div>
          <span className="act-card-label" style={{ color: "inherit" }}>In-house</span>
        </div>

        {/* CARD 4: STAYOVERS */}
        <div
          className={`act-metric-card ${activeCategory === "stayovers" ? "active" : ""}`}
          onClick={() => setActiveCategory("stayovers")}
          style={getActivityCardStyle("stayovers", activeCategory === "stayovers")}
        >
          <div className="act-card-num-row">
            <span className="act-big-num" style={{ color: "inherit" }}>{metrics.stayoversCount}</span>
            <span className="act-card-icon-badge amber-bg">🌙</span>
          </div>
          <span className="act-card-label" style={{ color: "inherit" }}>Stayovers</span>
        </div>

        {/* CARD 5: BOOKINGS */}
        <div
          className={`act-metric-card ${activeCategory === "bookings" ? "active" : ""}`}
          onClick={() => setActiveCategory("bookings")}
          style={getActivityCardStyle("bookings", activeCategory === "bookings")}
        >
          <div className="act-card-num-row">
            <span className="act-big-num" style={{ color: "inherit" }}>{metrics.bookingsCount}</span>
            <span className="act-card-icon-badge indigo-bg">📋</span>
          </div>
          <span className="act-card-label" style={{ color: "inherit" }}>Bookings</span>
        </div>

        {/* CARD 6: CANCELATIONS */}
        <div
          className={`act-metric-card ${activeCategory === "cancellations" ? "active" : ""}`}
          onClick={() => setActiveCategory("cancellations")}
          style={getActivityCardStyle("cancelations", activeCategory === "cancellations")}
        >
          <div className="act-card-num-row">
            <span className="act-big-num" style={{ color: "inherit" }}>{metrics.cancellationsCount}</span>
            <span className="act-card-icon-badge red-bg">❌</span>
          </div>
          <span className="act-card-label" style={{ color: "inherit" }}>Cancelations</span>
        </div>

        {/* CARD 7: NO SHOW */}
        <div
          className={`act-metric-card ${activeCategory === "no-show" ? "active" : ""}`}
          onClick={() => setActiveCategory("no-show")}
          style={getActivityCardStyle("noShow", activeCategory === "no-show")}
        >
          <div className="act-card-num-row">
            <span className="act-big-num" style={{ color: "inherit" }}>{metrics.noShowCount}</span>
            <span className="act-card-icon-badge orange-bg">🚫</span>
          </div>
          <span className="act-card-label" style={{ color: "inherit" }}>No Show</span>
        </div>

        {/* CARD 8: BLOCKED ROOMS */}
        <div
          className={`act-metric-card ${activeCategory === "blocked" ? "active" : ""}`}
          onClick={() => setActiveCategory("blocked")}
          style={getActivityCardStyle("blocked", activeCategory === "blocked")}
        >
          <div className="act-card-num-row">
            <span className="act-big-num" style={{ color: "inherit" }}>{metrics.blockedRoomsCount}</span>
            <span className="act-card-icon-badge gray-bg">🔒</span>
          </div>
          <span className="act-card-label" style={{ color: "inherit" }}>Blocked Rooms</span>
        </div>
      </div>

      {/* FLOATING BULK ACTIONS BAR */}
      {selectedBookingIds.length > 0 && (
        <div className="act-bulk-actions-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "12px 24px", borderRadius: "14px", marginBottom: "16px", boxShadow: "0 8px 24px rgba(15,23,42,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>
            <span>☑️ {selectedBookingIds.length} item(s) selected</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {activeCategory === "arrivals" && (
              <button type="button" className="act-btn-checkin" onClick={handleBulkCheckIn} style={{ cursor: "pointer", background: "#10b981", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "10px", fontWeight: "800", fontSize: "13px" }}>
                🟢 Bulk Check In ({selectedBookingIds.length})
              </button>
            )}
            {(activeCategory === "departures" || activeCategory === "in-house") && (
              <button type="button" className="act-btn-checkout" onClick={handleBulkCheckOut} style={{ cursor: "pointer", background: "#0284c7", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "10px", fontWeight: "800", fontSize: "13px" }}>
                🚪 Bulk Check Out ({selectedBookingIds.length})
              </button>
            )}
            <button type="button" onClick={() => setSelectedBookingIds([])} style={{ cursor: "pointer", background: "rgba(255,255,255,0.15)", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "10px", fontWeight: "700", fontSize: "13px" }}>
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* 3. ACTIVITY DATA TABLE */}
      <div className="act-table-card">
        <table className="act-data-table">
          <thead>
            {activeCategory === "blocked" ? (
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={displayedBookings.length > 0 && selectedBookingIds.length === displayedBookings.length}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th className="col-accommodation">Room</th>
                <th className="col-stay">Block Dates</th>
                <th className="col-remark">Remark</th>
                <th className="col-actions">ACTIONS</th>
              </tr>
            ) : (
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={displayedBookings.length > 0 && selectedBookingIds.length === displayedBookings.length}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th className="col-guest">
                  Guest <span className="sort-arrows">⇅</span>
                </th>
                <th className="col-accommodation">
                  Room <span className="sort-arrows">⇅</span>
                </th>
                <th className="col-stay">Stay</th>
                <th className="col-total">Grand total</th>
                <th className="col-balance">Balance Due</th>
                <th className="col-actions">ACTIONS</th>
              </tr>
            )}
          </thead>
          <tbody>
            {displayedBookings.length === 0 ? (
              <tr>
                <td colSpan={activeCategory === "blocked" ? 5 : 7} className="act-empty-cell">
                  <div className="act-empty-state">
                    <span style={{ fontSize: 32 }}>📅</span>
                    <h3>No &quot;{activeCategory}&quot; activity for {formatSelectedDateLabel(selectedDate)}</h3>
                    <p>Try selecting another date using the Single Date Filter above or clearing your search query.</p>
                  </div>
                </td>
              </tr>
            ) : (
              displayedBookings.map((b, index) => {
                const refCode = getRefCode(b);
                const nightsCount = Number(b.nights) || 1;
                const adultsCount = Number(b.adults) || 2;
                const childrenCount = Number(b.children) || 0;
                const rNo = b.room || b.roomNumber || b.roomNo;
                const isVirtualStay = rNo ? !isSellableRoom(rNo, rooms, roomTypes) : false;

                let calculatedTotal = Number(b.totalAmount || b.subtotal || b.grandTotal || 0);
                if (calculatedTotal === 0 && !isVirtualStay && !b.isComplimentary && !isRoomBlock(b)) {
                  const roomTypeObj = findRoomTypeByName(roomTypes, b.roomType || b.accommodation);
                  const roomObj = findRoomByNumber(rooms, rNo);
                  const perNight = getRoomTypePrice(roomTypeObj, roomObj);
                  calculatedTotal = perNight * nightsCount;
                }

                const totalAmount = isVirtualStay ? "0.00" : calculatedTotal.toFixed(2);

                // Calculate balance due
                const balanceNum = (isRoomBlock(b) || isVirtualStay)
                  ? 0
                  : Number(b.balanceDue ?? (b.totalAmount ? Number(b.totalAmount) - Number(b.deposit || 0) : calculatedTotal));
                const balanceStr = balanceNum.toFixed(2);
                const hasPendingBalance = balanceNum > 0 || b.paymentStatus === "Pending";
                const guestName = b.guest || b.fullName || "Guest Name";
                const isBlock = isRoomBlock(b);
                const isUnassigned = !b.room || String(b.room).toLowerCase() === "unassigned" || String(b.room) === "0";
                const isSelected = selectedBookingIds.includes(b.id);

                // --- CUSTOM VIEW FOR BLOCKED ROOMS TAB ---
                if (activeCategory === "blocked") {
                  return (
                    <tr key={b.id || index} className={`act-table-row ${isSelected ? "selected" : ""}`}>
                      <td className="col-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(b.id)}
                        />
                      </td>
                      <td className="col-accommodation">
                        <span className="act-guest-name">Room {b.room || "101"}</span>
                        <div className="act-ref-code">{b.roomType || "Deluxe Room"}</div>
                      </td>
                      <td className="col-stay">
                        <div className="act-stay-dates">{formatDateRange(b.checkIn, b.checkOut)}</div>
                        <div className="act-stay-badges-row">
                          <span className="act-pill-badge">{nightsCount} <span className="icon">🌙</span></span>
                        </div>
                      </td>
                      <td className="col-remark">
                        <span style={{ fontSize: "13.5px", fontWeight: "700", color: "#1e293b" }}>
                          {(b.notes || b.reason || b.guest || "Scheduled Maintenance").replace(/^\[Blocked:\s*Maintenance\]\s*/i, "")}
                        </span>
                      </td>
                      <td className="col-actions">
                        <div className="act-actions-flex">
                          <button type="button" className="act-btn-unblock" onClick={() => handleUnblock(b)}>
                            🔓 Unblock
                          </button>
                          <button type="button" className="act-btn-extend" onClick={() => handleOpenExtendModal(b)}>
                            📅 Extend
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // --- STANDARD RESERVATIONS VIEW ---
                return (
                  <tr key={b.id || index} className={`act-table-row ${isSelected ? "selected" : ""}`}>
                    <td className="col-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(b.id)}
                      />
                    </td>
                    {/* GUEST COLUMN */}
                    <td className="col-guest">
                      <div className="act-guest-name-row">
                        <span className="act-guest-name">{guestName}</span>
                        {renderChannelBadge(b)}
                      </div>
                      <div className="act-ref-code">{refCode}</div>
                    </td>

                    {/* ROOM COLUMN */}
                    <td className="col-accommodation">
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span className="act-room-type">
                          {b.roomType || "Standard Room"}
                        </span>
                        {!isUnassigned && (
                          <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#334155" }}>
                            Room {b.room}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* STAY COLUMN */}
                    <td className="col-stay">
                      <div className="act-stay-dates">
                        {formatDateRange(b.checkIn, b.checkOut)}
                      </div>
                      <div className="act-stay-badges-row">
                        <span className="act-pill-badge">
                          {nightsCount} <span className="icon">🌙</span>
                        </span>
                        <span className="act-pill-badge">
                          {adultsCount} <span className="icon">👤</span>
                        </span>
                        <span className="act-pill-badge">
                          {childrenCount} <span className="icon">👶</span>
                        </span>
                      </div>
                    </td>

                    {/* GRAND TOTAL COLUMN */}
                    <td className="col-total">
                      <span className="act-grand-total">${totalAmount}</span>
                    </td>

                    {/* BALANCE DUE COLUMN */}
                    <td className="col-balance">
                      {isBlock ? (
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#94a3b8" }}>—</span>
                      ) : balanceNum > 0 ? (
                        <span className="act-balance-badge due" title="Outstanding balance due">
                          ${balanceStr}
                        </span>
                      ) : (
                        <span className="act-balance-badge paid" title="Fully paid balance">
                          $0.00 <span className="check">✓</span>
                        </span>
                      )}
                    </td>

                    {/* CONTEXT-SPECIFIC ACTIONS COLUMN - CLEAN PRIMARY ACTION + DROPDOWN */}
                    <td className="col-actions">
                      <div className="act-actions-flex">
                        {/* 1. ARRIVALS ACTIONS */}
                        {activeCategory === "arrivals" && (
                          <>
                            {isUnassigned ? (
                              <button
                                type="button"
                                className="act-btn-assign"
                                onClick={() => {
                                  const defaultNo = trulyAvailableRooms.length > 0 ? String(trulyAvailableRooms[0].no) : "";
                                  setAssignRoomTargetBooking(b);
                                  setAssignRoomSelectedNo(defaultNo);
                                  setShowAssignRoomModal(true);
                                }}
                              >
                                ⚡ Assign Room
                              </button>
                            ) : (
                              <button type="button" className="act-btn-checkin" onClick={() => handleCheckIn(b)}>
                                🟢 Check In
                              </button>
                            )}
                            <button type="button" className="act-btn-folio" onClick={() => setSelectedFolioBooking(b)}>
                              📄 Folio
                            </button>
                          </>
                        )}

                        {/* 2. DEPARTURES ACTIONS */}
                        {activeCategory === "departures" && (
                          <>
                            <button type="button" className="act-btn-checkout" onClick={() => handleCheckOut(b)}>
                              🚪 Check Out
                            </button>
                            <button type="button" className="act-btn-folio" onClick={() => setSelectedFolioBooking(b)}>
                              📄 Folio
                            </button>
                          </>
                        )}

                        {/* 3. IN-HOUSE & STAYOVERS ACTIONS */}
                        {(activeCategory === "in-house" || activeCategory === "stayovers") && (
                          <>
                            <button type="button" className="act-btn-folio" onClick={() => setSelectedFolioBooking(b)}>
                              📄 Folio
                            </button>
                            <button type="button" className="act-btn-extend" onClick={() => handleOpenExtendModal(b)}>
                              📅 Extend
                            </button>
                          </>
                        )}

                        {/* 4. BOOKINGS ACTIONS */}
                        {activeCategory === "bookings" && (
                          <>
                            <button type="button" className="act-btn-folio" onClick={() => setSelectedFolioBooking(b)}>
                              📄 Folio
                            </button>
                            {isUnassigned && (
                              <button
                                type="button"
                                className="act-btn-assign"
                                onClick={() => {
                                  const defaultNo = trulyAvailableRooms.length > 0 ? String(trulyAvailableRooms[0].no) : "";
                                  setAssignRoomTargetBooking(b);
                                  setAssignRoomSelectedNo(defaultNo);
                                  setShowAssignRoomModal(true);
                                }}
                              >
                                ⚡ Assign
                              </button>
                            )}
                          </>
                        )}

                        {/* 5. BLOCKED ROOMS ACTIONS */}
                        {activeCategory === "blocked" && (
                          <>
                            <button type="button" className="act-btn-unblock" onClick={() => handleUnblock(b)}>
                              🔓 Unblock
                            </button>
                            <button type="button" className="act-btn-extend" onClick={() => handleOpenExtendModal(b)}>
                              📅 Extend
                            </button>
                          </>
                        )}

                        {/* 6. CANCELLATIONS & OTHER FALLBACK */}
                        {activeCategory !== "arrivals" &&
                          activeCategory !== "departures" &&
                          activeCategory !== "in-house" &&
                          activeCategory !== "stayovers" &&
                          activeCategory !== "bookings" &&
                          activeCategory !== "blocked" && (
                            <button type="button" className="act-btn-folio" onClick={() => setSelectedFolioBooking(b)}>
                              📄 Folio
                            </button>
                          )}

                        {/* ACTIONS ▾ DROPDOWN MENU */}
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <button
                            type="button"
                            className="act-btn-more-dropdown"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(openActionMenuId === b.id ? null : b.id);
                            }}
                            title="More Actions"
                          >
                            Actions ▾
                          </button>

                          {openActionMenuId === b.id && (
                            <>
                              <div
                                className="act-menu-backdrop"
                                onClick={() => setOpenActionMenuId(null)}
                              />
                              <div className="act-popover-menu" onClick={(e) => e.stopPropagation()}>
                                {balanceNum > 0 && (
                                  <button
                                    type="button"
                                    className="popover-item settle"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setSettleBalanceTargetBooking(b);
                                      setSettleAmount(balanceStr);
                                      setSettlePaymentMethod("Credit Card");
                                      setSettleNotes("");
                                    }}
                                  >
                                    💳 Settle Due Balance
                                  </button>
                                )}

                                {activeCategory === "arrivals" && (
                                  <>
                                    <button
                                      type="button"
                                      className="popover-item cancel"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleCancelBooking(b);
                                      }}
                                    >
                                      🔴 Cancel Reservation
                                    </button>
                                    <button
                                      type="button"
                                      className="popover-item noshow"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleNoShowBooking(b);
                                      }}
                                    >
                                      👻 Mark No Show
                                    </button>
                                  </>
                                )}

                                {activeCategory === "departures" && (
                                  <button
                                    type="button"
                                    className="popover-item cancel"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleCancelBooking(b);
                                    }}
                                  >
                                    🔴 Cancel Reservation
                                  </button>
                                )}

                                {(activeCategory === "in-house" || activeCategory === "stayovers") && (
                                  <button
                                    type="button"
                                    className="popover-item checkout"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleCheckOut(b);
                                    }}
                                  >
                                    🚪 Check Out Guest
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FOLIO MODAL */}
      {selectedFolioBooking && (
        <FolioModal
          isOpen={Boolean(selectedFolioBooking)}
          onClose={() => setSelectedFolioBooking(null)}
          booking={selectedFolioBooking}
          room={rooms.find((r) => r.no === selectedFolioBooking?.room)}
          rooms={rooms}
        />
      )}

      {/* QUICK RESERVATION DETAILS MODAL */}
      {selectedBookingDetails && (
        <div className="act-modal-overlay">
          <div className="act-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="act-modal-head">
              <h3>Reservation Details</h3>
              <button type="button" className="act-modal-close" onClick={() => setSelectedBookingDetails(null)}>✕</button>
            </div>
            <div className="act-modal-body">
              <div className="act-detail-row">
                <span>Guest Name / Subject:</span> <strong>{selectedBookingDetails.guest || "Guest"}</strong>
              </div>
              <div className="act-detail-row">
                <span>Room Assigned:</span> <strong>Room {selectedBookingDetails.room || "101"} ({selectedBookingDetails.roomType || "Deluxe"})</strong>
              </div>
              <div className="act-detail-row">
                <span>Check In / Out:</span> <strong>{selectedBookingDetails.checkIn} to {selectedBookingDetails.checkOut}</strong>
              </div>
              <div className="act-detail-row">
                <span>Total Amount:</span> <strong>${selectedBookingDetails.totalAmount || "287.47"}</strong>
              </div>
              <div className="act-detail-row">
                <span>Status:</span> <strong style={{ textTransform: "capitalize", color: "#0284c7" }}>{selectedBookingDetails.status || "Confirmed"}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ASSIGN ROOM MODAL */}
      {showAssignRoomModal && assignRoomTargetBooking && (
        <div className="act-modal-overlay">
          <div className="act-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="act-modal-head">
              <h3>🏷️ Assign Room to Guest</h3>
              <button type="button" className="act-modal-close" onClick={() => setShowAssignRoomModal(false)}>✕</button>
            </div>
            <div className="act-modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#475569" }}>
                Select an available room number for <strong>{assignRoomTargetBooking.guest || "Guest"}</strong> ({assignRoomTargetBooking.roomType || "Standard Room"}):
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a" }}>Available Room Number *</label>
                {trulyAvailableRooms.length === 0 ? (
                  <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", padding: "10px", borderRadius: "10px", fontSize: "12.5px", fontWeight: "700" }}>
                    ⚠️ No vacant rooms available for stay dates ({assignRoomTargetBooking.checkIn} to {assignRoomTargetBooking.checkOut}).
                  </div>
                ) : (
                  <select
                    value={assignRoomSelectedNo || String(trulyAvailableRooms[0].no)}
                    onChange={(e) => setAssignRoomSelectedNo(e.target.value)}
                    style={{
                      padding: "10px",
                      borderRadius: "10px",
                      border: "1.5px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: "14px",
                      fontWeight: "700",
                      color: "#0f172a"
                    }}
                  >
                    {trulyAvailableRooms.map((r) => (
                      <option key={r.no} value={String(r.no)}>
                        Room {r.no} — {r.type || "Standard Room"} (Vacant / Available)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px", paddingTop: "14px", borderTop: "1px solid #e2e8f0" }}>
              <button type="button" className="act-btn-secondary" onClick={() => setShowAssignRoomModal(false)}>Cancel</button>
              <button
                type="button"
                className="act-btn-primary"
                disabled={trulyAvailableRooms.length === 0}
                onClick={handleConfirmAssignRoom}
                style={{
                  background: trulyAvailableRooms.length === 0 ? "#94a3b8" : "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "8px 18px",
                  fontWeight: "800",
                  cursor: trulyAvailableRooms.length === 0 ? "not-allowed" : "pointer"
                }}
              >
                Confirm Room Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTLE DUE BALANCE POPUP MODAL */}
      {settleBalanceTargetBooking && (
        <div
          className="act-modal-overlay"
          
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="act-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #cbd5e1",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                color: "#ffffff",
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "22px" }}>💳</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#38bdf8" }}>
                    Settle Due Balance
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                    {settleBalanceTargetBooking.guest || "Guest"} · {settleBalanceTargetBooking.room ? `Room ${settleBalanceTargetBooking.room}` : "Unassigned"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettleBalanceTargetBooking(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "none",
                  color: "#ffffff",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontWeight: "800",
                  fontSize: "14px",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSettleBalance} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#991b1b" }}>Outstanding Balance:</span>
                <span style={{ fontSize: "18px", fontWeight: "900", color: "#dc2626" }}>
                  ${Number(settleBalanceTargetBooking.balanceDue ?? (settleBalanceTargetBooking.totalAmount ? Number(settleBalanceTargetBooking.totalAmount) - Number(settleBalanceTargetBooking.deposit || 0) : 0)).toFixed(2)}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: "800", color: "#334155" }}>
                  Payment Amount ($) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "15px",
                    fontWeight: "700",
                    color: "#0f172a",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: "800", color: "#334155" }}>
                  Payment Method
                </label>
                <select
                  value={settlePaymentMethod}
                  onChange={(e) => setSettlePaymentMethod(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#0f172a",
                    outline: "none",
                    background: "#ffffff",
                  }}
                >
                  <option value="Credit Card">💳 Credit Card</option>
                  <option value="Debit Card">💳 Debit Card</option>
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI / Bank Transfer">🏦 UPI / Bank Transfer</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: "800", color: "#334155" }}>
                  Notes / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Front desk settlement"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "13.5px",
                    color: "#0f172a",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setSettleBalanceTargetBooking(null)}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: "800",
                    fontSize: "13.5px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleSubmitting}
                  style={{
                    flex: 1.5,
                    padding: "11px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                    color: "#ffffff",
                    fontWeight: "800",
                    fontSize: "13.5px",
                    cursor: settleSubmitting ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                  }}
                >
                  {settleSubmitting ? "Processing..." : "💳 Complete Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXTEND STAY / ROOM BLOCK POPUP MODAL */}
      {extendTargetBooking && (() => {
        const isBlockModal = isRoomBlock(extendTargetBooking) || activeCategory === "blocked";
        return (
          <div
            className="act-modal-overlay"
            
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(4px)",
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              className="act-modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "460px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                border: "1px solid #cbd5e1",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  color: "#ffffff",
                  padding: "18px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "22px" }}>{isBlockModal ? "🔒" : "📅"}</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#38bdf8" }}>
                      {isBlockModal ? "Extend Room Block" : "Extend Stay Duration"}
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                      {isBlockModal
                        ? `Room ${extendTargetBooking.room || "101"} · Blocked (${(extendTargetBooking.notes || extendTargetBooking.reason || "Maintenance").replace(/^\[Blocked:\s*Maintenance\]\s*/i, "")})`
                        : `${extendTargetBooking.guest || "Guest"} · ${extendTargetBooking.room ? `Room ${extendTargetBooking.room}` : "Unassigned"}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExtendTargetBooking(null)}
                  style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    border: "none",
                    color: "#ffffff",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontWeight: "800",
                    fontSize: "14px",
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConfirmExtendStay} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                    <span style={{ color: "#64748b", fontWeight: "700" }}>{isBlockModal ? "Block Start Date:" : "Check-In Date:"}</span>
                    <strong style={{ color: "#0f172a" }}>{extendTargetBooking.checkIn}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                    <span style={{ color: "#64748b", fontWeight: "700" }}>{isBlockModal ? "Current Block End Date:" : "Current Check-Out:"}</span>
                    <strong style={{ color: "#0f172a" }}>{extendTargetBooking.checkOut}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: "800", color: "#334155" }}>
                    {isBlockModal ? "New Block End Date" : "New Check-Out Date"} <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <CustomDatePicker
                    min={extendTargetBooking.checkOut || extendTargetBooking.checkIn}
                    value={extendNewDate}
                    onChange={(e) => setExtendNewDate(e.target.value)}
                  />
                </div>

                {(() => {
                  const targetRoomStr = String(extendTargetBooking.room || "").trim();
                  if (targetRoomStr && targetRoomStr.toLowerCase() !== "unassigned" && extendNewDate > extendTargetBooking.checkOut) {
                    const hasConflict = bookings.some(
                      (other) =>
                        other &&
                        other.id !== extendTargetBooking.id &&
                        other.status !== "cancelled" &&
                        String(other.room || "").trim() === targetRoomStr &&
                        other.checkIn < extendNewDate &&
                        other.checkOut > extendTargetBooking.checkIn
                    );
                    if (hasConflict) {
                      return (
                        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 14px", fontSize: "12.5px", color: "#991b1b", fontWeight: "700" }}>
                          ⚠️ Conflict Detected: Room {extendTargetBooking.room} is occupied or blocked by another reservation during the extended dates ({extendTargetBooking.checkOut} to {extendNewDate}).
                        </div>
                      );
                    }
                  }
                  return null;
                })()}

                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setExtendTargetBooking(null)}
                    style={{
                      flex: 1,
                      padding: "11px",
                      borderRadius: "10px",
                      border: "1.5px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#475569",
                      fontWeight: "800",
                      fontSize: "13.5px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={extendSubmitting || extendNewDate <= extendTargetBooking.checkOut}
                    style={{
                      flex: 1.5,
                      padding: "11px",
                      borderRadius: "10px",
                      border: "none",
                      background: (extendSubmitting || extendNewDate <= extendTargetBooking.checkOut) ? "#94a3b8" : "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                      color: "#ffffff",
                      fontWeight: "800",
                      fontSize: "13.5px",
                      cursor: (extendSubmitting || extendNewDate <= extendTargetBooking.checkOut) ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                    }}
                  >
                    {extendSubmitting ? "Updating..." : (isBlockModal ? "🔒 Confirm Block Extension" : "📅 Confirm Extension")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      <GroupOperationsModal
        isOpen={Boolean(groupOpsTarget)}
        onClose={() => setGroupOpsTarget(null)}
        groupId={groupOpsTarget?.groupId}
        groupName={groupOpsTarget?.groupName}
        bookingsList={bookings}
        onGroupActionComplete={() => {
          loadData?.();
        }}
      />
    </div>
  );
}
