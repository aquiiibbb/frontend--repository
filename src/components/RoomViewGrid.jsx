import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  getRoomLayoutOrder,
  saveRoomLayoutOrder,
  getRoomLayoutDimensions,
  saveRoomLayoutDimensions,
  getRoomLayoutCoords,
  saveRoomLayoutCoords,
  getStatusColors,
  getBusinessDate,
  isVirtualRoomOrBooking,
} from "../services/hotelConfig";
import {
  getBookingStatusColors,
  formatHoverDate,
  getHoverBadgeBg,
  getHoverBadgeColor,
  calcHoverNights,
} from "../pages/frontdesk/Calendar";
import OtaBadge from "./OtaBadge";
import { extractFacePhotoFromID } from "./AIIDScannerModal";
import {
  Sparkles,
  BedDouble,
  User,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  Move,
  Scaling,
  Grid
} from "lucide-react";
import "./roomViewGrid.css";
import "../pages/frontdesk/quickActionModal.css";

export default function RoomViewGrid({
  rooms = [],
  roomTypes = [],
  bookings = [],
  onOpenFolio,
  onOpenWalkin,
  onBlockRoom,
  onEditBlock,
  onRoomsUpdated,
}) {
  // Custom 2D coordinates layout map: { roomNo: { x: number, y: number } }
  const [coordsMap, setCoordsMap] = useState(() => getRoomLayoutCoords());
  // Custom dimensions map: { roomNo: { width: number, height: number } }
  const [dimensionsMap, setDimensionsMap] = useState(() => getRoomLayoutDimensions());

  const [statusColors, setStatusColors] = useState(() => getStatusColors());

  // Modal for vacant room actions (Book vs Block)
  const [vacantRoomModal, setVacantRoomModal] = useState(null);
  const dragMovedRef = useRef(false);

  // Hover card overlay state for room view tiles
  const [hoveredBooking, setHoveredBooking] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [hoverFaceMap, setHoverFaceMap] = useState({});
  const [imgErrorMap, setImgErrorMap] = useState({});



  function handleTileMouseEnter(e, room, occ) {
    if (activeDraggingRoomNo || resizingState) return;
    const targetBk = occ.booking;
    if (!targetBk) {
      setHoveredBooking(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const cardWidth = 310;
    const cardHeight = 320;

    let x = rect.right + 12;
    if (x + cardWidth > window.innerWidth - 12) {
      x = Math.max(12, rect.left - cardWidth - 12);
    }

    let y = rect.top;
    if (y + cardHeight > window.innerHeight - 12) {
      y = Math.max(12, window.innerHeight - cardHeight - 12);
    }

    setHoverPos({ x, y });
    setHoveredBooking(targetBk);
  }

  function handleTileMouseLeave() {
    setHoveredBooking(null);
  }

  useEffect(() => {
    function updateColors() {
      setStatusColors(getStatusColors());
    }
    window.addEventListener("pms_status_colors_updated", updateColors);
    return () => window.removeEventListener("pms_status_colors_updated", updateColors);
  }, []);

  // Active drag/resize state for live visual feedback
  const [activeDraggingRoomNo, setActiveDraggingRoomNo] = useState(null);
  const [resizingState, setResizingState] = useState(null); // { roomNo, width, height }

  // Canvas board container reference
  const canvasRef = useRef(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [floorFilter, setFloorFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState("");

  function triggerToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const [todayISO, setTodayISO] = useState(() => getBusinessDate());

  useEffect(() => {
    function handleDateUpdate() {
      setTodayISO(getBusinessDate());
    }
    window.addEventListener("pms_business_date_updated", handleDateUpdate);
    return () => window.removeEventListener("pms_business_date_updated", handleDateUpdate);
  }, []);

  // Safe rooms list (guaranteeing non-null objects with valid room numbers)
  const safeRooms = useMemo(() => (rooms || []).filter((r) => r && r.no !== undefined && r.no !== null), [rooms]);

  // Helper to test if booking or guest name indicates a Block / Maintenance record
  function isBlockBooking(b) {
    if (!b) return false;
    const st = String(b.status || "").toLowerCase();
    const g = String(b.guest || b.fullName || "").toLowerCase();
    return (
      st === "blocked" ||
      st === "block" ||
      st === "maintenance" ||
      st === "out-of-order" ||
      st === "ooo" ||
      st === "out_of_order" ||
      g.includes("blocked") ||
      g.includes("maintenance") ||
      g.includes("out of order")
    );
  }

  // Map occupancy & blocked status for each room
  const occupancyMap = useMemo(() => {
    const map = {};
    const currentBizDate = todayISO;

    safeRooms.forEach((r) => {
      const rNo = String(r.no).trim();
      const hk = String(r.housekeeping || "").toLowerCase();
      const rSt = String(r.status || "").toLowerCase();

      const isRoomLevelBlocked =
        hk === "out_of_order" ||
        hk === "out-of-order" ||
        hk === "ooo" ||
        hk === "blocked" ||
        rSt === "maintenance" ||
        rSt === "blocked" ||
        rSt === "ooo" ||
        rSt === "out_of_order" ||
        rSt === "out-of-order";

      const activeBooking = (bookings || []).find((b) => {
        if (!b || b.isDeleted) return false;
        const bRoomStr = String(b.room || b.roomNo || b.roomNumber || "").trim();
        const isSameRoom = bRoomStr === rNo || (bRoomStr && rNo && !isNaN(Number(bRoomStr)) && Number(bRoomStr) === Number(rNo));
        if (!isSameRoom) return false;

        const st = String(b.status || "").toLowerCase().trim();
        if (
          st === "cancelled" ||
          st === "no-show" ||
          st === "noshow" ||
          st === "no_show" ||
          st === "enquiry" ||
          st === "inquiry" ||
          st === "group enquiry" ||
          st === "group_enquiry" ||
          b.isEnquiry
        ) return false;

        // Checked-in / occupied status takes immediate precedence
        if (st === "checked-in" || st === "checked_in" || st === "occupied" || st === "in-house") {
          return true;
        }

        // Blocked status takes immediate precedence
        if (st === "blocked" || st === "block" || st === "maintenance" || st === "out-of-order" || st === "ooo" || isBlockBooking(b)) {
          return true;
        }

        const cIn = String(b.checkIn || "").slice(0, 10);
        const cOut = String(b.checkOut || "").slice(0, 10);
        return cIn <= currentBizDate && cOut >= currentBizDate;
      });

      const isBookingLevelBlocked = activeBooking ? isBlockBooking(activeBooking) : false;

      if (isRoomLevelBlocked || isBookingLevelBlocked) {
        map[r.no] = {
          blocked: true,
          occupied: false,
          booking: activeBooking || null,
          guest: activeBooking ? (activeBooking.guest || activeBooking.fullName || "Blocked") : (r.notes || "Blocked"),
          reason: activeBooking?.notes || activeBooking?.guest || r.notes || "Maintenance / Blocked",
        };
      } else if (activeBooking) {
        const cOut = String(activeBooking.checkOut || "").slice(0, 10);
        const isCheckoutToday = cOut === currentBizDate;
        const bkStatus = String(activeBooking.status || "").toLowerCase();
        const isConfirmed = bkStatus === "confirmed" || bkStatus === "reserved" || bkStatus === "booked";

        map[r.no] = {
          blocked: false,
          occupied: true,
          isConfirmed,
          booking: activeBooking,
          guest: activeBooking.guest || activeBooking.fullName || "Guest",
          checkIn: String(activeBooking.checkIn || "").slice(0, 10),
          checkOut: cOut,
          checkoutToday: isCheckoutToday,
          status: activeBooking.status,
        };
      } else {
        map[r.no] = { blocked: false, occupied: false, booking: null, guest: null, checkoutToday: false };
      }
    });
    return map;
  }, [safeRooms, bookings, todayISO]);

  // Unique list of floors
  const floors = useMemo(() => {
    const set = new Set();
    safeRooms.forEach((r) => set.add(r.floor || 1));
    return Array.from(set).sort((a, b) => a - b);
  }, [safeRooms]);

  // Filtered Rooms according to selected filters
  const filteredRooms = useMemo(() => {
    return safeRooms.filter((r) => {
      const hk = (r.housekeeping || "clean").toLowerCase();
      const occ = occupancyMap[r.no];

      if (statusFilter === "VACANT_CLEAN" && (occ?.occupied || occ?.blocked || hk !== "clean")) return false;
      if (statusFilter === "OCCUPIED" && !occ?.occupied) return false;
      if (statusFilter === "DIRTY" && hk !== "dirty") return false;
      if (statusFilter === "OUT_OF_ORDER" && !occ?.blocked) return false;

      if (floorFilter !== "ALL" && String(r.floor || 1) !== String(floorFilter)) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNo = String(r.no).toLowerCase().includes(term);
        const matchType = (r.type || "").toLowerCase().includes(term);
        const matchGuest = (occ?.guest || "").toLowerCase().includes(term);
        if (!matchNo && !matchType && !matchGuest) return false;
      }

      return true;
    });
  }, [safeRooms, statusFilter, floorFilter, searchTerm, occupancyMap]);

  // Freeform 2D Canvas Mouse Dragging (repositioning room anywhere on floor plan)
  function handleMoveMouseDown(e, roomNo, initialLeft, initialTop) {
    e.stopPropagation();
    e.preventDefault();
    dragMovedRef.current = false;

    setActiveDraggingRoomNo(roomNo);

    const startX = e.clientX;
    const startY = e.clientY;

    let currentX = initialLeft;
    let currentY = initialTop;

    function onMouseMove(moveEvent) {
      moveEvent.preventDefault();
      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);

      if (deltaX > 2 || deltaY > 2) {
        dragMovedRef.current = true;
      }

      // Restrict position within canvas board boundaries
      currentX = Math.max(10, Math.min(2200, Math.round(initialLeft + (moveEvent.clientX - startX))));
      currentY = Math.max(10, Math.min(1800, Math.round(initialTop + (moveEvent.clientY - startY))));

      setCoordsMap((prev) => {
        const nextMap = { ...prev, [roomNo]: { x: currentX, y: currentY } };
        return nextMap;
      });
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setActiveDraggingRoomNo(null);

      setCoordsMap((prev) => {
        saveRoomLayoutCoords(prev);
        return prev;
      });

      if (dragMovedRef.current) {
        triggerToast(`Room #${roomNo} positioned at (${currentX}px, ${currentY}px) 📍`);
        setTimeout(() => {
          dragMovedRef.current = false;
        }, 200);
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // Interactive Mouse Resizing
  function handleResizeMouseDown(e, roomNo, cardEl) {
    e.stopPropagation();
    e.preventDefault();
    dragMovedRef.current = false;

    const startX = e.clientX;
    const startY = e.clientY;

    const startWidth = cardEl ? cardEl.offsetWidth : 130;
    const startHeight = cardEl ? cardEl.offsetHeight : 95;

    let currentW = startWidth;
    let currentH = startHeight;

    function onMouseMove(moveEvent) {
      moveEvent.preventDefault();
      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);

      if (deltaX > 2 || deltaY > 2) {
        dragMovedRef.current = true;
      }

      // Allow small compact sizes down to 75px width & 65px height
      currentW = Math.max(75, Math.min(500, Math.round(startWidth + (moveEvent.clientX - startX))));
      currentH = Math.max(65, Math.min(450, Math.round(startHeight + (moveEvent.clientY - startY))));

      setResizingState({ roomNo, width: currentW, height: currentH });

      setDimensionsMap((prev) => {
        const nextMap = { ...prev, [roomNo]: { width: currentW, height: currentH } };
        saveRoomLayoutDimensions(nextMap);
        return nextMap;
      });
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setResizingState(null);

      if (dragMovedRef.current) {
        triggerToast(`Room #${roomNo} tile size saved (${currentW}px × ${currentH}px) 📐`);
        setTimeout(() => {
          dragMovedRef.current = false;
        }, 200);
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleResetLayout() {
    setCoordsMap({});
    saveRoomLayoutCoords({});
    setDimensionsMap({});
    saveRoomLayoutDimensions({});
    triggerToast("Property Plan layout & tile positions reset to grid 🔄");
  }

  function handleRoomClick(e, room, occ) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }

    if (occ.blocked) {
      // Logic 3: Blocked Room -> open Unblock / Edit Block popup
      const blockRecord = occ.booking || {
        id: `room-block-${room.no}`,
        room: room.no,
        guest: occ.reason || occ.guest || "🔒 Blocked (Maintenance)",
        status: "blocked",
        checkIn: todayISO,
        checkOut: todayISO,
        notes: occ.reason || "Maintenance",
      };
      if (onEditBlock) {
        onEditBlock(blockRecord);
      } else {
        triggerToast(`Room #${room.no} is blocked (${occ.reason || "Maintenance"})`);
      }
    } else if (occ.occupied) {
      // Logic 2: Occupied Room -> open Folio
      if (occ.booking && onOpenFolio) {
        onOpenFolio(occ.booking);
      } else {
        triggerToast(`Room #${room.no} occupied by ${occ.guest}`);
      }
    } else {
      // Logic 1: Vacant Room -> open popup choices (Book vs Block)
      setVacantRoomModal({ roomNo: room.no, roomObj: room });
    }
  }

  return (
    <div className="room-view-container animate-fade-in">
      {/* CLEAN ROOM VIEW HEADER WITH PRINT OPTION */}
      <div className="rv-header-clean" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "10px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>🏨</span>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>Property Room View</h3>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 16px",
            background: "#475569",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 800,
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow: "0 2px 4px rgba(15,23,42,0.1)",
          }}
          title="Print Room View Layout"
        >
          <span>🖨️</span> Print Room View
        </button>
      </div>

      {/* FREEFORM 2D BLUEPRINT CANVAS BOARD */}
      {filteredRooms.length === 0 ? (
        <div className="rv-empty-state">No rooms match your filter criteria.</div>
      ) : (
        <div className="rv-canvas-board" ref={canvasRef}>
          {filteredRooms.map((room, idx) => {
            const hkStatus = (room.housekeeping || "clean").toLowerCase();
            const occ = occupancyMap[room.no] || { occupied: false, blocked: false };

            let cardThemeCls = "theme-vacant-clean";
            let statusBadgeText = "Clean";

            let badgeCustomColors = null;
            if (occ.blocked) {
              cardThemeCls = "theme-ooo";
              statusBadgeText = "Blocked";
              badgeCustomColors = getBookingStatusColors(occ.booking || "blocked", statusColors);
            } else if (occ.occupied) {
              if (occ.checkoutToday) {
                statusBadgeText = "Out Today";
                badgeCustomColors = getBookingStatusColors(occ.booking || "checked-out", statusColors);
              } else if (occ.isConfirmed) {
                cardThemeCls = "theme-confirmed";
                statusBadgeText = "Confirmed";
                badgeCustomColors = getBookingStatusColors(occ.booking || "confirmed", statusColors);
              } else {
                cardThemeCls = "theme-occupied";
                statusBadgeText = "Occupied";
                badgeCustomColors = getBookingStatusColors(occ.booking || "checked-in", statusColors);
              }
            } else if (hkStatus === "dirty") {
              cardThemeCls = "theme-dirty";
              statusBadgeText = "Dirty";
            }

            // Calculate freeform (X, Y) coordinates (or compute default grid offset if unpositioned)
            const customCoord = coordsMap[room.no];
            const defaultX = 20 + (idx % 6) * 145;
            const defaultY = 20 + Math.floor(idx / 6) * 110;

            const posX = customCoord?.x !== undefined ? customCoord.x : defaultX;
            const posY = customCoord?.y !== undefined ? customCoord.y : defaultY;

            // Calculate custom dimensions (or default to 130px x 95px)
            const customDim = dimensionsMap[room.no];
            const cardWidth = customDim?.width ? customDim.width : 130;
            const cardHeight = customDim?.height ? customDim.height : 95;

            const isDragging = activeDraggingRoomNo === room.no;
            const isCurrentlyResizing = resizingState?.roomNo === room.no;

            const cardStyle = {
              left: `${posX}px`,
              top: `${posY}px`,
              width: `${cardWidth}px`,
              height: `${cardHeight}px`,
              borderColor: badgeCustomColors ? badgeCustomColors.bg : undefined,
              borderWidth: badgeCustomColors ? "2px" : undefined,
              background: badgeCustomColors ? `linear-gradient(180deg, #ffffff 0%, ${badgeCustomColors.bg}15 100%)` : undefined,
              cursor: "pointer",
            };

            return (
              <div
                key={room.no}
                style={cardStyle}
                onClick={(e) => handleRoomClick(e, room, occ)}
                onMouseEnter={(e) => handleTileMouseEnter(e, room, occ)}
                onMouseLeave={handleTileMouseLeave}
                className={`rv-card freeform-tile ${cardThemeCls} ${isDragging ? "is-moving" : ""} ${isCurrentlyResizing ? "resizing" : ""}`}
              >
                {/* RESIZE FEEDBACK BADGE */}
                {isCurrentlyResizing && (
                  <div className="rv-resize-indicator">
                    📐 {resizingState.width}px × {resizingState.height}px
                  </div>
                )}

                {/* CARD TOP HEADER: ROOM #, STATUS PILL & MOVE DRAG HANDLE */}
                <div
                  className="rv-tile-top"
                  onMouseDown={(e) => handleMoveMouseDown(e, room.no, posX, posY)}
                  title="Click & drag anywhere on header to move room on floor plan"
                >
                  <div className="rv-tile-header-left">
                    <span className="rv-tile-room-no">#{room.no}</span>
                    <span
                      className={`rv-tile-status-pill ${cardThemeCls}`}
                      style={badgeCustomColors ? { backgroundColor: badgeCustomColors.bg, color: badgeCustomColors.text } : {}}
                    >
                      {statusBadgeText}
                    </span>
                  </div>

                  <div className="rv-drag-handle" title="Drag to move room anywhere">
                    <Move size={12} />
                  </div>
                </div>

                {/* DISPLAY DETAILS: WHO IS STAYING OR ROOM TYPE */}
                <div className="rv-tile-body">
                  {occ.blocked ? (
                    <div className="rv-tile-blocked" title={`Blocked: ${occ.reason || occ.guest}`}>
                      <AlertTriangle size={11} /> <strong className="rv-truncate">{occ.guest || "Maintenance"}</strong>
                    </div>
                  ) : occ.occupied ? (
                    <div className={`rv-tile-guest ${occ.isConfirmed ? "is-confirmed" : ""}`} title={`Staying: ${occ.guest} (${occ.checkIn} -> ${occ.checkOut})`}>
                      <User size={11} /> <strong className="rv-truncate">{occ.guest}</strong>
                    </div>
                  ) : (
                    <div className="rv-tile-type" title={room.type || "Standard Room"}>
                      <BedDouble size={11} /> <span className="rv-truncate">{room.type || "Standard"}</span>
                    </div>
                  )}
                </div>

                {/* BOTTOM BAR: FLOOR BADGE & CORNER RESIZE HANDLE */}
                <div className="rv-tile-bottom">
                  <span className="rv-tile-floor">F{room.floor || 1}</span>

                  <div
                    className="rv-card-resize-handle"
                    title="Click & drag corner to resize tile"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                      const cardEl = e.currentTarget.closest(".rv-card");
                      handleResizeMouseDown(e, room.no, cardEl);
                    }}
                  >
                    <Scaling size={11} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VACANT ROOM ACTION SELECTION MODAL (EXACT MATCH TO TAPE CHART) */}
      {vacantRoomModal && (
        <div className="qam-overlay">
          <div className="qam-card cell-choice-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="qam-head">
              <h3>
                Room {vacantRoomModal.roomNo} · {todayISO}
              </h3>
              <button type="button" className="qam-close" onClick={() => setVacantRoomModal(null)} aria-label="Close">✕</button>
            </div>

            <div className="cell-choice-body">
              <button
                type="button"
                className="choice-tile create-booking-tile"
                onClick={() => {
                  const rNo = vacantRoomModal.roomNo;
                  setVacantRoomModal(null);
                  if (onOpenWalkin) onOpenWalkin(rNo);
                }}
              >
                <div className="choice-icon">🏨</div>
                <div className="choice-info">
                  <strong>Create Guest Booking</strong>
                  <span>Register a new guest stay, scan ID &amp; collect payment</span>
                </div>
                <span className="choice-arrow">›</span>
              </button>

              <button
                type="button"
                className="choice-tile block-room-tile"
                onClick={() => {
                  const rObj = vacantRoomModal.roomObj;
                  setVacantRoomModal(null);
                  if (onBlockRoom) onBlockRoom(rObj);
                }}
              >
                <div className="choice-icon">🔒</div>
                <div className="choice-info">
                  <strong>Block Room (Out of Order)</strong>
                  <span>Mark room unavailable for maintenance or deep cleaning</span>
                </div>
                <span className="choice-arrow">›</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROOM VIEW GUEST & BLOCKED ROOM HOVER CARD OVERLAY */}
      {hoveredBooking && !activeDraggingRoomNo && !resizingState && (() => {
        const isBlocked =
          hoveredBooking.status === "blocked" ||
          hoveredBooking.status === "maintenance" ||
          String(hoveredBooking.guest || "").toLowerCase().includes("blocked");

        const fullDocUrls = [
          hoveredBooking.idFront,
          hoveredBooking.scannedIdUrl,
          hoveredBooking.idDocumentUrl,
          hoveredBooking.fullScanPhoto,
          ...(Array.isArray(hoveredBooking.scannedImages) ? hoveredBooking.scannedImages.map((s) => s.url) : [])
        ].filter(Boolean);

        const isFullDoc = (url) => !url || fullDocUrls.includes(url);

        const bId = hoveredBooking.id || hoveredBooking._id;
        const hoverPhotoUrl =
          (Array.isArray(hoveredBooking.capturedImages) && hoveredBooking.capturedImages[0]?.url ? hoveredBooking.capturedImages[0].url : null) ||
          (hoveredBooking.capturedPhoto && !isFullDoc(hoveredBooking.capturedPhoto) ? hoveredBooking.capturedPhoto : null) ||
          (hoveredBooking.guestPhoto && !isFullDoc(hoveredBooking.guestPhoto) ? hoveredBooking.guestPhoto : null) ||
          (hoveredBooking.photoUrl && !isFullDoc(hoveredBooking.photoUrl) ? hoveredBooking.photoUrl : null) ||
          null;

        return (
          <div
            className="gantt-hover-card"
            style={{
              position: "fixed",
              left: Math.max(12, hoverPos.x),
              top: hoverPos.y,
              zIndex: 99999,
              width: "310px",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 40px -8px rgba(15, 23, 42, 0.25), 0 0 1px 1px rgba(15, 23, 42, 0.08)",
              borderLeft: `4px solid ${getHoverBadgeColor(hoveredBooking.status)}`,
              padding: "18px",
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              pointerEvents: "none",
              animation: "hoverCardFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            {isBlocked ? (
              /* DEDICATED BLOCKED / OUT OF ORDER ROOM HOVER CARD */
              <div>
                <div style={{ marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.3px", lineHeight: "1.2" }}>
                    🔒 {hoveredBooking.guest || "Blocked (Maintenance)"}
                  </h4>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", margin: "4px 0 8px 0", letterSpacing: "0.5px", fontFamily: "monospace" }}>
                    {hoveredBooking.id || hoveredBooking.resCode || "RESERVATION"} · Room {hoveredBooking.room || "Unassigned"}
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "10.5px",
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      padding: "3.5px 12px",
                      borderRadius: "12px",
                      background: "#f1f5f9",
                      color: "#475569"
                    }}
                  >
                    BLOCKED (OUT OF ORDER)
                  </span>
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", padding: "12px 0", margin: "12px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>START DATE</div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "3px" }}>
                        {formatHoverDate(hoveredBooking.checkIn)}
                      </div>
                    </div>
                    <div style={{ fontSize: "15px", color: "#cbd5e1", fontWeight: "700" }}>➔</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>END DATE</div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "3px" }}>
                        {formatHoverDate(hoveredBooking.checkOut)}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px dashed #e2e8f0", margin: "10px 0 8px 0" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#475569", fontWeight: "700" }}>
                    {(() => {
                      const n = calcHoverNights(hoveredBooking.checkIn, hoveredBooking.checkOut);
                      return <span>🗓️ {n} day{n === 1 ? "" : "s"} hold</span>;
                    })()}
                    <span>🛠️ Maintenance Hold</span>
                  </div>
                </div>

                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "10px 12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "10px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                    BLOCK REASON / NOTES
                  </div>
                  <div style={{ fontSize: "12.5px", fontWeight: "700", color: "#1e293b", lineHeight: "1.3" }}>
                    {hoveredBooking.notes
                      ? (hoveredBooking.notes.replace(/\[Blocked:.*?\]/gi, "").replace(/[\[\]]/g, "").trim() || "Out of Order Maintenance Hold")
                      : "Out of Order Maintenance Hold"}
                  </div>
                </div>
              </div>
            ) : (
              /* REGULAR GUEST RESERVATION HOVER CARD */
              <div>
                <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.3px", lineHeight: "1.2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {hoveredBooking.guest || "Guest"}
                    </h4>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", margin: "4px 0 8px 0", letterSpacing: "0.5px", fontFamily: "monospace" }}>
                      {hoveredBooking.id || "R10001"} · Room {hoveredBooking.room || "Unassigned"}
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "10.5px",
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        padding: "3.5px 12px",
                        borderRadius: "12px",
                        background: getHoverBadgeBg(hoveredBooking.isEnquiry || hoveredBooking.status === "enquiry" ? "enquiry" : hoveredBooking.status),
                        color: getHoverBadgeColor(hoveredBooking.isEnquiry || hoveredBooking.status === "enquiry" ? "enquiry" : hoveredBooking.status)
                      }}
                    >
                      {hoveredBooking.isEnquiry || hoveredBooking.status === "enquiry"
                        ? "ENQUIRY (HOLD)"
                        : hoveredBooking.status
                        ? String(hoveredBooking.status).replace("-", " ").toUpperCase()
                        : "CONFIRMED"}
                    </span>
                    {hoveredBooking.expiryDate && (
                      <div style={{ marginTop: "4px", fontSize: "11px", fontWeight: "700", color: "#b45309" }}>
                        ⏱️ Expiry: {formatHoverDate(hoveredBooking.expiryDate)} {hoveredBooking.expiryTime || ""}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "8px",
                      border: "1.5px solid #cbd5e1",
                      background: "#f8fafc",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
                    }}
                  >
                    {hoverPhotoUrl && !imgErrorMap[hoverPhotoUrl] ? (
                      <img
                        src={hoverPhotoUrl}
                        alt={hoveredBooking.guest || "Guest"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={() => setImgErrorMap((prev) => ({ ...prev, [hoverPhotoUrl]: true }))}
                      />
                    ) : (
                      <div style={{ textAlign: "center", color: "#94a3b8", padding: "2px" }}>
                        <div style={{ fontSize: "20px", lineHeight: "1" }}>👤</div>
                        <span style={{ fontSize: "9px", fontWeight: 700, display: "block", marginTop: "2px" }}>No Photo</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", padding: "12px 0", margin: "12px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>CHECK IN</div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "3px" }}>
                        {formatHoverDate(hoveredBooking.checkIn)}
                      </div>
                    </div>
                    <div style={{ fontSize: "15px", color: "#cbd5e1", fontWeight: "700" }}>➔</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>CHECK OUT</div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "3px" }}>
                        {formatHoverDate(hoveredBooking.checkOut)}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px dashed #e2e8f0", margin: "10px 0 8px 0" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#475569", fontWeight: "700" }}>
                    {(() => {
                      const n = calcHoverNights(hoveredBooking.checkIn, hoveredBooking.checkOut);
                      return <span>🌙 {n} night{n === 1 ? "" : "s"}</span>;
                    })()}
                    <span>👥 {hoveredBooking.adults || 1}A {hoveredBooking.children ? `${hoveredBooking.children}C` : ""}</span>
                    <OtaBadge 
                      source={hoveredBooking.source || hoveredBooking.channel} 
                      size="sm" 
                      showText={true} 
                      otaBookingId={hoveredBooking.otaBookingId || hoveredBooking.confirmationCode} 
                    />
                  </div>
                </div>

                {(() => {
                  const isVirtualStay = isVirtualRoomOrBooking(hoveredBooking);
                  const rawTotal = isVirtualStay ? 0 : Number(hoveredBooking.totalAmount || hoveredBooking.subtotal || 0);
                  const rawDue = isVirtualStay ? 0 : Number(hoveredBooking.balanceDue ?? 0);
                  const rawPaid = isVirtualStay ? 0 : Number(hoveredBooking.advanceAmount ?? hoveredBooking.paidAmount ?? (rawTotal - rawDue));
                  
                  const total = Math.round(rawTotal * 100) / 100;
                  const paid = Math.round(rawPaid * 100) / 100;
                  const due = Math.max(0, Math.round((total - paid) * 100) / 100);
                  const percentPaid = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 100;

                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#475569" }}>Trip Total</span>
                        <strong style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                          ${total.toFixed(2)}
                        </strong>
                      </div>

                      <div style={{ height: "6px", width: "100%", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden", margin: "6px 0 8px 0" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${percentPaid}%`,
                            background: due <= 0.01 ? "#059669" : "#f59e0b",
                            borderRadius: "4px",
                            transition: "width 0.3s ease"
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: "700" }}>
                        <span style={{ color: "#475569" }}>
                          Paid ${paid.toFixed(2)} of ${total.toFixed(2)}
                        </span>
                        <span style={{ color: due > 0.01 && !isVirtualStay ? "#d97706" : "#059669", fontWeight: "800" }}>
                          {isVirtualStay ? "✓ Non-Revenue Stay" : due > 0.01 ? `$${due.toFixed(2)} due` : "✓ Paid in Full"}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Folio / Guest Notes Section */}
                {(() => {
                  const hNotesList = (() => {
                    if (!hoveredBooking) return [];
                    if (Array.isArray(hoveredBooking.notesList) && hoveredBooking.notesList.length > 0) {
                      const valid = hoveredBooking.notesList.filter((n) => n && (typeof n === 'string' ? n.trim() : (n.text && String(n.text).trim())));
                      if (valid.length > 0) return valid;
                    }
                    if (Array.isArray(hoveredBooking.notes) && hoveredBooking.notes.length > 0) {
                      const valid = hoveredBooking.notes.filter((n) => n && (typeof n === 'string' ? n.trim() : (n.text && String(n.text).trim())));
                      if (valid.length > 0) return valid;
                    }
                    const txt = (
                      (typeof hoveredBooking.notes === 'string' ? hoveredBooking.notes : '') ||
                      (typeof hoveredBooking.specialRequests === 'string' ? hoveredBooking.specialRequests : '') ||
                      (typeof hoveredBooking.remark === 'string' ? hoveredBooking.remark : '') ||
                      (typeof hoveredBooking.remarks === 'string' ? hoveredBooking.remarks : '') ||
                      (typeof hoveredBooking.folioNotes === 'string' ? hoveredBooking.folioNotes : '') ||
                      ''
                    ).replace(/\[Blocked:.*?\]/gi, '').replace(/[\[\]]/g, '').trim();

                    return txt ? [{ text: txt }] : [];
                  })();

                  if (hNotesList.length === 0) return null;
                  const firstNote = typeof hNotesList[0] === 'string' ? hNotesList[0] : (hNotesList[0]?.text || '');

                  return (
                    <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "800", color: "#b45309", marginBottom: "4px" }}>
                        <span>💬</span> FOLIO NOTES ({hNotesList.length})
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b", background: "#fffbeb", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fcd34d", lineHeight: "1.3" }}>
                        {firstNote}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })()}

      {toast && (
        <div className="pms-confirm-backdrop" onClick={() => setToast("")}>
          <div className="pms-confirm-card pms-execution-card" onClick={(e) => e.stopPropagation()}>
            <div className="pms-execution-icon-wrapper">
              <CheckCircle2 size={44} className="pms-execution-icon" />
            </div>
            <h3 className="pms-execution-title">Operation Successful</h3>
            <p className="pms-execution-message">{toast}</p>
            <div className="pms-confirm-footer justify-center margin-top-20">
              <button type="button" className="pms-btn pms-btn-light-grey width-100" onClick={() => setToast("")}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
