import { useState, useEffect } from "react";
import "./nightAudit.css";
import { getBookings, getRooms, updateBooking, updateRoomHousekeeping, getAuditLogs } from "../../services/api";
import { getBusinessDate, advanceBusinessDate, getNightAuditConfig, getCancellationPolicies } from "../../services/hotelConfig";
import { printViaIframe } from "../../utils/exportUtils";
import FolioModal from "../../components/FolioModal";

function parseLocalDate(str) {
  if (!str) return new Date();
  const parts = String(str).substring(0, 10).split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 0, 0, 0, 0);
    }
  }
  return new Date(str);
}

function dateToKey(dateObj) {
  const d = new Date(dateObj);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateObj, n) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + n);
  return d;
}

function nightsBetween(inStr, outStr) {
  const d1 = parseLocalDate(inStr);
  const d2 = parseLocalDate(outStr);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.max(1, Math.round(diffTime / (1000 * 3600 * 24)));
}

export default function NightAudit() {
  const [businessDate, setBusinessDate] = useState(() => getBusinessDate());
  const [nightAuditConfig, setNightAuditConfig] = useState(() => getNightAuditConfig());
  const [currentDate, setCurrentDate] = useState(businessDate);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: Pre-Audit Check, 2: Posting Preview, 3: Executing, 4: Complete
  const [isAuditRunning, setIsAuditRunning] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [toast, setToast] = useState("");

  const [noShowTargetBooking, setNoShowTargetBooking] = useState(null);
  const [noShowPolicyOption, setNoShowPolicyOption] = useState("charge_one_night");
  const [selectedFolioBooking, setSelectedFolioBooking] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [bList, rList, logs] = await Promise.all([
        getBookings(),
        getRooms(),
        getAuditLogs().catch(() => []),
      ]);
      setBookings(bList || []);
      setRooms(rList || []);
      setAuditLogs(logs || []);
    } catch (err) {
      console.error("Error loading Night Audit data", err);
    } finally {
      setLoading(false);
    }
  }

  // CALCULATIONS FOR AUDIT SUMMARY
  const occupiedBookings = bookings.filter(
    (b) => (b.status === "checked-in" || b.status === "occupied") && b.room && String(b.room).toLowerCase() !== "unassigned"
  );
  const pendingCheckIns = bookings.filter((b) => {
    if (b.status !== "confirmed") return false;
    const bDate = getBusinessDate();
    return b.checkIn <= bDate;
  });
  const unassignedArrivals = bookings.filter((b) => {
    if (b.status !== "confirmed" && b.status !== "checked-in") return false;
    if (!b.room || String(b.room).toLowerCase() === "unassigned") {
      const bDate = getBusinessDate();
      return b.checkIn <= bDate;
    }
    return false;
  });
  const overdueCheckOuts = bookings.filter((b) => {
    if (b.status !== "checked-in") return false;
    const bDate = getBusinessDate();
    return b.checkOut <= bDate;
  });

  const isReadinessBlocked = pendingCheckIns.length > 0 || overdueCheckOuts.length > 0;

  const realSystemDate = new Date().toISOString().substring(0, 10);
  const isAuditAlreadyCompletedToday =
    businessDate >= realSystemDate || nightAuditConfig?.lastAuditCompletedDate === businessDate;

  const totalTariffToPost = occupiedBookings.reduce((sum, b) => sum + (Number(b.ratePerNight) || 0), 0);
  const totalTaxToPost = occupiedBookings.reduce((sum, b) => sum + Math.round((Number(b.ratePerNight) || 0) * 0.12), 0);
  const totalPostingAmount = totalTariffToPost + totalTaxToPost;

  // ACTION HANDLERS FOR STEP 1
  const handleCheckInPending = async (b) => {
    try {
      const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await updateBooking(b.id, { status: "checked-in", checkInTime: nowTime });
      setToast(`✅ Checked in ${b.guest} to Room ${b.room || "assigned"}.`);
      setTimeout(() => setToast(""), 3000);
      await loadData();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    } catch (err) {
      alert(err.message || "Failed to check in guest");
    }
  };

  const handleNoShowPending = (b) => {
    setNoShowTargetBooking(b);
    setNoShowPolicyOption("charge_one_night");
  };

  const getActiveHotelPolicyDetails = (b) => {
    if (!b) return { policyName: "Standard Hotel Policy", penaltyAmount: 0, refundLabel: "1 Night Fee" };
    const policies = getCancellationPolicies() || [];
    const activePolicy = policies.find((p) => p.isDefault) || policies[0] || { refundType: "one_night", name: "Standard Policy" };
    const nightlyRate = Number(b.ratePerNight || b.nightlyRateUSD || 100);
    const totalAmount = Number(b.totalAmount || b.subtotal || (nightlyRate * Number(b.nights || 1)));

    let penaltyAmount = nightlyRate;
    let refundLabel = `1 Night Penalty ($${penaltyAmount.toFixed(2)})`;

    if (activePolicy.refundType === "no_refund") {
      penaltyAmount = totalAmount;
      refundLabel = `100% Non-Refundable Stay Penalty ($${penaltyAmount.toFixed(2)})`;
    } else if (activePolicy.refundType === "half_refund") {
      penaltyAmount = totalAmount * 0.5;
      refundLabel = `50% Penalty ($${penaltyAmount.toFixed(2)})`;
    } else if (activePolicy.refundType === "free_cancellation") {
      penaltyAmount = 0;
      refundLabel = `Free Cancellation ($0.00)`;
    } else {
      penaltyAmount = nightlyRate;
      refundLabel = `1 Night Penalty ($${penaltyAmount.toFixed(2)})`;
    }

    return {
      policyName: activePolicy.name || "Standard Hotel Policy",
      penaltyAmount,
      refundLabel,
      refundType: activePolicy.refundType
    };
  };

  const confirmNoShowAction = async () => {
    if (!noShowTargetBooking) return;
    const b = noShowTargetBooking;
    let penaltyAmount = 0;
    let actionDetail = "";

    const nightlyRate = Number(b.ratePerNight || b.nightlyRateUSD || 100);
    const policyDetails = getActiveHotelPolicyDetails(b);

    if (noShowPolicyOption === "charge_one_night") {
      penaltyAmount = nightlyRate;
      actionDetail = `Charged 1 Night Tariff Penalty ($${penaltyAmount.toFixed(2)})`;
    } else if (noShowPolicyOption === "charge_per_policy") {
      penaltyAmount = policyDetails.penaltyAmount;
      actionDetail = `Charged Policy Fee (${policyDetails.policyName}: ${policyDetails.refundLabel})`;
    } else if (noShowPolicyOption === "void_all_charges") {
      penaltyAmount = 0;
      actionDetail = `Waived No-Show penalty & voided all charges ($0.00)`;
    }

    const advancePaid = (Array.isArray(b.payments) && b.payments.length > 0)
      ? b.payments.reduce((acc, p) => acc + (Number(p.amountUSD || p.amount) || 0), 0)
      : Number(b.advanceAmount || b.paidAmount || 0);
    const balanceDue = Math.max(0, penaltyAmount - advancePaid);

    const feeItem = penaltyAmount > 0 ? [{
      id: `chg_noshow_${Date.now()}`,
      date: businessDate || getBusinessDate(),
      category: 'No-Show Fee',
      description: `No-Show Fee (${actionDetail})`,
      amountUSD: penaltyAmount,
      amount: penaltyAmount,
      exclTax: Math.round(penaltyAmount * 0.88 * 100) / 100,
      taxAmount: Math.round(penaltyAmount * 0.12 * 100) / 100
    }] : [];

    try {
      await updateBooking(b.id, {
        status: "cancelled",
        totalAmount: penaltyAmount,
        balanceDue: balanceDue,
        folioA: feeItem,
        notes: `${b.notes || ""} [No-Show: ${actionDetail}]`
      });
      if (b.room && String(b.room).toLowerCase() !== "unassigned") {
        await updateRoomHousekeeping(b.room, { housekeeping: "clean" }).catch(() => {});
      }
      setToast(`❌ Marked ${b.guest} as No-Show (${actionDetail}).`);
      setTimeout(() => setToast(""), 3500);
      setNoShowTargetBooking(null);
      await loadData();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
        window.dispatchEvent(new CustomEvent("pms_rooms_updated"));
      }
    } catch (err) {
      alert(err.message || "Failed to process No-Show");
    }
  };

  const handleCheckOutOverdue = async (b) => {
    const balance = Number(b.balanceDue || 0);
    if (balance > 0.01) {
      alert(`⚠️ Cannot check out guest ${b.guest}! There is an unpaid balance of $${balance.toFixed(2)}. Please open the Folio to settle the balance before check-out.`);
      setSelectedFolioBooking(b);
      return;
    }
    try {
      await updateBooking(b.id, { status: "checked-out" });
      setToast(`🚪 Checked out ${b.guest} from Room ${b.room}.`);
      setTimeout(() => setToast(""), 3000);
      await loadData();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
      }
    } catch (err) {
      alert(err.message || "Failed to check out guest");
    }
  };

  const handleExtendOverdue = async (b) => {
    try {
      const activeBizDate = getBusinessDate();
      const currentOut = parseLocalDate(b.checkOut);
      const activeBiz = parseLocalDate(activeBizDate);

      // Target checkout date must be AT LEAST activeBiz + 1 day
      let targetOut = addDays(currentOut, 1);
      if (dateToKey(targetOut) <= activeBizDate) {
        targetOut = addDays(activeBiz, 1);
      }
      const nextStr = dateToKey(targetOut);

      const newNights = Math.max(1, nightsBetween(b.checkIn, nextStr));
      const rate = Number(b.ratePerNight) || 100;
      const prevNights = Math.max(1, Number(b.nights) || 1);
      const addedNights = Math.max(1, newNights - prevNights);
      const addedTariff = rate * addedNights;
      const newTotal = (Number(b.totalAmount) || 0) + addedTariff;
      const newDue = (Number(b.balanceDue) || 0) + addedTariff;

      try {
        await updateBooking(b.id, { checkOut: nextStr, nights: newNights, totalAmount: newTotal, balanceDue: newDue });
        setToast(`📅 Extended stay for ${b.guest} to ${nextStr}.`);
      } catch (err1) {
        // If room is conflicted on target date, extend stay and move to Unassigned room
        if (err1.message && err1.message.includes("already booked")) {
          await updateBooking(b.id, { room: "Unassigned", checkOut: nextStr, nights: newNights, totalAmount: newTotal, balanceDue: newDue });
          setToast(`📅 Extended stay for ${b.guest} to ${nextStr} (Moved to Unassigned Room due to room conflict).`);
        } else {
          throw err1;
        }
      }

      setTimeout(() => setToast(""), 4000);
      await loadData();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
      }
    } catch (err) {
      alert(err.message || "Failed to extend stay");
    }
  };

  // RUN NIGHT AUDIT EXECUTION PROCESS
  const handleRunNightAudit = () => {
    setIsAuditRunning(true);
    setStep(3);
    setAuditProgress(15);

    setTimeout(() => {
      setAuditProgress(40);
      // Auto-process remaining No-Shows if any
      pendingCheckIns.forEach(async (b) => {
        await updateBooking(b.id, { status: "cancelled", notes: `${b.notes || ""} [Auto Cancelled: No-Show during Night Audit]` });
      });

      setTimeout(() => {
        setAuditProgress(75);
        // Post room charges & update housekeeping to dirty for all occupied rooms
        occupiedBookings.forEach(async (b) => {
          const newTotal = (Number(b.totalAmount) || 0) + (Number(b.ratePerNight) || 0);
          const newDue = (Number(b.balanceDue) || 0) + (Number(b.ratePerNight) || 0);
          await updateBooking(b.id, { totalAmount: newTotal, balanceDue: newDue });
          if (b.room && String(b.room).toLowerCase() !== "unassigned") {
            await updateRoomHousekeeping(b.room, { housekeeping: "dirty" });
          }
        });

        // Also mark housekeeping to dirty for checked-out rooms
        const checkedOutList = bookings.filter((b) => b.status === "checked-out" && b.room && String(b.room).toLowerCase() !== "unassigned");
        checkedOutList.forEach(async (b) => {
          await updateRoomHousekeeping(b.room, { housekeeping: "dirty" });
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("pms_rooms_updated"));
        }

        setTimeout(() => {
          setAuditProgress(100);
          setIsAuditRunning(false);
          setStep(4);

          // Advance PMS Business Working Date to Next Day!
          const nextBDate = advanceBusinessDate();
          setBusinessDate(nextBDate);
          setCurrentDate(nextBDate);

          setToast(`🌙 Night Audit Completed Successfully! Business Date Advanced to ${nextBDate}.`);
          setTimeout(() => setToast(""), 4000);
        }, 1200);
      }, 1200);
    }, 1200);
  };

  // PRINT MANAGER'S FLASH REPORT
  const handlePrintFlashReport = () => {
    const reportHtml = `
      <div class="header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 22px; color: #0f172a;">🏨 End-Of-Day Manager Flash Report</h1>
          <div style="font-size: 12px; color: #64748b;">Business Date: ${currentDate} | Generated: ${new Date().toLocaleString()}</div>
        </div>
      </div>

      <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;">
        <div class="kpi-card" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px;"><div class="lbl" style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Occupied Rooms</div><div class="val" style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${occupiedBookings.length}</div></div>
        <div class="kpi-card" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px;"><div class="lbl" style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Tariff Posted</div><div class="val" style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">$${totalTariffToPost.toLocaleString()}</div></div>
        <div class="kpi-card" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px;"><div class="lbl" style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Taxes Posted</div><div class="val" style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">$${totalTaxToPost.toLocaleString()}</div></div>
        <div class="kpi-card" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px;"><div class="lbl" style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Revenue Posted</div><div class="val" style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">$${totalPostingAmount.toLocaleString()}</div></div>
      </div>

      <h3>In-House Room Posting Ledger</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px;">
        <thead>
          <tr style="background: #0f172a; color: #fff;"><th style="padding: 8px; text-align: left;">Room</th><th style="padding: 8px; text-align: left;">Guest Name</th><th style="padding: 8px; text-align: left;">Status</th><th style="padding: 8px; text-align: left;">Rate ($)</th><th style="padding: 8px; text-align: left;">Tax ($)</th><th style="padding: 8px; text-align: left;">Total Posted ($)</th></tr>
        </thead>
        <tbody>
          ${occupiedBookings.map((b) => {
            const r = Number(b.ratePerNight || 0);
            const t = Math.round(r * 0.12);
            return `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px;"><b>${b.room}</b></td><td style="padding: 8px;">${b.guest}</td><td style="padding: 8px;">${b.status}</td><td style="padding: 8px;">$${r}</td><td style="padding: 8px;">$${t}</td><td style="padding: 8px;"><b>$${r + t}</b></td></tr>`;
          }).join("")}
        </tbody>
      </table>

      <div class="footer" style="margin-top: 40px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 10px;">Confidential Internal Hotel Report • Generated by Hotel PMS</div>
    `;

    printViaIframe(reportHtml, `Manager's Flash Report - ${currentDate}`);
  };

  // EXPORT TRIAL BALANCE CSV
  const handleExportCSV = () => {
    let csv = "Room,Guest Name,Status,Room Rate,Tax,Total Posted\n";
    occupiedBookings.forEach((b) => {
      const rate = Number(b.ratePerNight || 0);
      const tax = Math.round(rate * 0.12);
      csv += `"${b.room}","${b.guest}","${b.status}",${rate},${tax},${rate + tax}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Night_Audit_Trial_Balance_${currentDate.replace(/ /g, "_")}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="na-loading">
        <div className="na-spinner" />
        <p>Loading Night Audit Checklist &amp; PMS Database...</p>
      </div>
    );
  }

  return (
    <div className="na-container">
      {toast && <div className="na-toast">{toast}</div>}

      {/* HEADER BANNER */}
      <div className="na-header">
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>Night Audit</h1>
        </div>
        <div className="na-date-badge">
          <span className="lbl">PMS Business Date</span>
          <span className="val">{currentDate}</span>
        </div>
      </div>

      {/* WIZARD STEPS INDICATOR */}
      <div className="na-wizard-steps">
        <div className={`na-step-pill ${step >= 1 ? "active" : ""}`}>
          <span className="num">1</span> 🔍 Pre-Audit Check
        </div>
        <div className={`na-step-pill ${step >= 2 ? "active" : ""}`}>
          <span className="num">2</span> 📋 Charge Preview
        </div>
        <div className={`na-step-pill ${step >= 3 ? "active" : ""}`}>
          <span className="num">3</span> 🚀 Execution
        </div>
        <div className={`na-step-pill ${step >= 4 ? "active" : ""}`}>
          <span className="num">4</span> 📊 EOD Summary
        </div>
      </div>

      {/* STEP 1: PRE-AUDIT CHECKLIST */}
      {step === 1 && (
        <div className="na-card">
          <div className="na-card-head">
            <h3>Step 1: Pre-Audit System Readiness Check</h3>
            <p>Review and resolve pending operational items before rolling over the business date.</p>
          </div>

          {isAuditAlreadyCompletedToday && (
            <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "22px" }}>✅</span>
              <div>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#334155" }}>
                  Night Audit for Today ({businessDate}) is Already Complete
                </h4>
                <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#64748b" }}>
                  The working PMS business date ({businessDate}) is current with today's calendar date ({realSystemDate}). Re-running Night Audit on the same day is disabled to prevent premature date rollover.
                </p>
              </div>
            </div>
          )}

          <div className="na-checklist-grid">
            <div className={`na-check-item ${pendingCheckIns.length === 0 ? "pass" : "warn"}`}>
              <div className="icon">{pendingCheckIns.length === 0 ? "✅" : "⚠️"}</div>
              <div className="details">
                <h4>Pending Arrivals (No-Shows)</h4>
                <p>
                  {pendingCheckIns.length === 0
                    ? "All expected arrivals for today have been checked in or processed."
                    : `${pendingCheckIns.length} reservation(s) still confirmed for today but guest has not arrived.`}
                </p>
              </div>
              <div className="badge">{pendingCheckIns.length} Pending</div>
            </div>

            {/* EXPANDED PENDING ARRIVALS LIST WITH ACTION BUTTONS */}
            {pendingCheckIns.length > 0 && (
              <div className="na-action-list-box warn">
                <div className="na-action-list-title">📋 Action Required: Process or Mark No-Show for {pendingCheckIns.length} Arrival(s)</div>
                <div className="na-action-cards-grid">
                  {pendingCheckIns.map((b) => (
                    <div key={b.id} className="na-action-card">
                      <div className="na-action-info">
                        <strong>👤 {b.guest}</strong>
                        <span>Room {b.room || "Unassigned"} ({b.roomType}) • Stay: {b.checkIn} to {b.checkOut}</span>
                        <span>Total: ${Number(b.totalAmount || b.subtotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="na-action-btns">
                        <button type="button" className="na-btn-act checkin" onClick={() => handleCheckInPending(b)}>
                          ✓ Process Check-In
                        </button>
                        <button type="button" className="na-btn-act noshow" onClick={() => handleNoShowPending(b)}>
                          Mark No-Show
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`na-check-item ${overdueCheckOuts.length === 0 ? "pass" : "warn"}`}>
              <div className="icon">{overdueCheckOuts.length === 0 ? "✅" : "📋"}</div>
              <div className="details">
                <h4>Overdue Check-Outs</h4>
                <p>
                  {overdueCheckOuts.length === 0
                    ? "All departing guests for today have checked out cleanly."
                    : `${overdueCheckOuts.length} guest(s) past departure date without check-out.`}
                </p>
              </div>
              <div className="badge">{overdueCheckOuts.length} Overdue</div>
            </div>

            {/* EXPANDED OVERDUE CHECK-OUTS LIST WITH ACTION BUTTONS */}
            {overdueCheckOuts.length > 0 && (
              <div className="na-action-list-box warn">
                <div className="na-action-list-title">📋 Action Required: Check-Out or Extend Stay for {overdueCheckOuts.length} Overdue Departure(s)</div>
                <div className="na-action-cards-grid">
                  {overdueCheckOuts.map((b) => {
                    const balance = Number(b.balanceDue || 0);
                    const hasOutstandingBalance = balance > 0.01;
                    return (
                      <div key={b.id} className="na-action-card">
                        <div className="na-action-info">
                          <strong>👤 {b.guest}</strong>
                          <span>Room {b.room} ({b.roomType}) • Departure Date: {b.checkOut}</span>
                          <span style={{ color: "#000000", fontWeight: "800" }}>
                            Balance Due: ${balance.toFixed(2)} {hasOutstandingBalance ? " (Settlement Required)" : " (Zero Balance)"}
                          </span>
                        </div>
                        <div className="na-action-btns">
                          {hasOutstandingBalance ? (
                            <button
                              type="button"
                              className="na-btn-act checkout"
                              onClick={() => setSelectedFolioBooking(b)}
                              title="Open Folio to Settle Unpaid Balance Before Check-Out"
                            >
                              💳 Open Folio to Settle (${balance.toFixed(2)}) →
                            </button>
                          ) : (
                            <button type="button" className="na-btn-act checkout" onClick={() => handleCheckOutOverdue(b)}>
                              🚪 Process Check-Out
                            </button>
                          )}
                          <button type="button" className="na-btn-act extend" onClick={() => handleExtendOverdue(b)}>
                            📅 Extend 1 Night
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={`na-check-item ${unassignedArrivals.length === 0 ? "pass" : "warn"}`}>
              <div className="icon">{unassignedArrivals.length === 0 ? "✅" : "📋"}</div>
              <div className="details">
                <h4>Unassigned Reservations</h4>
                <p>
                  {unassignedArrivals.length === 0
                    ? "All active reservations have specific room numbers assigned."
                    : `${unassignedArrivals.length} reservation(s) have no room assigned yet.`}
                </p>
              </div>
              <div className="badge">{unassignedArrivals.length} Unassigned</div>
            </div>

            <div className="na-check-item pass">
              <div className="icon">✅</div>
              <div className="details">
                <h4>In-House Occupied Rooms</h4>
                <p>Currently {occupiedBookings.length} rooms checked-in and active in inventory.</p>
              </div>
              <div className="badge">{occupiedBookings.length} Rooms</div>
            </div>
          </div>

          <div className="na-actions-bar">
            {isAuditAlreadyCompletedToday ? (
              <div className="na-blocked-badge" style={{ background: "#f8fafc", borderColor: "#cbd5e1", color: "#475569" }}>
                ✓ Night Audit for today ({businessDate}) is already completed. Next date rollover will be available tomorrow.
              </div>
            ) : isReadinessBlocked ? (
              <div className="na-blocked-badge">
                Please resolve {pendingCheckIns.length + overdueCheckOuts.length} pending item(s) above before proceeding
              </div>
            ) : (
              <button type="button" className="na-btn-primary" onClick={() => setStep(2)}>
                Proceed to Charge Preview →
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: POSTING PREVIEW */}
      {step === 2 && (
        <div className="na-card">
          <div className="na-card-head">
            <h3>Step 2: Room Tariff &amp; Tax Posting Preview</h3>
            <p>Verify auto-calculated room rate postings for active in-house guests for {currentDate}.</p>
          </div>

          <div className="na-kpi-row">
            <div className="na-kpi">
              <span className="lbl">In-House Rooms</span>
              <span className="val">{occupiedBookings.length}</span>
            </div>
            <div className="na-kpi">
              <span className="lbl">Subtotal Tariff</span>
              <span className="val">${totalTariffToPost.toLocaleString()}</span>
            </div>
            <div className="na-kpi">
              <span className="lbl">Estimated Tax (12%)</span>
              <span className="val">${totalTaxToPost.toLocaleString()}</span>
            </div>
            <div className="na-kpi">
              <span className="lbl">Total EOD Posting</span>
              <span className="val highlight">${totalPostingAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="na-table-wrapper">
            <table className="na-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Guest Name</th>
                  <th>Room Category</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Daily Rate</th>
                  <th>Tax (12%)</th>
                  <th>Total EOD Posting</th>
                </tr>
              </thead>
              <tbody>
                {occupiedBookings.map((b) => {
                  const rate = Number(b.ratePerNight || 0);
                  const tax = Math.round(rate * 0.12);
                  return (
                    <tr key={b.id}>
                      <td><strong>{b.room}</strong></td>
                      <td>{b.guest}</td>
                      <td>{b.roomType}</td>
                      <td>{b.checkIn}</td>
                      <td>{b.checkOut}</td>
                      <td>${rate}</td>
                      <td>${tax}</td>
                      <td><strong>${rate + tax}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="na-actions-bar">
            <button type="button" className="na-btn-secondary" onClick={() => setStep(1)}>
              ← Back to Checklist
            </button>
            <button type="button" className="na-btn-primary danger" onClick={handleRunNightAudit}>
              Confirm &amp; Execute Night Audit
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: EXECUTING PROGRESS */}
      {step === 3 && (
        <div className="na-card center">
          <h3>Executing Night Audit &amp; Business Date Rollover</h3>
          <p>Processing financial close, posting room charges, and updating PMS database...</p>

          <div className="na-progress-bar">
            <div className="na-progress-fill" style={{ width: `${auditProgress}%` }} />
          </div>
          <span className="na-progress-num">{auditProgress}% Completed</span>
        </div>
      )}

      {/* STEP 4: EOD SUMMARY & FLASH REPORT */}
      {step === 4 && (
        <div className="na-card">
          <div className="na-card-head success-head">
            <h3>Night Audit Completed Successfully</h3>
            <p>New Active Business Date: <strong>{currentDate}</strong></p>
          </div>

          <div className="na-kpi-row">
            <div className="na-kpi">
              <span className="lbl">Rooms Processed</span>
              <span className="val">{occupiedBookings.length}</span>
            </div>
            <div className="na-kpi">
              <span className="lbl">Tariff Revenue</span>
              <span className="val">${totalTariffToPost.toLocaleString()}</span>
            </div>
            <div className="na-kpi">
              <span className="lbl">Taxes Collected</span>
              <span className="val">${totalTaxToPost.toLocaleString()}</span>
            </div>
            <div className="na-kpi">
              <span className="lbl">Total Financial Close</span>
              <span className="val highlight">${totalPostingAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="na-report-actions">
            <button type="button" className="na-btn-primary" onClick={handlePrintFlashReport}>
              🖨️ Print Manager's EOD Flash Report
            </button>
            <button type="button" className="na-btn-secondary" onClick={handleExportCSV}>
              📄 Export Trial Balance CSV
            </button>
          </div>
        </div>
      )}

      {noShowTargetBooking && (
        <div className="qam-overlay">
          <div className="qam-card" style={{ maxWidth: 540, width: "92%", padding: 24, borderRadius: 16, background: "#ffffff", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #e2e8f0", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a", fontWeight: 800 }}>Mark No-Show &amp; Financial Action</h3>
              <button type="button" onClick={() => setNoShowTargetBooking(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: "#475569", marginBottom: 16, lineHeight: "1.5" }}>
              Select required financial action for marking <strong>{noShowTargetBooking.guest}</strong> (Room {noShowTargetBooking.room || "Unassigned"}) as No-Show:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <label style={{ display: "flex", gap: 12, padding: 12, border: "1.5px solid", borderColor: noShowPolicyOption === "charge_one_night" ? "#0f172a" : "#cbd5e1", background: noShowPolicyOption === "charge_one_night" ? "#f8fafc" : "#ffffff", borderRadius: 10, cursor: "pointer" }}>
                <input type="radio" name="naNoShowPolicy" checked={noShowPolicyOption === "charge_one_night"} onChange={() => setNoShowPolicyOption("charge_one_night")} style={{ marginTop: 3 }} />
                <div>
                  <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>Charge 1-Night Tariff Rate</strong>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Post 1 night tariff rate (${Number(noShowTargetBooking.ratePerNight || 100).toFixed(2)}) as No-Show penalty fee.</span>
                </div>
              </label>

              {(() => {
                const pol = getActiveHotelPolicyDetails(noShowTargetBooking);
                return (
                  <label style={{ display: "flex", gap: 12, padding: 12, border: "1.5px solid", borderColor: noShowPolicyOption === "charge_per_policy" ? "#0f172a" : "#cbd5e1", background: noShowPolicyOption === "charge_per_policy" ? "#f8fafc" : "#ffffff", borderRadius: 10, cursor: "pointer" }}>
                    <input type="radio" name="naNoShowPolicy" checked={noShowPolicyOption === "charge_per_policy"} onChange={() => setNoShowPolicyOption("charge_per_policy")} style={{ marginTop: 3 }} />
                    <div>
                      <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>Charge Hotel Policy Fee ({pol.policyName})</strong>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Apply {pol.refundLabel} as per active hotel cancellation/no-show policy.</span>
                    </div>
                  </label>
                );
              })()}

              <label style={{ display: "flex", gap: 12, padding: 12, border: "1.5px solid", borderColor: noShowPolicyOption === "void_all_charges" ? "#0f172a" : "#cbd5e1", background: noShowPolicyOption === "void_all_charges" ? "#f8fafc" : "#ffffff", borderRadius: 10, cursor: "pointer" }}>
                <input type="radio" name="naNoShowPolicy" checked={noShowPolicyOption === "void_all_charges"} onChange={() => setNoShowPolicyOption("void_all_charges")} style={{ marginTop: 3 }} />
                <div>
                  <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>Mark No-Show &amp; Void All Charges</strong>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Waive No-Show penalty, void room charges to $0.00, and release room back to inventory.</span>
                </div>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="na-btn-act" style={{ background: "#e2e8f0", color: "#334155" }} onClick={() => setNoShowTargetBooking(null)}>Cancel</button>
              <button type="button" className="na-btn-act noshow" style={{ padding: "10px 20px" }} onClick={confirmNoShowAction}>Confirm No-Show &amp; Execute Policy</button>
            </div>
          </div>
        </div>
      )}

      {/* FOLIO MODAL OVERLAY FOR SETTLEMENT */}
      {selectedFolioBooking && (
        <FolioModal
          isOpen={!!selectedFolioBooking}
          booking={selectedFolioBooking}
          onClose={() => {
            setSelectedFolioBooking(null);
            loadData();
          }}
          onUpdateBooking={async () => {
            await loadData();
          }}
        />
      )}
    </div>
  );
}
