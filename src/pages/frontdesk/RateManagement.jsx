import { dataStore } from "../../services/dataStore";
import { useState, useEffect, useMemo } from "react";
import CustomDatePicker from "../../components/CustomDatePicker";
import OtaBadge from "../../components/OtaBadge";
import "./rateManagement.css";
import {
  getRoomTypes,
  getRatePlans,
  getDailyRatesMap,
  saveDailyRate,
  bulkUpdateDailyRates,
  getTaxInclusiveSetting,
  saveTaxInclusiveSetting,
  getActiveTaxPercent,
} from "../../services/hotelConfig";
import {
  getDailyChannelRestrictions,
  saveDailyChannelRestriction,
  bulkSaveDailyChannelRestrictions,
  getEffectiveRestriction,
  DEFAULT_CHANNELS
} from "../../services/channelManager";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const OTA_CHANNELS = [
  { id: "all", label: "All Channels", source: "Direct Web" },
  { id: "booking_com", label: "Booking.com", source: "Booking.com" },
  { id: "expedia", label: "Expedia", source: "Expedia" },
  { id: "agoda", label: "Agoda", source: "Agoda" },
  { id: "airbnb", label: "Airbnb", source: "Airbnb" },
  { id: "makemytrip", label: "MakeMyTrip", source: "MakeMyTrip" },
  { id: "direct", label: "Direct", source: "Walk-In" },
];

