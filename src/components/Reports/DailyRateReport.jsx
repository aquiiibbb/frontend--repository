import React, { useState, useEffect } from "react";
import { getDailyRateReportData } from "../../services/reportAnalyticsService";

export default function DailyRateReport() {
  const [numDays, setNumDays] = useState(14);
  const [selectedRoomType, setSelectedRoomType] = useState("all");
  const [selectedRatePlan, setSelectedRatePlan] = useState("all");
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleSync = () => setTick((t) => t + 1);
    window.addEventListener("pms_daily_rates_updated", handleSync);
    window.addEventListener("pms_bookings_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("pms_daily_rates_updated", handleSync);
      window.removeEventListener("pms_bookings_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const data = getDailyRateReportData(numDays);

  const filteredMatrix = data.matrix.filter((row) => {
    if (selectedRoomType !== "all" && row.roomType !== selectedRoomType) return false;
    if (selectedRatePlan !== "all" && row.ratePlan !== selectedRatePlan) return false;
    return true;
  });

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* HEADER & CONTROLS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🏷️ Daily Rate Report</span>
            <span style={{ fontSize: "12px", color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: "12px", fontWeight: 600 }}>Room Type &amp; Rate Plan Wise</span>
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
            Day-by-day pricing matrix across all active room categories and rate plans.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* ROOM TYPE FILTER */}
          <select
            value={selectedRoomType}
            onChange={(e) => setSelectedRoomType(e.target.value)}
            style={{ height: "34px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", fontWeight: "700", color: "#0f172a", background: "#ffffff" }}
          >
            <option value="all">🏨 All Room Types ({data.roomTypes.length})</option>
            {data.roomTypes.map((rt) => (
              <option key={rt.name} value={rt.name}>{rt.name}</option>
            ))}
          </select>

          {/* RATE PLAN FILTER */}
          <select
            value={selectedRatePlan}
            onChange={(e) => setSelectedRatePlan(e.target.value)}
            style={{ height: "34px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", fontWeight: "700", color: "#0f172a", background: "#ffffff" }}
          >
            <option value="all">📋 All Rate Plans ({data.ratePlans.length})</option>
            {data.ratePlans.map((rp) => (
              <option key={rp.name} value={rp.name}>{rp.name}</option>
            ))}
          </select>

          {/* DAYS HORIZON PRESETS */}
          <div style={{ display: "flex", gap: "4px" }}>
            {[7, 14, 30, 60].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setNumDays(days)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 800,
                  border: numDays === days ? "1px solid #475569" : "1px solid #cbd5e1",
                  background: numDays === days ? "#e2e8f0" : "#ffffff",
                  color: numDays === days ? "#0f172a" : "#475569",
                  cursor: "pointer",
                }}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Forecast Horizon</span>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>Next {numDays} Days</div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Total Matrix Combinations</span>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>{filteredMatrix.length} Rows</div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Avg Horizon Rate</span>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>{formatCurrency(data.avgGlobalRate)}</div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Highest Peak Rate</span>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#059669", marginTop: "2px" }}>{formatCurrency(data.highestPeakRate)}</div>
        </div>
      </div>

      {/* DAILY RATES MATRIX TABLE */}
      <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#ffffff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
          <thead>
            <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#0f172a", minWidth: "160px" }}>Room Category</th>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#0f172a", minWidth: "120px" }}>Rate Plan</th>
              <th style={{ padding: "10px 12px", textAlign: "right", color: "#0f172a", minWidth: "100px" }}>Base Rate</th>
              {data.dates.map((d) => {
                const isWeekend = d.dayName === "Sat" || d.dayName === "Sun";
                return (
                  <th key={d.date} style={{ padding: "8px 10px", textAlign: "center", color: isWeekend ? "#1e293b" : "#475569", background: isWeekend ? "#e2e8f0" : "transparent", minWidth: "75px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800 }}>{d.date.slice(5)}</div>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: isWeekend ? "#0f172a" : "#64748b" }}>{d.dayName}</div>
                  </th>
                );
              })}
              <th style={{ padding: "10px 12px", textAlign: "right", color: "#0f172a", minWidth: "100px", background: "#f8fafc" }}>Avg Rate</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatrix.length === 0 ? (
              <tr>
                <td colSpan={data.dates.length + 4} style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                  No rate plan combinations match the selected filters.
                </td>
              </tr>
            ) : (
              filteredMatrix.map((row, idx) => (
                <tr key={`${row.roomType}_${row.ratePlan}`} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>
                    🏨 {row.roomType}
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>
                    <span style={{ background: "#e2e8f0", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", color: "#0f172a", marginRight: "6px" }}>{row.code}</span>
                    {row.ratePlan}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#64748b" }}>
                    {formatCurrency(row.baseRate)}
                  </td>
                  {data.dates.map((d) => {
                    const price = row.dailyRates[d.date];
                    const isWeekend = d.dayName === "Sat" || d.dayName === "Sun";
                    return (
                      <td key={d.date} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#0f172a", background: isWeekend ? "#f1f5f9" : "transparent" }}>
                        {formatCurrency(price)}
                      </td>
                    );
                  })}
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 900, color: "#0f172a", background: "#f8fafc" }}>
                    {formatCurrency(row.avgRate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
