import { useState, useMemo } from "react";
import CustomDatePicker from "./CustomDatePicker";
import "./groupBookingModal.css";
import AddCompanyModal from "./AddCompanyModal";
import { UNIFIED_PAYMENT_METHODS, getEnabledPaymentMethods } from "../constants/paymentMethods";
import { getCompanyAccounts } from "../services/companyAccounts";
import { getBusinessDate, generateNextSequence } from "../services/hotelConfig";

export default function GroupBookingModal({
  isOpen,
  onClose,
  rooms = [],
  roomTypes = [],
  bookingsList = [],
  onGroupBookingCreated,
}) {
  const activeBizDate = getBusinessDate();
  const dBiz = new Date(`${activeBizDate}T00:00:00`);
  dBiz.setDate(dBiz.getDate() + 1);
  const yyyyNext = dBiz.getFullYear();
  const mmNext = String(dBiz.getMonth() + 1).padStart(2, "0");
  const ddNext = String(dBiz.getDate()).padStart(2, "0");
  const tomorrowISO = `${yyyyNext}-${mmNext}-${ddNext}`;
  const todayISO = activeBizDate;

  const [step, setStep] = useState(1);
  const [companyAccounts, setCompanyAccounts] = useState(() => getCompanyAccounts());
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [formData, setFormData] = useState({
    groupName: "",
    contactName: "",
    phone: "",
    email: "",
    companyName: "",
    gstNumber: "",
    source: "Corporate",
    ratePlan: "Group Discounted Plan",
    checkIn: todayISO,
    checkOut: tomorrowISO,
    selectedRooms: [], // list of room numbers string
    roomAllocations: {}, // { [roomNo]: { guestName, rate, adults } }
    billingType: "Master Account", // Master Account | Individual
    advanceAmount: 0,
    paymentMode: "Card",
    companyAccountId: "",
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    notes: "",
    isGroupEnquiry: false,
    expiryDate: todayISO,
    expiryTime: "18:00",
  });

  // Filter available rooms for selected checkIn/checkOut
  const availableRoomsMap = useMemo(() => {
    if (!isOpen) return {};
    const { checkIn, checkOut } = formData;
    const map = {};
    (rooms || []).forEach((r) => {
      const rNum = String(r.no ?? r.number ?? r.roomNumber ?? r.id ?? "").replace(/^Room\s+/i, "").trim().toLowerCase();
      const conflict = (bookingsList || []).some((b) => {
        const st = String(b?.status || "").toLowerCase();
        if (!b || st === "cancelled" || st === "enquiry" || st === "inquiry") return false;
        const bNum = String(b.room || b.roomNumber || "").replace(/^Room\s+/i, "").trim().toLowerCase();
        return bNum === rNum && checkIn < b.checkOut && checkOut > b.checkIn;
      });
      map[r.no || r.number || r.id] = !conflict;
    });
    return map;
  }, [isOpen, rooms, bookingsList, formData.checkIn, formData.checkOut]);

  // Group rooms by category
  const roomsByCategory = useMemo(() => {
    if (!isOpen) return {};
    const map = {};
    (rooms || []).forEach((r) => {
      if (!map[r.type]) map[r.type] = [];
      map[r.type].push(r);
    });
    return map;
  }, [isOpen, rooms]);

  if (!isOpen) return null;

  function handleChange(field, val) {
    setFormData((prev) => ({ ...prev, [field]: val }));
  }

  function toggleRoomSelection(roomNo) {
    setFormData((prev) => {
      const current = prev.selectedRooms;
      const isSelected = current.includes(roomNo);
      let updated;
      if (isSelected) {
        updated = current.filter((no) => no !== roomNo);
      } else {
        updated = [...current, roomNo];
      }

      // Sync roomAllocations default
      const rObj = rooms.find((r) => r.no === roomNo);
      const rtObj = roomTypes.find((t) => t.name === rObj?.type);
      const defaultRate = rtObj?.price ? Math.round(rtObj.price * 0.85) : 3000; // 15% group discount default

      const newAllocations = { ...prev.roomAllocations };
      if (!isSelected && !newAllocations[roomNo]) {
        newAllocations[roomNo] = {
          guestName: prev.groupName ? `${prev.groupName} Guest (${roomNo})` : `Guest Room ${roomNo}`,
          rate: defaultRate,
          adults: 2,
        };
      }

      return { ...prev, selectedRooms: updated, roomAllocations: newAllocations };
    });
  }

  function handleAllocationChange(roomNo, field, val) {
    setFormData((prev) => ({
      ...prev,
      roomAllocations: {
        ...prev.roomAllocations,
        [roomNo]: {
          ...(prev.roomAllocations[roomNo] || {}),
          [field]: val,
        },
      },
    }));
  }

  // Calculate Group Totals
  const nights = Math.max(
    1,
    Math.round(
      (new Date(formData.checkOut) - new Date(formData.checkIn)) / (1000 * 60 * 60 * 24)
    )
  );

  const totalNights = isNaN(nights) ? 1 : nights;

  const groupTotalSubtotal = formData.selectedRooms.reduce((sum, rNo) => {
    const rate = Number(formData.roomAllocations[rNo]?.rate || 0);
    return sum + rate * totalNights;
  }, 0);

  const taxAmount = Math.round(groupTotalSubtotal * 0.12);
  const grandTotal = groupTotalSubtotal + taxAmount;
  const balanceDue = Math.max(0, grandTotal - Number(formData.advanceAmount || 0));

  function handleConfirmGroupBooking() {
    if (!formData.groupName) return alert("Please enter Group Name");
    if (formData.selectedRooms.length === 0) return alert("Please select at least 1 room for the group");

    const groupId = generateNextSequence("group");
    const groupColor = "#8B5CF6"; // Purple theme for groups

    const groupBookings = formData.selectedRooms.map((rNo, idx) => {
      const alloc = formData.roomAllocations[rNo] || {};
      const rObj = rooms.find((r) => r.no === rNo);
      const roomSubtotal = Number(alloc.rate || 3000) * totalNights;
      const roomTax = Math.round(roomSubtotal * 0.12);
      const roomTotal = roomSubtotal + roomTax;
      
      // Master Account vs Individual Billing handling (ITEM 7 MATCH)
      const isMasterBilling = formData.billingType === "Master Account";
      let perRoomAdvance = 0;
      let roomBalanceDue = 0;

      if (isMasterBilling) {
        // Master Account: Master room (idx === 0) holds group advance & master balance responsibility
        perRoomAdvance = idx === 0 ? Number(formData.advanceAmount || 0) : 0;
        roomBalanceDue = idx === 0 ? Math.max(0, grandTotal - perRoomAdvance) : 0;
      } else {
        // Individual Billing: Advance payment & balance split independently per room
        perRoomAdvance = Math.round((Number(formData.advanceAmount || 0) / formData.selectedRooms.length) * 100) / 100;
        roomBalanceDue = Math.max(0, roomTotal - perRoomAdvance);
      }

      return {
        id: generateNextSequence("booking"),
        groupId,
        groupName: formData.groupName,
        guest: alloc.guestName || `${formData.groupName} Guest ${idx + 1}`,
        phone: formData.phone,
        email: formData.email,
        companyName: formData.companyName || formData.groupName,
        gstNumber: formData.gstNumber,
        room: rNo,
        roomType: rObj?.type || "Standard",
        checkIn: formData.checkIn,
        checkOut: formData.checkOut,
        checkInTime: "12:00",
        checkOutTime: "11:00",
        status: formData.isGroupEnquiry ? "enquiry" : "confirmed",
        isEnquiry: Boolean(formData.isGroupEnquiry),
        isGroupEnquiry: Boolean(formData.isGroupEnquiry),
        expiryDate: formData.isGroupEnquiry ? (formData.expiryDate || formData.checkIn) : undefined,
        expiryTime: formData.isGroupEnquiry ? (formData.expiryTime || "18:00") : undefined,
        color: groupColor,
        source: formData.source,
        ratePlan: formData.ratePlan,
        ratePerNight: Number(alloc.rate || 3000),
        nights: totalNights,
        subtotal: roomSubtotal,
        taxPercent: 12,
        taxAmount: roomTax,
        totalAmount: roomTotal,
        advanceAmount: perRoomAdvance,
        balanceDue: roomBalanceDue,
        billingType: formData.billingType,
        paymentStatus: perRoomAdvance >= roomTotal ? "Paid" : perRoomAdvance > 0 ? "Partial" : "Pending",
        notes: `[Group: ${formData.groupName}] Billing: ${formData.billingType}. ${formData.notes}`,
        isGroupMaster: idx === 0,
      };
    });

    onGroupBookingCreated?.(groupBookings, {
      groupId,
      groupName: formData.groupName,
      contactName: formData.contactName,
      phone: formData.phone,
      email: formData.email,
      totalRooms: formData.selectedRooms.length,
      grandTotal,
      advanceAmount: formData.advanceAmount,
      balanceDue,
    });

    onClose();
  }

  return (
    <div className="gbm-overlay">
      <div className="gbm-card" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="gbm-header">
          <div className="gbm-header-title">
            <span className="gbm-header-icon">👥</span>
            <div>
              <h2>Create Group Reservation</h2>
              <p>Reserve multiple rooms under one master account or corporate entity</p>
            </div>
          </div>
          <button type="button" className="gbm-close" onClick={onClose}>✕</button>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className="gbm-steps-bar">
          <div className={`gbm-step-item ${step >= 1 ? "active" : ""}`}>
            <span className="step-num">1</span>
            <span className="step-txt">Group Details</span>
          </div>
          <div className="gbm-step-line" />
          <div className={`gbm-step-item ${step >= 2 ? "active" : ""}`}>
            <span className="step-num">2</span>
            <span className="step-txt">Rooms &amp; Dates</span>
          </div>
          <div className="gbm-step-line" />
          <div className={`gbm-step-item ${step >= 3 ? "active" : ""}`}>
            <span className="step-num">3</span>
            <span className="step-txt">Guest List</span>
          </div>
          <div className="gbm-step-line" />
          <div className={`gbm-step-item ${step >= 4 ? "active" : ""}`}>
            <span className="step-num">4</span>
            <span className="step-txt">Billing &amp; Deposit</span>
          </div>
        </div>

        {/* STEP BODY CONTENT */}
        <div className="gbm-body">
          {/* STEP 1: GROUP & CONTACT DETAILS */}
          {step === 1 && (
            <div className="gbm-step-content">
              <div className="gbm-form-row">
                <div className="gbm-field full">
                  <label>Group / Company Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma Wedding Party / TCS Tech Conference"
                    value={formData.groupName}
                    onChange={(e) => handleChange("groupName", e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {/* GROUP ENQUIRY TOGGLE BOX */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#1e293b" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(formData.isGroupEnquiry)}
                    onChange={(e) => handleChange("isGroupEnquiry", e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span>📌 Save as Group Enquiry (Temporary Hold / Quotation)</span>
                </label>

                {formData.isGroupEnquiry && (
                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="gbm-field">
                      <label>EXPIRY DATE *</label>
                      <CustomDatePicker
                        name="expiryDate"
                        value={formData.expiryDate || formData.checkIn}
                        onChange={(e) => handleChange("expiryDate", e.target.value)}
                      />
                    </div>
                    <div className="gbm-field">
                      <label>EXPIRY TIME</label>
                      <select
                        value={formData.expiryTime || "18:00"}
                        onChange={(e) => handleChange("expiryTime", e.target.value)}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                      >
                        <option value="12:00">🕒 12:00 PM</option>
                        <option value="15:00">🕒 03:00 PM</option>
                        <option value="18:00">🕒 06:00 PM</option>
                        <option value="21:00">🕒 09:00 PM</option>
                        <option value="23:59">🕒 11:59 PM</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="gbm-form-row two-col">
                <div className="gbm-field">
                  <label>Primary Contact Person *</label>
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={formData.contactName}
                    onChange={(e) => handleChange("contactName", e.target.value)}
                  />
                </div>
                <div className="gbm-field">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 234-5678"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="gbm-form-row two-col">
                <div className="gbm-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="organizer@company.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
                <div className="gbm-field">
                  <label>Booking Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => handleChange("source", e.target.value)}
                  >
                    <option value="Corporate">Corporate Direct</option>
                    <option value="Wedding / Event">Wedding / Event</option>
                    <option value="Travel Agent">Travel Agent</option>
                    <option value="Direct Walk-in">Direct Walk-in</option>
                  </select>
                </div>
              </div>

              <div className="gbm-form-row two-col">
                <div className="gbm-field">
                  <label>Company / Organization Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tata Consultancy Services"
                    value={formData.companyName}
                    onChange={(e) => handleChange("companyName", e.target.value)}
                  />
                </div>
                <div className="gbm-field">
                  <label>GST Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="23AAAAA0000A1Z5"
                    value={formData.gstNumber}
                    onChange={(e) => handleChange("gstNumber", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DATES & ROOM MATRIX */}
          {step === 2 && (
            <div className="gbm-step-content">
              <div className="gbm-dates-strip">
                <div className="gbm-field">
                  <label>Check-In Date</label>
                  <CustomDatePicker
                    value={formData.checkIn}
                    onChange={(e) => handleChange("checkIn", e.target.value)}
                  />
                </div>
                <div className="gbm-nights-badge">
                  <span>{totalNights} Night{totalNights > 1 ? "s" : ""}</span>
                </div>
                <div className="gbm-field">
                  <label>Check-Out Date</label>
                  <CustomDatePicker
                    value={formData.checkOut}
                    onChange={(e) => handleChange("checkOut", e.target.value)}
                  />
                </div>
              </div>

              <div className="gbm-selection-summary">
                Selected Rooms: <strong>{formData.selectedRooms.length} room(s)</strong>
                {formData.selectedRooms.length > 0 && (
                  <span className="gbm-selected-pills">
                    {formData.selectedRooms.map((no) => (
                      <span key={no} className="gbm-pill">Room {no}</span>
                    ))}
                  </span>
                )}
              </div>

              <div className="gbm-room-matrix-container">
                {Object.entries(roomsByCategory).map(([catName, roomList]) => (
                  <div key={catName} className="gbm-category-group">
                    <div className="gbm-category-title">{catName}</div>
                    <div className="gbm-rooms-grid">
                      {roomList.map((r) => {
                        const isAvailable = availableRoomsMap[r.no];
                        const isSelected = formData.selectedRooms.includes(r.no);

                        return (
                          <button
                            type="button"
                            key={r.no}
                            disabled={!isAvailable}
                            className={`gbm-room-card ${isSelected ? "selected" : ""} ${!isAvailable ? "booked" : ""}`}
                            onClick={() => isAvailable && toggleRoomSelection(r.no)}
                          >
                            <span className="gbm-room-no">{r.no}</span>
                            <span className="gbm-room-status">
                              {isSelected ? "✓ Selected" : isAvailable ? "Available" : "Booked"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: GUEST ALLOCATION & RATES */}
          {step === 3 && (
            <div className="gbm-step-content">
              <div className="gbm-allocation-intro">
                <p>Assign primary occupant name and rate per night for each reserved room:</p>
              </div>

              <div className="gbm-allocation-table-wrap">
                <table className="gbm-allocation-table">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>Room Type</th>
                      <th>Occupant / Guest Name</th>
                      <th>Rate / Night ($)</th>
                      <th>Adults</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.selectedRooms.map((rNo) => {
                      const rObj = rooms.find((r) => r.no === rNo);
                      const alloc = formData.roomAllocations[rNo] || {};

                      return (
                        <tr key={rNo}>
                          <td><strong>Room {rNo}</strong></td>
                          <td>{rObj?.type}</td>
                          <td>
                            <input
                              type="text"
                              value={alloc.guestName || ""}
                              onChange={(e) => handleAllocationChange(rNo, "guestName", e.target.value)}
                              placeholder={`Guest Room ${rNo}`}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              style={{ width: 100 }}
                              value={alloc.rate || 3000}
                              onChange={(e) => handleAllocationChange(rNo, "rate", e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              value={alloc.adults || 2}
                              onChange={(e) => handleAllocationChange(rNo, "adults", Number(e.target.value))}
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                <option key={n} value={n}>{n} Adult{n > 1 ? "s" : ""}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: BILLING & DEPOSIT */}
          {step === 4 && (
            <div className="gbm-step-content">
              <div className="gbm-billing-cards">
                <div
                  className={`gbm-billing-tile ${formData.billingType === "Master Account" ? "selected" : ""}`}
                  onClick={() => handleChange("billingType", "Master Account")}
                >
                  <span className="gbm-b-icon">🏢</span>
                  <div>
                    <strong>Master Group Account</strong>
                    <p>All room tariffs &amp; taxes are routed to the central Group Master Folio.</p>
                  </div>
                </div>

                <div
                  className={`gbm-billing-tile ${formData.billingType === "Individual" ? "selected" : ""}`}
                  onClick={() => handleChange("billingType", "Individual")}
                >
                  <span className="gbm-b-icon">👤</span>
                  <div>
                    <strong>Individual Guest Billing</strong>
                    <p>Each guest pays their room tariff separately upon checkout.</p>
                  </div>
                </div>
              </div>

              <div className="gbm-form-row two-col" style={{ marginTop: 16 }}>
                <div className="gbm-field">
                  <label>Advance Deposit Amount ($)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.advanceAmount}
                    onChange={(e) => handleChange("advanceAmount", Number(e.target.value))}
                  />
                </div>
                <div className="gbm-field">
                  <label>Payment Mode</label>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => handleChange("paymentMode", e.target.value)}
                  >
                    {getEnabledPaymentMethods().map((pm) => (
                      <option key={pm.id} value={pm.name}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {["Company", "City Ledger", "POST TO COMPANY / CITY LEDGER"].includes(formData.paymentMode) && (
                <div style={{ background: "#f1f5f9", padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>Select Corporate Company Account *</label>
                  <select
                    value={formData.companyAccountId}
                    onChange={(e) => handleChange("companyAccountId", e.target.value)}
                    style={{ height: 38, borderRadius: 8, border: "1px solid #cbd5e1", background: "#ffffff", padding: "0 10px", fontSize: 13 }}
                    required
                  >
                    <option value="">-- Select Company / City Ledger Account --</option>
                    {companyAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        🏢 {c.name} (Acct #{c.accountNo}) · Credit Limit: ${Number(c.creditLimit).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {["Card", "Swipe", "CARD", "Offline Card", "OFFLINE CARD PAYMENT"].includes(formData.paymentMode) && (
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 0.8fr 0.8fr", gap: 12, marginTop: 12, background: "#f8fafc", padding: 14, borderRadius: 10, border: "1px solid #cbd5e1" }}>
                  <div className="gbm-field">
                    <label style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Cardholder Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Amit Kulkarni"
                      value={formData.cardName}
                      onChange={(e) => handleChange("cardName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="gbm-field">
                    <label style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Card Number *</label>
                    <input
                      type="text"
                      maxLength="19"
                      placeholder="•••• •••• •••• ••••"
                      value={formData.cardNumber}
                      onChange={(e) => handleChange("cardNumber", e.target.value)}
                      required
                    />
                  </div>
                  <div className="gbm-field">
                    <label style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Expiry (MM/YY) *</label>
                    <input
                      type="text"
                      maxLength="5"
                      placeholder="MM/YY"
                      value={formData.cardExpiry}
                      onChange={(e) => handleChange("cardExpiry", e.target.value)}
                      required
                    />
                  </div>
                  <div className="gbm-field">
                    <label style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>CVV *</label>
                    <input
                      type="password"
                      maxLength="4"
                      placeholder="•••"
                      value={formData.cardCvv}
                      onChange={(e) => handleChange("cardCvv", e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* SUMMARY BOX */}
              <div className="gbm-summary-box">
                <div className="gbm-summary-line">
                  <span>Total Rooms:</span>
                  <strong>{formData.selectedRooms.length} Rooms ({totalNights} Night{totalNights > 1 ? "s" : ""})</strong>
                </div>
                <div className="gbm-summary-line">
                  <span>Room Charges Subtotal:</span>
                  <span>${groupTotalSubtotal.toLocaleString()}</span>
                </div>
                <div className="gbm-summary-line">
                  <span>Estimated Taxes (12% GST):</span>
                  <span>${taxAmount.toLocaleString()}</span>
                </div>
                <div className="gbm-summary-line grand">
                  <span>Group Total Amount:</span>
                  <strong>${grandTotal.toLocaleString()}</strong>
                </div>
                <div className="gbm-summary-line">
                  <span>Advance Deposit:</span>
                  <span className="txt-success">-${Number(formData.advanceAmount || 0).toLocaleString()}</span>
                </div>
                <div className="gbm-summary-line due">
                  <span>Estimated Balance Due:</span>
                  <strong>${balanceDue.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="gbm-footer">
          {step > 1 && (
            <button type="button" className="btn btn-outline" onClick={() => setStep((s) => s - 1)}>
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 4 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (step === 1 && !formData.groupName) return alert("Please enter Group Name");
                if (step === 2 && formData.selectedRooms.length === 0) return alert("Please select at least 1 room");
                setStep((s) => s + 1);
              }}
            >
              Continue →
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={handleConfirmGroupBooking}>
              👥 Confirm Group Booking
            </button>
          )}
        </div>
      </div>

      <AddCompanyModal
        isOpen={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        onCompanyCreated={(newCompany) => {
          setCompanyAccounts(getCompanyAccounts());
          setFormData((prev) => ({ ...prev, companyAccountId: newCompany.id, paymentMode: "City Ledger" }));
        }}
      />
    </div>
  );
}
