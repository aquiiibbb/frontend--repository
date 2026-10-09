import React, { useState } from "react";
import "./folioModal.css";

export default function SplitStayWizardModal({ booking, rooms = [], roomTypes = [], onClose, onConfirmSplit }) {
  if (!booking) return null;

  const nights = Math.max(1, Number(booking.nights) || 1);
  const defaultRate = Number(booking.ratePerNight) || Math.round(Number(booking.subtotal || 7500) / nights);

  // Dates list
  let checkInStr = String(booking.checkIn || "");
  if (checkInStr.length === 10) checkInStr += "T00:00:00";
  const startDate = new Date(checkInStr);
  const validDate = isNaN(startDate.getTime()) ? new Date() : startDate;

  const stayDates = [];
  for (let i = 0; i < nights; i++) {
    const d = new Date(validDate);
    d.setDate(validDate.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    stayDates.push({ index: i + 1, date: dateStr, dayName });
  }

  const defaultSplitIndex = Math.max(1, Math.floor(nights / 2));
  const [splitDateIndex, setSplitDateIndex] = useState(defaultSplitIndex);
  const [targetRoomNo, setTargetRoomNo] = useState(rooms.find((r) => r.no !== booking.room)?.no || "");
  const [phase2CustomRate, setPhase2CustomRate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedSplitDate = stayDates[splitDateIndex]?.date || booking.checkIn;
  const phase1Nights = splitDateIndex;
  const phase2Nights = nights - splitDateIndex;

  const targetRoomObj = rooms.find((r) => r.no === targetRoomNo);
  const targetRoomType = roomTypes.find((t) => t.id === targetRoomObj?.type || t.name === targetRoomObj?.type);
  const targetRoomBasePrice = targetRoomType?.price || defaultRate;

  const phase1Rate = defaultRate;
  const phase2Rate = phase2CustomRate !== "" ? Number(phase2CustomRate) || 0 : targetRoomBasePrice;

  const phase1Subtotal = phase1Rate * phase1Nights;
  const phase2Subtotal = phase2Rate * phase2Nights;
  const totalSubtotal = phase1Subtotal + phase2Subtotal;

  const taxPct = booking.taxExempt ? 0 : (booking.taxPercent !== undefined ? Number(booking.taxPercent) : 12);
  const totalTax = Math.round((totalSubtotal * taxPct) / 100);
  const totalWithTax = totalSubtotal + totalTax;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!targetRoomNo || targetRoomNo === booking.room) {
      alert("Please select a different target room.");
      return;
    }

    const nightlyRatesMap = {};
    for (let i = 0; i < nights; i++) {
      const dStr = stayDates[i].date;
      if (i < splitDateIndex) {
        nightlyRatesMap[dStr] = phase1Rate;
      } else {
        nightlyRatesMap[dStr] = phase2Rate;
      }
    }

    setIsSubmitting(true);
    try {
      await onConfirmSplit?.({
        splitDate: selectedSplitDate,
        targetRoom: targetRoomNo,
        nightlyRatesMap,
        newSubtotal: totalSubtotal,
      });
      onClose();
    } catch (err) {
      alert(err.message || "Failed to split stay");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="qam-overlay" style={{ zIndex: 999999 }}>
      <div className="qam-card" role="dialog" aria-modal="true" style={{ maxWidth: 480, padding: 0 }} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div style={{ background: "#ffffff", color: "#0f172a", borderBottom: "1px solid #e2e8f0", padding: "16px 20px", borderTopLeftRadius: 12, borderTopRightRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              🔀 Split Stay — {booking.guest}
            </h3>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Current Room <strong>{booking.room}</strong> · {booking.checkIn} to {booking.checkOut} ({nights} Nights)
            </div>
          </div>
          <button type="button" className="qam-close" onClick={onClose} style={{ color: "#ffffff", background: "transparent", border: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20 }}>
          {/* STEP 1: FROM WHEN TO BREAK? */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: "#334155", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              1. From when to break? (Split Date) *
            </label>
            <select
              value={splitDateIndex}
              onChange={(e) => setSplitDateIndex(Number(e.target.value))}
              style={{ width: "100%", height: 42, borderRadius: 8, border: "1.5px solid #cbd5e1", padding: "0 12px", fontSize: 14, fontWeight: 800, color: "#0f172a" }}
            >
              {stayDates.map((d, idx) => {
                if (idx === 0) return null;
                return (
                  <option key={d.date} value={idx}>
                    Break on {d.date} ({d.dayName}) — Move starting Night {idx + 1}
                  </option>
                );
              })}
            </select>
          </div>

          {/* STEP 2: MOVE TO WHICH ROOM? */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: "#334155", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              2. Move to which room? *
            </label>
            <select
              value={targetRoomNo}
              onChange={(e) => setTargetRoomNo(e.target.value)}
              required
              style={{ width: "100%", height: 42, borderRadius: 8, border: "1.5px solid #2563eb", padding: "0 12px", fontSize: 14, fontWeight: 800, color: "#1d4ed8" }}
            >
              <option value="" disabled>-- Select Target Room --</option>
              {rooms
                .filter((r) => r.no !== booking.room)
                .map((r) => {
                  const rType = roomTypes.find((t) => t.id === r.type || t.name === r.type);
                  const price = rType?.price || defaultRate;
                  return (
                    <option key={r.no} value={r.no}>
                      Room {r.no} — {r.type} (${price.toLocaleString()}/night)
                    </option>
                  );
                })}
            </select>
          </div>

          {/* STEP 3: SEE RATES PREVIEW */}
          <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
              3. Rates &amp; Stay Breakdown
            </div>
            <div style={{ fontSize: 13, color: "#334155", display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Phase 1 (Room {booking.room} · {phase1Nights} Night{phase1Nights > 1 ? "s" : ""}):</span>
              <strong style={{ color: "#0f172a" }}>${phase1Rate.toLocaleString()}/night (${phase1Subtotal.toLocaleString()})</strong>
            </div>

            <div style={{ fontSize: 13, color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span>Phase 2 (Room {targetRoomNo || "..."} · {phase2Nights} Night{phase2Nights > 1 ? "s" : ""}):</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Rate: $</span>
                <input
                  type="number"
                  value={phase2CustomRate !== "" ? phase2CustomRate : phase2Rate}
                  onChange={(e) => setPhase2CustomRate(e.target.value)}
                  style={{ width: 80, height: 28, borderRadius: 6, border: "1px solid #3b82f6", padding: "0 6px", fontSize: 13, fontWeight: 800, textAlign: "right" }}
                />
                <strong style={{ color: "#1d4ed8" }}>(${phase2Subtotal.toLocaleString()})</strong>
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 900, color: "#047857", paddingTop: 8, borderTop: "1px dashed #cbd5e1", display: "flex", justifyContent: "space-between" }}>
              <span>Total New Stay Cost:</span>
              <span>${totalSubtotal.toLocaleString()} + ${totalTax.toLocaleString()} GST = ${totalWithTax.toLocaleString()}</span>
            </div>
          </div>

          {/* STEP 4: CONFIRM MOVE */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 800, background: "#2563eb", padding: "8px 20px" }} disabled={isSubmitting}>
              {isSubmitting ? "Executing Split..." : "🔀 Move &amp; Split Stay"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
