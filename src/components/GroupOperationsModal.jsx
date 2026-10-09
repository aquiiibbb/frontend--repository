import { useState, useMemo, useEffect } from "react";
import { updateBooking } from "../services/api";
import CustomDatePicker from "./CustomDatePicker";
import "./groupOperationsModal.css";

export default function GroupOperationsModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  bookingsList = [],
  onGroupActionComplete,
}) {
  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newCheckIn, setNewCheckIn] = useState("");
  const [newCheckOut, setNewCheckOut] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Card");
  const [toast, setToast] = useState("");
  const [processing, setProcessing] = useState(false);

  // Extract all distinct groups from bookingsList
  const allAvailableGroups = useMemo(() => {
    if (!isOpen) return [];
    const map = new Map();
    (bookingsList || []).forEach((b) => {
      if (!b || b.isDeleted || b.status === "cancelled") return;
      const key = b.groupId || b.groupName;
      if (key && !map.has(key)) {
        map.set(key, {
          id: key,
          name: b.groupName || b.groupId,
          groupId: b.groupId,
          groupName: b.groupName,
        });
      }
    });
    return Array.from(map.values());
  }, [isOpen, bookingsList]);

  // Set initial selected group key when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial = groupId || groupName || (allAvailableGroups[0]?.id || "");
      setSelectedGroupKey(initial);
      setSelectedRoomIds([]);
    }
  }, [isOpen, groupId, groupName, allAvailableGroups]);

  // Find all bookings belonging to the currently selected Group
  const groupBookings = useMemo(() => {
    if (!isOpen) return [];
    const targetKey = selectedGroupKey || groupId || groupName;
    if (!targetKey) return [];

    return (bookingsList || []).filter((b) => {
      if (!b || b.isDeleted || b.status === "cancelled") return false;
      return (
        (b.groupId && b.groupId === targetKey) ||
        (b.groupName && b.groupName === targetKey) ||
        (b.notes && b.notes.includes(`Group: ${targetKey}`))
      );
    });
  }, [isOpen, selectedGroupKey, groupId, groupName, bookingsList]);

  if (!isOpen) return null;

  const firstBooking = groupBookings[0] || {};
  const currentGroupName = firstBooking.groupName || selectedGroupKey || groupName || "Group Reservation";

  // Summary Metrics
  const totalRooms = groupBookings.length;
  const checkedInCount = groupBookings.filter((b) => b.status === "checked-in" || b.status === "occupied").length;
  const totalRevenue = groupBookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
  const totalBalanceDue = groupBookings.reduce((sum, b) => sum + Number(b.balanceDue || 0), 0);

  // Toggle selection for individual room checkboxes
  const toggleSelectRoom = (bId) => {
    setSelectedRoomIds((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRoomIds.length === groupBookings.length) {
      setSelectedRoomIds([]);
    } else {
      setSelectedRoomIds(groupBookings.map((b) => b.id));
    }
  };

  const getTargetBookings = () => {
    if (selectedRoomIds.length > 0) {
      return groupBookings.filter((b) => selectedRoomIds.includes(b.id));
    }
    return groupBookings;
  };

  // Helper trigger event and complete action
  const finalizeGroupAction = (message) => {
    setToast(message);
    window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    window.dispatchEvent(new CustomEvent("storage"));
    onGroupActionComplete?.();
    setTimeout(() => {
      setToast("");
      setProcessing(false);
    }, 2500);
  };

  // 1. EXPRESS GROUP CHECK-IN
  const handleExpressGroupCheckIn = async () => {
    const targets = getTargetBookings().filter(
      (b) => b.status === "confirmed" || b.status === "reserved" || b.status === "new"
    );

    if (targets.length === 0) {
      alert("No confirmed rooms available to check in.");
      return;
    }

    if (!window.confirm(`Check-in ${targets.length} room(s) for group "${currentGroupName}"?`)) return;

    setProcessing(true);
    for (const b of targets) {
      await updateBooking(b.id, {
        status: "checked-in",
        checkInTime: new Date().toTimeString().slice(0, 5),
      });
    }

    finalizeGroupAction(`Successfully Checked-In ${targets.length} Group Room(s)!`);
  };

  // 2. EXPRESS GROUP CHECK-OUT
  const handleExpressGroupCheckOut = async () => {
    const targets = getTargetBookings().filter(
      (b) => b.status === "checked-in" || b.status === "occupied"
    );

    if (targets.length === 0) {
      alert("No currently checked-in rooms available to check out.");
      return;
    }

    if (!window.confirm(`Check-out ${targets.length} room(s) for group "${currentGroupName}"?`)) return;

    setProcessing(true);
    for (const b of targets) {
      await updateBooking(b.id, {
        status: "checked-out",
        balanceDue: 0,
        paymentStatus: "Paid",
        checkOutTime: new Date().toTimeString().slice(0, 5),
      });
    }

    finalizeGroupAction(`Successfully Checked-Out ${targets.length} Group Room(s)!`);
  };

  // 3. GROUP DATE SHIFT (CHECK-IN & CHECK-OUT DATES)
  const handleOpenDateModal = () => {
    setNewCheckIn(firstBooking.checkIn || "");
    setNewCheckOut(firstBooking.checkOut || "");
    setShowDateModal(true);
  };

  const handleApplyGroupDateShift = async () => {
    if (!newCheckIn || !newCheckOut) {
      alert("Please select both Check-In and Check-Out dates.");
      return;
    }

    if (newCheckOut <= newCheckIn) {
      alert("Check-Out date must be after Check-In date.");
      return;
    }

    const targets = getTargetBookings();
    setProcessing(true);

    for (const b of targets) {
      const checkInDate = new Date(newCheckIn);
      const checkOutDate = new Date(newCheckOut);
      const nights = Math.max(1, Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
      const rate = Number(b.ratePerNight || (b.subtotal / Math.max(1, b.nights || 1)));
      const subtotal = rate * nights;
      const taxAmount = Math.round(subtotal * 0.12);
      const totalAmount = subtotal + taxAmount;
      const paymentMade = Number(b.totalAmount || 0) - Number(b.balanceDue || 0);

      await updateBooking(b.id, {
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        nights,
        subtotal,
        taxAmount,
        totalAmount,
        balanceDue: Math.max(0, totalAmount - paymentMade),
      });
    }

    setShowDateModal(false);
    finalizeGroupAction(`Updated Group Dates to ${newCheckIn} → ${newCheckOut} for ${targets.length} Room(s)!`);
  };

  // 4. GROUP MASTER PAYMENT
  const handleApplyGroupPayment = async () => {
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    const targets = getTargetBookings();
    setProcessing(true);

    let remainingPayment = amt;
    for (const b of targets) {
      if (remainingPayment <= 0) break;
      const currentBal = Number(b.balanceDue || 0);
      const applyAmt = Math.min(remainingPayment, currentBal > 0 ? currentBal : b.totalAmount);
      const newBal = Math.max(0, currentBal - applyAmt);

      await updateBooking(b.id, {
        balanceDue: newBal,
        paymentStatus: newBal === 0 ? "Paid" : "Partial",
        notes: `${b.notes || ""} [Group Payment ${paymentMode}: $${applyAmt.toFixed(2)}]`,
      });

      remainingPayment -= applyAmt;
    }

    setShowPaymentModal(false);
    setPaymentAmount("");
    finalizeGroupAction(`Posted $${amt.toFixed(2)} Group Payment across ${targets.length} Room(s)!`);
  };

  // 5. GROUP CANCELLATION
  const handleGroupCancel = async () => {
    const targets = getTargetBookings().filter((b) => b.status !== "cancelled");
    if (targets.length === 0) return alert("No active rooms to cancel.");

    const reason = window.prompt(`Enter Cancellation Reason for Group "${currentGroupName}":`, "Group Event Cancelled");
    if (reason === null) return;

    setProcessing(true);
    for (const b of targets) {
      await updateBooking(b.id, {
        status: "cancelled",
        notes: `${b.notes || ""} [Cancelled: ${reason}]`,
      });
    }

    finalizeGroupAction(`Cancelled ${targets.length} Group Room(s).`);
  };

  // 6. GROUP NO-SHOW
  const handleGroupNoShow = async () => {
    const targets = getTargetBookings().filter((b) => b.status === "confirmed" || b.status === "reserved");
    if (targets.length === 0) return alert("No confirmed rooms to mark as No-Show.");

    if (!window.confirm(`Mark ${targets.length} room(s) as No-Show for Group "${currentGroupName}"?`)) return;

    setProcessing(true);
    for (const b of targets) {
      await updateBooking(b.id, {
        status: "no-show",
        notes: `${b.notes || ""} [Group No-Show Processed]`,
      });
    }

    finalizeGroupAction(`Marked ${targets.length} Group Room(s) as No-Show.`);
  };

  // Helper: Format date as MM/DD/YYYY
  const formatDateMMDDYYYY = (dateStr) => {
    if (!dateStr) return "";
    const parts = String(dateStr).trim().split(/[-/.]/);
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[1].padStart(2, "0")}/${parts[2].padStart(2, "0")}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    }
    return dateStr;
  };

  return (
    <div className="gom-backdrop">
      <div className="gom-card" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="gom-header">
          <div className="gom-header-title">
            <h2>🏢 Group Master Operations</h2>

            {/* MULTI-GROUP FILTER SELECTOR DROPDOWN */}
            {allAvailableGroups.length > 1 ? (
              <select
                className="gom-group-select"
                value={selectedGroupKey}
                onChange={(e) => {
                  setSelectedGroupKey(e.target.value);
                  setSelectedRoomIds([]);
                }}
              >
                {allAvailableGroups.map((g) => {
                  const rCount = (bookingsList || []).filter(
                    (b) => (b.groupId === g.id || b.groupName === g.name) && b.status !== "cancelled" && !b.isDeleted
                  ).length;
                  return (
                    <option key={g.id} value={g.id}>
                      🏢 {g.name} ({rCount} Rooms)
                    </option>
                  );
                })}
              </select>
            ) : (
              <span className="tag">{currentGroupName}</span>
            )}
          </div>
          <button type="button" className="gom-close" onClick={onClose}>×</button>
        </div>

        {toast && (
          <div style={{ background: "#000000", color: "#ffffff", padding: "10px 20px", textAlign: "center", fontWeight: "800", fontSize: "13px" }}>
            {toast}
          </div>
        )}

        <div className="gom-body">
          {/* TOP KPI METRICS */}
          <div className="gom-kpi-strip">
            <div className="gom-kpi-card">
              <span className="lbl">Total Group Rooms</span>
              <strong className="val">{totalRooms} Rooms</strong>
            </div>

            <div className="gom-kpi-card">
              <span className="lbl">Checked-In Status</span>
              <strong className="val">{checkedInCount} / {totalRooms} In-House</strong>
            </div>

            <div className="gom-kpi-card">
              <span className="lbl">Total Group Revenue</span>
              <strong className="val">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </div>

            <div className="gom-kpi-card">
              <span className="lbl">Master Balance Due</span>
              <strong className="val">${totalBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          {/* MASTER ACTIONS BAR */}
          <div className="gom-actions-bar">
            <button
              type="button"
              className="gom-action-btn dark"
              onClick={handleExpressGroupCheckIn}
              disabled={processing}
            >
              🔑 Express Check-In Group ({selectedRoomIds.length || totalRooms})
            </button>

            <button
              type="button"
              className="gom-action-btn dark"
              onClick={handleExpressGroupCheckOut}
              disabled={processing}
            >
              🚗 Express Check-Out Group ({selectedRoomIds.length || totalRooms})
            </button>

            <button
              type="button"
              className="gom-action-btn outline"
              onClick={handleOpenDateModal}
              disabled={processing}
            >
              📅 Group Date Shift (Extend / Shorten)
            </button>

            <button
              type="button"
              className="gom-action-btn outline"
              onClick={() => setShowPaymentModal(true)}
              disabled={processing}
            >
              💳 Group Master Payment
            </button>

            <button
              type="button"
              className="gom-action-btn outline"
              onClick={handleGroupNoShow}
              disabled={processing}
            >
              👻 Mark Group No-Show
            </button>

            <button
              type="button"
              className="gom-action-btn outline"
              onClick={handleGroupCancel}
              disabled={processing}
            >
              🚫 Cancel Group Block
            </button>
          </div>

          {/* GROUP ROOMS LIST TABLE (Scrollable Container) */}
          <div className="gom-table-card">
            <table className="gom-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedRoomIds.length === groupBookings.length && groupBookings.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>ROOM #</th>
                  <th>GUEST NAME</th>
                  <th>CATEGORY</th>
                  <th>DATES</th>
                  <th>STATUS</th>
                  <th>TOTAL REVENUE</th>
                  <th>BALANCE DUE</th>
                </tr>
              </thead>
              <tbody>
                {groupBookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "#64748b", fontStyle: "italic" }}>
                      No active rooms found for this selected group. Select another group from the top dropdown.
                    </td>
                  </tr>
                ) : (
                  groupBookings.map((b) => {
                    const isChecked = selectedRoomIds.includes(b.id);
                    return (
                      <tr key={b.id}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectRoom(b.id)}
                          />
                        </td>
                        <td><strong>Room {b.room}</strong></td>
                        <td><strong>{b.guest}</strong></td>
                        <td>{b.roomType}</td>
                        <td>{formatDateMMDDYYYY(b.checkIn)} → {formatDateMMDDYYYY(b.checkOut)}</td>
                        <td>
                          <span className="gom-badge">{b.status}</span>
                        </td>
                        <td><strong>${Number(b.totalAmount || 0).toFixed(2)}</strong></td>
                        <td><strong>${Number(b.balanceDue || 0).toFixed(2)}</strong></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="gom-footer">
          <button
            type="button"
            className="gom-action-btn outline"
            onClick={onClose}
          >
            Close Panel
          </button>
        </div>
      </div>

      {/* GROUP DATE SHIFT MODAL (BOTH CHECK-IN & CHECK-OUT DATES) */}
      {showDateModal && (
        <div className="gom-backdrop" >
          <div className="gom-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="gom-header">
              <h2>📅 Group Date Shift</h2>
              <button className="gom-close" onClick={() => setShowDateModal(false)}>×</button>
            </div>
            <div className="gom-body">
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                Select new arrival and departure dates for {selectedRoomIds.length || totalRooms} Group Room(s):
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 800, color: "#000000", display: "block", marginBottom: 4 }}>
                    New Check-In Date (Arrival)
                  </label>
                  <CustomDatePicker
                    value={newCheckIn}
                    onChange={(e) => setNewCheckIn(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 800, color: "#000000", display: "block", marginBottom: 4 }}>
                    New Check-Out Date (Departure)
                  </label>
                  <CustomDatePicker
                    value={newCheckOut}
                    onChange={(e) => setNewCheckOut(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="gom-footer">
              <button type="button" className="gom-action-btn outline" onClick={() => setShowDateModal(false)}>Cancel</button>
              <button type="button" className="gom-action-btn dark" onClick={handleApplyGroupDateShift}>Apply Date Shift</button>
            </div>
          </div>
        </div>
      )}

      {/* GROUP MASTER PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="gom-backdrop" >
          <div className="gom-card" style={{ maxWidth: 450 }} onClick={(e) => e.stopPropagation()}>
            <div className="gom-header">
              <h2>💳 Post Group Payment</h2>
              <button className="gom-close" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>
            <div className="gom-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800 }}>Payment Amount ($)</label>
                  <input
                    type="number"
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 4, fontSize: 14, fontWeight: 800, color: "#000000" }}
                    placeholder="e.g. 500.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 800 }}>Payment Mode</label>
                  <select
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 4, fontSize: 13, fontWeight: 800, color: "#000000" }}
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="Card">Credit / Debit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer / UPI</option>
                    <option value="Company Ledger">Company Ledger Direct Bill</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="gom-footer">
              <button type="button" className="gom-action-btn outline" onClick={() => setShowPaymentModal(false)}>Cancel</button>
              <button type="button" className="gom-action-btn dark" onClick={handleApplyGroupPayment}>Process Group Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
