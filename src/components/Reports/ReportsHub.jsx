import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LegacyMasterReportView } from "../../pages/frontdesk/masterreport";
import ExecutiveYoYReport from "./ExecutiveYoYReport";
import OccupancyForecastReport from "./OccupancyForecastReport";
import ChannelProductionReport from "./ChannelProductionReport";
import CityLedgerAgingReport from "./CityLedgerAgingReport";
import PaymentCollectionAuditReport from "./PaymentCollectionAuditReport";
import BudgetReport from "./BudgetReport";
import DailyRateReport from "./DailyRateReport";
import SystemAuditReport from "./SystemAuditReport";
import CustomDatePicker from "../CustomDatePicker";
import "./reportsHub.css";

const REPORT_NAV_TABS = [
  { id: "master", icon: "💵", name: "Master Financial" },
  { id: "budget", icon: "📈", name: "Budget vs Actual" },
  { id: "daily_rates", icon: "🏷️", name: "Daily Rates Report" },
  { id: "yoy", icon: "🏛️", name: "Executive YoY" },
  { id: "forecast", icon: "📅", name: "Forecast" },
  { id: "channels", icon: "🌐", name: "OTA Channels" },
  { id: "aging", icon: "🏢", name: "City Ledger AR" },
  { id: "payments", icon: "💳", name: "Payment Gateway" },
  { id: "system_audit", icon: "🔍", name: "System Audit Log" },
];

export function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export default function ReportsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "master";
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [presetLabel, setPresetLabel] = useState("Today");

  const setActiveTab = (newTab) => {
    setSearchParams({ tab: newTab });
  };

  const handleExportCSV = () => {
    const rowHeader = [sanitizeCsvCell("Report"), sanitizeCsvCell("Date"), sanitizeCsvCell("ExportedAt")].join(",");
    const rowData = [sanitizeCsvCell(`Hotel_Report_${activeTab}`), sanitizeCsvCell(selectedDate), sanitizeCsvCell(new Date().toISOString())].join(",");
    const csvContent = `data:text/csv;charset=utf-8,${rowHeader}\n${rowData}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Hotel_Report_${activeTab}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handlePresetChange = (label, getTargetDateFn) => {
    setPresetLabel(label);
    const target = getTargetDateFn();
    setSelectedDate(target);
  };

  return (
    <div className="rh-container">
      {/* TOP HEADER & CONTROLS */}
      <div className="rh-header">
        <div>
          <h2>📊 Hotel Reports &amp; Analytics Hub</h2>
          <p>Comprehensive executive performance, YoY SPLY comparisons, system audit trail, channel production, budget planning, daily rate matrix, and forecasting reports.</p>
        </div>

        <div className="rh-actions" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {activeTab === "yoy" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Ref Date:</span>
              <CustomDatePicker value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
          )}
          <button type="button" className="rh-btn-action" onClick={handleExportCSV}>
            📥 Export CSV
          </button>
          <button type="button" className="rh-btn-action" onClick={handlePrintPDF}>
            🖨️ Print / PDF
          </button>
        </div>
      </div>

      {/* TAB CONTENT AREA */}
      <div className="rh-workspace">
        {activeTab === "master" && <LegacyMasterReportView />}
        {activeTab === "budget" && <BudgetReport />}
        {activeTab === "daily_rates" && <DailyRateReport />}
        {activeTab === "yoy" && <ExecutiveYoYReport dateStr={selectedDate} />}
        {activeTab === "forecast" && <OccupancyForecastReport />}
        {activeTab === "channels" && <ChannelProductionReport />}
        {activeTab === "aging" && <CityLedgerAgingReport />}
        {activeTab === "payments" && <PaymentCollectionAuditReport />}
        {activeTab === "system_audit" && <SystemAuditReport />}
      </div>
    </div>
  );
}
