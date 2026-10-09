import React, { useState, useEffect } from "react";
import { getPaymentAuditData } from "../../services/reportAnalyticsService";

export default function PaymentCollectionAuditReport() {
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

  const data = getPaymentAuditData();

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const grandTotal = data.reduce((acc, m) => acc + m.total, 0);
  const grandCount = data.reduce((acc, m) => acc + m.count, 0);

  return (
    <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
          💳 Payment Collection &amp; Gateway Audit Report
        </h3>
        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
          Audit breakdown of collections across all payment methods, Stripe, Fortis, Shift4, PAYBOTX, Venmo, Zelle, and Cash.
        </p>
      </div>

      {/* SUMMARY BANNER */}
      <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Total Collected Revenue</span>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>{formatCurrency(grandTotal)}</div>
        </div>
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          Total Payment Transactions Logged: <strong>{grandCount}</strong>
        </div>
      </div>

      {/* PAYMENT AUDIT TABLE */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
              <th style={{ padding: "10px", textAlign: "left", color: "#0f172a" }}>Payment Method / Gateway</th>
              <th style={{ padding: "10px", textAlign: "center", color: "#0f172a" }}>Gateway Status</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Transaction Count</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Total Amount Collected</th>
              <th style={{ padding: "10px", textAlign: "right", color: "#0f172a" }}>Share of Total (%)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const share = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0;
              return (
                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ padding: "10px", fontWeight: 800, color: "#0f172a" }}>{row.name}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>
                    {row.enabled !== undefined ? (
                      <span style={{ fontSize: "11px", fontWeight: 800, color: row.enabled ? "#15803d" : "#94a3b8" }}>
                        {row.enabled ? "● ACTIVE" : "○ INACTIVE"}
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#64748b" }}>STANDARD</span>
                    )}
                  </td>
                  <td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>{row.count}</td>
                  <td style={{ padding: "10px", textAlign: "right", fontWeight: 900, color: "#0f172a" }}>{formatCurrency(row.total)}</td>
                  <td style={{ padding: "10px", textAlign: "right", color: "#64748b" }}>{share.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