export default function RateManagement() {
  const [startDate, setStartDate] = useState(() => todayISO());
  const [viewDays, setViewDays] = useState(7); // 7 | 14 | 30
  const [roomTypes, setRoomTypes] = useState(() => getRoomTypes());
  const [ratePlans, setRatePlans] = useState(() => getRatePlans());
  const [dailyRatesMap, setDailyRatesMap] = useState(() => getDailyRatesMap());
  const [dailyRestrictionsMap, setDailyRestrictionsMap] = useState(() => getDailyChannelRestrictions());
  const [filterSearch, setFilterSearch] = useState("");
  const [currency] = useState("$");

  // VIEW MODE & CHANNEL FILTER STATE
  const [viewMode, setViewMode] = useState("combined"); // "combined" | "restrictions" | "rates"
  const [selectedChannel, setSelectedChannel] = useState("all"); // "all" | "booking_com" | "expedia" | etc.

  // INLINE CELL EDIT MODAL STATE
  const [editingCell, setEditingCell] = useState(null); // { rtName, rpName, dateStr, key }
  const [inlinePriceInput, setInlinePriceInput] = useState("");
  const [inlineChannelKey, setInlineChannelKey] = useState("all");
  const [inlineStopSell, setInlineStopSell] = useState(false);
  const [inlineCTA, setInlineCTA] = useState(false);
  const [inlineCTD, setInlineCTD] = useState(false);
  const [inlineMinLOS, setInlineMinLOS] = useState("1");
  const [inlineMaxLOS, setInlineMaxLOS] = useState("30");

  // BULK RATES UPDATE MODAL
  const [showBulkRatesModal, setShowBulkRatesModal] = useState(false);
  const [bulkRatesForm, setBulkRatesForm] = useState({
    startDate: todayISO(),
    endDate: todayISO(),
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    roomTypes: [],
    ratePlans: [],
    adjustmentType: "fixed",
    fixedPrice: "175",
    adjustmentVal: "15",
    minStay: "1",
    stopSell: false,
  });

  // BULK RESTRICTIONS UPDATE MODAL
  const [showBulkRestrictionsModal, setShowBulkRestrictionsModal] = useState(false);
  const [bulkRestrictionsForm, setBulkRestrictionsForm] = useState({
    startDate: todayISO(),
    endDate: todayISO(),
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    roomTypes: [],
    channelKeys: ["all"],
    stopSell: false,
    cta: false,
    ctd: false,
    minLos: "1",
    maxLos: "30",
  });

  const [isTaxInclusive, setIsTaxInclusive] = useState(() => getTaxInclusiveSetting());
  const [activeTaxPct, setActiveTaxPct] = useState(() => getActiveTaxPercent());

  // LISTEN TO LIVE CONFIG & RESTRICTIONS EVENTS
  useEffect(() => {
    async function loadApiRoomTypes() {
      try {
        const { getRoomTypes: apiGetRoomTypes } = await import("../../services/api");
        const res = await apiGetRoomTypes();
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (list.length > 0) {
          setRoomTypes(list);
          try {
            dataStore.setItem("hotelpms_room_types_v3", JSON.stringify(list));
          } catch {}
        }
      } catch (err) {
        console.error("Failed to load room types from API in RateManagement:", err);
      }
    }
    loadApiRoomTypes();

    function handleSync() {
      setDailyRatesMap(getDailyRatesMap());
      setDailyRestrictionsMap(getDailyChannelRestrictions());
      setRoomTypes(getRoomTypes());
      setRatePlans(getRatePlans());
      setIsTaxInclusive(getTaxInclusiveSetting());
      setActiveTaxPct(getActiveTaxPercent());
    }

    window.addEventListener("pms_daily_rates_updated", handleSync);
    window.addEventListener("pms_daily_channel_restrictions_updated", handleSync);
    window.addEventListener("pms_channel_restrictions_updated", handleSync);
    window.addEventListener("pms_room_types_updated", handleSync);
    window.addEventListener("pms_rooms_updated", handleSync);
    window.addEventListener("pms_rate_plans_updated", handleSync);
    window.addEventListener("pms_tax_inclusive_updated", handleSync);
    window.addEventListener("pms_taxes_updated", handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener("pms_daily_rates_updated", handleSync);
      window.removeEventListener("pms_daily_channel_restrictions_updated", handleSync);
      window.removeEventListener("pms_channel_restrictions_updated", handleSync);
      window.removeEventListener("pms_room_types_updated", handleSync);
      window.removeEventListener("pms_rooms_updated", handleSync);
      window.removeEventListener("pms_rate_plans_updated", handleSync);
      window.removeEventListener("pms_tax_inclusive_updated", handleSync);
      window.removeEventListener("pms_taxes_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  // GENERATE DATES ARRAY
  const datesList = useMemo(() => {
    const list = [];
    const start = new Date(startDate);
    for (let i = 0; i < viewDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      list.push({ iso, dayName, monthDay, dateObj: d });
    }
    return list;
  }, [startDate, viewDays]);

  // DATE NAV HANDLERS
  function handlePrevDays() {
    const d = new Date(startDate);
    d.setDate(d.getDate() - viewDays);
    setStartDate(d.toISOString().split("T")[0]);
  }

  function handleNextDays() {
    const d = new Date(startDate);
    d.setDate(d.getDate() + viewDays);
    setStartDate(d.toISOString().split("T")[0]);
  }

  // CELL EDIT HANDLER
  function handleOpenCellEdit(rtName, rpName, dateStr) {
    const key = `${rtName}_${rpName}_${dateStr}`;
    const existingRate = dailyRatesMap[key] || {};
    const existingRest = getEffectiveRestriction(selectedChannel, rtName, dateStr);

    const rt = roomTypes.find((t) => t.name === rtName);
    const rp = ratePlans.find((p) => p.name === rpName);
    const planNights = Math.max(1, Number(rp?.nights) || 1);
    const planAdj = Number(rp?.adjustment || 0);

    let baseRate = planAdj > 0 ? (planAdj / planNights) : Number(rt?.price || 0);
    const basePrice = existingRate.price !== undefined ? existingRate.price : Math.round(baseRate * 100) / 100;

    const taxMultiplier = isTaxInclusive && activeTaxPct > 0 ? (1 + activeTaxPct / 100) : 1;
    const displayedPrice = Math.round((basePrice * taxMultiplier) * 100) / 100;

    setEditingCell({ rtName, rpName, dateStr, key });
    setInlinePriceInput(String(displayedPrice));
    setInlineChannelKey(selectedChannel);
    setInlineStopSell(Boolean(existingRest.stopSell));
    setInlineCTA(Boolean(existingRest.cta));
    setInlineCTD(Boolean(existingRest.ctd));
    setInlineMinLOS(String(existingRest.minLos || 1));
    setInlineMaxLOS(String(existingRest.maxLos || 30));
  }

  function handleSaveInlineCell(e) {
    e.preventDefault();
    if (!editingCell) return;

    // 1. Save Daily Rate
    const enteredVal = Number(inlinePriceInput || 0);
    const taxMultiplier = isTaxInclusive && activeTaxPct > 0 ? (1 + activeTaxPct / 100) : 1;
    const basePriceToSave = enteredVal / taxMultiplier;

    saveDailyRate(editingCell.key, {
      price: Math.round(basePriceToSave * 100) / 100,
      minStay: Number(inlineMinLOS || 1),
      stopSell: inlineStopSell,
    });

    // 2. Save Date-Wise Channel Restrictions
    const restKey = `${inlineChannelKey}_${editingCell.rtName}_${editingCell.dateStr}`;
    saveDailyChannelRestriction(restKey, {
      stopSell: inlineStopSell,
      cta: inlineCTA,
      ctd: inlineCTD,
      minLos: Math.max(1, Number(inlineMinLOS || 1)),
      maxLos: Math.max(1, Number(inlineMaxLOS || 30)),
    });

    setEditingCell(null);
  }

  // BULK RATES SUBMIT HANDLER
  function handleSaveBulkRatesSubmit(e) {
    e.preventDefault();
    if (bulkRatesForm.roomTypes.length === 0 || bulkRatesForm.ratePlans.length === 0) {
      alert("Please select at least one Room Category and one Rate Plan.");
      return;
    }

    const taxMultiplier = isTaxInclusive && activeTaxPct > 0 ? (1 + activeTaxPct / 100) : 1;
    const fixedPriceVal = (bulkRatesForm.adjustmentType === "fixed" && isTaxInclusive && activeTaxPct > 0)
      ? String(Math.round((Number(bulkRatesForm.fixedPrice || 0) / taxMultiplier) * 100) / 100)
      : bulkRatesForm.fixedPrice;

    bulkUpdateDailyRates({
      ...bulkRatesForm,
      fixedPrice: fixedPriceVal,
      customRatesMap: bulkRatesForm.customRatesMap || {}
    });
    setShowBulkRatesModal(false);
  }

  // BULK RESTRICTIONS SUBMIT HANDLER
  function handleSaveBulkRestrictionsSubmit(e) {
    e.preventDefault();
    if (bulkRestrictionsForm.roomTypes.length === 0) {
      alert("Please select at least one Room Category.");
      return;
    }

    bulkSaveDailyChannelRestrictions({
      startDate: bulkRestrictionsForm.startDate,
      endDate: bulkRestrictionsForm.endDate,
      daysOfWeek: bulkRestrictionsForm.daysOfWeek,
      roomTypes: bulkRestrictionsForm.roomTypes,
      channelKeys: bulkRestrictionsForm.channelKeys,
      stopSell: bulkRestrictionsForm.stopSell,
      cta: bulkRestrictionsForm.cta,
      ctd: bulkRestrictionsForm.ctd,
      minLos: Number(bulkRestrictionsForm.minLos || 1),
      maxLos: Number(bulkRestrictionsForm.maxLos || 30),
    });

    setShowBulkRestrictionsModal(false);
  }

  // DYNAMIC RESOLUTION OF ROOM TYPES
  const activeRoomTypes = useMemo(() => {
    if (Array.isArray(roomTypes)) return roomTypes;
    return [];
  }, [roomTypes]);

  const filteredRoomTypes = useMemo(() => {
    if (!filterSearch) return activeRoomTypes;
    return activeRoomTypes.filter((t) =>
      t.name.toLowerCase().includes(filterSearch.toLowerCase())
    );
  }, [activeRoomTypes, filterSearch]);

  return (
    <div className="rm-container">
      {/* TOP WORKSPACE HEADER */}
      <div className="rm-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "20px", flexWrap: "wrap" }}>
        <div className="rm-header-left" style={{ flex: "1 1 300px" }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0, fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>
            <span>Rate &amp; Restrictions Management</span>
          </h1>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px", margin: 0, fontWeight: "600" }}>
            Manage room rates and date-wise OTA restrictions (StopSell, CTA, CTD, Min/Max LOS) across channels.
          </p>
        </div>

        <div className="rm-header-actions" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "nowrap", flexShrink: 0 }}>
          {activeTaxPct > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 38,
                padding: "0 14px",
                borderRadius: 10,
                border: "1.5px solid #cbd5e1",
                background: "#f8fafc",
                color: "#475569",
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: "nowrap"
              }}
            >
              Active Tax: {activeTaxPct}%
            </span>
          )}

          <select
            value={isTaxInclusive ? "inclusive" : "exclusive"}
            onChange={(e) => {
              const nextVal = e.target.value === "inclusive";
              setIsTaxInclusive(nextVal);
              saveTaxInclusiveSetting(nextVal);
            }}
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: 10,
              border: "1.5px solid #cbd5e1",
              fontWeight: "800",
              fontSize: 12.5,
              color: "#0f172a",
              background: "#ffffff",
              outline: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              width: "auto",
              maxWidth: "210px",
              boxShadow: "0 1px 3px rgba(15,23,42,0.04)"
            }}
          >
            <option value="exclusive">🏷️ Rates: Tax Exclusive</option>
            <option value="inclusive">🧾 Rates: Tax Inclusive</option>
          </select>

          <button
            type="button"
            className="rm-btn-teal"
            style={{
              height: 38,
              padding: "0 16px",
              borderRadius: 10,
              border: "1.5px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 800,
              fontSize: "12.5px",
              whiteSpace: "nowrap"
            }}
            onClick={() => {
              setBulkRatesForm({
                startDate: startDate,
                endDate: datesList[datesList.length - 1]?.iso || startDate,
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                roomTypes: roomTypes.map((t) => t.name),
                ratePlans: ratePlans.map((p) => p.name),
                adjustmentType: "fixed",
                fixedPrice: "175",
                adjustmentVal: "15",
                minStay: "1",
                stopSell: false,
              });
              setShowBulkRatesModal(true);
            }}
          >
            ⚡ Bulk Update Rates
          </button>

          <button
            type="button"
            className="rm-btn-teal"
            style={{
              height: 38,
              padding: "0 16px",
              borderRadius: 10,
              border: "1.5px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 800,
              fontSize: "12.5px",
              whiteSpace: "nowrap"
            }}
            onClick={() => {
              setBulkRestrictionsForm({
                startDate: startDate,
                endDate: datesList[datesList.length - 1]?.iso || startDate,
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                roomTypes: roomTypes.map((t) => t.name),
                channelKeys: [selectedChannel === "all" ? "booking_com" : selectedChannel],
                stopSell: false,
                cta: false,
                ctd: false,
                minLos: "1",
                maxLos: "30",
              });
              setShowBulkRestrictionsModal(true);
            }}
          >
            🚫 Bulk Restrictions Matrix
          </button>
        </div>
      </div>

      {/* VIEW MODE SWITCHER & OTA CHANNEL SELECTOR BAR */}
      <div 
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "12px 16px",
          border: "1px solid #e2e8f0",
          marginBottom: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          {/* VIEW MODE TABS */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#f8fafc", padding: "4px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <button
              type="button"
              onClick={() => setViewMode("combined")}
              style={{
                padding: "6px 14px",
                borderRadius: "7px",
                fontSize: "12px",
                fontWeight: viewMode === "combined" ? "800" : "600",
                border: viewMode === "combined" ? "1px solid #cbd5e1" : "none",
                cursor: "pointer",
                background: viewMode === "combined" ? "#ffffff" : "transparent",
                color: viewMode === "combined" ? "#0f172a" : "#64748b",
                boxShadow: viewMode === "combined" ? "0 1px 3px rgba(15, 23, 42, 0.06)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              📈 Rates &amp; Restrictions Matrix
            </button>
            <button
              type="button"
              onClick={() => setViewMode("restrictions")}
              style={{
                padding: "6px 14px",
                borderRadius: "7px",
                fontSize: "12px",
                fontWeight: viewMode === "restrictions" ? "800" : "600",
                border: viewMode === "restrictions" ? "1px solid #cbd5e1" : "none",
                cursor: "pointer",
                background: viewMode === "restrictions" ? "#ffffff" : "transparent",
                color: viewMode === "restrictions" ? "#0f172a" : "#64748b",
                boxShadow: viewMode === "restrictions" ? "0 1px 3px rgba(15, 23, 42, 0.06)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              🚫 Date-Wise Restrictions Only
            </button>
            <button
              type="button"
              onClick={() => setViewMode("rates")}
              style={{
                padding: "6px 14px",
                borderRadius: "7px",
                fontSize: "12px",
                fontWeight: viewMode === "rates" ? "800" : "600",
                border: viewMode === "rates" ? "1px solid #cbd5e1" : "none",
                cursor: "pointer",
                background: viewMode === "rates" ? "#ffffff" : "transparent",
                color: viewMode === "rates" ? "#0f172a" : "#64748b",
                boxShadow: viewMode === "rates" ? "0 1px 3px rgba(15, 23, 42, 0.06)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              💲 Rates Only
            </button>
          </div>

          {/* OTA CHANNEL SELECTOR CHIPS */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "4px" }}>
              Target OTA Channel:
            </span>
            {OTA_CHANNELS.map((ch) => {
              const isSelected = selectedChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChannel(ch.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 11px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: isSelected ? "800" : "600",
                    border: isSelected ? "1.5px solid #0f172a" : "1px solid #e2e8f0",
                    background: isSelected ? "#ffffff" : "#ffffff",
                    color: isSelected ? "#0f172a" : "#475569",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 1px 4px rgba(15, 23, 42, 0.08)" : "none"
                  }}
                >
                  <OtaBadge source={ch.source} size="xs" showText={false} />
                  <span>{ch.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TOOLBAR CONTROLS */}
      <div className="rm-toolbar">
        <div className="rm-toolbar-left">
          <div className="rm-date-nav">
            <button type="button" className="rm-nav-btn" onClick={handlePrevDays}>
              ◀ Prev
            </button>
            <button type="button" className="rm-nav-btn" onClick={() => setStartDate(todayISO())}>
              Today
            </button>
            <button type="button" className="rm-nav-btn" onClick={handleNextDays}>
              Next ▶
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Start Date:</span>
            <div style={{ width: "160px" }}>
              <CustomDatePicker
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="rm-view-pills">
            <button
              type="button"
              className={`rm-view-pill ${viewDays === 7 ? "active" : ""}`}
              onClick={() => setViewDays(7)}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`rm-view-pill ${viewDays === 14 ? "active" : ""}`}
              onClick={() => setViewDays(14)}
            >
              14 Days
            </button>
            <button
              type="button"
              className={`rm-view-pill ${viewDays === 30 ? "active" : ""}`}
              onClick={() => setViewDays(30)}
            >
              30 Days
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="text"
            className="rm-search-input"
            placeholder="Search room category..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </div>
      </div>

      {/* RATE & RESTRICTIONS MATRIX DATA TABLE */}
      {activeRoomTypes.length === 0 ? (
        <div style={{ background: "#ffffff", borderRadius: 12, padding: "48px 24px", textAlign: "center", border: "2px dashed #cbd5e1", margin: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏨</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>No Room Categories Configured Yet</h2>
          <p style={{ color: "#64748b", fontSize: 14, maxWidth: 520, margin: "0 auto 24px", lineHeight: 1.6 }}>
            You haven&apos;t configured any room categories or room numbers yet. Configure your room categories under <strong>Property Setup ➔ Room Types</strong>!
          </p>
          <a
            href="/configuration"
            className="rm-btn-teal"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", padding: "12px 24px", fontSize: 14, fontWeight: 800 }}
          >
            ⚙️ Configure Room Categories Now
          </a>
        </div>
      ) : (
        <div className="rm-table-wrapper">
          <table className="rm-table">
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Room Category / Rate Plan</th>
                {datesList.map((d) => (
                  <th key={d.iso} className="date-col">
                    <div className="rm-date-header">
                      <span className="day">{d.dayName}</span>
                      <span className="num">{d.monthDay}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRoomTypes.map((rt) => (
                <tr key={rt.id || rt.name} className="rm-category-row">
                  <td colSpan={datesList.length + 1} style={{ padding: "12px 16px" }}>
                    <div className="rm-category-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>🏢 {rt.name}</span>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px" }}>
                        Category Base: ${rt.price || 150}/night
                      </span>
                    </div>
                  </td>
                </tr>
              )).flatMap((categoryElement, idx) => {
                const rt = filteredRoomTypes[idx];
                const taxMultiplier = isTaxInclusive && activeTaxPct > 0 ? (1 + activeTaxPct / 100) : 1;

                const planRows = ratePlans.map((rp) => {
                  const planNights = Math.max(1, Number(rp?.nights) || 1);
                  const planPrice = Number(rp?.adjustment || 0);
                  const baseNightlyRate = planPrice > 0 ? (planPrice / planNights) : Number(rt?.price || 0);
                  const displayedNightlyRate = Math.round((baseNightlyRate * taxMultiplier) * 100) / 100;

                  return (
                    <tr key={`${rt.name}_${rp.name}`} className="rm-plan-row">
                      <td className="rm-plan-name">
                        <span style={{ fontSize: "12px" }}>🏷️</span> {rp.name}
                        {baseNightlyRate > 0 && (
                          <span style={{ fontSize: "10.5px", color: "#000000", marginLeft: 6, fontWeight: 800 }}>
                            ({currency}{displayedNightlyRate.toFixed(2)}/night)
                          </span>
                        )}
                      </td>

                      {datesList.map((d) => {
                        const rateKey = `${rt.name}_${rp.name}_${d.iso}`;
                        const rateEntry = dailyRatesMap[rateKey];
                        const basePrice = rateEntry?.price !== undefined ? rateEntry.price : baseNightlyRate;
                        const displayedPrice = Math.round((basePrice * taxMultiplier) * 100) / 100;
                        const isRateModified = rateEntry?.price !== undefined;

                        // Effective restriction for selected channel & date
                        const rest = getEffectiveRestriction(selectedChannel, rt.name, d.iso);
                        const isStopSell = Boolean(rest.stopSell);
                        const isCTA = Boolean(rest.cta);
                        const isCTD = Boolean(rest.ctd);
                        const minLOS = rest.minLos || planNights;
                        const maxLOS = rest.maxLos || 30;

                        const hasActiveRestriction = isStopSell || isCTA || isCTD || minLOS > 1 || maxLOS < 30;

                        return (
                          <td key={d.iso} style={{ textAlign: "center", verticalAlign: "middle" }}>
                            <div
                              className={`rm-cell-card ${isRateModified ? "modified" : ""} ${isStopSell ? "stop-sell" : ""}`}
                              onClick={() => handleOpenCellEdit(rt.name, rp.name, d.iso)}
                              title={`Click to edit rate & restrictions for ${rt.name} (${rp.name}) on ${d.iso}`}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "6px 4px",
                                minHeight: "56px",
                                border: "1px solid #e2e8f0",
                                background: "#ffffff",
                                borderRadius: "8px",
                                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)"
                              }}
                            >
                              {/* RATE PRICE DISPLAY (Combined or Rates view) */}
                              {viewMode !== "restrictions" && (
                                <span className="rm-cell-price" style={{ fontWeight: "900", fontSize: "13.5px", color: isStopSell ? "#64748b" : "#0f172a" }}>
                                  {currency}{Number(displayedPrice).toFixed(2)}
                                </span>
                              )}

                              {/* RESTRICTION BADGES DISPLAY (Combined or Restrictions view) */}
                              {viewMode !== "rates" && (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", marginTop: "2px" }}>
                                  {isStopSell ? (
                                    <span style={{ fontSize: "9.5px", fontWeight: "800", color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: "1px 5px", borderRadius: "3px" }}>
                                      🔴 STOP SELL
                                    </span>
                                  ) : (
                                    <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", justifyContent: "center" }}>
                                      {isCTA && (
                                        <span style={{ fontSize: "9px", fontWeight: "800", color: "#92400e", background: "#fffbe6", border: "1px solid #fef08a", padding: "1px 4px", borderRadius: "3px" }} title="Closed to Arrival">
                                          🚫 CTA
                                        </span>
                                      )}
                                      {isCTD && (
                                        <span style={{ fontSize: "9px", fontWeight: "800", color: "#9a3412", background: "#fff7ed", border: "1px solid #ffedd5", padding: "1px 4px", borderRadius: "3px" }} title="Closed to Departure">
                                          🚪 CTD
                                        </span>
                                      )}
                                      {minLOS > 1 && (
                                        <span style={{ fontSize: "9px", fontWeight: "800", color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "1px 4px", borderRadius: "3px" }} title={`Min Length of Stay: ${minLOS} Nights`}>
                                          ⏱️ {minLOS}N Min
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {!hasActiveRestriction && viewMode === "restrictions" && (
                                    <span style={{ fontSize: "9.5px", color: "#059669", fontWeight: "700" }}>
                                      ✅ Open
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
                return [categoryElement, ...planRows];
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* INLINE CELL & RESTRICTIONS EDIT MODAL */}
      {editingCell && (
        <div className="rm-modal-overlay">
          <div className="rm-modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-head">
              <h3>✏️ Edit Daily Rate &amp; OTA Restrictions</h3>
              <button type="button" className="rm-modal-close" onClick={() => setEditingCell(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveInlineCell} className="rm-modal-body">
              <div style={{ background: "#f8fafc", padding: "14px 18px", borderRadius: "10px", fontSize: 13, border: "1px solid #e2e8f0" }}>
                <strong style={{ fontSize: "14px", color: "#0f172a" }}>{editingCell.rtName}</strong> • <span style={{ color: "#475569", fontWeight: 700 }}>{editingCell.rpName}</span>
                <div style={{ color: "#64748b", fontSize: "12px", marginTop: 4, fontWeight: 600 }}>Target Date: <strong>{editingCell.dateStr}</strong></div>
              </div>

              {/* TARGET CHANNEL SELECTION */}
              <div className="rm-field-group">
                <label className="rm-field-label">TARGET OTA CHANNEL</label>
                <select
                  value={inlineChannelKey}
                  onChange={(e) => setInlineChannelKey(e.target.value)}
                  style={{ height: 40, borderRadius: 8, border: "1.5px solid #cbd5e1", padding: "0 12px", fontSize: 13, fontWeight: 700, width: "100%" }}
                >
                  <option value="all">🌐 All Channels (Global Update)</option>
                  <option value="booking_com">Booking.com</option>
                  <option value="expedia">Expedia</option>
                  <option value="agoda">Agoda</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="makemytrip">MakeMyTrip</option>
                  <option value="direct">Direct Web / Walk-In</option>
                </select>
              </div>

              {/* DAILY PRICE */}
              <div className="rm-field-group">
                <label className="rm-field-label">DAILY PRICE ({currency}) {isTaxInclusive ? "· Tax Inclusive" : "· Tax Exclusive"} *</label>
                <input
                  type="number"
                  step="0.01"
                  value={inlinePriceInput}
                  onChange={(e) => setInlinePriceInput(e.target.value)}
                  required
                  style={{ height: 44, borderRadius: 10, border: "1.5px solid #cbd5e1", padding: "0 14px", fontSize: 18, fontWeight: 800, color: "#0f172a", outline: "none", background: "#ffffff" }}
                />
              </div>

              {/* DATE-WISE RESTRICTION CONTROLS */}
              <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "14px", marginTop: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: "900", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                  🚫 Date-Wise ARI Restrictions
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inlineStopSell}
                      onChange={(e) => setInlineStopSell(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#0f172a" }}
                    />
                    <span>🔴 Stop Sell</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inlineCTA}
                      onChange={(e) => setInlineCTA(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#0f172a" }}
                    />
                    <span>🚫 CTA</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inlineCTD}
                      onChange={(e) => setInlineCTD(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#0f172a" }}
                    />
                    <span>🚪 CTD</span>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", display: "block", marginBottom: "4px" }}>
                      MIN LENGTH OF STAY (Nights)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={inlineMinLOS}
                      onChange={(e) => setInlineMinLOS(e.target.value)}
                      style={{ height: "38px", borderRadius: "8px", border: "1.5px solid #cbd5e1", padding: "0 10px", fontSize: "14px", fontWeight: "800", width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", display: "block", marginBottom: "4px" }}>
                      MAX LENGTH OF STAY (Nights)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={inlineMaxLOS}
                      onChange={(e) => setInlineMaxLOS(e.target.value)}
                      style={{ height: "38px", borderRadius: "8px", border: "1.5px solid #cbd5e1", padding: "0 10px", fontSize: "14px", fontWeight: "800", width: "100%" }}
                    />
                  </div>
                </div>
              </div>

              <div className="rm-modal-actions">
                <button type="button" className="rm-btn-cancel" onClick={() => setEditingCell(null)}>Cancel</button>
                <button type="submit" className="rm-btn-submit">Save &amp; Push Live ARI</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK RATE UPDATE MODAL */}
      {showBulkRatesModal && (
        <div className="rm-modal-overlay">
          <div className="rm-modal-card" style={{ maxWidth: 840, width: "92vw", borderRadius: "14px", border: "1px solid #cbd5e1", boxShadow: "0 15px 35px rgba(0,0,0,0.1)" }} onClick={(e) => e.stopPropagation()}>
            
            {/* MODAL HEADER */}
            <div className="rm-modal-head" style={{ padding: "16px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                <span>⚡ Bulk Update Daily Rates</span>
              </h3>
              <button type="button" className="rm-modal-close" onClick={() => setShowBulkRatesModal(false)} style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "6px", width: "30px", height: "30px", cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleSaveBulkRatesSubmit} className="rm-modal-body" style={{ padding: "18px 20px", gap: "14px", background: "#ffffff" }}>
              
              {/* TOP SECTION: 2-COLUMN GRID (LEFT: DATES & DAYS | RIGHT: CATEGORIES & PLANS) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "14px" }}>
                
                {/* LEFT PANEL: 1. DATE RANGE & DAYS OF WEEK */}
                <div className="rm-field-group" style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <label className="rm-field-label" style={{ color: "#334155", marginBottom: "6px", fontSize: "11.5px", fontWeight: "800", letterSpacing: "0.4px" }}>1. DATE RANGE &amp; DAYS OF WEEK</label>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 3 }}>Start Date</span>
                      <CustomDatePicker
                        value={bulkRatesForm.startDate}
                        onChange={(e) => setBulkRatesForm({ ...bulkRatesForm, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 3 }}>End Date</span>
                      <CustomDatePicker
                        value={bulkRatesForm.endDate}
                        onChange={(e) => setBulkRatesForm({ ...bulkRatesForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* WEEKDAYS & WEEKEND PRESETS */}
                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={{
                        padding: "4px 9px",
                        borderRadius: "5px",
                        fontSize: "11px",
                        fontWeight: 700,
                        border: bulkRatesForm.daysOfWeek.length === 7 ? "1px solid #475569" : "1px solid #cbd5e1",
                        background: bulkRatesForm.daysOfWeek.length === 7 ? "#e2e8f0" : "#ffffff",
                        color: bulkRatesForm.daysOfWeek.length === 7 ? "#0f172a" : "#475569",
                        cursor: "pointer",
                      }}
                      onClick={() => setBulkRatesForm({ ...bulkRatesForm, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })}
                    >
                      All Days (Mon-Sun)
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "4px 9px",
                        borderRadius: "5px",
                        fontSize: "11px",
                        fontWeight: 700,
                        border: JSON.stringify([...bulkRatesForm.daysOfWeek].sort()) === JSON.stringify([1, 2, 3, 4, 5]) ? "1px solid #475569" : "1px solid #cbd5e1",
                        background: JSON.stringify([...bulkRatesForm.daysOfWeek].sort()) === JSON.stringify([1, 2, 3, 4, 5]) ? "#e2e8f0" : "#ffffff",
                        color: JSON.stringify([...bulkRatesForm.daysOfWeek].sort()) === JSON.stringify([1, 2, 3, 4, 5]) ? "#0f172a" : "#475569",
                        cursor: "pointer",
                      }}
                      onClick={() => setBulkRatesForm({ ...bulkRatesForm, daysOfWeek: [1, 2, 3, 4, 5] })}
                    >
                      Weekdays Only (Mon-Fri)
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "4px 9px",
                        borderRadius: "5px",
                        fontSize: "11px",
                        fontWeight: 700,
                        border: JSON.stringify([...bulkRatesForm.daysOfWeek].sort()) === JSON.stringify([0, 6]) ? "1px solid #475569" : "1px solid #cbd5e1",
                        background: JSON.stringify([...bulkRatesForm.daysOfWeek].sort()) === JSON.stringify([0, 6]) ? "#e2e8f0" : "#ffffff",
                        color: JSON.stringify([...bulkRatesForm.daysOfWeek].sort()) === JSON.stringify([0, 6]) ? "#0f172a" : "#475569",
                        cursor: "pointer",
                      }}
                      onClick={() => setBulkRatesForm({ ...bulkRatesForm, daysOfWeek: [0, 6] })}
                    >
                      Weekends Only (Sat-Sun)
                    </button>
                  </div>

                  {/* INDIVIDUAL DAY CHECKBOXES */}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", background: "#ffffff", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {[
                      { num: 1, label: "Mon" },
                      { num: 2, label: "Tue" },
                      { num: 3, label: "Wed" },
                      { num: 4, label: "Thu" },
                      { num: 5, label: "Fri" },
                      { num: 6, label: "Sat" },
                      { num: 0, label: "Sun" },
                    ].map((day) => {
                      const isChecked = bulkRatesForm.daysOfWeek.includes(day.num);
                      return (
                        <label key={day.num} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer", color: isChecked ? "#0f172a" : "#64748b" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...bulkRatesForm.daysOfWeek, day.num]
                                : bulkRatesForm.daysOfWeek.filter((d) => d !== day.num);
                              setBulkRatesForm({ ...bulkRatesForm, daysOfWeek: next });
                            }}
                          />
                          <span>{day.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT PANEL: 2. ROOM CATEGORIES & 3. RATE PLANS */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  
                  {/* 2. TARGET ROOM CATEGORIES */}
                  <div className="rm-field-group" style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <label className="rm-field-label" style={{ margin: 0, color: "#334155", fontSize: "11.5px", fontWeight: "800" }}>2. TARGET ROOM CATEGORIES</label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          style={{ background: "none", border: "none", color: "#2563eb", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: 0 }}
                          onClick={() => setBulkRatesForm({ ...bulkRatesForm, roomTypes: roomTypes.map((t) => t.name) })}
                        >
                          Select All
                        </button>
                        <span style={{ color: "#cbd5e1" }}>|</span>
                        <button
                          type="button"
                          style={{ background: "none", border: "none", color: "#64748b", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: 0 }}
                          onClick={() => setBulkRatesForm({ ...bulkRatesForm, roomTypes: [] })}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {roomTypes.map((rt) => {
                        const isChecked = bulkRatesForm.roomTypes.includes(rt.name);
                        return (
                          <label
                            key={rt.name}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "4px 9px",
                              borderRadius: "5px",
                              border: isChecked ? "1px solid #475569" : "1px solid #cbd5e1",
                              background: isChecked ? "#f1f5f9" : "#ffffff",
                              color: isChecked ? "#0f172a" : "#475569",
                              fontSize: "11.5px",
                              fontWeight: isChecked ? "700" : "600",
                              cursor: "pointer"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...bulkRatesForm.roomTypes, rt.name]
                                  : bulkRatesForm.roomTypes.filter((t) => t !== rt.name);
                                setBulkRatesForm({ ...bulkRatesForm, roomTypes: next });
                              }}
                            />
                            <span>{rt.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. TARGET RATE PLANS */}
                  <div className="rm-field-group" style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <label className="rm-field-label" style={{ margin: 0, color: "#334155", fontSize: "11.5px", fontWeight: "800" }}>3. TARGET RATE PLANS</label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          style={{ background: "none", border: "none", color: "#2563eb", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: 0 }}
                          onClick={() => setBulkRatesForm({ ...bulkRatesForm, ratePlans: ratePlans.map((p) => p.name) })}
                        >
                          Select All
                        </button>
                        <span style={{ color: "#cbd5e1" }}>|</span>
                        <button
                          type="button"
                          style={{ background: "none", border: "none", color: "#64748b", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: 0 }}
                          onClick={() => setBulkRatesForm({ ...bulkRatesForm, ratePlans: [] })}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {ratePlans.map((rp) => {
                        const isChecked = bulkRatesForm.ratePlans.includes(rp.name);
                        return (
                          <label
                            key={rp.name}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "4px 9px",
                              borderRadius: "5px",
                              border: isChecked ? "1px solid #475569" : "1px solid #cbd5e1",
                              background: isChecked ? "#f1f5f9" : "#ffffff",
                              color: isChecked ? "#0f172a" : "#475569",
                              fontSize: "11.5px",
                              fontWeight: isChecked ? "700" : "600",
                              cursor: "pointer"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...bulkRatesForm.ratePlans, rp.name]
                                  : bulkRatesForm.ratePlans.filter((p) => p !== rp.name);
                                setBulkRatesForm({ ...bulkRatesForm, ratePlans: next });
                              }}
                            />
                            <span>{rp.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>

              {/* BOTTOM SECTION: 4. RATE ADJUSTMENT MODE & MATRIX TABLE */}
              <div className="rm-field-group" style={{ background: "#ffffff", padding: "14px 16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <label className="rm-field-label" style={{ color: "#0f172a", marginBottom: "10px", fontSize: "12px", fontWeight: "800" }}>4. RATE ADJUSTMENT VALUE &amp; MATRIX OVERRIDES</label>

                <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px", background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: bulkRatesForm.adjustmentType === "fixed" ? "1px solid #475569" : "1px solid #cbd5e1",
                        background: bulkRatesForm.adjustmentType === "fixed" ? "#e2e8f0" : "#ffffff",
                        color: bulkRatesForm.adjustmentType === "fixed" ? "#0f172a" : "#64748b",
                        cursor: "pointer"
                      }}
                      onClick={() => setBulkRatesForm({ ...bulkRatesForm, adjustmentType: "fixed" })}
                    >
                      💲 Fixed Rate ($)
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: bulkRatesForm.adjustmentType === "percent" ? "1px solid #475569" : "1px solid #cbd5e1",
                        background: bulkRatesForm.adjustmentType === "percent" ? "#e2e8f0" : "#ffffff",
                        color: bulkRatesForm.adjustmentType === "percent" ? "#0f172a" : "#64748b",
                        cursor: "pointer"
                      }}
                      onClick={() => setBulkRatesForm({ ...bulkRatesForm, adjustmentType: "percent" })}
                    >
                      📈 Percentage (+ / - %)
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: bulkRatesForm.adjustmentType === "flat" ? "1px solid #475569" : "1px solid #cbd5e1",
                        background: bulkRatesForm.adjustmentType === "flat" ? "#e2e8f0" : "#ffffff",
                        color: bulkRatesForm.adjustmentType === "flat" ? "#0f172a" : "#64748b",
                        cursor: "pointer"
                      }}
                      onClick={() => setBulkRatesForm({ ...bulkRatesForm, adjustmentType: "flat" })}
                    >
                      💵 Flat Amount (+ / - $)
                    </button>
                  </div>

                  <div style={{ flex: "1 1 200px", minWidth: "180px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "3px" }}>
                      {bulkRatesForm.adjustmentType === "fixed" && `Quick Baseline Rate (${currency})`}
                      {bulkRatesForm.adjustmentType === "percent" && "Percentage Adjustment (%)"}
                      {bulkRatesForm.adjustmentType === "flat" && `Flat Amount Adjustment (${currency})`}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 175"
                      value={bulkRatesForm.adjustmentType === "fixed" ? bulkRatesForm.fixedPrice : bulkRatesForm.adjustmentVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (bulkRatesForm.adjustmentType === "fixed") {
                          const updatedMap = { ...(bulkRatesForm.customRatesMap || {}) };
                          (bulkRatesForm.roomTypes || []).forEach((rt) => {
                            (bulkRatesForm.ratePlans || []).forEach((rp) => {
                              updatedMap[`${rt}_${rp}`] = val;
                            });
                          });
                          setBulkRatesForm({ ...bulkRatesForm, fixedPrice: val, customRatesMap: updatedMap });
                        } else {
                          setBulkRatesForm({ ...bulkRatesForm, adjustmentVal: val });
                        }
                      }}
                      style={{ height: 36, borderRadius: 5, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 14, fontWeight: 800, width: "100%", background: "#ffffff", color: "#0f172a" }}
                    />
                  </div>
                </div>

                {/* INDIVIDUAL RATES TABLE MATRIX */}
                {bulkRatesForm.adjustmentType === "fixed" && bulkRatesForm.roomTypes.length > 0 && bulkRatesForm.ratePlans.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ fontSize: "11.5px", fontWeight: "800", color: "#0f172a", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>🎯 Individual Category &amp; Plan Rate Matrix</span>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "500" }}>
                        Type in any box to override specific prices
                      </span>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "6px", background: "#ffffff", maxHeight: "240px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: "800", color: "#475569", minWidth: "160px" }}>
                              Room Category
                            </th>
                            {bulkRatesForm.ratePlans.map((rp) => (
                              <th key={rp} style={{ padding: "8px 12px", textAlign: "center", fontWeight: "800", color: "#475569", whiteSpace: "nowrap" }}>
                                {rp} ({currency})
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bulkRatesForm.roomTypes.map((rt, idx) => (
                            <tr key={rt} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                              <td style={{ padding: "8px 12px", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap" }}>
                                🏨 {rt}
                              </td>
                              {bulkRatesForm.ratePlans.map((rp) => {
                                const mapKey = `${rt}_${rp}`;
                                const val = (bulkRatesForm.customRatesMap && bulkRatesForm.customRatesMap[mapKey] !== undefined)
                                  ? bulkRatesForm.customRatesMap[mapKey]
                                  : (bulkRatesForm.fixedPrice || "");
                                return (
                                  <td key={rp} style={{ padding: "6px 8px", textAlign: "center" }}>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder={bulkRatesForm.fixedPrice || "175"}
                                      value={val}
                                      onChange={(e) => {
                                        const newMap = { ...(bulkRatesForm.customRatesMap || {}), [mapKey]: e.target.value };
                                        setBulkRatesForm({ ...bulkRatesForm, customRatesMap: newMap });
                                      }}
                                      style={{
                                        height: "32px",
                                        borderRadius: "5px",
                                        border: "1px solid #cbd5e1",
                                        padding: "0 8px",
                                        fontSize: "13px",
                                        fontWeight: "700",
                                        width: "100px",
                                        textAlign: "center",
                                        background: "#ffffff",
                                        color: "#0f172a",
                                        outline: "none"
                                      }}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="rm-modal-actions" style={{ marginTop: "2px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                <button type="button" className="rm-btn-cancel" onClick={() => setShowBulkRatesModal(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: "700" }}>Cancel</button>
                <button type="submit" className="rm-btn-submit" style={{ padding: "8px 20px", borderRadius: "6px", border: "none", background: "#0f172a", color: "#ffffff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Apply Bulk Rates</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK RESTRICTIONS UPDATE MODAL */}
      {showBulkRestrictionsModal && (
        <div className="rm-modal-overlay">
          <div className="rm-modal-card" style={{ maxWidth: 850, width: "95vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-head">
              <h3>🚫 Bulk Update OTA Restrictions Matrix</h3>
              <button type="button" className="rm-modal-close" onClick={() => setShowBulkRestrictionsModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveBulkRestrictionsSubmit} className="rm-modal-body">
              {/* DATE RANGE & DAYS OF WEEK */}
              <div className="rm-field-group">
                <label className="rm-field-label">1. DATE RANGE &amp; DAYS OF WEEK</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 4 }}>Start Date</span>
                    <CustomDatePicker
                      value={bulkRestrictionsForm.startDate}
                      onChange={(e) => setBulkRestrictionsForm({ ...bulkRestrictionsForm, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 4 }}>End Date</span>
                    <CustomDatePicker
                      value={bulkRestrictionsForm.endDate}
                      onChange={(e) => setBulkRestrictionsForm({ ...bulkRestrictionsForm, endDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* WEEKDAYS & WEEKEND PRESETS */}
                <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11.5px",
                      fontWeight: 800,
                      border: (bulkRestrictionsForm.daysOfWeek || []).length === 7 ? "1.5px solid #0f172a" : "1px solid #cbd5e1",
                      background: (bulkRestrictionsForm.daysOfWeek || []).length === 7 ? "#f1f5f9" : "#ffffff",
                      color: (bulkRestrictionsForm.daysOfWeek || []).length === 7 ? "#0f172a" : "#475569",
                      cursor: "pointer",
                    }}
                    onClick={() => setBulkRestrictionsForm({ ...bulkRestrictionsForm, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })}
                  >
                    All Days (Mon-Sun)
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11.5px",
                      fontWeight: 800,
                      border: JSON.stringify([...(bulkRestrictionsForm.daysOfWeek || [])].sort()) === JSON.stringify([1, 2, 3, 4, 5]) ? "1.5px solid #0f172a" : "1px solid #cbd5e1",
                      background: JSON.stringify([...(bulkRestrictionsForm.daysOfWeek || [])].sort()) === JSON.stringify([1, 2, 3, 4, 5]) ? "#f1f5f9" : "#ffffff",
                      color: JSON.stringify([...(bulkRestrictionsForm.daysOfWeek || [])].sort()) === JSON.stringify([1, 2, 3, 4, 5]) ? "#0f172a" : "#475569",
                      cursor: "pointer",
                    }}
                    onClick={() => setBulkRestrictionsForm({ ...bulkRestrictionsForm, daysOfWeek: [1, 2, 3, 4, 5] })}
                  >
                    Weekdays Only (Mon-Fri)
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11.5px",
                      fontWeight: 800,
                      border: JSON.stringify([...(bulkRestrictionsForm.daysOfWeek || [])].sort()) === JSON.stringify([0, 6]) ? "1.5px solid #0f172a" : "1px solid #cbd5e1",
                      background: JSON.stringify([...(bulkRestrictionsForm.daysOfWeek || [])].sort()) === JSON.stringify([0, 6]) ? "#f1f5f9" : "#ffffff",
                      color: JSON.stringify([...(bulkRestrictionsForm.daysOfWeek || [])].sort()) === JSON.stringify([0, 6]) ? "#0f172a" : "#475569",
                      cursor: "pointer",
                    }}
                    onClick={() => setBulkRestrictionsForm({ ...bulkRestrictionsForm, daysOfWeek: [0, 6] })}
                  >
                    Weekends Only (Sat-Sun)
                  </button>
                </div>

                {/* INDIVIDUAL DAY CHECKBOXES */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  {[
                    { num: 1, label: "Mon" },
                    { num: 2, label: "Tue" },
                    { num: 3, label: "Wed" },
                    { num: 4, label: "Thu" },
                    { num: 5, label: "Fri" },
                    { num: 6, label: "Sat" },
                    { num: 0, label: "Sun" },
                  ].map((day) => {
                    const isChecked = (bulkRestrictionsForm.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(day.num);
                    return (
                      <label key={day.num} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: "700", cursor: "pointer", color: isChecked ? "#0f172a" : "#64748b" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = bulkRestrictionsForm.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
                            const next = e.target.checked
                              ? [...current, day.num]
                              : current.filter((d) => d !== day.num);
                            setBulkRestrictionsForm({ ...bulkRestrictionsForm, daysOfWeek: next });
                          }}
                        />
                        <span>{day.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* TARGET ROOM CATEGORIES */}
              <div className="rm-field-group">
                <label className="rm-field-label">2. TARGET ROOM CATEGORIES</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {roomTypes.map((rt) => {
                    const isChecked = bulkRestrictionsForm.roomTypes.includes(rt.name);
                    return (
                      <label
                        key={rt.name}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: isChecked ? "1.5px solid #0f172a" : "1px solid #cbd5e1",
                          background: isChecked ? "#f1f5f9" : "#ffffff",
                          color: isChecked ? "#0f172a" : "#475569",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...bulkRestrictionsForm.roomTypes, rt.name]
                              : bulkRestrictionsForm.roomTypes.filter((t) => t !== rt.name);
                            setBulkRestrictionsForm({ ...bulkRestrictionsForm, roomTypes: next });
                          }}
                        />
                        <span>{rt.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* TARGET OTA CHANNELS */}
              <div className="rm-field-group">
                <label className="rm-field-label">3. TARGET OTA CHANNELS</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {OTA_CHANNELS.map((ch) => {
                    const isChecked = bulkRestrictionsForm.channelKeys.includes(ch.id);
                    return (
                      <label
                        key={ch.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: isChecked ? "1.5px solid #0f172a" : "1px solid #cbd5e1",
                          background: isChecked ? "#f1f5f9" : "#ffffff",
                          color: isChecked ? "#0f172a" : "#475569",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...bulkRestrictionsForm.channelKeys, ch.id]
                              : bulkRestrictionsForm.channelKeys.filter((k) => k !== ch.id);
                            setBulkRestrictionsForm({ ...bulkRestrictionsForm, channelKeys: next });
                          }}
                        />
                        <span>{ch.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* RESTRICTIONS TO APPLY */}
              <div className="rm-field-group" style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <label className="rm-field-label" style={{ color: "#0f172a", marginBottom: "10px" }}>4. RESTRICTION RULES TO APPLY</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={bulkRestrictionsForm.stopSell}
                      onChange={(e) => setBulkRestrictionsForm({ ...bulkRestrictionsForm, stopSell: e.target.checked })}
                    />
                    <span>🔴 Stop Sell</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={bulkRestrictionsForm.cta}
                      onChange={(e) => setBulkRestrictionsForm({ ...bulkRestrictionsForm, cta: e.target.checked })}
                    />
                    <span>🚫 CTA</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={bulkRestrictionsForm.ctd}
                      onChange={(e) => setBulkRestrictionsForm({ ...bulkRestrictionsForm, ctd: e.target.checked })}
                    />
                    <span>🚪 CTD</span>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", display: "block", marginBottom: "4px" }}>Min LOS (Nights)</span>
                    <input
                      type="number"
                      min="1"
                      value={bulkRestrictionsForm.minLos}
                      onChange={(e) => setBulkRestrictionsForm({ ...bulkRestrictionsForm, minLos: e.target.value })}
                      style={{ height: "38px", borderRadius: "8px", border: "1.5px solid #cbd5e1", padding: "0 10px", fontSize: "14px", fontWeight: "800", width: "100%" }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", display: "block", marginBottom: "4px" }}>Max LOS (Nights)</span>
                    <input
                      type="number"
                      min="1"
                      value={bulkRestrictionsForm.maxLos}
                      onChange={(e) => setBulkRestrictionsForm({ ...bulkRestrictionsForm, maxLos: e.target.value })}
                      style={{ height: "38px", borderRadius: "8px", border: "1.5px solid #cbd5e1", padding: "0 10px", fontSize: "14px", fontWeight: "800", width: "100%" }}
                    />
                  </div>
                </div>
              </div>

              <div className="rm-modal-actions">
                <button type="button" className="rm-btn-cancel" onClick={() => setShowBulkRestrictionsModal(false)}>Cancel</button>
                <button type="submit" className="rm-btn-submit">Apply Restrictions &amp; Push Live ARI</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
