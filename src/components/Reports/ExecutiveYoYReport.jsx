import React, { useState, useEffect } from "react";
import { getExecutiveYoYReportData } from "../../services/reportAnalyticsService";

export default function ExecutiveYoYReport({ dateStr }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleSync = () => setTick((t) => t + 1);
    window.addEventListener("pms_bookings_updated", handleSync);
    window.addEventListener("pms_misc_transactions_updated", handleSync);
    window.addEventListener("pms_daily_sales_updated", handleSync);
    window.addEventListener("pms_daily_expenses_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("pms_bookings_updated", handleSync);
      window.removeEventListener("pms_misc_transactions_updated", handleSync);
      window.removeEventListener("pms_daily_sales_updated", handleSync);
      window.removeEventListener("pms_daily_expenses_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const data = getExecutiveYoYReportData(dateStr);

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (val) => `${Number(val || 0).toFixed(1)}%`;

  const renderVariance = (curr, prev, isCurrency = false, isPercentVal = false) => {
    const diff = curr - prev;
    if (prev === 0 && curr === 0) return <span style={{ color: "#64748b" }}>0</span>;
    const pctChange = prev > 0 ? (diff / prev) * 100 : 0;

    const isPositive = diff >= 0;
    const color = isPositive ? "#15803d" : "#b91c1c";
    const bg = isPositive ? "#f0fdf4" : "#fef2f2";
    const sign = isPositive ? "▲ +" : "▼ ";

    let valText = "";
    if (isPercentVal) {
      valText = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
    } else if (isCurrency) {
      valText = `${sign}${formatCurrency(Math.abs(diff))} (${pctChange.toFixed(1)}%)`;
    } else {
      valText = `${sign}${Math.abs(diff)} (${pctChange.toFixed(1)}%)`;
    }

    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "11.5px",
          fontWeight: 800,
          color,
          background: bg,
          border: `1px solid ${color}33`,
        }}
      >
        {valText}
      </span>
    );
  };

  const rows = [
    { label: "Available Room Nights", key: "availableRooms", isCurrency: false, isPercent: false },
    { label: "Rooms Occupied", key: "roomsSold", isCurrency: false, isPercent: false },
    { label: "Occupancy Percentage", key: "occPercent", isCurrency: false, isPercent: true },
    { label: "Average Daily Rate (ADR)", key: "adr", isCurrency: true, isPercent: false },
    { label: "Revenue Per Avail Room (RevPAR)", key: "revpar", isCurrency: true, isPercent: false },
    { label: "Room Tariff Revenue", key: "roomRevenue", isCurrency: true, isPercent: false },
    { label: "Extra Charges / F&B Revenue", key: "extraRevenue", isCurrency: true, isPercent: false },
    { label: "Daily Sales (POS & Misc) Revenue", key: "dailySalesRevenue", isCurrency: true, isPercent: false },
    { label: "Cancellation Revenue", key: "cancellationRevenue", isCurrency: true, isPercent: false },
    { label: "No-Show Revenue", key: "noShowRevenue", isCurrency: true, isPercent: false },
    { label: "Operational Expenses", key: "operationalExpenses", isCurrency: true, isPercent: false },
    { label: "Total Gross Revenue", key: "grossRevenue", isCurrency: true, isPercent: false },
    { label: "Net Operating Revenue / Profit", key: "netIncome", isCurrency: true, isPercent: false },
    { label: "Taxes & Levies Collected", key: "taxes", isCurrency: true, isPercent: false },
  ];

  return (
    <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
          🏛️ Executive YoY &amp; MTD / YTD Performance Matrix
        </h3>
        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
          Comparing Current Period (Actual) vs. Same Period Last Year (SPLY) with Variance Analysis.
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a", fontWeight: 800 }}>Metric</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Today (Actual)</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#64748b" }}>Today (Last Yr)</th>
              <th style={{ padding: "10px", textAlign: "center", color: "#0f172a" }}>Today Variance</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>MTD (Actual)</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#64748b" }}>MTD (Last Yr)</th>
              <th style={{ padding: "10px", textAlign: "center", color: "#0f172a" }}>MTD Variance</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>YTD (Actual)</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#64748b" }}>YTD (Last Yr)</th>
              <th style={{ padding: "10px", textAlign: "center", color: "#0f172a" }}>YTD Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const tc = data.todayCurrent[row.key];
              const tl = data.todayLastYear[row.key];
              const mc = data.mtdCurrent[row.key];
              const ml = data.mtdLastYear[row.key];
              const yc = data.ytdCurrent[row.key];
              const yl = data.ytdLastYear[row.key];

              const fmt = (v) => (row.isPercent ? formatPercent(v) : row.isCurrency ? formatCurrency(v) : Math.round(v).toLocaleString());

              return (
                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ padding: "10px", fontWeight: 800, color: "#0f172a" }}>{row.label}</td>
                  <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{fmt(tc)}</td>
                  <td style={{ padding: "10px", textAlign: "right", color: "#64748b" }}>{fmt(tl)}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{renderVariance(tc, tl, row.isCurrency, row.isPercent)}</td>

                  <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{fmt(mc)}</td>
                  <td style={{ padding: "10px", textAlign: "right", color: "#64748b" }}>{fmt(ml)}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{renderVariance(mc, ml, row.isCurrency, row.isPercent)}</td>

                  <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{fmt(yc)}</td>
                  <td style={{ padding: "10px", textAlign: "right", color: "#64748b" }}>{fmt(yl)}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{renderVariance(yc, yl, row.isCurrency, row.isPercent)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
