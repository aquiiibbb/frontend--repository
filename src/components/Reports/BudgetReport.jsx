import { dataStore } from "../../services/dataStore";
import React, { useState, useEffect, useMemo } from "react";
import { getBusinessDate, getSellableRooms, getRoomsList } from "../../services/hotelConfig";

function getSystemBookings() {
  let list = [];
  try {
    const raw = dataStore.getItem("hotelpms_bookings_v3") || dataStore.getItem("hotelpms_bookings_v1");
    if (raw) list = JSON.parse(raw);
  } catch (e) {}


  return (list || []).filter(
    (b) =>
      b &&
      !b.folioDeleted &&
      !b.isDeleted &&
      !b.folioCleared &&
      b.status !== "Deleted" &&
      b.status !== "deleted"
  );
}

function getSystemTotalRooms() {
  try {
    const sellable = getSellableRooms();
    if (Array.isArray(sellable) && sellable.length > 0) return sellable.length;
    const saved = dataStore.getItem("hotelpms_room_numbers_v3") || dataStore.getItem("hotelpms_rooms_v1");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.length;
    }
  } catch (e) {}
  return getRoomsList().length || 1;
}

function parseDateSafely(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const parts = s.slice(0, 10).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const parts = s.split("/").map(Number);
    return new Date(parts[2], parts[0] - 1, parts[1]);
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
}

