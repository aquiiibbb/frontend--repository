import { dataStore } from "../services/dataStore";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Dog, CigaretteOff } from "lucide-react";
import DataImportWizard from "../components/DataImportWizard";
import PaymentGatewayConfig from "../components/PaymentGateway/PaymentGatewayConfig";
import AddCompanyModal from "../components/AddCompanyModal";
import { getRooms, saveRoomTypes, saveRoomsList, resetSystemData } from "../services/api";
import { resetAllData } from "../services/pmsDb";
import {
  getHotelProfile,
  saveHotelProfile,
  compressImageFile,
  getRoomTypes,
  getRatePlans,
  saveRatePlans,
  getHotelAddons,
  saveHotelAddons,
  getTaxRules,
  saveTaxRules,
  getTaxInclusiveSetting,
  saveTaxInclusiveSetting,
  getBusinessSources,
  saveBusinessSources,
  DEFAULT_BUSINESS_SOURCES,
  getActiveTaxPercent,
  getCancellationPolicies,
  saveCancellationPolicies,
  getHotelTerms,
  saveHotelTerms,
  getNightAuditConfig,
  saveNightAuditConfig,
  getSequenceConfig,
  saveSequenceConfig,
  formatSequence,
  STORAGE_KEY_HOTEL_INFO,
  STORAGE_KEY_RATE_PLANS,
  STORAGE_KEY_ADDONS,
  STORAGE_KEY_TAXES,
  STORAGE_KEY_ROOM_TYPES,
  STORAGE_KEY_ROOM_NUMBERS,
  getBookingEngineRoomDisplays,
  saveBookingEngineRoomDisplays,
  getUsers,
  saveUsers,
  getRoles,
  getEmailConfig,
  saveEmailConfig,
  getGuestNotifications,
  saveGuestNotifications,
  getHotelierNotifications,
  saveHotelierNotifications,
  saveRoles,
  DEFAULT_ROLES,
  DEFAULT_USER_RIGHTS,
  ALL_YES_RIGHTS,
  USER_RIGHTS_LABELS,
  getUserRights,
  getYieldManagementStatus,
  setYieldManagementStatus,
  getYieldRules,
  saveYieldRules,
  calculateYieldPrice,
  getStatusColors,
  saveStatusColors,
  DEFAULT_STATUS_COLORS,
  getHkColors,
  saveHkColors,
  DEFAULT_HK_COLORS,
  getActivityColors,
  saveActivityColors,
  DEFAULT_ACTIVITY_COLORS,
  getTransactionCategories,
  saveTransactionCategories,
} from "../services/hotelConfig";
import { getCompanyAccounts, addCompanyAccount, updateCompanyAccount, deleteCompanyAccount } from "../services/companyAccounts";
import "./ConfigurationPanel.css";

// US States and Canada Provinces Lists
const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", 
  "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", 
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", 
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", 
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", 
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", 
  "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

const CANADA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", 
  "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", 
  "Quebec", "Saskatchewan", "Yukon"
];

