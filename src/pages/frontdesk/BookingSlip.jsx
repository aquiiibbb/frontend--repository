import { useState } from "react";
import "./slip.css";

const STATUS_CLASS = {
  Paid: "slip-status-paid",
  Partial: "slip-status-partial",
  Pending: "slip-status-pending",
};

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const diff = Math.round((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

const dash = (value) => (value === undefined || value === null || value === "" ? "—" : value);
const money = (value) => (value === undefined || value === null ? null : `$${value}`);

/**
 * Full booking summary ("slip"), opened as a CENTERED modal from the
 * calendar when a reservation bar is clicked (see Calendar.jsx / cal-modal-*
 * classes). Every action below hits the real backend and the result feeds
 * straight back into Master Data — nothing here is local-only.
 *
 * Props:
 *  - booking, room            : data to display
 *  - onEdit, onDelete, onClose: existing actions
 *  - onCancelBooking()        : soft-cancel, frees the room, keeps the record
 *  - onAddExtra({label,amount})
 *  - onAddSettlement({amount,mode,note})
 *  - onEmail(), onPrint(), onContact()
 */
export default function BookingSlip({
  booking,
  room,
  onEdit,
  onDelete,
  onClose,
  onCancelBooking,
  onAddExtra,
  onAddSettlement,
  onEmail,
  onPrint,
  onContact,
  onSendMobileLink,
}) {
  const [openPanel, setOpenPanel] = useState(null); // "extra" | "settlement" | null
  const [extraLabel, setExtraLabel] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleMode, setSettleMode] = useState("Cash");
  const [settleNote, setSettleNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!booking) return null;

  const nights = booking.nights ?? nightsBetween(booking.checkIn, booking.checkOut);
  const hasBilling = booking.totalAmount !== undefined && booking.totalAmount !== null;
  const statusCls = STATUS_CLASS[booking.paymentStatus] || "slip-status-pending";
  const guestLine = [booking.phone, booking.email].filter(Boolean).join(" · ");
  const guestsLine = booking.adults
    ? `${booking.adults} Adult${booking.adults > 1 ? "s" : ""}${booking.children ? `, ${booking.children} Child${booking.children > 1 ? "ren" : ""}` : ""}`
    : "—";
  const idLine = [booking.idType, booking.idNumber].filter(Boolean).join(" · ");
  const isCancelled = booking.status === "cancelled";

  async function submitExtra(e) {
    e.preventDefault();
    if (!extraLabel.trim() || !Number(extraAmount)) return;
    setBusy(true);
    await onAddExtra?.({ label: extraLabel.trim(), amount: Number(extraAmount) });
    setBusy(false);
    setExtraLabel("");
    setExtraAmount("");
    setOpenPanel(null);
  }

  async function submitSettlement(e) {
    e.preventDefault();
    if (!Number(settleAmount)) return;
    setBusy(true);
    await onAddSettlement?.({ amount: Number(settleAmount), mode: settleMode, note: settleNote.trim() });
    setBusy(false);
    setSettleAmount("");
    setSettleNote("");
    setOpenPanel(null);
  }

  return (
    <div className="booking-slip">
      <div className="slip-top">
        <span className="slip-avatar" style={{ background: booking.color || "var(--gradient-navy)" }}>
          {initials(booking.guest)}
        </span>
        <div className="slip-top-info">
          <h4>{booking.guest}</h4>
          <p>{guestLine || "No contact details on file"}</p>
        </div>
        {isCancelled && <span className="slip-status-pill slip-status-pending">Cancelled</span>}
        {!isCancelled && booking.paymentStatus && (
          <span className={`slip-status-pill ${statusCls}`}>{booking.paymentStatus}</span>
        )}
      </div>

      <div className="slip-section">
        <div className="slip-section-title">Stay Details</div>
        <div className="slip-grid">
          <div><span className="slip-label">Room</span><span className="slip-value">{booking.room}{room ? ` · ${room.type}` : booking.roomType ? ` · ${booking.roomType}` : ""}</span></div>
          <div><span className="slip-label">Check-in</span><span className="slip-value">{dash(booking.checkIn)}{booking.checkInTime ? ` · ${booking.checkInTime}` : ""}</span></div>
          <div><span className="slip-label">Check-out</span><span className="slip-value">{dash(booking.checkOut)}{booking.checkOutTime ? ` · ${booking.checkOutTime}` : ""}</span></div>
          <div><span className="slip-label">Nights</span><span className="slip-value">{dash(nights)}</span></div>
          <div><span className="slip-label">Guests</span><span className="slip-value">{guestsLine}</span></div>
          <div><span className="slip-label">Source</span><span className="slip-value">{booking.source || "Walk-in"}</span></div>
        </div>
      </div>

      <div className="slip-section">
        <div className="slip-section-title">Guest &amp; ID</div>
        <div className="slip-grid">
          <div><span className="slip-label">ID Proof</span><span className="slip-value">{idLine || "—"}</span></div>
          <div><span className="slip-label">Nationality</span><span className="slip-value">{dash(booking.nationality)}</span></div>
          <div className="slip-grid-span"><span className="slip-label">Address</span><span className="slip-value">{dash(booking.address)}</span></div>
          {booking.notes && (
            <div className="slip-grid-span"><span className="slip-label">Notes</span><span className="slip-value">{booking.notes}</span></div>
          )}
        </div>
      </div>

      {(booking.digitalSignature || booking.signature) && (
        <div className="slip-section">
          <div className="slip-section-title">Verified Guest Digital Signature</div>
          <div style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 8, padding: 10, display: "inline-block", marginTop: 4 }}>
            <img
              src={booking.digitalSignature || booking.signature}
              alt="Guest Digital Signature"
              style={{ maxHeight: 75, maxWidth: 280, objectFit: "contain", display: "block" }}
            />
            <div style={{ fontSize: 10, color: "#0284c7", marginTop: 4, fontWeight: "800" }}>
              ✓ Contactless Digital Signature Captured &amp; Verified
            </div>
          </div>
        </div>
      )}

      {hasBilling ? (
        <div className="slip-section">
          <div className="slip-section-title">Billing</div>
          <div className="slip-bill-rows">
            <div className="slip-bill-row"><span>Room ({dash(nights)} night{nights > 1 ? "s" : ""} × {money(booking.ratePerNight) || "—"})</span><span>{money(booking.subtotal) || "—"}</span></div>
            {Number(booking.discountAmount) > 0 && (
              <div className="slip-bill-row"><span>Discount ({dash(booking.discountPercent)}%)</span><span>-{money(booking.discountAmount)}</span></div>
            )}
            <div className="slip-bill-row"><span>Tax {booking.taxExempt ? "(Exempt)" : `(${dash(booking.taxPercent)}%)`}</span><span>{money(booking.taxAmount) || "—"}</span></div>
            {(booking.extras || []).map((ex) => (
              <div className="slip-bill-row" key={ex._id || ex.id || `${ex.label}-${ex.amount}`}>
                <span>Extra — {ex.label}</span><span>{money(ex.amount)}</span>
              </div>
            ))}
            {!booking.extras?.length && booking.extraCharges ? (
              <div className="slip-bill-row"><span>Extra Charges</span><span>{money(booking.extraCharges)}</span></div>
            ) : null}
            <div className="slip-bill-row slip-bill-total"><span>Total Amount</span><span>{money(booking.totalAmount)}</span></div>
            <div className="slip-bill-row"><span>Advance Paid{booking.paymentMethod ? ` (${booking.paymentMethod})` : ""}</span><span>{money(booking.advanceAmount) || "$0"}</span></div>
            <div className="slip-bill-row slip-bill-balance"><span>Balance Due</span><span>{money(booking.balanceDue) || "—"}</span></div>
          </div>
          {(booking.payments || []).length > 0 && (
            <div className="slip-payment-history">
              {booking.payments.map((p) => (
                <div className="slip-payment-row" key={p._id || p.id || `${p.date}-${p.amount}`}>
                  <span>{money(p.amount)} · {p.mode}</span>
                  <span className="slip-payment-note">{p.note || ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="slip-section">
          <div className="slip-section-title">Billing</div>
          <p className="slip-no-billing">No billing details were recorded for this booking. Edit it to add rate, tax, and payment info.</p>
        </div>
      )}

      {openPanel === "extra" && (
        <form className="slip-inline-form" onSubmit={submitExtra}>
          <div className="slip-inline-form-title">Add Extra Charge</div>
          <div className="slip-inline-form-row">
            <input type="text" placeholder="e.g. Mini bar, Laundry" value={extraLabel} onChange={(e) => setExtraLabel(e.target.value)} required />
            <input type="number" min="1" placeholder="$ Amount" value={extraAmount} onChange={(e) => setExtraAmount(e.target.value)} required />
          </div>
          <div className="slip-inline-form-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenPanel(null)}>Cancel</button>
            <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>{busy ? "Adding…" : "Add Charge"}</button>
          </div>
        </form>
      )}

      {openPanel === "settlement" && (
        <form className="slip-inline-form" onSubmit={submitSettlement}>
          <div className="slip-inline-form-title">Record Settlement / Payment</div>
          <div className="slip-inline-form-row">
            <input type="number" min="1" placeholder="$ Amount" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} required />
            <select value={settleMode} onChange={(e) => setSettleMode(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
            </select>
          </div>
          <input type="text" placeholder="Note (optional)" value={settleNote} onChange={(e) => setSettleNote(e.target.value)} />
          <div className="slip-inline-form-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenPanel(null)}>Cancel</button>
            <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>{busy ? "Saving…" : "Record Payment"}</button>
          </div>
        </form>
      )}

      <div className="slip-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenPanel((p) => (p === "extra" ? null : "extra"))} disabled={isCancelled}>
          <span className="btn-icon">➕</span> Extras
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenPanel((p) => (p === "settlement" ? null : "settlement"))} disabled={isCancelled}>
          <span className="btn-icon">💳</span> Settlement
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onEmail}>
          <span className="btn-icon">📧</span> Email
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onPrint}>
          <span className="btn-icon">🖨️</span> Print
        </button>
        {booking.status !== "checked-in" && booking.status !== "checkedin" && booking.status !== "occupied" && booking.status !== "checked-out" && booking.status !== "checkedout" && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onSendMobileLink?.(booking)}>
            <span className="btn-icon">📱</span> Send Link
          </button>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={onContact}>
          <span className="btn-icon">📞</span> Contact
        </button>
        {!isCancelled && (
          <button type="button" className="btn btn-danger-outline btn-sm" onClick={onCancelBooking}>
            <span className="btn-icon">🚫</span> Cancel Booking
          </button>
        )}
        <button type="button" className="btn btn-danger-outline btn-sm" onClick={onDelete}>
          <span className="btn-icon">🗑️</span> Delete
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-gold btn-sm" onClick={onEdit}>
          <span className="btn-icon">✏️</span> Edit Booking
        </button>
      </div>
    </div>
  );
}
