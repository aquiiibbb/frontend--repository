import React, { useState, useEffect } from "react";
import { getOccupancyForecastData } from "../../services/reportAnalyticsService";

export default function OccupancyForecastReport() {
  const [numDays, setNumDays] = useState(30);
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleSync = () => setTick((t) => t + 1);
    window.addEventListener("pms_bookings_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("pms_bookings_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const data = getOccupancyForecastData(numDays);

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalOtb = data.reduce((acc, d) => acc + d.otbRevenue, 0);
  const avgOcc = data.reduce((acc, d) => acc + d.occPercent, 0) / (data.length || 1);

  return (
    <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
            📅 30 / 60 / 90-Day Occupancy &amp; Revenue Forecast
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
            Forward-looking pacing, On-The-Books (OTB) revenue, and projected occupancy.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {[30, 60, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setNumDays(days)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 800,
                border: numDays === days ? "1.5px solid #0f172a" : "1px solid #cbd5e1",
                background: numDays === days ? "#f1f5f9" : "#ffffff",
                color: numDays === days ? "#0f172a" : "#475569",
                cursor: "pointer",
              }}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* SUMMARY BANNER */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Forecast Horizon</span>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>Next {numDays} Days</div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Avg Projected Occupancy</span>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>{avgOcc.toFixed(1)}%</div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Total On-The-Books (OTB) Revenue</span>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>{formatCurrency(totalOtb)}</div>
        </div>
      </div>

      {/* FORECAST TABLE */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a" }}>Date</th>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a" }}>Day</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Available Rooms</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Booked Rooms</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Occupancy %</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>OTB Revenue</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Projected ADR</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                <td style={{ padding: "8px 10px", fontWeight: 800, color: "#0f172a" }}>{row.date}</td>
                <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.dayName}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{row.available}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>{row.booked}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>
                  <span style={{ fontWeight: 800, color: row.occPercent >= 80 ? "#15803d" : "#0f172a" }}>
                    {row.occPercent.toFixed(1)}%
                  </span>
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                  {formatCurrency(row.otbRevenue)}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748b" }}>
                  {formatCurrency(row.projAdr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