const CITIES_BY_REGION = {
  // US States
  "Alabama": ["Birmingham", "Montgomery", "Mobile", "Huntsville", "Tuscaloosa"],
  "Alaska": ["Anchorage", "Fairbanks", "Juneau", "Sitka", "Ketchikan"],
  "Arizona": ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Sedona", "Flagstaff"],
  "Arkansas": ["Little Rock", "Fort Smith", "Fayetteville", "Springdale", "Jonesboro"],
  "California": ["Hollister", "Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento", "Fresno", "Long Beach", "Oakland", "Anaheim", "Santa Barbara", "Palm Springs", "Napa", "Gilroy", "Monterey", "Salinas", "Santa Cruz", "Sunnyvale", "Cupertino", "Palo Alto", "Pasadena", "Irvine", "Bakersfield", "Riverside", "Stockton", "Modesto"],
  "Colorado": ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Boulder", "Aspen", "Vail"],
  "Connecticut": ["Bridgeport", "Stamford", "New Haven", "Hartford", "Waterbury"],
  "Delaware": ["Wilmington", "Dover", "Newark", "Middletown", "Smyrna"],
  "District of Columbia": ["Washington, D.C."],
  "Florida": ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale", "Key West", "Naples", "St. Petersburg", "Pensacola"],
  "Georgia": ["Atlanta", "Augusta", "Columbus", "Savannah", "Athens"],
  "Hawaii": ["Honolulu", "Kahului", "Hilo", "Kailua-Kona", "Lihue"],
  "Idaho": ["Boise", "Meridian", "Nampa", "Idaho Falls", "Coeur d'Alene"],
  "Illinois": ["Chicago", "Aurora", "Joliet", "Naperville", "Rockford", "Springfield"],
  "Indiana": ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel"],
  "Iowa": ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City"],
  "Kansas": ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka"],
  "Kentucky": ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington"],
  "Louisiana": ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles"],
  "Maine": ["Portland", "Lewiston", "Bangor", "South Portland", "Auburn", "Bar Harbor"],
  "Maryland": ["Baltimore", "Columbia", "Germantown", "Silver Spring", "Annapolis"],
  "Massachusetts": ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Cape Cod"],
  "Michigan": ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor", "Traverse City"],
  "Minnesota": ["Minneapolis", "St. Paul", "Rochester", "Duluth", "Bloomington"],
  "Mississippi": ["Jackson", "Gulfport", "Southaven", "Biloxi", "Hattiesburg"],
  "Missouri": ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence"],
  "Montana": ["Billings", "Missoula", "Great Falls", "Bozeman", "Helena", "Whitefish"],
  "Nebraska": ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney"],
  "Nevada": ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City"],
  "New Hampshire": ["Manchester", "Nashua", "Concord", "Dover", "Portsmouth"],
  "New Jersey": ["Newark", "Jersey City", "Paterson", "Elizabeth", "Atlantic City", "Hoboken"],
  "New Mexico": ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell"],
  "New York": ["New York City", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany", "Niagara Falls"],
  "North Carolina": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Asheville", "Wilmington"],
  "North Dakota": ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo"],
  "Ohio": ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton"],
  "Oklahoma": ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Lawton"],
  "Oregon": ["Portland", "Salem", "Eugene", "Gresham", "Hillsboro", "Bend"],
  "Pennsylvania": ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Lancaster"],
  "Rhode Island": ["Providence", "Warwick", "Cranston", "Pawtucket", "Newport"],
  "South Carolina": ["Charleston", "Columbia", "North Charleston", "Mount Pleasant", "Greenville", "Myrtle Beach"],
  "South Dakota": ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Deadwood"],
  "Tennessee": ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville", "Gatlinburg"],
  "Texas": ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso", "Arlington", "Corpus Christi", "Plano"],
  "Utah": ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem", "Park City", "Moab"],
  "Vermont": ["Burlington", "South Burlington", "Rutland", "Barre", "Montpelier", "Stowe"],
  "Virginia": ["Virginia Beach", "Norfolk", "Chesapeake", "Richmond", "Newport News", "Alexandria"],
  "Washington": ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kent", "Everett", "Renton", "Yakima"],
  "West Virginia": ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling"],
  "Wisconsin": ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Lake Geneva"],
  "Wyoming": ["Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs", "Jackson"],

  // Canada Provinces
  "Alberta": ["Calgary", "Edmonton", "Red Deer", "Lethbridge", "St. Albert", "Banff", "Canmore"],
  "British Columbia": ["Vancouver", "Victoria", "Surrey", "Burnaby", "Richmond", "Kelowna", "Whistler", "Kamloops"],
  "Manitoba": ["Winnipeg", "Brandon", "Steinbach", "Thompson", "Portage la Prairie"],
  "New Brunswick": ["Moncton", "Saint John", "Fredericton", "Dieppe", "Miramichi"],
  "Newfoundland and Labrador": ["St. John's", "Mount Pearl", "Corner Brook", "Conception Bay South"],
  "Northwest Territories": ["Yellowknife", "Hay River", "Inuvik", "Fort Smith"],
  "Nova Scotia": ["Halifax", "Sydney", "Truro", "New Glasgow", "Dartmouth"],
  "Nunavut": ["Iqaluit", "Rankin Inlet", "Arviat", "Baker Lake"],
  "Ontario": ["Toronto", "Ottawa", "Mississauga", "Brampton", "Hamilton", "London", "Markham", "Niagara Falls"],
  "Prince Edward Island": ["Charlottetown", "Summerside", "Stratford", "Cornwall"],
  "Quebec": ["Montreal", "Quebec City", "Laval", "Gatineau", "Longueuil", "Sherbrooke", "Mont-Tremblant"],
  "Saskatchewan": ["Saskatoon", "Regina", "Prince Albert", "Moose Jaw", "Swift Current"],
  "Yukon": ["Whitehorse", "Dawson City", "Watson Lake"]
};

// Generated photo fallbacks
const roomPhoto1 = "";
const roomPhoto2 = "";

export default function ConfigurationPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get("section") || "property";

  const [activeSection, setActiveSection] = useState(sectionFromUrl);
  const [propertySubTab, setPropertySubTab] = useState("profile"); // 'profile' | 'types' | 'rooms' | 'plans' | 'addons' | 'taxes'
  const [policySubTab, setPolicySubTab] = useState("cancellation");
  const [notificationSubTab, setNotificationSubTab] = useState("guest");

  const [toast, setToast] = useState("");

  // Room Type Drawer / Modal State (Screenshot 2)
  const [showRoomTypeDrawer, setShowRoomTypeDrawer] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState(null);

  const [typeForm, setTypeForm] = useState({
    name: "",
    roomIds: "",
    defaultAdults: "2",
    maxAdults: "2",
    maxChildren: "1",
    minChildAge: "7",
    maxChildAge: "12",
    maxInfants: "0",
    minInfantAge: "0",
    maxInfantAge: "6",
    chargeRules: "standard",
    totalOccupancy: "3",
    extraAdultPrice: "0.00",
    extraChildPrice: "0.00",
    extraInfantPrice: "0.00",
    basePrice: "0.00",
    photo: roomPhoto1,
  });

  const [nightAuditConfig, setNightAuditConfig] = useState(() => getNightAuditConfig());
  const [sequenceConfig, setSequenceConfig] = useState(() => getSequenceConfig());

  // Sync main section with URL parameter
  useEffect(() => {
    const sec = searchParams.get("section");
    if (sec) {
      setActiveSection(sec);
    }
  }, [searchParams]);

  const [isFormDirty, setIsFormDirty] = useState(false);

  function handleSectionChange(secKey) {
    if (isFormDirty && secKey !== activeSection) {
      if (!window.confirm("You have unsaved changes in this section. Switch tabs and discard edits?")) {
        return;
      }
      setIsFormDirty(false);
    }
    setActiveSection(secKey);
    setSearchParams({ section: secKey });
  }

  function triggerToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  // 1. HOTEL DETAILS / PROFILE (Starts 100% Clean)
  const [hotelProfile, setHotelProfile] = useState(() => getHotelProfile());

  // 1.1 TRANSACTION CATEGORIES (DYNAMIC SALES & EXPENSES CATEGORIES)
  const [txCategories, setTxCategories] = useState(() => getTransactionCategories());
  const [newSaleCatName, setNewSaleCatName] = useState("");
  const [newExpCatName, setNewExpCatName] = useState("");

  useEffect(() => {
    const syncCategories = () => setTxCategories(getTransactionCategories());
    window.addEventListener("pms_categories_updated", syncCategories);
    window.addEventListener("storage", syncCategories);
    return () => {
      window.removeEventListener("pms_categories_updated", syncCategories);
      window.removeEventListener("storage", syncCategories);
    };
  }, []);

  const handleAddSaleCategorySubmit = (e) => {
    if (e) e.preventDefault();
    const val = newSaleCatName.trim();
    if (!val) {
      triggerToast("⚠️ Please type a category name first.");
      return;
    }
    const currentSales = Array.isArray(txCategories?.sale) ? txCategories.sale : [];
    if (currentSales.some((c) => c.toLowerCase() === val.toLowerCase())) {
      triggerToast(`Category "${val}" already exists.`);
      return;
    }
    const updated = {
      sale: [...currentSales, val],
      expense: Array.isArray(txCategories?.expense) ? txCategories.expense : []
    };
    setTxCategories(updated);
    saveTransactionCategories(updated);
    setNewSaleCatName("");
    triggerToast(`Added Sale Category: "${val}"`);
  };

  const handleDeleteSaleCategory = (catName) => {
    if (window.confirm(`Delete Sale Category "${catName}"?`)) {
      const currentSales = Array.isArray(txCategories?.sale) ? txCategories.sale : [];
      const updated = {
        sale: currentSales.filter((c) => c !== catName),
        expense: Array.isArray(txCategories?.expense) ? txCategories.expense : []
      };
      setTxCategories(updated);
      saveTransactionCategories(updated);
      triggerToast(`Deleted Sale Category: "${catName}"`);
    }
  };

  const handleAddExpenseCategorySubmit = (e) => {
    if (e) e.preventDefault();
    const val = newExpCatName.trim();
    if (!val) {
      triggerToast("⚠️ Please type a category name first.");
      return;
    }
    const currentExpenses = Array.isArray(txCategories?.expense) ? txCategories.expense : [];
    if (currentExpenses.some((c) => c.toLowerCase() === val.toLowerCase())) {
      triggerToast(`Category "${val}" already exists.`);
      return;
    }
    const updated = {
      sale: Array.isArray(txCategories?.sale) ? txCategories.sale : [],
      expense: [...currentExpenses, val]
    };
    setTxCategories(updated);
    saveTransactionCategories(updated);
    setNewExpCatName("");
    triggerToast(`Added Expense Category: "${val}"`);
  };

  const handleDeleteExpenseCategory = (catName) => {
    if (window.confirm(`Delete Expense Category "${catName}"?`)) {
      const currentExpenses = Array.isArray(txCategories?.expense) ? txCategories.expense : [];
      const updated = {
        sale: Array.isArray(txCategories?.sale) ? txCategories.sale : [],
        expense: currentExpenses.filter((c) => c !== catName)
      };
      setTxCategories(updated);
      saveTransactionCategories(updated);
      triggerToast(`Deleted Expense Category: "${catName}"`);
    }
  };

  // 2. ROOM TYPES (Starts clean [])
  const [roomTypes, setRoomTypes] = useState(() => {
    try {
      const saved = dataStore.getItem(STORAGE_KEY_ROOM_TYPES);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // 3. PHYSICAL ROOMS INVENTORY
  const [roomsList, setRoomsList] = useState(() => {
    try {
      const saved = dataStore.getItem(STORAGE_KEY_ROOM_NUMBERS);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // 3.1 ROOMS INVENTORY SETUP
  const [showRoomDrawer, setShowRoomDrawer] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomFilterText, setRoomFilterText] = useState("");
  const [roomForm, setRoomForm] = useState({
    no: "",
    type: "",
    floor: "1",
    status: "available",
    housekeeping: "clean",
    petFriendly: false,
    nonSmoking: true,
  });

  function handleSaveRoomSubmit(e) {
    e.preventDefault();
    const roomNoStr = String(roomForm.no || "").trim();
    if (!roomNoStr) {
      triggerToast("⚠️ Please enter a room number");
      return;
    }
    const targetType = roomForm.type || roomTypes[0]?.name || "Standard";

    const newRoomObj = {
      id: editingRoom?.id || `r_${roomNoStr}`,
      no: roomNoStr,
      number: roomNoStr,
      code: roomNoStr,
      name: `Room ${roomNoStr}`,
      type: targetType,
      category: targetType,
      floor: Number(roomForm.floor) || 1,
      status: roomForm.housekeeping === "clean" ? "Clean" : (roomForm.housekeeping === "dirty" ? "Dirty" : "Maintenance"),
      housekeeping: roomForm.housekeeping || "clean",
      isClean: roomForm.housekeeping === "clean",
      petFriendly: Boolean(roomForm.petFriendly),
      nonSmoking: Boolean(roomForm.nonSmoking),
    };

    let updated;
    const existingIdx = roomsList.findIndex((r) => String(r.no).trim() === roomNoStr || r.id === newRoomObj.id);
    if (existingIdx >= 0) {
      updated = roomsList.map((r, i) => (i === existingIdx ? { ...r, ...newRoomObj } : r));
      triggerToast(`Updated Room ${roomNoStr}`);
    } else {
      updated = [...roomsList, newRoomObj];
      triggerToast(`Added Room ${roomNoStr}`);
    }

    setRoomsList(updated);
    dataStore.setItem(STORAGE_KEY_ROOM_NUMBERS, JSON.stringify(updated));
    dataStore.setItem("hotelpms_room_numbers_v3", JSON.stringify(updated));
    dataStore.setItem("hotelpms_rooms_list_v1", JSON.stringify(updated));
    saveRoomsList(updated);
    setShowRoomDrawer(false);
    setEditingRoom(null);
    window.dispatchEvent(new CustomEvent("pms_rooms_updated", { detail: updated }));
  }

  function handleDeleteRoom(roomId) {
    const target = roomsList.find((r) => r.id === roomId);
    if (!target) return;
    if (window.confirm(`Are you sure you want to delete Room ${target.no}?`)) {
      const updated = roomsList.filter((r) => r.id !== roomId);
      setRoomsList(updated);
      dataStore.setItem(STORAGE_KEY_ROOM_NUMBERS, JSON.stringify(updated));
      saveRoomsList(updated);
      window.dispatchEvent(new CustomEvent("pms_rooms_updated"));
      triggerToast(`Deleted Room ${target.no}`);
    }
  }

  // 3.2 RATE PLANS SETUP
  const [ratePlans, setRatePlans] = useState(() => getRatePlans());

  const [showRatePlanDrawer, setShowRatePlanDrawer] = useState(false);
  const [editingRatePlan, setEditingRatePlan] = useState(null);
  const [ratePlanForm, setRatePlanForm] = useState({
    name: "",
    code: "",
    description: "",
    adjustment: "0.00",
    nights: "1",
    status: "Active",
  });

  function handleSaveRatePlanSubmit(e) {
    e.preventDefault();
    if (!ratePlanForm.name) return;

    const payload = { ...ratePlanForm, nights: Math.max(1, Number(ratePlanForm.nights || 1)) };
    let updated;
    if (editingRatePlan) {
      updated = ratePlans.map((p) => (p.id === editingRatePlan.id ? { ...p, ...payload } : p));
      triggerToast(`Updated Rate Plan: ${ratePlanForm.name}`);
    } else {
      const newPlan = { id: `rp_${Date.now()}`, ...payload };
      updated = [...ratePlans, newPlan];
      triggerToast(`Created Rate Plan: ${ratePlanForm.name}`);
    }

    setRatePlans(updated);
    saveRatePlans(updated);
    window.dispatchEvent(new CustomEvent("pms_rate_plans_updated"));
    setShowRatePlanDrawer(false);
    setEditingRatePlan(null);
  }

  function handleDeleteRatePlan(id) {
    const target = ratePlans.find((p) => p.id === id);
    if (!target) return;
    if (window.confirm(`Delete Rate Plan "${target.name}"?`)) {
      const updated = ratePlans.filter((p) => p.id !== id);
      setRatePlans(updated);
      saveRatePlans(updated);
      window.dispatchEvent(new CustomEvent("pms_rate_plans_updated"));
      triggerToast(`Deleted Rate Plan: ${target.name}`);
    }
  }

  // 3.3 HOTEL ADDONS SETUP
  const [addonsList, setAddonsList] = useState(() => getHotelAddons());

  const [showAddonDrawer, setShowAddonDrawer] = useState(false);
  const [editingAddon, setEditingAddon] = useState(null);
  const [addonForm, setAddonForm] = useState({
    name: "",
    price: "",
    billingType: "Per Night",
    taxPercent: "12",
    status: "Active",
  });

  function handleSaveAddonSubmit(e) {
    e.preventDefault();
    if (!addonForm.name || !addonForm.price) return;

    let updated;
    if (editingAddon) {
      updated = addonsList.map((a) => (a.id === editingAddon.id ? { ...a, ...addonForm } : a));
      triggerToast(`Updated Addon: ${addonForm.name}`);
    } else {
      const newAddon = { id: `ad_${Date.now()}`, ...addonForm };
      updated = [...addonsList, newAddon];
      triggerToast(`Created Addon: ${addonForm.name}`);
    }

    setAddonsList(updated);
    saveHotelAddons(updated);
    window.dispatchEvent(new CustomEvent("pms_addons_updated"));
    setShowAddonDrawer(false);
    setEditingAddon(null);
  }

  function handleDeleteAddon(id) {
    const target = addonsList.find((a) => a.id === id);
    if (!target) return;
    if (window.confirm(`Delete Addon "${target.name}"?`)) {
      const updated = addonsList.filter((a) => a.id !== id);
      setAddonsList(updated);
      saveHotelAddons(updated);
      window.dispatchEvent(new CustomEvent("pms_addons_updated"));
      triggerToast(`Deleted Addon: ${target.name}`);
    }
  }

  // BOOKING ENGINE DISPLAY SETUP
  const [ibeDisplaysMap, setIbeDisplaysMap] = useState(() => getBookingEngineRoomDisplays());

  const handleIbeFieldChange = (catId, field, value) => {
    setIbeDisplaysMap((prev) => ({
      ...prev,
      [catId]: {
        ...(prev[catId] || {}),
        [field]: value,
      },
    }));
  };

  const handleIbeFileUpload = (catId, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      triggerToast("Please select a valid image file (JPG, PNG, WEBP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const updatedMap = {
        ...ibeDisplaysMap,
        [catId]: {
          ...(ibeDisplaysMap[catId] || {}),
          image: dataUrl,
        }
      };
      setIbeDisplaysMap(updatedMap);
      saveBookingEngineRoomDisplays(updatedMap);
      triggerToast("Photo uploaded successfully from desktop!");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveIbeDisplays = (e) => {
    e?.preventDefault();
    saveBookingEngineRoomDisplays(ibeDisplaysMap);
    triggerToast("✨ Booking Engine Display settings saved successfully!");
  };

  // 3.4 EMAIL & NOTIFICATIONS SETUP
  const [emailConfig, setEmailConfig] = useState(() => getEmailConfig());
  const [guestNotifications, setGuestNotifications] = useState(() => getGuestNotifications());
  const [hotelierNotifications, setHotelierNotifications] = useState(() => getHotelierNotifications());
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState(null);

  function handleSaveEmailConfig(e) {
    e?.preventDefault();
    saveEmailConfig(emailConfig);
    triggerToast("Saved Email Server Gateway Configuration!");
  }

  function handleSendTestEmail() {
    setTestEmailSending(true);
    setTestEmailStatus(null);
    setTimeout(() => {
      setTestEmailSending(false);
      const modeText = (emailConfig.sendingMode || "builtin") === "custom_smtp"
        ? `Custom SMTP Server (${emailConfig.smtpHost || "Custom SMTP"})`
        : `Built-in PMS Cloud Gateway (AWS SES)`;
      setTestEmailStatus({
        type: "success",
        text: `✅ Test email successfully sent via ${modeText} to ${emailConfig.fromEmail || "hotel email"}!`
      });
      triggerToast("Test email sent successfully!");
    }, 1200);
  }

  function handleSaveGuestNotifications(e) {
    e?.preventDefault();
    saveGuestNotifications(guestNotifications);
    triggerToast("Saved Guest Notification Templates & Triggers!");
  }

  function handleSaveHotelierNotifications(e) {
    e?.preventDefault();
    saveHotelierNotifications(hotelierNotifications);
    triggerToast("Saved Hotelier Internal Alert Settings!");
  }

  function insertGuestTag(templateKey, tag) {
    setGuestNotifications((prev) => {
      const currentBody = prev[templateKey]?.body || "";
      return {
        ...prev,
        [templateKey]: {
          ...prev[templateKey],
          body: currentBody + (currentBody ? " " : "") + tag
        }
      };
    });
  }

  const [usersList, setUsersList] = useState(() => getUsers());
  const [rolesList, setRolesList] = useState(() => getRoles());

  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    rights: { ...DEFAULT_USER_RIGHTS }
  });

  const [showUserDrawer, setShowUserDrawer] = useState(false);
  const [isHousekeeperDrawer, setIsHousekeeperDrawer] = useState(false);
  const [showCustomRights, setShowCustomRights] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPasswordInUserForm, setShowPasswordInUserForm] = useState(false);

  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    role: "Front Desk Staff",
    status: "Active",
    rights: { ...DEFAULT_USER_RIGHTS }
  });

  const handleOpenAddUserDrawer = () => {
    setEditingUser(null);
    setIsHousekeeperDrawer(false);
    setShowCustomRights(false);
    const defaultRole = rolesList.find((r) => r.name === "Front Desk Staff") || rolesList[0];
    const initialRights = defaultRole?.rights ? { ...defaultRole.rights } : { ...DEFAULT_USER_RIGHTS };

    setUserForm({
      username: "",
      password: "",
      name: "",
      email: "",
      role: defaultRole?.name || "Front Desk Staff",
      status: "Active",
      rights: initialRights
    });
    setShowPasswordInUserForm(false);
    setShowUserDrawer(true);
  };

  const handleOpenAddHousekeeperDrawer = () => {
    setEditingUser(null);
    setIsHousekeeperDrawer(true);
    setShowCustomRights(false);
    const hkRole = rolesList.find((r) => r.name?.toLowerCase() === "housekeeper");
    const hkRights = hkRole?.rights ? { ...hkRole.rights } : { ...DEFAULT_USER_RIGHTS, frontDesk: false, housekeeping: true };

    setUserForm({
      username: "",
      password: "",
      name: "",
      email: "",
      role: "Housekeeper",
      status: "Active",
      rights: hkRights
    });
    setShowPasswordInUserForm(false);
    setShowUserDrawer(true);
  };

  const handleRoleChangeInUserForm = (newRoleName) => {
    const matchedRole = rolesList.find((r) => r.name?.toLowerCase() === newRoleName.toLowerCase());
    const roleRights = matchedRole?.rights
      ? { ...matchedRole.rights }
      : (newRoleName === "Manager" || newRoleName === "System Admin")
      ? { ...ALL_YES_RIGHTS }
      : { ...DEFAULT_USER_RIGHTS };

    setUserForm((prev) => ({
      ...prev,
      role: newRoleName,
      rights: roleRights
    }));
  };

  const handleOpenAddRoleModal = () => {
    setEditingRole(null);
    setRoleForm({
      name: "",
      description: "",
      rights: { ...DEFAULT_USER_RIGHTS }
    });
    setShowAddRoleModal(true);
  };

  const handleOpenEditRoleModal = (roleObj) => {
    setEditingRole(roleObj);
    setRoleForm({
      name: roleObj.name || "",
      description: roleObj.description || "",
      rights: roleObj.rights ? { ...roleObj.rights } : { ...DEFAULT_USER_RIGHTS }
    });
    setShowAddRoleModal(true);
  };

  const handleSaveRoleSubmit = (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      triggerToast("Please enter a Role Name.");
      return;
    }
    const cleanName = roleForm.name.trim();

    let updated;
    if (editingRole) {
      updated = rolesList.map((r) => (r.id === editingRole.id ? { ...r, ...roleForm, name: cleanName } : r));
      triggerToast(`Role "${cleanName}" permissions updated!`);
    } else {
      const exists = rolesList.some((r) => r.name?.toLowerCase() === cleanName.toLowerCase());
      if (exists) {
        triggerToast(`Role "${cleanName}" already exists.`);
        return;
      }
      const newRole = {
        id: `role_${Date.now()}`,
        name: cleanName,
        description: roleForm.description.trim() || `${cleanName} System Role`,
        isBuiltIn: false,
        rights: { ...roleForm.rights }
      };
      updated = [...rolesList, newRole];
      triggerToast(`Role "${cleanName}" created successfully!`);
    }

    setRolesList(updated);
    saveRoles(updated);
    setShowAddRoleModal(false);
    setEditingRole(null);
  };

  const handleDeleteRole = (roleId) => {
    const target = rolesList.find((r) => r.id === roleId);
    if (!target) return;
    if (target.isBuiltIn) {
      triggerToast("Built-in system roles cannot be deleted.");
      return;
    }
    if (window.confirm(`Delete role "${target.name}"?`)) {
      const updated = rolesList.filter((r) => r.id !== roleId);
      setRolesList(updated);
      saveRoles(updated);
      triggerToast(`Deleted role: ${target.name}`);
    }
  };

  const handleOpenEditUserDrawer = (userObj) => {
    setEditingUser(userObj);
    setIsHousekeeperDrawer(userObj.role?.toLowerCase() === "housekeeper");
    setShowCustomRights(false);
    const initialRights = userObj.rights
      ? { ...DEFAULT_USER_RIGHTS, ...userObj.rights }
      : (userObj.role === "Manager" || userObj.role === "System Admin" || userObj.username === "admin"
        ? { ...ALL_YES_RIGHTS }
        : { ...DEFAULT_USER_RIGHTS });

    setUserForm({
      username: userObj.username || "",
      password: userObj.password || "",
      name: userObj.name || "",
      email: userObj.email || "",
      role: userObj.role || "Front Desk Staff",
      status: userObj.status || "Active",
      rights: initialRights
    });
    setShowPasswordInUserForm(false);
    setShowUserDrawer(true);
  };

  const handleSaveUserSubmit = (e) => {
    e.preventDefault();
    if (!userForm.username.trim() || !userForm.password.trim() || !userForm.name.trim()) {
      triggerToast("Please fill in Username, Password, and Full Name.");
      return;
    }

    const cleanUsername = userForm.username.trim().toLowerCase().replace(/\s+/g, "_");

    if (!editingUser) {
      const exists = usersList.some((u) => u.username?.toLowerCase() === cleanUsername);
      if (exists) {
        triggerToast(`Username "${cleanUsername}" is already taken. Please choose another.`);
        return;
      }
    }

    let updated;
    if (editingUser) {
      updated = usersList.map((u) =>
        u.id === editingUser.id
          ? {
              ...u,
              ...userForm,
              username: cleanUsername,
              email: userForm.email.trim(),
              name: userForm.name.trim(),
            }
          : u
      );
      triggerToast(`User "${userForm.name}" updated successfully!`);
    } else {
      const newUser = {
        id: `usr_${Date.now()}`,
        ...userForm,
        username: cleanUsername,
        email: userForm.email.trim(),
        name: userForm.name.trim(),
        createdAt: new Date().toISOString(),
      };
      updated = [newUser, ...usersList];
      triggerToast(`New user account "${userForm.name}" created!`);
    }

    setUsersList(updated);
    saveUsers(updated);
    setShowUserDrawer(false);
  };

  const handleDeleteUser = (id) => {
    const target = usersList.find((u) => u.id === id);
    if (!target) return;
    if (target.username === "admin") {
      triggerToast("Cannot delete primary system Administrator account.");
      return;
    }
    if (window.confirm(`Delete user account "${target.name}" (@${target.username})?`)) {
      const updated = usersList.filter((u) => u.id !== id);
      setUsersList(updated);
      saveUsers(updated);
      triggerToast(`Deleted user account: ${target.name}`);
    }
  };

  // YIELD MANAGEMENT & DYNAMIC PRICING SETUP
  const [yieldEnabled, setYieldEnabled] = useState(() => getYieldManagementStatus());
  const [yieldRulesList, setYieldRulesList] = useState(() => getYieldRules());
  const [simulatedOcc, setSimulatedOcc] = useState(75);
  const [simulatedBaseRate, setSimulatedBaseRate] = useState(150);

  const [showYieldDrawer, setShowYieldDrawer] = useState(false);
  const [editingYieldRule, setEditingYieldRule] = useState(null);
  const [yieldForm, setYieldForm] = useState({
    name: "",
    minOccupancy: "60",
    maxOccupancy: "80",
    adjustmentType: "percentage",
    adjustmentValue: "15",
    appliesTo: "All",
    status: "Active",
    minStayDays: "1",
  });

  const handleToggleYieldMaster = () => {
    const next = !yieldEnabled;
    setYieldEnabled(next);
    setYieldManagementStatus(next);
    triggerToast(next ? "🟢 Yield Management Auto-Pricing Enabled!" : "⏸️ Yield Management Auto-Pricing Paused!");
  };

  const handleOpenAddYieldDrawer = () => {
    setEditingYieldRule(null);
    setYieldForm({
      name: "",
      minOccupancy: "60",
      maxOccupancy: "80",
      adjustmentType: "percentage",
      adjustmentValue: "15",
      appliesTo: "All",
      status: "Active",
      minStayDays: "1",
    });
    setShowYieldDrawer(true);
  };

  const handleOpenEditYieldDrawer = (ruleObj) => {
    setEditingYieldRule(ruleObj);
    setYieldForm({
      name: ruleObj.name || "",
      minOccupancy: String(ruleObj.minOccupancy ?? "60"),
      maxOccupancy: String(ruleObj.maxOccupancy ?? "80"),
      adjustmentType: ruleObj.adjustmentType || "percentage",
      adjustmentValue: String(ruleObj.adjustmentValue ?? "15"),
      appliesTo: ruleObj.appliesTo || "All",
      status: ruleObj.status || "Active",
      minStayDays: String(ruleObj.minStayDays ?? "1"),
    });
    setShowYieldDrawer(true);
  };

  const handleSaveYieldSubmit = (e) => {
    e.preventDefault();
    if (!yieldForm.name.trim()) {
      triggerToast("Please enter a Yield Rule Name.");
      return;
    }

    const payload = {
      ...yieldForm,
      minOccupancy: Math.max(0, Math.min(100, Number(yieldForm.minOccupancy || 0))),
      maxOccupancy: Math.max(0, Math.min(100, Number(yieldForm.maxOccupancy || 100))),
      adjustmentValue: Number(yieldForm.adjustmentValue || 0),
      minStayDays: Math.max(1, Number(yieldForm.minStayDays || 1)),
    };

    let updated;
    if (editingYieldRule) {
      updated = yieldRulesList.map((r) => (r.id === editingYieldRule.id ? { ...r, ...payload } : r));
      triggerToast(`Updated Yield Rule: "${yieldForm.name}"`);
    } else {
      const newRule = {
        id: `yr_${Date.now()}`,
        ...payload,
      };
      updated = [...yieldRulesList, newRule];
      triggerToast(`Created Yield Rule: "${yieldForm.name}"`);
    }

    setYieldRulesList(updated);
    saveYieldRules(updated);
    setShowYieldDrawer(false);
  };

  const handleDeleteYieldRule = (id) => {
    const target = yieldRulesList.find((r) => r.id === id);
    if (!target) return;
    if (window.confirm(`Delete Yield Tier Rule "${target.name}"?`)) {
      const updated = yieldRulesList.filter((r) => r.id !== id);
      setYieldRulesList(updated);
      saveYieldRules(updated);
      triggerToast(`Deleted Yield Rule: ${target.name}`);
    }
  };

  // 3.4 TAXES SETUP
  const [taxRules, setTaxRules] = useState(() => getTaxRules());
  const [isTaxInclusive, setIsTaxInclusive] = useState(() => getTaxInclusiveSetting());

  function handleToggleTaxInclusive(newVal) {
    setIsTaxInclusive(newVal);
    saveTaxInclusiveSetting(newVal);
    triggerToast(`Tax Mode updated to: ${newVal ? "Tax Inclusive" : "Tax Exclusive"}`);
  }

  const [showTaxDrawer, setShowTaxDrawer] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [taxForm, setTaxForm] = useState({
    name: "",
    code: "",
    taxType: "percentage",
    percent: "12.00",
    fixedAmount: "5.00",
    fixedCalculation: "per_night",
    appliesTo: "Room Tariff",
    status: "Active",
  });

  function handleSaveTaxSubmit(e) {
    e.preventDefault();
    if (!taxForm.name) return;
    if (taxForm.taxType === "fixed" && (!taxForm.fixedAmount || parseFloat(taxForm.fixedAmount) <= 0)) return;
    if (taxForm.taxType !== "fixed" && (!taxForm.percent || parseFloat(taxForm.percent) < 0)) return;

    let updated;
    if (editingTax) {
      updated = taxRules.map((t) => (t.id === editingTax.id ? { ...t, ...taxForm } : t));
      triggerToast(`Updated Tax Rule: ${taxForm.name}`);
    } else {
      const newTax = { id: `tx_${Date.now()}`, ...taxForm };
      updated = [...taxRules, newTax];
      triggerToast(`Created Tax Rule: ${taxForm.name}`);
    }

    setTaxRules(updated);
    saveTaxRules(updated);
    window.dispatchEvent(new CustomEvent("pms_taxes_updated"));
    setShowTaxDrawer(false);
    setEditingTax(null);
  }

  function handleDeleteTax(id) {
    const target = taxRules.find((t) => t.id === id);
    if (!target) return;
    if (window.confirm(`Delete Tax Rule "${target.name}"?`)) {
      const updated = taxRules.filter((t) => t.id !== id);
      setTaxRules(updated);
      saveTaxRules(updated);
      window.dispatchEvent(new CustomEvent("pms_taxes_updated"));
      triggerToast(`Deleted Tax Rule: ${target.name}`);
    }
  }

  // 3.4.5 BUSINESS SOURCES (MARKET & SUB-SEGMENTS)
  const [businessSourcesList, setBusinessSourcesList] = useState(() => getBusinessSources());
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [sourceForm, setSourceForm] = useState({ id: "", segment: "", subSegmentsText: "" });
  const [companyAccountsState, setCompanyAccountsState] = useState(() => getCompanyAccounts());
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);

  function openCompanyModal(comp = null) {
    setEditingCompany(comp);
    setShowCompanyModal(true);
  }

  function closeCompanyModal() {
    setShowCompanyModal(false);
    setEditingCompany(null);
  }

  useEffect(() => {
    function handleSyncSources() {
      setBusinessSourcesList(getBusinessSources());
    }
    function handleSyncCompanies() {
      setCompanyAccountsState(getCompanyAccounts());
    }
    handleSyncCompanies();
    handleSyncSources();
    window.addEventListener("pms_business_sources_updated", handleSyncSources);
    window.addEventListener("pms_company_accounts_updated", handleSyncCompanies);
    return () => {
      window.removeEventListener("pms_business_sources_updated", handleSyncSources);
      window.removeEventListener("pms_company_accounts_updated", handleSyncCompanies);
    };
  }, [propertySubTab]);

  // 3.5 CANCELLATION POLICIES SETUP
  const [cancellationPolicies, setCancellationPolicies] = useState(() => getCancellationPolicies());
  const [showCancelDrawer, setShowCancelDrawer] = useState(false);
  const [editingCancelPolicy, setEditingCancelPolicy] = useState(null);
  const [cancelForm, setCancelForm] = useState({
    name: "",
    noticeHours: "24",
    refundType: "full_refund",
    description: "",
    isDefault: false,
  });

  function handleSaveCancelPolicySubmit(e) {
    e.preventDefault();
    if (!cancelForm.name) return;

    let updated;
    const isDefault = Boolean(cancelForm.isDefault);
    const payload = {
      ...cancelForm,
      noticeHours: Number(cancelForm.noticeHours || 24),
      isDefault,
    };

    if (editingCancelPolicy) {
      updated = cancellationPolicies.map((p) => {
        if (p.id === editingCancelPolicy.id) return { ...p, ...payload };
        return isDefault ? { ...p, isDefault: false } : p;
      });
      triggerToast(`Updated Cancellation Policy: ${cancelForm.name}`);
    } else {
      const newPolicy = { id: `cp_${Date.now()}`, ...payload };
      if (isDefault || cancellationPolicies.length === 0) {
        newPolicy.isDefault = true;
        updated = cancellationPolicies.map((p) => ({ ...p, isDefault: false }));
        updated.push(newPolicy);
      } else {
        updated = [...cancellationPolicies, newPolicy];
      }
      triggerToast(`Created Cancellation Policy: ${cancelForm.name}`);
    }

    setCancellationPolicies(updated);
    saveCancellationPolicies(updated);
    setShowCancelDrawer(false);
    setEditingCancelPolicy(null);
  }

  function handleDeleteCancelPolicy(id) {
    const target = cancellationPolicies.find((p) => p.id === id);
    if (!target) return;
    if (window.confirm(`Delete cancellation policy "${target.name}"?`)) {
      const updated = cancellationPolicies.filter((p) => p.id !== id);
      setCancellationPolicies(updated);
      saveCancellationPolicies(updated);
      triggerToast(`Deleted Cancellation Policy: ${target.name}`);
    }
  }

  // 3.6 HOTEL TERMS & CONDITIONS / HOUSE RULES
  const [hotelTermsText, setHotelTermsText] = useState(() => getHotelTerms());

  function handleSaveTermsSubmit(e) {
    e.preventDefault();
    saveHotelTerms(hotelTermsText);
    triggerToast("Saved Hotel Policy & Terms & Conditions!");
  }

  // 3.6.5 STATUS COLOR SETUP
  const [colorSubTab, setColorSubTab] = useState("tape_chart");
  const [statusColors, setStatusColors] = useState(() => getStatusColors());
  const [activityColors, setActivityColors] = useState(() => getActivityColors());
  const [hkColors, setHkColors] = useState(() => getHkColors());

  const handleSaveStatusColors = (e) => {
    if (e) e.preventDefault();
    saveStatusColors(statusColors);
    triggerToast("🎨 Status colors updated & synchronized live across all calendars!");
  };

  const handleResetStatusColors = () => {
    if (window.confirm("Reset status colors to default factory colors?")) {
      setStatusColors({ ...DEFAULT_STATUS_COLORS });
      saveStatusColors({ ...DEFAULT_STATUS_COLORS });
      triggerToast("🔄 Reset status colors to factory defaults.");
    }
  };

  const handleSaveActivityColors = (e) => {
    if (e) e.preventDefault();
    saveActivityColors(activityColors);
    triggerToast("🎨 Activity status card colors updated!");
  };

  const handleResetActivityColors = () => {
    if (window.confirm("Reset activity colors to default factory colors?")) {
      setActivityColors({ ...DEFAULT_ACTIVITY_COLORS });
      saveActivityColors({ ...DEFAULT_ACTIVITY_COLORS });
      triggerToast("🔄 Reset activity colors to factory defaults.");
    }
  };

  const handleSaveHkColors = (e) => {
    if (e) e.preventDefault();
    saveHkColors(hkColors);
    triggerToast("🎨 Housekeeping summary box colors updated!");
  };

  const handleResetHkColors = () => {
    if (window.confirm("Reset housekeeping colors to default factory colors?")) {
      setHkColors({ ...DEFAULT_HK_COLORS });
      saveHkColors({ ...DEFAULT_HK_COLORS });
      triggerToast("🔄 Reset housekeeping colors to factory defaults.");
    }
  };

  // Initial load sync
  useEffect(() => {
    async function loadData() {
      try {
        const [rData, tData] = await Promise.all([getRooms(), getRoomTypes()]);
        setRoomsList(Array.isArray(rData) ? rData : []);
        setRoomTypes(Array.isArray(tData) ? tData : []);
      } catch (e) {
        console.error("Config load error:", e);
      }
    }
    loadData();
    window.addEventListener("pms_rooms_updated", loadData);
    window.addEventListener("storage", loadData);
    return () => {
      window.removeEventListener("pms_rooms_updated", loadData);
      window.removeEventListener("storage", loadData);
    };
  }, []);

  function saveProfile(p) {
    setHotelProfile(p);
    saveHotelProfile(p);
  }

  // Handle Save Room Type Drawer Form
  function handleSaveTypeSubmit(e) {
    e.preventDefault();
    if (!typeForm.name) return;

    const baseVal = Number(typeForm.basePrice || typeForm.price || 0);

    if (editingRoomType) {
      const updated = roomTypes.map((t) =>
        t.id === editingRoomType.id
          ? {
              ...t,
              name: typeForm.name,
              roomIds: typeForm.roomIds,
              defaultAdults: Number(typeForm.defaultAdults) || 2,
              maxAdults: Number(typeForm.maxAdults) || 2,
              maxChildren: Number(typeForm.maxChildren) || 1,
              occupancy: Number(typeForm.maxOccupancy) || 3,
              basePrice: baseVal,
              price: baseVal,
              extraPersonRate: Number(typeForm.extraAdultPrice) || 0,
              extraAdultPrice: Number(typeForm.extraAdultPrice) || 0,
              extraAdultRate: Number(typeForm.extraAdultPrice) || 0,
              extraChildRate: Number(typeForm.extraChildPrice) || 0,
              extraChildPrice: Number(typeForm.extraChildPrice) || 0,
              image: typeForm.image || typeForm.photo || t.image || "",
              isVirtual: Boolean(typeForm.isVirtual),
              isStaffRoom: Boolean(typeForm.isVirtual),
            }
          : t
      );
      setRoomTypes(updated);
      dataStore.setItem(STORAGE_KEY_ROOM_TYPES, JSON.stringify(updated));
      saveRoomTypes(updated);
      triggerToast(`Updated Room Type: ${typeForm.name}`);
    } else {
      const newType = {
        id: `rt_${Date.now()}`,
        name: typeForm.name,
        roomIds: typeForm.roomIds,
        image: typeForm.image || typeForm.photo || "",
        defaultAdults: Number(typeForm.defaultAdults) || 2,
        maxAdults: Number(typeForm.maxAdults) || 2,
        maxChildren: Number(typeForm.maxChildren) || 1,
        occupancy: Number(typeForm.maxOccupancy) || 3,
        basePrice: baseVal,
        price: baseVal,
        extraPersonRate: Number(typeForm.extraAdultPrice) || 0,
        extraAdultPrice: Number(typeForm.extraAdultPrice) || 0,
        extraAdultRate: Number(typeForm.extraAdultPrice) || 0,
        extraChildRate: Number(typeForm.extraChildPrice) || 0,
        extraChildPrice: Number(typeForm.extraChildPrice) || 0,
        isVirtual: Boolean(typeForm.isVirtual),
        isStaffRoom: Boolean(typeForm.isVirtual),
      };
      const updated = [...roomTypes, newType];
      setRoomTypes(updated);
      dataStore.setItem(STORAGE_KEY_ROOM_TYPES, JSON.stringify(updated));
      saveRoomTypes(updated);
      triggerToast(`Created Room Type: ${typeForm.name}`);
    }

    // Auto generate physical rooms if IDs provided
    if (typeForm.roomIds && typeForm.roomIds.trim()) {
      const parsedIds = typeForm.roomIds.split(",").map((s) => s.trim()).filter(Boolean);
      let updatedRooms = [...roomsList];
      parsedIds.forEach((rNo) => {
        const existingIdx = updatedRooms.findIndex((r) => String(r.no).trim() === String(rNo).trim());
        const roomObj = {
          id: existingIdx >= 0 ? updatedRooms[existingIdx].id : `r_${rNo}`,
          no: String(rNo),
          type: typeForm.name,
          floor: 1,
          status: "available",
          housekeeping: "clean",
        };
        if (existingIdx >= 0) updatedRooms[existingIdx] = roomObj;
        else updatedRooms.push(roomObj);
      });
      setRoomsList(updatedRooms);
      dataStore.setItem(STORAGE_KEY_ROOM_NUMBERS, JSON.stringify(updatedRooms));
      saveRoomsList(updatedRooms);
    }

    setShowRoomTypeDrawer(false);
    setEditingRoomType(null);
    window.dispatchEvent(new CustomEvent("pms_rooms_updated"));
  }

  // Calculated tariff with dynamic configured taxes
  const activeTaxPercent = getActiveTaxPercent();
  const activeTaxes = useMemo(() => taxRules.filter((t) => t.status === "Active"), [taxRules]);

  const selectedTaxPercent = useMemo(() => {
    if (!typeForm.taxCategory || typeForm.taxCategory === "active_total") {
      return activeTaxPercent;
    }
    if (typeForm.taxCategory === "exempt") return 0;
    const parsed = parseFloat(typeForm.taxCategory);
    return isNaN(parsed) ? activeTaxPercent : parsed;
  }, [typeForm.taxCategory, activeTaxPercent]);

  const computedTariffWithTax = (
    Number(typeForm.tariff || 0) * (1 + selectedTaxPercent / 100)
  ).toFixed(2);

  function handleDeleteType(typeId) {
    const target = roomTypes.find((t) => t.id === typeId);
    if (!target) return;
    if (window.confirm(`Delete Room Type "${target.name}"?`)) {
      const updated = roomTypes.filter((t) => t.id !== typeId);
      setRoomTypes(updated);
      dataStore.setItem(STORAGE_KEY_ROOM_TYPES, JSON.stringify(updated));
      saveRoomTypes(updated);
      window.dispatchEvent(new CustomEvent("pms_rooms_updated"));
      triggerToast(`Deleted Room Type: ${target.name}`);
    }
  }

  async function handleClearAllTypes() {
    if (!window.confirm("Are you sure you want to purge ALL data and start 100% clean slate?")) return;
    try {
      const emptyProfile = {
        name: "",
        website: "",
        taxId: "",
        totalRooms: "",
        contactName: "",
        currency: "US Dollar ($)",
        phone: "",
        email: "",
        city: "",
        state: "",
        country: "",
        address: "",
        zipcode: "",
        latitude: "",
        longitude: "",
        rating: 0,
      };
      setHotelProfile(emptyProfile);
      saveProfile(emptyProfile);

      // Call API reset for backend/MongoDB Atlas
      await resetSystemData();

      // Clear local storage and reset all state arrays
      resetAllData();
      try {
        dataStore.clear();
        dataStore.setItem(STORAGE_KEY_HOTEL_INFO, JSON.stringify(emptyProfile));
        dataStore.setItem(STORAGE_KEY_ROOM_TYPES, "[]");
        dataStore.setItem(STORAGE_KEY_ROOM_NUMBERS, "[]");
        dataStore.setItem(STORAGE_KEY_RATE_PLANS, "[]");
        dataStore.setItem(STORAGE_KEY_ADDONS, "[]");
        dataStore.setItem(STORAGE_KEY_TAXES, "[]");
      } catch {}

      setRoomTypes([]);
      setRoomsList([]);
      setRatePlans([]);
      setAddonsList([]);
      setTaxRules([]);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pms_rooms_updated"));
        window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
        window.dispatchEvent(new CustomEvent("pms_taxes_updated"));
        window.dispatchEvent(new CustomEvent("pms_rate_plans_updated"));
        window.dispatchEvent(new CustomEvent("pms_addons_updated"));
        window.dispatchEvent(new CustomEvent("storage"));
      }

      triggerToast("🧹 All data & hotel profile successfully reset! System is now a 100% clean slate.");
    } catch (e) {
      console.error("Error performing full reset", e);
      triggerToast("❌ Error performing full reset: " + e.message);
    }
  }

  return (
    <div className="config-workspace-container">
      {/* LEFT NAVIGATION SIDEBAR EXACTLY MATCHING USER REQUEST */}
      <aside className="config-sidebar">
        <div className="config-sidebar-header">
          <h3>⚙️ Setup &amp; Configuration</h3>
        </div>

        <nav className="config-sidebar-nav">
          {/* SECTION 1: PROPERTY SETUP */}
          <div className="nav-group">
            <button
              type="button"
              className={`config-nav-item ${activeSection === "property" ? "active" : ""}`}
              onClick={() => handleSectionChange("property")}
            >
              <div className="config-nav-item-left">
                <span className="config-nav-icon">🏛️</span>
                <span className="config-nav-label">1) Property Setup</span>
              </div>
              <span className="config-nav-chevron">{activeSection === "property" ? "▲" : "▼"}</span>
            </button>

            {activeSection === "property" && (
              <div className="nav-sub-list">
                <button type="button" className={`nav-sub-item ${propertySubTab === "profile" ? "active" : ""}`} onClick={() => setPropertySubTab("profile")}>
                  • Property Details
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "types" ? "active" : ""}`} onClick={() => setPropertySubTab("types")}>
                  • Room Type
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "rooms" ? "active" : ""}`} onClick={() => setPropertySubTab("rooms")}>
                  • Rooms
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "sequences" ? "active" : ""}`} onClick={() => setPropertySubTab("sequences")}>
                  • Document Numbering
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "plans" ? "active" : ""}`} onClick={() => setPropertySubTab("plans")}>
                  • Rate Plans
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "addons" ? "active" : ""}`} onClick={() => setPropertySubTab("addons")}>
                  • Hotel Addons
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "taxes" ? "active" : ""}`} onClick={() => setPropertySubTab("taxes")}>
                  • Taxes
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "sources" ? "active" : ""}`} onClick={() => setPropertySubTab("sources")}>
                  • Business Source
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "categories" ? "active" : ""}`} onClick={() => setPropertySubTab("categories")}>
                  • Transaction Categories 🏷️
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "ibeDisplay" ? "active" : ""}`} onClick={() => setPropertySubTab("ibeDisplay")}>
                  • Booking Engine Display
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "users" ? "active" : ""}`} onClick={() => setPropertySubTab("users")}>
                  • User Management
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "roles" ? "active" : ""}`} onClick={() => setPropertySubTab("roles")}>
                  • Role Setup &amp; Rights
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "yield" ? "active" : ""}`} onClick={() => setPropertySubTab("yield")}>
                  • Yield &amp; Dynamic Pricing
                </button>
                <button type="button" className={`nav-sub-item ${propertySubTab === "colors" ? "active" : ""}`} onClick={() => setPropertySubTab("colors")}>
                  • Color Setup
                </button>
                <Link to="/channel-manager" className="nav-sub-item" style={{ textDecoration: "none", display: "block" }}>
                  • OTA Channel Sync 🌐
                </Link>
              </div>
            )}
          </div>

          {/* SECTION 2: POLICIES */}
          <div className="nav-group">
            <button
              type="button"
              className={`config-nav-item ${activeSection === "policies" ? "active" : ""}`}
              onClick={() => handleSectionChange("policies")}
            >
              <div className="config-nav-item-left">
                <span className="config-nav-icon">📜</span>
                <span className="config-nav-label">2) Policies</span>
              </div>
              <span className="config-nav-chevron">{activeSection === "policies" ? "▲" : "▼"}</span>
            </button>

            {activeSection === "policies" && (
              <div className="nav-sub-list">
                <button type="button" className={`nav-sub-item ${policySubTab === "cancellation" ? "active" : ""}`} onClick={() => setPolicySubTab("cancellation")}>
                  • Cancellation Policies
                </button>
                <button type="button" className={`nav-sub-item ${policySubTab === "terms" ? "active" : ""}`} onClick={() => setPolicySubTab("terms")}>
                  • Terms and Conditions
                </button>
              </div>
            )}
          </div>

          {/* SECTION 3: NOTIFICATIONS */}
          <div className="nav-group">
            <button
              type="button"
              className={`config-nav-item ${activeSection === "notifications" ? "active" : ""}`}
              onClick={() => handleSectionChange("notifications")}
            >
              <div className="config-nav-item-left">
                <span className="config-nav-icon">🔔</span>
                <span className="config-nav-label">3) Notifications</span>
              </div>
              <span className="config-nav-chevron">{activeSection === "notifications" ? "▲" : "▼"}</span>
            </button>

            {activeSection === "notifications" && (
              <div className="nav-sub-list">
                <button type="button" className={`nav-sub-item ${notificationSubTab === "guest" ? "active" : ""}`} onClick={() => setNotificationSubTab("guest")}>
                  • Guest Notification
                </button>
                <button type="button" className={`nav-sub-item ${notificationSubTab === "hotelier" ? "active" : ""}`} onClick={() => setNotificationSubTab("hotelier")}>
                  • Hotelier Notification
                </button>
              </div>
            )}
          </div>

          {/* SECTION 4: DATA IMPORT & MIGRATION */}
          <div className="nav-group">
            <button
              type="button"
              className={`config-nav-item ${activeSection === "data_import" ? "active" : ""}`}
              onClick={() => handleSectionChange("data_import")}
            >
              <div className="config-nav-item-left">
                <span className="config-nav-icon">📥</span>
                <span className="config-nav-label">4) Data Import / Export &amp; Reset</span>
              </div>
            </button>
          </div>

          {/* SECTION 5: US PAYMENT GATEWAYS */}
          <div className="nav-group">
            <button
              type="button"
              className={`config-nav-item ${activeSection === "payment_gateways" ? "active" : ""}`}
              onClick={() => handleSectionChange("payment_gateways")}
            >
              <div className="config-nav-item-left">
                <span className="config-nav-icon">💳</span>
                <span className="config-nav-label">5) US Payment Gateways</span>
              </div>
            </button>
          </div>
        </nav>
      </aside>

      {/* RIGHT WORKSPACE AREA */}
      <main className="config-main-workspace">
        {/* TOAST ALERT */}
        {toast && <div className="config-toast">✨ {toast}</div>}

        {/* ---------------------------------------------------- */}
        {/* 1. PROPERTY SETUP CONTENT                            */}
        {/* ---------------------------------------------------- */}
        {activeSection === "property" && (
          <div className="config-tab-workspace">

            {/* 1.1 PROPERTY DETAILS (1:1 MATCH WITH SCREENSHOT 1) */}
            {propertySubTab === "profile" && (
              <div className="config-section">
                {/* HEADER BAR WITH CANCEL / EDIT HOTEL DETAILS / SAVE BUTTON */}
                <div className="edit-details-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="cancel-link" onClick={() => triggerToast("Cancelled changes")}>Cancel</span>
                  <h2 className="edit-details-title">Edit Hotel Details</h2>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                      type="button"
                      style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "8px", padding: "8px 14px", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}
                      onClick={handleClearAllTypes}
                    >
                      🧹 Purge All Data (Start Clean Slate)
                    </button>
                    <button
                      type="button"
                      className="btn-lg-grey cr-submit-primary"
                      onClick={() => {
                        saveProfile(hotelProfile);
                        triggerToast("Saved Hotel Details!");
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>

                <form
                  autoComplete="off"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveProfile(hotelProfile);
                    triggerToast("Saved Hotel Details!");
                  }}
                  className="hotel-details-form"
                >
                  <div className="float-form-grid">
                    {/* ROW 1 */}
                    <div className="float-input-box">
                      <label className="float-label">Property Name</label>
                      <input
                        type="text"
                        value={hotelProfile.name}
                        onChange={(e) => setHotelProfile({ ...hotelProfile, name: e.target.value })}
                      />
                    </div>
                    <div className="float-input-box">
                      <label className="float-label">Property Official Website</label>
                      <input
                        type="text"
                        value={hotelProfile.website}
                        onChange={(e) => setHotelProfile({ ...hotelProfile, website: e.target.value })}
                      />
                    </div>

                    {/* ROW 2 */}
                    <div className="float-input-box">
                      <label className="float-label">Tax Identification Number</label>
                      <input
                        type="text"
                        value={hotelProfile.taxId}
                        onChange={(e) => setHotelProfile({ ...hotelProfile, taxId: e.target.value })}
                      />
                    </div>
                    <div className="float-input-box">
                      <label className="float-label">Total Room Count</label>
                      <input
                        type="text"
                        value={hotelProfile.totalRooms}
                        onChange={(e) => setHotelProfile({ ...hotelProfile, totalRooms: e.target.value })}
                      />
                    </div>

                    {/* ROW 3 */}
                    <div className="float-input-box">
                      <label className="float-label">Property Contact Name</label>
                      <input
                        type="text"
                        value={hotelProfile.contactName}
                        onChange={(e) => setHotelProfile({ ...hotelProfile, contactName: e.target.value })}
                      />
                    </div>
                    <div className="float-input-box">
                      <label className="float-label">Property Currency</label>
                      <select
                        value={hotelProfile.currency}
                        onChange={(e) => setHotelProfile({ ...hotelProfile, currency: e.target.value })}
                      >
                        <option value="US Dollar ($)">US Dollar ($)</option>
                        <option value="Canadian Dollar ($)">Canadian Dollar ($)</option>
                      </select>
                    </div>

                    {/* ROW 4 */}
                    <div className="float-input-box phone-box">
                      <label className="float-label">Phone</label>
                      <div className="phone-flex">
                        <span className="flag-select">{hotelProfile.country === "Canada" ? "🇨🇦 ▾" : "🇺🇸 ▾"}</span>
                        <input
                          type="text"
                          value={hotelProfile.phone}
                          onChange={(e) => setHotelProfile({ ...hotelProfile, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="float-input-box">
                      <label className="float-label">Hotel Official Email</label>
                      <input
                        type="email"
                        value={hotelProfile.email || ""}
                        onChange={(e) => setHotelProfile({ ...hotelProfile, email: e.target.value })}
                        placeholder="e.g. info@americanstarinn.com"
                      />
                    </div>

                    {/* NIGHT AUDIT TIME & SCHEDULED PROMPT CONFIGURATION */}
                    <div className="float-input-box" style={{ gridColumn: "span 2", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1.5px solid #cbd5e1", marginTop: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>🌙 Night Audit Scheduled Time & Business Date Rollover</h4>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "12px" }}>
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Scheduled Audit Time (24h)</label>
                          <input
                            type="time"
                            value={nightAuditConfig.nightAuditTime}
                            onChange={(e) => {
                              const next = { ...nightAuditConfig, nightAuditTime: e.target.value };
                              setNightAuditConfig(next);
                              saveNightAuditConfig(next);
                            }}
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "14px", fontWeight: "700", marginTop: "4px" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Automated Audit Pop-up Prompt</label>
                          <select
                            value={nightAuditConfig.autoPrompt ? "true" : "false"}
                            onChange={(e) => {
                              const next = { ...nightAuditConfig, autoPrompt: e.target.value === "true" };
                              setNightAuditConfig(next);
                              saveNightAuditConfig(next);
                            }}
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "14px", fontWeight: "700", marginTop: "4px" }}
                          >
                            <option value="true">Enabled (Prompt Staff when Audit Time Reached)</option>
                            <option value="false">Disabled (Manual Audit Entry Only)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* HOTEL STANDARD CHECK-IN & CHECK-OUT SCHEDULE CONFIGURATION */}
                    <div className="float-input-box" style={{ gridColumn: "span 2", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1.5px solid #cbd5e1", marginTop: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>🔑 Hotel Standard Check-In &amp; Check-Out Schedule</h4>
                          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>Set standard property arrival &amp; departure times used for cancellation cutoff policy deadline calculations.</p>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "12px" }}>
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Standard Check-In Time</label>
                          <input
                            type="time"
                            value={hotelProfile.checkInTime || "15:00"}
                            onChange={(e) => setHotelProfile({ ...hotelProfile, checkInTime: e.target.value })}
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "14px", fontWeight: "700", marginTop: "4px" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Standard Check-Out Time</label>
                          <input
                            type="time"
                            value={hotelProfile.checkOutTime || "11:00"}
                            onChange={(e) => setHotelProfile({ ...hotelProfile, checkOutTime: e.target.value })}
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "14px", fontWeight: "700", marginTop: "4px" }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* ROW 5: COUNTRY & STATE/PROVINCE */}
                    <div className="float-input-box">
                      <label className="float-label">Country</label>
                      <select
                        value={hotelProfile.country || "United States"}
                        onChange={(e) => {
                          const c = e.target.value;
                          const defaultState = c === "Canada" ? "Ontario" : "Washington";
                          setHotelProfile({ ...hotelProfile, country: c, state: defaultState, city: CITIES_BY_REGION[defaultState]?.[0] || "" });
                        }}
                      >
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                      </select>
                    </div>
                    <div className="float-input-box">
                      <label className="float-label">{hotelProfile.country === "Canada" ? "Province / Territory" : "State"}</label>
                      <select
                        value={hotelProfile.state}
                        onChange={(e) => {
                          const st = e.target.value;
                          setHotelProfile({ ...hotelProfile, state: st, city: CITIES_BY_REGION[st]?.[0] || "" });
                        }}
                      >
                        {(hotelProfile.country === "Canada" ? CANADA_PROVINCES : US_STATES).map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    {/* ROW 6: CITY & ADDRESS */}
                    {(() => {
                      const regionCities = CITIES_BY_REGION[hotelProfile.state] || [];
                      const isListed = regionCities.includes(hotelProfile.city);
                      const isCustomSelected = hotelProfile._isCustomCity || (!isListed && hotelProfile.city && hotelProfile.city !== "__custom__");

                      const handleAddrOrCityChange = (updatedProfile) => {
                        const fullText = `${updatedProfile.address || ''} ${updatedProfile.city || ''} ${updatedProfile.state || ''}`.toLowerCase();
                        let lat = updatedProfile.latitude;
                        let lng = updatedProfile.longitude;

                        if (fullText.includes('hollister') || fullText.includes('san felipe')) {
                          lat = '36.8525'; lng = '-121.4016';
                        } else if (fullText.includes('los angeles')) {
                          lat = '34.0522'; lng = '-118.2437';
                        } else if (fullText.includes('san francisco')) {
                          lat = '37.7749'; lng = '-122.4194';
                        } else if (fullText.includes('san jose')) {
                          lat = '37.3382'; lng = '-121.8863';
                        } else if (fullText.includes('san diego')) {
                          lat = '32.7157'; lng = '-117.1611';
                        } else if (updatedProfile.address && updatedProfile.address.trim().length > 3) {
                          let hash = 0;
                          for (let i = 0; i < fullText.length; i++) hash = (hash * 31 + fullText.charCodeAt(i)) % 10000;
                          lat = (36.5 + (hash % 200) / 100).toFixed(4);
                          lng = (-121.5 - (hash % 300) / 100).toFixed(4);
                        }
                        return { ...updatedProfile, latitude: lat, longitude: lng };
                      };

                      return (
                        <>
                          <div className="float-input-box">
                            <label className="float-label">City</label>
                            {regionCities.length > 0 ? (
                              <div style={{ display: "flex", gap: "6px" }}>
                                <select
                                  style={{ flex: 1 }}
                                  value={isCustomSelected ? "__custom__" : (hotelProfile.city || regionCities[0])}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "__custom__") {
                                      setHotelProfile((prev) => handleAddrOrCityChange({ ...prev, _isCustomCity: true }));
                                    } else {
                                      setHotelProfile((prev) => handleAddrOrCityChange({ ...prev, city: val, _isCustomCity: false }));
                                    }
                                  }}
                                >
                                  {regionCities.map((ct) => (
                                    <option key={ct} value={ct}>{ct}</option>
                                  ))}
                                  <option value="__custom__">Other (Custom Entry)</option>
                                </select>
                                {isCustomSelected && (
                                  <input
                                    type="text"
                                    placeholder="Type City Name"
                                    value={hotelProfile.city === "__custom__" ? "" : hotelProfile.city}
                                    onChange={(e) => {
                                      const customVal = e.target.value;
                                      setHotelProfile((prev) => handleAddrOrCityChange({ ...prev, city: customVal, _isCustomCity: true }));
                                    }}
                                    style={{ flex: 1 }}
                                  />
                                )}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={hotelProfile.city}
                                onChange={(e) => {
                                  const cVal = e.target.value;
                                  setHotelProfile((prev) => handleAddrOrCityChange({ ...prev, city: cVal }));
                                }}
                              />
                            )}
                          </div>

                          <div className="float-input-box">
                            <label className="float-label">Address</label>
                            <input
                              type="text"
                              value={hotelProfile.address}
                              onChange={(e) => {
                                const aVal = e.target.value;
                                setHotelProfile((prev) => handleAddrOrCityChange({ ...prev, address: aVal }));
                              }}
                            />
                          </div>

                          {/* ROW 7 */}
                          <div className="float-input-box">
                            <label className="float-label">Latitude</label>
                            <input
                              type="text"
                              value={hotelProfile.latitude || ""}
                              onChange={(e) => setHotelProfile({ ...hotelProfile, latitude: e.target.value })}
                              placeholder="Auto-filled from Address"
                            />
                          </div>
                          <div className="float-input-box">
                            <label className="float-label">Longitude</label>
                            <input
                              type="text"
                              value={hotelProfile.longitude || ""}
                              onChange={(e) => setHotelProfile({ ...hotelProfile, longitude: e.target.value })}
                              placeholder="Auto-filled from Address"
                            />
                          </div>
                        </>
                      );
                    })()}

                    {/* ROW 8 */}
                    <div className="float-input-box">
                      <label className="float-label">Zipcode / Postal Code</label>
                      <input
                        type="text"
                        value={hotelProfile.zipcode}
                        onChange={(e) => setHotelProfile({ ...hotelProfile, zipcode: e.target.value })}
                      />
                    </div>
                    <div className="ratings-box">
                      <div className="ratings-title">Ratings</div>
                      <div className="star-rating-row">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`star-icon ${star <= (hotelProfile.rating || 5) ? "filled" : ""}`}
                            onClick={() => setHotelProfile({ ...hotelProfile, rating: star })}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="logo-upload-section">
                    <h4>Logo</h4>
                    <label
                      className="logo-upload-dropzone"
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px",
                        border: "2px dashed #cbd5e1",
                        borderRadius: "12px",
                        background: "#f8fafc",
                        position: "relative"
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const file = e.target.files && e.target.files[0];
                          if (!file) return;
                          try {
                            const compressedBase64 = await compressImageFile(file, 350, 140, 0.9);
                            if (compressedBase64) {
                              const updated = { ...hotelProfile, logo: compressedBase64, logoUrl: compressedBase64 };
                              setHotelProfile(updated);
                              saveHotelProfile(updated);
                            }
                          } catch (err) {
                            console.error("Logo compression error:", err);
                          }
                        }}
                      />
                      {(hotelProfile.logo || hotelProfile.logoUrl) ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                          <img
                            src={hotelProfile.logo || hotelProfile.logoUrl}
                            alt="Hotel Logo Preview"
                            style={{ maxHeight: "80px", maxWidth: "240px", objectFit: "contain", borderRadius: "6px" }}
                          />
                          <div style={{ display: "flex", gap: "8px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", color: "#0284c7" }}>📁 Change Logo</span>
                            <button
                              type="button"
                              style={{ fontSize: "12px", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const updated = { ...hotelProfile, logo: "", logoUrl: "", isLogoRemoved: true };
                                setHotelProfile(updated);
                                saveHotelProfile(updated);
                              }}
                            >
                              🗑️ Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="logo-icon" style={{ fontSize: "28px", marginBottom: "6px" }}>🖼️</span>
                          <span style={{ fontSize: "13px", color: "#475569", fontWeight: "600" }}>Click to upload or drag hotel logo here</span>
                        </>
                      )}
                    </label>
                  </div>
                </form>
              </div>
            )}

            {/* 1.2 ROOM TYPE SETUP (1:1 MATCH WITH SCREENSHOT 2) */}
            {propertySubTab === "types" && (
              <div className="config-section">
                {/* PAGE HEADER */}
                <div className="manage-room-type-header">
                  <h2>Manage room type</h2>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      className="btn-lg-grey"
                      onClick={() => {
                        setEditingRoomType(null);
                        setTypeForm({
                          name: "",
                          roomIds: "",
                          defaultAdults: "2",
                          maxAdults: "2",
                          maxChildren: "1",
                          minChildAge: "7",
                          maxChildAge: "12",
                          maxInfants: "0",
                          minInfantAge: "0",
                          maxInfantAge: "6",
                          maxOccupancy: "3",
                          isVirtual: false,
                        });
                        setShowRoomTypeDrawer(true);
                      }}
                    >
                      + Add Room Type
                    </button>
                  </div>
                </div>

                {/* MAIN CONTENT SPLIT: CARDS GRID ON LEFT, MODAL/DRAWER ON RIGHT */}
                <div className="manage-room-type-layout">
                  {/* ROOM TYPE CARDS GRID */}
                  <div className="room-type-cards-grid">
                    {roomTypes.length === 0 ? (
                      <div className="empty-room-types-box">
                        <h3>✨ No Room Types Yet</h3>
                        <p>Click <strong>"+ Add Room Type"</strong> above to create your custom room category (e.g. Non Smoking King Bed) and assign room numbers!</p>
                      </div>
                    ) : (
                      roomTypes.map((t) => (
                        <div key={t.id} className="room-type-card">
                          <div className="card-image-wrap">
                            {(() => {
                              const ibeDisplays = ibeDisplaysMap || getBookingEngineRoomDisplays();
                              const ibeObj = ibeDisplays[t.id] || ibeDisplays[t.name] || Object.values(ibeDisplays).find((x) => x && (x.id === t.id || x.name === t.name)) || {};
                              const ibeImg = ibeObj.image || ibeObj.photo || ibeObj.bannerUrl || ibeObj.images?.[0];
                              const src = (t.image && t.image.length > 5)
                                ? t.image
                                : (t.photo && t.photo.length > 5)
                                ? t.photo
                                : ibeImg;
                              if (src) {
                                return <img src={src} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
                              }
                              return (
                                <div style={{ width: "100%", height: "100%", background: "#f1f5f9", color: "#0f172a", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800" }}>
                                  🏨 {t.name}
                                </div>
                              );
                            })()}
                            <button
                              type="button"
                              className="card-pencil-btn"
                              title="Edit Room Type"
                              onClick={() => {
                                setEditingRoomType(t);
                                setTypeForm({
                                  name: t.name,
                                  roomIds: t.roomIds || "",
                                  defaultAdults: String(t.defaultAdults || 2),
                                  maxAdults: String(t.maxAdults || 2),
                                  maxChildren: String(t.maxChildren || 1),
                                  minChildAge: "7",
                                  maxChildAge: "12",
                                  maxInfants: "0",
                                  minInfantAge: "0",
                                  maxInfantAge: "6",
                                  maxOccupancy: String(t.occupancy || t.maxOccupancy || 3),
                                  basePrice: String(t.basePrice || t.price || 0),
                                  extraAdultPrice: String(t.extraAdultPrice || t.extraPersonRate || t.extraAdultRate || 0),
                                  extraChildPrice: String(t.extraChildPrice || t.extraChildRate || 0),
                                  isVirtual: Boolean(t.isVirtual || t.isStaffRoom || t.isHouseUse),
                                });
                                setShowRoomTypeDrawer(true);
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="card-delete-btn"
                              title="Delete Room Type"
                              onClick={() => handleDeleteType(t.id)}
                            >
                              🗑️
                            </button>
                          </div>
                          <div className="card-body">
                            <h4 className="card-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                              <span>{t.name}</span>
                              {(t.isVirtual || t.isStaffRoom) && (
                                <span style={{ fontSize: "11px", fontWeight: "800", background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1", padding: "2px 8px", borderRadius: "6px" }}>
                                  🏢 Virtual / Staff
                                </span>
                              )}
                            </h4>
                            {t.tag && <div className="card-tag">{t.tag}</div>}
                            <div className="card-details">
                              <span>Max adults <strong>{t.maxAdults || 2}</strong></span>
                              <span className="dot-sep">•</span>
                              <span>Max children <strong>{t.maxChildren || 1}</strong></span>
                              {(t.extraAdultPrice > 0 || t.extraAdultRate > 0) && (
                                <>
                                  <span className="dot-sep">•</span>
                                  <span>Extra Adult <strong>+${t.extraAdultPrice || t.extraAdultRate}/night</strong></span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* SLIDE-OVER DRAWER / MODAL FORM (RIGHT SIDE SCREENSHOT 2) */}
                  {showRoomTypeDrawer && (
                    <div className="config-modal-overlay">
                      <div className="room-type-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                          <h3>{editingRoomType ? "Edit Room Type" : "Add Room Type"}</h3>
                          <button type="button" className="drawer-close-btn" onClick={() => setShowRoomTypeDrawer(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSaveTypeSubmit} className="drawer-form">
                          {/* Room Type Name */}
                          <div className="drawer-input-box">
                            <label className="float-label">Room type*</label>
                            <input
                              type="text"
                              required
                              value={typeForm.name}
                              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                            />
                            <span className="sub-hint">Name of the room type. It will be visible to customer booking the room</span>
                          </div>

                          {/* Room IDs */}
                          <div className="drawer-input-box">
                            <label className="float-label">Room ids</label>
                            <input
                              type="text"
                              value={typeForm.roomIds}
                              onChange={(e) => setTypeForm({ ...typeForm, roomIds: e.target.value })}
                            />
                            <span className="sub-hint">Can be letters or number or both and ids should be comma separated</span>
                          </div>

                          {/* Adults Row */}
                          <div className="drawer-row-2">
                            <div className="drawer-input-box">
                              <label className="float-label">Default adults*</label>
                              <input
                                type="number"
                                required
                                value={typeForm.defaultAdults}
                                onChange={(e) => setTypeForm({ ...typeForm, defaultAdults: e.target.value })}
                              />
                              <span className="sub-hint">Number of adults included in room type.</span>
                            </div>
                            <div className="drawer-input-box">
                              <label className="float-label">Max adults*</label>
                              <input
                                type="number"
                                required
                                value={typeForm.maxAdults}
                                onChange={(e) => setTypeForm({ ...typeForm, maxAdults: e.target.value })}
                              />
                              <span className="sub-hint">Maximum number of adults for this room type</span>
                            </div>
                          </div>

                          {/* Children Row */}
                          <div className="drawer-row-3">
                            <div className="drawer-input-box" style={{ flex: 1.2 }}>
                              <label className="float-label">Max children (7-12 yr)</label>
                              <input
                                type="number"
                                value={typeForm.maxChildren}
                                onChange={(e) => setTypeForm({ ...typeForm, maxChildren: e.target.value })}
                              />
                            </div>
                            <div className="drawer-input-box" style={{ flex: 1 }}>
                              <label className="float-label">Min age</label>
                              <input
                                type="number"
                                value={typeForm.minChildAge}
                                onChange={(e) => setTypeForm({ ...typeForm, minChildAge: e.target.value })}
                              />
                            </div>
                            <div className="drawer-input-box" style={{ flex: 1 }}>
                              <label className="float-label">Max age</label>
                              <input
                                type="number"
                                value={typeForm.maxChildAge}
                                onChange={(e) => setTypeForm({ ...typeForm, maxChildAge: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* Infant Row */}
                          <div className="drawer-row-3">
                            <div className="drawer-input-box" style={{ flex: 1.2 }}>
                              <label className="float-label">Max infant (0-6 yr)</label>
                              <input
                                type="number"
                                value={typeForm.maxInfants}
                                onChange={(e) => setTypeForm({ ...typeForm, maxInfants: e.target.value })}
                              />
                            </div>
                            <div className="drawer-input-box" style={{ flex: 1 }}>
                              <label className="float-label">Min age</label>
                              <input
                                type="number"
                                value={typeForm.minInfantAge}
                                onChange={(e) => setTypeForm({ ...typeForm, minInfantAge: e.target.value })}
                              />
                            </div>
                            <div className="drawer-input-box" style={{ flex: 1 }}>
                              <label className="float-label">Max age</label>
                              <input
                                type="number"
                                value={typeForm.maxInfantAge}
                                onChange={(e) => setTypeForm({ ...typeForm, maxInfantAge: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* Room Max Occupancy */}
                          <div className="drawer-input-box">
                            <label className="float-label">Room max occupancy*</label>
                            <input
                              type="number"
                              required
                              value={typeForm.maxOccupancy}
                              onChange={(e) => setTypeForm({ ...typeForm, maxOccupancy: e.target.value })}
                            />
                            <span className="sub-hint">Maximum occupancy for this room type</span>
                          </div>

                          {/* Virtual / Staff Room Type Checkbox */}
                          <div style={{ marginTop: "12px", marginBottom: "14px" }}>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
                              <input
                                type="checkbox"
                                checked={Boolean(typeForm.isVirtual)}
                                onChange={(e) => setTypeForm({ ...typeForm, isVirtual: e.target.checked })}
                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                              />
                              <span style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>Virtual</span>
                            </label>
                          </div>

                          <div className="drawer-actions">
                            <button type="submit" className="btn-lg-grey cr-submit-primary" style={{ width: "100%" }}>
                              Save Room Type
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 1.3 ROOMS INVENTORY TAB */}
            {propertySubTab === "rooms" && (
              <div className="config-section">
                <div className="manage-room-type-header">
                  <div>
                    <h2>Manage Rooms</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-lg-grey"
                    onClick={() => {
                      setEditingRoom(null);
                      setRoomForm({
                        no: "",
                        type: roomTypes[0]?.name || "",
                        floor: "1",
                        status: "available",
                        housekeeping: "clean",
                      });
                      setShowRoomDrawer(true);
                    }}
                  >
                    + Add Room
                  </button>
                </div>

                <div className="manage-room-type-layout">
                  <div className="config-table-container">
                    <div className="config-table-toolbar">
                      <div className="config-table-search">
                        <span>🔍</span>
                        <input
                          type="text"
                          placeholder="Search room no or category..."
                          value={roomFilterText}
                          onChange={(e) => setRoomFilterText(e.target.value)}
                        />
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#475569" }}>
                        Total Rooms: {(Array.isArray(roomsList) ? roomsList : []).length}
                      </div>
                    </div>

                    {(!Array.isArray(roomsList) || roomsList.length === 0) ? (
                      <div className="empty-room-types-box">
                        <h3>✨ No Physical Rooms Yet</h3>
                        <p>Rooms will automatically appear here when you add comma-separated room IDs under <strong>"Room Type"</strong>, or click <strong>"+ Add Room"</strong> above!</p>
                      </div>
                    ) : (
                      <table className="config-data-table">
                        <thead>
                          <tr>
                            <th>Room No.</th>
                            <th>Room Category</th>
                            <th>Floor</th>
                            <th>Features</th>
                            <th>Housekeeping</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomsList
                            .map((r, idx) => {
                              if (typeof r === "string" || typeof r === "number") {
                                return { id: `r_${r}`, no: String(r), type: roomTypes[0]?.name || "Standard Room", floor: 1, status: "available", housekeeping: "clean", petFriendly: false, nonSmoking: true };
                              }
                              if (!r || typeof r !== "object") {
                                return { id: `r_${idx}`, no: String(idx + 1), type: roomTypes[0]?.name || "Standard Room", floor: 1, status: "available", housekeeping: "clean", petFriendly: false, nonSmoking: true };
                              }
                              return {
                                id: r.id || `r_${r.no || idx}`,
                                no: String(r.no || r.roomNo || idx + 1),
                                type: r.type || r.roomType || (roomTypes[0]?.name || "Standard Room"),
                                floor: r.floor || 1,
                                status: r.status || "available",
                                housekeeping: r.housekeeping || "clean",
                                petFriendly: r.petFriendly !== undefined ? Boolean(r.petFriendly) : false,
                                nonSmoking: r.nonSmoking !== undefined ? Boolean(r.nonSmoking) : true,
                              };
                            })
                            .filter(
                              (r) =>
                                !roomFilterText ||
                                String(r.no).toLowerCase().includes(roomFilterText.toLowerCase()) ||
                                String(r.type).toLowerCase().includes(roomFilterText.toLowerCase())
                            )
                            .map((r) => (
                              <tr key={r.id}>
                                <td><strong style={{ fontSize: "14px", color: "#0f172a" }}>Room {r.no}</strong></td>
                                <td>{r.type}</td>
                                <td>Floor {r.floor || 1}</td>
                                <td>
                                  <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "14px" }}>
                                    {r.petFriendly && <span title="Pet Friendly Room (Dog Allowed)" style={{ display: "inline-flex", alignItems: "center" }}><Dog size={16} style={{ color: "#0f172a", strokeWidth: 2.2 }} /></span>}
                                    {r.nonSmoking && <span title="Non-Smoking Room" style={{ display: "inline-flex", alignItems: "center" }}><CigaretteOff size={16} style={{ color: "#dc2626", strokeWidth: 2.2 }} /></span>}
                                    {!r.petFriendly && !r.nonSmoking && <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>}
                                  </div>
                                </td>
                                <td>
                                  <span className={`badge-status ${String(r.housekeeping || "clean").toLowerCase()}`}>
                                    {String(r.housekeeping || "clean").toLowerCase() === "dirty" ? "🔴 Dirty" : String(r.housekeeping || "clean").toLowerCase() === "clean" ? "🟢 Clean" : "⚠️ Out of Order"}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge-status active">
                                    {r.status || "available"}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="tbl-action-btn"
                                    title="Edit Room"
                                    onClick={() => {
                                      setEditingRoom(r);
                                      setRoomForm({
                                        no: r.no,
                                        type: r.type,
                                        floor: String(r.floor || 1),
                                        status: r.status || "available",
                                        housekeeping: r.housekeeping || "clean",
                                        petFriendly: r.petFriendly !== undefined ? Boolean(r.petFriendly) : false,
                                        nonSmoking: r.nonSmoking !== undefined ? Boolean(r.nonSmoking) : true,
                                      });
                                      setShowRoomDrawer(true);
                                    }}
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="tbl-action-btn delete"
                                    title="Delete Room"
                                    onClick={() => handleDeleteRoom(r.id)}
                                  >
                                    🗑️ Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* ROOM DRAWER */}
                  {showRoomDrawer && (
                    <div className="config-modal-overlay">
                      <div className="room-type-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                          <h3>{editingRoom ? `Edit Room ${editingRoom.no}` : "Add New Room"}</h3>
                          <button type="button" className="drawer-close-btn" onClick={() => setShowRoomDrawer(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSaveRoomSubmit} className="drawer-form">
                          <div className="drawer-input-box">
                            <label>Room Number*</label>
                            <input
                              type="text"
                              value={roomForm.no}
                              onChange={(e) => setRoomForm({ ...roomForm, no: e.target.value })}
                              placeholder="e.g. 001, 102, 134-NHQ"
                              required
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Room Category / Type*</label>
                            <select
                              value={roomForm.type}
                              onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value })}
                              required
                            >
                              <option value="">-- Select Category --</option>
                              {roomTypes.map((t) => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="drawer-input-box">
                            <label>Floor Number</label>
                            <input
                              type="number"
                              value={roomForm.floor}
                              onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                              placeholder="1"
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Housekeeping Status</label>
                            <select
                              value={roomForm.housekeeping}
                              onChange={(e) => setRoomForm({ ...roomForm, housekeeping: e.target.value })}
                            >
                              <option value="clean">🟢 Clean &amp; Ready</option>
                              <option value="dirty">🔴 Dirty / Needs Cleaning</option>
                              <option value="out_of_order">⚠️ Out of Order / Maintenance</option>
                            </select>
                          </div>

                          <div className="drawer-input-box">
                            <label style={{ fontWeight: 800, color: "#334155", marginBottom: 6, display: "block" }}>
                              Room Features &amp; Options
                            </label>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(roomForm.petFriendly)}
                                  onChange={(e) => setRoomForm({ ...roomForm, petFriendly: e.target.checked })}
                                />
                                <Dog size={16} style={{ color: "#0f172a", strokeWidth: 2.2 }} /> Pet Friendly Room
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(roomForm.nonSmoking)}
                                  onChange={(e) => setRoomForm({ ...roomForm, nonSmoking: e.target.checked })}
                                />
                                <CigaretteOff size={16} style={{ color: "#dc2626", strokeWidth: 2.2 }} /> Non-Smoking Room
                              </label>
                            </div>
                          </div>

                          <div className="drawer-actions">
                            <button type="submit" className="btn-lg-grey cr-submit-primary" style={{ width: "100%" }}>
                              Save Room
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 1.3.5 DOCUMENT NUMBERING & SEQUENCES TAB */}
            {propertySubTab === "sequences" && (
              <div className="config-section">
                <div className="edit-details-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h2 className="edit-details-title">Document Numbering &amp; Sequences</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-lg-grey cr-submit-primary"
                    onClick={() => {
                      saveSequenceConfig(sequenceConfig);
                      triggerToast("Saved Document Numbering Sequences!");
                    }}
                  >
                    Save Sequences
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveSequenceConfig(sequenceConfig);
                    triggerToast("Saved Document Numbering Sequences!");
                  }}
                  className="hotel-details-form"
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
                    {[
                      { key: "booking", label: "Booking ID Sequence", icon: "📅" },
                      { key: "group", label: "Group Booking # Sequence", icon: "🏢" },
                      { key: "splitBooking", label: "Split Stay Booking # Sequence", icon: "🔀" },
                      { key: "invoice", label: "Tax Invoice / Folio # Sequence", icon: "📄" },
                      { key: "receipt", label: "Payment Receipt # Sequence", icon: "🧾" },
                      { key: "grc", label: "GRC (Guest Registration Card) # Sequence", icon: "📋" },
                      { key: "cancellation", label: "Cancellation Voucher / Receipt # Sequence", icon: "❌" },
                      { key: "noshow", label: "No Show Receipt / Voucher # Sequence", icon: "🚫" },
                      { key: "misc", label: "Misc Journal # Sequence", icon: "🛒" },
                      { key: "cityLedger", label: "City Ledger Account # Sequence", icon: "💳" },
                    ].map((item) => {
                      const cfg = sequenceConfig[item.key] || { prefix: "", suffix: "", nextNumber: 1001, padding: 5 };
                      const previewStr = formatSequence(cfg.prefix, cfg.nextNumber, cfg.padding, cfg.suffix);

                      return (
                        <div
                          key={item.key}
                          style={{
                            background: "#ffffff",
                            border: "1.5px solid #e2e8f0",
                            borderRadius: "12px",
                            padding: "20px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                                {item.icon} {item.label}
                              </h3>
                            </div>
                            <div style={{ background: "#f1f5f9", padding: "6px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                              <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", display: "block" }}>Next ID Preview</span>
                              <code style={{ fontSize: "15px", fontWeight: 800, color: "#0284c7" }}>{previewStr}</code>
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "14px" }}>
                            <div>
                              <label className="float-label" style={{ fontSize: "11px", fontWeight: 800, color: "#475569" }}>Prefix</label>
                              <input
                                type="text"
                                value={cfg.prefix || ""}
                                placeholder="e.g. BK-"
                                onChange={(e) =>
                                  setSequenceConfig({
                                    ...sequenceConfig,
                                    [item.key]: { ...cfg, prefix: e.target.value },
                                  })
                                }
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "14px", fontWeight: 700 }}
                              />
                            </div>

                            <div>
                              <label className="float-label" style={{ fontSize: "11px", fontWeight: 800, color: "#475569" }}>Next Starting Number</label>
                              <input
                                type="number"
                                min="1"
                                value={cfg.nextNumber || 1}
                                onChange={(e) =>
                                  setSequenceConfig({
                                    ...sequenceConfig,
                                    [item.key]: { ...cfg, nextNumber: Math.max(1, Number(e.target.value || 1)) },
                                  })
                                }
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "14px", fontWeight: 700 }}
                              />
                            </div>

                            <div>
                              <label className="float-label" style={{ fontSize: "11px", fontWeight: 800, color: "#475569" }}>Padding Digits</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={cfg.padding || 5}
                                onChange={(e) =>
                                  setSequenceConfig({
                                    ...sequenceConfig,
                                    [item.key]: { ...cfg, padding: Math.max(1, Math.min(10, Number(e.target.value || 1))) },
                                  })
                                }
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "14px", fontWeight: 700 }}
                              />
                            </div>

                            <div>
                              <label className="float-label" style={{ fontSize: "11px", fontWeight: 800, color: "#475569" }}>Suffix</label>
                              <input
                                type="text"
                                value={cfg.suffix || ""}
                                placeholder="e.g. -2026"
                                onChange={(e) =>
                                  setSequenceConfig({
                                    ...sequenceConfig,
                                    [item.key]: { ...cfg, suffix: e.target.value },
                                  })
                                }
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "14px", fontWeight: 700 }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </form>
              </div>
            )}

            {/* 1.4 RATE PLANS TAB */}
            {propertySubTab === "plans" && (
              <div className="config-section">
                <div className="manage-room-type-header">
                  <div>
                    <h2>Manage Rate Plans</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-lg-grey"
                    onClick={() => {
                      setEditingRatePlan(null);
                      setRatePlanForm({
                        name: "",
                        code: "",
                        description: "",
                        adjustment: "0.00",
                        status: "Active",
                      });
                      setShowRatePlanDrawer(true);
                    }}
                  >
                    + Add Rate Plan
                  </button>
                </div>

                <div className="manage-room-type-layout">
                  <div className="config-table-container">
                    {ratePlans.length === 0 ? (
                      <div style={{ padding: "40px 20px", textAlign: "center", background: "#f8fafc", borderRadius: 12, border: "2px dashed #cbd5e1", width: "100%" }}>
                        <div style={{ fontSize: "36px", marginBottom: "8px" }}>🏷️</div>
                        <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>No Rate Plans Configured Yet</h3>
                        <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>Click <strong>&quot;+ Add Rate Plan&quot;</strong> above to set up your rate plan packages (e.g. EP, CP, MAP, Weekly Rate).</p>
                      </div>
                    ) : (
                      <table className="config-data-table">
                        <thead>
                          <tr>
                            <th>Rate Plan</th>
                            <th>Code</th>
                            <th>Inclusions &amp; Description</th>
                            <th>No. of Nights</th>
                            <th>Rate Plan Tariff ($)</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ratePlans.map((p) => (
                            <tr key={p.id}>
                              <td><strong style={{ fontSize: "14px", color: "#0f172a" }}>{p.name}</strong></td>
                              <td><code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>{p.code}</code></td>
                              <td>{p.description}</td>
                              <td>
                                <span className="badge-status info" style={{ fontWeight: 800, background: "#e0f2fe", color: "#0369a1" }}>
                                  🌙 {p.nights || 1} {Number(p.nights) === 1 ? "Night" : "Nights"}
                                </span>
                              </td>
                              <td><strong style={{ color: "#059669" }}>${Number(p.adjustment || 0).toFixed(2)}</strong></td>
                              <td><span className="badge-status active">{p.status}</span></td>
                              <td>
                                <button
                                  type="button"
                                  className="tbl-action-btn"
                                  onClick={() => {
                                    setEditingRatePlan(p);
                                    setRatePlanForm({ ...p, nights: String(p.nights || 1) });
                                    setShowRatePlanDrawer(true);
                                  }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  className="tbl-action-btn delete"
                                  onClick={() => handleDeleteRatePlan(p.id)}
                                >
                                  🗑️ Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {showRatePlanDrawer && (
                    <div className="config-modal-overlay">
                      <div className="room-type-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                          <h3>{editingRatePlan ? "Edit Rate Plan" : "Add Rate Plan"}</h3>
                          <button type="button" className="drawer-close-btn" onClick={() => setShowRatePlanDrawer(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSaveRatePlanSubmit} className="drawer-form">
                          <div className="drawer-input-box">
                            <label>Rate Plan Name*</label>
                            <input
                              type="text"
                              value={ratePlanForm.name}
                              onChange={(e) => setRatePlanForm({ ...ratePlanForm, name: e.target.value })}
                              placeholder="e.g. CP - Continental Plan (Breakfast)"
                              required
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Plan Code*</label>
                            <input
                              type="text"
                              value={ratePlanForm.code}
                              onChange={(e) => setRatePlanForm({ ...ratePlanForm, code: e.target.value })}
                              placeholder="e.g. CP-02"
                              required
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Inclusions &amp; Description</label>
                            <input
                              type="text"
                              value={ratePlanForm.description}
                              onChange={(e) => setRatePlanForm({ ...ratePlanForm, description: e.target.value })}
                              placeholder="Includes complimentary daily breakfast buffet..."
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Number of Nights / Duration (Auto Check-out Binding)*</label>
                            <input
                              type="number"
                              min="1"
                              value={ratePlanForm.nights || "1"}
                              onChange={(e) => setRatePlanForm({ ...ratePlanForm, nights: e.target.value })}
                              placeholder="e.g. 1 night for Daily, 7 for Weekly, 30 for Monthly"
                              required
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Rate Plan Tariff / Price ($ per night)*</label>
                            <input
                              type="number"
                              step="0.01"
                              value={ratePlanForm.adjustment}
                              onChange={(e) => setRatePlanForm({ ...ratePlanForm, adjustment: e.target.value })}
                              placeholder="79.00"
                              required
                            />
                          </div>

                          <div className="drawer-actions">
                            <button type="submit" className="btn-lg-grey cr-submit-primary" style={{ width: "100%" }}>
                              Save Rate Plan
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 1.5 HOTEL ADDONS TAB */}
            {propertySubTab === "addons" && (
              <div className="config-section">
                <div className="manage-room-type-header">
                  <div>
                    <h2>Manage Hotel Addons</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-lg-grey"
                    onClick={() => {
                      setEditingAddon(null);
                      setAddonForm({
                        name: "",
                        price: "",
                        billingType: "Per Night",
                        taxPercent: "12",
                        status: "Active",
                      });
                      setShowAddonDrawer(true);
                    }}
                  >
                    + Add Hotel Addon
                  </button>
                </div>

                <div className="manage-room-type-layout">
                  <div className="config-table-container">
                    {addonsList.length === 0 ? (
                      <div style={{ padding: "40px 20px", textAlign: "center", background: "#f8fafc", borderRadius: 12, border: "2px dashed #cbd5e1", width: "100%" }}>
                        <div style={{ fontSize: "36px", marginBottom: "8px" }}>📦</div>
                        <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>No Hotel Addons Configured Yet</h3>
                        <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>Click <strong>&quot;+ Add Hotel Addon&quot;</strong> above to setup extra amenities, airport pickup fees, or breakfast add-ons.</p>
                      </div>
                    ) : (
                      <table className="config-data-table">
                        <thead>
                          <tr>
                            <th>Addon Name</th>
                            <th>Price ($)</th>
                            <th>Billing Type</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {addonsList.map((a) => (
                            <tr key={a.id}>
                              <td><strong style={{ fontSize: "14px", color: "#0f172a" }}>{a.name}</strong></td>
                              <td><strong style={{ color: "#0284c7" }}>${a.price}</strong></td>
                              <td>{a.billingType}</td>
                              <td><span className="badge-status active">{a.status}</span></td>
                              <td>
                                <button
                                  type="button"
                                  className="tbl-action-btn"
                                  onClick={() => {
                                    setEditingAddon(a);
                                    setAddonForm(a);
                                    setShowAddonDrawer(true);
                                  }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  className="tbl-action-btn delete"
                                  onClick={() => handleDeleteAddon(a.id)}
                                >
                                  🗑️ Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {showAddonDrawer && (
                    <div className="config-modal-overlay">
                      <div className="room-type-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                          <h3>{editingAddon ? "Edit Hotel Addon" : "Add Hotel Addon"}</h3>
                          <button type="button" className="drawer-close-btn" onClick={() => setShowAddonDrawer(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSaveAddonSubmit} className="drawer-form">
                          <div className="drawer-input-box">
                            <label>Addon Name*</label>
                            <input
                              type="text"
                              value={addonForm.name}
                              onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                              placeholder="e.g. Airport Shuttle Pickup"
                              required
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Price ($)*</label>
                            <input
                              type="number"
                              step="0.01"
                              value={addonForm.price}
                              onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value })}
                              placeholder="35.00"
                              required
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Billing Frequency / Type</label>
                            <select
                              value={addonForm.billingType}
                              onChange={(e) => setAddonForm({ ...addonForm, billingType: e.target.value })}
                            >
                              <option value="Per Night">Per Night</option>
                              <option value="Per Person Per Day">Per Person Per Day</option>
                              <option value="One Time Fee">One Time Fee</option>
                              <option value="Per Stay">Per Stay</option>
                            </select>
                          </div>

                          <div className="drawer-actions">
                            <button type="submit" className="btn-lg-grey cr-submit-primary" style={{ width: "100%" }}>
                              Save Hotel Addon
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 1.6 TAXES TAB */}
            {propertySubTab === "taxes" && (
              <div className="config-section">
                <div className="manage-room-type-header">
                  <div>
                    <h2>Manage Taxes &amp; Fee Categories</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-lg-grey"
                    onClick={() => {
                      setEditingTax(null);
                      setTaxForm({
                        name: "",
                        code: "",
                        taxType: "percentage",
                        percent: "12.00",
                        fixedAmount: "5.00",
                        fixedCalculation: "per_night",
                        appliesTo: "Room Tariff",
                        status: "Active",
                      });
                      setShowTaxDrawer(true);
                    }}
                  >
                    + Add Tax Rule
                  </button>
                </div>



                <div className="manage-room-type-layout">
                  <div className="config-table-container">
                    {taxRules.length === 0 ? (
                      <div style={{ padding: "40px 20px", textAlign: "center", background: "#f8fafc", borderRadius: 12, border: "2px dashed #cbd5e1", width: "100%" }}>
                        <div style={{ fontSize: "36px", marginBottom: "8px" }}>🏛️</div>
                        <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>No Tax Rules Configured Yet</h3>
                        <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>Click <strong>&quot;+ Add Tax Rule&quot;</strong> above to set up city occupancy taxes, state tourism levies, or GST/VAT rules.</p>
                      </div>
                    ) : (
                      <table className="config-data-table">
                        <thead>
                          <tr>
                            <th>Tax Name</th>
                            <th>Tax Code</th>
                            <th>Tax Type</th>
                            <th>Tax Rate / Value</th>
                            <th>Applies To</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {taxRules.map((t) => (
                            <tr key={t.id}>
                              <td><strong style={{ fontSize: "14px", color: "#0f172a" }}>{t.name}</strong></td>
                              <td><code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>{t.code}</code></td>
                              <td>
                                <span style={{ background: t.taxType === "fixed" ? "#eff6ff" : "#fdf2f8", color: t.taxType === "fixed" ? "#1d4ed8" : "#be185d", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "800" }}>
                                  {t.taxType === "fixed" ? "Fixed Amount ($)" : "Percentage (%)"}
                                </span>
                              </td>
                              <td>
                                <strong style={{ color: "#e11d48" }}>
                                  {t.taxType === "fixed" 
                                    ? `$${Number(t.fixedAmount || t.amount || 0).toFixed(2)} / ${t.fixedCalculation === "per_stay" ? "stay" : "night"}`
                                    : `${t.percent || t.percentage || 0}%`}
                                </strong>
                              </td>
                              <td>{t.appliesTo}</td>
                              <td><span className="badge-status active">{t.status}</span></td>
                              <td>
                                <button
                                  type="button"
                                  className="tbl-action-btn"
                                  onClick={() => {
                                    setEditingTax(t);
                                    setTaxForm({
                                      name: t.name || "",
                                      code: t.code || "",
                                      taxType: t.taxType || "percentage",
                                      percent: t.percent || t.percentage || "12.00",
                                      fixedAmount: t.fixedAmount || "5.00",
                                      fixedCalculation: t.fixedCalculation || "per_night",
                                      appliesTo: t.appliesTo || "Room Tariff",
                                      status: t.status || "Active",
                                    });
                                    setShowTaxDrawer(true);
                                  }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  className="tbl-action-btn delete"
                                  onClick={() => handleDeleteTax(t.id)}
                                >
                                  🗑️ Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {showTaxDrawer && (
                    <div className="config-modal-overlay">
                      <div className="room-type-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                          <h3>{editingTax ? "Edit Tax Rule" : "Add Tax Rule"}</h3>
                          <button type="button" className="drawer-close-btn" onClick={() => setShowTaxDrawer(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSaveTaxSubmit} className="drawer-form">
                          <div className="drawer-input-box">
                            <label>Tax Rule Name*</label>
                            <input
                              type="text"
                              value={taxForm.name}
                              onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
                              placeholder="e.g. Hotel City Occupancy Tax"
                              required
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Tax Code*</label>
                            <input
                              type="text"
                              value={taxForm.code}
                              onChange={(e) => setTaxForm({ ...taxForm, code: e.target.value })}
                              placeholder="e.g. CITY-TAX-12"
                              required
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Tax Calculation Type*</label>
                            <select
                              value={taxForm.taxType || "percentage"}
                              onChange={(e) => setTaxForm({ ...taxForm, taxType: e.target.value })}
                              style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13.5px", background: "#ffffff", fontWeight: "700" }}
                            >
                              <option value="percentage">Percentage (%) Rate</option>
                              <option value="fixed">Fixed Amount ($ Value)</option>
                            </select>
                          </div>

                          {taxForm.taxType === "fixed" ? (
                            <>
                              <div className="drawer-input-box">
                                <label>Fixed Tax Amount ($)*</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={taxForm.fixedAmount}
                                  onChange={(e) => setTaxForm({ ...taxForm, fixedAmount: e.target.value })}
                                  placeholder="5.00"
                                  required
                                />
                              </div>

                              <div className="drawer-input-box">
                                <label>Fixed Calculation Basis*</label>
                                <select
                                  value={taxForm.fixedCalculation || "per_night"}
                                  onChange={(e) => setTaxForm({ ...taxForm, fixedCalculation: e.target.value })}
                                  style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13.5px", background: "#ffffff", fontWeight: "700" }}
                                >
                                  <option value="per_night">Per Night (Per Room Night)</option>
                                  <option value="per_stay">Per Stay (Fixed Total per Stay)</option>
                                </select>
                              </div>
                            </>
                          ) : (
                            <div className="drawer-input-box">
                              <label>Tax Percentage (%)*</label>
                              <input
                                type="number"
                                step="0.01"
                                value={taxForm.percent}
                                onChange={(e) => setTaxForm({ ...taxForm, percent: e.target.value })}
                                placeholder="12.00"
                                required
                              />
                            </div>
                          )}

                          <div className="drawer-input-box" style={{ marginBottom: "20px" }}>
                            <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "700", color: "#475569" }}>Applies To</label>
                            <select
                              value={taxForm.appliesTo || "Room Tariff"}
                              onChange={(e) => setTaxForm({ ...taxForm, appliesTo: e.target.value })}
                              style={{
                                width: "100%",
                                padding: "10px 14px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                fontSize: "13.5px",
                                background: "#ffffff",
                                fontWeight: "700",
                                color: "#0f172a",
                                outline: "none",
                                cursor: "pointer",
                                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                              }}
                            >
                              <option value="Room Tariff">Room Tariff</option>
                              <option value="Addons & Extras">Addons &amp; Extras</option>
                              <option value="Daily Sales">Daily Sales (Misc POS Sales)</option>
                              <option value="Expenses">Operational Expenses</option>
                              <option value="All Transactions (Universal)">All Transactions (Universal)</option>
                            </select>
                          </div>

                          <div className="drawer-actions" style={{ marginTop: "24px" }}>
                            <button type="submit" className="btn-lg-grey cr-submit-primary" style={{ width: "100%", padding: "12px", borderRadius: "8px", fontWeight: "700", fontSize: "14px" }}>
                              Save Tax Rule
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 1.6.5 BUSINESS SOURCE TAB */}
            {propertySubTab === "sources" && (
              <div className="config-section">
                <div className="manage-room-type-header">
                  <div>
                    <h2>Business Source</h2>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                      Manage market segments and sub-segments.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%", marginTop: "16px" }}>
                  {/* MARKET SEGMENTS CARD */}
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <div>
                        <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", margin: 0 }}>📊 Market Segments & Sub-Segments</h3>
                        <p style={{ fontSize: "12.5px", color: "#64748b", margin: "2px 0 0 0" }}>Categorize booking origins and channels.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSource(null);
                          setSourceForm({ id: "", segment: "", subSegmentsText: "" });
                          setShowSourceDrawer(true);
                        }}
                        style={{
                          height: "36px",
                          padding: "0 16px",
                          fontSize: "12.5px",
                          fontWeight: "800",
                          background: "#0f172a",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.15s ease"
                        }}
                      >
                        + Add Market Segment
                      </button>
                    </div>

                    <div className="config-table-container">
                      {businessSourcesList.length === 0 ? (
                        <div style={{ padding: "40px 20px", textAlign: "center", background: "#f8fafc", borderRadius: 12, border: "2px dashed #cbd5e1", width: "100%" }}>
                          <div style={{ fontSize: "36px", marginBottom: "8px" }}>📊</div>
                          <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>No Business Sources Configured</h3>
                          <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>Click <strong>&quot;+ Add Market Segment&quot;</strong> to create your market segments and sub-segments.</p>
                        </div>
                      ) : (
                        <table className="config-data-table">
                          <thead>
                            <tr>
                              <th style={{ width: "200px" }}>Market Segment</th>
                              <th>Configured Sub-Segments</th>
                              <th style={{ width: "160px", textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {businessSourcesList.map((bs) => {
                              const isCorpRow = (bs.segment || "").toUpperCase().includes("COMPANY") || (bs.segment || "").toUpperCase().includes("CORPORATE");
                              const companyNames = isCorpRow ? (companyAccountsState || []).map((c) => c.name) : [];
                              const displaySubs = Array.from(new Set([...(bs.subSegments || []), ...companyNames])).filter(Boolean);

                              return (
                                <tr key={bs.id || bs.segment}>
                                  <td>
                                    <strong style={{ fontSize: "13.5px", fontWeight: "700", color: "#0f172a" }}>{bs.segment}</strong>
                                  </td>
                                  <td>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                                      {displaySubs.length === 0 ? (
                                        <span style={{ color: "#94a3b8", fontSize: "12.5px", fontStyle: "italic" }}>
                                          {isCorpRow ? "No corporate accounts created yet" : "No sub-segments configured"}
                                        </span>
                                      ) : (
                                        displaySubs.map((sub) => {
                                          const isFromCompAccount = companyNames.includes(sub);
                                          return (
                                            <span
                                              key={sub}
                                              style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                background: isFromCompAccount ? "#eff6ff" : "#f1f5f9",
                                                border: isFromCompAccount ? "1px solid #bfdbfe" : "1px solid #cbd5e1",
                                                color: isFromCompAccount ? "#1e40af" : "#0f172a",
                                                padding: "4px 10px",
                                                borderRadius: "6px",
                                                fontSize: "12px",
                                                fontWeight: "700"
                                              }}
                                            >
                                              {isFromCompAccount && "🏢 "}
                                              {sub}
                                              {!isFromCompAccount && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const updatedSub = (bs.subSegments || []).filter((s) => s !== sub);
                                                    const updatedList = businessSourcesList.map((item) =>
                                                      (item.id === bs.id || item.segment === bs.segment)
                                                        ? { ...item, subSegments: updatedSub }
                                                        : item
                                                    );
                                                    saveBusinessSources(updatedList);
                                                    setBusinessSourcesList(updatedList);
                                                    triggerToast(`Removed Sub-Segment "${sub}"`);
                                                  }}
                                                  style={{
                                                    background: "none",
                                                    border: "none",
                                                    color: "#64748b",
                                                    cursor: "pointer",
                                                    fontSize: "11px",
                                                    padding: 0,
                                                    marginLeft: "2px"
                                                  }}
                                                  title="Remove sub-segment"
                                                >
                                                  ✕
                                                </button>
                                              )}
                                            </span>
                                          );
                                        })
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ textAlign: "right" }}>
                                    <div style={{ display: "inline-flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                                      <button
                                        type="button"
                                        className="tbl-action-btn"
                                        onClick={() => {
                                          setEditingSource(bs);
                                          setSourceForm({
                                            id: bs.id,
                                            segment: bs.segment,
                                            subSegmentsText: (bs.subSegments || []).join(", ")
                                          });
                                          setShowSourceDrawer(true);
                                        }}
                                      >
                                        ✏️ Edit
                                      </button>
                                      {!isCorpRow && (
                                        <button
                                          type="button"
                                          className="tbl-action-btn delete"
                                          onClick={() => {
                                            if (window.confirm(`Delete Market Segment "${bs.segment}"?`)) {
                                              const updated = businessSourcesList.filter((item) => item.segment !== bs.segment);
                                              saveBusinessSources(updated);
                                              setBusinessSourcesList(updated);
                                              triggerToast(`Deleted Market Segment "${bs.segment}"`);
                                            }
                                          }}
                                        >
                                          🗑️ Delete
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>

                  {showSourceDrawer && (
                    <div className="config-modal-overlay">
                      <div className="room-type-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                          <h3>{editingSource ? "Edit Business Source" : "Add Business Source"}</h3>
                          <button type="button" className="drawer-close-btn" onClick={() => setShowSourceDrawer(false)}>✕</button>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!sourceForm.segment.trim()) return;
                            const segName = sourceForm.segment.trim().toUpperCase();
                            const subArray = sourceForm.subSegmentsText
                              .split(",")
                              .map((s) => s.trim().toUpperCase())
                              .filter(Boolean);

                            let updatedList = [];
                            if (editingSource) {
                              updatedList = businessSourcesList.map((item) =>
                                (item.id === editingSource.id || item.segment === editingSource.segment)
                                  ? { ...item, segment: segName, subSegments: subArray }
                                  : item
                              );
                              triggerToast(`Updated Business Source: ${segName}`);
                            } else {
                              const newObj = {
                                id: `src_${Date.now()}`,
                                segment: segName,
                                subSegments: subArray.length > 0 ? subArray : ["GENERAL"]
                              };
                              updatedList = [...businessSourcesList, newObj];
                              triggerToast(`Created Business Source: ${segName}`);
                            }
                            saveBusinessSources(updatedList);
                            setBusinessSourcesList(updatedList);
                            setShowSourceDrawer(false);
                            setEditingSource(null);
                          }}
                          className="drawer-form"
                        >
                          <div className="drawer-input-box">
                            <label>Market Segment Name*</label>
                            <input
                              type="text"
                              value={sourceForm.segment}
                              onChange={(e) => setSourceForm({ ...sourceForm, segment: e.target.value })}
                              placeholder="e.g. PROMOTIONAL"
                              disabled={editingSource && ((editingSource.segment || "").toUpperCase().includes("COMPANY") || (editingSource.segment || "").toUpperCase().includes("CORPORATE"))}
                              required
                            />
                            {editingSource && ((editingSource.segment || "").toUpperCase().includes("COMPANY") || (editingSource.segment || "").toUpperCase().includes("CORPORATE")) && (
                              <span style={{ fontSize: "11.5px", color: "#64748b", marginTop: "4px", display: "block" }}>
                                🔒 System segment name cannot be changed (Data linked to Corporate / House accounts).
                              </span>
                            )}
                          </div>

                          <div className="drawer-input-box">
                            <label>Sub-Segments (Comma Separated)*</label>
                            <textarea
                              rows="4"
                              value={sourceForm.subSegmentsText}
                              onChange={(e) => setSourceForm({ ...sourceForm, subSegmentsText: e.target.value })}
                              placeholder="e.g. SPRING SALE, EMAIL BLAST, INSTAGRAM"
                              style={{ width: "100%", borderRadius: 8, border: "1.5px solid #cbd5e1", padding: "8px 10px", fontSize: 13, fontFamily: "inherit" }}
                              required
                            />
                            <span style={{ fontSize: 11.5, color: "#64748b", marginTop: 4, display: "block" }}>
                              Separate each sub-segment with a comma (e.g. &quot;WALK-IN, PHONE, WEBSITE&quot;)
                            </span>
                          </div>

                          <div className="drawer-actions">
                            <button type="submit" className="btn-lg-grey cr-submit-primary" style={{ width: "100%", height: 42, fontSize: 13, fontWeight: 800 }}>
                              Save Business Source
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  <AddCompanyModal
                    isOpen={showCompanyModal}
                    onClose={closeCompanyModal}
                    initialData={editingCompany}
                    onCompanyCreated={(compData) => {
                      if (editingCompany && (editingCompany.id || editingCompany.name)) {
                        updateCompanyAccount(editingCompany.id || editingCompany.name, compData);
                      } else {
                        addCompanyAccount(compData);
                      }
                      setCompanyAccountsState(getCompanyAccounts());
                      triggerToast(`Corporate Account "${compData.name}" saved successfully!`);
                    }}
                  />
                </div>
              )}

            {/* 1.7 BOOKING ENGINE DISPLAY TAB */}
            {propertySubTab === "ibeDisplay" && (
              <div className="config-section">
                <div className="manage-room-type-header">
                  <div>
                    <h2>Public Booking Engine Card Setup</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-lg-grey cr-submit-primary"
                    onClick={handleSaveIbeDisplays}
                  >
                    💾 Save All Display Settings
                  </button>
                </div>

                {/* PROVISION 1: WHICH RATE PLANS TO DISPLAY ON BOOKING ENGINE */}
                <div style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "16px", padding: "20px", marginTop: "20px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "900", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>📋 Rate Plans Provision for Booking Engine</span>
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                    {ratePlans.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>No rate plans configured yet. Create rate plans in Rate Plans tab.</span>
                    ) : (
                      ratePlans.map((rp) => {
                        const rootCfg = ibeDisplaysMap.root || {};
                        const isEnabled = rootCfg.enabledRatePlanIds ? rootCfg.enabledRatePlanIds.includes(rp.id) : (rp.showOnIbe !== false);
                        return (
                          <label
                            key={rp.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "10px 14px",
                              borderRadius: "10px",
                              border: isEnabled ? "1.5px solid #cbd5e1" : "1.5px solid #e2e8f0",
                              background: isEnabled ? "#f1f5f9" : "#f8fafc",
                              cursor: "pointer"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => {
                                const currentList = rootCfg.enabledRatePlanIds || ratePlans.map(r => r.id);
                                const nextList = e.target.checked
                                  ? [...new Set([...currentList, rp.id])]
                                  : currentList.filter(id => id !== rp.id);
                                handleIbeFieldChange("root", "enabledRatePlanIds", nextList);
                              }}
                            />
                            <div>
                              <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>{rp.name}</strong>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>{rp.code ? `[${rp.code}]` : ""} • Adj: {rp.adjustment || "0.00"}</span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* PROVISION 2: WHICH HOTEL ADDONS TO DISPLAY ON BOOKING ENGINE */}
                <div style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "16px", padding: "20px", marginTop: "16px", marginBottom: "20px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "900", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>🎁 Hotel Add-ons Provision for Booking Engine</span>
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                    {addonsList.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>No addons configured yet. Create addons in Hotel Addons tab.</span>
                    ) : (
                      addonsList.map((ad) => {
                        const rootCfg = ibeDisplaysMap.root || {};
                        const isEnabled = rootCfg.enabledAddonIds ? rootCfg.enabledAddonIds.includes(ad.id) : (ad.showOnIbe !== false);
                        return (
                          <label
                            key={ad.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "10px 14px",
                              borderRadius: "10px",
                              border: isEnabled ? "1.5px solid #cbd5e1" : "1.5px solid #e2e8f0",
                              background: isEnabled ? "#f1f5f9" : "#f8fafc",
                              cursor: "pointer"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => {
                                const currentList = rootCfg.enabledAddonIds || addonsList.map(a => a.id);
                                const nextList = e.target.checked
                                  ? [...new Set([...currentList, ad.id])]
                                  : currentList.filter(id => id !== ad.id);
                                handleIbeFieldChange("root", "enabledAddonIds", nextList);
                              }}
                            />
                            <div>
                              <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>{ad.name}</strong>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>+${ad.price} • {ad.billingType || "Per Stay"}</span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="ibe-display-cards-list" style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "20px" }}>
                  {roomTypes.length === 0 ? (
                    <div className="empty-room-types-box" style={{ padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: "14px", border: "1.5px dashed #cbd5e1" }}>
                      <h3>✨ No Room Categories Configured</h3>
                      <p>Please create room types first in <strong>Room Type Setup</strong> to customize their booking engine display cards.</p>
                    </div>
                  ) : (
                    roomTypes.map((cat) => {
                      const curData = ibeDisplaysMap[cat.id] || ibeDisplaysMap[cat.name] || {};
                      const photoUrl = curData.image || cat.image || "";

                      return (
                        <div
                          key={cat.id}
                          className="ibe-category-edit-card"
                          style={{
                            background: "#ffffff",
                            border: "1.5px solid #cbd5e1",
                            borderRadius: "16px",
                            padding: "24px",
                            boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ fontSize: "20px" }}>🛏️</span>
                              <div>
                                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "900", color: "#0f172a" }}>{cat.name}</h3>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>Base Tariff: <strong>${cat.price || 149}/night</strong> • ID: <code>{cat.id}</code></span>
                              </div>
                            </div>
                            <span style={{ background: "#f1f5f9", color: "#0f172a", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "800", border: "1px solid #cbd5e1" }}>
                              Live on Booking Engine
                            </span>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "24px" }}>
                            {/* Photo Column */}
                            <div>
                              <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#334155", marginBottom: "6px" }}>Category Photo / Image</label>
                              <div style={{ width: "100%", height: "160px", borderRadius: "12px", overflow: "hidden", border: "1.5px solid #cbd5e1", marginBottom: "10px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {photoUrl ? (
                                  <img src={photoUrl} alt={cat.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <div style={{ textAlign: "center", color: "#94a3b8", padding: "10px" }}>
                                    <span style={{ fontSize: "28px", display: "block", marginBottom: "4px" }}>🖼️</span>
                                    <span style={{ fontSize: "11px", fontWeight: "700" }}>No Photo Uploaded</span>
                                  </div>
                                )}
                              </div>

                              <label
                                style={{
                                  display: "block",
                                  width: "100%",
                                  padding: "9px 12px",
                                  fontSize: "12px",
                                  fontWeight: "800",
                                  background: "#f1f5f9",
                                  color: "#0f172a",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                  textAlign: "center",
                                  marginBottom: "8px",
                                  boxShadow: "0 2px 4px rgba(15,23,42,0.05)"
                                }}
                              >
                                📁 Upload Photo from Desktop
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ display: "none" }}
                                  onChange={(e) => handleIbeFileUpload(cat.id, e.target.files[0])}
                                />
                              </label>

                              <input
                                type="text"
                                placeholder="Or Paste Photo Web URL..."
                                value={curData.image || ""}
                                onChange={(e) => handleIbeFieldChange(cat.id, "image", e.target.value)}
                                style={{ width: "100%", padding: "6px 10px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                              />
                            </div>

                            {/* Details Column */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                                <div>
                                  <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#334155", marginBottom: "4px" }}>Promotional Badge / Tag</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Popular Choice, Best Seller"
                                    value={curData.badge || ""}
                                    onChange={(e) => handleIbeFieldChange(cat.id, "badge", e.target.value)}
                                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#334155", marginBottom: "4px" }}>Bed Type / Specs</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. 1 King Bed, 2 Queen Beds"
                                    value={curData.bedType || ""}
                                    onChange={(e) => handleIbeFieldChange(cat.id, "bedType", e.target.value)}
                                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#334155", marginBottom: "4px" }}>Room Size / Area</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. 450 sq.ft, 60 m²"
                                    value={curData.roomSize || ""}
                                    onChange={(e) => handleIbeFieldChange(cat.id, "roomSize", e.target.value)}
                                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                                  />
                                </div>
                              </div>

                              <div>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#334155", marginBottom: "4px" }}>Marketing Overview / Description</label>
                                <textarea
                                  rows={2}
                                  placeholder="Enter guest-facing room overview and marketing highlights..."
                                  value={curData.description || ""}
                                  onChange={(e) => handleIbeFieldChange(cat.id, "description", e.target.value)}
                                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12.5px", resize: "vertical" }}
                                />
                              </div>

                              <div>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#334155", marginBottom: "4px" }}>
                                  Room Amenities Checklist (Comma-separated)
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. AC, TV, WiFi, Mini Bar, Balcony, Safe"
                                  value={curData.amenitiesStr !== undefined ? curData.amenitiesStr : (Array.isArray(curData.amenities) ? curData.amenities.join(", ") : "")}
                                  onChange={(e) => {
                                    const rawStr = e.target.value;
                                    const list = rawStr.split(",").map((s) => s.trim()).filter(Boolean);
                                    handleIbeFieldChange(cat.id, "amenitiesStr", rawStr);
                                    handleIbeFieldChange(cat.id, "amenities", list);
                                  }}
                                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {roomTypes.length > 0 && (
                    <div style={{ textAlign: "right", marginTop: "16px" }}>
                      <button
                        type="button"
                        className="btn-lg-grey cr-submit-primary"
                        onClick={handleSaveIbeDisplays}
                      >
                        💾 Save All Display Settings
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 1.8 USER MANAGEMENT TAB */}
            {propertySubTab === "users" && (
              <div className="config-section">
                {/* SUB-NAV TABS */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setPropertySubTab("users")}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "10px",
                      fontWeight: "800",
                      fontSize: "13.5px",
                      border: "none",
                      cursor: "pointer",
                      background: "#0284c7",
                      color: "#ffffff",
                      boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span>👥</span> Staff Users Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertySubTab("roles")}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "10px",
                      fontWeight: "800",
                      fontSize: "13.5px",
                      border: "none",
                      cursor: "pointer",
                      background: "#f1f5f9",
                      color: "#475569",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span>🛡️</span> Setup Roles &amp; Assign Rights
                  </button>
                </div>

                <div className="manage-room-type-header" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <h2>User Management</h2>
                    <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                      Manage system users, housekeeper staff, roles, and automated permission rights.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleOpenAddHousekeeperDrawer}
                      style={{
                        background: "linear-gradient(135deg, #0284c7, #0369a1)",
                        color: "#ffffff",
                        border: "none",
                        padding: "10px 18px",
                        borderRadius: "10px",
                        fontWeight: "800",
                        fontSize: "13.5px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)"
                      }}
                    >
                      <span>🧹</span> + Add Housekeeper
                    </button>

                    <button
                      type="button"
                      className="btn-lg-grey"
                      onClick={handleOpenAddUserDrawer}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "10px",
                        fontWeight: "800",
                        fontSize: "13.5px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <span>👤</span> + Add New User
                    </button>
                  </div>
                </div>

                {/* USERS DATA TABLE */}
                <div className="table-responsive-box" style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,0.03)" }}>
                  <table className="config-data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0" }}>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569", whiteSpace: "nowrap" }}>USER DETAILS</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569", whiteSpace: "nowrap" }}>USERNAME</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569", whiteSpace: "nowrap" }}>ROLE</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569", whiteSpace: "nowrap" }}>ACCESS RIGHTS</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569", whiteSpace: "nowrap" }}>PASSWORD</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569", whiteSpace: "nowrap" }}>STATUS</th>
                        <th style={{ padding: "14px 16px", textAlign: "center", fontSize: "12px", fontWeight: "800", color: "#475569", whiteSpace: "nowrap" }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((u) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "14px", flexShrink: 0 }}>
                                {(u.name || u.username).slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <strong style={{ fontSize: "14px", color: "#0f172a", display: "block", whiteSpace: "nowrap" }}>{u.name}</strong>
                                <span style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>{u.email || "No email"}</span>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <code style={{ background: "#f1f5f9", padding: "4px 10px", borderRadius: "6px", fontSize: "12.5px", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap", display: "inline-block" }}>
                              @{u.username}
                            </code>
                          </td>

                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <span style={{ background: "#f1f5f9", color: "#0f172a", padding: "4px 10px", borderRadius: "8px", fontSize: "11.5px", fontWeight: "800", border: "1px solid #cbd5e1", whiteSpace: "nowrap", display: "inline-block" }}>
                              {u.role}
                            </span>
                          </td>

                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            {(() => {
                              const rights = getUserRights(u);
                              const totalCount = USER_RIGHTS_LABELS.length;
                              const activeCount = Object.values(rights).filter(Boolean).length;
                              const isFull = activeCount === totalCount;
                              return (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    background: isFull ? "#f8fafc" : "#ffffff",
                                    color: "#0f172a",
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: "800",
                                    border: "1px solid #cbd5e1",
                                    whiteSpace: "nowrap"
                                  }}
                                  title={USER_RIGHTS_LABELS.map(r => `${r.label}: ${rights[r.key] ? 'YES' : 'NO'}`).join('\n')}
                                >
                                  🔑 {activeCount} / {totalCount} Rights {isFull ? "(Full Access)" : ""}
                                </span>
                              );
                            })()}
                          </td>

                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <code style={{ background: "#f8fafc", color: "#475569", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "800", border: "1px solid #cbd5e1", whiteSpace: "nowrap", display: "inline-block" }}>
                              {u.password}
                            </code>
                          </td>

                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: u.status === "Active" ? "#dcfce7" : "#fee2e2",
                                color: u.status === "Active" ? "#15803d" : "#b91c1c",
                                padding: "4px 10px",
                                borderRadius: "999px",
                                fontSize: "11.5px",
                                fontWeight: "800",
                                whiteSpace: "nowrap"
                              }}
                            >
                              <span>{u.status === "Active" ? "🟢" : "🔴"}</span>
                              <span>{u.status === "Active" ? "Active" : "Suspended"}</span>
                            </span>
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "center", alignItems: "center", whiteSpace: "nowrap" }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                style={{ padding: "5px 12px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                onClick={() => handleOpenEditUserDrawer(u)}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                style={{ padding: "5px 12px", fontSize: "12px", fontWeight: "700", background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", opacity: u.username === "admin" ? 0.4 : 1, display: "inline-flex", alignItems: "center", gap: "4px" }}
                                disabled={u.username === "admin"}
                                onClick={() => handleDeleteUser(u.id)}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* CREATE / EDIT USER POPUP MODAL */}
                {showUserDrawer && (
                  <div
                    className="pms-modal-backdrop"
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(15, 23, 42, 0.65)",
                      backdropFilter: "blur(4px)",
                      zIndex: 9999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px"
                    }}
                    
                  >
                    <div
                      className="room-type-drawer pms-modal-card"
                      style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: "540px",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        background: "#ffffff",
                        borderRadius: "20px",
                        padding: "24px",
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                        margin: 0,
                        border: "1px solid #cbd5e1"
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="drawer-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "#0f172a" }}>
                          {isHousekeeperDrawer ? (
                            editingUser ? `🧹 Edit Housekeeper (@${editingUser.username})` : "🧹 Add Housekeeper Staff"
                          ) : (
                            editingUser ? `✏️ Edit User (@${editingUser.username})` : "👤 Create New User Account"
                          )}
                        </h3>
                        <button
                          type="button"
                          className="drawer-close-btn"
                          onClick={() => setShowUserDrawer(false)}
                          style={{ border: "none", background: "#f1f5f9", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", fontSize: "16px", color: "#64748b" }}
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleSaveUserSubmit} className="drawer-form">
                        <div className="drawer-input-box">
                          <label>Username*</label>
                          <input
                            type="text"
                            required
                            value={userForm.username}
                            onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                            placeholder="e.g. rohit_sharma"
                          />
                          <span className="sub-hint">Unique staff username used for logging into InnOut PMS</span>
                        </div>

                        <div className="drawer-input-box">
                          <label>Account Password*</label>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <input
                              type={showPasswordInUserForm ? "text" : "password"}
                              required
                              value={userForm.password}
                              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                              placeholder="Enter password..."
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPasswordInUserForm(!showPasswordInUserForm)}
                              style={{ padding: "0 12px", fontSize: "12px", fontWeight: "700", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#f8fafc", cursor: "pointer" }}
                            >
                              {showPasswordInUserForm ? "🙈 Hide" : "👁️ Show"}
                            </button>
                          </div>
                        </div>

                        <div className="drawer-input-box">
                          <label>Full Name*</label>
                          <input
                            type="text"
                            required
                            value={userForm.name}
                            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                            placeholder="e.g. Rohit Sharma"
                          />
                        </div>

                        <div className="drawer-input-box">
                          <label>Email Address</label>
                          <input
                            type="email"
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            placeholder="staff@bhopalgrand.com"
                          />
                        </div>

                        {/* ROLE SELECT OR HOUSEKEEPER READONLY BADGE */}
                        {isHousekeeperDrawer ? (
                          <div className="drawer-input-box" style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd", padding: "12px 14px", borderRadius: "12px", margin: "12px 0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <strong style={{ fontSize: "13.5px", color: "#0369a1", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span>🧹</span> System Role: Housekeeper
                                </strong>
                                <span style={{ fontSize: "12px", color: "#0284c7", display: "block", marginTop: "2px" }}>
                                  Permissions automatically configured based on Housekeeper Role matrix.
                                </span>
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: "800", padding: "4px 8px", background: "#0284c7", color: "#ffffff", borderRadius: "6px", whiteSpace: "nowrap" }}>
                                PRE-ASSIGNED
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="drawer-input-box">
                            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span>System Role*</span>
                              <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: "700" }}>⚡ Auto-Assigns Rights</span>
                            </label>
                            <select
                              value={userForm.role}
                              onChange={(e) => handleRoleChangeInUserForm(e.target.value)}
                              style={{ padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13.5px", fontWeight: "700" }}
                            >
                              {rolesList.map((r) => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="drawer-input-box">
                          <label>Account Status</label>
                          <select
                            value={userForm.status}
                            onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                          >
                            <option value="Active">Active</option>
                            <option value="Suspended">Suspended</option>
                          </select>
                        </div>

                        {/* 🔑 USER ACCESS RIGHTS & PRIVILEGES (HIDDEN FOR HOUSEKEEPER, COLLAPSIBLE FOR OTHERS) */}
                        {!isHousekeeperDrawer && (
                          <div className="drawer-input-box" style={{ marginTop: "16px", borderTop: "1px dashed #cbd5e1", paddingTop: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                              <div>
                                <strong style={{ fontSize: "13px", color: "#0f172a" }}>🔑 Role Permissions Inherited</strong>
                                <span style={{ fontSize: "11.5px", color: "#64748b", display: "block" }}>
                                  Privileges pre-assigned based on "{userForm.role}" Role matrix.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowCustomRights(!showCustomRights)}
                                style={{ padding: "6px 12px", fontSize: "12px", fontWeight: "700", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px", color: "#0284c7", cursor: "pointer" }}
                              >
                                {showCustomRights ? "Hide Custom Rights" : "⚙️ Customize Rights"}
                              </button>
                            </div>

                            {showCustomRights && (
                              <div style={{ marginTop: "14px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                  <span style={{ fontSize: "12px", fontWeight: "800", color: "#475569" }}>Individual Privilege Overrides</span>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                      type="button"
                                      onClick={() => setUserForm((prev) => ({ ...prev, rights: { ...ALL_YES_RIGHTS } }))}
                                      style={{ padding: "4px 8px", fontSize: "11px", fontWeight: "700", background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}
                                    >
                                      Select All
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const matched = rolesList.find((r) => r.name?.toLowerCase() === userForm.role?.toLowerCase());
                                        const roleDefault = matched?.rights ? { ...matched.rights } : DEFAULT_USER_RIGHTS;
                                        setUserForm((prev) => ({ ...prev, rights: { ...roleDefault } }));
                                      }}
                                      style={{ padding: "4px 8px", fontSize: "11px", fontWeight: "700", background: "#ffffff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}
                                    >
                                      Reset Role Defaults
                                    </button>
                                  </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                  {["Page Access", "Operational Actions"].map((catName) => {
                                    const catItems = USER_RIGHTS_LABELS.filter((r) => r.category === catName);
                                    if (catItems.length === 0) return null;
                                    return (
                                      <div key={catName}>
                                        <div style={{ fontSize: "11px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px", color: catName === "Page Access" ? "#0284c7" : "#d97706", margin: "8px 0 6px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                                          <span>{catName === "Page Access" ? "📂 Sidebar Page Access Rights" : "⚡ Operational Action Rights"}</span>
                                          <span style={{ fontSize: "10px", padding: "1px 6px", background: "#f1f5f9", borderRadius: "10px", color: "#64748b" }}>{catItems.length}</span>
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                          {catItems.map((r) => {
                                            const isGranted = Boolean(userForm.rights?.[r.key]);
                                            return (
                                              <div
                                                key={r.key}
                                                onClick={() => {
                                                  setUserForm((prev) => ({
                                                    ...prev,
                                                    rights: {
                                                      ...prev.rights,
                                                      [r.key]: !prev.rights?.[r.key]
                                                    }
                                                  }));
                                                }}
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "space-between",
                                                  padding: "9px 12px",
                                                  background: isGranted ? "#f8fafc" : "#ffffff",
                                                  border: `1.5px solid ${isGranted ? "#0f172a" : "#e2e8f0"}`,
                                                  borderRadius: "10px",
                                                  cursor: "pointer",
                                                  transition: "all 0.15s ease",
                                                  userSelect: "none"
                                                }}
                                              >
                                                <div>
                                                  <strong style={{ fontSize: "13px", color: isGranted ? "#0f172a" : "#64748b", display: "block" }}>
                                                    {r.label}
                                                  </strong>
                                                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>{r.desc}</span>
                                                </div>
                                                <span style={{ fontSize: "11px", fontWeight: "800", padding: "3px 10px", borderRadius: "6px", background: isGranted ? "#0f172a" : "#f1f5f9", color: isGranted ? "#ffffff" : "#64748b" }}>
                                                  {isGranted ? "YES" : "NO"}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="drawer-actions" style={{ marginTop: "20px" }}>
                          <button
                            type="submit"
                            className="btn-lg-grey cr-submit-primary"
                            style={{
                              width: "100%",
                              background: isHousekeeperDrawer ? "linear-gradient(135deg, #0284c7, #0369a1)" : undefined,
                              borderColor: isHousekeeperDrawer ? "#0284c7" : undefined
                            }}
                          >
                            {isHousekeeperDrawer ? (
                              editingUser ? "Save Housekeeper Changes" : "Create Housekeeper Account"
                            ) : (
                              editingUser ? "Save Changes" : "Create User Account"
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* 1.8.2 ROLE MANAGEMENT & RIGHTS ASSIGNMENT TAB */}
            {propertySubTab === "roles" && (
              <div className="config-section">
                {/* SUB-NAV TABS */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setPropertySubTab("users")}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "10px",
                      fontWeight: "800",
                      fontSize: "13.5px",
                      border: "none",
                      cursor: "pointer",
                      background: "#f1f5f9",
                      color: "#475569",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span>👥</span> Staff Users Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertySubTab("roles")}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "10px",
                      fontWeight: "800",
                      fontSize: "13.5px",
                      border: "none",
                      cursor: "pointer",
                      background: "#0284c7",
                      color: "#ffffff",
                      boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span>🛡️</span> Setup Roles &amp; Assign Rights
                  </button>
                </div>

                {/* HEADER BAR */}
                <div className="manage-room-type-header" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <h2>Role Setup &amp; Rights Assignment</h2>
                    <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                      Configure staff system roles, customize module privileges, and assign granular access rights across the PMS.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleOpenAddRoleModal}
                      style={{
                        background: "linear-gradient(135deg, #0f172a, #1e293b)",
                        color: "#ffffff",
                        border: "none",
                        padding: "10px 18px",
                        borderRadius: "10px",
                        fontWeight: "800",
                        fontSize: "13.5px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.25)"
                      }}
                    >
                      <span>➕</span> + Setup New Role
                    </button>
                  </div>
                </div>

                {/* ROLES GRID */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
                  {rolesList.map((r) => {
                    const rights = r.rights || DEFAULT_USER_RIGHTS;
                    const totalCount = USER_RIGHTS_LABELS.length;
                    const activeCount = Object.values(rights).filter(Boolean).length;
                    const isFull = activeCount === totalCount;

                    return (
                      <div
                        key={r.id}
                        style={{
                          background: "#ffffff",
                          border: "1.5px solid #e2e8f0",
                          borderRadius: "16px",
                          padding: "20px",
                          boxShadow: "0 4px 16px rgba(15,23,42,0.03)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between"
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                              <span>🛡️</span> {r.name}
                            </h3>
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: "800",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: r.isBuiltIn ? "#f1f5f9" : "#e0f2fe",
                                color: r.isBuiltIn ? "#475569" : "#0369a1",
                                border: r.isBuiltIn ? "1px solid #cbd5e1" : "1px solid #bae6fd"
                              }}
                            >
                              {r.isBuiltIn ? "SYSTEM BUILT-IN" : "CUSTOM ROLE"}
                            </span>
                          </div>

                          <p style={{ fontSize: "12.5px", color: "#64748b", margin: "0 0 14px 0", lineHeight: "1.4" }}>
                            {r.description || "System staff role with assigned module permissions."}
                          </p>

                          {/* RIGHTS SUMMARY BADGE */}
                          <div
                            style={{
                              background: isFull ? "#f0fdf4" : "#f8fafc",
                              border: isFull ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                              borderRadius: "8px",
                              padding: "8px 12px",
                              fontSize: "12px",
                              fontWeight: "800",
                              color: isFull ? "#166534" : "#0f172a",
                              marginBottom: "14px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between"
                            }}
                          >
                            <span>🔑 Privileges Assigned</span>
                            <span>{activeCount} / {totalCount} Rights {isFull ? "(Full Access)" : ""}</span>
                          </div>

                          {/* GRANULAR RIGHTS LIST */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "16px" }}>
                            {USER_RIGHTS_LABELS.map((item) => {
                              const hasRight = Boolean(rights[item.key]);
                              return (
                                <div
                                  key={item.key}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "11.5px",
                                    fontWeight: "700",
                                    color: hasRight ? "#0f172a" : "#94a3b8",
                                    background: hasRight ? "#f8fafc" : "#fafafa",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    border: "1px solid #f1f5f9"
                                  }}
                                >
                                  <span>{hasRight ? "🟢" : "🔴"}</span>
                                  <span style={{ textDecoration: hasRight ? "none" : "line-through" }}>{item.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* CARD FOOTER ACTIONS */}
                        <div style={{ display: "flex", gap: "8px", borderTop: "1px dashed #e2e8f0", paddingTop: "14px", marginTop: "auto" }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleOpenEditRoleModal(r)}
                            style={{ flex: 1, padding: "8px", fontSize: "12.5px", fontWeight: "800", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                          >
                            ✏️ Edit Rights &amp; Role
                          </button>
                          {!r.isBuiltIn && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleDeleteRole(r.id)}
                              style={{ padding: "8px 12px", fontSize: "12.5px", fontWeight: "800", background: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ADD / EDIT ROLE MODAL */}
                {showAddRoleModal && (
                  <div
                    className="pms-modal-backdrop"
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(15, 23, 42, 0.65)",
                      backdropFilter: "blur(4px)",
                      zIndex: 9999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px"
                    }}
                    
                  >
                    <div
                      className="pms-modal-card"
                      style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: "560px",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        background: "#ffffff",
                        borderRadius: "20px",
                        padding: "24px",
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                        border: "1px solid #cbd5e1"
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="drawer-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "#0f172a" }}>
                          {editingRole ? `✏️ Edit Role: ${editingRole.name}` : "🛡️ Setup New System Role"}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowAddRoleModal(false)}
                          style={{ border: "none", background: "#f1f5f9", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", fontSize: "16px", color: "#64748b" }}
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleSaveRoleSubmit} className="drawer-form">
                        <div className="drawer-input-box">
                          <label>Role Name*</label>
                          <input
                            type="text"
                            required
                            value={roleForm.name}
                            onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                            placeholder="e.g. Front Desk Supervisor, Valet Manager"
                          />
                        </div>

                        <div className="drawer-input-box">
                          <label>Description</label>
                          <textarea
                            value={roleForm.description}
                            onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                            placeholder="Brief summary of duties and responsibilities for this role..."
                            rows={2}
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px" }}
                          />
                        </div>

                        {/* PRESETS & RIGHTS CHECKLIST */}
                        <div className="drawer-input-box" style={{ marginTop: "16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <label style={{ margin: 0, fontWeight: "800", fontSize: "13.5px" }}>🔑 Assign Access Rights &amp; Privileges</label>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => setRoleForm((prev) => ({ ...prev, rights: { ...ALL_YES_RIGHTS } }))}
                                style={{ padding: "4px 8px", fontSize: "11px", fontWeight: "700", background: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={() => setRoleForm((prev) => ({ ...prev, rights: { ...DEFAULT_USER_RIGHTS } }))}
                                style={{ padding: "4px 8px", fontSize: "11px", fontWeight: "700", background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}
                              >
                                Clear All
                              </button>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {["Page Access", "Operational Actions"].map((catName) => {
                              const catItems = USER_RIGHTS_LABELS.filter((r) => r.category === catName);
                              if (catItems.length === 0) return null;
                              return (
                                <div key={catName}>
                                  <div style={{ fontSize: "11px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px", color: catName === "Page Access" ? "#0284c7" : "#d97706", margin: "8px 0 6px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>{catName === "Page Access" ? "📂 Sidebar Page Access Rights" : "⚡ Operational Action Rights"}</span>
                                    <span style={{ fontSize: "10px", padding: "1px 6px", background: "#f1f5f9", borderRadius: "10px", color: "#64748b" }}>{catItems.length}</span>
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {catItems.map((r) => {
                                      const isGranted = Boolean(roleForm.rights?.[r.key]);
                                      return (
                                        <div
                                          key={r.key}
                                          onClick={() => {
                                            setRoleForm((prev) => ({
                                              ...prev,
                                              rights: {
                                                ...prev.rights,
                                                [r.key]: !prev.rights?.[r.key]
                                              }
                                            }));
                                          }}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "9px 12px",
                                            background: isGranted ? "#f0f9ff" : "#f8fafc",
                                            border: isGranted ? "1.5px solid #7dd3fc" : "1px solid #e2e8f0",
                                            borderRadius: "10px",
                                            cursor: "pointer",
                                            transition: "all 0.15s ease"
                                          }}
                                        >
                                          <div>
                                            <strong style={{ fontSize: "13px", color: isGranted ? "#0369a1" : "#475569", display: "block" }}>{r.label}</strong>
                                            <span style={{ fontSize: "11px", color: "#64748b" }}>{r.desc}</span>
                                          </div>
                                          <span style={{ fontSize: "16px" }}>
                                            {isGranted ? "✅" : "⚪"}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setShowAddRoleModal(false)}
                            style={{ flex: 1, padding: "11px", borderRadius: "10px", fontWeight: "700" }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ flex: 1, padding: "11px", borderRadius: "10px", fontWeight: "800", background: "#0284c7" }}
                          >
                            {editingRole ? "Save Role Changes" : "Create Role"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 1.9 YIELD MANAGEMENT & DYNAMIC PRICING TAB */}
            {propertySubTab === "yield" && (
              <div className="config-section">
                <div className="manage-room-type-header" style={{ marginBottom: "20px" }}>
                  <div>
                    <h2>Automated Yield Management &amp; Dynamic Pricing</h2>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <button
                      type="button"
                      onClick={handleToggleYieldMaster}
                      className="btn-lg-grey"
                      style={{ padding: "8px 16px", fontSize: "13px", fontWeight: "800" }}
                    >
                      {yieldEnabled ? "🟢 Yield Pricing: ENABLED" : "⏸️ Yield Pricing: PAUSED"}
                    </button>

                    <button
                      type="button"
                      className="btn-lg-grey"
                      onClick={handleOpenAddYieldDrawer}
                    >
                      + Create Yield Rule
                    </button>
                  </div>
                </div>

                {/* YIELD SIMULATOR WIDGET */}
                <div style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: "16px", padding: "20px", marginBottom: "24px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "900", color: "#0f172a" }}>
                    🧮 Interactive Yield Price Simulator
                  </h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: "16px", alignItems: "center" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#334155", marginBottom: "4px" }}>
                        Simulated Base Tariff ($/night)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={simulatedBaseRate}
                        onChange={(e) => setSimulatedBaseRate(Number(e.target.value))}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: "700" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#334155", marginBottom: "4px" }}>
                        Occupancy Level: <strong>{simulatedOcc}%</strong>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={simulatedOcc}
                        onChange={(e) => setSimulatedOcc(Number(e.target.value))}
                        style={{ width: "100%", cursor: "pointer" }}
                      />
                    </div>

                    {(() => {
                      const simResult = calculateYieldPrice(simulatedBaseRate, simulatedOcc);
                      return (
                        <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "10px", padding: "12px 16px", textAlign: "right" }}>
                          <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>
                            {simResult.adjustmentText}
                          </span>
                          <div style={{ fontSize: "22px", fontWeight: "900", color: simResult.adjustedPrice > simulatedBaseRate ? "#059669" : simResult.adjustedPrice < simulatedBaseRate ? "#dc2626" : "#0f172a" }}>
                            ${simResult.adjustedPrice} <span style={{ fontSize: "13px", fontWeight: "700", color: "#64748b" }}>/ night</span>
                          </div>
                          {simResult.ruleApplied && (
                            <span style={{ fontSize: "11px", color: "#2563eb", fontWeight: "700" }}>
                              Rule: {simResult.ruleApplied.name} ({simResult.ruleApplied.minOccupancy}% - {simResult.ruleApplied.maxOccupancy}%)
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* YIELD RULES DATA TABLE */}
                <div className="table-responsive-box" style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,0.03)" }}>
                  <table className="config-data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0" }}>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569" }}>RULE NAME</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569" }}>OCCUPANCY RANGE</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569" }}>RATE ADJUSTMENT</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569" }}>MIN LENGTH OF STAY</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: "800", color: "#475569" }}>STATUS</th>
                        <th style={{ padding: "14px 16px", textAlign: "center", fontSize: "12px", fontWeight: "800", color: "#475569" }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yieldRulesList.map((r) => (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>{r.name}</strong>
                            <span style={{ fontSize: "11.5px", color: "#64748b" }}>Applies to: {r.appliesTo === "All" ? "All Room Categories" : r.appliesTo}</span>
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ background: "#f1f5f9", color: "#0f172a", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "800", border: "1px solid #cbd5e1" }}>
                              {r.minOccupancy}% to {r.maxOccupancy}%
                            </span>
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <span
                              style={{
                                background: Number(r.adjustmentValue || 0) > 0 ? "#ecfdf5" : Number(r.adjustmentValue || 0) < 0 ? "#fef2f2" : "#f1f5f9",
                                color: Number(r.adjustmentValue || 0) > 0 ? "#059669" : Number(r.adjustmentValue || 0) < 0 ? "#dc2626" : "#475569",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                fontSize: "12px",
                                fontWeight: "900"
                              }}
                            >
                              {r.adjustmentType === "percentage"
                                ? (Number(r.adjustmentValue || 0) >= 0 ? `+${r.adjustmentValue}% Surge` : `${r.adjustmentValue}% Discount`)
                                : r.adjustmentType === "fixed"
                                ? (Number(r.adjustmentValue || 0) >= 0 ? `+$${r.adjustmentValue} Surge` : `-$${Math.abs(r.adjustmentValue)} Discount`)
                                : `Flat $${r.adjustmentValue}`}
                            </span>
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#334155" }}>
                              {r.minStayDays || 1} Night{(r.minStayDays || 1) > 1 ? "s" : ""}
                            </span>
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ background: r.status === "Active" ? "#dcfce7" : "#fee2e2", color: r.status === "Active" ? "#15803d" : "#b91c1c", padding: "3px 10px", borderRadius: "999px", fontSize: "11.5px", fontWeight: "800" }}>
                              {r.status === "Active" ? "🟢 Active" : "🔴 Disabled"}
                            </span>
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                style={{ padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}
                                onClick={() => handleOpenEditYieldDrawer(r)}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                style={{ padding: "5px 10px", fontSize: "12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
                                onClick={() => handleDeleteYieldRule(r.id)}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* CREATE / EDIT YIELD RULE POPUP MODAL */}
                {showYieldDrawer && (
                  <div
                    className="pms-modal-backdrop"
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(15, 23, 42, 0.65)",
                      backdropFilter: "blur(4px)",
                      zIndex: 9999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px"
                    }}
                    
                  >
                    <div
                      className="room-type-drawer pms-modal-card"
                      style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: "540px",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        background: "#ffffff",
                        borderRadius: "20px",
                        padding: "24px",
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                        margin: 0,
                        border: "1px solid #cbd5e1"
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="drawer-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "#0f172a" }}>
                          {editingYieldRule ? `Edit Yield Rule (${editingYieldRule.name})` : "Create New Yield Rule"}
                        </h3>
                        <button
                          type="button"
                          className="drawer-close-btn"
                          onClick={() => setShowYieldDrawer(false)}
                          style={{ border: "none", background: "#f1f5f9", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", fontSize: "16px", color: "#64748b" }}
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleSaveYieldSubmit} className="drawer-form">
                        <div className="drawer-input-box">
                          <label>Rule Name*</label>
                          <input
                            type="text"
                            required
                            value={yieldForm.name}
                            onChange={(e) => setYieldForm({ ...yieldForm, name: e.target.value })}
                            placeholder="e.g. High Demand Surge (70%-85%)"
                          />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <div className="drawer-input-box">
                            <label>Min Occupancy %*</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              required
                              value={yieldForm.minOccupancy}
                              onChange={(e) => setYieldForm({ ...yieldForm, minOccupancy: e.target.value })}
                              placeholder="60"
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Max Occupancy %*</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              required
                              value={yieldForm.maxOccupancy}
                              onChange={(e) => setYieldForm({ ...yieldForm, maxOccupancy: e.target.value })}
                              placeholder="85"
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <div className="drawer-input-box">
                            <label>Adjustment Type*</label>
                            <select
                              value={yieldForm.adjustmentType}
                              onChange={(e) => setYieldForm({ ...yieldForm, adjustmentType: e.target.value })}
                            >
                              <option value="percentage">Percentage (+ / - %)</option>
                              <option value="fixed">Fixed Amount (+ / - $)</option>
                              <option value="flat">Flat Rate Override ($)</option>
                            </select>
                          </div>

                          <div className="drawer-input-box">
                            <label>Adjustment Value*</label>
                            <input
                              type="number"
                              required
                              value={yieldForm.adjustmentValue}
                              onChange={(e) => setYieldForm({ ...yieldForm, adjustmentValue: e.target.value })}
                              placeholder="e.g. 15 for +15%, or -10 for 10% discount"
                            />
                          </div>
                        </div>

                        <div className="drawer-input-box">
                          <label>Min Length of Stay (Nights)</label>
                          <input
                            type="number"
                            min={1}
                            value={yieldForm.minStayDays}
                            onChange={(e) => setYieldForm({ ...yieldForm, minStayDays: e.target.value })}
                            placeholder="1"
                          />
                        </div>

                        <div className="drawer-input-box">
                          <label>Rule Status</label>
                          <select
                            value={yieldForm.status}
                            onChange={(e) => setYieldForm({ ...yieldForm, status: e.target.value })}
                          >
                            <option value="Active">Active</option>
                            <option value="Disabled">Disabled</option>
                          </select>
                        </div>

                        <div className="drawer-actions" style={{ marginTop: "20px" }}>
                          <button type="submit" className="btn-lg-grey cr-submit-primary" style={{ width: "100%" }}>
                            {editingYieldRule ? "Save Rule Changes" : "Create Yield Tier Rule"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 1.10 STATUS COLOR SETUP TAB */}
            {propertySubTab === "colors" && (
              <div className="config-section">
                <div className="manage-room-type-header" style={{ marginBottom: "20px" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>Color Setup</h2>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                      Customize colors for Tape Chart guest reservations, Daily Activity status cards, and Housekeeping status boxes.
                    </p>
                  </div>
                </div>

                {/* SUB TABS NAVIGATION */}
                <div style={{ display: "flex", gap: "10px", borderBottom: "2px solid #e2e8f0", marginBottom: "20px" }}>
                  <button
                    type="button"
                    style={{
                      padding: "10px 18px",
                      fontWeight: "700",
                      fontSize: "14px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      borderBottom: colorSubTab === "tape_chart" ? "3px solid #2563eb" : "3px solid transparent",
                      color: colorSubTab === "tape_chart" ? "#2563eb" : "#64748b",
                      transition: "all 0.15s ease-in-out",
                    }}
                    onClick={() => setColorSubTab("tape_chart")}
                  >
                    Tape Chart Colors
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "10px 18px",
                      fontWeight: "700",
                      fontSize: "14px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      borderBottom: colorSubTab === "activity" ? "3px solid #2563eb" : "3px solid transparent",
                      color: colorSubTab === "activity" ? "#2563eb" : "#64748b",
                      transition: "all 0.15s ease-in-out",
                    }}
                    onClick={() => setColorSubTab("activity")}
                  >
                    Activity Color
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "10px 18px",
                      fontWeight: "700",
                      fontSize: "14px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      borderBottom: colorSubTab === "hk" ? "3px solid #2563eb" : "3px solid transparent",
                      color: colorSubTab === "hk" ? "#2563eb" : "#64748b",
                      transition: "all 0.15s ease-in-out",
                    }}
                    onClick={() => setColorSubTab("hk")}
                  >
                    HK Color
                  </button>
                </div>

                {/* 1. TAPE CHART COLORS */}
                {colorSubTab === "tape_chart" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#1e293b" }}>Reservation Status Colors (Tape Chart)</h3>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button type="button" onClick={handleResetStatusColors} className="btn-lg-grey" style={{ padding: "8px 14px", fontSize: "13px" }}>
                          🔄 Reset to Defaults
                        </button>
                        <button type="button" onClick={handleSaveStatusColors} className="btn-lg-grey cr-submit-primary" style={{ padding: "8px 16px", fontSize: "13px" }}>
                          💾 Save Color Setup
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                      {/* 1. CONFIRMED STATUS */}
                      <div className="pms-card" style={{ padding: "18px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "#ffffff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px", color: "#0f172a", fontWeight: "800" }}>Confirmed Status</h3>
                          <span
                            style={{
                              background: statusColors.confirmed?.bg || "#2563eb",
                              color: statusColors.confirmed?.text || "#ffffff",
                              padding: "3px 10px",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "800",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                            }}
                          >
                            Sample Guest
                          </span>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Background Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="color"
                              value={statusColors.confirmed?.bg || "#2563eb"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  confirmed: { ...statusColors.confirmed, bg: e.target.value },
                                })
                              }
                              style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                            />
                            <input
                              type="text"
                              value={statusColors.confirmed?.bg || "#2563eb"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  confirmed: { ...statusColors.confirmed, bg: e.target.value },
                                })
                              }
                              style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                            />
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Font / Text Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="color"
                              value={statusColors.confirmed?.text || "#ffffff"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  confirmed: { ...statusColors.confirmed, text: e.target.value },
                                })
                              }
                              style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                            />
                            <input
                              type="text"
                              value={statusColors.confirmed?.text || "#ffffff"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  confirmed: { ...statusColors.confirmed, text: e.target.value },
                                })
                              }
                              style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 2. CHECKED-IN STATUS */}
                      <div className="pms-card" style={{ padding: "18px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "#ffffff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px", color: "#0f172a", fontWeight: "800" }}>Checked-In Status</h3>
                          <span
                            style={{
                              background: statusColors.checked_in?.bg || "#16a34a",
                              color: statusColors.checked_in?.text || "#ffffff",
                              padding: "3px 10px",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "800",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                            }}
                          >
                            In-House Guest
                          </span>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Background Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="color"
                              value={statusColors.checked_in?.bg || "#16a34a"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  checked_in: { ...statusColors.checked_in, bg: e.target.value },
                                })
                              }
                              style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                            />
                            <input
                              type="text"
                              value={statusColors.checked_in?.bg || "#16a34a"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  checked_in: { ...statusColors.checked_in, bg: e.target.value },
                                })
                              }
                              style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                            />
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Font / Text Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="color"
                              value={statusColors.checked_in?.text || "#ffffff"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  checked_in: { ...statusColors.checked_in, text: e.target.value },
                                })
                              }
                              style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                            />
                            <input
                              type="text"
                              value={statusColors.checked_in?.text || "#ffffff"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  checked_in: { ...statusColors.checked_in, text: e.target.value },
                                })
                              }
                              style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 3. CHECKED-OUT STATUS */}
                      <div className="pms-card" style={{ padding: "18px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "#ffffff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px", color: "#0f172a", fontWeight: "800" }}>Checked-Out Status</h3>
                          <span
                            style={{
                              background: statusColors.checked_out?.bg || "#64748b",
                              color: statusColors.checked_out?.text || "#ffffff",
                              padding: "3px 10px",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "800",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                            }}
                          >
                            Checked-Out
                          </span>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Background Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="color"
                              value={statusColors.checked_out?.bg || "#64748b"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  checked_out: { ...statusColors.checked_out, bg: e.target.value },
                                })
                              }
                              style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                            />
                            <input
                              type="text"
                              value={statusColors.checked_out?.bg || "#64748b"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  checked_out: { ...statusColors.checked_out, bg: e.target.value },
                                })
                              }
                              style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                            />
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Font / Text Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="color"
                              value={statusColors.checked_out?.text || "#ffffff"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  checked_out: { ...statusColors.checked_out, text: e.target.value },
                                })
                              }
                              style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                            />
                            <input
                              type="text"
                              value={statusColors.checked_out?.text || "#ffffff"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  checked_out: { ...statusColors.checked_out, text: e.target.value },
                                })
                              }
                              style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 4. BLOCKED STATUS */}
                      <div className="pms-card" style={{ padding: "18px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "#ffffff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px", color: "#0f172a", fontWeight: "800" }}>Out of Order / Blocked</h3>
                          <span
                            style={{
                              background: statusColors.blocked?.bg || "#dc2626",
                              color: statusColors.blocked?.text || "#ffffff",
                              padding: "3px 10px",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "800",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                            }}
                          >
                            Out of Order
                          </span>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Background Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="color"
                              value={statusColors.blocked?.bg || "#dc2626"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  blocked: { ...statusColors.blocked, bg: e.target.value },
                                })
                              }
                              style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                            />
                            <input
                              type="text"
                              value={statusColors.blocked?.bg || "#dc2626"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  blocked: { ...statusColors.blocked, bg: e.target.value },
                                })
                              }
                              style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                            />
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Font / Text Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="color"
                              value={statusColors.blocked?.text || "#ffffff"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  blocked: { ...statusColors.blocked, text: e.target.value },
                                })
                              }
                              style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                            />
                            <input
                              type="text"
                              value={statusColors.blocked?.text || "#ffffff"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  blocked: { ...statusColors.blocked, text: e.target.value },
                                })
                              }
                              style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 5. ENQUIRY STATUS */}
                      <div className="pms-card" style={{ padding: "18px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "#ffffff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px", color: "#0f172a", fontWeight: "800" }}>Enquiry Status</h3>
                          <span
                            style={{
                              background: statusColors.enquiry?.bg || "#f59e0b",
                              color: statusColors.enquiry?.text || "#ffffff",
                              padding: "3px 10px",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "800",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                            }}
                          >
                            Enquiry Guest
                          </span>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Background Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="color"
                              value={statusColors.enquiry?.bg || "#f59e0b"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  enquiry: { ...statusColors.enquiry, bg: e.target.value },
                                })
                              }
                              style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                            />
                            <input
                              type="text"
                              value={statusColors.enquiry?.bg || "#f59e0b"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  enquiry: { ...statusColors.enquiry, bg: e.target.value },
                                })
                              }
                              style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                            />
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Font / Text Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="color"
                              value={statusColors.enquiry?.text || "#ffffff"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  enquiry: { ...statusColors.enquiry, text: e.target.value },
                                })
                              }
                              style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                            />
                            <input
                              type="text"
                              value={statusColors.enquiry?.text || "#ffffff"}
                              onChange={(e) =>
                                setStatusColors({
                                  ...statusColors,
                                  enquiry: { ...statusColors.enquiry, text: e.target.value },
                                })
                              }
                              style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ACTIVITY COLOR */}
                {colorSubTab === "activity" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#1e293b" }}>Daily Activities List Status Cards</h3>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button type="button" onClick={handleResetActivityColors} className="btn-lg-grey" style={{ padding: "8px 14px", fontSize: "13px" }}>
                          🔄 Reset to Defaults
                        </button>
                        <button type="button" onClick={handleSaveActivityColors} className="btn-lg-grey cr-submit-primary" style={{ padding: "8px 16px", fontSize: "13px" }}>
                          💾 Save Activity Colors
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                      {[
                        { key: "arrivals", label: "Arrivals", icon: "📥" },
                        { key: "departures", label: "Departures", icon: "📤" },
                        { key: "inHouse", label: "In-House", icon: "👤" },
                        { key: "stayovers", label: "Stayovers", icon: "🌙" },
                        { key: "bookings", label: "Bookings", icon: "📋" },
                        { key: "cancelations", label: "Cancelations", icon: "❌" },
                        { key: "noShow", label: "No Show", icon: "🚫" },
                        { key: "blocked", label: "Blocked Rooms", icon: "🔒" },
                      ].map((item) => {
                        const col = activityColors[item.key] || { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" };
                        return (
                          <div key={item.key} className="pms-card" style={{ padding: "18px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "#ffffff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                              <h3 style={{ margin: 0, fontSize: "14px", color: "#0f172a", fontWeight: "800" }}>{item.label}</h3>
                              <div
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  background: col.bg,
                                  color: col.text,
                                  border: `1px solid ${col.border}`,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  fontSize: "12px",
                                  fontWeight: "800",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                                }}
                              >
                                <span>12</span>
                                <span>{item.icon}</span>
                              </div>
                            </div>

                            <div style={{ marginBottom: "10px" }}>
                              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Background Color</div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                  type="color"
                                  value={col.bg}
                                  onChange={(e) =>
                                    setActivityColors({
                                      ...activityColors,
                                      [item.key]: { ...col, bg: e.target.value },
                                    })
                                  }
                                  style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                                />
                                <input
                                  type="text"
                                  value={col.bg}
                                  onChange={(e) =>
                                    setActivityColors({
                                      ...activityColors,
                                      [item.key]: { ...col, bg: e.target.value },
                                    })
                                  }
                                  style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                                />
                              </div>
                            </div>

                            <div style={{ marginBottom: "10px" }}>
                              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Text Color</div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                  type="color"
                                  value={col.text}
                                  onChange={(e) =>
                                    setActivityColors({
                                      ...activityColors,
                                      [item.key]: { ...col, text: e.target.value },
                                    })
                                  }
                                  style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                                />
                                <input
                                  type="text"
                                  value={col.text}
                                  onChange={(e) =>
                                    setActivityColors({
                                      ...activityColors,
                                      [item.key]: { ...col, text: e.target.value },
                                    })
                                  }
                                  style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                                />
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Border Color</div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                  type="color"
                                  value={col.border}
                                  onChange={(e) =>
                                    setActivityColors({
                                      ...activityColors,
                                      [item.key]: { ...col, border: e.target.value },
                                    })
                                  }
                                  style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                                />
                                <input
                                  type="text"
                                  value={col.border}
                                  onChange={(e) =>
                                    setActivityColors({
                                      ...activityColors,
                                      [item.key]: { ...col, border: e.target.value },
                                    })
                                  }
                                  style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. HK COLOR */}
                {colorSubTab === "hk" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#1e293b" }}>Housekeeping Status Boxes</h3>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button type="button" onClick={handleResetHkColors} className="btn-lg-grey" style={{ padding: "8px 14px", fontSize: "13px" }}>
                          🔄 Reset to Defaults
                        </button>
                        <button type="button" onClick={handleSaveHkColors} className="btn-lg-grey cr-submit-primary" style={{ padding: "8px 16px", fontSize: "13px" }}>
                          💾 Save HK Colors
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                      {[
                        { key: "total", label: "Total Inventory", icon: "📊" },
                        { key: "clean", label: "Clean & Ready", icon: "🟢" },
                        { key: "dirty", label: "Dirty / Needs Cleaning", icon: "🔴" },
                        { key: "outOfOrder", label: "Out of Order", icon: "⚠️" },
                        { key: "occupied", label: "Occupied", icon: "👤" },
                        { key: "vacant", label: "Vacant", icon: "⚪" },
                        { key: "checkoutToday", label: "Check-Out Today", icon: "🚪" },
                      ].map((item) => {
                        const col = hkColors[item.key] || { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" };
                        return (
                          <div key={item.key} className="pms-card" style={{ padding: "18px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "#ffffff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                              <h3 style={{ margin: 0, fontSize: "14px", color: "#0f172a", fontWeight: "800" }}>{item.label}</h3>
                              <div
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  background: col.bg,
                                  color: col.text,
                                  border: `1px solid ${col.border}`,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  fontSize: "12px",
                                  fontWeight: "800",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                                }}
                              >
                                <span>{item.icon} {item.label}</span>
                              </div>
                            </div>

                            <div style={{ marginBottom: "10px" }}>
                              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Background Color</div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                  type="color"
                                  value={col.bg}
                                  onChange={(e) =>
                                    setHkColors({
                                      ...hkColors,
                                      [item.key]: { ...col, bg: e.target.value },
                                    })
                                  }
                                  style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                                />
                                <input
                                  type="text"
                                  value={col.bg}
                                  onChange={(e) =>
                                    setHkColors({
                                      ...hkColors,
                                      [item.key]: { ...col, bg: e.target.value },
                                    })
                                  }
                                  style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                                />
                              </div>
                            </div>

                            <div style={{ marginBottom: "10px" }}>
                              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Text Color</div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                  type="color"
                                  value={col.text}
                                  onChange={(e) =>
                                    setHkColors({
                                      ...hkColors,
                                      [item.key]: { ...col, text: e.target.value },
                                    })
                                  }
                                  style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                                />
                                <input
                                  type="text"
                                  value={col.text}
                                  onChange={(e) =>
                                    setHkColors({
                                      ...hkColors,
                                      [item.key]: { ...col, text: e.target.value },
                                    })
                                  }
                                  style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                                />
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "4px" }}>Border Color</div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                  type="color"
                                  value={col.border}
                                  onChange={(e) =>
                                    setHkColors({
                                      ...hkColors,
                                      [item.key]: { ...col, border: e.target.value },
                                    })
                                  }
                                  style={{ width: "36px", height: "34px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }}
                                />
                                <input
                                  type="text"
                                  value={col.border}
                                  onChange={(e) =>
                                    setHkColors({
                                      ...hkColors,
                                      [item.key]: { ...col, border: e.target.value },
                                    })
                                  }
                                  style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: "700", fontSize: "12.5px" }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 1.11 TRANSACTION CATEGORIES MANAGEMENT TAB */}
            {propertySubTab === "categories" && (
                  <div className="config-section">
                    <div className="manage-room-type-header" style={{ marginBottom: "20px" }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>
                          🏷️ Financial &amp; Transaction Categories
                        </h2>
                        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                          Configure custom categories for your hotel's daily sales, expenses, and journal entries. All categories configured here will appear in your transaction modals and dashboard breakdown.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                      
                      {/* SALES CATEGORIES MANAGEMENT */}
                      <div style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>📈</span> Sales &amp; Income Categories
                          </h3>
                          <span style={{ fontSize: "12px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "4px 10px", borderRadius: "999px", fontWeight: "700" }}>
                            {txCategories.sale.length} Categories Active
                          </span>
                        </div>

                        <form onSubmit={handleAddSaleCategorySubmit} style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                          <input
                            type="text"
                            placeholder="Type new sale category name..."
                            value={newSaleCatName}
                            onChange={(e) => setNewSaleCatName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSaleCategorySubmit(e); } }}
                            style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13.5px", fontWeight: "600" }}
                          />
                          <button
                            type="button"
                            onClick={handleAddSaleCategorySubmit}
                            className="btn-lg-grey cr-submit-primary"
                            style={{ padding: "10px 16px", whiteSpace: "nowrap" }}
                          >
                            + Add Category
                          </button>
                        </form>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "360px", overflowY: "auto" }}>
                          {txCategories.sale.map((catName) => (
                            <div
                              key={catName}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "10px 14px",
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: "10px"
                              }}
                            >
                              <span style={{ fontSize: "13.5px", fontWeight: "700", color: "#1e293b" }}>{catName}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteSaleCategory(catName)}
                                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                                title="Delete Category"
                              >
                                ✕ Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* EXPENSE CATEGORIES MANAGEMENT */}
                      <div style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>📉</span> Expense Categories
                          </h3>
                          <span style={{ fontSize: "12px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", padding: "4px 10px", borderRadius: "999px", fontWeight: "700" }}>
                            {txCategories.expense.length} Categories Active
                          </span>
                        </div>

                        <form onSubmit={handleAddExpenseCategorySubmit} style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                          <input
                            type="text"
                            placeholder="Type new expense category name..."
                            value={newExpCatName}
                            onChange={(e) => setNewExpCatName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddExpenseCategorySubmit(e); } }}
                            style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13.5px", fontWeight: "600" }}
                          />
                          <button
                            type="button"
                            onClick={handleAddExpenseCategorySubmit}
                            className="btn-lg-grey cr-submit-primary"
                            style={{ padding: "10px 16px", whiteSpace: "nowrap" }}
                          >
                            + Add Category
                          </button>
                        </form>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "360px", overflowY: "auto" }}>
                          {txCategories.expense.map((catName) => (
                            <div
                              key={catName}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "10px 14px",
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: "10px"
                              }}
                            >
                              <span style={{ fontSize: "13.5px", fontWeight: "700", color: "#1e293b" }}>{catName}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteExpenseCategory(catName)}
                                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                                title="Delete Category"
                              >
                                ✕ Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            )}

        {/* 2. POLICIES SECTION */}
        {activeSection === "policies" && (
          <div className="config-tab-workspace">
            {/* 2.1 CANCELLATION POLICIES */}

            {/* 2.1 CANCELLATION POLICIES */}
            {policySubTab === "cancellation" && (
              <div className="config-section">
                <div className="manage-room-type-header">
                  <div>
                    <h2>Manage Cancellation Policies</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-lg-grey"
                    onClick={() => {
                      setEditingCancelPolicy(null);
                      setCancelForm({
                        name: "",
                        noticeHours: "24",
                        refundType: "full_refund",
                        description: "",
                        isDefault: cancellationPolicies.length === 0,
                      });
                      setShowCancelDrawer(true);
                    }}
                  >
                    + Add Cancellation Policy
                  </button>
                </div>

                <div className="manage-room-type-layout">
                  <div className="config-table-container">
                    {cancellationPolicies.length === 0 ? (
                      <div style={{ padding: "48px 20px", textAlign: "center", background: "#f8fafc", borderRadius: 0, border: "2px dashed #cbd5e1" }}>
                        <div style={{ fontSize: "40px", marginBottom: "8px" }}>📜</div>
                        <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>No Cancellation Policies Configured Yet</h3>
                        <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 16px" }}>Click <strong>&quot;+ Add Cancellation Policy&quot;</strong> above to create refund penalty rules (e.g. 24 Hours Free Cancellation, Non-Refundable).</p>
                      </div>
                    ) : (
                      <table className="config-cancellation-table">
                        <thead>
                          <tr>
                            <th>POLICY NAME</th>
                            <th>FREE CANCELLATION DEADLINE</th>
                            <th>PENALTY IF CANCELLED AFTER DEADLINE</th>
                            <th style={{ textAlign: "center" }}>DEFAULT</th>
                            <th style={{ textAlign: "right" }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cancellationPolicies.map((p) => (
                            <tr key={p.id}>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <strong style={{ fontSize: "14px", color: "#0f172a" }}>{p.name}</strong>
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <span className="badge-status info" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 700 }}>
                                  ⏳ {p.noticeHours > 0 ? `${p.noticeHours} Hours prior (100% Free)` : "Non-Refundable"}
                                </span>
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <strong style={{
                                  fontSize: "13.5px",
                                  color: p.refundType === "free_cancellation" ? "#059669" : p.refundType === "half_refund" ? "#d97706" : "#dc2626"
                                }}>
                                  {p.refundType === "one_night" && "1 Night Room & Tax Penalty"}
                                  {p.refundType === "no_refund" && "100% Full Charge (Non-Refundable)"}
                                  {p.refundType === "half_refund" && "50% Partial Charge Penalty"}
                                  {p.refundType === "free_cancellation" && "No Penalty (Free)"}
                                  {p.refundType === "full_refund" && "1 Night Room & Tax Penalty"}
                                </strong>
                              </td>
                              <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                                {p.isDefault ? (
                                  <span className="badge-status active" style={{ background: "#dcfce7", color: "#15803d" }}>⭐ Default</span>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Optional</span>
                                )}
                              </td>
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                <button
                                  type="button"
                                  className="tbl-action-btn"
                                  onClick={() => {
                                    setEditingCancelPolicy(p);
                                    setCancelForm({
                                      name: p.name,
                                      noticeHours: String(p.noticeHours || 24),
                                      refundType: p.refundType || "one_night",
                                      description: p.description || "",
                                      isDefault: Boolean(p.isDefault),
                                    });
                                    setShowCancelDrawer(true);
                                  }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  className="tbl-action-btn delete"
                                  onClick={() => handleDeleteCancelPolicy(p.id)}
                                >
                                  🗑️ Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {showCancelDrawer && (
                    <div className="config-modal-overlay">
                      <div className="room-type-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                          <h3>{editingCancelPolicy ? "Edit Cancellation Policy" : "Add Cancellation Policy"}</h3>
                          <button type="button" className="drawer-close-btn" onClick={() => setShowCancelDrawer(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSaveCancelPolicySubmit} className="drawer-form">
                          <div className="drawer-input-box">
                            <label>Policy Name*</label>
                            <input
                              type="text"
                              value={cancelForm.name}
                              onChange={(e) => setCancelForm({ ...cancelForm, name: e.target.value })}
                              placeholder="e.g. 24 Hours Policy"
                              required
                            />
                          </div>

                          <div className="drawer-input-box">
                            <label>Free Cancellation Deadline (Hours prior to Check-in)*</label>
                            <input
                              type="number"
                              min="0"
                              value={cancelForm.noticeHours}
                              onChange={(e) => {
                                const newHours = e.target.value;
                                setCancelForm((prev) => {
                                  const hoursNum = Number(newHours || 0);
                                  let autoDesc = "";
                                  if (hoursNum <= 0 || prev.refundType === "no_refund") {
                                    autoDesc = "Non-Refundable: 100% total booking amount charged at time of reservation and non-refundable upon cancellation.";
                                  } else {
                                    let pen = "1 Night Room & Tax penalty";
                                    if (prev.refundType === "half_refund") pen = "50% stay penalty";
                                    if (prev.refundType === "free_cancellation") pen = "no penalty";
                                    autoDesc = `Cancellations made ${hoursNum}+ hours prior to check-in receive a 100% Full Refund. Cancellations made within ${hoursNum} hours of check-in or No-Shows incur a ${pen}.`;
                                  }
                                  return { ...prev, noticeHours: newHours, description: autoDesc };
                                });
                              }}
                              placeholder="24"
                              required
                            />
                            <span className="sub-hint" style={{ color: "#059669", fontWeight: 600 }}>🟢 Cancelling MORE than this many hours prior to check-in receives a 100% Full Refund.</span>
                          </div>

                          <div className="drawer-input-box">
                            <label>Penalty If Cancelled AFTER Deadline (or No-Show)*</label>
                            <select
                              value={cancelForm.refundType}
                              onChange={(e) => {
                                const newType = e.target.value;
                                setCancelForm((prev) => {
                                  const hoursNum = Number(prev.noticeHours || 0);
                                  let autoDesc = "";
                                  if (hoursNum <= 0 || newType === "no_refund") {
                                    autoDesc = "Non-Refundable: 100% total booking amount charged at time of reservation and non-refundable upon cancellation.";
                                  } else {
                                    let pen = "1 Night Room & Tax penalty";
                                    if (newType === "half_refund") pen = "50% stay penalty";
                                    if (newType === "free_cancellation") pen = "no penalty";
                                    autoDesc = `Cancellations made ${hoursNum}+ hours prior to check-in receive a 100% Full Refund. Cancellations made within ${hoursNum} hours of check-in or No-Shows incur a ${pen}.`;
                                  }
                                  return { ...prev, refundType: newType, description: autoDesc };
                                });
                              }}
                            >
                              <option value="one_night">1 Night Room &amp; Tax Penalty (Hospitality Standard)</option>
                              <option value="no_refund">100% Full Charge (Non-Refundable)</option>
                              <option value="half_refund">50% Partial Charge Penalty</option>
                              <option value="free_cancellation">No Penalty (Free Cancellation)</option>
                            </select>
                            <span className="sub-hint" style={{ color: "#dc2626", fontWeight: 600 }}>🔴 Penalty charged if guest cancels WITHIN deadline or fails to show up.</span>
                          </div>

                          <div className="drawer-input-box">
                            <label>Policy Description &amp; Terms Note</label>
                            <textarea
                              rows={3}
                              style={{
                                width: "100%",
                                border: "1.5px solid #cbd5e1",
                                borderRadius: "0px",
                                padding: "10px 12px",
                                fontSize: "13.5px",
                                fontFamily: "inherit",
                                color: "#0f172a",
                                background: "#ffffff",
                                outline: "none",
                                resize: "vertical",
                                boxSizing: "border-box"
                              }}
                              value={cancelForm.description}
                              onChange={(e) => setCancelForm({ ...cancelForm, description: e.target.value })}
                              placeholder="e.g. Cancellations made 24+ hours prior to check-in receive a 100% Full Refund. Cancellations within 24 hours incur a 1 Night Room & Tax penalty."
                            />
                          </div>

                          <div className="drawer-input-box" style={{ marginTop: "10px" }}>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", fontWeight: "700", color: "#0f172a", userSelect: "none" }}>
                              <input
                                type="checkbox"
                                style={{ width: "18px", height: "18px", accentColor: "#0f172a", cursor: "pointer" }}
                                checked={Boolean(cancelForm.isDefault)}
                                onChange={(e) => setCancelForm({ ...cancelForm, isDefault: e.target.checked })}
                              />
                              <span>Set as Default Cancellation Policy</span>
                            </label>
                          </div>

                          <div className="drawer-actions">
                            <button type="submit" className="btn-lg-grey cr-submit-primary" style={{ width: "100%" }}>
                              Save Cancellation Policy
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2.2 TERMS & CONDITIONS / HOTEL POLICY */}
            {policySubTab === "terms" && (
              <div className="config-section">
                <div className="manage-room-type-header">
                  <div>
                    <h2>Hotel Policy &amp; Terms and Conditions</h2>
                  </div>
                </div>

                <form onSubmit={handleSaveTermsSubmit} style={{ background: "#ffffff", padding: "24px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "800", color: "#0f172a", marginBottom: "8px" }}>
                      📝 Hotel Rules, Terms &amp; Guest Declaration
                    </label>
                    <textarea
                      rows={8}
                      className="config-input-field"
                      style={{ width: "100%", padding: "14px", fontSize: "13.5px", lineHeight: "1.6", fontFamily: "inherit", borderRadius: 8, border: "1.5px solid #cbd5e1" }}
                      value={hotelTermsText}
                      onChange={(e) => setHotelTermsText(e.target.value)}
                      placeholder="Write your property house rules and terms here. For example:
1. Valid government-issued photo ID is required upon check-in for all guests.
2. Standard check-out time is 11:00 AM. Late check-out is subject to availability and charges.
3. Smoking is strictly prohibited inside guest rooms. Violation fee is $250.
4. Safe deposit boxes are available at the front desk. Management is not responsible for lost items."
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                    <button type="submit" className="btn-lg-grey cr-submit-primary" style={{ padding: "10px 24px" }}>
                      💾 Save Hotel Policy &amp; Terms
                    </button>
                  </div>
                </form>

                {/* LIVE PREVIEW BOX */}
                {hotelTermsText && (
                  <div style={{ marginTop: 24, background: "#f8fafc", padding: 20, borderRadius: 12, border: "1.5px dashed #cbd5e1" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      📄 Print Document Footer Preview (Receipt / Invoice / Folio / GRC)
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, whiteSpace: "pre-wrap", background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <strong>HOTEL POLICY &amp; TERMS AND CONDITIONS:</strong>{"\n"}
                      {hotelTermsText}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. NOTIFICATIONS & EMAIL SETUP WORKSPACE */}
        {activeSection === "notifications" && (
          <div className="config-tab-workspace" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* EMAIL SERVER & GATEWAY SETTINGS CARD (COMMON) */}
            <div style={{ background: "#ffffff", borderRadius: 14, border: "1.5px solid #cbd5e1", padding: "20px 24px", boxShadow: "0 1px 3px rgba(15,23,42,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16, borderBottom: "1.5px solid #f1f5f9", paddingBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>⚙️</span> Email Server Gateway (SMTP / AWS SES / APIs)
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
                    Configure the outbound email server identity for sending guest confirmations, folio receipts, and staff alerts.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testEmailSending}
                    style={{
                      height: 36,
                      padding: "0 14px",
                      borderRadius: 8,
                      border: "1.5px solid #cbd5e1",
                      background: "#f1f5f9",
                      color: "#0f172a",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: testEmailSending ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <span>{testEmailSending ? "⏳ Sending..." : "📧 Send Test Email"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEmailConfig}
                    style={{
                      height: 36,
                      padding: "0 16px",
                      borderRadius: 8,
                      border: "1.5px solid #0f172a",
                      background: "#0f172a",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    Save Email Server Setup
                  </button>
                </div>
              </div>

              {testEmailStatus && (
                <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", fontSize: 12.5, fontWeight: 700 }}>
                  {testEmailStatus.text}
                </div>
              )}

              {/* MODE SELECTOR */}
              <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", background: "#f8fafc", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#0f172a", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="sendingMode"
                    value="builtin"
                    checked={(emailConfig.sendingMode || "builtin") === "builtin"}
                    onChange={() => setEmailConfig({ ...emailConfig, sendingMode: "builtin" })}
                    style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                  />
                  <span>⚡ Built-in PMS Cloud Gateway (Recommended - Zero Setup Required)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#475569", cursor: "pointer", marginLeft: 16 }}>
                  <input
                    type="radio"
                    name="sendingMode"
                    value="custom_smtp"
                    checked={(emailConfig.sendingMode || "builtin") === "custom_smtp"}
                    onChange={() => setEmailConfig({ ...emailConfig, sendingMode: "custom_smtp" })}
                    style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                  />
                  <span>🛠️ Custom SMTP / Dedicated Email Server (Advanced)</span>
                </label>
              </div>

              {(emailConfig.sendingMode || "builtin") === "builtin" && (
                <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "#f1f5f9", border: "1.5px solid #cbd5e1", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>☁️</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>Built-In Cloud Email Service Active (AWS SES)</div>
                    <div style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
                      Outbound emails send automatically using our central cloud gateway. Simply configure your hotel sender identity below!
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <div className="form-group">
                  <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>SENDER / FROM NAME</label>
                  <input
                    type="text"
                    value={emailConfig.fromName || ""}
                    onChange={(e) => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
                    placeholder="e.g. Best Value Inn"
                    style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>FROM EMAIL ADDRESS</label>
                  <input
                    type="email"
                    value={emailConfig.fromEmail || ""}
                    onChange={(e) => setEmailConfig({ ...emailConfig, fromEmail: e.target.value })}
                    placeholder="e.g. reservations@bestvalueinn.com"
                    style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>REPLY-TO EMAIL ADDRESS</label>
                  <input
                    type="email"
                    value={emailConfig.replyTo || ""}
                    onChange={(e) => setEmailConfig({ ...emailConfig, replyTo: e.target.value })}
                    placeholder="e.g. frontdesk@bestvalueinn.com"
                    style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                  />
                </div>

                {(emailConfig.sendingMode || "builtin") === "custom_smtp" && (
                  <>
                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>EMAIL PROVIDER / GATEWAY</label>
                      <select
                        value={emailConfig.provider || "Standard SMTP Gateway"}
                        onChange={(e) => setEmailConfig({ ...emailConfig, provider: e.target.value })}
                        style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a", background: "#ffffff" }}
                      >
                        <option value="Standard SMTP Gateway">📧 Standard SMTP Server</option>
                        <option value="AWS SES (Amazon Simple Email Service)">☁️ AWS SES (Amazon Simple Email Service)</option>
                        <option value="SendGrid API">⚡ SendGrid API</option>
                        <option value="Mailgun API">📨 Mailgun API</option>
                        <option value="Custom SMTP">🛠️ Custom SMTP Service</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>SMTP HOST / ENDPOINT</label>
                      <input
                        type="text"
                        value={emailConfig.smtpHost || ""}
                        onChange={(e) => setEmailConfig({ ...emailConfig, smtpHost: e.target.value })}
                        placeholder="e.g. smtp.mailgun.org or email-smtp.us-east-1.amazonaws.com"
                        style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>SMTP PORT</label>
                      <input
                        type="text"
                        value={emailConfig.smtpPort || "587"}
                        onChange={(e) => setEmailConfig({ ...emailConfig, smtpPort: e.target.value })}
                        placeholder="587 / 465 / 25"
                        style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>SECURITY ENCRYPTION</label>
                      <select
                        value={emailConfig.security || "TLS"}
                        onChange={(e) => setEmailConfig({ ...emailConfig, security: e.target.value })}
                        style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a", background: "#ffffff" }}
                      >
                        <option value="TLS">🔒 TLS / STARTTLS (Port 587)</option>
                        <option value="SSL">🛡️ SSL (Port 465)</option>
                        <option value="None">🔓 Unencrypted (Port 25)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>SMTP USER / ACCESS KEY ID</label>
                      <input
                        type="text"
                        value={emailConfig.smtpUser || ""}
                        onChange={(e) => setEmailConfig({ ...emailConfig, smtpUser: e.target.value })}
                        placeholder="e.g. postmaster@bestvalueinn.com"
                        style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>SMTP PASSWORD / SECRET KEY</label>
                      <input
                        type="password"
                        value={emailConfig.smtpPass || ""}
                        onChange={(e) => setEmailConfig({ ...emailConfig, smtpPass: e.target.value })}
                        placeholder="••••••••••••"
                        style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* SUBTAB 1: GUEST NOTIFICATIONS */}
            {notificationSubTab === "guest" && (
              <form onSubmit={handleSaveGuestNotifications} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                      🛎️ Automated Guest Email Templates &amp; Triggers
                    </h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
                      Manage automated email confirmations, pre-arrival notices, checkout receipts, and cancellation templates sent directly to guests.
                    </p>
                  </div>
                  <button
                    type="submit"
                    style={{
                      height: 38,
                      padding: "0 20px",
                      borderRadius: 8,
                      border: "1.5px solid #0f172a",
                      background: "#0f172a",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    💾 Save All Guest Email Templates
                  </button>
                </div>

                {/* 1. BOOKING CONFIRMATION EMAIL */}
                <div style={{ background: "#ffffff", borderRadius: 12, border: "1.5px solid #cbd5e1", padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>📩 1. Booking Confirmation Email</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "#0f172a", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(guestNotifications.confirmation?.enabled)}
                          onChange={(e) => setGuestNotifications({
                            ...guestNotifications,
                            confirmation: { ...guestNotifications.confirmation, enabled: e.target.checked }
                          })}
                          style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                        />
                        Enable Confirmation Email
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "#0f172a", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(guestNotifications.confirmation?.attachVoucher)}
                          onChange={(e) => setGuestNotifications({
                            ...guestNotifications,
                            confirmation: { ...guestNotifications.confirmation, attachVoucher: e.target.checked }
                          })}
                          style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                        />
                        Attach PDF Voucher
                      </label>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>EMAIL SUBJECT LINE</label>
                      <input
                        type="text"
                        value={guestNotifications.confirmation?.subject || ""}
                        onChange={(e) => setGuestNotifications({
                          ...guestNotifications,
                          confirmation: { ...guestNotifications.confirmation, subject: e.target.value }
                        })}
                        style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>EMAIL TEMPLATE BODY</label>
                      <textarea
                        rows={6}
                        value={guestNotifications.confirmation?.body || ""}
                        onChange={(e) => setGuestNotifications({
                          ...guestNotifications,
                          confirmation: { ...guestNotifications.confirmation, body: e.target.value }
                        })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, color: "#0f172a", lineHeight: 1.5 }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>INSERT DYNAMIC TAGS: </span>
                      {["{GuestName}", "{BookingID}", "{CheckInDate}", "{CheckOutDate}", "{RoomType}", "{TotalAmount}", "{HotelPhone}", "{HotelAddress}"].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => insertGuestTag("confirmation", tag)}
                          style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "2px 8px", margin: "2px 4px", cursor: "pointer" }}
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. PRE-ARRIVAL REMINDER EMAIL */}
                <div style={{ background: "#ffffff", borderRadius: 12, border: "1.5px solid #cbd5e1", padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>🧳 2. Pre-Arrival Reminder Email</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                        SEND
                        <select
                          value={guestNotifications.preArrival?.leadDays || 2}
                          onChange={(e) => setGuestNotifications({
                            ...guestNotifications,
                            preArrival: { ...guestNotifications.preArrival, leadDays: Number(e.target.value) }
                          })}
                          style={{ height: 28, padding: "0 6px", borderRadius: 6, border: "1.5px solid #cbd5e1", fontSize: 12, fontWeight: 800, background: "#ffffff" }}
                        >
                          <option value={1}>1 Day Before Arrival</option>
                          <option value={2}>2 Days Before Arrival</option>
                          <option value={3}>3 Days Before Arrival</option>
                          <option value={7}>7 Days Before Arrival</option>
                        </select>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "#0f172a", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(guestNotifications.preArrival?.enabled)}
                          onChange={(e) => setGuestNotifications({
                            ...guestNotifications,
                            preArrival: { ...guestNotifications.preArrival, enabled: e.target.checked }
                          })}
                          style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                        />
                        Enable Pre-Arrival Email
                      </label>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>EMAIL SUBJECT LINE</label>
                      <input
                        type="text"
                        value={guestNotifications.preArrival?.subject || ""}
                        onChange={(e) => setGuestNotifications({
                          ...guestNotifications,
                          preArrival: { ...guestNotifications.preArrival, subject: e.target.value }
                        })}
                        style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>EMAIL TEMPLATE BODY</label>
                      <textarea
                        rows={5}
                        value={guestNotifications.preArrival?.body || ""}
                        onChange={(e) => setGuestNotifications({
                          ...guestNotifications,
                          preArrival: { ...guestNotifications.preArrival, body: e.target.value }
                        })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, color: "#0f172a", lineHeight: 1.5 }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. CHECK-OUT & FOLIO RECEIPT EMAIL */}
                <div style={{ background: "#ffffff", borderRadius: 12, border: "1.5px solid #cbd5e1", padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>🧾 3. Check-Out &amp; Folio Receipt Email</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "#0f172a", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(guestNotifications.checkOut?.enabled)}
                          onChange={(e) => setGuestNotifications({
                            ...guestNotifications,
                            checkOut: { ...guestNotifications.checkOut, enabled: e.target.checked }
                          })}
                          style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                        />
                        Enable Check-Out Email
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "#0f172a", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(guestNotifications.checkOut?.attachFolio)}
                          onChange={(e) => setGuestNotifications({
                            ...guestNotifications,
                            checkOut: { ...guestNotifications.checkOut, attachFolio: e.target.checked }
                          })}
                          style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                        />
                        Attach Final Folio PDF Invoice
                      </label>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>EMAIL SUBJECT LINE</label>
                      <input
                        type="text"
                        value={guestNotifications.checkOut?.subject || ""}
                        onChange={(e) => setGuestNotifications({
                          ...guestNotifications,
                          checkOut: { ...guestNotifications.checkOut, subject: e.target.value }
                        })}
                        style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>EMAIL TEMPLATE BODY</label>
                      <textarea
                        rows={5}
                        value={guestNotifications.checkOut?.body || ""}
                        onChange={(e) => setGuestNotifications({
                          ...guestNotifications,
                          checkOut: { ...guestNotifications.checkOut, body: e.target.value }
                        })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, color: "#0f172a", lineHeight: 1.5 }}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. CANCELLATION NOTICE EMAIL */}
                <div style={{ background: "#ffffff", borderRadius: 12, border: "1.5px solid #cbd5e1", padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>❌ 4. Reservation Cancellation Notice Email</span>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "#0f172a", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(guestNotifications.cancellation?.enabled)}
                        onChange={(e) => setGuestNotifications({
                          ...guestNotifications,
                          cancellation: { ...guestNotifications.cancellation, enabled: e.target.checked }
                        })}
                        style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                      />
                      Enable Cancellation Email
                    </label>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>EMAIL SUBJECT LINE</label>
                      <input
                        type="text"
                        value={guestNotifications.cancellation?.subject || ""}
                        onChange={(e) => setGuestNotifications({
                          ...guestNotifications,
                          cancellation: { ...guestNotifications.cancellation, subject: e.target.value }
                        })}
                        style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>EMAIL TEMPLATE BODY</label>
                      <textarea
                        rows={5}
                        value={guestNotifications.cancellation?.body || ""}
                        onChange={(e) => setGuestNotifications({
                          ...guestNotifications,
                          cancellation: { ...guestNotifications.cancellation, body: e.target.value }
                        })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, color: "#0f172a", lineHeight: 1.5 }}
                      />
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* SUBTAB 2: HOTELIER NOTIFICATIONS */}
            {notificationSubTab === "hotelier" && (
              <form onSubmit={handleSaveHotelierNotifications} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                      🏢 Hotel Staff &amp; Management Internal Alerts
                    </h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
                      Set up staff recipient emails, instant booking/cancellation notifications, daily night audit automated email reports, and low inventory warnings.
                    </p>
                  </div>
                  <button
                    type="submit"
                    style={{
                      height: 38,
                      padding: "0 20px",
                      borderRadius: 8,
                      border: "1.5px solid #0f172a",
                      background: "#0f172a",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    💾 Save Hotelier Alert Settings
                  </button>
                </div>

                {/* STAFF RECIPIENT EMAILS CARD */}
                <div style={{ background: "#ffffff", borderRadius: 12, border: "1.5px solid #cbd5e1", padding: 20 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>👥 Staff Notification Recipient List</span>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>STAFF EMAIL ADDRESSES (COMMA SEPARATED)</label>
                    <input
                      type="text"
                      value={hotelierNotifications.staffEmails || ""}
                      onChange={(e) => setHotelierNotifications({ ...hotelierNotifications, staffEmails: e.target.value })}
                      placeholder="frontdesk@bestvalueinn.com, manager@bestvalueinn.com"
                      style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                    />
                    <p style={{ margin: "4px 0 0 0", fontSize: 11.5, color: "#64748b" }}>All enabled hotelier alerts will be dispatched to this list of email addresses.</p>
                  </div>
                </div>

                {/* INSTANT ALERTS CARD */}
                <div style={{ background: "#ffffff", borderRadius: 12, border: "1.5px solid #cbd5e1", padding: 20 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🔔 Instant Real-Time Activity Alerts</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#0f172a", cursor: "pointer", background: "#f8fafc", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(hotelierNotifications.alertNewDirectBooking)}
                        onChange={(e) => setHotelierNotifications({ ...hotelierNotifications, alertNewDirectBooking: e.target.checked })}
                        style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                      />
                      <span>Alert on New Direct / Walk-In Booking</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#0f172a", cursor: "pointer", background: "#f8fafc", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(hotelierNotifications.alertNewOtaBooking)}
                        onChange={(e) => setHotelierNotifications({ ...hotelierNotifications, alertNewOtaBooking: e.target.checked })}
                        style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                      />
                      <span>Alert on OTA Channel Booking</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#0f172a", cursor: "pointer", background: "#f8fafc", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(hotelierNotifications.alertCancellation)}
                        onChange={(e) => setHotelierNotifications({ ...hotelierNotifications, alertCancellation: e.target.checked })}
                        style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                      />
                      <span>Alert on Booking Cancellation</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#0f172a", cursor: "pointer", background: "#f8fafc", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(hotelierNotifications.alertNoShow)}
                        onChange={(e) => setHotelierNotifications({ ...hotelierNotifications, alertNoShow: e.target.checked })}
                        style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                      />
                      <span>Alert on Guest No-Show</span>
                    </label>
                  </div>
                </div>

                {/* AUTOMATED DAILY NIGHT AUDIT SUMMARY & LOW INVENTORY CARDS */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                  <div style={{ background: "#ffffff", borderRadius: 12, border: "1.5px solid #cbd5e1", padding: 20 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>🌙 Automated Daily Night Audit Email</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#0f172a", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(hotelierNotifications.dailyNightAuditReport?.enabled)}
                          onChange={(e) => setHotelierNotifications({
                            ...hotelierNotifications,
                            dailyNightAuditReport: { ...hotelierNotifications.dailyNightAuditReport, enabled: e.target.checked }
                          })}
                          style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                        />
                        Enable Daily Night Audit Summary Email
                      </label>
                      <div className="form-group">
                        <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>SCHEDULED DISPATCH TIME</label>
                        <input
                          type="time"
                          value={hotelierNotifications.dailyNightAuditReport?.sendTime || "06:00"}
                          onChange={(e) => setHotelierNotifications({
                            ...hotelierNotifications,
                            dailyNightAuditReport: { ...hotelierNotifications.dailyNightAuditReport, sendTime: e.target.value }
                          })}
                          style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "#ffffff", borderRadius: 12, border: "1.5px solid #cbd5e1", padding: 20 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>⚠️ Low Inventory Warning Threshold</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#0f172a", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(hotelierNotifications.lowInventoryAlert?.enabled)}
                          onChange={(e) => setHotelierNotifications({
                            ...hotelierNotifications,
                            lowInventoryAlert: { ...hotelierNotifications.lowInventoryAlert, enabled: e.target.checked }
                          })}
                          style={{ accentColor: "#0f172a", width: 16, height: 16 }}
                        />
                        Enable Low Inventory Alert
                      </label>
                      <div className="form-group">
                        <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>ROOM AVAILABILITY THRESHOLD</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={hotelierNotifications.lowInventoryAlert?.threshold || 2}
                          onChange={(e) => setHotelierNotifications({
                            ...hotelierNotifications,
                            lowInventoryAlert: { ...hotelierNotifications.lowInventoryAlert, threshold: Number(e.target.value) }
                          })}
                          style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                        />
                        <p style={{ margin: "4px 0 0 0", fontSize: 11.5, color: "#64748b" }}>Alert staff when unassigned available rooms for any category falls to or below this number.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            )}

          </div>
        )}

        {/* 4. DATA IMPORT / EXPORT & SYSTEM RESET WORKSPACE */}
        {activeSection === "data_import" && (
          <div className="config-tab-workspace">
            <DataImportWizard />

            <div className="card glassmorphism" style={{ marginTop: "32px", padding: "24px", borderRadius: "12px", border: "1.5px solid #fecaca", background: "#fff5f5" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <h3 style={{ margin: 0, color: "#dc2626", fontSize: "18px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>🧹</span> Reset System to Clean Slate
                  </h3>
                  <p style={{ margin: "6px 0 0 0", color: "#7f1d1d", fontSize: "13px" }}>
                    Wipe all local setup, room configurations, bookings, and restore the application to a 100% unconfigured clean slate.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    if (window.confirm("Are you sure you want to reset all data and configuration to a 100% clean slate? This action cannot be undone.")) {
                      try {
                        const { resetAllData: resetHotelData } = await import("../services/api");
                        if (typeof resetHotelData === "function") await resetHotelData();
                      } catch (e) {}
                      dataStore.clear();
                      dataStore.setItem("hotelpms_room_types_v3", "[]");
                      dataStore.setItem("hotelpms_room_types_v1", "[]");
                      dataStore.setItem("hotelpms_room_types", "[]");
                      dataStore.setItem("hotelpms_room_numbers_v3", "[]");
                      dataStore.setItem("hotelpms_rooms_list_v1", "[]");
                      dataStore.setItem("hotelpms_room_numbers", "[]");
                      dataStore.setItem("hotelpms_bookings_v1", "[]");
                      dataStore.setItem("hotelpms_rate_plans_v3", "[]");
                      dataStore.setItem("hotelpms_addons_v3", "[]");
                      dataStore.setItem("hotelpms_taxes_v3", "[]");
                      try {
                        // make sure the backend has really wiped the data before the page reloads
                        const { settleBackendSync } = await import("../services/backendSync");
                        await settleBackendSync();
                      } catch (e) {}
                      window.location.reload();
                    }
                  }}
                  style={{
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    padding: "10px 22px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)"
                  }}
                >
                  🧹 Reset System Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. US PAYMENT GATEWAYS WORKSPACE */}
        {activeSection === "payment_gateways" && (
          <div className="config-tab-workspace">
            <PaymentGatewayConfig />
          </div>
        )}
      </main>
    </div>
  );
}
