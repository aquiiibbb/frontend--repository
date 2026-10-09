import { dataStore } from "../../services/dataStore";
import React, { useState, useEffect, useMemo } from "react";
import { getBusinessDate, formatMMDDYYYY } from "../../services/hotelConfig";
import CustomDatePicker from "../CustomDatePicker";
import { Search, Filter, ShieldCheck, UserCheck, Key, Settings, DollarSign, Calendar, RefreshCw } from "lucide-react";

// Default realistic sample audit logs to seed if empty
const SEED_SYSTEM_AUDIT_LOGS = [
  {
    id: "sal_101",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    user: "john_manager",
    role: "General Manager",
    module: "Security & Auth",
    action: "User Login",
    details: "User 'john_manager' logged in successfully from Workstation-01.",
    status: "success",
    ipAddress: "192.168.1.102"
  },
  {
    id: "sal_102",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    user: "admin",
    role: "System Admin",
    module: "User Security",
    action: "Password Updated",
    details: "Security credentials and password updated for account 'sarah_desk'.",
    status: "security",
    ipAddress: "192.168.1.100"
  },
  {
    id: "sal_103",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    user: "john_manager",
    role: "General Manager",
    module: "System Configuration",
    action: "Configuration Updated",
    details: "Hotel policy & tax rule updated: Occupancy tax set to 12.0%, checkout time 11:00 AM.",
    status: "success",
    ipAddress: "192.168.1.102"
  },
  {
    id: "sal_104",
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    user: "sarah_desk",
    role: "Front Desk Supervisor",
    module: "Rates & Inventory",
    action: "Rate Matrix Updated",
    details: "Deluxe King rate updated from $120.00 to $135.00/night for upcoming Weekend surge.",
    status: "success",
    ipAddress: "192.168.1.105"
  },
  {
    id: "sal_108",
    createdAt: new Date(Date.now() - 1000 * 60 * 960).toISOString(),
    user: "admin",
    role: "System Admin",
    module: "Security & Auth",
    action: "User Logout",
    details: "User 'admin' logged out from session.",
    status: "success",
    ipAddress: "192.168.1.100"
  },
  {
    id: "sal_109",
    createdAt: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
    user: "john_manager",
    role: "General Manager",
    module: "Rates & Inventory",
    action: "Restrictions Updated",
    details: "Set Minimum Stay restriction (2 nights) on Suite room types for Holiday Season.",
    status: "success",
    ipAddress: "192.168.1.102"
  }
];

