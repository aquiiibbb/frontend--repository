import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getRooms, getRoomTypes } from "../services/api";
import { getBusinessDate, getRatePlans } from "../services/hotelConfig";
import OtaBadge from "../components/OtaBadge";
import CustomDatePicker from "../components/CustomDatePicker";
import {
  getChannelConfig,
  saveChannelConfig,
  getChannelMappings,
  saveChannelMappings,
  getChannelRestrictions,
  saveChannelRestrictions,
  getSyncLogs,
  addSyncLog,
  clearSyncLogs,
  fetchOtaChannelCatalog,
  getStoredCatalogs,
  processIncomingOtaReservation,
  pushInventoryAndRatesToChannels,
  addCustomChannel,
  DEFAULT_CHANNELS,
} from "../services/channelManager";
import "./ConfigurationPanel.css";

export default function ChannelManager() {
  const [config, setConfig] = useState(() => getChannelConfig());
  const [mappings, setMappings] = useState(() => getChannelMappings());
  const [restrictions, setRestrictions] = useState(() => getChannelRestrictions());
  const [catalogs, setCatalogs] = useState(() => getStoredCatalogs());
  const [logs, setLogs] = useState(() => getSyncLogs());
  const [roomTypes, setRoomTypes] = useState([]);
  const [ratePlans, setRatePlans] = useState(() => getRatePlans());
  const [rooms, setRooms] = useState([]);

  const [activeSubTab, setActiveSubTab] = useState("connections"); // 'connections' | 'mapping' | 'restrictions' | 'simulator' | 'logs'
  const [toastMessage, setToastMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [fetchingChannel, setFetchingChannel] = useState("");

  // Selected Channel for Room & Rate Mapping Dropdown (Screenshot 2 fix)
  const [selectedMappingChannel, setSelectedMappingChannel] = useState("booking_com");

  // Selected Channel for Baseline Restrictions Matrix
  const [selectedRestChannel, setSelectedRestChannel] = useState("booking_com");

  // ADD NEW OTA CHANNEL MODAL STATE
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({
    name: "",
    hotelId: "",
    apiKey: "",
    markupPct: "15",
  });

  // Simulator State
  const [simChannel, setSimChannel] = useState("booking_com");
  const [simGuestName, setSimGuestName] = useState("Alexander Wright");
  const [simEmail, setSimEmail] = useState("alex.wright@booking.com");
  const [simPhone, setSimPhone] = useState("+1 555-0199");
  const [simRoomType, setSimRoomType] = useState("Deluxe Room");
  const [simCheckIn, setSimCheckIn] = useState(() => getBusinessDate());
  const [simCheckOut, setSimCheckOut] = useState(() => {
    const d = new Date(getBusinessDate() || Date.now());
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });
  const [simAmount, setSimAmount] = useState(280);
  const [simPaymentStatus, setSimPaymentStatus] = useState("Paid Online");
  const [simSubmitting, setSimSubmitting] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [rTypes, rList] = await Promise.all([getRoomTypes(), getRooms()]);
        const loadedTypes = Array.isArray(rTypes) ? rTypes : [];
        setRoomTypes(loadedTypes);
        if (loadedTypes.length > 0 && loadedTypes[0].name) {
          setSimRoomType(loadedTypes[0].name);
        }
        setRooms(Array.isArray(rList) ? rList : []);
        setRatePlans(getRatePlans());
      } catch (e) {
        console.error("Error loading room types:", e);
      }
    }
    loadInitialData();

    const handleLogUpdate = () => setLogs(getSyncLogs());
    window.addEventListener("pms_channel_log_added", handleLogUpdate);
    return () => {
      window.removeEventListener("pms_channel_log_added", handleLogUpdate);
    };
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleToggleMasterSync = () => {
    const updated = { ...config, masterEnabled: !config.masterEnabled };
    setConfig(updated);
    saveChannelConfig(updated);
    showToast(
      updated.masterEnabled
        ? "🟢 Master OTA Channel Synchronization Enabled!"
        : "🔴 Master OTA Channel Synchronization Disabled!"
    );
  };

  const handleFetchCatalog = async (chKey, hotelId) => {
    setFetchingChannel(chKey);
    try {
      const cat = await fetchOtaChannelCatalog(chKey, hotelId);
      setCatalogs(getStoredCatalogs());
      setLogs(getSyncLogs());
      showToast(
        `📥 Fetched ${cat.roomTypes.length} OTA Room Categories & ${cat.ratePlans.length} Rate Plans for Hotel ID: ${hotelId || "Default"}!`
      );
    } catch (err) {
      alert("Failed to fetch OTA catalog: " + err.message);
    } finally {
      setFetchingChannel("");
    }
  };

  const handleAddChannelSubmit = (e) => {
    e.preventDefault();
    if (!newChannelForm.name.trim()) {
      alert("Please enter an OTA Channel Name.");
      return;
    }

    const created = addCustomChannel({
      name: newChannelForm.name.trim(),
      hotelId: newChannelForm.hotelId.trim(),
      apiKey: newChannelForm.apiKey.trim(),
      markupPct: newChannelForm.markupPct,
    });

    if (created) {
      setConfig(getChannelConfig());
      setCatalogs(getStoredCatalogs());
      setLogs(getSyncLogs());
      setShowAddChannelModal(false);
      setNewChannelForm({ name: "", hotelId: "", apiKey: "", markupPct: "15" });
      showToast(`🎉 Connected new OTA Channel "${created.name}" with 2-Way Sync!`);
    }
  };

  const handleSaveConfig = (e) => {
    if (e) e.preventDefault();
    saveChannelConfig(config);
    showToast("💾 Saved Channel Connections & API Settings!");
  };

  const handleSaveMappings = (e) => {
    if (e) e.preventDefault();
    saveChannelMappings(mappings);
    showToast("💾 Saved Room & Rate Plan Mappings!");
  };

  const handleSaveRestrictions = (e) => {
    if (e) e.preventDefault();
    saveChannelRestrictions(restrictions);
    pushInventoryAndRatesToChannels();
    showToast("💾 Saved OTA Channel Restrictions & Pushed Live ARI!");
  };

  const handlePushSync = async () => {
    setSyncing(true);
    try {
      const res = await pushInventoryAndRatesToChannels();
      if (res.success) {
        setLogs(getSyncLogs());
        showToast(`⚡ Live ARI & Restrictions pushed to ${res.count} active OTA channels!`);
      } else {
        showToast(`⚠️ ${res.message}`);
      }
    } catch (err) {
      showToast(err.message || "Failed to push live sync");
    } finally {
      setSyncing(false);
    }
  };

  const handleRunSimulator = async (e) => {
    e.preventDefault();
    setSimSubmitting(true);
    try {
      const created = await processIncomingOtaReservation({
        channelKey: simChannel,
        guestName: simGuestName,
        guestEmail: simEmail,
        guestPhone: simPhone,
        roomType: simRoomType,
        checkIn: simCheckIn,
        checkOut: simCheckOut,
        amount: simAmount,
        paymentStatus: simPaymentStatus,
      });

      setLogs(getSyncLogs());
      showToast(`🎉 Simulated Incoming Reservation #${created.id || "OTA"} Created! View on Tape Chart.`);
    } catch (err) {
      alert(err.message || "Simulation failed");
    } finally {
      setSimSubmitting(false);
    }
  };

  const handleClearLogs = () => {
    if (window.confirm("Clear all channel sync audit logs?")) {
      clearSyncLogs();
      setLogs([]);
      showToast("🗑️ Channel sync logs cleared.");
    }
  };

  const activeChannelsCount = Object.values(config.channels).filter((c) => c.enabled).length;
  const channelList = Object.values(config.channels);

  return (
    <div className="config-workspace" style={{ padding: "24px", maxWidth: "1250px", margin: "0 auto" }}>
      {toastMessage && (
        <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, background: "#ffffff", color: "#1e293b", border: "1px solid #cbd5e1", padding: "12px 20px", borderRadius: "10px", fontWeight: 700, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          {toastMessage}
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", background: "#ffffff", padding: "20px 24px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#1e293b" }}>🌐 Enterprise Channel Manager &amp; OTA Sync Engine</h1>
            <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 800, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}>
              {config.masterEnabled ? `🟢 ${activeChannelsCount} Channels Live` : "⚪ Master Sync Off"}
            </span>
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
            2-Way ARI (Availability, Rates, Inventory &amp; Restrictions) Sync with Booking.com, Expedia, Agoda, Airbnb, MakeMyTrip, and custom OTA Gateways.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-lg-grey"
            style={{
              padding: "10px 16px",
              fontWeight: 700,
              fontSize: "13px",
              background: "#ffffff",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: "pointer",
            }}
            onClick={() => setShowAddChannelModal(true)}
          >
            ➕ Add New OTA Channel
          </button>

          <button
            type="button"
            className="btn-lg-grey"
            style={{
              padding: "10px 16px",
              fontWeight: 700,
              fontSize: "13px",
              background: "#ffffff",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: "pointer",
            }}
            onClick={handleToggleMasterSync}
          >
            {config.masterEnabled ? "⏸️ Disable Master Sync" : "▶️ Enable Master Sync"}
          </button>

          <button
            type="button"
            className="btn-lg-grey"
            style={{
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: "13px",
              background: "#f1f5f9",
              color: "#1e293b",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: syncing || !config.masterEnabled ? "not-allowed" : "pointer",
              opacity: syncing || !config.masterEnabled ? 0.6 : 1,
            }}
            onClick={handlePushSync}
            disabled={syncing || !config.masterEnabled}
          >
            {syncing ? "⏳ Syncing..." : "⚡ Push Live ARI Sync Now"}
          </button>
        </div>
      </div>

      {/* NAVIGATION SUB-TABS */}
      <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid #e2e8f0", marginBottom: "24px", background: "#ffffff", padding: "8px 16px 0 16px", borderRadius: "12px 12px 0 0" }}>
        <button
          type="button"
          style={{
            padding: "12px 18px",
            fontWeight: activeSubTab === "connections" ? 800 : 600,
            fontSize: "13.5px",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom: activeSubTab === "connections" ? "3px solid #64748b" : "3px solid transparent",
            color: activeSubTab === "connections" ? "#1e293b" : "#94a3b8",
          }}
          onClick={() => setActiveSubTab("connections")}
        >
          🔌 Channel Connections ({channelList.length})
        </button>
        <button
          type="button"
          style={{
            padding: "12px 18px",
            fontWeight: activeSubTab === "mapping" ? 800 : 600,
            fontSize: "13.5px",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom: activeSubTab === "mapping" ? "3px solid #64748b" : "3px solid transparent",
            color: activeSubTab === "mapping" ? "#1e293b" : "#94a3b8",
          }}
          onClick={() => setActiveSubTab("mapping")}
        >
          🗺️ Room &amp; Rate Mapping
        </button>
        <button
          type="button"
          style={{
            padding: "12px 18px",
            fontWeight: activeSubTab === "simulator" ? 800 : 600,
            fontSize: "13.5px",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom: activeSubTab === "simulator" ? "3px solid #64748b" : "3px solid transparent",
            color: activeSubTab === "simulator" ? "#1e293b" : "#94a3b8",
          }}
          onClick={() => setActiveSubTab("simulator")}
        >
          🚀 OTA Webhook Simulator
        </button>
        <button
          type="button"
          style={{
            padding: "12px 18px",
            fontWeight: activeSubTab === "logs" ? 800 : 600,
            fontSize: "13.5px",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom: activeSubTab === "logs" ? "3px solid #64748b" : "3px solid transparent",
            color: activeSubTab === "logs" ? "#1e293b" : "#94a3b8",
          }}
          onClick={() => setActiveSubTab("logs")}
        >
          📊 Sync Audit Logs ({logs.length})
        </button>
      </div>

      {/* 1. CHANNEL CONNECTIONS TAB */}
      {activeSubTab === "connections" && (
        <form onSubmit={handleSaveConfig} className="pms-card" style={{ padding: "24px", borderRadius: "16px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e293b" }}>Active OTA Channels &amp; API Credentials</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#64748b" }}>
                Enter your OTA Hotel ID and click <strong>"Fetch OTA Catalog"</strong> to auto-load channel room categories &amp; rate plans.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="btn-lg-grey"
                style={{ padding: "10px 16px", fontSize: "13px", fontWeight: 700, background: "#ffffff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer" }}
                onClick={() => setShowAddChannelModal(true)}
              >
                ➕ Add New OTA Channel
              </button>
              <button
                type="submit"
                className="btn-lg-grey"
                style={{ padding: "10px 20px", fontSize: "13px", fontWeight: 700, background: "#f1f5f9", color: "#1e293b", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer" }}
              >
                💾 Save Connections
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
            {channelList.map((ch) => (
              <div
                key={ch.id}
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  border: ch.enabled ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                  background: ch.enabled ? "#ffffff" : "#f8fafc",
                  boxShadow: ch.enabled ? "0 1px 4px rgba(0,0,0,0.03)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {/* Official OTA Company Logo SVG */}
                    <OtaBadge source={ch.name} size="md" showText={false} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1e293b" }}>{ch.name}</h3>
                      <span style={{ fontSize: "11px", color: ch.enabled ? "#475569" : "#94a3b8", fontWeight: 700 }}>
                        {ch.enabled ? "🟢 Active 2-Way Sync" : "⚪ Disabled"}
                      </span>
                    </div>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={ch.enabled}
                      onChange={(e) => {
                        const updated = {
                          ...config,
                          channels: {
                            ...config.channels,
                            [ch.id]: { ...ch, enabled: e.target.checked },
                          },
                        };
                        setConfig(updated);
                      }}
                      style={{ width: "18px", height: "18px", accentColor: "#64748b", cursor: "pointer" }}
                    />
                  </label>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px" }}>OTA Hotel ID / Extranet ID</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        value={ch.hotelId}
                        onChange={(e) => {
                          setConfig({
                            ...config,
                            channels: {
                              ...config.channels,
                              [ch.id]: { ...ch, hotelId: e.target.value },
                            },
                          });
                        }}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 700, fontFamily: "monospace", color: "#1e293b" }}
                      />
                      <button
                        type="button"
                        className="btn-lg-grey"
                        style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap", background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer" }}
                        onClick={() => handleFetchCatalog(ch.id, ch.hotelId)}
                        disabled={fetchingChannel === ch.id}
                      >
                        {fetchingChannel === ch.id ? "⏳ Fetching..." : "📥 Fetch Catalog"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px" }}>Channel API Key / Gateway Token</label>
                    <input
                      type="password"
                      value={ch.apiKey}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          channels: {
                            ...config.channels,
                            [ch.id]: { ...ch, apiKey: e.target.value },
                          },
                        });
                      }}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", fontFamily: "monospace", color: "#1e293b" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px" }}>Channel Price Markup (%)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={ch.markupPct}
                        onChange={(e) => {
                          setConfig({
                            ...config,
                            channels: {
                              ...config.channels,
                              [ch.id]: { ...ch, markupPct: Number(e.target.value || 0) },
                            },
                          });
                        }}
                        style={{ width: "90px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}
                      />
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Adds +{ch.markupPct}% markup to PMS rate.</span>
                    </div>
                  </div>

                  {catalogs[ch.id] && (
                    <div style={{ fontSize: "11.5px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "8px", color: "#475569", fontWeight: 700 }}>
                      ✅ Fetched Catalog: {catalogs[ch.id].roomTypes.length} Rooms &amp; {catalogs[ch.id].ratePlans.length} Rate Plans available for mapping.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </form>
      )}

      {/* 2. ROOM & RATE PLAN MAPPING TAB */}
      {activeSubTab === "mapping" && (
        <form onSubmit={handleSaveMappings} className="pms-card" style={{ padding: "24px", borderRadius: "16px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e293b" }}>Human-Readable Room &amp; Rate Plan Mapping</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#64748b" }}>
                Select target OTA Channel to map PMS Room Categories and Rate Plans to fetched OTA listings.
              </p>
            </div>

            <button
              type="submit"
              className="btn-lg-grey"
              style={{ padding: "10px 20px", fontSize: "13px", fontWeight: 700, background: "#f1f5f9", color: "#1e293b", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer" }}
            >
              💾 Save Mapping Rules
            </button>
          </div>

          {/* TARGET OTA CHANNEL SELECTOR DROPDOWN */}
          <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "24px", display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b" }}>Select OTA Channel to Map:</span>
            <select
              value={selectedMappingChannel}
              onChange={(e) => setSelectedMappingChannel(e.target.value)}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px", fontWeight: "700", color: "#1e293b", background: "#ffffff", minWidth: "220px" }}
            >
              {channelList.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name} (Hotel ID: {ch.hotelId || "Default"})
                </option>
              ))}
            </select>

            {catalogs[selectedMappingChannel] && (
              <span style={{ fontSize: "12px", color: "#475569", fontWeight: "700", background: "#f1f5f9", padding: "4px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                ✅ {catalogs[selectedMappingChannel].roomTypes?.length || 0} OTA Rooms &amp; {catalogs[selectedMappingChannel].ratePlans?.length || 0} Rate Plans Fetched
              </span>
            )}
          </div>

          {/* SECTION A: PMS ROOM CATEGORIES MAPPING */}
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🏢 1. Map PMS Room Categories ➔ {config.channels[selectedMappingChannel]?.name || "OTA"} Rooms</span>
            </h3>

            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
              <table className="cr-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 800, color: "#475569" }}>PMS Room Category</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 800, color: "#475569" }}>Mapped {config.channels[selectedMappingChannel]?.name} Room Listing</th>
                  </tr>
                </thead>
                <tbody>
                  {(roomTypes.length > 0 ? roomTypes : [
                    { id: "rt-1", name: "Standard Room" },
                    { id: "rt-2", name: "Deluxe Suite" },
                    { id: "rt-3", name: "Executive Suite" },
                  ]).map((rt) => {
                    const mapObj = mappings.roomMappings?.[rt.id] || {};
                    const selectedValue = mapObj[selectedMappingChannel] || "";
                    const otaRoomList = catalogs[selectedMappingChannel]?.roomTypes || [];

                    return (
                      <tr key={rt.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 800, color: "#1e293b", fontSize: "13.5px" }}>{rt.name}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <select
                            value={selectedValue}
                            onChange={(e) => {
                              setMappings({
                                ...mappings,
                                roomMappings: {
                                  ...mappings.roomMappings,
                                  [rt.id]: { ...mapObj, [selectedMappingChannel]: e.target.value },
                                },
                              });
                            }}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 700, color: "#1e293b", background: "#ffffff" }}
                          >
                            <option value="">-- Select {config.channels[selectedMappingChannel]?.name} Room Category --</option>
                            {otaRoomList.map((otaRoom) => (
                              <option key={otaRoom.id} value={otaRoom.name}>
                                {otaRoom.name} (Code: {otaRoom.otaCode})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION B: PMS RATE PLANS MAPPING */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🏷️ 2. Map PMS Rate Plans ➔ {config.channels[selectedMappingChannel]?.name || "OTA"} Rate Plans</span>
            </h3>

            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
              <table className="cr-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 800, color: "#475569" }}>PMS Rate Plan</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 800, color: "#475569" }}>Mapped {config.channels[selectedMappingChannel]?.name} Rate Plan Listing</th>
                  </tr>
                </thead>
                <tbody>
                  {(ratePlans.length > 0 ? ratePlans : [
                    { id: "rp-1", name: "Standard Daily Rate" },
                    { id: "rp-2", name: "Weekly Discount Rate" },
                    { id: "rp-3", name: "Monthly Extended Rate" },
                  ]).map((rp) => {
                    const rateMapObj = mappings.rateMappings?.[rp.id] || {};
                    const selectedRateVal = rateMapObj[selectedMappingChannel] || "";
                    const otaRateList = catalogs[selectedMappingChannel]?.ratePlans || [];

                    return (
                      <tr key={rp.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 800, color: "#1e293b", fontSize: "13.5px" }}>{rp.name}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <select
                            value={selectedRateVal}
                            onChange={(e) => {
                              setMappings({
                                ...mappings,
                                rateMappings: {
                                  ...mappings.rateMappings,
                                  [rp.id]: { ...rateMapObj, [selectedMappingChannel]: e.target.value },
                                },
                              });
                            }}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 700, color: "#1e293b", background: "#ffffff" }}
                          >
                            <option value="">-- Select {config.channels[selectedMappingChannel]?.name} Rate Plan --</option>
                            {otaRateList.map((otaRate) => (
                              <option key={otaRate.id} value={otaRate.name}>
                                {otaRate.name} (Code: {otaRate.otaCode})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      )}

      {/* 4. OTA WEBHOOK SIMULATOR TAB */}
      {activeSubTab === "simulator" && (
        <form onSubmit={handleRunSimulator} className="pms-card" style={{ padding: "24px", borderRadius: "16px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 800, color: "#1e293b" }}>🚀 OTA 2-Way Webhook Simulator</h2>
          <p style={{ margin: "0 0 20px 0", fontSize: "12.5px", color: "#64748b" }}>
            Simulate an incoming booking webhook payload from Booking.com, Expedia, Airbnb, Agoda, or MakeMyTrip to test automatic reservation creation on the Tape Chart.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>Incoming OTA Channel</label>
              <select
                value={simChannel}
                onChange={(e) => setSimChannel(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 700, color: "#1e293b", background: "#ffffff" }}
              >
                {channelList.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} (2-Way Live API)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>Guest Name</label>
              <input
                type="text"
                value={simGuestName}
                onChange={(e) => setSimGuestName(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>Check-In Date</label>
              <CustomDatePicker
                value={simCheckIn}
                onChange={(e) => setSimCheckIn(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>Check-Out Date</label>
              <CustomDatePicker
                value={simCheckOut}
                onChange={(e) => setSimCheckOut(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-lg-grey"
            style={{ padding: "12px 24px", fontSize: "13.5px", fontWeight: 700, background: "#f1f5f9", color: "#1e293b", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer" }}
            disabled={simSubmitting}
          >
            {simSubmitting ? "⏳ Processing Payload..." : "🚀 Inject Simulated Webhook Reservation"}
          </button>
        </form>
      )}

      {/* 5. SYNC AUDIT LOGS TAB */}
      {activeSubTab === "logs" && (
        <div className="pms-card" style={{ padding: "24px", borderRadius: "16px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e293b" }}>📊 2-Way Channel Sync Audit Trail</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#64748b" }}>Real-time inbound &amp; outbound ARI transaction log payloads.</p>
            </div>

            <button type="button" className="btn-lg-grey" onClick={handleClearLogs} style={{ padding: "8px 16px", fontSize: "12.5px", fontWeight: 700, background: "#ffffff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer" }}>
              🗑️ Clear Audit Logs
            </button>
          </div>

          {logs.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>No audit logs recorded yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="cr-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 800, color: "#475569" }}>Timestamp</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 800, color: "#475569" }}>Channel</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 800, color: "#475569" }}>Sync Event Type</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 800, color: "#475569" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 800, color: "#475569" }}>Transaction Payload Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((lg) => (
                    <tr key={lg.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "#64748b", fontFamily: "monospace" }}>{new Date(lg.timestamp).toLocaleString()}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 800, color: "#1e293b" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <OtaBadge source={lg.channel} size="xs" showText={false} />
                          <span>{lg.channel}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>{lg.type}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "12px", fontWeight: 700, background: lg.status === "SUCCESS" ? "#f1f5f9" : "#f8fafc", color: lg.status === "SUCCESS" ? "#475569" : "#64748b", border: "1px solid #cbd5e1" }}>
                          {lg.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12.5px", color: "#475569" }}>{lg.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ADD NEW OTA CHANNEL MODAL */}
      {showAddChannelModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(100,116,139,0.25)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "20px" }} onClick={() => setShowAddChannelModal(false)}>
          <div style={{ background: "#ffffff", width: "100%", maxWidth: "480px", borderRadius: "16px", border: "1px solid #cbd5e1", boxShadow: "0 10px 30px rgba(0,0,0,0.06)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#1e293b" }}>➕ Connect New OTA Channel</h3>
              <button type="button" style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }} onClick={() => setShowAddChannelModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddChannelSubmit} style={{ padding: "20px 24px 24px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b", display: "block", marginBottom: "4px" }}>OTA CHANNEL NAME *</label>
                <input
                  type="text"
                  placeholder="e.g. TripAdvisor, Hostaway, Vrbo, Trip.com, Goibibo"
                  value={newChannelForm.name}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, name: e.target.value })}
                  required
                  autoFocus
                  style={{ width: "100%", height: "40px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 12px", fontSize: "13.5px", fontWeight: 700, color: "#1e293b" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b", display: "block", marginBottom: "4px" }}>OTA HOTEL ID / EXTRANET ID</label>
                <input
                  type="text"
                  placeholder="e.g. TA-88219"
                  value={newChannelForm.hotelId}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, hotelId: e.target.value })}
                  style={{ width: "100%", height: "40px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 12px", fontSize: "13.5px", fontFamily: "monospace", color: "#1e293b" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b", display: "block", marginBottom: "4px" }}>CHANNEL API KEY / GATEWAY TOKEN</label>
                <input
                  type="password"
                  placeholder="e.g. sec_token_live_..."
                  value={newChannelForm.apiKey}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, apiKey: e.target.value })}
                  style={{ width: "100%", height: "40px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 12px", fontSize: "13.5px", fontFamily: "monospace", color: "#1e293b" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b", display: "block", marginBottom: "4px" }}>CHANNEL PRICE MARKUP (%)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={newChannelForm.markupPct}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, markupPct: e.target.value })}
                  style={{ width: "120px", height: "40px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 12px", fontSize: "14px", fontWeight: "800", color: "#1e293b" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn-lg-grey" onClick={() => setShowAddChannelModal(false)} style={{ padding: "10px 16px", borderRadius: "8px", background: "#ffffff", color: "#475569", border: "1px solid #cbd5e1", cursor: "pointer" }}>Cancel</button>
                <button type="submit" className="btn-lg-grey" style={{ padding: "10px 20px", borderRadius: "8px", background: "#f1f5f9", color: "#1e293b", border: "1px solid #cbd5e1", cursor: "pointer", fontWeight: 700 }}>Connect New OTA Channel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
