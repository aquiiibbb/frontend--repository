import React, { useState, useEffect } from "react";
import { getCityLedgerAgingData } from "../../services/reportAnalyticsService";

export default function CityLedgerAgingReport() {
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

  const accounts = getCityLedgerAgingData();

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalOwed = accounts.reduce((acc, a) => acc + a.totalOwed, 0);

  return (
    <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
          🏢 City Ledger &amp; Accounts Receivable (AR) Aging Report
        </h3>
        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
          Corporate account direct billing balances grouped by aging periods (0-30, 31-60, 61-90, 90+ days).
        </p>
      </div>

      {/* SUMMARY BANNER */}
      <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Total Outstanding Corporate AR Balance</span>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>{formatCurrency(totalOwed)}</div>
        </div>
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          Active Corporate Accounts Registered: <strong>{accounts.length}</strong>
        </div>
      </div>

      {/* AR AGING TABLE */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a" }}>Company / Corporate Account</th>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a" }}>Account #</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Credit Limit</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#15803d" }}>Current (0-30 Days)</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#b45309" }}>31 - 60 Days</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#c2410c" }}>61 - 90 Days</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#b91c1c" }}>90+ Days (Past Due)</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Total Owed</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                <td style={{ padding: "10px", fontWeight: 800, color: "#0f172a" }}>🏢 {row.name}</td>
                <td style={{ padding: "10px", color: "#64748b" }}>{row.accountNo}</td>
                <td style={{ padding: "10px", textAlign: "right", color: "#64748b" }}>{formatCurrency(row.creditLimit)}</td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "#15803d" }}>{formatCurrency(row.current030)}</td>
                <td style={{ padding: "10px", textAlign: "right", color: "#b45309" }}>{formatCurrency(row.days3160)}</td>
                <td style={{ padding: "10px", textAlign: "right", color: "#c2410c" }}>{formatCurrency(row.days6190)}</td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 800, color: "#b91c1c" }}>{formatCurrency(row.days90Plus)}</td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 900, color: "#0f172a" }}>{formatCurrency(row.totalOwed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