function getStoredTargets() {
  try {
    const raw = dataStore.getItem("hotelpms_budget_targets_v1");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

export default function BudgetReport() {
  const [selectedYear, setSelectedYear] = useState(() => {
    const bDate = getBusinessDate() || new Date().toISOString().slice(0, 10);
    return parseInt(bDate.slice(0, 4), 10) || 2026;
  });

  const priorYear = selectedYear - 1;

  const [allBookings, setAllBookings] = useState(() => getSystemBookings());
  const [totalRoomsCount, setTotalRoomsCount] = useState(() => getSystemTotalRooms());
  const [targetsMap, setTargetsMap] = useState(() => getStoredTargets());

  useEffect(() => {
    const loadData = () => {
      setAllBookings(getSystemBookings());
      setTotalRoomsCount(getSystemTotalRooms());
      setTargetsMap(getStoredTargets());
    };
    window.addEventListener("pms_bookings_updated", loadData);
    window.addEventListener("storage", loadData);
    return () => {
      window.removeEventListener("pms_bookings_updated", loadData);
      window.removeEventListener("storage", loadData);
    };
  }, []);

  const updateTarget = (yr, monthIdx, val) => {
    const numVal = val === "" ? "" : Math.max(0, Number(val));
    const newMap = {
      ...targetsMap,
      [yr]: {
        ...(targetsMap[yr] || {}),
        [monthIdx]: numVal,
      },
    };
    setTargetsMap(newMap);
    try {
      dataStore.setItem("hotelpms_budget_targets_v1", JSON.stringify(newMap));
    } catch (e) {}
  };

  const getTargetVal = (yr, monthIdx) => {
    const yearObj = targetsMap[yr];
    if (!yearObj) return "";
    const val = yearObj[monthIdx];
    return val !== undefined && val !== null ? val : "";
  };

  const renderVarianceBadge = (actualRev, targetVal) => {
    if (targetVal === "" || targetVal === null || targetVal === undefined) {
      return <span style={{ color: "#64748b" }}>$0.00</span>;
    }
    const targetNum = Number(targetVal) || 0;
    if (targetNum === 0 && actualRev === 0) {
      return <span style={{ color: "#64748b" }}>$0.00</span>;
    }

    const diff = actualRev - targetNum;
    const isPositive = diff >= 0;
    const color = isPositive ? "#15803d" : "#b91c1c";
    const bg = isPositive ? "#f0fdf4" : "#fef2f2";
    const borderColor = isPositive ? "#bbf7d0" : "#fecaca";
    const sign = isPositive ? "+$" : "-$";

    const formattedAbs = Math.abs(diff).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: 800,
          color,
          background: bg,
          border: `1px solid ${borderColor}`,
        }}
      >
        {sign}{formattedAbs}
      </span>
    );
  };

  const renderTargetInput = (yr, monthIdx) => {
    const val = getTargetVal(yr, monthIdx);
    return (
      <input
        type="number"
        min="0"
        step="500"
        placeholder="0"
        value={val}
        onChange={(e) => updateTarget(yr, monthIdx, e.target.value)}
        style={{
          width: "95px",
          padding: "4px 8px",
          borderRadius: "6px",
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          fontSize: "12.5px",
          fontWeight: "700",
          color: "#0f172a",
          textAlign: "right",
          outline: "none",
        }}
      />
    );
  };

  const monthsList = [
    { name: "January", monthIndex: 0, days: 31 },
    { name: "February", monthIndex: 1, days: 28 },
    { name: "March", monthIndex: 2, days: 31 },
    { name: "April", monthIndex: 3, days: 30 },
    { name: "May", monthIndex: 4, days: 31 },
    { name: "June", monthIndex: 5, days: 30 },
    { name: "July", monthIndex: 6, days: 31 },
    { name: "August", monthIndex: 7, days: 31 },
    { name: "September", monthIndex: 8, days: 30 },
    { name: "October", monthIndex: 9, days: 31 },
    { name: "November", monthIndex: 10, days: 30 },
    { name: "December", monthIndex: 11, days: 31 },
  ];

  function getDaysInMonth(year, monthIdx) {
    return new Date(year, monthIdx + 1, 0).getDate();
  }

  // Calculate monthly stats for a given year
  const calculateYearStats = (year) => {
    return monthsList.map((m) => {
      const daysCount = getDaysInMonth(year, m.monthIndex);
      const totalAvailableRoomNights = totalRoomsCount * daysCount;

      let roomsSold = 0;
      let totalRev = 0;

      (allBookings || []).forEach((b) => {
        if (!b) return;
        const status = String(b.status || "").toLowerCase().trim();
        if (status.includes("cancel") || status.includes("no-show") || status.includes("noshow") || status.includes("delete")) return;

        const cInRaw = b.checkIn || b.startDate || b.arrivalDate || "";
        const cOutRaw = b.checkOut || b.endDate || b.departureDate || "";

        const startDate = parseDateSafely(cInRaw);
        const endDate = parseDateSafely(cOutRaw);

        if (!startDate || !endDate || startDate >= endDate) return;

        const diffMs = endDate.getTime() - startDate.getTime();
        const stayNights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

        const bookingRoomRev = Number(
          b.subtotal ||
          b.roomRevenue ||
          (b.ratePerNight ? b.ratePerNight * stayNights : null) ||
          (b.rate ? b.rate * stayNights : null) ||
          b.totalAmount ||
          b.amount ||
          100
        );

        const nightlyRate = bookingRoomRev / stayNights;

        let curr = new Date(startDate);
        while (curr < endDate) {
          if (curr.getFullYear() === year && curr.getMonth() === m.monthIndex) {
            roomsSold++;
            totalRev += nightlyRate;
          }
          curr.setDate(curr.getDate() + 1);
        }
      });

      const occPct = totalAvailableRoomNights > 0 ? Math.round((roomsSold / totalAvailableRoomNights) * 100) : 0;
      const adr = roomsSold > 0 ? totalRev / roomsSold : 0;

      return {
        month: m.name,
        roomsSold,
        occPct,
        adr,
        roomRev: totalRev,
        totalAvailableRoomNights,
      };
    });
  };

  const priorYearMonthly = useMemo(() => calculateYearStats(priorYear), [priorYear, allBookings, totalRoomsCount]);
  const currentYearMonthly = useMemo(() => calculateYearStats(selectedYear), [selectedYear, allBookings, totalRoomsCount]);

  // Year Totals
  const priorYearTotals = useMemo(() => {
    const totalSold = priorYearMonthly.reduce((acc, m) => acc + m.roomsSold, 0);
    const totalRev = priorYearMonthly.reduce((acc, m) => acc + m.roomRev, 0);
    const totalAvail = priorYearMonthly.reduce((acc, m) => acc + m.totalAvailableRoomNights, 0);
    const totalOccPct = totalAvail > 0 ? Math.round((totalSold / totalAvail) * 100) : 0;
    const totalAdr = totalSold > 0 ? totalRev / totalSold : 0;
    const totalTarget = monthsList.reduce((acc, m, idx) => {
      const t = getTargetVal(priorYear, idx);
      return acc + (Number(t) || 0);
    }, 0);
    return { totalSold, totalOccPct, totalAdr, totalRev, totalTarget };
  }, [priorYearMonthly, priorYear, targetsMap]);

  const currentYearTotals = useMemo(() => {
    const totalSold = currentYearMonthly.reduce((acc, m) => acc + m.roomsSold, 0);
    const totalRev = currentYearMonthly.reduce((acc, m) => acc + m.roomRev, 0);
    const totalAvail = currentYearMonthly.reduce((acc, m) => acc + m.totalAvailableRoomNights, 0);
    const totalOccPct = totalAvail > 0 ? Math.round((totalSold / totalAvail) * 100) : 0;
    const totalAdr = totalSold > 0 ? totalRev / totalSold : 0;
    const totalTarget = monthsList.reduce((acc, m, idx) => {
      const t = getTargetVal(selectedYear, idx);
      return acc + (Number(t) || 0);
    }, 0);
    return { totalSold, totalOccPct, totalAdr, totalRev, totalTarget };
  }, [currentYearMonthly, selectedYear, targetsMap]);

  return (
    <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
      {/* HEADER CONTROLS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>
            📈 Annual Budget & Target Comparison Report
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
            Year-over-Year monthly comparison of Rooms Sold, Occupancy %, ADR, Room Revenue, Revenue Target, and Performance Variance.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontSize: "13px", fontWeight: "700", color: "#334155" }}>Select Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "13.5px", fontWeight: "700", color: "#0f172a", cursor: "pointer" }}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* BUDGET COMPARISON TABLE */}
      <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", fontSize: "13px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
          <thead>
            {/* TOP HEADER ROW: YEARS */}
            <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #cbd5e1" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "800", color: "#0f172a", width: "130px", borderRight: "1px solid #e2e8f0" }}>
                Month
              </th>
              <th colSpan={6} style={{ padding: "10px 16px", textAlign: "center", fontWeight: "800", color: "#0f172a", background: "#fef9c3", borderRight: "1.5px solid #cbd5e1" }}>
                {priorYear} (Actual vs Target)
              </th>
              <th colSpan={6} style={{ padding: "10px 16px", textAlign: "center", fontWeight: "800", color: "#0f172a", background: "#f1f5f9" }}>
                {selectedYear} (Actual vs Target)
              </th>
            </tr>

            {/* SECOND HEADER ROW: METRIC COLUMNS */}
            <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              <th style={{ padding: "10px 16px", textAlign: "left", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Month</th>

              {/* PRIOR YEAR COLUMNS */}
              <th style={{ padding: "10px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Rooms Sold</th>
              <th style={{ padding: "10px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Occ %</th>
              <th style={{ padding: "10px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>ADR ($)</th>
              <th style={{ padding: "10px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Room Rev ($)</th>
              <th style={{ padding: "10px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Target ($)</th>
              <th style={{ padding: "10px 10px", borderRight: "1.5px solid #cbd5e1", color: "#475569" }}>Variance ($)</th>

              {/* CURRENT YEAR COLUMNS */}
              <th style={{ padding: "10px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Rooms Sold</th>
              <th style={{ padding: "10px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Occ %</th>
              <th style={{ padding: "10px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>ADR ($)</th>
              <th style={{ padding: "10px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Room Rev ($)</th>
              <th style={{ padding: "10px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Target ($)</th>
              <th style={{ padding: "10px 10px", color: "#475569" }}>Variance ($)</th>
            </tr>
          </thead>

          <tbody>
            {monthsList.map((m, idx) => {
              const py = priorYearMonthly[idx];
              const cy = currentYearMonthly[idx];

              return (
                <tr key={m.name} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ padding: "10px 16px", textAlign: "left", fontWeight: "700", color: "#0f172a", borderRight: "1px solid #e2e8f0" }}>
                    {m.name}
                  </td>

                  {/* PRIOR YEAR METRICS */}
                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e2e8f0", color: "#334155", fontWeight: "600" }}>
                    {py.roomsSold || 0}
                  </td>
                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a", fontWeight: "700" }}>
                    {py.occPct}%
                  </td>
                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e2e8f0", color: "#334155", fontWeight: "600" }}>
                    ${py.adr.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a", fontWeight: "700" }}>
                    ${py.roomRev.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                    {renderTargetInput(priorYear, idx)}
                  </td>
                  <td style={{ padding: "6px 8px", borderRight: "1.5px solid #cbd5e1", textAlign: "right" }}>
                    {renderVarianceBadge(py.roomRev, getTargetVal(priorYear, idx))}
                  </td>

                  {/* CURRENT YEAR METRICS */}
                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e2e8f0", color: "#334155", fontWeight: "600" }}>
                    {cy.roomsSold || 0}
                  </td>
                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a", fontWeight: "700" }}>
                    {cy.occPct}%
                  </td>
                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e2e8f0", color: "#334155", fontWeight: "600" }}>
                    ${cy.adr.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a", fontWeight: "700" }}>
                    ${cy.roomRev.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                    {renderTargetInput(selectedYear, idx)}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    {renderVarianceBadge(cy.roomRev, getTargetVal(selectedYear, idx))}
                  </td>
                </tr>
              );
            })}

            {/* TOTAL SUMMARY ROW */}
            <tr style={{ background: "#f1f5f9", borderTop: "2.5px solid #0f172a", fontWeight: "800", fontSize: "13.5px" }}>
              <td style={{ padding: "12px 16px", textAlign: "left", color: "#0f172a", borderRight: "1px solid #e2e8f0" }}>
                Total
              </td>

              {/* PRIOR YEAR TOTALS */}
              <td style={{ padding: "12px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                {priorYearTotals.totalSold}
              </td>
              <td style={{ padding: "12px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                {priorYearTotals.totalOccPct}%
              </td>
              <td style={{ padding: "12px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                ${priorYearTotals.totalAdr.toFixed(2)}
              </td>
              <td style={{ padding: "12px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                ${priorYearTotals.totalRev.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: "12px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                ${priorYearTotals.totalTarget.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: "12px 12px", borderRight: "1.5px solid #cbd5e1", textAlign: "right" }}>
                {renderVarianceBadge(priorYearTotals.totalRev, priorYearTotals.totalTarget)}
              </td>

              {/* CURRENT YEAR TOTALS */}
              <td style={{ padding: "12px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                {currentYearTotals.totalSold}
              </td>
              <td style={{ padding: "12px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                {currentYearTotals.totalOccPct}%
              </td>
              <td style={{ padding: "12px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                ${currentYearTotals.totalAdr.toFixed(2)}
              </td>
              <td style={{ padding: "12px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                ${currentYearTotals.totalRev.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: "12px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                ${currentYearTotals.totalTarget.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: "12px 12px", textAlign: "right" }}>
                {renderVarianceBadge(currentYearTotals.totalRev, currentYearTotals.totalTarget)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
