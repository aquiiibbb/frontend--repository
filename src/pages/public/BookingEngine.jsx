import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getRoomTypes, getRooms, getBookings, createBooking } from "../../services/api";
import { getHotelProfile, getRatePlans, getHotelAddons, getBookingEngineRoomDisplays, calculateYieldPrice } from "../../services/hotelConfig";
import "./BookingEngine.css";

function CustomLuxuryDatePicker({ label, selectedDate, minDate, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const datePickerRef = useRef(null);

  const parsedDate = useMemo(() => {
    if (!selectedDate) return new Date();
    const d = new Date(selectedDate + "T00:00:00");
    return isNaN(d.getTime()) ? new Date() : d;
  }, [selectedDate]);

  const [viewDate, setViewDate] = useState(() => new Date(parsedDate));

  useEffect(() => {
    setViewDate(new Date(parsedDate));
  }, [selectedDate, parsedDate]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(viewDate);

  const daysGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      const prevDate = new Date(year, month, -startDayOfWeek + i + 1);
      days.push({ dateObj: prevDate, isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const currDate = new Date(year, month, i);
      days.push({ dateObj: currDate, isCurrentMonth: true });
    }
    return days;
  }, [viewDate]);

  const minDateObj = useMemo(() => {
    if (!minDate) return null;
    const d = new Date(minDate + "T00:00:00");
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }, [minDate]);

  const formattedDisplay = useMemo(() => {
    if (!selectedDate) return "";
    const d = new Date(selectedDate + "T00:00:00");
    if (isNaN(d.getTime())) return selectedDate;
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(d);
  }, [selectedDate]);

  const handleSelectDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const shiftMonth = (delta) => {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="ibe-custom-datepicker-wrap" ref={datePickerRef}>
      <div className="ibe-field-label">{label}</div>
      <button
        type="button"
        className="ibe-custom-date-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="ibe-date-icon">📅</span>
        <span className="ibe-date-text">{formattedDisplay}</span>
        <span className="ibe-date-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="ibe-datepicker-dropdown-panel">
          <div className="ibe-dp-header">
            <button type="button" className="ibe-dp-nav-btn" onClick={() => shiftMonth(-1)}>‹</button>
            <span className="ibe-dp-month-title">{monthLabel}</span>
            <button type="button" className="ibe-dp-nav-btn" onClick={() => shiftMonth(1)}>›</button>
          </div>

          <div className="ibe-dp-weekdays">
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
          </div>

          <div className="ibe-dp-grid">
            {daysGrid.map(({ dateObj, isCurrentMonth }, idx) => {
              dateObj.setHours(0, 0, 0, 0);
              const y = dateObj.getFullYear();
              const m = String(dateObj.getMonth() + 1).padStart(2, "0");
              const d = String(dateObj.getDate()).padStart(2, "0");
              const dateStr = `${y}-${m}-${d}`;

              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const isDisabled = minDateObj && dateObj < minDateObj;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isDisabled}
                  className={`ibe-dp-day-cell ${!isCurrentMonth ? "outside" : ""} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${isDisabled ? "disabled" : ""}`}
                  onClick={() => handleSelectDate(dateObj)}
                >
                  {dateObj.getDate()}
                </button>
              );
            })}
          </div>

          <div className="ibe-dp-footer">
            <button
              type="button"
              className="ibe-dp-today-btn"
              onClick={() => handleSelectDate(new Date())}
            >
              Today
            </button>
            <button
              type="button"
              className="ibe-dp-close-btn"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatLocalDateStr(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function BookingEngine() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);

  const todayDate = new Date();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(todayDate.getDate() + 1);

  const todayStr = formatLocalDateStr(todayDate);
  const tomorrowStr = formatLocalDateStr(tomorrowDate);

  const [checkIn, setCheckIn] = useState(todayStr);
  const [checkOut, setCheckOut] = useState(tomorrowStr);

  const handleCheckInChange = (newCheckInStr) => {
    setCheckIn(newCheckInStr);
    if (!newCheckInStr) return;

    // Always auto-set Check-Out date to newCheckIn + 1 night!
    const d1 = new Date(newCheckInStr + "T00:00:00");
    if (!isNaN(d1.getTime())) {
      const nextDay = new Date(d1);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = formatLocalDateStr(nextDay);
      setCheckOut(nextDayStr);
    }
  };

  const handleCheckOutChange = (newCheckOutStr) => {
    setCheckOut(newCheckOutStr);
    if (!newCheckOutStr) return;

    const d1 = new Date(checkIn + "T00:00:00");
    const d2 = new Date(newCheckOutStr + "T00:00:00");

    if (isNaN(d1.getTime()) || d2 <= d1) {
      const prevDay = new Date(d2);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevDayStr = formatLocalDateStr(prevDay);
      setCheckIn(prevDayStr);
    }
  };
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState(0);

  // Selected Room Category & Addons
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState(new Set());

  const ibeMaxOccupancy = useMemo(() => {
    if (!selectedCategory) return 8;
    return Math.max(1, Number(selectedCategory.maxOccupancy || selectedCategory.occupancy || selectedCategory.maxAdults || 8));
  }, [selectedCategory]);

  const ibeMaxAdults = ibeMaxOccupancy;

  const ibeMaxChildren = useMemo(() => {
    const remainingCap = Math.max(0, ibeMaxOccupancy - adults);
    if (!selectedCategory) return remainingCap;
    const maxChildConfig = selectedCategory.maxChildren !== undefined ? Number(selectedCategory.maxChildren) : 4;
    return Math.min(maxChildConfig, remainingCap);
  }, [selectedCategory, ibeMaxOccupancy, adults]);

  // Guest details form
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [paymentMode, setPaymentMode] = useState("Pay Online");
  const [specialRequests, setSpecialRequests] = useState("");

  // Data state
  const [roomTypes, setRoomTypes] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Confirmed booking state
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  useEffect(() => {
    async function loadInventory() {
      try {
        setLoading(true);
        const [types, rooms, bookings] = await Promise.all([getRoomTypes(), getRooms(), getBookings()]);
        setRoomTypes(types || []);
        setRoomsList(rooms || []);
        setAllBookings(bookings || []);
      } catch (err) {
        console.error("Error loading booking engine inventory:", err);
      } finally {
        setLoading(false);
      }
    }
    loadInventory();
  }, []);

  // Calculate stay nights
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 1;
    const d1 = new Date(checkIn + "T00:00:00");
    const d2 = new Date(checkOut + "T00:00:00");
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [checkIn, checkOut]);

  // Compute available physical rooms per category for selected checkIn to checkOut
  const categoryAvailability = useMemo(() => {
    const map = {};
    (roomTypes || []).forEach((cat) => {
      const targetCatName = String(cat.name || "").toLowerCase().trim();
      
      // Match physical rooms belonging to this category
      let catRooms = roomsList.filter((r) => String(r.type || "").toLowerCase().trim() === targetCatName);
      if (catRooms.length === 0) {
        const keyWords = targetCatName.split(/\s+/).filter((w) => w.length > 3 && !["room", "suite", "night"].includes(w));
        catRooms = roomsList.filter((r) => {
          const rType = String(r.type || "").toLowerCase().trim();
          return keyWords.some((kw) => rType.includes(kw));
        });
      }

      // Filter physical rooms that have NO date conflict
      const freeRooms = catRooms.filter((r) => {
        return !allBookings.some((b) =>
          String(b.room || "").trim() === String(r.no || "").trim() &&
          b.status !== "cancelled" &&
          b.checkIn < checkOut &&
          b.checkOut > checkIn
        );
      });

      map[cat.id] = {
        total: catRooms.length,
        free: freeRooms.length,
        isSoldOut: freeRooms.length === 0,
      };
    });
    return map;
  }, [roomTypes, roomsList, allBookings, checkIn, checkOut]);

  // Dynamic Hotel Profile & Provision Configuration
  const hotelProfile = useMemo(() => getHotelProfile(), []);
  const propertyName = hotelProfile?.propertyName || hotelProfile?.name || "Bhopal Grand Resort";
  const propertyPhone = hotelProfile?.phone || "+1 (800) 555-0199";

  const allRatePlans = useMemo(() => getRatePlans(), []);
  const allAddons = useMemo(() => getHotelAddons(), []);
  const ibeMap = useMemo(() => getBookingEngineRoomDisplays(), []);
  const rootIbeCfg = ibeMap.root || {};

  // Filtered Rate Plans for Booking Engine
  const activeIbeRatePlans = useMemo(() => {
    if (Array.isArray(rootIbeCfg.enabledRatePlanIds) && rootIbeCfg.enabledRatePlanIds.length > 0) {
      const filtered = allRatePlans.filter((p) => rootIbeCfg.enabledRatePlanIds.includes(p.id));
      if (filtered.length > 0) return filtered;
    }
    const filtered = allRatePlans.filter((p) => p.showOnIbe !== false);
    return filtered.length > 0 ? filtered : allRatePlans;
  }, [allRatePlans, rootIbeCfg]);

  // Filtered Addons for Booking Engine
  const availableAddons = useMemo(() => {
    if (Array.isArray(rootIbeCfg.enabledAddonIds) && rootIbeCfg.enabledAddonIds.length > 0) {
      const filtered = allAddons.filter((a) => rootIbeCfg.enabledAddonIds.includes(a.id));
      if (filtered.length > 0) return filtered;
    }
    const filtered = allAddons.filter((a) => a.showOnIbe !== false);
    return filtered.length > 0 ? filtered : allAddons;
  }, [allAddons, rootIbeCfg]);

  // Selected Rate Plan per category state
  const [selectedRatePlanMap, setSelectedRatePlanMap] = useState({});

  const getEffectiveRoomPrice = (cat, planId) => {
    const plan = activeIbeRatePlans.find((p) => p.id === planId || String(p.id) === String(planId)) || activeIbeRatePlans[0];

    // 1. Read configured Rate Plan rate if explicitly specified
    let baseRate = 0;
    if (plan) {
      if (plan.rate !== undefined && plan.rate !== "" && !isNaN(Number(plan.rate))) {
        baseRate = Number(plan.rate);
      } else if (plan.price !== undefined && plan.price !== "" && !isNaN(Number(plan.price))) {
        baseRate = Number(plan.price);
      } else if (plan.baseRate !== undefined && plan.baseRate !== "" && !isNaN(Number(plan.baseRate))) {
        baseRate = Number(plan.baseRate);
      }
    }

    // 2. Fallback to Room Type base price if Rate Plan has no explicit rate
    if (!baseRate || baseRate <= 0) {
      if (cat) {
        if (cat.basePrice !== undefined && cat.basePrice !== "" && !isNaN(Number(cat.basePrice))) {
          baseRate = Number(cat.basePrice);
        } else if (cat.price !== undefined && cat.price !== "" && !isNaN(Number(cat.price))) {
          baseRate = Number(cat.price);
        } else if (cat.baseRate !== undefined && cat.baseRate !== "" && !isNaN(Number(cat.baseRate))) {
          baseRate = Number(cat.baseRate);
        } else if (cat.rate !== undefined && cat.rate !== "" && !isNaN(Number(cat.rate))) {
          baseRate = Number(cat.rate);
        }
      }
    }

    // 3. Clean fallback if unconfigured
    if (!baseRate || baseRate <= 0) {
      baseRate = 49;
    }

    // 4. Calculate Extra Adult / Person & Extra Child Charges if selected adults > defaultAdults
    const defaultAdults = Math.max(Number(cat?.maxAdults || 0), Number(cat?.defaultAdults || 0), 1);
    const extraAdultsCount = Math.max(0, adults - defaultAdults);
    const extraAdultRate = Number(cat?.extraAdultPrice || cat?.extraAdultRate || 0);

    const extraChildrenCount = Math.max(0, children);
    const extraChildRate = Number(cat?.extraChildPrice || cat?.extraChildRate || 0);

    const extraAdultCharge = extraAdultsCount * extraAdultRate;
    const extraChildCharge = extraChildrenCount * extraChildRate;

    const adj = plan ? Number(plan.adjustment || plan.priceAdjustment || 0) : 0;
    const baseWithPlan = Math.max(1, baseRate + adj + extraAdultCharge + extraChildCharge);

    // Dynamic Yield Surge Pricing only if yield management is active
    const availInfo = categoryAvailability[cat?.id] || { total: 1, free: 1 };
    const totalUnits = availInfo.total || 1;
    const occupiedUnits = Math.max(0, totalUnits - (availInfo.free || 0));
    const occPercent = Math.round((occupiedUnits / totalUnits) * 100);

    const yieldRes = calculateYieldPrice(baseWithPlan, occPercent, cat?.id);
    return yieldRes?.adjustedPrice || baseWithPlan;
  };

  function toggleAddon(id) {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleApplyCoupon() {
    if (couponCode.toUpperCase() === "DIRECT15" || couponCode.toUpperCase() === "WELCOME10") {
      setDiscountApplied(15);
    } else {
      alert("Invalid or expired coupon code. Try 'DIRECT15' for 15% off!");
      setDiscountApplied(0);
    }
  }

  // Price calculations
  const priceBreakdown = useMemo(() => {
    if (!selectedCategory) return { base: 0, subtotal: 0, discount: 0, tax: 0, addons: 0, total: 0 };
    const basePerNight = getEffectiveRoomPrice(selectedCategory, selectedRatePlanMap[selectedCategory.id]);
    const roomSubtotal = basePerNight * nights;

    let addonTotal = 0;
    let taxableAddonTotal = 0;
    selectedAddons.forEach((addonId) => {
      const item = availableAddons.find((a) => a.id === addonId || String(a.id) === String(addonId));
      if (item) {
        const itemPrice = Number(item.price || 0);
        const isNightly = item.billingType === "Per Person Per Day" || item.billingType === "Per Night" || item.pricingType === "per_night";
        const calcAmt = isNightly ? itemPrice * Math.max(1, adults + children) * nights : itemPrice;
        addonTotal += calcAmt;

        const isTaxZero = item.taxPercent === 0 || item.taxPercent === "0" || item.taxable === false || item.taxApplicable === false;
        if (!isTaxZero) {
          taxableAddonTotal += calcAmt;
        }
      }
    });

    const discountAmount = Math.round(((roomSubtotal + addonTotal) * discountApplied) / 100);
    const taxableAmount = Math.max(0, roomSubtotal + taxableAddonTotal - discountAmount);
    const taxAmount = Math.round(taxableAmount * 0.12); // 12% GST
    const totalAmount = roomSubtotal + addonTotal - discountAmount + taxAmount;

    return {
      base: basePerNight,
      subtotal: roomSubtotal,
      discount: discountAmount,
      tax: taxAmount,
      addons: addonTotal,
      total: totalAmount,
    };
  }, [selectedCategory, nights, selectedAddons, availableAddons, discountApplied, adults, children, selectedRatePlanMap, activeIbeRatePlans]);

  // Handle Complete Direct Booking
  async function handleCompleteBooking(e) {
    e.preventDefault();
    if (!guestName || !guestEmail || !guestPhone) {
      alert("Please fill in your Name, Email, and Phone Number.");
      return;
    }
    if (!selectedCategory) {
      alert("Please select a room category.");
      return;
    }

    try {
      setSubmitting(true);

      // Fetch latest bookings & rooms to find an unbooked physical room
      const [allBookings, allRooms] = await Promise.all([getBookings(), getRooms()]);
      
      const targetCatName = String(selectedCategory.name || "").toLowerCase().trim();
      
      // 1. Exact or smart fuzzy category rooms matching
      let categoryRooms = allRooms.filter((r) => String(r.type || "").toLowerCase().trim() === targetCatName);
      if (categoryRooms.length === 0) {
        // Match key words (e.g. deluxe, king, ocean, presidential, jacuzzi, single)
        const keyWords = targetCatName.split(/\s+/).filter((w) => w.length > 3 && !["room", "suite", "night"].includes(w));
        categoryRooms = allRooms.filter((r) => {
          const rType = String(r.type || "").toLowerCase().trim();
          return keyWords.some((kw) => rType.includes(kw));
        });
      }
      if (categoryRooms.length === 0) {
        categoryRooms = allRooms;
      }

      // Find the first physical room with NO date conflict
      let physicalRoom = categoryRooms.find((r) => {
        return !allBookings.some((b) =>
          String(b.room || "").trim() === String(r.no || "").trim() &&
          b.status !== "cancelled" &&
          b.checkIn < checkOut &&
          b.checkOut > checkIn
        );
      });

      if (!physicalRoom) {
        physicalRoom = categoryRooms[0] || allRooms[0] || { no: "101" };
      }

      const bookingData = {
        guest: guestName,
        email: guestEmail,
        phone: guestPhone,
        address: guestAddress,
        room: String(physicalRoom.no),
        roomType: physicalRoom.type || selectedCategory.name,
        checkIn,
        checkOut,
        adults: Number(adults),
        children: Number(children),
        nights,
        ratePerNight: priceBreakdown.base,
        subtotal: priceBreakdown.subtotal,
        discountPercent: discountApplied,
        discountAmount: priceBreakdown.discount,
        taxAmount: priceBreakdown.tax,
        totalAmount: priceBreakdown.total,
        advanceAmount: paymentMode === "Pay Online" ? priceBreakdown.total : 0,
        balanceDue: paymentMode === "Pay Online" ? 0 : priceBreakdown.total,
        paymentStatus: paymentMode === "Pay Online" ? "Paid" : "Pending",
        paymentMethod: paymentMode === "Pay Online" ? "Online Credit Card" : "Pay at Hotel",
        status: "confirmed",
        source: "Direct Web Booking Engine",
        notes: `Special Requests: ${specialRequests}`,
      };

      const result = await createBooking(bookingData);
      setConfirmedBooking(result);
      
      // Dispatch live sync event to PMS Front Desk
      window.dispatchEvent(new CustomEvent("pms_bookings_updated", { detail: result }));

      setCurrentStep(4);
    } catch (err) {
      alert(err.message || "Failed to complete reservation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ibe-container">
      {/* Top Luxury Header Bar */}
      <header className="ibe-header">
        <div className="ibe-brand" onClick={() => navigate("/front-desk/calendar")}>
          <span className="ibe-logo-icon">👑</span>
          <div style={{ display: "flex", flexDirection: "column", alignContent: "flex-start" }}>
            <span className="ibe-hotel-name">{propertyName}</span>
            <div className="ibe-rating-stars" style={{ display: "flex", gap: "2px", marginTop: "2px" }}>
              {Array.from({ length: Math.max(1, Math.min(5, Number(hotelProfile?.rating || 5))) }).map((_, idx) => (
                <span key={idx} style={{ color: "#f59e0b", fontSize: "14px" }}>★</span>
              ))}
            </div>
          </div>
        </div>
        <div className="ibe-header-actions">
          <a href={`tel:${propertyPhone}`} className="ibe-contact-link">
            📞 24/7 Concierge: {propertyPhone}
          </a>
        </div>
      </header>

      {/* Multi-Step Progress Tracker */}
      <div className="ibe-stepper-wrap">
        <div className="ibe-stepper">
          <div className={`ibe-step-item ${currentStep >= 1 ? "active" : ""} ${currentStep > 1 ? "completed" : ""}`}>
            <span className="ibe-step-number">1</span>
            <span>Dates &amp; Guests</span>
          </div>
          <div className={`ibe-step-divider ${currentStep > 1 ? "active" : ""}`} />
          <div className={`ibe-step-item ${currentStep >= 2 ? "active" : ""} ${currentStep > 2 ? "completed" : ""}`}>
            <span className="ibe-step-number">2</span>
            <span>Select Room</span>
          </div>
          <div className={`ibe-step-divider ${currentStep > 2 ? "active" : ""}`} />
          <div className={`ibe-step-item ${currentStep >= 3 ? "active" : ""} ${currentStep > 3 ? "completed" : ""}`}>
            <span className="ibe-step-number">3</span>
            <span>Guest Details</span>
          </div>
          <div className={`ibe-step-divider ${currentStep > 3 ? "active" : ""}`} />
          <div className={`ibe-step-item ${currentStep === 4 ? "active completed" : ""}`}>
            <span className="ibe-step-number">4</span>
            <span>Confirmation</span>
          </div>
        </div>
      </div>

      <main className="ibe-main-content">
        {/* STEP 1 & 2: Search Widget & Room Selection */}
        {currentStep <= 2 && (
          <div>
            {/* Search Bar Widget */}
            <div className="ibe-search-card">
              <div className="ibe-search-grid">
                <CustomLuxuryDatePicker
                  label="Check-In Date"
                  selectedDate={checkIn}
                  minDate={todayStr}
                  onChange={(newDate) => handleCheckInChange(newDate)}
                />
                <CustomLuxuryDatePicker
                  label="Check-Out Date"
                  selectedDate={checkOut}
                  minDate={checkIn}
                  onChange={(newDate) => handleCheckOutChange(newDate)}
                />
                <div className="ibe-field-group">
                  <label className="ibe-field-label">Adults</label>
                  <select className="ibe-input" value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
                    {Array.from({ length: ibeMaxAdults }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} Adult{n > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="ibe-field-group">
                  <label className="ibe-field-label">Children</label>
                  <select className="ibe-input" value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                    {Array.from({ length: ibeMaxChildren + 1 }, (_, i) => i).map((n) => (
                      <option key={n} value={n}>{n} Child{n === 1 ? "" : "ren"}</option>
                    ))}
                  </select>
                </div>
                <div className="ibe-field-group">
                  <button className="ibe-btn-primary" onClick={() => setCurrentStep(2)}>
                    🔍 Check Rates
                  </button>
                </div>
              </div>
            </div>

            {/* Room Categories Grid */}
            <div className="ibe-section-title">
              <span>Available Luxury Suites &amp; Rooms ({nights} Night{nights > 1 ? "s" : ""})</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#64748b" }}>
                🔒 Best Rate Guaranteed · Zero Booking Fees
              </span>
            </div>

            {loading ? (
              <p style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Loading live room availability…</p>
            ) : (
              <div className="ibe-room-list">
                {roomTypes.map((cat) => {
                  const availInfo = categoryAvailability[cat.id] || { free: 0, isSoldOut: false };
                  const isSoldOut = availInfo.isSoldOut;

                  const ibeMap = getBookingEngineRoomDisplays();
                  const catCustom = ibeMap[cat.id] || ibeMap[cat.name] || {};

                  const displayImg = catCustom.image || cat.image || "";
                  const displayBadge = isSoldOut ? "🚫 Sold Out for Selected Dates" : (availInfo.free <= 2 ? `⚡ Only ${availInfo.free} Unit${availInfo.free > 1 ? "s" : ""} Left!` : (catCustom.badge || ""));
                  const displayBed = catCustom.bedType || "";
                  const displaySize = catCustom.roomSize || "";
                  const displayDesc = catCustom.description || "";
                  const displayAmenities = (catCustom.amenities && catCustom.amenities.length > 0) ? catCustom.amenities : (cat.amenities || []);

                  return (
                    <div key={cat.id} className={`ibe-room-card ${isSoldOut ? "is-sold-out" : ""}`}>
                      <div className="ibe-room-img-wrap" style={{ background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {displayImg ? (
                          <img
                            src={displayImg}
                            alt={cat.name}
                            className="ibe-room-img"
                          />
                        ) : (
                          <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px" }}>
                            <span style={{ fontSize: "36px", display: "block", marginBottom: "4px" }}>🏨</span>
                            <span style={{ fontSize: "12px", fontWeight: "700" }}>{cat.name}</span>
                          </div>
                        )}

                        {isSoldOut ? (
                          <span className="ibe-badge-tag sold-out" style={{ background: "#ef4444", color: "#ffffff" }}>
                            🚫 Sold Out for Selected Dates
                          </span>
                        ) : availInfo.free <= 2 ? (
                          <span className="ibe-badge-tag urgent" style={{ background: "#f59e0b", color: "#ffffff" }}>
                            ⚡ Only {availInfo.free} Unit{availInfo.free > 1 ? "s" : ""} Left!
                          </span>
                        ) : displayBadge ? (
                          <span className="ibe-badge-tag">{displayBadge}</span>
                        ) : null}
                      </div>

                      <div className="ibe-room-info">
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                            <h3 className="ibe-room-title">{cat.name}</h3>
                            {isSoldOut ? (
                              <span style={{ fontSize: "11.5px", fontWeight: "800", color: "#ef4444", background: "#fef2f2", padding: "3px 10px", borderRadius: "999px", border: "1px solid #fca5a5" }}>
                                🚫 Sold Out
                              </span>
                            ) : (
                              <span style={{ fontSize: "11.5px", fontWeight: "800", color: "#059669", background: "#ecfdf5", padding: "3px 10px", borderRadius: "999px", border: "1px solid #a7f3d0" }}>
                                🟢 {availInfo.free} Available
                              </span>
                            )}
                          </div>
                          <div className="ibe-room-specs">
                            <span>👤 Max {cat.occupancy || catCustom.occupancy || 2} Guests</span>
                            {displaySize && <span>📐 {displaySize}</span>}
                            {displayBed && <span>🛏️ {displayBed}</span>}
                          </div>
                          {displayDesc && (
                            <p style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.5", marginTop: "6px" }}>
                              {displayDesc}
                            </p>
                          )}
                        </div>

                        {displayAmenities.length > 0 && (
                          <div className="ibe-amenity-pills">
                            {displayAmenities.map((amenity, idx) => (
                              <span key={idx} className="ibe-amenity-chip">✓ {amenity}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="ibe-room-pricing-action">
                        {/* Rate Plan Selector */}
                        {activeIbeRatePlans.length > 0 && (
                          <div style={{ marginBottom: "10px", textAlign: "left", width: "100%" }}>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "4px" }}>
                              RATE PLAN:
                            </label>
                            {activeIbeRatePlans.length > 1 ? (
                              <select
                                value={selectedRatePlanMap[cat.id] || activeIbeRatePlans[0]?.id}
                                onChange={(e) => setSelectedRatePlanMap((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                                style={{ padding: "6px 8px", fontSize: "12px", fontWeight: "700", borderRadius: "8px", border: "1.5px solid #cbd5e1", width: "100%", background: "#ffffff", color: "#0f172a" }}
                              >
                                {activeIbeRatePlans.map((rp) => {
                                  const pPrice = getEffectiveRoomPrice(cat, rp.id);
                                  return (
                                    <option key={rp.id} value={rp.id}>
                                      {rp.name} (${pPrice}/night)
                                    </option>
                                  );
                                })}
                              </select>
                            ) : (
                              <div style={{ fontSize: "12px", fontWeight: "800", color: "#1e40af", background: "#eff6ff", padding: "4px 8px", borderRadius: "6px", border: "1px solid #bfdbfe" }}>
                                {activeIbeRatePlans[0]?.name || "Standard Rate Plan"}
                              </div>
                            )}
                          </div>
                        )}

                        {(() => {
                          const curPlanId = selectedRatePlanMap[cat.id] || activeIbeRatePlans[0]?.id;
                          const effectivePrice = getEffectiveRoomPrice(cat, curPlanId);
                          const curPlanObj = activeIbeRatePlans.find((p) => p.id === curPlanId) || activeIbeRatePlans[0];

                          return (
                            <>
                              <div>
                                <span className="ibe-price-amount">${effectivePrice}</span>
                                <span className="ibe-price-unit"> / night</span>
                              </div>
                              <div style={{ fontSize: "11px", color: isSoldOut ? "#94a3b8" : "#059669", fontWeight: "700", marginTop: "2px" }}>
                                {isSoldOut ? "Not Available for Selected Dates" : "Free Cancellation up to 24h"}
                              </div>
                              <button
                                type="button"
                                className={`ibe-select-room-btn ${isSoldOut ? "disabled" : ""}`}
                                disabled={isSoldOut}
                                onClick={() => {
                                  if (isSoldOut) return;
                                  setSelectedCategory({
                                    ...cat,
                                    price: effectivePrice,
                                    selectedRatePlan: curPlanObj ? curPlanObj.name : "Standard Plan"
                                  });
                                  setCurrentStep(3);
                                }}
                                style={{
                                  background: isSoldOut ? "#94a3b8" : undefined,
                                  cursor: isSoldOut ? "not-allowed" : "pointer",
                                  opacity: isSoldOut ? 0.7 : 1,
                                  marginTop: "8px"
                                }}
                              >
                                {isSoldOut ? "Sold Out" : "BOOK →"}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Guest Form & Checkout */}
        {currentStep === 3 && selectedCategory && (
          <div className="ibe-checkout-grid">
            <div>
              {/* Guest Details Card */}
              <div className="ibe-form-card">
                <h3 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "20px" }}>
                  👤 Primary Guest Details
                </h3>
                <form onSubmit={handleCompleteBooking}>
                  <div className="ibe-form-grid-2" style={{ marginBottom: "16px" }}>
                    <div className="ibe-field-group">
                      <label className="ibe-field-label">Full Name *</label>
                      <input
                        type="text"
                        className="ibe-input"
                        placeholder="e.g. Alexander Wright"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="ibe-field-group">
                      <label className="ibe-field-label">Email Address *</label>
                      <input
                        type="email"
                        className="ibe-input"
                        placeholder="alexander@example.com"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="ibe-form-grid-2" style={{ marginBottom: "16px" }}>
                    <div className="ibe-field-group">
                      <label className="ibe-field-label">Phone Number *</label>
                      <input
                        type="tel"
                        className="ibe-input"
                        placeholder="+1 (555) 019-2834"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        required
                      />
                    </div>
                    <div className="ibe-field-group">
                      <label className="ibe-field-label">Address / City</label>
                      <input
                        type="text"
                        className="ibe-input"
                        placeholder="New York, NY"
                        value={guestAddress}
                        onChange={(e) => setGuestAddress(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="ibe-field-group" style={{ marginBottom: "24px" }}>
                    <label className="ibe-field-label">Special Requests (Optional)</label>
                    <textarea
                      className="ibe-input"
                      rows={3}
                      placeholder="e.g. High floor room, late check-in request, anniversary setup..."
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                    />
                  </div>

                  {/* Addons Selection */}
                  <h3 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "16px" }}>
                    🎁 Enhance Your Stay (Optional Add-ons)
                  </h3>
                  <div className="ibe-addons-list" style={{ marginBottom: "28px" }}>
                    {availableAddons.map((addon) => {
                      const isSelected = selectedAddons.has(addon.id);
                      return (
                        <div
                          key={addon.id}
                          className={`ibe-addon-item ${isSelected ? "selected" : ""}`}
                          onClick={() => toggleAddon(addon.id)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <input type="checkbox" checked={isSelected} readOnly />
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: "700" }}>{addon.name}</div>
                              <div style={{ fontSize: "12px", color: "#64748b" }}>{addon.unit}</div>
                            </div>
                          </div>
                          <span style={{ fontSize: "14px", fontWeight: "800", color: "#0284c7" }}>
                            +${addon.price}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Payment Method Options */}
                  <h3 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "16px" }}>
                    💳 Select Payment Option
                  </h3>
                  <div className="ibe-form-grid-2" style={{ marginBottom: "28px" }}>
                    <div
                      className={`ibe-addon-item ${paymentMode === "Pay Online" ? "selected" : ""}`}
                      onClick={() => setPaymentMode("Pay Online")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <input type="radio" checked={paymentMode === "Pay Online"} readOnly />
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: "700" }}>Instant Online Payment</div>
                          <div style={{ fontSize: "11px", color: "#059669" }}>Credit Card / UPI / Instant Deposit</div>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`ibe-addon-item ${paymentMode === "Pay at Hotel" ? "selected" : ""}`}
                      onClick={() => setPaymentMode("Pay at Hotel")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <input type="radio" checked={paymentMode === "Pay at Hotel"} readOnly />
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: "700" }}>Pay Upon Arrival</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>Pay at reception upon check-in</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="ibe-btn-primary"
                    style={{ padding: "16px", fontSize: "16px" }}
                    disabled={submitting}
                  >
                    {submitting ? "Processing Reservation…" : `Confirm & Book (${paymentMode === "Pay Online" ? "Pay Online Now" : "Pay at Hotel"}) →`}
                  </button>
                </form>
              </div>
            </div>

            {/* Price Summary Sidebar Card */}
            <div>
              <div className="ibe-summary-card">
                <h3 style={{ fontSize: "17px", fontWeight: "800", marginBottom: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
                  📋 Booking Summary
                </h3>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>{selectedCategory.name}</div>
                  <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                    📅 {checkIn} to {checkOut} ({nights} Night{nights > 1 ? "s" : ""})
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                    👥 {adults} Adult{adults > 1 ? "s" : ""}{children > 0 ? `, ${children} Child` : ""}
                  </div>
                </div>

                {/* Coupon Input */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  <input
                    type="text"
                    className="ibe-input"
                    placeholder="Coupon Code (e.g. DIRECT15)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: "12px" }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: "8px", padding: "0 12px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                  >
                    Apply
                  </button>
                </div>

                <div className="ibe-summary-line">
                  <span>Room Tariff ({nights} nights)</span>
                  <span>${priceBreakdown.subtotal}</span>
                </div>
                {priceBreakdown.addons > 0 && (
                  <div className="ibe-summary-line">
                    <span>Add-ons</span>
                    <span>+${priceBreakdown.addons}</span>
                  </div>
                )}
                {priceBreakdown.discount > 0 && (
                  <div className="ibe-summary-line" style={{ color: "#059669", fontWeight: "700" }}>
                    <span>Promo Discount ({discountApplied}%)</span>
                    <span>-${priceBreakdown.discount}</span>
                  </div>
                )}
                <div className="ibe-summary-line">
                  <span>Estimated Taxes (12% GST)</span>
                  <span>+${priceBreakdown.tax}</span>
                </div>

                <div className="ibe-summary-line total">
                  <span>Total Payable</span>
                  <span>${priceBreakdown.total}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Confirmation Screen */}
        {currentStep === 4 && confirmedBooking && (
          <div className="ibe-confirmation-card">
            <div className="ibe-success-icon">✓</div>
            <h2 style={{ fontSize: "28px", fontWeight: "900", color: "#0f172a", marginBottom: "8px" }}>
              Reservation Confirmed!
            </h2>
            <p style={{ fontSize: "15px", color: "#64748b" }}>
              Thank you, <strong>{confirmedBooking.guest}</strong>! Your direct booking has been confirmed and synced to our front desk system.
            </p>

            <div className="ibe-booking-ref-box">
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>
                Booking Reference Number
              </div>
              <div className="ibe-ref-code">{confirmedBooking.id.toUpperCase()}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", textOverflow: "ellipsis", margin: "24px 0", textAlign: "left", background: "#f8fafc", padding: "20px", borderRadius: "12px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Suite Reserved</div>
                <div style={{ fontSize: "14px", fontWeight: "800" }}>{confirmedBooking.roomType} (Room {confirmedBooking.room})</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Dates</div>
                <div style={{ fontSize: "14px", fontWeight: "800" }}>{confirmedBooking.checkIn} to {confirmedBooking.checkOut}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Payment Status</div>
                <div style={{ fontSize: "14px", fontWeight: "800", color: confirmedBooking.paymentStatus === "Paid" ? "#059669" : "#d97706" }}>
                  {confirmedBooking.paymentStatus} (${confirmedBooking.totalAmount})
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Source</div>
                <div style={{ fontSize: "14px", fontWeight: "800", color: "#0284c7" }}>Direct Web Engine (0% Commission)</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <button
                className="ibe-btn-primary"
                style={{ width: "auto", padding: "14px 24px" }}
                onClick={() => window.print()}
              >
                🖨️ Print Receipt
              </button>
              <button
                className="ibe-pms-back-btn"
                style={{ background: "#0f172a", color: "#fff", borderColor: "#0f172a", padding: "14px 24px" }}
                onClick={() => {
                  setConfirmedBooking(null);
                  setCurrentStep(1);
                }}
              >
                Book Another Room
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
