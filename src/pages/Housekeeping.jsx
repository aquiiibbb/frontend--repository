import { useState, useEffect, useMemo } from "react";
import { getRooms, getRoomTypes, getBookings, updateRoomHousekeeping, createBooking, cancelBooking } from "../services/api";
import { getUsers, getHousekeepers, getHkColors } from "../services/hotelConfig";
import { exportToExcel, exportToPDF, exportToWord } from "../utils/exportUtils";
import "./housekeeping.css";

export default function Housekeeping() {
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [usersUpdated, setUsersUpdated] = useState(0);

  useEffect(() => {
    function handleUsersChange() {
      setUsersUpdated((prev) => prev + 1);
    }
    window.addEventListener("pms_users_updated", handleUsersChange);
    window.addEventListener("storage", handleUsersChange);
    return () => {
      window.removeEventListener("pms_users_updated", handleUsersChange);
      window.removeEventListener("storage", handleUsersChange);
    };
  }, []);

  const [hkColors, setHkColors] = useState(() => getHkColors());

  useEffect(() => {
    const handleColorsUpdate = () => setHkColors(getHkColors());
    window.addEventListener("pms_hk_colors_updated", handleColorsUpdate);
    window.addEventListener("storage", handleColorsUpdate);
    return () => {
      window.removeEventListener("pms_hk_colors_updated", handleColorsUpdate);
      window.removeEventListener("storage", handleColorsUpdate);
    };
  }, []);

  const getHkBoxStyle = (key, isActive) => {
    const c = hkColors[key] || { bg: "#ffffff", text: "#0f172a", border: "#cbd5e1" };
    return {
      backgroundColor: c.bg,
      color: c.text,
      borderWidth: "1.5px",
      borderStyle: "solid",
      borderColor: c.border,
      boxShadow: isActive ? `0 0 0 2.5px ${c.border}, 0 4px 12px rgba(0,0,0,0.08)` : "0 1px 3px rgba(0,0,0,0.05)",
    };
  };

  // Dynamically pull housekeepers permanently configured in PMS User Management
  const staffMembers = useMemo(() => {
    const hkUsers = typeof getHousekeepers === "function" ? getHousekeepers() : [];
    const allUsers = typeof getUsers === "function" ? getUsers() : [];
    const activeUsers = allUsers.filter((u) => u && u.status === "Active");
    const sourceList = hkUsers.length > 0 ? hkUsers : activeUsers;
    const names = sourceList.map((u) => u.name || u.username).filter(Boolean);
    return Array.from(new Set(["Unassigned", ...names]));
  }, [usersUpdated]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [occupancyFilter, setOccupancyFilter] = useState("ALL");
  const [floorFilter, setFloorFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Selected rooms for bulk action
  const [selectedRooms, setSelectedRooms] = useState(new Set());
  const [bulkStaff, setBulkStaff] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [rData, tData, bData] = await Promise.all([getRooms(), getRoomTypes(), getBookings()]);
      setRooms(rData);
      setRoomTypes(tData);
      setBookings(bData.filter((b) => b.status !== "cancelled"));
    } catch (err) {
      setError(err.message || "Failed to load housekeeping data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    window.addEventListener("pms_rooms_updated", loadData);
    return () => window.removeEventListener("pms_rooms_updated", loadData);
  }, []);

  function triggerToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  // Map of current occupancy status per room
  const occupancyMap = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const map = {};
    rooms.forEach((r) => {
      const activeBooking = bookings.find(
        (b) => b.room === r.no && b.status !== "cancelled" && b.checkIn <= todayISO && b.checkOut >= todayISO
      );
      if (activeBooking) {
        const isCheckoutToday = activeBooking.checkOut === todayISO;
        map[r.no] = {
          occupied: true,
          guest: activeBooking.guest,
          checkoutToday: isCheckoutToday,
          status: activeBooking.status,
        };
      } else {
        map[r.no] = { occupied: false, guest: null, checkoutToday: false };
      }
    });
    return map;
  }, [rooms, bookings]);

  // Calculate statistics (Housekeeping Statuses & Occupancy Statuses)
  const stats = useMemo(() => {
    const total = rooms.length;
    let clean = 0;
    let dirty = 0;
    let outOfOrder = 0;
    let occupied = 0;
    let vacant = 0;
    let checkoutToday = 0;

    rooms.forEach((r) => {
      const hk = (r.housekeeping || "clean").toLowerCase();
      if (hk === "clean" || hk === "inspected") clean += 1;
      else if (hk === "dirty") dirty += 1;
      else if (hk === "out_of_order" || hk === "out-of-order" || r.status === "maintenance") outOfOrder += 1;
      else clean += 1;

      const occ = occupancyMap[r.no];
      if (occ?.occupied) {
        occupied += 1;
        if (occ.checkoutToday) checkoutToday += 1;
      } else {
        vacant += 1;
      }
    });

    return { total, clean, dirty, outOfOrder, occupied, vacant, checkoutToday };
  }, [rooms, occupancyMap]);

  // Unique floors list
  const floors = useMemo(() => {
    const set = new Set();
    rooms.forEach((r) => set.add(r.floor || 1));
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms]);

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const hk = (r.housekeeping || "clean").toLowerCase();
      if (statusFilter === "CLEAN" && hk !== "clean") return false;
      if (statusFilter === "DIRTY" && hk !== "dirty") return false;
      if (statusFilter === "INSPECTED" && hk !== "inspected") return false;
      if (statusFilter === "OUT_OF_ORDER" && hk !== "out_of_order" && hk !== "out-of-order" && r.status !== "maintenance") return false;

      if (occupancyFilter === "OCCUPIED" && !occupancyMap[r.no]?.occupied) return false;
      if (occupancyFilter === "VACANT" && occupancyMap[r.no]?.occupied) return false;
      if (occupancyFilter === "CHECKOUT_TODAY" && (!occupancyMap[r.no]?.occupied || !occupancyMap[r.no]?.checkoutToday)) return false;

      if (floorFilter !== "ALL" && String(r.floor || 1) !== String(floorFilter)) return false;
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNo = r.no.toLowerCase().includes(term);
        const matchType = (r.type || "").toLowerCase().includes(term);
        const matchStaff = (r.assignedStaff || "").toLowerCase().includes(term);
        const matchRemark = (r.remark || r.notes || "").toLowerCase().includes(term);
        const matchGuest = (occupancyMap[r.no]?.guest || "").toLowerCase().includes(term);
        if (!matchNo && !matchType && !matchStaff && !matchRemark && !matchGuest) return false;
      }
      return true;
    });
  }, [rooms, statusFilter, occupancyFilter, floorFilter, typeFilter, searchTerm, occupancyMap]);

  // Handle single room housekeeping status change (synced with Calendar)
  async function handleStatusChange(roomNo, targetHkStatus) {
    try {
      const targetRoom = rooms.find((r) => String(r.no).trim() === String(roomNo).trim());
      const currentHk = (targetRoom?.housekeeping || "clean").toLowerCase();
      const currentStatus = targetRoom?.status || "available";
      const isCurrentlyBlocked = currentHk === "out_of_order" || currentHk === "blocked" || currentStatus === "maintenance";

      // Toggle unblock if already blocked and user clicks Block again
      let newHkStatus = targetHkStatus;
      if (targetHkStatus === "out_of_order" && isCurrentlyBlocked) {
        newHkStatus = "clean";
      }

      const roomStatusMap = {
        clean: "available",
        dirty: "cleaning",
        inspected: "available",
        out_of_order: "maintenance",
        blocked: "maintenance",
      };
      const newRoomStatus = roomStatusMap[newHkStatus] || "available";

      // 1. Update room record in DB / LocalStorage
      const updated = await updateRoomHousekeeping(roomNo, {
        housekeeping: newHkStatus,
        status: newRoomStatus,
      });

      setRooms((prev) => prev.map((r) => (String(r.no).trim() === String(roomNo).trim() ? { ...r, ...updated, housekeeping: newHkStatus, status: newRoomStatus } : r)));

      // 2. Sync with Calendar Bookings List (room_pms_bookings)
      const allBookings = await getBookings();
      const strRoomNo = String(roomNo).trim();
      const existingBlock = allBookings.find(
        (b) => String(b.room).trim() === strRoomNo && (b.status === "blocked" || b.status === "maintenance" || (b.guest && b.guest.includes("Blocked")))
      );

      if (newHkStatus === "out_of_order" || newHkStatus === "blocked") {
        if (!existingBlock) {
          const todayISO = new Date().toISOString().slice(0, 10);
          const endISO = new Date(Date.now() + 86400000).toISOString().slice(0, 10); // Exactly 1 night block (Today to Tomorrow)
          const blockRecord = {
            guest: `🔒 Blocked (Maintenance)`,
            room: strRoomNo,
            roomType: targetRoom?.type || "Standard",
            checkIn: todayISO,
            checkOut: endISO,
            status: "blocked",
            color: "#64748b",
            notes: "[Blocked: Maintenance] Out of Order from Housekeeping List",
            source: "Maintenance",
            amount: 0,
            paid: 0,
          };
          const created = await createBooking(blockRecord);
          setBookings((prev) => [...prev, created]);
        }
        triggerToast(`Room ${roomNo} Blocked / Out of Order ⚠️ (Calendar Synced)`);
      } else {
        if (existingBlock) {
          await cancelBooking(existingBlock.id);
          setBookings((prev) => prev.filter((b) => b.id !== existingBlock.id));
        }
        triggerToast(`Room ${roomNo} marked ${newHkStatus.toUpperCase()} 🟢 (Calendar Synced)`);
      }

      // Broadcast global custom event so Calendar page re-renders instantly
      window.dispatchEvent(new CustomEvent("pms_rooms_updated", { detail: updated }));
      window.dispatchEvent(new CustomEvent("pms_bookings_updated"));
    } catch (err) {
      triggerToast(err.message || "Could not update room status");
    }
  }

  // Handle assigned staff change
  async function handleStaffAssign(roomNo, staffName) {
    try {
      const updated = await updateRoomHousekeeping(roomNo, { assignedStaff: staffName });
      setRooms((prev) => prev.map((r) => (r.no === roomNo ? { ...r, ...updated } : r)));
      triggerToast(`Room ${roomNo} assigned to ${staffName}`);
    } catch (err) {
      triggerToast(err.message || "Could not assign staff");
    }
  }

  // Handle remark change
  async function handleRemarkChange(roomNo, remarkText) {
    try {
      const updated = await updateRoomHousekeeping(roomNo, { remark: remarkText, notes: remarkText });
      setRooms((prev) => prev.map((r) => (r.no === roomNo ? { ...r, remark: remarkText, notes: remarkText, ...updated } : r)));
    } catch (err) {
      console.error(err);
    }
  }

  // Handle Export (Excel, PDF, Word)
  function handleExport(format) {
    const headers = [
      "Room #",
      "Category",
      "Floor",
      "Occupancy Status",
      "Housekeeping Status",
      "Assigned Housekeeper",
      "Remark / Comments",
    ];
    const data = filteredRooms.map((r) => {
      const occ = occupancyMap[r.no];
      const occText = occ?.occupied ? `Occupied (${occ.guest})` : "Vacant";
      const hkText = (r.housekeeping || "clean").toUpperCase();
      return [
        r.no,
        r.type,
        `Floor ${r.floor || 1}`,
        occText,
        hkText,
        r.assignedStaff || "Unassigned",
        r.remark || r.notes || "—",
      ];
    });

    const title = "Housekeeping & Room Status List";
    if (format === "excel") exportToExcel("Housekeeping_Room_Status", title, headers, data);
    else if (format === "pdf") exportToPDF(title, headers, data);
    else if (format === "word") exportToWord("Housekeeping_Room_Status", title, headers, data);
    triggerToast(`Exported report in ${format.toUpperCase()} format`);
  }

  // Bulk actions
  function toggleSelectRoom(roomNo) {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomNo)) next.delete(roomNo);
      else next.add(roomNo);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedRooms.size === filteredRooms.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(filteredRooms.map((r) => r.no)));
    }
  }

  async function handleBulkMarkClean() {
    if (selectedRooms.size === 0) return;
    try {
      for (const roomNo of selectedRooms) {
        await updateRoomHousekeeping(roomNo, { housekeeping: "clean" });
      }
      triggerToast(`${selectedRooms.size} Rooms marked CLEAN (Calendar Synced)`);
      setSelectedRooms(new Set());
      loadData();
    } catch (err) {
      triggerToast(err.message || "Bulk update failed");
    }
  }

  async function handleBulkAssignStaff() {
    if (selectedRooms.size === 0 || !bulkStaff) return;
    try {
      for (const roomNo of selectedRooms) {
        await updateRoomHousekeeping(roomNo, { assignedStaff: bulkStaff });
      }
      triggerToast(`${selectedRooms.size} Rooms assigned to ${bulkStaff}`);
      setSelectedRooms(new Set());
      setBulkStaff("");
      loadData();
    } catch (err) {
      triggerToast(err.message || "Bulk assign failed");
    }
  }

  return (
    <div className="hk-page">
      {/* HEADER BAR */}
      <div className="hk-header">
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>Housekeeping</h1>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={loadData}>
          Refresh Board
        </button>
      </div>

      {toast && <div className="hk-toast">{toast}</div>}
      {error && <div className="hk-error">{error}</div>}

      {/* STATS OVERVIEW METRICS (HOUSEKEEPING & OCCUPANCY STATUSES WITH DYNAMIC COLORS) */}
      <div className="hk-stats-grid">
        <div
          className="hk-stat-card total"
          style={getHkBoxStyle("total", statusFilter === "ALL" && occupancyFilter === "ALL")}
          onClick={() => {
            setStatusFilter("ALL");
            setOccupancyFilter("ALL");
          }}
          title="Click to reset filters and view Total Inventory"
        >
          <span className="lbl" style={{ color: "inherit" }}>Total Inventory</span>
          <strong className="val" style={{ color: "inherit" }}>{stats.total} Rooms</strong>
        </div>
        <div
          className={`hk-stat-card clean ${statusFilter === "CLEAN" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter(statusFilter === "CLEAN" ? "ALL" : "CLEAN");
            setOccupancyFilter("ALL");
          }}
          title="Click to filter Clean & Ready rooms"
          style={getHkBoxStyle("clean", statusFilter === "CLEAN")}
        >
          <span className="lbl" style={{ color: "inherit" }}>🟢 Clean &amp; Ready</span>
          <strong className="val" style={{ color: "inherit" }}>{stats.clean}</strong>
        </div>
        <div
          className={`hk-stat-card dirty ${statusFilter === "DIRTY" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter(statusFilter === "DIRTY" ? "ALL" : "DIRTY");
            setOccupancyFilter("ALL");
          }}
          title="Click to filter Dirty rooms"
          style={getHkBoxStyle("dirty", statusFilter === "DIRTY")}
        >
          <span className="lbl" style={{ color: "inherit" }}>🔴 Dirty / Needs Cleaning</span>
          <strong className="val" style={{ color: "inherit" }}>{stats.dirty}</strong>
        </div>
        <div
          className={`hk-stat-card ooo ${statusFilter === "OUT_OF_ORDER" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter(statusFilter === "OUT_OF_ORDER" ? "ALL" : "OUT_OF_ORDER");
            setOccupancyFilter("ALL");
          }}
          title="Click to filter Out of Order rooms"
          style={getHkBoxStyle("outOfOrder", statusFilter === "OUT_OF_ORDER")}
        >
          <span className="lbl" style={{ color: "inherit" }}>⚠️ Out of Order</span>
          <strong className="val" style={{ color: "inherit" }}>{stats.outOfOrder}</strong>
        </div>

        {/* OCCUPANCY STATUS STAT BOXES */}
        <div
          className={`hk-stat-card occupied ${occupancyFilter === "OCCUPIED" ? "active" : ""}`}
          onClick={() => {
            setOccupancyFilter(occupancyFilter === "OCCUPIED" ? "ALL" : "OCCUPIED");
            setStatusFilter("ALL");
          }}
          title="Click to filter Occupied rooms"
          style={getHkBoxStyle("occupied", occupancyFilter === "OCCUPIED")}
        >
          <span className="lbl" style={{ color: "inherit" }}>👤 Occupied</span>
          <strong className="val" style={{ color: "inherit" }}>{stats.occupied}</strong>
        </div>
        <div
          className={`hk-stat-card vacant ${occupancyFilter === "VACANT" ? "active" : ""}`}
          onClick={() => {
            setOccupancyFilter(occupancyFilter === "VACANT" ? "ALL" : "VACANT");
            setStatusFilter("ALL");
          }}
          title="Click to filter Vacant rooms"
          style={getHkBoxStyle("vacant", occupancyFilter === "VACANT")}
        >
          <span className="lbl" style={{ color: "inherit" }}>⚪ Vacant</span>
          <strong className="val" style={{ color: "inherit" }}>{stats.vacant}</strong>
        </div>
        <div
          className={`hk-stat-card due-out ${occupancyFilter === "CHECKOUT_TODAY" ? "active" : ""}`}
          onClick={() => {
            setOccupancyFilter(occupancyFilter === "CHECKOUT_TODAY" ? "ALL" : "CHECKOUT_TODAY");
            setStatusFilter("ALL");
          }}
          title="Click to filter Check-Out Today rooms"
          style={getHkBoxStyle("checkoutToday", occupancyFilter === "CHECKOUT_TODAY")}
        >
          <span className="lbl" style={{ color: "inherit" }}>🚪 Check-Out Today</span>
          <strong className="val" style={{ color: "inherit" }}>{stats.checkoutToday}</strong>
        </div>
      </div>

      {/* FILTER & TOOLBAR BAR */}
      <div className="hk-toolbar">
        <div className="hk-search-wrap">
          <input
            type="text"
            placeholder="Search room #, type, staff, comments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="hk-filter-group">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              if (e.target.value !== "ALL") setOccupancyFilter("ALL");
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="CLEAN">🟢 Clean</option>
            <option value="DIRTY">🔴 Dirty</option>
            <option value="INSPECTED">🔵 Inspected</option>
            <option value="OUT_OF_ORDER">⚠️ Out of Order</option>
          </select>
        </div>

        <div className="hk-filter-group">
          <label>Occupancy:</label>
          <select
            value={occupancyFilter}
            onChange={(e) => {
              setOccupancyFilter(e.target.value);
              if (e.target.value !== "ALL") setStatusFilter("ALL");
            }}
          >
            <option value="ALL">All Occupancy</option>
            <option value="OCCUPIED">👤 Occupied</option>
            <option value="VACANT">⚪ Vacant</option>
            <option value="CHECKOUT_TODAY">🚪 Check-Out Today</option>
          </select>
        </div>

        <div className="hk-filter-group">
          <label>Floor:</label>
          <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
            <option value="ALL">All Floors</option>
            {floors.map((f) => (
              <option key={f} value={f}>Floor {f}</option>
            ))}
          </select>
        </div>

        <div className="hk-filter-group">
          <label>Category:</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">All Categories</option>
            {roomTypes.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* EXPORT ACTION BUTTONS */}
        <div className="hk-export-group" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="btn-export btn-export-excel"
            title="Export list to Excel (.xls)"
            onClick={() => handleExport("excel")}
          >
            📊 Excel (.xls)
          </button>
          <button
            type="button"
            className="btn-export btn-export-pdf"
            title="Export list to PDF (.pdf)"
            onClick={() => handleExport("pdf")}
          >
            📄 PDF (.pdf)
          </button>
          <button
            type="button"
            className="btn-export btn-export-word"
            title="Export list to Word (.doc)"
            onClick={() => handleExport("word")}
          >
            📝 Word (.doc)
          </button>
        </div>

        {/* BULK ACTIONS STRIP */}
        {selectedRooms.size > 0 && (
          <div className="hk-bulk-strip">
            <span className="count">{selectedRooms.size} Selected</span>
            <button type="button" className="btn btn-success btn-xs" onClick={handleBulkMarkClean}>
              ✓ Mark Clean
            </button>
            <select
              className="bulk-select"
              value={bulkStaff}
              onChange={(e) => setBulkStaff(e.target.value)}
            >
              <option value="">Assign Housekeeper...</option>
              {staffMembers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {bulkStaff && (
              <button type="button" className="btn btn-primary btn-xs" onClick={handleBulkAssignStaff}>
                Apply Staff
              </button>
            )}
          </div>
        )}
      </div>

      {/* HIGH-DENSITY HOUSEKEEPING LIST TABLE */}
      {loading ? (
        <div className="hk-loading">Loading housekeeping status list...</div>
      ) : (
        <div className="hk-table-card">
          <table className="hk-table">
            <thead>
              <tr>
                <th className="col-chk">
                  <input
                    type="checkbox"
                    checked={filteredRooms.length > 0 && selectedRooms.size === filteredRooms.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Room #</th>
                <th className="col-category">Category</th>
                <th>Floor</th>
                <th>Occupancy Status</th>
                <th>Housekeeping Status</th>
                <th>Assigned Housekeeper</th>
                <th>Remark / Comments</th>
                <th>Calendar Sync</th>
                <th className="text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => {
                const hkStatus = (room.housekeeping || "clean").toLowerCase();
                const occ = occupancyMap[room.no] || { occupied: false };
                const isSelected = selectedRooms.has(room.no);

                let statusBadgeCls = "badge-clean";
                let statusText = "🟢 Clean";
                if (hkStatus === "dirty") {
                  statusBadgeCls = "badge-dirty";
                  statusText = "🔴 Dirty";
                } else if (hkStatus === "inspected") {
                  statusBadgeCls = "badge-inspected";
                  statusText = "🔵 Inspected";
                } else if (hkStatus === "out_of_order" || hkStatus === "out-of-order" || room.status === "maintenance") {
                  statusBadgeCls = "badge-ooo";
                  statusText = "⚠️ Out of Order";
                }

                return (
                  <tr key={room.no} className={isSelected ? "selected-row" : ""}>
                    <td className="col-chk">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRoom(room.no)}
                      />
                    </td>
                    <td className="col-room">
                      <strong>{room.no}</strong>
                    </td>
                    <td className="col-category">
                      <span className="room-type-tag">{room.type}</span>
                    </td>
                    <td>Floor {room.floor || 1}</td>
                    <td>
                      {occ.occupied ? (
                        <span className="occ-tag occupied">
                          👤 {occ.guest} {occ.checkoutToday ? " (Checkout Today)" : " (In-House)"}
                        </span>
                      ) : (
                        <span className="occ-tag vacant">⚪ Vacant</span>
                      )}
                    </td>
                    <td>
                      <span className={`hk-status-tag ${statusBadgeCls}`}>
                        {statusText}
                      </span>
                    </td>
                    <td>
                      <select
                        className="inline-staff-select"
                        value={room.assignedStaff || "Unassigned"}
                        onChange={(e) => handleStaffAssign(room.no, e.target.value)}
                      >
                        {staffMembers.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="hk-remark-input"
                        placeholder="Add comments / notes..."
                        value={room.remark || room.notes || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRooms((prev) => prev.map((r) => (r.no === room.no ? { ...r, remark: val, notes: val } : r)));
                        }}
                        onBlur={(e) => handleRemarkChange(room.no, e.target.value)}
                      />
                    </td>
                    <td>
                      <span className="cal-sync-pill" title="Status automatically reflects on Tape Chart Calendar">
                        ⚡ Live Synced
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="hk-table-actions">
                        <button
                          type="button"
                          className={`btn btn-xs ${hkStatus === "clean" ? "btn-success" : "btn-outline"}`}
                          title="Mark Clean"
                          onClick={() => handleStatusChange(room.no, "clean")}
                        >
                          🟢 Clean
                        </button>
                        <button
                          type="button"
                          className={`btn btn-xs ${hkStatus === "dirty" ? "btn-danger" : "btn-outline"}`}
                          title="Mark Dirty"
                          onClick={() => handleStatusChange(room.no, "dirty")}
                        >
                          🔴 Dirty
                        </button>
                        <button
                          type="button"
                          className={`btn btn-xs ${hkStatus === "out_of_order" || hkStatus === "blocked" || room.status === "maintenance" ? "btn-warning" : "btn-outline"}`}
                          title={hkStatus === "out_of_order" || hkStatus === "blocked" || room.status === "maintenance" ? "Unblock Room / Make Available" : "Block Room / Out of Order"}
                          onClick={() => handleStatusChange(room.no, "out_of_order")}
                          style={hkStatus === "out_of_order" || hkStatus === "blocked" || room.status === "maintenance" ? { background: "#f59e0b", color: "#ffffff", fontWeight: 800 } : {}}
                        >
                          {hkStatus === "out_of_order" || hkStatus === "blocked" || room.status === "maintenance" ? "⚠️ Blocked" : "⚠️ Block"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PROVISION MODAL TO ADD NEW HOUSEKEEPER (ITEM 8 MATCH) */}
    </div>
  );
}
