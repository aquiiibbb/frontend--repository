import { useState } from "react";
import OtaBadge from "./OtaBadge";
import { updateBooking, cancelBooking, getRoomsSync, getBookingsSync } from "../services/api";

export default function OverbookingModal({
  isOpen,
  onClose,
  overbookedReservations = [],
  roomsList = [],
  onOpenFolio,
  onRefreshBookings,
}) {
  const [selectedBookingForAssign, setSelectedBookingForAssign] = useState(null);
  const [selectedRoomNumber, setSelectedRoomNumber] = useState("");
  const [assigning, setAssigning] = useState(false);

  if (!isOpen) return null;

  const currentRooms = roomsList.length > 0 ? roomsList : getRoomsSync() || [];

  // Helper: Filter to ONLY vacant/available rooms for a specific booking date range
  const getVacantRoomsForBooking = (booking) => {
    if (!booking) return [];
    const allBookings = getBookingsSync() || [];
    const bIn = new Date(booking.checkIn);
    const bOut = new Date(booking.checkOut);

    const occupiedRoomNos = new Set();
    allBookings.forEach((res) => {
      if (res.id === booking.id) return;
      if (res.status === "cancelled") return;
      if (!res.room || res.room.toLowerCase().includes("unassigned")) return;

      const resIn = new Date(res.checkIn);
      const resOut = new Date(res.checkOut);

      if (resIn < bOut && resOut > bIn) {
        const roomNos = String(res.room).split(",").map((r) => r.trim());
        roomNos.forEach((rNo) => occupiedRoomNos.add(rNo));
      }
    });

    return currentRooms.filter((r) => {
      const rNoStr = String(r.no || r.number);
      const isOccupied = occupiedRoomNos.has(rNoStr);
      const isMaintenance = r.status && (r.status.toLowerCase().includes("out") || r.status.toLowerCase().includes("maint"));
      return !isOccupied && !isMaintenance;
    });
  };

  // Handle assigning a physical room to resolve overbooking
  const handleConfirmAssignment = async (booking) => {
    if (!selectedRoomNumber) {
      alert("Please select a physical room number to assign.");
      return;
    }

    setAssigning(true);
    try {
      const assignedRoomObj = currentRooms.find((r) => String(r.no || r.number) === String(selectedRoomNumber));

      await updateBooking(booking.id, {
        room: selectedRoomNumber,
        roomNumber: selectedRoomNumber,
        roomType: assignedRoomObj ? assignedRoomObj.type : booking.roomType,
        isOverbooking: false,
        notes: `${booking.notes || ""} [Overbooking resolved: Assigned to Room ${selectedRoomNumber}].`,
      });

      setSelectedBookingForAssign(null);
      setSelectedRoomNumber("");

      if (onRefreshBookings) onRefreshBookings();
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    } catch (e) {
      alert("Failed to assign room: " + e.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleCancelOverbooking = async (bookingId, guestName) => {
    if (window.confirm(`Are you sure you want to cancel overbooked reservation for ${guestName}?`)) {
      try {
        await cancelBooking(bookingId);
        if (onRefreshBookings) onRefreshBookings();
        window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
      } catch (e) {
        alert("Failed to cancel booking: " + e.message);
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "850px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "20px 24px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              ⚠️
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>
                  Overbooked Reservations Alert
                </h3>
                <span
                  style={{
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "700",
                  }}
                >
                  {overbookedReservations.length} Pending
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#64748b", fontWeight: "500" }}>
                Active OTA &amp; Direct bookings exceeding physical inventory or with conflicting room assignments.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "800",
              color: "#475569",
            }}
          >
            ✕
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* WARNING BANNER */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "14px 18px",
              fontSize: "13px",
              color: "#334155",
              fontWeight: "600",
              lineHeight: 1.5,
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "16px" }}>⚠️</span>
            <div>
              <strong style={{ color: "#0f172a" }}>Action Required:</strong> Select an unassigned overbooked guest below to assign an available vacant room (or upgrade to another room category), open guest folio, or relocate/cancel.
            </div>
          </div>

          {/* LIST OF OVERBOOKINGS */}
          {overbookedReservations.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#334155", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>🎉</div>
              <div style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>No Active Overbookings Found!</div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>All reservations have valid room assignments within capacity.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {overbookedReservations.map((b) => {
                const isSelectedForAssign = selectedBookingForAssign?.id === b.id;
                const sourceName = b.bookingSource || b.source || "Direct Hotel";
                const guestName = b.guest || b.guestName || "OTA Guest";
                const catName = b.roomType || b.category || "Standard Room";
                const refCode = b.otaReference || b.resCode || b.id || "RES-1001";
                const vacantRooms = isSelectedForAssign ? getVacantRoomsForBooking(b) : [];

                return (
                  <div
                    key={b.id || refCode}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <OtaBadge source={sourceName} size="sm" showText={false} />
                        <div>
                          <div style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>
                            {guestName}
                          </div>
                          <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>
                            Ref: <span style={{ color: "#0f172a", fontWeight: "700" }}>{refCode}</span> · Source: {sourceName}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            background: "#f1f5f9",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            padding: "4px 10px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                          }}
                        >
                          ⚠️ Room: {b.room && !b.room.toLowerCase().includes("unassigned") ? b.room : "Unassigned (Overbooked)"}
                        </span>
                        <span
                          style={{
                            background: "#f8fafc",
                            color: "#475569",
                            border: "1px solid #e2e8f0",
                            padding: "4px 10px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                          }}
                        >
                          Category: {catName}
                        </span>
                      </div>
                    </div>

                    {/* DETAILS ROW */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "10px",
                        padding: "10px 14px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12.5px",
                      }}
                    >
                      <div>
                        <span style={{ color: "#64748b", fontWeight: "600" }}>Check-In: </span>
                        <strong style={{ color: "#0f172a" }}>{b.checkIn}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontWeight: "600" }}>Check-Out: </span>
                        <strong style={{ color: "#0f172a" }}>{b.checkOut}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontWeight: "600" }}>Amount: </span>
                        <strong style={{ color: "#0f172a" }}>${b.totalAmount || b.amount || 150}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontWeight: "600" }}>Payment: </span>
                        <strong style={{ color: "#0f172a" }}>
                          {b.paidAmount > 0 ? "Paid Online" : "Pay at Hotel"}
                        </strong>
                      </div>
                    </div>

                    {/* ACTION BUTTONS / ASSIGN ROOM PANEL */}
                    {isSelectedForAssign ? (
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: "12px",
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#0f172a" }}>
                            🏷️ Select Vacant Room for {guestName} ({b.checkIn} to {b.checkOut}):
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569", background: "#ffffff", padding: "2px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                            {vacantRooms.length} Available
                          </span>
                        </div>

                        {vacantRooms.length === 0 ? (
                          <div style={{ padding: "16px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", color: "#475569", fontSize: "13px", fontWeight: "600", textAlign: "center" }}>
                            ⚠️ No physical vacant rooms available for these dates ({b.checkIn} to {b.checkOut}). Consider upgrading or relocating.
                          </div>
                        ) : (
                          <div
                            style={{
                              maxHeight: "200px",
                              overflowY: "auto",
                              border: "1px solid #cbd5e1",
                              borderRadius: "8px",
                              background: "#ffffff",
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            {vacantRooms.map((r) => {
                              const rNoStr = String(r.no || r.number);
                              const isSelected = selectedRoomNumber === rNoStr;
                              const isSameType = (r.type || "").toLowerCase() === (b.roomType || "").toLowerCase();

                              return (
                                <div
                                  key={rNoStr}
                                  onClick={() => setSelectedRoomNumber(rNoStr)}
                                  style={{
                                    padding: "10px 14px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    cursor: "pointer",
                                    background: isSelected ? "#f1f5f9" : "#ffffff",
                                    borderLeft: isSelected ? "4px solid #0f172a" : "4px solid transparent",
                                    borderBottom: "1px solid #f1f5f9",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div
                                      style={{
                                        fontWeight: "900",
                                        fontSize: "13.5px",
                                        color: "#0f172a",
                                        background: isSelected ? "#e2e8f0" : "#f1f5f9",
                                        padding: "4px 10px",
                                        borderRadius: "6px",
                                        border: "1px solid #cbd5e1",
                                      }}
                                    >
                                      Room {rNoStr}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                                        {r.type || "Standard Room"}
                                      </div>
                                      <div style={{ fontSize: "11.5px", color: "#64748b", fontWeight: "500" }}>
                                        Floor {r.floor || 1} {isSameType ? "· Exact Category Match" : "· Upgrade Category"}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "6px" }}>
                                      🟢 Vacant
                                    </span>
                                    {isSelected && <span style={{ fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>✓</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedBookingForAssign(null)}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "8px",
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              fontSize: "12.5px",
                              fontWeight: "700",
                              color: "#0f172a",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={assigning || !selectedRoomNumber}
                            onClick={() => handleConfirmAssignment(b)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "8px",
                              border: "1px solid #cbd5e1",
                              background: selectedRoomNumber ? "#f1f5f9" : "#f8fafc",
                              color: selectedRoomNumber ? "#0f172a" : "#94a3b8",
                              fontSize: "12.5px",
                              fontWeight: "800",
                              cursor: selectedRoomNumber ? "pointer" : "not-allowed",
                            }}
                          >
                            {assigning ? "Assigning..." : "Confirm Room Assignment"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const vacant = getVacantRoomsForBooking(b);
                            setSelectedBookingForAssign(b);
                            setSelectedRoomNumber(vacant[0] ? String(vacant[0].no || vacant[0].number) : "");
                          }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            background: "#f1f5f9",
                            color: "#0f172a",
                            border: "1px solid #cbd5e1",
                            fontSize: "12.5px",
                            fontWeight: "800",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          🏷️ Assign / Upgrade Room
                        </button>

                        {onOpenFolio && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenFolio(b);
                            }}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "8px",
                              background: "#f1f5f9",
                              color: "#0f172a",
                              border: "1px solid #cbd5e1",
                              fontSize: "12.5px",
                              fontWeight: "800",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            📑 View Folio
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCancelOverbooking(b.id, guestName)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            background: "#f1f5f9",
                            color: "#475569",
                            border: "1px solid #cbd5e1",
                            fontSize: "12.5px",
                            fontWeight: "800",
                            cursor: "pointer",
                          }}
                        >
                          ❌ Cancel / Relocate
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: "16px 24px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              background: "#f1f5f9",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              fontWeight: "800",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}