export default function SystemAuditReport() {
  const [logs, setLogs] = useState(() => {
    try {
      const saved = dataStore.getItem("hotelpms_audit_logs_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return SEED_SYSTEM_AUDIT_LOGS;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");
  const [fromDateISO, setFromDateISO] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDateISO, setToDateISO] = useState(() => getBusinessDate() || new Date().toISOString().slice(0, 10));

  // Reload logs on real-time events
  const refreshLogs = () => {
    try {
      const saved = dataStore.getItem("hotelpms_audit_logs_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLogs(parsed);
          return;
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    window.addEventListener("pms_bookings_updated", refreshLogs);
    window.addEventListener("pms_audit_logs_updated", refreshLogs);
    window.addEventListener("storage", refreshLogs);
    return () => {
      window.removeEventListener("pms_bookings_updated", refreshLogs);
      window.removeEventListener("pms_audit_logs_updated", refreshLogs);
      window.removeEventListener("storage", refreshLogs);
    };
  }, []);

  // List of unique users for filter dropdown
  const uniqueUsers = useMemo(() => {
    const set = new Set();
    (Array.isArray(logs) ? logs : []).filter(Boolean).forEach((l) => {
      if (l && l.user) set.add(l.user);
    });
    return Array.from(set);
  }, [logs]);

  // Combined logs: Combine real logged audit events with SEED_SYSTEM_AUDIT_LOGS
  const allLogsList = useMemo(() => {
    const rawSaved = (Array.isArray(logs) ? logs : []).filter(Boolean);
    const existingIds = new Set(rawSaved.map((l) => l.id));
    const extraSeeds = (Array.isArray(SEED_SYSTEM_AUDIT_LOGS) ? SEED_SYSTEM_AUDIT_LOGS : []).filter(
      (s) => s && !existingIds.has(s.id)
    );
    return [...rawSaved, ...extraSeeds];
  }, [logs]);

  // Filter out operational booking/folio/deposit logs, retaining ONLY IT/System/Security logs
  const systemLogsOnly = useMemo(() => {
    return allLogsList.filter((log) => {
      if (!log || typeof log !== "object") return false;
      const mod = String(log.module || "").toLowerCase();
      const act = String(log.action || log.actionTitle || "").toLowerCase();
      const det = String(log.details || log.payload || "").toLowerCase();

      if (
        mod.includes("booking") ||
        mod.includes("folio") ||
        mod.includes("deposit") ||
        mod.includes("charge") ||
        act.includes("booking") ||
        act.includes("charge") ||
        act.includes("deposit") ||
        act.includes("refund") ||
        det.includes("extra charge") ||
        det.includes("security deposit") ||
        det.includes("booking details")
      ) {
        return false;
      }
      return true;
    });
  }, [allLogsList]);

  // Compute filtered logs
  const filteredLogs = useMemo(() => {
    return systemLogsOnly.filter((log) => {
      if (!log) return false;
      // Date filter
      const logDateISO = String(log.createdAt || log.timestamp || "").slice(0, 10);
      if (fromDateISO && logDateISO < fromDateISO) return false;
      if (toDateISO && logDateISO > toDateISO) return false;

      // Module filter
      if (selectedModule !== "all") {
        const logMod = String(log.module || "").toLowerCase();
        if (!logMod.includes(selectedModule.toLowerCase())) return false;
      }

      // Status filter
      if (selectedStatus !== "all") {
        const logStat = String(log.status || "").toLowerCase();
        if (logStat !== selectedStatus.toLowerCase()) return false;
      }

      // User filter
      if (selectedUser !== "all") {
        if (String(log.user || "").toLowerCase() !== selectedUser.toLowerCase()) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUser = String(log.user || "").toLowerCase().includes(q);
        const matchRole = String(log.role || "").toLowerCase().includes(q);
        const matchAction = String(log.action || "").toLowerCase().includes(q);
        const matchDetails = String(log.details || "").toLowerCase().includes(q);
        const matchModule = String(log.module || "").toLowerCase().includes(q);

        if (!matchUser && !matchRole && !matchAction && !matchDetails && !matchModule) {
          return false;
        }
      }

      return true;
    });
  }, [systemLogsOnly, searchQuery, selectedModule, selectedStatus, selectedUser, fromDateISO, toDateISO]);

  // KPI Summary Calculations
  const stats = useMemo(() => {
    let loginsCount = 0;
    let securityCount = 0;
    let configCount = 0;
    let ratesCount = 0;

    systemLogsOnly.forEach((l) => {
      if (!l) return;
      const act = String(l.action || l.details || "").toLowerCase();
      const mod = String(l.module || "").toLowerCase();

      if (act.includes("login") || act.includes("logout") || mod.includes("auth")) loginsCount++;
      else if (act.includes("password") || act.includes("credential") || act.includes("security") || mod.includes("security")) securityCount++;
      else if (act.includes("config") || act.includes("tax") || act.includes("policy") || mod.includes("config")) configCount++;
      else if (act.includes("rate") || act.includes("matrix") || act.includes("price") || mod.includes("rate")) ratesCount++;
    });

    return {
      total: systemLogsOnly.length,
      loginsCount,
      securityCount,
      configCount,
      ratesCount,
    };
  }, [systemLogsOnly]);

  const formatDateDisplay = (isoStr) => {
    if (!isoStr) return "N/A";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);

    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const formattedHours = String(hours).padStart(2, "0");

    return `${mm}/${dd}/${yyyy}, ${formattedHours}:${minutes}:${seconds} ${ampm}`;
  };

  const getModuleBadgeStyle = (modStr) => {
    const mod = String(modStr || "").toLowerCase();
    if (mod.includes("security") || mod.includes("auth")) return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "🔐" };
    if (mod.includes("config")) return { bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff", icon: "⚙️" };
    if (mod.includes("rate")) return { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", icon: "🏷️" };
    if (mod.includes("booking") || mod.includes("front")) return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", icon: "🛎️" };
    if (mod.includes("folio") || mod.includes("payment")) return { bg: "#ecfeff", color: "#0891b2", border: "#a5f3fc", icon: "💳" };
    if (mod.includes("night")) return { bg: "#f8fafc", color: "#475569", border: "#cbd5e1", icon: "🌙" };
    return { bg: "#f1f5f9", color: "#334155", border: "#cbd5e1", icon: "📋" };
  };

  return (
    <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* HEADER TITLE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldCheck size={20} color="#0f172a" />
            System Audit &amp; User Activity Report
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
            Complete audit trail tracking user logins, password changes, system configuration updates, and rate modifications.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshLogs}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "12.5px",
            fontWeight: 800,
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            color: "#0f172a",
            cursor: "pointer"
          }}
        >
          <RefreshCw size={14} /> Refresh Trail
        </button>
      </div>

      {/* STATS BANNER */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <ShieldCheck size={14} color="#64748b" />
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Total System Logs</span>
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#0f172a", marginTop: "4px" }}>{stats.total}</div>
          <span style={{ fontSize: "11.5px", color: "#64748b" }}>Audit records tracked</span>
        </div>

        <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <UserCheck size={14} color="#1d4ed8" />
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>User Logins &amp; Auth</span>
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#1d4ed8", marginTop: "4px" }}>{stats.loginsCount}</div>
          <span style={{ fontSize: "11.5px", color: "#64748b" }}>Login &amp; logout sessions</span>
        </div>

        <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Key size={14} color="#b91c1c" />
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Password &amp; Security</span>
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#b91c1c", marginTop: "4px" }}>{stats.securityCount}</div>
          <span style={{ fontSize: "11.5px", color: "#64748b" }}>Credential &amp; security edits</span>
        </div>

        <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Settings size={14} color="#7e22ce" />
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Config &amp; System</span>
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#7e22ce", marginTop: "4px" }}>{stats.configCount}</div>
          <span style={{ fontSize: "11.5px", color: "#64748b" }}>Property &amp; tax settings</span>
        </div>

        <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <DollarSign size={14} color="#15803d" />
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Rates &amp; Inventory</span>
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#15803d", marginTop: "4px" }}>{stats.ratesCount}</div>
          <span style={{ fontSize: "11.5px", color: "#64748b" }}>Tariff &amp; restriction changes</span>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        {/* Search Input */}
        <div style={{ position: "relative", minWidth: "220px", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Search user, action, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: "32px",
              paddingRight: "10px",
              paddingTop: "7px",
              paddingBottom: "7px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "12.5px",
              outline: "none"
            }}
          />
        </div>

        {/* Module Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Module:</span>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", background: "#ffffff", color: "#0f172a" }}
          >
            <option value="all">All Modules</option>
            <option value="security">Security &amp; Auth</option>
            <option value="user">User Management</option>
            <option value="config">System Configuration</option>
            <option value="rate">Rates &amp; Inventory</option>
          </select>
        </div>

        {/* User Filter Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>User:</span>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", background: "#ffffff", color: "#0f172a" }}
          >
            <option value="all">All Users</option>
            {uniqueUsers.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* From Date */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>From:</span>
          <div style={{ width: "135px" }}>
            <CustomDatePicker value={fromDateISO} onChange={(e) => setFromDateISO(e.target.value)} />
          </div>
        </div>

        {/* To Date */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>To:</span>
          <div style={{ width: "135px" }}>
            <CustomDatePicker value={toDateISO} onChange={(e) => setToDateISO(e.target.value)} />
          </div>
        </div>
      </div>

      {/* SYSTEM AUDIT LOGS TABLE */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a", fontWeight: 800 }}>Timestamp (MM/DD/YYYY)</th>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a", fontWeight: 800 }}>User &amp; Staff Role</th>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a", fontWeight: 800 }}>System Module</th>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a", fontWeight: 800 }}>Action Title</th>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a", fontWeight: 800 }}>Audit Details Payload</th>
              <th style={{ padding: "10px", textAlign: "center", color: "#0f172a", fontWeight: 800 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                  No system audit records found matching your filters.
                </td>
              </tr>
            ) : (
              filteredLogs.map((row, idx) => {
                const badge = getModuleBadgeStyle(row.module);
                const isWarn = row.status === "warning" || row.status === "security";
                const isErr = row.status === "error";

                return (
                  <tr key={row.id || idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    {/* Timestamp */}
                    <td style={{ padding: "10px", color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {formatDateDisplay(row.createdAt || row.timestamp)}
                    </td>

                    {/* User & Role */}
                    <td style={{ padding: "10px", color: "#0f172a" }}>
                      <div style={{ fontWeight: 800 }}>{row.user || "System"}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{row.role || "Staff Member"}</div>
                    </td>

                    {/* Module */}
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 800,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}
                      >
                        {badge.icon} {row.module || "General"}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: "10px", fontWeight: 800, color: "#0f172a" }}>
                      {row.action || "System Action"}
                    </td>

                    {/* Details Payload */}
                    <td style={{ padding: "10px", color: "#334155", maxWidth: "380px", lineHeight: "1.4" }}>
                      {row.details || row.logDetails || "No additional payload recorded."}
                      {row.ipAddress && (
                        <span style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                          IP: {row.ipAddress}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 800,
                          background: isErr ? "#fef2f2" : isWarn ? "#fffbebe1" : "#f0fdf4",
                          color: isErr ? "#b91c1c" : isWarn ? "#b45309" : "#15803d",
                          border: `1px solid ${isErr ? "#fca5a5" : isWarn ? "#fde68a" : "#bbf7d0"}`
                        }}
                      >
                        {isErr ? "🚨 ERROR" : isWarn ? "⚠️ SECURITY" : "✅ SUCCESS"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
