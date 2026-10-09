import { dataStore } from "../../services/dataStore";
import { useState, useEffect, useMemo } from "react";
import "./guestDatabase.css";
import { getBookings } from "../../services/api";
import CustomDatePicker from "../../components/CustomDatePicker";

export default function GuestDatabase() {
  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // all, vip, repeat, blacklisted
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState("");

  // New Guest Form State
  const [newGuest, setNewGuest] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    dob: "",
    city: "",
    nationality: "India",
    idProofType: "Aadhaar Card",
    idProofNumber: "",
    preferences: "",
    notes: "",
    isVIP: false,
    isBlacklisted: false,
  });

  // Load Custom Saved Profiles from LocalStorage
  const getSavedCustomGuests = () => {
    try {
      const saved = dataStore.getItem("pms_custom_guests");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  };

  const saveCustomGuestsToStorage = (customList) => {
    try {
      dataStore.setItem("pms_custom_guests", JSON.stringify(customList));
    } catch (e) {}
  };

  async function loadData() {
    setLoading(true);
    try {
      const bList = await getBookings().catch(() => []);
      setBookings(bList || []);

      const customSaved = getSavedCustomGuests();
      const mergedMap = new Map();

      // First populate custom saved guests
      customSaved.forEach((cg) => {
        if (!cg || !cg.fullName) return;
        const key = cg.fullName.trim().toLowerCase();
        mergedMap.set(key, {
          ...cg,
          id: cg.id || `gst-c-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          staysCount: cg.staysCount || 0,
          totalSpent: cg.totalSpent || 0,
          lastStayDate: cg.lastStayDate || new Date().toISOString().split('T')[0]
        });
      });

      // Second populate and aggregate live guests from actual PMS Bookings
      if (bList && bList.length > 0) {
        bList.forEach((b) => {
          if (!b || !b.guest || b.isDeleted) return;
          const isCancelled = String(b.status || "").toLowerCase() === "cancelled";
          const gName = b.guest.trim();
          const key = gName.toLowerCase();
          const existing = mergedMap.get(key);
          const amt = isCancelled ? 0 : Number(b.totalAmount || b.subtotal || 0);
          const stayDate = b.checkIn || b.checkOut || new Date().toISOString().split('T')[0];

          if (existing) {
            if (!isCancelled) {
              existing.staysCount += 1;
              existing.totalSpent += amt;
            }
            if (stayDate > existing.lastStayDate) {
              existing.lastStayDate = stayDate;
            }
            if (b.phone && !existing.phoneNumber) existing.phoneNumber = b.phone;
            if (b.email && !existing.email) existing.email = b.email;
            if ((b.dob || b.dateOfBirth) && !existing.dob) existing.dob = b.dob || b.dateOfBirth;
            if (b.city && !existing.city) existing.city = b.city;
            if (b.idNumber && !existing.idProofNumber) existing.idProofNumber = b.idNumber;
            if (b.idType && (!existing.idProofType || existing.idProofType === "Aadhaar Card")) existing.idProofType = b.idType;
          } else {
            mergedMap.set(key, {
              id: `gst-b-${b.id || Math.random().toString(36).substr(2, 6)}`,
              fullName: gName,
              email: b.email || "",
              phoneNumber: b.phone || "",
              dob: b.dob || b.dateOfBirth || "",
              city: b.city || "Local",
              nationality: b.nationality || "India",
              idProofType: b.idType || "Govt Photo ID",
              idProofNumber: b.idNumber || "",
              isVIP: Boolean(b.isVIP),
              isBlacklisted: Boolean(b.isBlacklisted),
              isSelfCheckIn: Boolean(b.signature || b.digitalSignature || (b.notes && b.notes.includes("Self Check-In"))),
              signature: b.signature || b.digitalSignature || null,
              preferences: b.preferences || "",
              notes: b.notes || `Registered via Booking ${b.id || b.resCode || ''}`,
              staysCount: isCancelled ? 0 : 1,
              totalSpent: amt,
              lastStayDate: stayDate,
            });
          }
        });
      }

      setGuests(Array.from(mergedMap.values()));
    } catch (err) {
      console.error("Error loading Guest CRM data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    window.addEventListener("pms_bookings_updated", loadData);
    window.addEventListener("storage", loadData);
    return () => {
      window.removeEventListener("pms_bookings_updated", loadData);
      window.removeEventListener("storage", loadData);
    };
  }, []);

  // Handle Add New Guest Profile
  const handleCreateGuest = (e) => {
    e.preventDefault();
    if (!newGuest.fullName.trim()) {
      alert("Please enter guest name.");
      return;
    }

    const created = {
      id: `gst-c-${Date.now()}`,
      fullName: newGuest.fullName.trim(),
      email: newGuest.email.trim(),
      phoneNumber: newGuest.phoneNumber.trim(),
      dob: newGuest.dob ? newGuest.dob.trim() : "",
      city: newGuest.city.trim() || "Local",
      nationality: newGuest.nationality || "India",
      idProofType: newGuest.idProofType || "Govt Photo ID",
      idProofNumber: newGuest.idProofNumber.trim(),
      isVIP: Boolean(newGuest.isVIP),
      isBlacklisted: Boolean(newGuest.isBlacklisted),
      preferences: newGuest.preferences.trim(),
      notes: newGuest.notes.trim(),
      staysCount: 0,
      totalSpent: 0,
      lastStayDate: new Date().toISOString().split('T')[0]
    };

    const currentSaved = getSavedCustomGuests();
    const updatedCustom = [created, ...currentSaved];
    saveCustomGuestsToStorage(updatedCustom);

    setShowAddModal(false);
    setNewGuest({
      fullName: "",
      email: "",
      phoneNumber: "",
      dob: "",
      city: "",
      nationality: "India",
      idProofType: "Govt Photo ID",
      idProofNumber: "",
      preferences: "",
      notes: "",
      isVIP: false,
      isBlacklisted: false,
    });

    setToast(`Added Guest Profile for ${created.fullName}`);
    setTimeout(() => setToast(""), 3500);
    loadData();
  };

  // Toggle VIP / Blacklist status
  const handleToggleFlag = (guestId, flagName) => {
    const target = guests.find((g) => g.id === guestId);
    if (!target) return;

    const updatedGuests = guests.map((g) => {
      if (g.id === guestId) {
        return { ...g, [flagName]: !g[flagName] };
      }
      return g;
    });

    setGuests(updatedGuests);

    // Persist to custom guests storage
    const currentSaved = getSavedCustomGuests();
    const existingIdx = currentSaved.findIndex((cg) => cg.fullName.toLowerCase() === target.fullName.toLowerCase());
    const updatedTarget = { ...target, [flagName]: !target[flagName] };

    if (existingIdx >= 0) {
      currentSaved[existingIdx] = updatedTarget;
    } else {
      currentSaved.push(updatedTarget);
    }
    saveCustomGuestsToStorage(currentSaved);

    if (selectedGuest && selectedGuest.id === guestId) {
      setSelectedGuest(updatedTarget);
    }

    setToast(`Updated ${target.fullName} status`);
    setTimeout(() => setToast(""), 3000);
  };

  // FILTERED GUESTS
  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      const matchSearch =
        g.fullName.toLowerCase().includes(search.toLowerCase()) ||
        (g.phoneNumber && g.phoneNumber.includes(search)) ||
        (g.email && g.email.toLowerCase().includes(search.toLowerCase())) ||
        (g.city && g.city.toLowerCase().includes(search.toLowerCase())) ||
        (g.idProofNumber && g.idProofNumber.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;

      if (filterTab === "vip") return g.isVIP;
      if (filterTab === "repeat") return g.staysCount >= 2;
      if (filterTab === "blacklisted") return g.isBlacklisted;
      return true;
    });
  }, [guests, search, filterTab]);

  // STATISTICS
  const totalGuestsCount = guests.length;
  const vipCount = guests.filter((g) => g.isVIP).length;
  const repeatCount = guests.filter((g) => g.staysCount >= 2).length;
  const blacklistedCount = guests.filter((g) => g.isBlacklisted).length;
  const totalLifetimeSpent = guests.reduce((sum, g) => sum + (g.totalSpent || 0), 0);

  function getInitials(name) {
    if (!name) return "G";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function formatDateMMDDYYYY(dateStr) {
    if (!dateStr || dateStr === "—") return "—";
    const cleanStr = String(dateStr).split("T")[0];
    const parts = cleanStr.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const [year, month, day] = parts;
      return `${month}/${day}/${year}`;
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
      }
    } catch (e) {}
    return dateStr;
  }

  if (loading) {
    return (
      <div className="crm-loading">
        <div className="crm-spinner"></div>
        <span>Loading Live Guest Directory &amp; Profiles...</span>
      </div>
    );
  }

  return (
    <div className="crm-container">
      {/* TOP HEADER */}
      <div className="crm-header">
        <h1>Guest Directory</h1>
        <button
          type="button"
          className="btn btn-add-guest"
          onClick={() => setShowAddModal(true)}
          style={{ background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1", padding: "10px 18px", borderRadius: "8px", fontWeight: "800", cursor: "pointer" }}
        >
          + Add Guest Profile
        </button>
      </div>

      {toast && <div className="crm-toast">{toast}</div>}

      {/* TOOLBAR CONTROLS */}
      <div className="crm-toolbar">
        <div className="crm-search-box">
          <span style={{ fontSize: "14px", color: "#64748b" }}>🔍</span>
          <input
            type="text"
            placeholder="Search by guest name, phone, email, city, ID #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="clear-btn" onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>

        <div className="crm-filter-tabs">
          <button
            type="button"
            className={`tab ${filterTab === "all" ? "active" : ""}`}
            onClick={() => setFilterTab("all")}
          >
            All Guests ({guests.length})
          </button>
          <button
            type="button"
            className={`tab ${filterTab === "vip" ? "active" : ""}`}
            onClick={() => setFilterTab("vip")}
          >
            VIP Profiles ({vipCount})
          </button>
          <button
            type="button"
            className={`tab ${filterTab === "repeat" ? "active" : ""}`}
            onClick={() => setFilterTab("repeat")}
          >
            Repeat Guests ({repeatCount})
          </button>
          <button
            type="button"
            className={`tab ${filterTab === "blacklisted" ? "active" : ""}`}
            onClick={() => setFilterTab("blacklisted")}
          >
            Blacklisted ({blacklistedCount})
          </button>
        </div>
      </div>

      {/* GUEST TABLE */}
      <div className="crm-table-card">
        <table className="crm-table">
          <thead>
            <tr>
              <th>GUEST NAME</th>
              <th>CONTACT DETAILS</th>
              <th>GOVT ID PROOF</th>
              <th>TOTAL STAYS</th>
              <th>LIFETIME SPENT</th>
              <th>LAST STAY</th>
              <th style={{ textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredGuests.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b", fontStyle: "italic" }}>
                  No guest profiles found matching your search. Add a new profile or create a reservation in Front Desk.
                </td>
              </tr>
            ) : (
              filteredGuests.map((g) => (
                <tr key={g.id} className={g.isBlacklisted ? "row-blacklisted" : ""}>
                  <td>
                    <div className="crm-guest-name-cell">
                      <div className="avatar-circle">{getInitials(g.fullName)}</div>
                      <div>
                        <strong style={{ fontSize: "14px", color: "#000000" }}>{g.fullName}</strong>
                        <div className="badges-row">
                          {g.isVIP && <span className="badge badge-vip">⭐ VIP</span>}
                          {g.staysCount >= 2 && <span className="badge badge-repeat">{g.staysCount} Stays</span>}
                          {g.isBlacklisted && <span className="badge badge-danger">⛔ Flagged</span>}
                          {g.isSelfCheckIn && <span className="badge badge-selfcheckin">✍️ Signature</span>}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="crm-contact-cell">
                      <strong>{g.phoneNumber || "N/A"}</strong>
                      <span className="sub">{g.email || "N/A"}</span>
                      {g.city && <span className="sub">{g.city}</span>}
                    </div>
                  </td>

                  <td>
                    <div className="crm-id-cell">
                      <strong>{g.idProofType || "Govt Photo ID"}</strong>
                      <span className="sub">{g.idProofNumber || "Not Provided"}</span>
                    </div>
                  </td>

                  <td>
                    <strong style={{ fontSize: "13.5px", color: "#000000" }}>{g.staysCount} Stay{g.staysCount !== 1 ? 's' : ''}</strong>
                  </td>

                  <td>
                    <strong style={{ fontSize: "14px", color: "#000000" }}>
                      ${Number(g.totalSpent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </td>

                  <td>
                    <span style={{ fontSize: "12.5px", color: "#475569", fontWeight: "700" }}>{formatDateMMDDYYYY(g.lastStayDate)}</span>
                  </td>

                  <td style={{ textAlign: "center" }} className="crm-actions-cell">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setSelectedGuest(g)}
                    >
                      View CRM Profile
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* VIEW GUEST PROFILE MODAL */}
      {selectedGuest && (
        <div className="crm-modal-backdrop" >
          <div className="crm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <h3>Guest CRM Profile: {selectedGuest.fullName}</h3>
              <button className="crm-modal-close" onClick={() => setSelectedGuest(null)}>×</button>
            </div>

            <div className="crm-modal-body">
              <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #cbd5e1" }}>
                <div className="avatar-circle" style={{ width: 48, height: 48, fontSize: 18 }}>
                  {getInitials(selectedGuest.fullName)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#000000" }}>{selectedGuest.fullName}</h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: 12.5, color: "#64748b" }}>
                    {selectedGuest.city ? `${selectedGuest.city} · ` : ""}{selectedGuest.nationality || "India"}
                  </p>
                </div>
              </div>

              <div className="crm-form-grid">
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Phone Number</label>
                  <p style={{ margin: "4px 0 0 0", fontWeight: 800, color: "#000000" }}>{selectedGuest.phoneNumber || "N/A"}</p>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Email Address</label>
                  <p style={{ margin: "4px 0 0 0", fontWeight: 800, color: "#000000" }}>{selectedGuest.email || "N/A"}</p>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Date of Birth</label>
                  <p style={{ margin: "4px 0 0 0", fontWeight: 800, color: "#000000" }}>{selectedGuest.dob || "N/A"}</p>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>ID Proof Type</label>
                  <p style={{ margin: "4px 0 0 0", fontWeight: 800, color: "#000000" }}>{selectedGuest.idProofType || "N/A"}</p>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>ID Proof Number</label>
                  <p style={{ margin: "4px 0 0 0", fontWeight: 800, color: "#000000" }}>{selectedGuest.idProofNumber || "N/A"}</p>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Stays in PMS</label>
                  <p style={{ margin: "4px 0 0 0", fontWeight: 800, color: "#000000" }}>{selectedGuest.staysCount} Stay{selectedGuest.staysCount !== 1 ? 's' : ''}</p>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Lifetime Spent</label>
                  <p style={{ margin: "4px 0 0 0", fontWeight: 800, color: "#000000" }}>
                    ${Number(selectedGuest.totalSpent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {selectedGuest.preferences && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <strong style={{ fontSize: 12, color: "#000000", display: "block", marginBottom: 4 }}>Guest Preferences:</strong>
                  <span style={{ fontSize: 13, color: "#475569" }}>{selectedGuest.preferences}</span>
                </div>
              )}

              {selectedGuest.notes && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <strong style={{ fontSize: 12, color: "#000000", display: "block", marginBottom: 4 }}>CRM Audit Notes:</strong>
                  <span style={{ fontSize: 13, color: "#475569" }}>{selectedGuest.notes}</span>
                </div>
              )}

              {/* TOGGLE VIP / BLACKLIST FLAGS */}
              <div style={{ display: "flex", gap: 12, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1, padding: "8px", borderRadius: "8px", border: selectedGuest.isVIP ? "1px solid #94a3b8" : "1px solid #cbd5e1", background: selectedGuest.isVIP ? "#e2e8f0" : "#ffffff", color: selectedGuest.isVIP ? "#0f172a" : "#475569", fontWeight: "800", cursor: "pointer" }}
                  onClick={() => handleToggleFlag(selectedGuest.id, "isVIP")}
                >
                  {selectedGuest.isVIP ? "★ VIP Profile Active" : "☆ Mark as VIP Guest"}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1, padding: "8px", borderRadius: "8px", border: selectedGuest.isBlacklisted ? "1px solid #94a3b8" : "1px solid #cbd5e1", background: selectedGuest.isBlacklisted ? "#e2e8f0" : "#ffffff", color: selectedGuest.isBlacklisted ? "#0f172a" : "#475569", fontWeight: "800", cursor: "pointer" }}
                  onClick={() => handleToggleFlag(selectedGuest.id, "isBlacklisted")}
                >
                  {selectedGuest.isBlacklisted ? "⛔ Blacklisted / Flagged" : "⚠️ Flag / Blacklist Guest"}
                </button>
              </div>
            </div>

            <div className="crm-modal-footer">
              <button type="button" className="btn" style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: "800", cursor: "pointer" }} onClick={() => setSelectedGuest(null)}>
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW GUEST PROFILE MODAL */}
      {showAddModal && (
        <div className="crm-modal-backdrop" >
          <div className="crm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <h3>Create Live Guest Profile</h3>
              <button className="crm-modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateGuest}>
              <div className="crm-modal-body">
                <div className="crm-form-grid">
                  <div className="crm-form-group full-width">
                    <label>Full Guest Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ben Nelson"
                      value={newGuest.fullName}
                      onChange={(e) => setNewGuest({ ...newGuest, fullName: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="crm-form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={newGuest.phoneNumber}
                      onChange={(e) => setNewGuest({ ...newGuest, phoneNumber: e.target.value })}
                    />
                  </div>

                  <div className="crm-form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="guest@example.com"
                      value={newGuest.email}
                      onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                    />
                  </div>

                  <div className="crm-form-group">
                    <label>Date of Birth</label>
                    <CustomDatePicker
                      value={newGuest.dob || ""}
                      onChange={(e) => setNewGuest({ ...newGuest, dob: e.target.value })}
                      placeholder="Select Date of Birth"
                    />
                  </div>

                  <div className="crm-form-group">
                    <label>City / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Bhopal"
                      value={newGuest.city}
                      onChange={(e) => setNewGuest({ ...newGuest, city: e.target.value })}
                    />
                  </div>

                  <div className="crm-form-group">
                    <label>Nationality</label>
                    <input
                      type="text"
                      placeholder="India"
                      value={newGuest.nationality}
                      onChange={(e) => setNewGuest({ ...newGuest, nationality: e.target.value })}
                    />
                  </div>

                  <div className="crm-form-group">
                    <label>Govt ID Proof Type</label>
                    <select
                      value={newGuest.idProofType}
                      onChange={(e) => setNewGuest({ ...newGuest, idProofType: e.target.value })}
                    >
                      <option value="Govt Photo ID">Govt Photo ID</option>
                      <option value="Aadhaar Card">Aadhaar Card</option>
                      <option value="Passport">Passport</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Voter ID">Voter ID</option>
                    </select>
                  </div>

                  <div className="crm-form-group">
                    <label>ID Proof Number</label>
                    <input
                      type="text"
                      placeholder="e.g. ABCD1234E"
                      value={newGuest.idProofNumber}
                      onChange={(e) => setNewGuest({ ...newGuest, idProofNumber: e.target.value })}
                    />
                  </div>

                  <div className="crm-form-group full-width">
                    <label>Guest Preferences</label>
                    <input
                      type="text"
                      placeholder="e.g. High floor, quiet room, extra pillows"
                      value={newGuest.preferences}
                      onChange={(e) => setNewGuest({ ...newGuest, preferences: e.target.value })}
                    />
                  </div>

                  <div className="crm-form-group full-width">
                    <label>CRM Notes</label>
                    <textarea
                      rows={2}
                      placeholder="Operational or billing notes..."
                      value={newGuest.notes}
                      onChange={(e) => setNewGuest({ ...newGuest, notes: e.target.value })}
                    />
                  </div>

                  <div className="crm-form-group full-width" style={{ flexDirection: "row", gap: 20 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newGuest.isVIP}
                        onChange={(e) => setNewGuest({ ...newGuest, isVIP: e.target.checked })}
                      />
                      ★ Mark as VIP Guest
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newGuest.isBlacklisted}
                        onChange={(e) => setNewGuest({ ...newGuest, isBlacklisted: e.target.checked })}
                      />
                      ⚠️ Flag / Blacklist Guest
                    </label>
                  </div>
                </div>
              </div>

              <div className="crm-modal-footer">
                <button
                  type="button"
                  className="btn"
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: "800", cursor: "pointer" }}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f1f5f9", color: "#0f172a", fontWeight: "800", cursor: "pointer" }}
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
