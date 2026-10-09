import React, { useState, useEffect } from "react";
import { getChannelProductionData } from "../../services/reportAnalyticsService";

export default function ChannelProductionReport() {
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

  const channels = getChannelProductionData();

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalGross = channels.reduce((acc, c) => acc + c.grossRev, 0);
  const totalNet = channels.reduce((acc, c) => acc + c.netRev, 0);
  const totalComm = channels.reduce((acc, c) => acc + c.commAmt, 0);

  return (
    <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
          🌐 OTA Channel Production &amp; Net Revenue Report
        </h3>
        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
          Source distribution, Gross vs. Net Revenue after estimated OTA commissions.
        </p>
      </div>

      {/* SUMMARY BANNER */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Gross Channel Revenue</span>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>{formatCurrency(totalGross)}</div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Estimated Commissions</span>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#b91c1c", marginTop: "2px" }}>-{formatCurrency(totalComm)}</div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Net Hotel Revenue</span>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#15803d", marginTop: "2px" }}>{formatCurrency(totalNet)}</div>
        </div>
      </div>

      {/* PRODUCTION TABLE */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a" }}>Booking Channel / Source</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Reservations</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Room Nights Sold</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Avg LOS (Nights)</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Gross Revenue</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Comm %</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#b91c1c" }}>Commission ($)</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#15803d" }}>Net Revenue ($)</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                <td style={{ padding: "10px", fontWeight: 800, color: "#0f172a" }}>{row.name}</td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>{row.bookings}</td>
                <td style={{ padding: "10px", textAlign: "right" }}>{row.nights}</td>
                <td style={{ padding: "10px", textAlign: "right", color: "#64748b" }}>{row.alos.toFixed(1)}</td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>{formatCurrency(row.grossRev)}</td>
                <td style={{ padding: "10px", textAlign: "right", color: "#64748b" }}>{row.commPercent}%</td>
                <td style={{ padding: "10px", textAlign: "right", color: "#b91c1c", fontWeight: 700 }}>-{formatCurrency(row.commAmt)}</td>
                <td style={{ padding: "10px", textAlign: "right", color: "#15803d", fontWeight: 900 }}>{formatCurrency(row.netRev)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
