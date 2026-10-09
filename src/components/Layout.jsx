import { dataStore } from "../services/dataStore";
import { logoutFromBackend } from "../services/backendSync";
import { useState, useEffect, useMemo, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import FolioModal from "./FolioModal";
import NightAuditPromptModal from "./NightAuditPromptModal";
import OverbookingModal from "./OverbookingModal";
import { getBookings, getRooms } from "../services/api";
import { getBusinessDate, setBusinessDate, getNightAuditConfig, getHotelProfile, getUsers, saveUsers, getUserRights, formatMMDDYYYY, logSystemAuditAction } from "../services/hotelConfig";
import { getOverbookedReservations } from "../services/overbookingService";
import "./Layout.css";
import {
  IconSearch,
  IconMenu,
} from "./Icons";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Percent,
  BarChart3,
  Users,
  Users2,
  Sparkles,
  Moon,
  Building2,
  Globe,
  Settings,
  KeyRound,
  LogOut,
  ShoppingBag,
  TrendingDown,
  Receipt,
  ChevronDown,
  Sun
} from "lucide-react";

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
      <span style={{ color: "#0f172a", background: "#e2e8f0", padding: "0 4px", borderRadius: "4px", fontWeight: 900 }}>{match}</span>
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

function isRouteAllowed(pathname, rights) {
  if (!rights) return true;

  // System admin or manager role gets full access across all routes
  if (rights.manageUsers && rights.hotelSettings && rights.frontDesk && rights.reportsAudit && rights.housekeeping) {
    return true;
  }

  if (pathname === "/dashboard") {
    return Boolean(rights.dashboard);
  }

  if (pathname === "/book" || pathname === "/booking-engine") {
    return Boolean(rights.bookingEngine);
  }

  // Calendar
  if (pathname.includes("calendar") || pathname.includes("room-availability")) {
    return Boolean(rights.calendar);
  }

  // Reservations & Activity
  if (pathname.includes("activity") || pathname.includes("walk-in-guest")) {
    return Boolean(rights.reservations);
  }

  // Guest DB Profiles
  if (pathname.includes("guest-database") || pathname.includes("guest-details")) {
    return Boolean(rights.profiles);
  }

  // Rates & Availability
  if (pathname.includes("rate-management")) {
    return Boolean(rights.ratesAvailability);
  }

  // Financial & Master Reports
  if (
    pathname.includes("master-report") ||
    pathname.includes("masterreport") ||
    pathname.includes("rate-inventory-report") ||
    pathname.includes("night-audit-report")
  ) {
    return Boolean(rights.masterReport);
  }

  // Housekeeping
  if (pathname.includes("housekeeping")) {
    return Boolean(rights.housekeeping);
  }

  // Night Audit
  if (pathname.includes("night-audit")) {
    return Boolean(rights.nightAudit);
  }

  // House Accounts
  if (pathname.includes("company-accounts") || pathname.includes("payment")) {
    return Boolean(rights.houseAccounts);
  }

  // Folio Operations & Folio Manager
  if (pathname.includes("folios") || pathname.includes("folio-operations")) {
    return Boolean(rights.houseAccounts || rights.reservations || rights.frontDesk);
  }

  // Misc Operations
  if (pathname.includes("misc") || pathname.includes("expenses") || pathname.includes("sales-pos")) {
    return Boolean(rights.misc);
  }

  // Property Configuration & User Management
  if (
    pathname.includes("configuration") ||
    pathname.includes("channel-manager") ||
    pathname.includes("settings") ||
    pathname.includes("hotel-info") ||
    pathname.includes("room-type") ||
    pathname.includes("rooms") ||
    pathname.includes("tax") ||
    pathname.includes("rate-plans") ||
    pathname.includes("staff")
  ) {
    return Boolean(rights.configuration);
  }

  return true;
}

