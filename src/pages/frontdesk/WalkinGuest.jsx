import { dataStore } from "../../services/dataStore";
import { useEffect, useMemo, useState } from "react";
import "./wailking.css";
import "./createReservation.css";
import "../../components/folioModal.css";

import AIIDScannerModal from "../../components/AIIDScannerModal";
import CameraCaptureModal from "../../components/CameraCaptureModal";
import DigitalSignatureModal from "../../components/DigitalSignatureModal";
import AddCompanyModal from "../../components/AddCompanyModal";
import CustomDatePicker from "../../components/CustomDatePicker";
import { fetchCityStateFromZip } from "../../services/zipLookupService";
import { UNIFIED_PAYMENT_METHODS, getEnabledPaymentMethods } from "../../constants/paymentMethods";
import { getCompanyAccounts, recordCompanyAccountCharge } from "../../services/companyAccounts";
import { checkGuestFlag } from "../../services/flaggedGuests";
import { saveCardForGuest } from "../../services/guestCards";
import { isValidCardNumber, detectCardBrand, isValidCardExpiry, isValidCardCvv, formatCardNumberInput, formatCardExpiryInput } from "../../services/paymentGatewayService";
import {
  getRatePlans,
  getTaxRules,
  getDailyRatesMap,
  getActiveTaxPercent,
  generateNextSequence,
  getBusinessDate,
  getHotelAddons,
  getTaxInclusiveSetting,
  getBusinessSources,
  getRoomsList,
  getRoomTypes,
  isVirtualRoomOrBooking,
  getHotelProfile
} from "../../services/hotelConfig";

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

export const US_CITIES_BY_STATE = {
  "Alabama": ["Birmingham", "Montgomery", "Mobile", "Huntsville", "Tuscaloosa"],
  "Alaska": ["Anchorage", "Fairbanks", "Juneau", "Sitka", "Ketchikan"],
  "Arizona": ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Glendale", "Tempe"],
  "Arkansas": ["Little Rock", "Fort Smith", "Fayetteville", "Springdale", "Jonesboro"],
  "California": ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno", "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Anaheim"],
  "Colorado": ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood", "Thornton", "Arvada"],
  "Connecticut": ["Bridgeport", "Stamford", "New Haven", "Hartford", "Waterbury", "Norwalk"],
  "Delaware": ["Wilmington", "Dover", "Newark", "Middletown", "Smyrna"],
  "Florida": ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Hialeah", "Port St. Lucie", "Cape Coral", "Tallahassee"],
  "Georgia": ["Atlanta", "Augusta", "Columbus", "Macon", "Savannah", "Athens", "Sandy Springs"],
  "Hawaii": ["Honolulu", "Hilo", "Kailua", "Kapolei", "Kaneohe"],
  "Idaho": ["Boise", "Meridian", "Nampa", "Idaho Falls", "Caldwell", "Pocatello"],
  "Illinois": ["Chicago", "Aurora", "Joliet", "Naperville", "Rockford", "Elgin", "Springfield"],
  "Indiana": ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel", "Fishers"],
  "Iowa": ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City"],
  "Kansas": ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka"],
  "Kentucky": ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington"],
  "Louisiana": ["New Orleans", "Baton Rouge", "Shreveport", "Metairie", "Lafayette"],
  "Maine": ["Portland", "Lewiston", "Bangor", "South Portland", "Auburn"],
  "Maryland": ["Baltimore", "Columbia", "Germantown", "Silver Spring", "Waldorf", "Annapolis"],
  "Massachusetts": ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Brockton"],
  "Michigan": ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Lansing", "Ann Arbor"],
  "Minnesota": ["Minneapolis", "St. Paul", "Rochester", "Duluth", "Bloomington", "Brooklyn Park"],
  "Mississippi": ["Jackson", "Gulfport", "Southaven", "Biloxi", "Hattiesburg"],
  "Missouri": ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence"],
  "Montana": ["Billings", "Missoula", "Great Falls", "Bozeman", "Butte"],
  "Nebraska": ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney"],
  "Nevada": ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks"],
  "New Hampshire": ["Manchester", "Nashua", "Concord", "Dover", "Rochester"],
  "New Jersey": ["Newark", "Jersey City", "Paterson", "Elizabeth", "Lakewood", "Edison"],
  "New Mexico": ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell"],
  "New York": ["New York City", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany"],
  "North Carolina": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville"],
  "North Dakota": ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo"],
  "Ohio": ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton"],
  "Oklahoma": ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Lawton"],
  "Oregon": ["Portland", "Salem", "Eugene", "Gresham", "Hillsboro", "Bend"],
  "Pennsylvania": ["Philadelphia", "Pittsburgh", "Allentown", "Reading", "Erie", "Scranton"],
  "Rhode Island": ["Providence", "Cranston", "Warwick", "Pawtucket", "East Providence"],
  "South Carolina": ["Charleston", "Columbia", "North Charleston", "Mount Pleasant", "Rock Hill", "Greenville"],
  "South Dakota": ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown"],
  "Tennessee": ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville", "Murfreesboro"],
  "Texas": ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso", "Arlington", "Corpus Christi", "Plano", "Lubbock"],
  "Utah": ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem", "Sandy"],
  "Vermont": ["Burlington", "South Burlington", "Rutland", "Barre", "Montpelier"],
  "Virginia": ["Virginia Beach", "Chesapeake", "Norfolk", "Richmond", "Newport News", "Alexandria"],
  "Washington": ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kent"],
  "West Virginia": ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling"],
  "Wisconsin": ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton"],
  "Wyoming": ["Cheyenne", "Casper", "Gillette", "Laramie", "Rock Springs"]
};

export const COUNTRY_CODES = [
  { code: "+1", country: "US/CA" },
  { code: "+91", country: "IN" },
  { code: "+44", country: "UK" },
  { code: "+61", country: "AU" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+81", country: "JP" },
  { code: "+86", country: "CN" },
  { code: "+971", country: "UAE" }
];

function todayISO() {
  return getBusinessDate();
}

function parseISOToLocalDate(isoStr) {
  if (!isoStr) return new Date();
  const str = String(isoStr).trim();
  const parts = str.substring(0, 10).split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 0, 0, 0, 0);
    }
  }
  return new Date(str);
}

function formatDateToISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addOneDay(iso) {
  const d = parseISOToLocalDate(iso);
  d.setDate(d.getDate() + 1);
  return formatDateToISO(d);
}

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 1;
  const start = parseISOToLocalDate(checkIn);
  const end = parseISOToLocalDate(checkOut);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

function formatDOBForInput(val) {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) {
    const [m, d, y] = val.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return val;
}

const GUEST_COLORS = ["#3D6FD6", "#2E9E6D", "#C47A1F", "#8A4FD6", "#CF4444"];

