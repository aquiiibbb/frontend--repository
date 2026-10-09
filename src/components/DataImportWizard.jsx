import React, { useState } from "react";
import { importBatchBookings } from "../services/api";
import "./DataImportWizard.css";

const TARGET_FIELDS = [
  { key: "bookingId", label: "Booking ID / Ref Code", required: false },
  { key: "guest", label: "Guest Name *", required: true },
  { key: "checkIn", label: "Check-In Date (YYYY-MM-DD) *", required: true },
  { key: "checkOut", label: "Check-Out Date (YYYY-MM-DD) *", required: true },
  { key: "room", label: "Room Number", required: false },
  { key: "roomType", label: "Room Category / Type", required: false },
  { key: "phone", label: "Phone Number", required: false },
  { key: "email", label: "Email Address", required: false },
  { key: "totalAmount", label: "Total Amount ($)", required: false },
  { key: "taxAmount", label: "Tax Amount ($)", required: false },
  { key: "paidAmount", label: "Paid Amount ($)", required: false },
  { key: "status", label: "Status (checked-out/confirmed/cancelled)", required: false },
  { key: "channel", label: "Booking Source / Channel", required: false },
  { key: "notes", label: "Notes / Remarks", required: false },
];

export default function DataImportWizard() {
  const [step, setStep] = useState(1);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mappings, setMappings] = useState({});
  const [parsedBookings, setParsedBookings] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [fileName, setFileName] = useState("");

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const csvContent = `Booking ID,Guest Name,Phone,Email,Room Number,Room Type,CheckIn,CheckOut,Total Amount,Tax Amount,Paid Amount,Status,Channel,Notes
BK-9001,John Smith,+1 555-0192,john@example.com,101,Standard Room,2026-08-01,2026-08-04,336.00,36.00,336.00,checked-out,Booking.com,Past vacation stay
BK-9002,Sarah Connor,+1 555-0144,sarah@example.com,102,Deluxe Room,2026-08-05,2026-08-08,504.00,54.00,504.00,checked-out,Expedia,Corporate conference
BK-9003,Michael Scott,+1 555-0188,michael@dundermifflin.com,201,Executive Suite,2026-08-10,2026-08-13,1008.00,108.00,1008.00,checked-out,Direct,VIP guest stay`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "hotel_pms_sample_past_bookings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper: Parse CSV text into array of rows
  const parseCSV = (text) => {
    const lines = text.split(/\r\n|\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const splitLine = (lineStr) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < lineStr.length; i++) {
        const char = lineStr[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = splitLine(lines[0]);
    const rows = lines.slice(1).map(splitLine).filter((r) => r.length > 0 && r.some((val) => val.length > 0));

    return { headers, rows };
  };

  // Handle File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target.result;
      const { headers, rows } = parseCSV(content);

      if (headers.length === 0 || rows.length === 0) {
        alert("The uploaded file contains no data or could not be parsed. Please upload a valid CSV file.");
        return;
      }

      setRawHeaders(headers);
      setRawRows(rows);

      // Auto-match headers to target fields
      const autoMap = {};
      TARGET_FIELDS.forEach((tf) => {
        const matchedIndex = headers.findIndex((h) => {
          const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
          const cleanKey = tf.key.toLowerCase();

          if (cleanKey.includes("bookingid") && (cleanH.includes("bookingid") || cleanH.includes("resid") || cleanH.includes("ref") || cleanH.includes("code"))) return true;
          if (cleanKey.includes("guest") && (cleanH.includes("guest") || cleanH.includes("name"))) return true;
          if (cleanKey.includes("checkin") && (cleanH.includes("checkin") || cleanH.includes("arrival") || cleanH.includes("start"))) return true;
          if (cleanKey.includes("checkout") && (cleanH.includes("checkout") || cleanH.includes("departure") || cleanH.includes("end"))) return true;
          if (cleanKey.includes("room") && !cleanKey.includes("type") && (cleanH.includes("roomno") || cleanH.includes("roomnum") || cleanH === "room")) return true;
          if (cleanKey.includes("roomtype") && (cleanH.includes("type") || cleanH.includes("category"))) return true;
          if (cleanKey.includes("phone") && (cleanH.includes("phone") || cleanH.includes("mobile") || cleanH.includes("contact"))) return true;
          if (cleanKey.includes("email") && cleanH.includes("email")) return true;
          if (cleanKey.includes("taxamount") && (cleanH.includes("tax") || cleanH.includes("vat") || cleanH.includes("gst"))) return true;
          if (cleanKey.includes("total") && !cleanKey.includes("tax") && (cleanH.includes("total") || cleanH.includes("amount") || cleanH.includes("price")) && !cleanH.includes("source") && !cleanH.includes("channel")) return true;
          if (cleanKey.includes("paid") && (cleanH.includes("paid") || cleanH.includes("deposit") || cleanH.includes("advance"))) return true;
          if (cleanKey.includes("status") && cleanH.includes("status")) return true;
          if (cleanKey.includes("channel") && !cleanH.includes("amount") && !cleanH.includes("price") && !cleanH.includes("revenue") && !cleanH.includes("tax") && (cleanH.includes("channel") || cleanH.includes("source") || cleanH.includes("ota"))) return true;
          if (cleanKey.includes("notes") && (cleanH.includes("note") || cleanH.includes("remark"))) return true;
          return false;
        });

        if (matchedIndex !== -1) {
          autoMap[tf.key] = matchedIndex;
        }
      });

      setMappings(autoMap);
      setStep(2);
    };

    reader.readAsText(file);
  };

  // Helper: Normalize Date Format (YYYY-MM-DD)
  const normalizeDate = (val) => {
    if (!val) return "";
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    const parts = str.split(/[/.-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${String(parts[0]).padStart(2, "0")}-${String(parts[1]).padStart(2, "0")}`;
      }
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    return str;
  };

  // Proceed to Step 3: Build Parsed Bookings & Validate
  const handleProceedToPreview = () => {
    if (mappings.guest === undefined || mappings.checkIn === undefined || mappings.checkOut === undefined) {
      alert("Please map Guest Name, Check-In Date, and Check-Out Date before proceeding.");
      return;
    }

    const items = rawRows.map((row, idx) => {
      const getVal = (key) => (mappings[key] !== undefined ? row[mappings[key]] || "" : "");

      const bookingId = getVal("bookingId") || `BK-${1000 + idx + 1}`;
      const guest = getVal("guest") || `Guest ${idx + 1}`;
      const checkIn = normalizeDate(getVal("checkIn"));
      const checkOut = normalizeDate(getVal("checkOut"));
      const room = getVal("room") || "Unassigned";
      const roomType = getVal("roomType") || "Standard Room";
      const phone = getVal("phone") || "";
      const email = getVal("email") || "";
      const totalAmount = Number(getVal("totalAmount")) || 0;
      const taxAmount = Number(getVal("taxAmount")) || 0;
      const paidAmount = Number(getVal("paidAmount")) || totalAmount;
      const statusRaw = getVal("status").toLowerCase();
      let status = "checked-out";
      if (statusRaw.includes("cancel")) status = "cancelled";
      else if (statusRaw.includes("in") || statusRaw.includes("active")) status = "checked-in";
      else if (statusRaw.includes("confirm")) status = "confirmed";

      let channel = getVal("channel") || "Direct";
      if (!channel || typeof channel === "number" || (!isNaN(Number(channel)) && !isNaN(parseFloat(channel))) || /^[\$]?[\d,]+(\.\d+)?$/.test(String(channel).trim())) {
        channel = "Direct";
      }
      const notes = getVal("notes") || "Imported past booking";

      // Validation check
      const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkOut > checkIn;
      const errors = [];
      if (!isValidDate) errors.push("Invalid date format or check-out <= check-in");

      return {
        id: bookingId,
        bookingId,
        guest,
        phone,
        email,
        room,
        roomType,
        checkIn,
        checkOut,
        totalAmount,
        taxAmount,
        paidAmount,
        balanceDue: Math.max(0, totalAmount - paidAmount),
        status,
        channel,
        notes,
        isValid: errors.length === 0,
        errors,
      };
    });

    setParsedBookings(items);
    setStep(3);
  };

  // Step 4: Execute Batch Import
  const handleConfirmImport = async () => {
    const validBookings = parsedBookings.filter((b) => b.isValid);
    if (validBookings.length === 0) {
      alert("No valid bookings to import.");
      return;
    }

    setImporting(true);
    try {
      const res = await importBatchBookings(validBookings);
      setImportResult(res);
      setStep(4);
    } catch (err) {
      alert(err.message || "Failed to import bookings.");
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedBookings.filter((b) => b.isValid).length;
  const invalidCount = parsedBookings.filter((b) => !b.isValid).length;

  return (
    <div className="di-wizard-container">
      {/* WIZARD STEPPER HEADER */}
      <div className="di-stepper-header">
        <div className={`di-step-pill ${step >= 1 ? "active" : ""}`}>
          <span className="step-num">1</span>
          <span className="step-name">Upload CSV</span>
        </div>
        <div className="di-step-line" />
        <div className={`di-step-pill ${step >= 2 ? "active" : ""}`}>
          <span className="step-num">2</span>
          <span className="step-name">Column Mapping</span>
        </div>
        <div className="di-step-line" />
        <div className={`di-step-pill ${step >= 3 ? "active" : ""}`}>
          <span className="step-num">3</span>
          <span className="step-name">Preview & Validate</span>
        </div>
        <div className="di-step-line" />
        <div className={`di-step-pill ${step >= 4 ? "active" : ""}`}>
          <span className="step-num">4</span>
          <span className="step-name">Complete</span>
        </div>
      </div>

      {/* STEP 1: FILE UPLOAD & TEMPLATE DOWNLOAD */}
      {step === 1 && (
        <div className="di-step-content">
          <div className="di-card-box">
            <div className="di-head">
              <h3>📂 Upload Past Bookings Spreadsheet</h3>
              <p>Upload a CSV file containing your past or historical reservation records to import them directly into the PMS database, calendar grid, master reports, and guest CRM.</p>
            </div>

            <div className="di-upload-dropzone">
              <span className="upload-icon">📥</span>
              <h4>Select a CSV file to upload</h4>
              <p>Supports .csv files with header rows</p>
              <input type="file" accept=".csv, .txt" onChange={handleFileUpload} id="csvFileInput" hidden />
              <label htmlFor="csvFileInput" className="di-btn-upload">Browse File</label>
            </div>

            <div className="di-template-download-box">
              <div>
                <strong>Need a reference CSV file format?</strong>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>Download our pre-formatted sample CSV file containing standard column headers including Booking ID & Tax Amount.</p>
              </div>
              <button type="button" className="di-btn-template" onClick={handleDownloadTemplate}>
                📄 Download Sample CSV Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 2 && (
        <div className="di-step-content">
          <div className="di-card-box">
            <div className="di-head">
              <h3>🔗 Map CSV Columns to PMS Target Fields</h3>
              <p>Uploaded File: <strong>{fileName}</strong> ({rawRows.length} rows found)</p>
            </div>

            <div className="di-mapping-grid">
              {TARGET_FIELDS.map((field) => (
                <div key={field.key} className="di-mapping-row">
                  <div className="di-field-label">
                    <span>{field.label}</span>
                  </div>
                  <div className="di-field-select">
                    <select
                      value={mappings[field.key] !== undefined ? mappings[field.key] : ""}
                      onChange={(e) =>
                        setMappings({
                          ...mappings,
                          [field.key]: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    >
                      <option value="">-- Do Not Map --</option>
                      {rawHeaders.map((header, idx) => (
                        <option key={idx} value={idx}>
                          Column {idx + 1}: &quot;{header}&quot;
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="di-actions-row">
              <button type="button" className="di-btn-secondary" onClick={() => setStep(1)}>
                ← Back to Upload
              </button>
              <button type="button" className="di-btn-primary" onClick={handleProceedToPreview}>
                Proceed to Preview & Validation →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & VALIDATION GRID */}
      {step === 3 && (
        <div className="di-step-content">
          <div className="di-card-box">
            <div className="di-head">
              <h3>🔍 Data Validation & Pre-Import Preview</h3>
              <div className="di-stats-summary">
                <span className="stat-pill total">Total Rows: {parsedBookings.length}</span>
                <span className="stat-pill valid">✅ Valid: {validCount}</span>
                {invalidCount > 0 && <span className="stat-pill invalid">⚠️ Errors/Warnings: {invalidCount}</span>}
              </div>
            </div>

            <div className="di-table-wrapper">
              <table className="di-preview-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Booking ID</th>
                    <th>Guest Name</th>
                    <th>Room</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Total ($)</th>
                    <th>Tax ($)</th>
                    <th>Paid ($)</th>
                    <th>Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedBookings.map((b, idx) => (
                    <tr key={idx} className={b.isValid ? "row-valid" : "row-invalid"}>
                      <td>
                        {b.isValid ? (
                          <span className="badge-valid">✅ Valid</span>
                        ) : (
                          <span className="badge-invalid" title={b.errors.join(", ")}>⚠️ Error</span>
                        )}
                      </td>
                      <td><code>{b.bookingId}</code></td>
                      <td><strong>{b.guest}</strong></td>
                      <td>{b.room} ({b.roomType})</td>
                      <td>{b.checkIn}</td>
                      <td>{b.checkOut}</td>
                      <td>${b.totalAmount.toFixed(2)}</td>
                      <td>${b.taxAmount.toFixed(2)}</td>
                      <td>${b.paidAmount.toFixed(2)}</td>
                      <td>{b.channel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="di-actions-row">
              <button type="button" className="di-btn-secondary" onClick={() => setStep(2)}>
                ← Back to Mapping
              </button>
              <button
                type="button"
                className="di-btn-primary"
                disabled={importing || validCount === 0}
                onClick={handleConfirmImport}
              >
                {importing ? "Importing Data..." : `🚀 Import ${validCount} Valid Bookings Now`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: IMPORT COMPLETE SUMMARY */}
      {step === 4 && (
        <div className="di-step-content">
          <div className="di-card-box success-card">
            <div className="di-success-icon">🎉</div>
            <h2>Data Import Successfully Completed!</h2>
            <p>
              Successfully imported <strong>{importResult?.count || validCount}</strong> historical booking records into the PMS.
            </p>

            <div className="di-impact-summary-box">
              <h4>What was updated automatically:</h4>
              <ul>
                <li>✅ <strong>Tape Chart / Calendar Grid</strong>: Past bookings populated on timeline.</li>
                <li>✅ <strong>Master Reports & Analytics</strong>: Past revenue, occupancy %, RevPAR & ADR updated.</li>
                <li>✅ <strong>Guest CRM Database</strong>: Guest profile stay records updated.</li>
              </ul>
            </div>

            <div className="di-actions-row center">
              <button
                type="button"
                className="di-btn-primary"
                onClick={() => {
                  setStep(1);
                  setParsedBookings([]);
                  setRawRows([]);
                  setRawHeaders([]);
                  setFileName("");
                }}
              >
                📥 Import Another File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