export function getDefaultAllowedRoute(rights) {
  if (!rights) return "/dashboard";
  if (rights.dashboard) return "/dashboard";
  if (rights.calendar) return "/front-desk/calendar";
  if (rights.reservations) return "/front-desk/activity";
  if (rights.housekeeping) return "/housekeeping";
  if (rights.masterReport) return "/master-report";
  if (rights.houseAccounts) return "/front-desk/company-accounts";
  if (rights.ratesAvailability) return "/rate-management";
  if (rights.configuration) return "/configuration";
  return "/housekeeping";
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [navDropdownOpen, setNavDropdownOpen] = useState(false);
  const [reportingSubMenuOpen, setReportingSubMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [userObj, setUserObj] = useState(() => {
    try {
      return JSON.parse(dataStore.getItem("pms_user") || "{}");
    } catch (e) {
      return {};
    }
  });

  const [allBookings, setAllBookings] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [selectedFolioBooking, setSelectedFolioBooking] = useState(null);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);

  const [theme, setTheme] = useState(() => {
    return dataStore.getItem("pms_theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    dataStore.setItem("pms_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Accordion state for Master Categories in Header Dropdown
  const [openMasterCategories, setOpenMasterCategories] = useState({
    frontDesk: true,
    housekeeping: false,
    reportsFinance: false,
    crm: false,
    setup: false,
  });

  const toggleMasterCategory = (catKey) => {
    setOpenMasterCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  const fetchLatestBookings = () => {
    Promise.all([getBookings(), getRooms()])
      .then(([b, r]) => {
        setAllBookings(b || []);
        setRoomsList(r || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLatestBookings();
    window.addEventListener("pms_bookings_updated", fetchLatestBookings);
    window.addEventListener("pms_rooms_updated", fetchLatestBookings);
    window.addEventListener("storage", fetchLatestBookings);
    return () => {
      window.removeEventListener("pms_bookings_updated", fetchLatestBookings);
      window.removeEventListener("pms_rooms_updated", fetchLatestBookings);
      window.removeEventListener("storage", fetchLatestBookings);
    };
  }, [location.pathname]);

  // Keep open folio modal updated with latest booking state
  useEffect(() => {
    if (selectedFolioBooking && allBookings.length > 0) {
      const updated = allBookings.find((b) => String(b.id) === String(selectedFolioBooking.id));
      if (updated) {
        setSelectedFolioBooking(updated);
      }
    }
  }, [allBookings]);

  const query = searchTerm.trim().toLowerCase();

  const globalSearchResults = useMemo(() => {
    if (!query) return [];
    return allBookings.filter((b) => {
      if (!b || b.isDeleted) return false;
      const st = String(b.status || "").toLowerCase();
      if (st === "deleted" || st === "blocked" || st === "maintenance" || st === "out-of-order" || b.isMaintenance || b.isBlock) return false;

      const guestName = String(b.guest || b.fullName || b.guestName || "").toLowerCase();
      if (guestName.includes("blocked") || guestName.includes("maintenance")) return false;
      const idStr = String(b.id || b.referenceCode || b.resCode || "").toLowerCase();
      const roomStr = String(b.room || b.roomNumber || "").toLowerCase();
      const phoneStr = String(b.phone || "").toLowerCase();
      const emailStr = String(b.email || "").toLowerCase();
      return (
        guestName.includes(query) ||
        idStr.includes(query) ||
        roomStr.includes(query) ||
        phoneStr.includes(query) ||
        emailStr.includes(query) ||
        st.includes(query)
      );
    });
  }, [allBookings, query]);

  const [showOverbookingModal, setShowOverbookingModal] = useState(false);
  const overbookedReservations = useMemo(() => {
    return getOverbookedReservations(allBookings, roomsList);
  }, [allBookings, roomsList]);

  const [businessDate, setBusinessDateState] = useState(() => getBusinessDate());
  const [showBusinessDateModal, setShowBusinessDateModal] = useState(false);
  const [manualBizDateInput, setManualBizDateInput] = useState(() => getBusinessDate());

  const machineDateStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const isAuditPending = useMemo(() => {
    return machineDateStr > businessDate;
  }, [machineDateStr, businessDate]);

  const [hotelProfile, setHotelProfile] = useState(() => getHotelProfile() || {});
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const userDropdownRef = useRef(null);

  useEffect(() => {
    function updateDate() {
      const b = getBusinessDate();
      setBusinessDateState(b);
      setManualBizDateInput(b);
    }
    window.addEventListener("pms_business_date_updated", updateDate);
    return () => window.removeEventListener("pms_business_date_updated", updateDate);
  }, []);

  useEffect(() => {
    function updateProfile() {
      setHotelProfile(getHotelProfile() || {});
    }
    window.addEventListener("pms_hotel_profile_updated", updateProfile);
    window.addEventListener("pms_hotel_info_updated", updateProfile);
    window.addEventListener("pms_rooms_updated", updateProfile);
    window.addEventListener("storage", updateProfile);
    return () => {
      window.removeEventListener("pms_hotel_profile_updated", updateProfile);
      window.removeEventListener("pms_hotel_info_updated", updateProfile);
      window.removeEventListener("pms_rooms_updated", updateProfile);
      window.removeEventListener("storage", updateProfile);
    };
  }, []);

  useEffect(() => {
    function handleDocClick(e) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  useEffect(() => {
    function handleUserUpdate() {
      try {
        setUserObj(JSON.parse(dataStore.getItem("pms_user") || "{}"));
      } catch (e) {}
    }
    window.addEventListener("pms_user_updated", handleUserUpdate);
    window.addEventListener("pms_users_updated", handleUserUpdate);
    window.addEventListener("pms_roles_updated", handleUserUpdate);
    window.addEventListener("storage", handleUserUpdate);
    return () => {
      window.removeEventListener("pms_user_updated", handleUserUpdate);
      window.removeEventListener("pms_users_updated", handleUserUpdate);
      window.removeEventListener("pms_roles_updated", handleUserUpdate);
      window.removeEventListener("storage", handleUserUpdate);
    };
  }, []);

  const currentUser = useMemo(() => {
    const name = userObj?.name || "Reception Staff";
    const role = userObj?.role || "Front Desk Admin";
    const initials = userObj?.initials || (name ? name.slice(0, 2).toUpperCase() : "RS");
    return { name, role, initials, userObj };
  }, [userObj]);

  const userRights = useMemo(() => {
    return getUserRights(userObj);
  }, [userObj]);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out of the Hotel PMS session?")) {
      logSystemAuditAction({
        module: "Security & Auth",
        action: "User Logout",
        details: `User '${currentUser.name}' (${currentUser.role}) logged out from session.`
      });
      // push the last unsaved change to the backend, then forget this hotel completely
      logoutFromBackend().finally(() => {
        window.dispatchEvent(new CustomEvent("pms_user_logged_out"));
        navigate("/login", { replace: true });
        window.location.href = "/login";
      });
    }
  };

  const handleResetPasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPasswordInput) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    try {
      const users = getUsers();
      const userIndex = users.findIndex((u) => u.role === currentUser.role || u.username === "admin" || u.username === "priya_frontdesk");
      if (userIndex !== -1) {
        users[userIndex].password = newPasswordInput;
        saveUsers(users);
      }
      setPasswordSuccess("Password updated successfully!");
      setTimeout(() => {
        setShowResetPasswordModal(false);
        setCurrentPasswordInput("");
        setNewPasswordInput("");
        setConfirmPasswordInput("");
        setPasswordSuccess("");
      }, 1500);
    } catch (err) {
      setPasswordError("Failed to update password. Please try again.");
    }
  };

  return (
    <div className="app-shell full-width">
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">

            <div className="nav-dropdown-wrapper" style={{ position: "relative" }}>
              <button
                type="button"
                className="sidebar-toggle-btn"
                onClick={() => setNavDropdownOpen((v) => !v)}
                aria-label="Module menu"
                title="Click to open Module Switcher Dropdown"
              >
                <IconMenu />
              </button>

              {/* CLEAN MODERN LEFT NAVIGATION MENU MATCHING USER SCREENSHOT 1 */}
              {navDropdownOpen && (
                <>
                  <div className="dropdown-overlay"  />
                  <div className="nav-module-dropdown animate-dropdown">
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      
                      {userRights.dashboard && (
                        <NavLink
                          to="/dashboard"
                          className={({ isActive }) => `sidebar-clean-link ${isActive ? "active" : ""}`}
                          onClick={() => setNavDropdownOpen(false)}
                        >
                          <LayoutDashboard size={18} />
                          <span>Dashboard</span>
                        </NavLink>
                      )}

                      {userRights.calendar && (
                        <NavLink
                          to="/front-desk/calendar"
                          className={({ isActive }) => `sidebar-clean-link ${isActive ? "active" : ""}`}
                          onClick={() => setNavDropdownOpen(false)}
                        >
                          <Calendar size={18} />
                          <span>Calendar</span>
                        </NavLink>
                      )}

                      {userRights.ratesAvailability && (
                        <NavLink
                          to="/rate-management"
                          className={({ isActive }) => `sidebar-clean-link ${isActive ? "active" : ""}`}
                          onClick={() => setNavDropdownOpen(false)}
                        >
                          <Percent size={18} />
                          <span>Rates and Availability</span>
                        </NavLink>
                      )}

                      {/* REPORTS & ANALYTICS DROPDOWN MENU */}
                      {userRights.masterReport && (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <button
                            type="button"
                            className={`sidebar-clean-link ${location.pathname.includes("report") ? "active" : ""}`}
                            onClick={() => {
                              setReportsMenuOpen((prev) => !prev);
                              if (!location.pathname.includes("report")) {
                                navigate("/master-report?tab=master");
                              }
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              paddingRight: "10px"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <BarChart3 size={18} />
                              <span>Reports & Analytics</span>
                            </div>
                            <ChevronDown
                              size={16}
                              style={{
                                transform: reportsMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s ease",
                                color: "#64748b"
                              }}
                            />
                          </button>

                          {reportsMenuOpen && (
                            <div style={{ paddingLeft: "26px", display: "flex", flexDirection: "column", gap: "2px", marginTop: "3px", marginBottom: "4px" }}>
                              {[
                                { id: "master", icon: "💵", name: "Master Financial Report" },
                                { id: "budget", icon: "📈", name: "Annual Budget vs Actual" },
                                { id: "daily_rates", icon: "🏷️", name: "Daily Rate Report" },
                                { id: "yoy", icon: "🏛️", name: "Executive YoY Performance" },
                                { id: "forecast", icon: "📅", name: "Occupancy Forecast" },
                                { id: "channels", icon: "🌐", name: "OTA Channel Production" },
                                { id: "aging", icon: "🏢", name: "City Ledger AR Aging" },
                                { id: "payments", icon: "💳", name: "Payment Gateway Audit" },
                                { id: "system_audit", icon: "🔍", name: "System Audit Log" }
                              ].map((sub) => {
                                const currentTab = new URLSearchParams(location.search).get("tab") || "master";
                                const isSubActive = location.pathname.includes("report") && currentTab === sub.id;
                                return (
                                  <NavLink
                                    key={sub.id}
                                    to={`/master-report?tab=${sub.id}`}
                                    className={`sidebar-clean-link ${isSubActive ? "active" : ""}`}
                                    onClick={() => setNavDropdownOpen(false)}
                                    style={{
                                      fontSize: "12.5px",
                                      padding: "6px 10px",
                                      borderRadius: "6px",
                                      fontWeight: isSubActive ? "700" : "500",
                                      background: isSubActive ? "#e2e8f0" : "transparent",
                                      color: isSubActive ? "#0f172a" : "#475569"
                                    }}
                                  >
                                    <span style={{ fontSize: "13px", marginRight: "6px" }}>{sub.icon}</span>
                                    <span>{sub.name}</span>
                                  </NavLink>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ height: "1px", background: "#f1f5f9", margin: "6px 0" }} />

                      {userRights.profiles && (
                        <NavLink
                          to="/front-desk/guest-database"
                          className={({ isActive }) => `sidebar-clean-link ${isActive ? "active" : ""}`}
                          onClick={() => setNavDropdownOpen(false)}
                        >
                          <Users size={18} />
                          <span>Profiles</span>
                        </NavLink>
                      )}

                      {userRights.groupsEvents && (
                        <button
                          type="button"
                          className="sidebar-clean-link"
                          onClick={() => {
                            setNavDropdownOpen(false);
                            navigate("/front-desk/calendar");
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent("pms_open_group_booking"));
                            }, 150);
                          }}
                        >
                          <Users2 size={18} />
                          <span>Groups and Events</span>
                          <span style={{ fontSize: "10px", fontWeight: "700", background: "#e0e7ff", color: "#3730a3", padding: "2px 6px", borderRadius: "4px", marginLeft: "auto" }}>New</span>
                        </button>
                      )}

                      {userRights.housekeeping && (
                        <NavLink
                          to="/housekeeping"
                          className={({ isActive }) => `sidebar-clean-link ${isActive ? "active" : ""}`}
                          onClick={() => setNavDropdownOpen(false)}
                        >
                          <Sparkles size={18} />
                          <span>Housekeeping</span>
                        </NavLink>
                      )}

                      {userRights.nightAudit && (
                        <NavLink
                          to="/front-desk/night-audit"
                          className={({ isActive }) => `sidebar-clean-link ${isActive ? "active" : ""}`}
                          onClick={() => setNavDropdownOpen(false)}
                        >
                          <Moon size={18} />
                          <span>Night Audit</span>
                        </NavLink>
                      )}

                      {userRights.houseAccounts && (
                        <NavLink
                          to="/front-desk/company-accounts"
                          className={({ isActive }) => `sidebar-clean-link ${isActive ? "active" : ""}`}
                          onClick={() => setNavDropdownOpen(false)}
                        >
                          <Building2 size={18} />
                          <span>House Accounts</span>
                        </NavLink>
                      )}

                      {userRights.misc && (
                        <NavLink
                          to="/misc"
                          className={({ isActive }) => `sidebar-clean-link ${isActive ? "active" : ""}`}
                          onClick={() => setNavDropdownOpen(false)}
                        >
                          <Receipt size={18} />
                          <span>Misc</span>
                        </NavLink>
                      )}

                      {userRights.bookingEngine && (
                        <NavLink
                          to="/book"
                          target="_blank"
                          className="sidebar-clean-link"
                          onClick={() => setNavDropdownOpen(false)}
                        >
                          <Globe size={18} />
                          <span>Direct Booking Engine</span>
                        </NavLink>
                      )}

                      <div style={{ height: "1px", background: "#f1f5f9", margin: "6px 0" }} />

                      {userRights.configuration && (
                        <>
                          <NavLink
                            to="/configuration"
                            className={({ isActive }) => `sidebar-clean-link ${isActive ? "active" : ""}`}
                            onClick={() => setNavDropdownOpen(false)}
                          >
                            <Settings size={18} />
                            <span>Configuration</span>
                          </NavLink>

                          <NavLink
                            to="/channel-manager"
                            className={({ isActive }) => `sidebar-clean-link ${isActive ? "active" : ""}`}
                            onClick={() => setNavDropdownOpen(false)}
                          >
                            <Globe size={18} />
                            <span>Channel Manager</span>
                          </NavLink>
                        </>
                      )}

                      <div style={{ height: "1px", background: "#f1f5f9", margin: "6px 0" }} />

                      <div style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#2563eb", color: "#ffffff", fontWeight: 700, fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {currentUser.initials}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>{currentUser.name}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{currentUser.role}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="sidebar-clean-link"
                        onClick={() => {
                          setNavDropdownOpen(false);
                          setShowResetPasswordModal(true);
                        }}
                      >
                        <KeyRound size={18} />
                        <span>Reset Password</span>
                      </button>

                      <button
                        type="button"
                        className="sidebar-clean-link sidebar-logout-btn"
                        onClick={() => {
                          setNavDropdownOpen(false);
                          handleLogout();
                        }}
                      >
                        <LogOut size={18} />
                        <span>Logout Session</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* PROPERTY NAME BADGE FROM CONFIGURATION/SETUP */}
            <div
              className="property-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                background: "#f8fafc",
                color: "#0f172a",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontWeight: 800,
                fontSize: "13px",
                letterSpacing: "0.2px",
              }}
            >
              <span style={{ fontSize: "14px" }}>🏨</span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "240px" }}>
                {hotelProfile.name || "Unconfigured Property"}
              </span>
            </div>

          </div>

          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* NIGHT VIEW / NORMAL VIEW TOGGLE ICON BUTTON */}
            <button
              type="button"
              className="theme-toggle-icon-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Normal View (Light Mode)" : "Night View (Dark Mode)"}`}
              aria-label="Toggle Night/Day View"
            >
              {theme === "dark" ? (
                <Sun size={20} style={{ color: "#facc15" }} />
              ) : (
                <Moon size={20} style={{ color: "#0284c7" }} />
              )}
            </button>
            {overbookedReservations.length > 0 && (
              <button
                type="button"
                onClick={() => setShowOverbookingModal(true)}
                title={`${overbookedReservations.length} Overbooking(s) Detected - Click to view & resolve`}
                aria-label="Overbooked reservations alert"
                style={{
                  position: "relative",
                  background: "#fee2e2",
                  color: "#dc2626",
                  border: "1.5px solid #fca5a5",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "16px",
                  boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)",
                  padding: 0,
                  transition: "all 0.15s ease",
                }}
              >
                🚨
                <span
                  style={{
                    position: "absolute",
                    top: "-5px",
                    right: "-5px",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: "900",
                    borderRadius: "10px",
                    minWidth: "18px",
                    height: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                    border: "2px solid #ffffff",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  }}
                >
                  {overbookedReservations.length}
                </span>
              </button>
            )}

            <div className="search-box" style={{ position: "relative" }}>
              <IconSearch />
              <input
                type="text"
                className="search-input"
                value={searchTerm}
                onFocus={fetchLatestBookings}
                onChange={(e) => {
                  fetchLatestBookings();
                  setSearchTerm(e.target.value);
                }}
                placeholder="Search reservation, guest, room..."
                aria-label="Search guest or room"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}

              {/* INSTANT GLOBAL SEARCH RESULTS DROPDOWN (WHITE & GREY COMBINATION) */}
              {query.length >= 1 && (
                <div
                  className="global-search-results animate-dropdown"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: "440px",
                    maxHeight: "480px",
                    overflowY: "auto",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    boxShadow: "0 20px 40px rgba(15, 23, 42, 0.15)",
                    zIndex: 99999,
                    padding: "14px",
                    color: "#0f172a",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingBottom: "10px",
                      marginBottom: "12px",
                      borderBottom: "1px solid #e2e8f0",
                      fontSize: "11.5px",
                      fontWeight: 800,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                    }}
                  >
                    <span style={{ color: "#0f172a" }}>🔍 MATCHING RESERVATIONS ({globalSearchResults.length})</span>
                    <span style={{ color: "#64748b", textTransform: "none", fontWeight: 700 }}>Click to open folio</span>
                  </div>

                  {globalSearchResults.length === 0 ? (
                    <div style={{ padding: "20px 8px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                      No matching reservations found for "{searchTerm}"
                    </div>
                  ) : (
                    globalSearchResults.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => {
                          setSelectedFolioBooking(b);
                          setSearchTerm("");
                        }}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          marginBottom: "8px",
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        className="search-result-item"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f8fafc";
                          e.currentTarget.style.borderColor = "#cbd5e1";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#ffffff";
                          e.currentTarget.style.borderColor = "#e2e8f0";
                        }}
                      >
                        {/* FIRST LINE: Guest Name + Room Number */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <div style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>
                            👤 {highlightMatch(b.guest || b.fullName, query)}
                          </div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: "12px",
                              background: "#f1f5f9",
                              color: "#0f172a",
                              border: "1px solid #cbd5e1",
                              padding: "3px 10px",
                              borderRadius: "6px",
                            }}
                          >
                            Room {highlightMatch(b.room, query)}
                          </div>
                        </div>

                        {/* SECOND LINE: Res ID + Room Type */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
                          <span style={{ fontWeight: "800", color: "#475569" }}>ID: {highlightMatch(b.id || b.referenceCode, query)}</span>
                          <span>•</span>
                          <span>{b.roomType || "Standard Room"}</span>
                        </div>

                        {/* THIRD LINE: Status Badge + Tariff */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: getStatusBg(b.status),
                              color: getStatusColor(b.status),
                              textTransform: "uppercase",
                            }}
                          >
                            {b.status || "CONFIRMED"}
                          </span>
                          <span style={{ fontSize: "12px", fontWeight: 800, color: "#334155" }}>
                            ${b.totalAmount || 0} {Number(b.balanceDue || 0) > 0 ? <span style={{ color: "#dc2626" }}>(Due: ${b.balanceDue})</span> : <span style={{ color: "#16a34a" }}>(Paid)</span>}
                          </span>
                        </div>

                        {/* FOURTH LINE: Stay Dates */}
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>
                          📅 {formatDisplayDate(b.checkIn)} - {formatDisplayDate(b.checkOut)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* TIER 2 ACTION SUB-NAVBAR BAR FOR PAGE CONTROLS */}
        <div className="sub-topbar">
          <div id="calendar-navbar-controls" className="sub-navbar-content" />
        </div>

        <div className="page-content">
          {isRouteAllowed(location.pathname, userRights) ? (
            <Outlet context={{ searchTerm, setSearchTerm }} />
          ) : (
            <div style={{ padding: "60px 20px", textAlign: "center", maxWidth: "540px", margin: "40px auto", background: "#ffffff", borderRadius: "16px", border: "1.5px solid #fee2e2", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🔒</div>
              <h2 style={{ fontSize: "20px", fontWeight: "900", color: "#991b1b", margin: "0 0 8px 0" }}>Access Restricted</h2>
              <p style={{ fontSize: "13.5px", color: "#64748b", lineHeight: "1.5", margin: "0 0 20px 0" }}>
                Your user account (<strong>{currentUser.name}</strong> - <em>{currentUser.role}</em>) does not have access rights to open this section. Please contact your property administrator to request access.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(getDefaultAllowedRoute(userRights))}
                style={{ padding: "10px 20px", borderRadius: "10px", fontWeight: "800", background: "#0284c7", color: "#fff", border: "none", cursor: "pointer" }}
              >
                ⬅️ Go to My Accessible Page
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM PMS STATUS & DATE FOOTER BAR */}
        <footer
          className="bottom-status-bar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 20px",
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            fontSize: "12.5px",
            fontWeight: 600,
            color: "#334155",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* BUSINESS WORKING DATE BADGE */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                background: "#f8fafc",
                color: "#0f172a",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => setShowBusinessDateModal(true)}
              title="Active Business Working Date. Click to view Night Audit status."
            >
              <Calendar size={14} style={{ color: "#475569" }} />
              <span>Business Date: <strong>{formatMMDDYYYY(businessDate)}</strong></span>
            </div>

            {/* NIGHT AUDIT STATUS INDICATOR */}
            {isAuditPending ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  background: "#f8fafc",
                  color: "#0f172a",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                onClick={() => navigate("/front-desk/night-audit")}
                title="System machine date is ahead of working business date. Click to open Night Audit."
              >
                <Moon size={14} style={{ color: "#475569" }} />
                <span>⚠️ Night Audit Pending</span>
              </div>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  background: "#f8fafc",
                  color: "#0f172a",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontWeight: 700,
                }}
                title="Business date is current."
              >
                <span>✅ Audit Up To Date</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* REAL MACHINE SYSTEM DATE BADGE */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                background: "#f8fafc",
                color: "#0f172a",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                fontWeight: 600,
              }}
              title="Real-time System Machine Clock Date"
            >
              <span>🖥️ System Machine Date: <strong>{formatMMDDYYYY(machineDateStr)}</strong></span>
            </div>
          </div>
        </footer>
      </div>

      {/* AUTOMATED NIGHT AUDIT ROLLOVER POP-UP PROMPT */}
      <NightAuditPromptModal />

      {/* INSTANT GUEST FOLIO & BILLING OPERATIONS MODAL OPENED FROM SEARCH */}
      {selectedFolioBooking && (
        <FolioModal
          isOpen={Boolean(selectedFolioBooking)}
          onClose={() => setSelectedFolioBooking(null)}
          booking={selectedFolioBooking}
          room={roomsList.find((r) => r.no === selectedFolioBooking?.room)}
          rooms={roomsList}
        />
      )}

      {/* OVERBOOKING RESOLUTION & ALERTS MODAL */}
      <OverbookingModal
        isOpen={showOverbookingModal}
        onClose={() => setShowOverbookingModal(false)}
        overbookedReservations={overbookedReservations}
        roomsList={roomsList}
        onOpenFolio={setSelectedFolioBooking}
        onRefreshBookings={fetchLatestBookings}
      />

      {/* BUSINESS DATE INFO & AUDIT MODAL */}
      {showBusinessDateModal && (
        <div className="modal-overlay"  style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            className="modal-card shadow-2xl"
            style={{ maxWidth: "440px", width: "90%", background: "#ffffff", borderRadius: "12px", overflow: "hidden", border: "1px solid #e2e8f0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Calendar size={20} style={{ color: "#2563eb" }} />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>Business Working Date</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowBusinessDateModal(false)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#64748b", lineHeight: 1 }}>×</button>
            </div>

            <div className="modal-body" style={{ padding: "20px" }}>
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "700" }}>Active Business Working Date</div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>{formatMMDDYYYY(businessDate)}</div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "6px" }}>
                  Last Night Audit Completed: <strong>{getNightAuditConfig()?.lastAuditCompletedDate ? formatMMDDYYYY(getNightAuditConfig().lastAuditCompletedDate) : "Not Recorded"}</strong>
                </div>
              </div>

              <div style={{ fontSize: "13px", color: "#475569", marginBottom: "18px", lineHeight: "1.5" }}>
                The PMS Business Date strictly stays on <strong>{formatMMDDYYYY(businessDate)}</strong> for all room postings, walk-in check-ins, folios, and stats until staff explicitly executes the Night Audit process.
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "11px 16px", fontWeight: "700", width: "100%", borderRadius: "8px", background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontSize: "14px" }}
                onClick={() => {
                  setShowBusinessDateModal(false);
                  navigate("/front-desk/night-audit");
                }}
              >
                <Moon size={16} />
                Open Night Audit Module
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