export function isValidEmail(email) {
  if (!email || !email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function formatPhoneNumberInput(phoneStr) {
  if (!phoneStr) return "";
  const clean = String(phoneStr).replace(/\D/g, "");
  const digits = (clean.length === 11 && clean.startsWith("1")) ? clean.slice(1) : clean.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export function isValidPhoneNumber(phoneStr) {
  if (!phoneStr || !phoneStr.trim()) return true;
  const clean = String(phoneStr).replace(/\D/g, "");
  const digits = (clean.length === 11 && clean.startsWith("1")) ? clean.slice(1) : clean;
  return digits.length === 10;
}

export function isAddonPerNight(addon) {
  if (!addon) return false;
  if (addon.perNight === true || addon.isPerNight === true) return true;
  const typeStr = String(addon.billingType || addon.pricingType || addon.postingType || addon.type || addon.basis || "").toLowerCase();
  return typeStr.includes("night") || typeStr.includes("daily") || typeStr.includes("per_night");
}

export function findRoomByNumber(rooms, roomNo) {
  if (!roomNo || !Array.isArray(rooms)) return null;
  const target = String(roomNo).trim().toLowerCase();
  return rooms.find((r) => {
    const rNo = String(r.no ?? r.number ?? r.roomNumber ?? r.roomNo ?? r.id ?? "").trim().toLowerCase();
    return rNo === target;
  }) || null;
}

export function findRoomTypeByName(roomTypes, typeName) {
  if (!typeName || !Array.isArray(roomTypes)) return null;
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
    presetRoomObj?.isVirtual ||
    isVirtualRoomOrBooking(roomTypeObj) ||
    isVirtualRoomOrBooking(presetRoomObj)
  ) {
    return 0;
  }
  const val = roomTypeObj?.price ?? roomTypeObj?.basePrice ?? roomTypeObj?.rate ?? roomTypeObj?.baseRate ?? roomTypeObj?.rateUSD ?? presetRoomObj?.price ?? presetRoomObj?.rateUSD ?? presetRoomObj?.baseRate;
  const num = Number(val);
  return !isNaN(num) && num >= 0 ? num : 150;
}

function buildInitialState(initialRoomNo, initialDate, initialCheckOut, initialBooking, rooms = [], roomTypes = []) {
  const actualRooms = Array.isArray(rooms) && rooms.length > 0 ? rooms : getRoomsList();
  const actualRoomTypes = Array.isArray(roomTypes) && roomTypes.length > 0 ? roomTypes : getRoomTypes();

  if (initialBooking) {
    const bookedRoom = findRoomByNumber(actualRooms, initialBooking.room || initialBooking.roomNumber || initialBooking.roomId);
    const guestFull = initialBooking.guest || "";
    const guestParts = guestFull.trim().split(" ");
    const initFirst = guestParts[0] || "";
    const initLast = guestParts.slice(1).join(" ") || "";
    return {
      firstName: initFirst,
      lastName: initLast,
      fullName: guestFull,
      countryCode: "+1",
      phoneNumber: initialBooking.phone || "",
      email: initialBooking.email || "",
      dob: initialBooking.dob || initialBooking.dateOfBirth || "",
      nationality: initialBooking.nationality || "USA",
      country: initialBooking.country || "USA",
      state: initialBooking.state || "California",
      city: initialBooking.city || "Los Angeles",
      idProofType: initialBooking.idType || "US Driver's License",
      idProofNumber: initialBooking.idNumber || "",
      scannedIdUrl: initialBooking.scannedIdUrl || initialBooking.idFront || initialBooking.idDocumentUrl || "",
      scannedImages: Array.isArray(initialBooking.scannedImages) ? initialBooking.scannedImages : [],
      capturedImages: Array.isArray(initialBooking.capturedImages) ? initialBooking.capturedImages : [],
      capturedPhoto: initialBooking.capturedPhoto || "",
      guestPhoto: initialBooking.guestPhoto || initialBooking.photoUrl || initialBooking.capturedPhoto || initialBooking.photo || "",
      digitalSignature: initialBooking.digitalSignature || initialBooking.signature || "",
      signature: initialBooking.digitalSignature || initialBooking.signature || "",
      address: initialBooking.address || "",
      checkInDate: initialBooking.checkIn || todayISO(),
      checkInTime: initialBooking.checkInTime || getHotelProfile()?.checkInTime || "15:00",
      checkOutDate: initialBooking.checkOut || addOneDay(initialBooking.checkIn || todayISO()),
      checkOutTime: initialBooking.checkOutTime || getHotelProfile()?.checkOutTime || "11:00",
      adults: String(initialBooking.adults ?? 2),
      children: String(initialBooking.children ?? 0),
      infants: String(initialBooking.infants ?? 0),
      roomType: initialBooking.roomType || bookedRoom?.type || bookedRoom?.roomType || (actualRoomTypes[0]?.name || ""),
      roomNumber: initialBooking.room || initialBooking.roomNumber || "",
      paymentMethod: initialBooking.paymentMethod || "Card",
      advanceAmount: initialBooking.advanceAmount != null ? String(initialBooking.advanceAmount) : "",
      taxPercent: initialBooking.taxPercent != null ? String(initialBooking.taxPercent) : "12",
      extraCharges: initialBooking.extraCharges != null ? String(initialBooking.extraCharges) : "0",
      notes: initialBooking.notes || "",
      zip: initialBooking.zip || "",
      companyName: initialBooking.companyName || "",
      gstNumber: initialBooking.gstNumber || "",
      cardFirstName: initialBooking.cardFirstName || initialBooking.firstName || (initialBooking.guest ? String(initialBooking.guest).split(" ")[0] : "") || "",
      cardLastName: initialBooking.cardLastName || initialBooking.lastName || (initialBooking.guest ? String(initialBooking.guest).split(" ").slice(1).join(" ") : "") || "",
      cardName: initialBooking.cardName || initialBooking.guest || "",
      cardNumber: initialBooking.cardNumber || "",
      cardExpiry: initialBooking.cardExpiry || "",
      cardCvv: initialBooking.cardCvv || "",
      vehicleMakeModel: initialBooking.vehicleMakeModel || initialBooking.vehicle || "",
      vehiclePlate: initialBooking.vehiclePlate || initialBooking.vehiclePlateNumber || "",
      vehicleColor: initialBooking.vehicleColor || "",
      ratePlan: initialBooking.ratePlan || "Standard Plan",
      source: initialBooking.source || "Walk-In",
      segment: initialBooking.segment || "DIRECT",
      subSegment: initialBooking.subSegment || "WALK-IN",
      discountType: initialBooking.discountType || "USD",
      discountValue: initialBooking.discountValue || "",
      couponCode: initialBooking.couponCode || "",
      remark: initialBooking.remark || "",
    };
  }
  const presetRoom = initialRoomNo ? findRoomByNumber(actualRooms, initialRoomNo) : null;
  const checkIn = initialDate || todayISO();
  let checkOut = initialCheckOut || addOneDay(checkIn);
  if (checkOut <= checkIn) {
    checkOut = addOneDay(checkIn);
  }
  return {
    firstName: "",
    lastName: "",
    fullName: "",
    countryCode: "",
    phoneNumber: "",
    email: "",
    dob: "",
    nationality: "USA",
    country: "USA",
    state: "California",
    city: "Los Angeles",
    idProofType: "US Driver's License",
    idProofNumber: "",
    scannedIdUrl: "",
    scannedImages: [],
    capturedImages: [],
    capturedPhoto: "",
    guestPhoto: "",
    digitalSignature: "",
    signature: "",
    address: "",
    vehicleMakeModel: "",
    vehiclePlate: "",
    vehicleColor: "",
    checkInDate: checkIn,
    checkInTime: getHotelProfile()?.checkInTime || "15:00",
    checkOutDate: checkOut,
    checkOutTime: getHotelProfile()?.checkOutTime || "11:00",
    adults: "2",
    children: "0",
    infants: "0",
    roomType: presetRoom ? (presetRoom.type || presetRoom.roomType || presetRoom.category) : (actualRoomTypes[0]?.name || ""),
    roomNumber: presetRoom ? (presetRoom.no || presetRoom.number || presetRoom.roomNumber || presetRoom.roomNo || presetRoom.id) : (initialRoomNo || ""),
    paymentMethod: "Card",
    companyAccountId: "",
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    advanceAmount: "",
    taxPercent: String(getActiveTaxPercent() || "12"),
    extraCharges: "0",
    notes: "",
    zip: "",
    companyName: "",
    gstNumber: "",
    ratePlan: getRatePlans()[0]?.name || "Daily Rate",
    source: "Walk-In",
    segment: "DIRECT",
    subSegment: "WALK-IN",
    discountType: "USD",
    discountValue: "",
    couponCode: "",
    remark: "",
    isEnquiry: initialBooking?.isEnquiry || initialBooking?.status === "enquiry" || false,
    expiryDate: initialBooking?.expiryDate || checkIn,
    expiryTime: initialBooking?.expiryTime || "18:00",
  };
}

export default function WalkinGuest({
  embedded = false,
  initialRoomNo = "",
  initialDate = "",
  initialCheckOut = "",
  initialBooking = null,
  existingBookings = [],
  rooms = [],
  roomTypes = [],
  onSubmit,
  onCancel,
}) {
  const isEditing = Boolean(initialBooking);
  const [formData, setFormData] = useState(() =>
    buildInitialState(initialRoomNo, initialDate, initialCheckOut, initialBooking, rooms, roomTypes)
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [taxExempt, setTaxExempt] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState(initialBooking?.selectedAddons || []);
  const [collectPayment, setCollectPayment] = useState(false);
  const [showDaySplit, setShowDaySplit] = useState(false);
  const [showDaySplitModal, setShowDaySplitModal] = useState(false);
  const [customNightlyRates, setCustomNightlyRates] = useState(() => initialBooking?.customNightlyRates || {});
  const [rateTouched, setRateTouched] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [rateOverride, setRateOverride] = useState(false);
  const [activeInput, setActiveInput] = useState(null);
  const [totalExTaxInput, setTotalExTaxInput] = useState("");
  const [totalWithTaxInput, setTotalWithTaxInput] = useState("");

  const handleNextStep = (e) => {
    if (e) e.preventDefault();
    setError("");
    if (!formData.firstName?.trim() && !formData.fullName?.trim()) {
      const msg = "Customer First Name is required.";
      setError(msg);
      if (typeof window !== "undefined") window.alert(msg);
      return;
    }
    if (formData.checkOutDate <= formData.checkInDate) {
      const msg = "Check-out date must be after check-in date.";
      setError(msg);
      if (typeof window !== "undefined") window.alert(msg);
      return;
    }
    setCurrentStep(2);
  };
  const [showAIScanner, setShowAIScanner] = useState(false);
  const [activeAIScanTarget, setActiveAIScanTarget] = useState(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraTargetIdx, setCameraTargetIdx] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [companyAccounts, setCompanyAccounts] = useState(() => getCompanyAccounts());
  const [showAdditionalGuests, setShowAdditionalGuests] = useState(() => Boolean(initialBooking?.hasAdditionalGuests || (initialBooking?.additionalGuests && initialBooking.additionalGuests.length > 0)));
  const [additionalGuests, setAdditionalGuests] = useState(() => {
    if (initialBooking?.additionalGuests && Array.isArray(initialBooking.additionalGuests) && initialBooking.additionalGuests.length > 0) {
      return initialBooking.additionalGuests.map((g) => {
        const fn = g.fullName || g.name || "";
        const parts = fn.trim().split(" ");
        return {
          firstName: g.firstName || parts[0] || "",
          lastName: g.lastName || parts.slice(1).join(" ") || "",
          fullName: fn || `${g.firstName || ""} ${g.lastName || ""}`.trim(),
          phone: g.phone || g.phoneNumber || "",
          email: g.email || "",
          address: g.address || "",
          city: g.city || "Los Angeles",
          state: g.state || "California",
          zip: g.zip || g.zipCode || "",
          idType: g.idType || g.idProofType || "US Driver's License",
          idNumber: g.idNumber || g.idProofNumber || ""
        };
      });
    }
    return [{
      firstName: "",
      lastName: "",
      fullName: "",
      phone: "",
      email: "",
      address: "",
      city: "Los Angeles",
      state: "California",
      zip: "",
      idType: "US Driver's License",
      idNumber: ""
    }];
  });
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [flaggedAlert, setFlaggedAlert] = useState(null);
  const [overrideFlag, setOverrideFlag] = useState(false);
  const [showGuestSuggestions, setShowGuestSuggestions] = useState(false);

  const [availableRatePlans, setAvailableRatePlans] = useState(() => getRatePlans());
  const [availableTaxRules, setAvailableTaxRules] = useState(() => getTaxRules());
  const [dailyRatesMap, setDailyRatesMap] = useState(() => getDailyRatesMap());
  const [businessSources, setBusinessSources] = useState(() => getBusinessSources());

  useEffect(() => {
    function handleSync() {
      setDailyRatesMap(getDailyRatesMap());
      setAvailableRatePlans(getRatePlans());
      setAvailableTaxRules(getTaxRules());
      setBusinessSources(getBusinessSources());
    }
    window.addEventListener("pms_daily_rates_updated", handleSync);
    window.addEventListener("pms_rate_plans_updated", handleSync);
    window.addEventListener("pms_business_sources_updated", handleSync);
    return () => {
      window.removeEventListener("pms_daily_rates_updated", handleSync);
      window.removeEventListener("pms_rate_plans_updated", handleSync);
      window.removeEventListener("pms_business_sources_updated", handleSync);
    };
  }, []);

  const currentBusinessSource = useMemo(() => {
    return (
      businessSources.find(
        (b) => b.segment.toUpperCase() === (formData.segment || "").toUpperCase()
      ) || businessSources[0]
    );
  }, [businessSources, formData.segment]);

  const isCorporateSegment = useMemo(() => {
    const seg = (formData.segment || "").toUpperCase();
    return seg.includes("CORPORATE") || seg.includes("COMPANY");
  }, [formData.segment]);

  const availableSubSegments = useMemo(() => {
    if (isCorporateSegment) {
      const companyNames = (companyAccounts || []).map((c) => c.name);
      const configuredSubs = currentBusinessSource?.subSegments || [];
      const combined = Array.from(new Set([...companyNames, ...configuredSubs])).filter(Boolean);
      if (combined.length > 0) {
        return combined;
      }
    }
    return (currentBusinessSource?.subSegments && currentBusinessSource.subSegments.length > 0)
      ? currentBusinessSource.subSegments
      : ["WALK-IN"];
  }, [isCorporateSegment, companyAccounts, currentBusinessSource]);

  const checkInTimeOptions = useMemo(() => {
    const baseList = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];
    const setObj = new Set(baseList);
    if (formData.checkInTime) setObj.add(formData.checkInTime);
    const hp = getHotelProfile();
    if (hp?.checkInTime) setObj.add(hp.checkInTime);

    return Array.from(setObj).sort().map((t) => {
      let label = t;
      const parts = String(t).split(":");
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        const m = parts[1];
        if (!isNaN(h)) {
          const ampm = h >= 12 ? "PM" : "AM";
          h = h % 12 || 12;
          label = `${String(h).padStart(2, "0")}:${m} ${ampm}`;
        }
      }
      return { val: t, label: `🕒 ${label}` };
    });
  }, [formData.checkInTime]);

  const checkOutTimeOptions = useMemo(() => {
    const baseList = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
    const setObj = new Set(baseList);
    if (formData.checkOutTime) setObj.add(formData.checkOutTime);
    const hp = getHotelProfile();
    if (hp?.checkOutTime) setObj.add(hp.checkOutTime);

    return Array.from(setObj).sort().map((t) => {
      let label = t;
      const parts = String(t).split(":");
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        const m = parts[1];
        if (!isNaN(h)) {
          const ampm = h >= 12 ? "PM" : "AM";
          h = h % 12 || 12;
          label = `${String(h).padStart(2, "0")}:${m} ${ampm}`;
        }
      }
      return { val: t, label: `🕒 ${label}` };
    });
  }, [formData.checkOutTime]);

  useEffect(() => {
    if (isCorporateSegment && companyAccounts.length > 0) {
      const matchedComp =
        companyAccounts.find((c) => c.name.toLowerCase() === (formData.subSegment || "").toLowerCase()) ||
        companyAccounts.find((c) => c.id === formData.companyAccountId) ||
        companyAccounts[0];

      if (matchedComp) {
        setFormData((prev) => {
          if (
            prev.companyAccountId !== matchedComp.id ||
            prev.subSegment !== matchedComp.name ||
            prev.companyName !== matchedComp.name ||
            prev.paymentMethod !== "City Ledger"
          ) {
            return {
              ...prev,
              subSegment: matchedComp.name,
              companyAccountId: matchedComp.id,
              companyName: matchedComp.name,
              paymentMethod: "City Ledger"
            };
          }
          return prev;
        });
        if (!collectPayment) {
          setCollectPayment(true);
        }
      }
    }
  }, [isCorporateSegment, companyAccounts, formData.subSegment, formData.companyAccountId, collectPayment]);

  useEffect(() => {
    if (formData.roomNumber && formData.roomNumber !== "Unassigned") {
      const conflict = (existingBookings || []).some(
        (b) =>
          b.room === formData.roomNumber &&
          b.id !== initialBooking?.id &&
          b.status !== "cancelled" &&
          formData.checkInDate < b.checkOut &&
          formData.checkOutDate > b.checkIn
      );
      if (conflict) {
        setFormData((prev) => ({ ...prev, roomNumber: "Unassigned" }));
        setError(`Room ${formData.roomNumber} is unavailable for selected dates. Switched to Unassigned.`);
      }
    }
  }, [formData.roomNumber, formData.checkInDate, formData.checkOutDate, existingBookings, initialBooking]);

  const pastGuestsList = useMemo(() => {
    const list = [];
    const seen = new Set();

    const addGuest = (b) => {
      if (!b) return;
      const name = b.fullName || b.guest || b.name || "";
      if (!name || name.trim().length < 2) return;
      const phone = b.phone || b.phoneNumber || "";
      const key = `${name.trim().toLowerCase()}_${phone.trim()}`;
      if (seen.has(key)) return;
      seen.add(key);

      list.push({
        fullName: name.trim(),
        phone: phone.trim(),
        email: b.email || "",
        address: b.address || "",
        city: b.city || "",
        zipCode: b.zip || b.zipCode || "",
        idType: b.idType || b.idProofType || "US Driver's License",
        idNumber: b.idNumber || b.idProofNumber || "",
        nationality: b.nationality || "USA",
        companyName: b.companyName || "",
        gstNumber: b.gstNumber || ""
      });
    };

    (existingBookings || []).forEach(addGuest);

    try {
      const localB = JSON.parse(dataStore.getItem("pms_bookings") || "[]");
      localB.forEach(addGuest);
      const localP = JSON.parse(dataStore.getItem("pms_guest_profiles") || "[]");
      localP.forEach(addGuest);
    } catch (err) {}

    return list;
  }, [existingBookings]);

  const filteredGuestSuggestions = useMemo(() => {
    const qFirst = (formData.firstName || "").trim().toLowerCase();
    const qLast = (formData.lastName || "").trim().toLowerCase();
    const qFull = (formData.fullName || "").trim().toLowerCase();
    const q = qFirst || qLast || qFull;
    if (!q || q.length < 1) return [];
    return pastGuestsList.filter(
      (g) =>
        (g.fullName && g.fullName.toLowerCase().includes(q)) ||
        (g.phone && g.phone.includes(q)) ||
        (g.email && g.email.toLowerCase().includes(q))
    );
  }, [formData.firstName, formData.lastName, formData.fullName, pastGuestsList]);

  const handleSelectPastGuest = (guest) => {
    const fn = guest.fullName || guest.name || "";
    const parts = fn.trim().split(" ");
    setFormData((prev) => ({
      ...prev,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "",
      fullName: fn,
      phoneNumber: guest.phone || guest.phoneNumber || "",
      email: guest.email || "",
      address: guest.address || "",
      city: guest.city || "",
      zip: guest.zipCode || guest.zip || "",
      idProofType: guest.idType || "US Driver's License",
      idProofNumber: guest.idNumber || "",
      nationality: guest.nationality || prev.nationality,
      companyName: guest.companyName || prev.companyName,
      gstNumber: guest.gstNumber || prev.gstNumber,
    }));
    setShowGuestSuggestions(false);
  };

  useEffect(() => {
    if (formData.fullName && formData.fullName.length >= 3 && !overrideFlag) {
      const matched = checkGuestFlag(formData.fullName, formData.phoneNumber, formData.email);
      if (matched) {
        setFlaggedAlert(matched);
      } else {
        setFlaggedAlert(null);
      }
    } else if (!formData.fullName) {
      setFlaggedAlert(null);
      setOverrideFlag(false);
    }
  }, [formData.fullName, formData.phoneNumber, formData.email, overrideFlag]);

  const effectiveRooms = useMemo(
    () => (Array.isArray(rooms) && rooms.length > 0 ? rooms : getRoomsList()),
    [rooms]
  );
  const effectiveRoomTypes = useMemo(
    () => (Array.isArray(roomTypes) && roomTypes.length > 0 ? roomTypes : getRoomTypes()),
    [roomTypes]
  );

  const [isComplimentary, setIsComplimentary] = useState(Boolean(initialBooking?.isComplimentary));
  const [perNightRate, setPerNightRate] = useState(() => {
    if (initialBooking?.isComplimentary) return "0";
    if (initialBooking?.ratePerNight != null && initialBooking?.ratePerNight !== "" && Number(initialBooking.ratePerNight) > 0) {
      return String(initialBooking.ratePerNight);
    }
    const preset = initialRoomNo ? findRoomByNumber(effectiveRooms, initialRoomNo) : null;
    const targetTypeName = initialBooking?.roomType || preset?.type || preset?.roomType || preset?.category || (effectiveRoomTypes[0]?.name || "");
    const type = findRoomTypeByName(effectiveRoomTypes, targetTypeName);
    return String(getRoomTypePrice(type, preset));
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setError("");
    setSuccess("");

    let formattedValue = value;
    if (name === "cardNumber") {
      formattedValue = formatCardNumberInput(value);
    } else if (name === "cardExpiry") {
      formattedValue = formatCardExpiryInput(value);
    } else if (name === "phoneNumber") {
      formattedValue = formatPhoneNumberInput(value);
    }

    if (name === "fullName" || name === "firstName" || name === "lastName" || name === "phoneNumber" || name === "email") {
      setOverrideFlag(false);
    }
    if (name === "zip" && value) {
      fetchCityStateFromZip(value).then((geo) => {
        if (geo) {
          setFormData((prev) => ({
            ...prev,
            city: geo.city || prev.city,
            state: geo.state || prev.state,
            country: geo.country || prev.country
          }));
        }
      });
    }

    setFormData((prev) => {
      const next = { ...prev, [name]: formattedValue };
      if (name === "firstName" || name === "lastName") {
        const first = name === "firstName" ? value : (prev.firstName || "");
        const last = name === "lastName" ? value : (prev.lastName || "");
        next.fullName = `${first} ${last}`.trim();
      }
      if (name === "cardFirstName" || name === "cardLastName") {
        const cFirst = name === "cardFirstName" ? value : (prev.cardFirstName || "");
        const cLast = name === "cardLastName" ? value : (prev.cardLastName || "");
        next.cardName = `${cFirst} ${cLast}`.trim();
      }
      if (name === "roomType") {
        const stillValid = effectiveRooms.some((r) => {
          const rNo = String(r.no ?? r.number ?? r.roomNumber ?? r.roomNo ?? r.id ?? "").trim().toLowerCase();
          const targetNo = String(prev.roomNumber || "").trim().toLowerCase();
          const rType = String(r.type ?? r.roomType ?? r.category ?? "").trim().toLowerCase();
          return rNo === targetNo && rType === String(value || "").trim().toLowerCase();
        });
        if (!stillValid) next.roomNumber = "";
      }

      if (name === "ratePlan" || name === "checkInDate") {
        const targetRatePlanName = name === "ratePlan" ? value : next.ratePlan;
        const targetCheckInDate = name === "checkInDate" ? value : next.checkInDate;
        const matchedPlan = availableRatePlans.find((p) => p.name === targetRatePlanName);
        let planNights = Number(matchedPlan?.nights);
        if (!planNights || isNaN(planNights)) {
          const nameLower = (targetRatePlanName || "").toLowerCase();
          if (nameLower.includes("week") || matchedPlan?.code === "WR") planNights = 7;
          else if (nameLower.includes("month") || matchedPlan?.code === "MR") planNights = 30;
          else if (nameLower.includes("weekend")) planNights = 2;
          else planNights = 1;
        }

        const inD = parseISOToLocalDate(targetCheckInDate || todayISO());
        const outD = new Date(inD);
        outD.setDate(outD.getDate() + planNights);

        const yyyy = outD.getFullYear();
        const mm = String(outD.getMonth() + 1).padStart(2, "0");
        const dd = String(outD.getDate()).padStart(2, "0");
        next.checkOutDate = `${yyyy}-${mm}-${dd}`;
      }

      if (name === "checkOutDate" && value && next.checkInDate && value <= next.checkInDate) {
        next.checkOutDate = addOneDay(next.checkInDate);
      }

      return next;
    });
  };

  const handleReset = () => {
    setFormData(buildInitialState(initialRoomNo, initialDate, initialCheckOut, initialBooking, effectiveRooms, effectiveRoomTypes));
    setError("");
    setSuccess("");
  };

  const roomsOfType = useMemo(() => {
    const targetType = String(formData.roomType || "").trim().toLowerCase();
    const list = effectiveRooms.filter((r) => {
      const rType = String(r.type ?? r.roomType ?? r.category ?? "").trim().toLowerCase();
      return rType === targetType;
    });
    const inDate = formData.checkInDate;
    const outDate = formData.checkOutDate;
    const currentId = initialBooking?.id;

    if (!inDate || !outDate) return list;

    return list.filter((r) => {
      const rNo = String(r.no ?? r.number ?? r.roomNumber ?? r.roomNo ?? r.id ?? "").trim();
      const hasConflict = (existingBookings || []).some((b) => {
        const st = String(b?.status || "").toLowerCase().trim();
        if (!b || b.id === currentId || st === "cancelled" || st === "enquiry" || st === "inquiry" || st === "group enquiry" || st === "group_enquiry" || b.isEnquiry) return false;
        const bRoom = String(b.room || b.roomNumber || "").trim();
        if (bRoom !== rNo) return false;
        return b.checkIn < outDate && b.checkOut > inDate;
      });
      return !hasConflict;
    });
  }, [effectiveRooms, formData.roomType, formData.checkInDate, formData.checkOutDate, existingBookings, initialBooking]);

  const selectedRoomType = useMemo(
    () => findRoomTypeByName(effectiveRoomTypes, formData.roomType),
    [formData.roomType, effectiveRoomTypes]
  );

  useEffect(() => {
    if (!rateTouched) {
      if (selectedRoomType) {
        setPerNightRate(String(getRoomTypePrice(selectedRoomType, null)));
      } else if (formData.roomNumber) {
        const matchedRoom = findRoomByNumber(effectiveRooms, formData.roomNumber);
        if (matchedRoom) {
          setPerNightRate(String(getRoomTypePrice(null, matchedRoom)));
        }
      }
    }
  }, [formData.roomType, formData.roomNumber, selectedRoomType, rateTouched, effectiveRooms, effectiveRoomTypes]);

  const nights = Math.max(1, nightsBetween(formData.checkInDate, formData.checkOutDate));

  const selectedRatePlanObj = availableRatePlans.find(
    (p) => (p.name || "").toLowerCase().trim() === (formData.ratePlan || "").toLowerCase().trim()
  ) || availableRatePlans[0];
  const planNights = Math.max(1, Number(selectedRatePlanObj?.nights) || 1);
  const planAdjustment = Number(
    selectedRatePlanObj?.adjustment !== undefined && selectedRatePlanObj?.adjustment !== ""
      ? selectedRatePlanObj.adjustment
      : selectedRatePlanObj?.price !== undefined
      ? selectedRatePlanObj.price
      : selectedRatePlanObj?.rate || 100
  );
  const perNightAdjustment = planAdjustment / planNights;

  function getMatrixPrice(roomType, ratePlanName, ratePlanObj, dateStr) {
    if (!roomType || !dateStr) return null;
    const k1 = `${roomType}_${ratePlanName}_${dateStr}`;
    if (dailyRatesMap[k1]?.price !== undefined) return Number(dailyRatesMap[k1].price);

    if (ratePlanObj?.name) {
      const k2 = `${roomType}_${ratePlanObj.name}_${dateStr}`;
      if (dailyRatesMap[k2]?.price !== undefined) return Number(dailyRatesMap[k2].price);
    }
    if (ratePlanObj?.code) {
      const k3 = `${roomType}_${ratePlanObj.code}_${dateStr}`;
      if (dailyRatesMap[k3]?.price !== undefined) return Number(dailyRatesMap[k3].price);
    }

    const keys = Object.keys(dailyRatesMap);
    const targetRpLow = (ratePlanName || "").toLowerCase();

    const matchedKey = keys.find((k) => {
      const parts = k.split("_");
      if (parts.length < 3) return false;
      const [rt, rp, dt] = parts;
      if (rt !== roomType || dt !== dateStr) return false;

      const rpLow = rp.toLowerCase();
      if (targetRpLow.includes("standard") && (rpLow.includes("standard") || rpLow.includes("sta") || rpLow.includes("ep"))) return true;
      if (targetRpLow.includes("week") && rpLow.includes("week")) return true;
      if (targetRpLow.includes("month") && rpLow.includes("month")) return true;
      return rpLow === targetRpLow;
    });

    if (matchedKey && dailyRatesMap[matchedKey]?.price !== undefined) {
      return Number(dailyRatesMap[matchedKey].price);
    }

    return null;
  }

  const stayDailyRates = useMemo(() => {
    if (isComplimentary) return Array(nights).fill(0);

    const rates = [];
    const start = parseISOToLocalDate(formData.checkInDate || todayISO());
    const defaultFallbackRate = perNightAdjustment > 0 ? perNightAdjustment : getRoomTypePrice(selectedRoomType, null);

    const defaultAdults = Math.max(Number(selectedRoomType?.maxAdults || 0), Number(selectedRoomType?.defaultAdults || 0), 1);
    const adultsCount = Number(formData.adults) || 1;
    const extraAdultsCount = Math.max(0, adultsCount - defaultAdults);
    const extraAdultRate = Number(selectedRoomType?.extraPersonRate || selectedRoomType?.extraAdultPrice || selectedRoomType?.extraAdultRate || 0);
    const extraAdultChargePerNight = extraAdultsCount * extraAdultRate;

    for (let i = 0; i < nights; i++) {
      if (customNightlyRates[i] !== undefined && customNightlyRates[i] !== null && customNightlyRates[i] !== "") {
        rates.push(Number(customNightlyRates[i]));
        continue;
      }

      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const matrixPrice = getMatrixPrice(formData.roomType, formData.ratePlan, selectedRatePlanObj, dateStr);

      let baseNightPrice = defaultFallbackRate;
      if ((rateOverride || rateTouched) && perNightRate !== "" && perNightRate !== null && !isNaN(Number(perNightRate))) {
        baseNightPrice = Number(perNightRate);
      } else if (matrixPrice !== null && matrixPrice !== undefined) {
        baseNightPrice = matrixPrice;
      } else if (perNightRate !== "" && perNightRate !== null && !isNaN(Number(perNightRate)) && Number(perNightRate) > 0) {
        baseNightPrice = Number(perNightRate);
      }
      rates.push(baseNightPrice + extraAdultChargePerNight);
    }
    return rates;
  }, [formData.checkInDate, formData.roomType, formData.ratePlan, formData.adults, nights, isComplimentary, perNightAdjustment, selectedRoomType, selectedRatePlanObj, dailyRatesMap, rateTouched, rateOverride, perNightRate, customNightlyRates]);

  const handleNightRateChange = (index, val) => {
    const nextRates = { ...customNightlyRates, [index]: val };
    setCustomNightlyRates(nextRates);
    setRateOverride(true);
    setRateTouched(true);

    let sum = 0;
    const start = parseISOToLocalDate(formData.checkInDate || todayISO());
    const defaultFallbackRate = perNightAdjustment > 0 ? perNightAdjustment : getRoomTypePrice(selectedRoomType, null);
    for (let i = 0; i < nights; i++) {
      if (nextRates[i] !== undefined && nextRates[i] !== null && nextRates[i] !== "") {
        sum += Number(nextRates[i]);
      } else {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const matrixPrice = getMatrixPrice(formData.roomType, formData.ratePlan, selectedRatePlanObj, dateStr);
        sum += (matrixPrice !== null && matrixPrice !== undefined) ? matrixPrice : defaultFallbackRate;
      }
    }
    setPerNightRate((sum / nights).toFixed(2));
  };

  const handleResetNightlyRates = () => {
    setCustomNightlyRates({});
  };

  const rawSubtotal = useMemo(() => {
    if (isComplimentary) return 0;
    const sum = stayDailyRates.reduce((acc, r) => acc + r, 0);
    return Math.round(sum * 100) / 100;
  }, [stayDailyRates, isComplimentary]);

  const discountNum = Number(formData.discountValue) || 0;
  const discountAmount = useMemo(() => {
    if (isComplimentary || discountNum <= 0) return 0;
    if (formData.discountType === "PERCENT") {
      return Math.round(((rawSubtotal * discountNum) / 100) * 100) / 100;
    }
    return Math.round(Math.min(rawSubtotal, discountNum) * 100) / 100;
  }, [rawSubtotal, discountNum, formData.discountType, isComplimentary]);

  const maxOccupancyVal = useMemo(() => {
    if (!selectedRoomType) return 6;
    const occ = Number(selectedRoomType.maxOccupancy || selectedRoomType.occupancy || selectedRoomType.maxAdults || 6);
    return Math.max(1, occ);
  }, [selectedRoomType]);

  const adultOptionsCount = maxOccupancyVal;

  const childrenOptionsCount = useMemo(() => {
    const adultsCount = Number(formData.adults) || 1;
    const remainingCap = Math.max(0, maxOccupancyVal - adultsCount);
    if (!selectedRoomType) return remainingCap;
    const maxChildConfig = selectedRoomType.maxChildren !== undefined ? Number(selectedRoomType.maxChildren) : 4;
    return Math.min(maxChildConfig, remainingCap);
  }, [selectedRoomType, maxOccupancyVal, formData.adults]);

  const infantsOptionsCount = useMemo(() => {
    const adultsCount = Number(formData.adults) || 1;
    const childrenCount = Number(formData.children) || 0;
    const remainingCap = Math.max(0, maxOccupancyVal - (adultsCount + childrenCount));
    if (!selectedRoomType) return remainingCap;
    const maxInfantConfig = selectedRoomType.maxInfants !== undefined ? Number(selectedRoomType.maxInfants) : 3;
    return Math.min(maxInfantConfig, remainingCap);
  }, [selectedRoomType, maxOccupancyVal, formData.adults, formData.children]);

  // Auto-clamp selected adults, children, and infants when room type or adult/child counts change
  useEffect(() => {
    const curAdults = Number(formData.adults) || 1;
    const curChildren = Number(formData.children) || 0;
    const curInfants = Number(formData.infants) || 0;

    let nextAdults = curAdults;
    let nextChildren = curChildren;
    let nextInfants = curInfants;

    if (curAdults > adultOptionsCount) nextAdults = adultOptionsCount;
    if (curChildren > childrenOptionsCount) nextChildren = childrenOptionsCount;
    if (curInfants > infantsOptionsCount) nextInfants = infantsOptionsCount;

    if (nextAdults !== curAdults || nextChildren !== curChildren || nextInfants !== curInfants) {
      setFormData((prev) => ({
        ...prev,
        adults: String(nextAdults),
        children: String(nextChildren),
        infants: String(nextInfants),
      }));
    }
  }, [adultOptionsCount, childrenOptionsCount, infantsOptionsCount, formData.adults, formData.children, formData.infants]);

  const netSubtotal = Math.max(0, Math.round((rawSubtotal - discountAmount) * 100) / 100);

  const grossRatePerNight = useMemo(() => {
    if (nights <= 0 || isComplimentary) return 0;
    return Math.round((rawSubtotal / nights) * 100) / 100;
  }, [rawSubtotal, nights, isComplimentary]);

  const ratePerNight = grossRatePerNight;

  const calculatedTaxDetails = useMemo(() => {
    if (taxExempt || isComplimentary) return { taxAmount: 0, pctRate: 0 };
    const activeRules = availableTaxRules.filter((r) => r.status === "Active" || r.status === "active");
    if (activeRules.length === 0) return { taxAmount: 0, pctRate: 0 };

    let totalPct = 0;
    let sumTaxes = 0;

    activeRules.forEach((rule) => {
      if (rule.taxType === "fixed") {
        const fixedVal = Number(rule.fixedAmount || rule.amount || 0);
        const isPerStay = rule.fixedCalculation === "per_stay";
        sumTaxes += isPerStay ? fixedVal : (fixedVal * nights);
      } else {
        const pct = Number(rule.percent !== undefined ? rule.percent : rule.percentage !== undefined ? rule.percentage : 0);
        totalPct += pct;
        sumTaxes += (netSubtotal * pct / 100);
      }
    });

    return {
      taxAmount: Math.round(sumTaxes * 100) / 100,
      pctRate: Math.round(totalPct * 100) / 100
    };
  }, [availableTaxRules, taxExempt, isComplimentary, netSubtotal, nights]);

  const activeTaxRate = calculatedTaxDetails.pctRate;
  const isTaxInclusiveMode = typeof getTaxInclusiveSetting === "function" ? getTaxInclusiveSetting() : false;

  const addonsTotalCost = useMemo(() => {
    return (selectedAddons || []).reduce((acc, addon) => {
      const price = Number(addon.price || addon.amount || 0);
      return acc + (isAddonPerNight(addon) ? price * nights : price);
    }, 0);
  }, [selectedAddons, nights]);

  const extraChargesValue = (Number(formData.extraCharges) || 0) + addonsTotalCost;

  let taxAmount = 0;
  let totalAmount = 0;

  if (isComplimentary || taxExempt) {
    taxAmount = 0;
    totalAmount = Math.round((netSubtotal + extraChargesValue) * 100) / 100;
  } else {
    taxAmount = calculatedTaxDetails.taxAmount;
    totalAmount = Math.round((netSubtotal + taxAmount + extraChargesValue) * 100) / 100;
  }
  const advanceValue = collectPayment ? (Number(formData.advanceAmount) || totalAmount) : (Number(formData.advanceAmount) || 0);
  const balanceDue = Math.max(Math.round((totalAmount - advanceValue) * 100) / 100, 0);
  const paymentStatus = advanceValue <= 0 ? "Pending" : advanceValue >= totalAmount ? "Paid" : "Partial";

  useEffect(() => {
    if (collectPayment && !formData.advanceAmount) {
      setFormData((prev) => ({ ...prev, advanceAmount: String(totalAmount) }));
    }
  }, [collectPayment, totalAmount, formData.advanceAmount]);

  const handleSubmit = async (e, overrideStatus) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (!formData.firstName?.trim() && !formData.fullName?.trim()) {
        const msg = "Customer First Name is required.";
        setError(msg);
        if (typeof window !== "undefined") window.alert(msg);
        return;
      }
      if (formData.checkOutDate <= formData.checkInDate) {
        const msg = "Check-out date must be after check-in date.";
        setError(msg);
        if (typeof window !== "undefined") window.alert(msg);
        return;
      }

      if (formData.roomNumber && formData.roomNumber !== "Unassigned") {
        const normTarget = String(formData.roomNumber || "").replace(/^Room\s+/i, "").trim().toLowerCase();
        const conflict = existingBookings.some((b) => {
          const normB = String(b.room || "").replace(/^Room\s+/i, "").trim().toLowerCase();
          return (
            normB === normTarget &&
            b.id !== initialBooking?.id &&
            b.status !== "cancelled" &&
            formData.checkInDate < b.checkOut &&
            formData.checkOutDate > b.checkIn
          );
        });
        if (conflict) {
          const msg = `Room ${formData.roomNumber} is already booked for an overlapping date range.`;
          setError(msg);
          if (typeof window !== "undefined") window.alert(msg);
          return;
        }
      }

      const today = todayISO();
      const isPast = (formData.checkInDate && formData.checkInDate < today) || (formData.checkOutDate && formData.checkOutDate <= today);
      const isToday = formData.checkInDate === today || (formData.checkInDate <= today && formData.checkOutDate > today);
      const isEnquiryMode = !isPast && Boolean(formData.isEnquiry);

      const finalStatus =
        isEnquiryMode
          ? "enquiry"
          : overrideStatus ||
            (initialBooking?.status && initialBooking.status !== "enquiry"
              ? initialBooking.status
              : isPast
              ? "checked-out"
              : isToday
              ? "checked-in"
              : "confirmed");

      const fullPhone = formData.phoneNumber.trim();

      const pmLower = String(formData.paymentMethod || '').toLowerCase();
      const isSecurityDepositMethod =
        formData.collectionPurpose === 'security_deposit' ||
        pmLower.includes('deposit') ||
        pmLower.includes('security') ||
        Boolean(formData.isSecurityDeposit);
      const isDepositTaken = collectPayment && isSecurityDepositMethod;
      const depAmtVal = isSecurityDepositMethod ? (advanceValue > 0 ? advanceValue : 50) : 0;

      const initialDeposits = [];
      if (isDepositTaken && depAmtVal > 0) {
        const pMode = formData.paymentMethod || 'Cash';
        initialDeposits.push({
          id: `dep_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          amount: depAmtVal,
          amountUSD: depAmtVal,
          date: today,
          status: 'held',
          mode: pMode,
          method: pMode,
          note: formData.remark.trim() || 'Security Deposit Collected at Booking',
          createdAt: new Date().toISOString()
        });
      }

      const initialPayments = [];
      if (collectPayment && advanceValue > 0 && !isSecurityDepositMethod) {
        initialPayments.push({
          id: `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          date: today,
          amount: advanceValue,
          amountUSD: advanceValue,
          mode: formData.paymentMethod,
          method: formData.paymentMethod,
          description: formData.remark.trim() || 'Initial payment at check-in',
          notes: formData.remark.trim() || 'Initial payment at check-in',
          category: 'Payment'
        });
      }

      const bookingRecord = {
        id: initialBooking?.id || generateNextSequence("booking"),
        status: finalStatus,
        isEnquiry: Boolean(formData.isEnquiry),
        expiryDate: formData.isEnquiry ? (formData.expiryDate || formData.checkInDate) : undefined,
        expiryTime: formData.isEnquiry ? (formData.expiryTime || "18:00") : undefined,
        guest: formData.fullName.trim(),
        phone: fullPhone,
        email: formData.email.trim(),
        dob: (formData.dob || "").trim(),
        dateOfBirth: (formData.dob || "").trim(),
        idType: formData.idProofType,
        idNumber: formData.idProofNumber.trim(),
        scannedIdUrl: formData.scannedIdUrl || initialBooking?.scannedIdUrl || initialBooking?.idFront || initialBooking?.idDocumentUrl || "",
        idFront: formData.scannedIdUrl || initialBooking?.idFront || initialBooking?.idDocumentUrl || "",
        idDocumentUrl: formData.scannedIdUrl || initialBooking?.idDocumentUrl || initialBooking?.idFront || "",
        scannedImages: (Array.isArray(formData.scannedImages) && formData.scannedImages.length > 0)
          ? formData.scannedImages
          : (formData.scannedIdUrl ? [{
              id: `scan_${Date.now()}`,
              title: `${formData.idProofType || "Identity Document"} - Front`,
              idType: formData.idProofType || "US Driver's License",
              idNumber: formData.idProofNumber || "Verified",
              url: formData.scannedIdUrl,
              scannedAt: new Date().toISOString(),
              source: "AI ID Scanner"
            }] : (initialBooking?.scannedImages || [])),
        capturedImages: (Array.isArray(formData.capturedImages) && formData.capturedImages.length > 0)
          ? formData.capturedImages
          : (formData.capturedPhoto || formData.guestPhoto ? [{
              id: `cap_${Date.now()}`,
              title: "Guest Check-In Photo",
              url: formData.capturedPhoto || formData.guestPhoto,
              capturedAt: new Date().toISOString(),
              source: "Front Desk HD Webcam",
              resolution: "1920x1080"
            }] : (initialBooking?.capturedImages || [])),
        guestPhoto: formData.guestPhoto || initialBooking?.guestPhoto || initialBooking?.photoUrl || initialBooking?.capturedPhoto || initialBooking?.photo,
        photoUrl: formData.guestPhoto || initialBooking?.photoUrl || initialBooking?.guestPhoto || initialBooking?.capturedPhoto || initialBooking?.photo,
        capturedPhoto: formData.guestPhoto || formData.capturedPhoto || initialBooking?.capturedPhoto || initialBooking?.guestPhoto,
        digitalSignature: formData.digitalSignature || formData.signature || initialBooking?.digitalSignature || initialBooking?.signature || "",
        signature: formData.digitalSignature || formData.signature || initialBooking?.digitalSignature || initialBooking?.signature || "",
        signatureOnFile: Boolean(formData.digitalSignature || formData.signature || initialBooking?.digitalSignature || initialBooking?.signature),
        address: formData.address.trim(),
        room: formData.roomNumber || "Unassigned",
        roomType: formData.roomType,
        checkIn: formData.checkInDate,
        checkInTime: formData.checkInTime,
        checkOut: formData.checkOutDate,
        checkOutTime: formData.checkOutTime,
        adults: Number(formData.adults),
        children: Number(formData.children),
        infants: Number(formData.infants),
        isComplimentary: Boolean(isComplimentary),
        ratePerNight: grossRatePerNight,
        grossRatePerNight,
        baseRatePerNight: grossRatePerNight,
        nights,
        subtotal: rawSubtotal,
        netSubtotal,
        isTaxExempt: Boolean(taxExempt),
        taxExempt: Boolean(taxExempt),
        exemptTaxScope: formData.exemptTaxScope || "all",
        taxExemptReason: formData.taxExemptReason || "",
        taxPercent: activeTaxRate,
        taxAmount,
        extraCharges: extraChargesValue,
        totalAmount,
        advanceAmount: isSecurityDepositMethod ? 0 : advanceValue,
        advancePaymentDate: today,
        bookingDate: today,
        createdAt: new Date().toISOString(),
        payments: initialPayments,
        deposits: initialDeposits,
        securityDeposits: initialDeposits,
        depositAmount: initialDeposits.length > 0 ? depAmtVal : (isSecurityDepositMethod ? (initialBooking?.depositAmount || 0) : 0),
        depositBalance: initialDeposits.length > 0 ? depAmtVal : (isSecurityDepositMethod ? (initialBooking?.depositBalance || 0) : 0),
        depositMode: 'Cash',
        depositMethod: 'Cash',
        depositStatus: initialDeposits.length > 0 ? 'held' : (isSecurityDepositMethod ? (initialBooking?.depositStatus || undefined) : undefined),
        securityDepositCollected: initialDeposits.length > 0,
        hasDeposit: initialDeposits.length > 0,
        balanceDue: isSecurityDepositMethod ? totalAmount : balanceDue,
        paymentMethod: formData.paymentMethod,
        paymentStatus: isSecurityDepositMethod ? 'Pending' : paymentStatus,
        notes: formData.notes.trim(),
        country: (formData.country || "United States").trim(),
        guestCountry: (formData.country || "United States").trim(),
        state: (formData.state || "").trim(),
        guestState: (formData.state || "").trim(),
        city: formData.city.trim(),
        guestCity: formData.city.trim(),
        zip: formData.zip.trim(),
        guestZip: formData.zip.trim(),
        companyName: formData.companyName.trim(),
        gstNumber: formData.gstNumber.trim(),
        ratePlan: formData.ratePlan,
        segment: formData.segment,
        subSegment: formData.subSegment,
        discountType: formData.discountType,
        discountValue: formData.discountValue,
        discountAmount,
        couponCode: formData.couponCode,
        vehicleMakeModel: (formData.vehicleMakeModel || "").trim(),
        vehiclePlate: (formData.vehiclePlate || "").trim(),
        vehicleColor: (formData.vehicleColor || "").trim(),
        hasAdditionalGuests: Boolean(showAdditionalGuests),
        additionalGuests: showAdditionalGuests ? additionalGuests.filter((g) => g.fullName.trim()) : [],
        remark: formData.remark.trim(),
        color: initialBooking?.color || GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)],
        source: initialBooking?.source || "Walk-In",
        extras: (selectedAddons || []).map((ad, idx) => ({
          id: ad.id || `ext_${idx + 1}_${Date.now()}`,
          name: ad.name || ad.label || ad.title || `Addon #${idx + 1}`,
          label: ad.name || ad.label || ad.title || `Addon #${idx + 1}`,
          price: Number(ad.price || ad.amount || 0),
          amount: Number(ad.price || ad.amount || 0),
          amountUSD: Number(ad.price || ad.amount || 0),
          category: 'Addon / Extra Charge',
          billingType: ad.billingType || ad.pricingType || 'Per Night',
          pricingType: ad.pricingType || ad.billingType || 'per_night',
          taxPercent: ad.taxPercent !== undefined ? ad.taxPercent : 0,
          taxable: ad.taxable !== undefined ? ad.taxable : (ad.taxPercent && Number(ad.taxPercent) > 0),
          taxApplicable: ad.taxApplicable !== undefined ? ad.taxApplicable : (ad.taxPercent && Number(ad.taxPercent) > 0)
        })),
        addons: selectedAddons || [],
        cardName: formData.cardName || formData.fullName.trim(),
        cardNumber: formData.cardNumber || "",
        cardExpiry: formData.cardExpiry || "",
        cardCvv: formData.cardCvv || "",
      };

      if (formData.cardNumber || formData.cardName || ["Card", "CREDIT CARD", "DEBIT CARD", "OFFLINE CARD PAYMENT"].includes(formData.paymentMethod?.toUpperCase())) {
        saveCardForGuest({
          guestName: formData.fullName.trim(),
          cardName: formData.cardName || formData.fullName.trim(),
          cardNumber: formData.cardNumber || "4532891024811152",
          cardExpiry: formData.cardExpiry || "10/29",
        });
      }

      const payMethod = String(formData.paymentMethod || "").toUpperCase();
      if (payMethod.includes("CITY LEDGER") || payMethod.includes("COMPANY") || payMethod.includes("HOUSE ACCOUNT") || payMethod.includes("DIRECT BILL") || String(formData.segment || "").toUpperCase().includes("COMPANY")) {
        const compTarget = formData.companyAccountId || formData.companyName || formData.subSegment;
        const billedAmt = Number(bookingRecord.balanceDue !== undefined ? bookingRecord.balanceDue : bookingRecord.totalAmount);
        if (compTarget && billedAmt > 0) {
          recordCompanyAccountCharge(compTarget, billedAmt);
        }
      }

      if (onSubmit) {
        await onSubmit(bookingRecord);
        return;
      }

      setSuccess(
        isEditing
          ? `Booking updated for ${bookingRecord.guest} in Room ${bookingRecord.room}.`
          : `Booking confirmed for ${bookingRecord.guest} in Room ${bookingRecord.room}.`
      );
      if (!isEditing) setFormData(buildInitialState(undefined, undefined, undefined, rooms, roomTypes));
    } catch (err) {
      console.error("Booking submit error:", err);
      const msg = err?.message || "An unexpected error occurred during submission.";
      setError(msg);
      if (typeof window !== "undefined") window.alert(msg);
    }
  };

  return (
    <div className={embedded ? "walkin-container walkin-embedded" : "walkin-container"}>
      <AIIDScannerModal
        isOpen={showAIScanner}
        onClose={() => {
          setShowAIScanner(false);
          setActiveAIScanTarget(null);
        }}
        onScanComplete={(scanned) => {
          const sFirst = scanned.firstName || (scanned.fullName ? scanned.fullName.split(" ")[0] : "");
          const sLast = scanned.lastName || (scanned.fullName ? scanned.fullName.split(" ").slice(1).join(" ") : "");
          const sFull = scanned.fullName || `${sFirst} ${sLast}`.trim();
          const sDOB = formatDOBForInput(scanned.dob || scanned.dateOfBirth);

          const fullDocUrl = scanned.fullScanPhoto || scanned.scannedIdUrl || scanned.idFront || scanned.photo;

          const newScannedDoc = fullDocUrl ? {
            id: `scan_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            title: scanned.title || `${scanned.type || "Identity Document"} - Front`,
            idType: scanned.type || "US Driver's License",
            idNumber: scanned.idProofNumber || "Verified",
            url: fullDocUrl,
            scannedAt: new Date().toISOString(),
            source: scanned.scanSource || "AI ID Scanner"
          } : null;

          if (activeAIScanTarget === null) {
            setFormData((prev) => {
              const existingScanned = Array.isArray(prev.scannedImages) ? prev.scannedImages : [];
              const updatedScanned = newScannedDoc ? [newScannedDoc, ...existingScanned.filter(d => d.url !== fullDocUrl)] : existingScanned;
              return {
                ...prev,
                firstName: sFirst || prev.firstName,
                lastName: sLast || prev.lastName,
                fullName: sFull || prev.fullName,
                email: scanned.email || prev.email,
                phoneNumber: scanned.phoneNumber || prev.phoneNumber,
                dob: sDOB || prev.dob,
                address: scanned.address || prev.address,
                city: scanned.city || prev.city,
                zip: scanned.zip || prev.zip,
                idProofType: scanned.type || prev.idProofType,
                idProofNumber: scanned.idProofNumber || prev.idProofNumber,
                scannedIdUrl: fullDocUrl || prev.scannedIdUrl,
                scannedImages: updatedScanned,
              };
            });
          } else {
            const targetIdx = activeAIScanTarget;
            setAdditionalGuests((prev) =>
              prev.map((g, idx) => {
                if (idx !== targetIdx) return g;
                return {
                  ...g,
                  firstName: sFirst || g.firstName,
                  lastName: sLast || g.lastName,
                  fullName: sFull || g.fullName,
                  phone: scanned.phoneNumber || g.phone,
                  email: scanned.email || g.email,
                  dob: sDOB || g.dob || "",
                  address: scanned.address || g.address,
                  city: scanned.city || g.city || "Los Angeles",
                  state: scanned.state || g.state || "California",
                  zip: scanned.zip || g.zip,
                  idType: scanned.type || g.idType || "US Driver's License",
                  idNumber: scanned.idProofNumber || g.idNumber
                };
              })
            );
          }
          setActiveAIScanTarget(null);
          setShowAIScanner(false);
        }}
      />

      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => {
          setShowCameraModal(false);
          setCameraTargetIdx(null);
        }}
        onCapture={(photoDataUrl) => {
          const newCapturedDoc = {
            id: `cap_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            title: "Guest Check-In Photo",
            url: photoDataUrl,
            capturedAt: new Date().toISOString(),
            source: "Front Desk HD Webcam",
            resolution: "1920x1080"
          };

          if (cameraTargetIdx === null) {
            setFormData((prev) => {
              const existingCaptured = Array.isArray(prev.capturedImages) ? prev.capturedImages : [];
              const updatedCaptured = [newCapturedDoc, ...existingCaptured.filter(d => d.url !== photoDataUrl)];
              return {
                ...prev,
                guestPhoto: photoDataUrl,
                photoUrl: photoDataUrl,
                capturedPhoto: photoDataUrl,
                capturedImages: updatedCaptured
              };
            });
          } else {
            const idx = cameraTargetIdx;
            setAdditionalGuests((prev) =>
              prev.map((g, i) => (i === idx ? { ...g, guestPhoto: photoDataUrl } : g))
            );
          }
          setShowCameraModal(false);
          setCameraTargetIdx(null);
        }}
        guestName={cameraTargetIdx === null ? formData.fullName : (additionalGuests[cameraTargetIdx]?.fullName || "")}
      />

      <DigitalSignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        initialSignature={formData.digitalSignature || formData.signature}
        onSaveSignature={(sigDataUrl) => {
          setFormData((prev) => ({
            ...prev,
            digitalSignature: sigDataUrl,
            signature: sigDataUrl
          }));
        }}
      />

      {!embedded && (
        <header className="walkin-header" style={{ marginBottom: 16 }}>
          <div className="logo-section">
            <div className="key-logo">
              <span className="key-icon">🔑</span>
              <span className="brand-inn">Inn</span>
              <span className="brand-out">Out</span>
            </div>
          </div>
          <div className="header-title">
            <div className="title-top">
              <span className="walk-icon">🚶</span>
              <h1>{isEditing ? "Edit Guest Booking" : "Create Reservation & Walk-In"}</h1>
            </div>
            <p className="subtitle">{isEditing ? "Update guest stay details" : "Single-step guest booking & instant check-in"}</p>
          </div>
        </header>
      )}

      {flaggedAlert && (
        <div style={{
          background: "#fef2f2",
          border: "2px solid #ef4444",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 16,
          boxShadow: "0 4px 14px rgba(239,68,68,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <strong style={{ color: "#b91c1c", fontSize: 14, fontWeight: 900 }}>
                FLAGGED GUEST DETECTED
              </strong>
            </div>
            <span className="badge" style={{ background: "#b91c1c", color: "#ffffff", fontWeight: 900, fontSize: 11, padding: "3px 10px", borderRadius: 8 }}>
              ⚠️ {flaggedAlert.category?.toUpperCase() || "FLAGGED"}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#7f1d1d", fontWeight: 700, marginBottom: 8 }}>
            Matching Profile: <strong>{flaggedAlert.guestName}</strong> — "{flaggedAlert.reason || "High priority system alert."}"
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-lg-grey"
              onClick={() => {
                setFormData((prev) => ({ ...prev, fullName: "", phoneNumber: "", email: "" }));
                setFlaggedAlert(null);
              }}
              style={{ background: "#fee2e2", color: "#991b1b", borderColor: "#fca5a5" }}
            >
              Clear Guest Info
            </button>
            <button
              type="button"
              className="btn-lg-grey"
              onClick={() => {
                setOverrideFlag(true);
                setFlaggedAlert(null);
              }}
              style={{ background: "#fff7ed", color: "#c2410c", borderColor: "#fdba74" }}
            >
              Override &amp; Proceed
            </button>
          </div>
        </div>
      )}

      {error && <p className="walkin-message walkin-error" style={{ marginBottom: 16 }}>{error}</p>}
      {success && <p className="walkin-message walkin-success" style={{ marginBottom: 16 }}>{success}</p>}

      <form onSubmit={handleSubmit} className="walkin-form">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* ROW 1: STAY DETAILS & GUEST DETAILS (2 BALANCED COLUMNS) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 14, alignItems: "stretch" }}>
            
            {/* LEFT COLUMN: 📅 1. STAY DETAILS */}
            <div className="form-card" style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14, padding: embedded ? "14px 16px" : "16px 18px", boxShadow: "0 4px 18px rgba(15,23,42,0.03)", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 6, borderBottom: "1.5px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="card-icon-badge">📅</div>
                    <h2 className="cr-section-title" style={{ fontSize: 13.5, margin: 0 }}>
                      1. Stay Details
                    </h2>
                  </div>
                </div>

                {/* 📌 ENQUIRY / HOLD TOGGLE BOX (Only for current or future dates) */}
                {!((formData.checkInDate && formData.checkInDate < todayISO()) || (formData.checkOutDate && formData.checkOutDate <= todayISO())) && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#1e293b" }}>
                      <input
                        type="checkbox"
                        name="isEnquiry"
                        checked={Boolean(formData.isEnquiry)}
                        onChange={(e) => setFormData((prev) => ({ ...prev, isEnquiry: e.target.checked }))}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                      <span>📌 Is Enquiry? (Temporary Hold / Quote)</span>
                    </label>

                    {formData.isEnquiry && (
                      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div className="form-group">
                          <CustomDatePicker
                            name="expiryDate"
                            value={formData.expiryDate || formData.checkInDate}
                            onChange={(e) => setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))}
                            required={formData.isEnquiry}
                            placeholder="Expiry date"
                          />
                        </div>
                        <div className="form-group">
                          <select
                            name="expiryTime"
                            value={formData.expiryTime || "18:00"}
                            onChange={(e) => setFormData((prev) => ({ ...prev, expiryTime: e.target.value }))}
                          >
                            <option value="12:00">🕒 12:00 PM</option>
                            <option value="15:00">🕒 03:00 PM</option>
                            <option value="18:00">🕒 06:00 PM</option>
                            <option value="21:00">🕒 09:00 PM</option>
                            <option value="23:59">🕒 11:59 PM</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Row 1: Dates & Nights */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 1.2fr", gap: 8, marginBottom: 10 }}>
                  <div className="form-group">
                    <CustomDatePicker name="checkInDate" value={formData.checkInDate} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <input
                      type="number"
                      min="1"
                      value={nights}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        const inD = parseISOToLocalDate(formData.checkInDate || todayISO());
                        const outD = new Date(inD);
                        outD.setDate(outD.getDate() + val);
                        const yyyy = outD.getFullYear();
                        const mm = String(outD.getMonth() + 1).padStart(2, "0");
                        const dd = String(outD.getDate()).padStart(2, "0");
                        setFormData((prev) => ({ ...prev, checkOutDate: `${yyyy}-${mm}-${dd}` }));
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <CustomDatePicker name="checkOutDate" value={formData.checkOutDate} onChange={handleChange} minDate={formData.checkInDate} required />
                  </div>
                </div>

                {/* Row 2: Check-In/Out Times */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div className="form-group">
                    <select name="checkInTime" value={formData.checkInTime} onChange={handleChange}>
                      {checkInTimeOptions.map((t) => (
                        <option key={t.val} value={t.val}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select name="checkOutTime" value={formData.checkOutTime} onChange={handleChange}>
                      {checkOutTimeOptions.map((t) => (
                        <option key={t.val} value={t.val}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Room Type & Room Selection */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div className="form-group">
                    <select name="roomType" value={formData.roomType} onChange={handleChange} required>
                      {effectiveRoomTypes.map((t) => (
                        <option key={t.id || t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select name="roomNumber" value={formData.roomNumber} onChange={handleChange}>
                      <option value="">Unassigned</option>
                      {roomsOfType.map((r) => {
                        const rNo = r.no || r.number || r.roomNumber || r.roomNo || r.id;
                        return (
                          <option key={rNo} value={rNo}>
                            Room {rNo}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Row 4: Occupancy */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                  <div className="form-group">
                    <select name="adults" value={formData.adults} onChange={handleChange} required>
                      {Array.from({ length: adultOptionsCount }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n} Adult{n > 1 ? "s" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select name="children" value={formData.children} onChange={handleChange}>
                      {Array.from({ length: childrenOptionsCount + 1 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>{n} Child{n === 1 ? "" : "ren"}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select name="infants" value={formData.infants} onChange={handleChange}>
                      {Array.from({ length: infantsOptionsCount + 1 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>{n} Infant{n === 1 ? "" : "s"}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 5: Rate Plan, Market Segment & Sub-Segment */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div className="form-group">
                    <select name="ratePlan" value={formData.ratePlan} onChange={handleChange}>
                      {availableRatePlans.map((p) => (
                        <option key={p.id || p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select
                      name="segment"
                      value={formData.segment}
                      onChange={(e) => {
                        const newSeg = e.target.value;
                        const newSegUpper = newSeg.toUpperCase();
                        const isCorp = newSegUpper.includes("CORPORATE") || newSegUpper.includes("COMPANY");
                        const matchedBs = businessSources.find((b) => b.segment === newSeg);

                        if (isCorp) {
                          const firstComp = (companyAccounts || [])[0];
                          const subName = firstComp ? firstComp.name : (matchedBs?.subSegments?.[0] || "COMPANY DIRECT");
                          const compId = firstComp ? firstComp.id : "";

                          setFormData((prev) => ({
                            ...prev,
                            segment: newSeg,
                            subSegment: subName,
                            companyAccountId: compId,
                            companyName: firstComp ? firstComp.name : prev.companyName,
                            paymentMethod: "City Ledger"
                          }));
                          setCollectPayment(true);
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            segment: newSeg,
                            subSegment: matchedBs?.subSegments?.[0] || ""
                          }));
                        }
                      }}
                    >
                      {businessSources.map((b) => (
                        <option key={b.id || b.segment} value={b.segment}>{b.segment}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select
                      name="subSegment"
                      value={formData.subSegment}
                      onChange={(e) => {
                        const newSub = e.target.value;
                        if (isCorporateSegment) {
                          const matchedComp = (companyAccounts || []).find(
                            (c) => c.name.toLowerCase() === newSub.toLowerCase()
                          );
                          setFormData((prev) => ({
                            ...prev,
                            subSegment: newSub,
                            companyAccountId: matchedComp ? matchedComp.id : prev.companyAccountId,
                            companyName: newSub,
                            paymentMethod: "City Ledger"
                          }));
                          setCollectPayment(true);
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            subSegment: newSub
                          }));
                        }
                      }}
                    >
                      {availableSubSegments.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: 👤 2. GUEST DETAILS */}
            <div className="form-card" style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14, padding: embedded ? "14px 16px" : "16px 18px", boxShadow: "0 4px 18px rgba(15,23,42,0.03)", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 6, borderBottom: "1.5px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="card-icon-badge">👤</div>
                    <h2 className="cr-section-title" style={{ fontSize: 13.5, margin: 0 }}>
                      2. Guest Details
                    </h2>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      className="btn-lg-grey"
                      onClick={() => {
                        setActiveAIScanTarget(null);
                        setShowAIScanner(true);
                      }}
                      style={{ height: 28, padding: "0 10px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, background: "#ffffff", borderColor: "#cbd5e1", color: "#0f172a" }}
                    >
                      📄 Scan
                    </button>
                    <button
                      type="button"
                      className="btn-lg-grey"
                      onClick={() => {
                        setCameraTargetIdx(null);
                        setShowCameraModal(true);
                      }}
                      style={{ height: 28, padding: "0 10px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, background: "#ffffff", borderColor: "#cbd5e1", color: "#0f172a" }}
                    >
                      📷 Capture
                    </button>
                    <button
                      type="button"
                      className="btn-lg-grey"
                      onClick={() => setShowSignatureModal(true)}
                      style={{ height: 28, padding: "0 10px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, background: "#ffffff", borderColor: "#cbd5e1", color: "#0f172a" }}
                    >
                      ✍️ Sign
                    </button>
                  </div>
                </div>

                {/* Row 1: First Name & Last Name (2 WIDE EQUAL COLUMNS) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div className="form-group" style={{ position: "relative" }}>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName || ""}
                      onChange={(e) => {
                        handleChange(e);
                        setShowGuestSuggestions(true);
                      }}
                      onFocus={() => setShowGuestSuggestions(true)}
                      placeholder="First Name"
                      className={error && !formData.firstName?.trim() && !formData.fullName?.trim() ? "cr-invalid" : ""}
                      autoComplete="off"
                      required
                    />
                    {error && !formData.firstName?.trim() && !formData.fullName?.trim() && (
                      <span className="cr-field-error">{error}</span>
                    )}

                    {showGuestSuggestions && filteredGuestSuggestions.length > 0 && (
                      <div className="cr-past-guest-dropdown">
                        <div className="cr-past-guest-header">
                          <span>👥 Returning Guests ({filteredGuestSuggestions.length})</span>
                          <button type="button" className="cr-past-guest-close" onClick={() => setShowGuestSuggestions(false)}>✕</button>
                        </div>
                        {filteredGuestSuggestions.map((g, idx) => (
                          <div key={idx} className="cr-past-guest-item" onClick={() => handleSelectPastGuest(g)}>
                            <div className="cr-pg-name">
                              <span>👤 {g.fullName}</span>
                              <span className="cr-pg-badge">⚡ Autofill</span>
                            </div>
                            <div className="cr-pg-sub">
                              {g.phone && <span>📞 {g.phone}</span>}
                              {g.email && <span>✉️ {g.email}</span>}
                              {g.city && <span>📍 {g.city}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName || ""}
                      onChange={(e) => {
                        handleChange(e);
                        setShowGuestSuggestions(true);
                      }}
                      onFocus={() => setShowGuestSuggestions(true)}
                      placeholder="Last Name"
                      className={error && !formData.lastName?.trim() && !formData.fullName?.trim() ? "cr-invalid" : ""}
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Contact Info & Date of Birth */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div className="form-group">
                    <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="(XXX) XXX-XXXX" />
                    {formData.phoneNumber && !isValidPhoneNumber(formData.phoneNumber) && (
                      <span style={{ color: "#dc2626", fontSize: 9.5, fontWeight: 800, marginTop: 2, display: "block" }}>
                        ⚠️ Phone number must be 10 digits
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@domain.com" />
                    {formData.email && !isValidEmail(formData.email) && (
                      <span style={{ color: "#dc2626", fontSize: 9.5, fontWeight: 800, marginTop: 2, display: "block" }}>
                        ⚠️ Please enter a valid email address
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <CustomDatePicker name="dob" value={formData.dob || ""} onChange={handleChange} max={todayISO()} placeholder="DOB" />
                  </div>
                </div>

                {/* Row 3: Street Address */}
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Street Address" />
                </div>

                {/* Row 4: Location (COUNTRY, STATE, CITY, ZIP - 4 COLUMNS) */}
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1.1fr 0.8fr", gap: 8, marginBottom: 10 }}>
                  <div className="form-group">
                    <select name="country" value={formData.country || "United States"} onChange={handleChange}>
                      {Array.from(new Set([
                        ...(formData.country ? [formData.country] : []),
                        "United States", "Canada", "United Kingdom", "Mexico", "Germany", "France", "India", "Australia", "Japan", "Brazil", "Spain", "Italy", "Netherlands"
                      ])).map((cnt) => (
                        <option key={cnt} value={cnt}>{cnt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select
                      name="state"
                      value={formData.state || "California"}
                      onChange={(e) => {
                        const newSt = e.target.value;
                        const cities = US_CITIES_BY_STATE[newSt] || [];
                        setFormData((prev) => ({
                          ...prev,
                          state: newSt,
                          city: cities[0] || prev.city || "Los Angeles"
                        }));
                      }}
                    >
                      {Array.from(new Set([
                        ...(formData.state ? [formData.state] : []),
                        ...US_STATES,
                        "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Ontario", "Quebec"
                      ])).map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select name="city" value={formData.city || "Los Angeles"} onChange={handleChange}>
                      {Array.from(new Set([
                        ...(formData.city ? [formData.city] : []),
                        ...(US_CITIES_BY_STATE[formData.state] || []),
                        "Los Angeles"
                      ])).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <input type="text" name="zip" value={formData.zip} onChange={handleChange} placeholder="Zip / Postal" />
                  </div>
                </div>

                {/* Row 5: ID Details (2 COLUMNS) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div className="form-group">
                    <select name="idProofType" value={formData.idProofType} onChange={handleChange}>
                      <option value="US Driver's License">US Driver's License</option>
                      <option value="US Passport">US Passport</option>
                      <option value="US State ID">US State ID Card</option>
                      <option value="Foreign Passport">Foreign Passport</option>
                      <option value="US Military ID">US Military ID</option>
                      <option value="Green Card">Green Card / Permanent Resident</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <input type="text" name="idProofNumber" value={formData.idProofNumber} onChange={handleChange} placeholder="Govt ID Number" />
                  </div>
                </div>

                {/* Row 6: Vehicle Info (3 COLUMNS) */}
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.85fr 0.85fr", gap: 8, marginBottom: 10 }}>
                  <div className="form-group">
                    <input type="text" name="vehicleMakeModel" value={formData.vehicleMakeModel || ""} onChange={handleChange} placeholder="e.g. Toyota Camry" />
                  </div>
                  <div className="form-group">
                    <input type="text" name="vehiclePlate" value={formData.vehiclePlate || ""} onChange={handleChange} placeholder="7XYZ890" />
                  </div>
                  <div className="form-group">
                    <input type="text" name="vehicleColor" value={formData.vehicleColor || ""} onChange={handleChange} placeholder="Silver" />
                  </div>
                </div>

                {/* Row 7: Special Requests / Notes (Moved to Guest Details) */}
                <div className="form-group">
                  <input type="text" name="notes" value={formData.notes} onChange={handleChange} placeholder="e.g. Note" />
                </div>
              </div>
            </div>
          </div>

          {/* ROW 2: CHARGES, PRICE DETAILS & PAYMENT COLLECTION */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
            
            {/* LEFT COLUMN: CHARGES & PRICE DETAILS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              
              {/* CARD 3: 🏷️ CHARGES & DISCOUNTS */}
              <div className="form-card" style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14, padding: embedded ? "12px 14px" : "16px 18px", boxShadow: "0 4px 18px rgba(15,23,42,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 6, borderBottom: "1.5px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="card-icon-badge">🏷️</div>
                    <h2 className="cr-section-title" style={{ fontSize: 13.5, margin: 0 }}>
                      3. Charges, Addons &amp; Discounts
                    </h2>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: "#0f172a", cursor: "pointer", margin: 0 }}>
                      <span>TAX EXEMPT:</span>
                      <input
                        type="checkbox"
                        checked={taxExempt}
                        onChange={(e) => setTaxExempt(e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: "#0f172a", cursor: "pointer" }}
                      />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: "#0f172a", cursor: "pointer", margin: 0 }}>
                      <span>COMPLIMENTARY:</span>
                      <input
                        type="checkbox"
                        checked={isComplimentary}
                        onChange={(e) => setIsComplimentary(e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: "#0f172a", cursor: "pointer" }}
                      />
                    </label>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontWeight: 800, fontSize: 11.5, color: "#0f172a", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                      🧩 Hotel Add-ons &amp; Packages
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {getHotelAddons().map((addon) => {
                        const isSelected = selectedAddons.some((a) => (a.id || a.name) === (addon.id || addon.name));
                        return (
                          <div
                            key={addon.id || addon.name}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedAddons((prev) => prev.filter((a) => (a.id || a.name) !== (addon.id || addon.name)));
                              } else {
                                setSelectedAddons((prev) => [...prev, addon]);
                              }
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: `1.5px solid ${isSelected ? "#0f172a" : "#cbd5e1"}`,
                              background: isSelected ? "#e2e8f0" : "#ffffff",
                              cursor: "pointer",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ width: 14, height: 14, accentColor: "#0f172a", cursor: "pointer", margin: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: 10.5, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {addon.name}
                              </div>
                              <div style={{ fontSize: 9.5, color: "#475569", fontWeight: 700 }}>
                                +${addon.price} ({isAddonPerNight(addon) ? "night" : "stay"})
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: 10, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 11.5, color: "#0f172a", display: "flex", alignItems: "center", gap: 5 }}>
                      🎟️ Coupon &amp; Tariff Discounts
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.45fr 0.95fr 1.1fr", gap: 8 }}>
                      <div className="form-group">
                        <label>DISCOUNT TYPE</label>
                        <select name="discountType" value={formData.discountType} onChange={handleChange}>
                          <option value="USD">💵 Flat Discount ($ USD)</option>
                          <option value="PERCENT">🏷️ Percentage Discount (%)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>DISCOUNT VALUE</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          name="discountValue"
                          value={formData.discountValue}
                          onChange={handleChange}
                          placeholder={formData.discountType === "PERCENT" ? "e.g. 10%" : "e.g. 25.00"}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label>COUPON CODE</label>
                        <div style={{ display: "flex", gap: 4 }}>
                          <input
                            type="text"
                            name="couponCode"
                            value={formData.couponCode}
                            onChange={handleChange}
                            placeholder="Code"
                          />
                          <button
                            type="button"
                            className="btn-lg-grey"
                            onClick={() => {
                              if (formData.couponCode.toUpperCase() === "WELCOME10") {
                                setFormData((prev) => ({ ...prev, discountType: "PERCENT", discountValue: "10" }));
                                setSuccess("Coupon WELCOME10 Applied: 10% Discount!");
                              } else if (formData.couponCode.trim()) {
                                setFormData((prev) => ({ ...prev, discountType: "USD", discountValue: "15" }));
                                setSuccess(`Coupon ${formData.couponCode} Applied: $15 Discount!`);
                              }
                            }}
                            style={{ height: 32, padding: "0 10px", fontSize: 11 }}
                          >
                            APPLY
                          </button>
                          {formData.discountValue && (
                            <button
                              type="button"
                              className="btn-lg-grey"
                              onClick={() => setFormData((prev) => ({ ...prev, discountValue: "", couponCode: "" }))}
                              style={{ height: 32, padding: "0 8px", fontSize: 11, background: "#fee2e2", borderColor: "#fca5a5", color: "#991b1b" }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 4: 🧾 PRICE DETAILS */}
              <div className="form-card" style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14, padding: embedded ? "12px 14px" : "16px 18px", boxShadow: "0 4px 18px rgba(15,23,42,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 6, borderBottom: "1.5px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="card-icon-badge">🧾</div>
                    <h2 className="cr-section-title" style={{ fontSize: 13.5, margin: 0 }}>
                      4. Price Details
                    </h2>
                  </div>
                  
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: "#0f172a", cursor: "pointer", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={rateOverride}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setRateOverride(isChecked);
                        setRateTouched(isChecked);
                        if (isChecked) {
                          setPerNightRate(String(ratePerNight || getRoomTypePrice(selectedRoomType, null)));
                        }
                      }}
                      style={{ width: 15, height: 15, accentColor: "#0f172a" }}
                    />
                    <span>OVERRIDE DAILY TARIFF</span>
                  </label>
                </div>

                {/* All 4 Price Fields in 1 Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 6 }}>
                  <div className="form-group">
                    <label>PER NIGHT ($ EX. TAX)</label>
                    <input
                      type="text"
                      value={
                        activeInput === "perNight"
                          ? perNightRate
                          : rateOverride || rateTouched
                          ? Number(perNightRate || 0).toFixed(2)
                          : Number(ratePerNight || 0).toFixed(2)
                      }
                      onFocus={() => setActiveInput("perNight")}
                      onChange={(e) => {
                        setRateTouched(true);
                        setRateOverride(true);
                        setPerNightRate(e.target.value);
                      }}
                      onBlur={() => {
                        setActiveInput(null);
                        if (perNightRate !== "" && !isNaN(Number(perNightRate))) {
                          setPerNightRate(String(Number(perNightRate).toFixed(2)));
                        }
                      }}
                      readOnly={!rateOverride}
                      placeholder="0.00"
                      style={{
                        fontWeight: 800,
                        background: rateOverride ? "#ffffff" : "#f8fafc",
                        cursor: rateOverride ? "text" : "not-allowed",
                        border: rateOverride ? "1.5px solid #0f172a" : "1px solid #cbd5e1"
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label>TOTAL EX. TAX ($)</label>
                    <input 
                      type="text" 
                      value={
                        activeInput === "totalExTax"
                          ? totalExTaxInput
                          : rateOverride || rateTouched
                          ? (Number(perNightRate || ratePerNight) * nights).toFixed(2)
                          : Number(netSubtotal).toFixed(2)
                      } 
                      onFocus={() => {
                        setActiveInput("totalExTax");
                        const cur = (rateOverride || rateTouched)
                          ? (Number(perNightRate || ratePerNight) * nights).toFixed(2)
                          : Number(netSubtotal).toFixed(2);
                        setTotalExTaxInput(cur);
                      }}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        setTotalExTaxInput(rawVal);
                        setRateTouched(true);
                        setRateOverride(true);
                        const val = Number(rawVal);
                        if (!isNaN(val) && nights > 0) {
                          setPerNightRate(String(val / nights));
                        } else if (rawVal === "") {
                          setPerNightRate("0");
                        }
                      }}
                      onBlur={() => {
                        setActiveInput(null);
                        if (perNightRate !== "" && !isNaN(Number(perNightRate))) {
                          setPerNightRate(String(Number(perNightRate).toFixed(2)));
                        }
                      }}
                      readOnly={!rateOverride} 
                      placeholder="0.00"
                      style={{ 
                        fontWeight: 800,
                        background: rateOverride ? "#ffffff" : "#f8fafc",
                        cursor: rateOverride ? "text" : "not-allowed",
                        border: rateOverride ? "1.5px solid #cbd5e1" : "1px solid #cbd5e1"
                      }} 
                    />
                  </div>

                  <div className="form-group">
                    <label>TOTAL TAX ($)</label>
                    <input type="text" value={Number(taxAmount).toFixed(2)} readOnly style={{ fontWeight: 800, color: "#e11d48", background: "#f8fafc", cursor: "not-allowed" }} />
                  </div>

                  <div className="form-group">
                    <label>TOTAL WITH TAX ($)</label>
                    <input 
                      type="text" 
                      value={
                        activeInput === "totalWithTax"
                          ? totalWithTaxInput
                          : Number(totalAmount).toFixed(2)
                      } 
                      onFocus={() => {
                        setActiveInput("totalWithTax");
                        setTotalWithTaxInput(Number(totalAmount).toFixed(2));
                      }}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        setTotalWithTaxInput(rawVal);
                        setRateTouched(true);
                        setRateOverride(true);
                        const val = Number(rawVal);
                        if (!isNaN(val) && nights > 0) {
                          const taxPct = calculatedTaxDetails?.pctRate || 0;
                          const exTaxTotal = taxPct > 0 ? val / (1 + taxPct / 100) : val;
                          setPerNightRate(String(exTaxTotal / nights));
                        } else if (rawVal === "") {
                          setPerNightRate("0");
                        }
                      }}
                      onBlur={() => {
                        setActiveInput(null);
                        if (perNightRate !== "" && !isNaN(Number(perNightRate))) {
                          setPerNightRate(String(Number(perNightRate).toFixed(2)));
                        }
                      }}
                      readOnly={!rateOverride}
                      placeholder="0.00"
                      style={{ 
                        fontWeight: 900, 
                        color: "#0f172a", 
                        fontSize: 13.5,
                        background: rateOverride ? "#ffffff" : "#f8fafc",
                        cursor: rateOverride ? "text" : "not-allowed",
                        border: rateOverride ? "1.5px solid #0f172a" : "1px solid #cbd5e1"
                      }} 
                    />
                  </div>
                </div>

                <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <button
                    type="button"
                    onClick={() => setShowDaySplitModal(true)}
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#0f172a",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#f1f5f9",
                      border: "1.5px solid #cbd5e1",
                      padding: "6px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span>📅 Day-Wise Split of Room Prices</span>
                    <span style={{ fontSize: 10, background: "#0f172a", color: "#ffffff", padding: "2px 7px", borderRadius: 10, fontWeight: 800 }}>
                      {nights} {nights === 1 ? "Night" : "Nights"}
                    </span>
                  </button>

                  {Object.keys(customNightlyRates).some((k) => customNightlyRates[k] !== undefined && customNightlyRates[k] !== "") && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "3px 8px", borderRadius: 6, border: "1px solid #86efac" }}>
                      ⚡ Custom Rates Active
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: 💳 5. PAYMENT COLLECTION & SUMMARY */}
            <div className="form-card" style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14, padding: embedded ? "12px 14px" : "16px 18px", boxShadow: "0 4px 18px rgba(15,23,42,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 6, borderBottom: "1.5px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="card-icon-badge">💳</div>
                  <h2 className="cr-section-title" style={{ fontSize: 13.5, margin: 0 }}>
                    5. Payment Collection &amp; Summary
                  </h2>
                </div>

                <div className="cr-toggle-row">
                  <span>PROCESS PAYMENT IMMEDIATELY:</span>
                  <button
                    type="button"
                    className={`cr-toggle ${collectPayment ? "on" : ""}`}
                    onClick={() => setCollectPayment((v) => !v)}
                  >
                    <span className="cr-toggle-knob" />
                  </button>
                </div>
              </div>
              {collectPayment && (
                <div style={{ marginBottom: 12, background: "#f8fafc", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "800", color: "#475569", marginBottom: 6, textTransform: "uppercase" }}>
                    Select Collection Purpose / Type
                  </label>
                  <div style={{ display: "flex", gap: 6, background: "#f1f5f9", padding: "4px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({
                        ...prev,
                        collectionPurpose: "tariff_payment",
                        paymentMethod: prev.paymentMethod === "Deposit" ? "Card" : prev.paymentMethod
                      }))}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        fontSize: "12px",
                        fontWeight: (formData.collectionPurpose || "tariff_payment") === "tariff_payment" ? "800" : "700",
                        borderRadius: 6,
                        border: (formData.collectionPurpose || "tariff_payment") === "tariff_payment" ? "1px solid #cbd5e1" : "1px solid transparent",
                        background: (formData.collectionPurpose || "tariff_payment") === "tariff_payment" ? "#ffffff" : "transparent",
                        color: (formData.collectionPurpose || "tariff_payment") === "tariff_payment" ? "#0f172a" : "#64748b",
                        boxShadow: (formData.collectionPurpose || "tariff_payment") === "tariff_payment" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      💳 Room Tariff Prepayment
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({
                        ...prev,
                        collectionPurpose: "security_deposit",
                        paymentMethod: "Deposit"
                      }))}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        fontSize: "12px",
                        fontWeight: formData.collectionPurpose === "security_deposit" ? "800" : "700",
                        borderRadius: 6,
                        border: formData.collectionPurpose === "security_deposit" ? "1px solid #cbd5e1" : "1px solid transparent",
                        background: formData.collectionPurpose === "security_deposit" ? "#ffffff" : "transparent",
                        color: formData.collectionPurpose === "security_deposit" ? "#0f172a" : "#64748b",
                        boxShadow: formData.collectionPurpose === "security_deposit" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      🛡️ Security Deposit (Held)
                    </button>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: 8, fontStyle: "italic" }}>
                    {formData.collectionPurpose === "security_deposit"
                      ? "⚠️ Security Deposit will be held in Deposit Vault (does NOT reduce room tariff balance due)."
                      : "✓ Room Prepayment will be applied directly to pay for room tariff & taxes (reduces balance due)."}
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: collectPayment ? "1fr 1fr 1fr" : "1fr", gap: 8, marginBottom: collectPayment ? 8 : 0 }}>
                {collectPayment && (
                  <>
                    <div className="form-group">
                      <label>PAYMENT METHOD *</label>
                      <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                        {formData.collectionPurpose === "security_deposit" ? (
                          <option value="Deposit">🛡️ Deposit</option>
                        ) : (
                          getEnabledPaymentMethods()
                            .filter((pm) => pm.id !== "Deposit")
                            .map((pm) => (
                              <option key={pm.id} value={pm.name}>
                                {pm.label}
                              </option>
                            ))
                        )}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{formData.collectionPurpose === "security_deposit" ? "SECURITY DEPOSIT ($)" : "COLLECTED AMOUNT ($)"}</label>
                      <input
                        type="number"
                        name="advanceAmount"
                        value={formData.advanceAmount}
                        onChange={handleChange}
                        placeholder={`Total $${totalAmount}`}
                      />
                    </div>
                    <div className="form-group">
                      <label>REMARK / NOTES</label>
                      <input type="text" name="remark" value={formData.remark} onChange={handleChange} placeholder="Payment notes" />
                    </div>
                  </>
                )}
              </div>

              {collectPayment && ["Company", "City Ledger", "POST TO COMPANY / CITY LEDGER"].includes(formData.paymentMethod) && (
                <div style={{ background: "#f1f5f9", padding: 10, borderRadius: 8, border: "1.5px solid #cbd5e1", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 800, color: "#334155", textTransform: "uppercase", margin: 0 }}>
                      Select Corporate Company Account *
                    </label>
                    <button
                      type="button"
                      className="btn-lg-grey"
                      onClick={() => setShowAddCompanyModal(true)}
                      style={{ height: 26, padding: "0 8px", fontSize: 10.5 }}
                    >
                      + Add Company Account
                    </button>
                  </div>
                  <select
                    name="companyAccountId"
                    value={formData.companyAccountId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedComp = (companyAccounts || []).find((c) => c.id === selectedId);
                      setFormData((prev) => ({
                        ...prev,
                        companyAccountId: selectedId,
                        companyName: selectedComp ? selectedComp.name : prev.companyName,
                        subSegment: isCorporateSegment && selectedComp ? selectedComp.name : prev.subSegment
                      }));
                    }}
                    style={{ height: 32, borderRadius: 6, border: "1.5px solid #cbd5e1", background: "#ffffff", padding: "0 8px", fontSize: 12, width: "100%" }}
                    required
                  >
                    <option value="">-- Select Company / City Ledger Account --</option>
                    {companyAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        🏢 {c.name} (Acct #{c.accountNo}) {c.creditLimit ? `· Credit Limit: $${Number(c.creditLimit).toLocaleString()}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {collectPayment && ["Card", "Swipe", "CARD", "Offline Card", "OFFLINE CARD PAYMENT"].includes(formData.paymentMethod) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8, background: "#f8fafc", padding: 12, borderRadius: 8, border: "1.5px solid #cbd5e1" }}>
                  {/* Line 1: First Name & Last Name */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11px", fontWeight: "800", color: "#334155", marginBottom: 4, display: "block" }}>FIRST NAME ON CARD *</label>
                      <input type="text" name="cardFirstName" value={formData.cardFirstName || ""} onChange={handleChange} placeholder="First Name" required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11px", fontWeight: "800", color: "#334155", marginBottom: 4, display: "block" }}>LAST NAME ON CARD *</label>
                      <input type="text" name="cardLastName" value={formData.cardLastName || ""} onChange={handleChange} placeholder="Last Name" required />
                    </div>
                  </div>

                  {/* Line 2: Card Number */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <label style={{ fontSize: "11px", fontWeight: "800", color: "#334155", margin: 0 }}>CARD NUMBER *</label>
                      {formData.cardNumber && (
                        <span style={{ fontSize: "10.5px", fontWeight: "800", color: detectCardBrand(formData.cardNumber).color }}>
                          {detectCardBrand(formData.cardNumber).icon}
                        </span>
                      )}
                    </div>
                    <input type="text" name="cardNumber" maxLength="19" value={formData.cardNumber} onChange={handleChange} placeholder="•••• •••• •••• ••••" required />
                    {formData.cardNumber && !isValidCardNumber(formData.cardNumber) && (
                      <span style={{ color: "#dc2626", fontSize: 9.5, fontWeight: 800, marginTop: 2, display: "block" }}>
                        ⚠️ Invalid card number (Luhn check failed)
                      </span>
                    )}
                  </div>

                  {/* Line 3: Expiry & CVV */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11px", fontWeight: "800", color: "#334155", marginBottom: 4, display: "block" }}>EXPIRY (MM/YY) *</label>
                      <input type="text" name="cardExpiry" maxLength="5" value={formData.cardExpiry} onChange={handleChange} placeholder="MM/YY" required />
                      {formData.cardExpiry && !isValidCardExpiry(formData.cardExpiry) && (
                        <span style={{ color: "#dc2626", fontSize: 9.5, fontWeight: 800, marginTop: 2, display: "block" }}>
                          ⚠️ Invalid / Expired
                        </span>
                      )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11px", fontWeight: "800", color: "#334155", marginBottom: 4, display: "block" }}>CVV *</label>
                      <input type="password" name="cardCvv" maxLength="4" value={formData.cardCvv} onChange={handleChange} placeholder="•••" required />
                      {formData.cardCvv && !isValidCardCvv(formData.cardCvv, detectCardBrand(formData.cardNumber).brand === "Amex") && (
                        <span style={{ color: "#dc2626", fontSize: 9.5, fontWeight: 800, marginTop: 2, display: "block" }}>
                          ⚠️ Invalid CVV
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* PRICE SUMMARY BOX */}
              <div className="cr-summary-card" style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569" }}>
                  <span>Room Tariff ({nights} Night{nights > 1 ? "s" : ""}):</span>
                  <strong style={{ color: "#0f172a" }}>${rawSubtotal.toFixed(2)}</strong>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#16a34a" }}>
                    <span>Discount:</span>
                    <strong>-${discountAmount.toFixed(2)}</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#e11d48" }}>
                  <span>Taxes &amp; Fees ({activeTaxRate}%):</span>
                  <strong>${taxAmount.toFixed(2)}</strong>
                </div>
                {extraChargesValue > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569" }}>
                    <span>Addons &amp; Extras:</span>
                    <strong style={{ color: "#0f172a" }}>${extraChargesValue.toFixed(2)}</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, fontWeight: 900, color: "#0f172a", paddingTop: 6, borderTop: "1.5px solid #cbd5e1" }}>
                  <span>TOTAL ESTIMATED CHARGES:</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: FULL-WIDTH COLLAPSIBLE 👥 6. ADDITIONAL GUEST DETAILS */}
          <div className="form-card" style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14, padding: embedded ? "12px 14px" : "14px 16px", boxShadow: "0 4px 18px rgba(15,23,42,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showAdditionalGuests ? 10 : 0, paddingBottom: showAdditionalGuests ? 6 : 0, borderBottom: showAdditionalGuests ? "1.5px solid #f1f5f9" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="card-icon-badge">👥</div>
                <h2 className="cr-section-title" style={{ fontSize: 13.5, margin: 0 }}>
                  6. Additional Guest Details
                </h2>
              </div>

              <div className="cr-toggle-row">
                <span style={{ fontSize: 11, fontWeight: 800, color: "#0f172a" }}>ADD ADDITIONAL GUEST(S):</span>
                <button
                  type="button"
                  className={`cr-toggle ${showAdditionalGuests ? "on" : ""}`}
                  onClick={() => setShowAdditionalGuests((v) => !v)}
                >
                  <span className="cr-toggle-knob" />
                </button>
              </div>
            </div>

            {showAdditionalGuests && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                {additionalGuests.map((g, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#f8fafc",
                      border: "1.5px solid #cbd5e1",
                      borderRadius: 12,
                      padding: "14px 16px",
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10
                    }}
                  >
                    {/* Header with AI Scan & Remove Buttons */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                        👥 Accompanying Guest #{idx + 1}
                      </span>

                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {g.guestPhoto && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#0f172a", background: "#f8fafc", border: "1px solid #cbd5e1", padding: "2px 8px", borderRadius: 5, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                            <img src={g.guestPhoto} alt="Guest" style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover", border: "1px solid #cbd5e1" }} />
                            ✓ Photo
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn-lg-grey"
                          onClick={() => {
                            setActiveAIScanTarget(idx);
                            setShowAIScanner(true);
                          }}
                          style={{
                            height: 28,
                            padding: "0 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            background: "#ffffff",
                            borderColor: "#cbd5e1",
                            color: "#0f172a"
                          }}
                        >
                          📄 Scan
                        </button>
                        <button
                          type="button"
                          className="btn-lg-grey"
                          onClick={() => {
                            setCameraTargetIdx(idx);
                            setShowCameraModal(true);
                          }}
                          style={{
                            height: 28,
                            padding: "0 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            background: "#ffffff",
                            borderColor: "#cbd5e1",
                            color: "#0f172a"
                          }}
                        >
                          📷 Capture
                        </button>

                        {additionalGuests.length > 1 && (
                          <button
                            type="button"
                            className="btn-lg-grey"
                            onClick={() => setAdditionalGuests((prev) => prev.filter((_, i) => i !== idx))}
                            style={{ height: 28, padding: "0 8px", fontSize: 11, background: "#fee2e2", borderColor: "#fca5a5", color: "#991b1b", fontWeight: 700 }}
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 1: First Name & Last Name */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="form-group">
                        <label>FIRST NAME *</label>
                        <input
                          type="text"
                          value={g.firstName || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, firstName: val, fullName: `${val} ${item.lastName || ""}`.trim() } : item));
                          }}
                          placeholder="First Name"
                        />
                      </div>
                      <div className="form-group">
                        <label>LAST NAME *</label>
                        <input
                          type="text"
                          value={g.lastName || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, lastName: val, fullName: `${item.firstName || ""} ${val}`.trim() } : item));
                          }}
                          placeholder="Last Name"
                        />
                      </div>
                    </div>

                    {/* Row 2: Phone Number & Email Address */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="form-group">
                        <label>PHONE NUMBER</label>
                        <input
                          type="tel"
                          value={g.phone || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, phone: val } : item));
                          }}
                          placeholder="Mobile phone number"
                        />
                      </div>
                      <div className="form-group">
                        <label>EMAIL ADDRESS</label>
                        <input
                          type="email"
                          value={g.email || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, email: val } : item));
                          }}
                          placeholder="email@domain.com"
                        />
                      </div>
                    </div>

                    {/* Row 3: Street Address */}
                    <div className="form-group">
                      <label>STREET ADDRESS</label>
                      <input
                        type="text"
                        value={g.address || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, address: val } : item));
                        }}
                        placeholder="Street Address"
                      />
                    </div>

                    {/* Row 4: City, State, Zip */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <div className="form-group">
                        <label>CITY</label>
                        <input
                          type="text"
                          value={g.city || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, city: val } : item));
                          }}
                          placeholder="City"
                        />
                      </div>
                      <div className="form-group">
                        <label>STATE</label>
                        <input
                          type="text"
                          value={g.state || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, state: val } : item));
                          }}
                          placeholder="State"
                        />
                      </div>
                      <div className="form-group">
                        <label>ZIP</label>
                        <input
                          type="text"
                          value={g.zip || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, zip: val } : item));
                            if (val) {
                              fetchCityStateFromZip(val).then((geo) => {
                                if (geo) {
                                  setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, city: geo.city || item.city, state: geo.state || item.state } : item));
                                }
                              });
                            }
                          }}
                          placeholder="Zip"
                        />
                      </div>
                    </div>

                    {/* Row 5: Select ID Type & Govt ID Number */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="form-group">
                        <label>SELECT ID TYPE</label>
                        <select
                          value={g.idType || "US Driver's License"}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, idType: val } : item));
                          }}
                        >
                          <option value="US Driver's License">US Driver's License</option>
                          <option value="US Passport">US Passport</option>
                          <option value="US State ID">US State ID Card</option>
                          <option value="Foreign Passport">Foreign Passport</option>
                          <option value="US Military ID">US Military ID</option>
                          <option value="Green Card">Green Card / Permanent Resident</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>GOVT ID NUMBER</label>
                        <input
                          type="text"
                          value={g.idNumber || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdditionalGuests((prev) => prev.map((item, i) => i === idx ? { ...item, idNumber: val } : item));
                          }}
                          placeholder="Govt ID Number"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-lg-grey"
                  onClick={() => setAdditionalGuests((prev) => [...prev, { firstName: "", lastName: "", fullName: "", phone: "", email: "", address: "", city: "Los Angeles", state: "California", zip: "", idType: "US Driver's License", idNumber: "" }])}
                  style={{ height: 28, padding: "0 12px", fontSize: 11, fontWeight: 700, alignSelf: "flex-start" }}
                >
                  + Add Another Guest
                </button>
              </div>
            )}
          </div>

          {/* ACTION FOOTER */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 4, paddingTop: 10, borderTop: "1.5px solid #cbd5e1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {formData.isEnquiry && !((formData.checkInDate && formData.checkInDate < todayISO()) || (formData.checkOutDate && formData.checkOutDate <= todayISO())) ? (
                <button
                  type="button"
                  className="btn-lg-grey cr-submit-primary"
                  onClick={(e) => handleSubmit(e, "enquiry")}
                  style={{ minWidth: 110, height: 36, fontSize: 12.5, fontWeight: 800 }}
                >
                  📌 Hold
                </button>
              ) : formData.checkOutDate <= todayISO() ? (
                <button
                  type="button"
                  className="btn-lg-grey cr-submit-primary"
                  onClick={(e) => handleSubmit(e, "checked-out")}
                  style={{ minWidth: 110, height: 36, fontSize: 12.5, fontWeight: 800 }}
                >
                  🔑 Check-In
                </button>
              ) : formData.checkInDate < todayISO() && formData.checkOutDate > todayISO() ? (
                <button
                  type="button"
                  className="btn-lg-grey cr-submit-primary"
                  onClick={(e) => handleSubmit(e, "checked-in")}
                  style={{ minWidth: 110, height: 36, fontSize: 12.5, fontWeight: 800 }}
                >
                  🔑 Check-In
                </button>
              ) : formData.checkInDate === todayISO() ? (
                <>
                  <button
                    type="button"
                    className="btn-lg-grey cr-submit-primary"
                    onClick={(e) => handleSubmit(e, "checked-in")}
                    style={{ minWidth: 110, height: 36, fontSize: 12.5, fontWeight: 800 }}
                  >
                    🔑 Check-In
                  </button>
                  <button
                    type="button"
                    className="btn-lg-grey"
                    onClick={(e) => handleSubmit(e, "confirmed")}
                    style={{ minWidth: 110, height: 36, fontSize: 12.5, fontWeight: 800 }}
                  >
                    📅 Book
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-lg-grey cr-submit-primary"
                  onClick={(e) => handleSubmit(e, "confirmed")}
                  style={{ minWidth: 110, height: 36, fontSize: 12.5, fontWeight: 800 }}
                >
                  📅 Book
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* DAY-WISE SPLIT RATES POPUP MODAL */}
      {showDaySplitModal && (
        <div
          className="modal-backdrop"
          
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "540px",
              background: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1.5px solid #cbd5e1",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Header */}
            <div style={{ background: "#f8fafc", padding: "16px 20px", borderBottom: "1.5px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  📅 Day-Wise Room Price Split
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                  Room: {formData.roomNumber || "Unassigned"} ({formData.roomType || "Standard"}) • {nights} {nights === 1 ? "Night" : "Nights"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDaySplitModal(false)}
                style={{
                  background: "#e2e8f0",
                  border: "none",
                  color: "#475569",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px", maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#f1f5f9", padding: "10px 14px", borderRadius: 8, fontSize: 12, color: "#334155", borderLeft: "4px solid #2563eb", fontWeight: 600 }}>
                💡 Change the rate for any specific night below. Totals and average nightly rate will automatically recalculate.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {Array.from({ length: nights }).map((_, i) => {
                  const d = parseISOToLocalDate(formData.checkInDate || todayISO());
                  d.setDate(d.getDate() + i);
                  const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                  const currentRateVal = customNightlyRates[i] !== undefined && customNightlyRates[i] !== "" 
                    ? customNightlyRates[i] 
                    : (stayDailyRates[i] !== undefined ? stayDailyRates[i] : (perNightRate || 0));

                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        background: customNightlyRates[i] !== undefined && customNightlyRates[i] !== "" ? "#f0fdf4" : "#f8fafc",
                        border: customNightlyRates[i] !== undefined && customNightlyRates[i] !== "" ? "1.5px solid #86efac" : "1px solid #cbd5e1",
                        borderRadius: 10,
                        gap: 12
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>
                          Night {i + 1}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>
                          {dateLabel}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: "#334155" }}>$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentRateVal}
                          onChange={(e) => handleNightRateChange(i, e.target.value)}
                          placeholder="0.00"
                          style={{
                            width: "110px",
                            padding: "8px 10px",
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#0f172a",
                            background: "#ffffff",
                            border: "1.5px solid #94a3b8",
                            borderRadius: 8,
                            textAlign: "right",
                            outline: "none"
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Summary Box inside modal */}
              <div style={{ marginTop: 8, background: "#f8fafc", padding: "12px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Average Per Night</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                    ${(stayDailyRates.reduce((a, b) => a + Number(b || 0), 0) / nights).toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Total Room Tariff (Ex. Tax)</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#2563eb" }}>
                    ${stayDailyRates.reduce((a, b) => a + Number(b || 0), 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ background: "#f8fafc", padding: "14px 20px", borderTop: "1.5px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button
                type="button"
                onClick={handleResetNightlyRates}
                style={{
                  background: "#ffffff",
                  color: "#64748b",
                  border: "1.5px solid #cbd5e1",
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                ↺ Reset to Standard Rates
              </button>

              <button
                type="button"
                onClick={() => setShowDaySplitModal(false)}
                style={{
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  padding: "9px 20px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
                }}
              >
                Done / Save Rates
              </button>
            </div>
          </div>
        </div>
      )}

      <AddCompanyModal
        isOpen={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        onCompanyCreated={(newCompany) => {
          const updated = getCompanyAccounts();
          setCompanyAccounts(updated);
          setFormData((prev) => ({
            ...prev,
            companyAccountId: newCompany.id,
            companyName: newCompany.name,
            subSegment: (prev.segment || "").toUpperCase().includes("CORPORATE") ? newCompany.name : prev.subSegment,
            paymentMethod: "City Ledger"
          }));
          setCollectPayment(true);
        }}
      />
    </div>
  );
}
