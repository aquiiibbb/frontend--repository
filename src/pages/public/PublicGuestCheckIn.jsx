import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBookings, updateBooking, getRoomTypes, getRooms } from "../../services/api";
import { getHotelProfile, getHotelAddons, getTaxRules, getActiveTaxPercent, getBusinessDate } from "../../services/hotelConfig";
import AIIDScannerModal from "../../components/AIIDScannerModal";
import { fetchCityStateFromZip } from "../../services/zipLookupService";
import "./PublicGuestCheckIn.css";

export default function PublicGuestCheckIn() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const hotel = getHotelProfile() || { name: "Grand Hotel & Suites", city: "Los Angeles", country: "USA" };

  // Main Mode Tabs: "checkin" or "reserve"
  const [activeTab, setActiveTab] = useState("checkin");
  const [language, setLanguage] = useState("en"); // "en" or "es"

  // Search State
  const [searchResId, setSearchResId] = useState(reservationId || "");
  const [searchLastName, setSearchLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(null);

  // Stepper State: 0: Lookup, 1: Details & Room Preferences, 2: ID & Vehicle Info, 3: GRC & Digital Signature, 4: Completed & Mobile Key
  const [step, setStep] = useState(0);

  // Guest Details Form State
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Los Angeles");
  const [stateProv, setStateProv] = useState("CA");
  const [zip, setZip] = useState("");

  const handleZipChange = (val) => {
    setZip(val);
    if (val) {
      fetchCityStateFromZip(val).then((geo) => {
        if (geo) {
          if (geo.city) setCity(geo.city);
          if (geo.state) setStateProv(geo.state);
        }
      });
    }
  };

  // ID Verification
  const [idType, setIdType] = useState("US Driver's License");
  const [idNumber, setIdNumber] = useState("");
  const [idState, setIdState] = useState("CA");
  const [showScanner, setShowScanner] = useState(false);

  // Room Preferences & Room Choice
  const [floorPref, setFloorPref] = useState("Any");
  const [viewPref, setViewPref] = useState("Any");
  const [selectedCleanRoom, setSelectedCleanRoom] = useState("");

  // Vehicle Info (Optional)
  const [hasVehicle, setHasVehicle] = useState(false);
  const [licensePlate, setLicensePlate] = useState("");
  const [plateState, setPlateState] = useState("CA");
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");

  // Additional Guests
  const [guest2Name, setGuest2Name] = useState("");
  const [numPets, setNumPets] = useState("0");

  // Agreements & Signature
  const [smsConsent, setSmsConsent] = useState(true);
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Signature Canvas
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Date Check: Is arrival date in the future?
  const todayISO = getBusinessDate();
  const isFutureBooking = Boolean(booking?.checkIn && booking.checkIn > todayISO);

  useEffect(() => {
    if (reservationId) {
      handleFindBooking(reservationId, "");
    }
  }, [reservationId]);

  async function handleFindBooking(resIdQuery, lastNameQuery) {
    const qRes = (resIdQuery !== undefined ? resIdQuery : searchResId).trim().toLowerCase();
    const qName = (lastNameQuery !== undefined ? lastNameQuery : searchLastName).trim().toLowerCase();

    if (!qRes && !qName) {
      setError(language === "es" ? "Por favor ingrese el número de reserva o su apellido." : "Please enter your Reservation ID # or Last Name.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const allBookings = await getBookings().catch(() => []);
      const matched = allBookings.find((b) => {
        const idMatch = qRes && String(b.id || "").toLowerCase().includes(qRes);
        const nameMatch = qName && b.guest && b.guest.toLowerCase().includes(qName);
        const phoneMatch = qRes && b.phone && b.phone.includes(qRes);
        if (qRes && qName) return idMatch || (nameMatch && (phoneMatch || idMatch));
        return idMatch || nameMatch || phoneMatch;
      });

      if (matched) {
        setBooking(matched);
        setGuestName(matched.guest || "");
        setPhone(matched.phone || "");
        setEmail(matched.email || "");
        setAddress(matched.address || "");
        setCity(matched.city || "Los Angeles");
        setZip(matched.zip || "");
        setIdType(matched.idType || "US Driver's License");
        setIdNumber(matched.idNumber || "");
        setSelectedCleanRoom(matched.room || "");
        setStep(1);
      } else {
        setError(
          language === "es"
            ? "No se encontró ninguna reserva. Verifique su correo de confirmación."
            : "No matching reservation found. Please check your confirmation email or front desk."
        );
      }
    } catch (err) {
      setError(language === "es" ? "Error al buscar la reserva." : "Failed to search reservation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // SIGNATURE DRAWING HANDLERS
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  // SUBMIT SELF CHECK-IN
  const handleCompleteCheckIn = async () => {
    if (!booking) return;
    if (booking.checkIn > getBusinessDate()) {
      setError(language === "es" ? "El registro no está permitido antes de la fecha de llegada." : "Self check-in is not permitted before arrival date.");
      return;
    }
    setLoading(true);

    try {
      const signatureBase64 = canvasRef.current ? canvasRef.current.toDataURL() : null;
      const vehicleNote = hasVehicle && licensePlate ? ` [Vehicle: ${licensePlate} (${plateState}) ${carMake} ${carModel}]` : "";
      const prefsNote = ` [Floor: ${floorPref}, View: ${viewPref}]`;
      const updated = {
        ...booking,
        guest: guestName.trim() || booking.guest,
        phone: phone.trim() || booking.phone,
        email: email.trim() || booking.email,
        address: address.trim() || booking.address,
        city: city.trim() || booking.city,
        idType,
        idNumber: idNumber.trim() || booking.idNumber,
        room: selectedCleanRoom || booking.room,
        status: "checked-in",
        digitalSignature: signatureBase64 || booking.digitalSignature || booking.signature,
        signature: signatureBase64 || booking.digitalSignature || booking.signature,
        signatureOnFile: true,
        notes: `${booking.notes || ""} [Contactless Mobile Self Check-In Verified via Guest Portal]${vehicleNote}${prefsNote}`,
      };

      await updateBooking(booking.id, updated);
      setBooking(updated);
      setStep(4);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("pms_booking_updated"));
      }
    } catch (err) {
      setError(language === "es" ? "Error al completar el check-in." : "Failed to complete check-in. Please see the front desk.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gci-container">
      <AIIDScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanComplete={(scanned) => {
          if (scanned.fullName) setGuestName(scanned.fullName);
          if (scanned.phoneNumber) setPhone(scanned.phoneNumber);
          if (scanned.email) setEmail(scanned.email);
          if (scanned.address) setAddress(scanned.address);
          if (scanned.city) setCity(scanned.city);
          if (scanned.type) setIdType(scanned.type);
          if (scanned.idProofNumber) setIdNumber(scanned.idProofNumber);
        }}
      />

      <div className="gci-card">
        {/* HOTEL BRANDING HEADER */}
        <div className="gci-header">
          <div style={{ fontSize: 24, marginBottom: 2 }}>🏨</div>
          <h1 className="gci-hotel-title">{hotel.name || "Pea Soup Andersen's"}</h1>
          <div className="gci-hotel-sub">{hotel.city || "Solvang"}, {hotel.country || "CA"} • Guest Self-Service</div>
        </div>

        {/* LANGUAGE SWITCHER BAR */}
        <div className="gci-lang-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>🌐</span>
            <span style={{ fontWeight: 800 }}>{language === "es" ? "Idioma:" : "Language:"}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className={`gci-lang-btn ${language === "en" ? "active" : ""}`}
              onClick={() => setLanguage("en")}
            >
              🇺🇸 English
            </button>
            <button
              type="button"
              className={`gci-lang-btn ${language === "es" ? "active" : ""}`}
              onClick={() => setLanguage("es")}
            >
              🇲🇽 Español
            </button>
          </div>
        </div>

        {/* SEGMENTED CONTROL TABS (Check-In vs Reserve) */}
        {step === 0 && (
          <div className="gci-tabs">
            <button
              type="button"
              className={`gci-tab ${activeTab === "checkin" ? "active" : ""}`}
              onClick={() => setActiveTab("checkin")}
            >
              🔑 {language === "es" ? "Registro / Check-In" : "Check-In"}
            </button>
            <button
              type="button"
              className={`gci-tab ${activeTab === "reserve" ? "active" : ""}`}
              onClick={() => navigate("/book")}
            >
              📅 {language === "es" ? "Reservar Habitación" : "Reserve Room"}
            </button>
          </div>
        )}

        <div className="gci-body">
          {step > 0 && (
            <div className="gci-stepper">
              <div className={`gci-stepper-dot ${step >= 1 ? "active" : ""}`} />
              <div className={`gci-stepper-dot ${step >= 2 ? "active" : ""}`} />
              <div className={`gci-stepper-dot ${step >= 3 ? "active" : ""}`} />
              <div className={`gci-stepper-dot ${step >= 4 ? "active" : ""}`} />
            </div>
          )}

          {/* STEP 0: LOOKUP RESERVATION */}
          {step === 0 && (
            <div>
              <h2 className="gci-title">
                {language === "es" ? "Buscar su Reserva" : "Find Your Reservation"}
              </h2>
              <p className="gci-desc">
                {language === "es"
                  ? "Ingrese su número de reserva o apellido para comenzar el registro digital."
                  : "Enter your Reservation ID # or Last Name to begin mobile self check-in."}
              </p>

              {error && (
                <div style={{ background: "#fef2f2", color: "#ef4444", padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="gci-field-group">
                <label>{language === "es" ? "NÚMERO DE RESERVA #" : "RESERVATION ID #"}</label>
                <input
                  type="text"
                  className="gci-input"
                  placeholder={language === "es" ? "Ej. BK-1002 o 1002" : "e.g. BK-1002 or 1002"}
                  value={searchResId}
                  onChange={(e) => setSearchResId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFindBooking()}
                />
              </div>

              <div className="gci-field-group">
                <label>{language === "es" ? "APELLIDO DEL HUÉSPED" : "LAST NAME ON RESERVATION"}</label>
                <input
                  type="text"
                  className="gci-input"
                  placeholder={language === "es" ? "Ej. Smith o Garcia" : "e.g. Smith or Johnson"}
                  value={searchLastName}
                  onChange={(e) => setSearchLastName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFindBooking()}
                />
              </div>

              <button type="button" className="gci-btn-primary" onClick={() => handleFindBooking()} disabled={loading}>
                {loading ? (language === "es" ? "Buscando..." : "Searching...") : (language === "es" ? "Buscar Reserva ➔" : "Search Reservation ➔")}
              </button>

              <div style={{ marginTop: 24, textAlign: "center", borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {language === "es" ? "¿No tiene una reserva aún?" : "Don't have a reservation yet?"}
                </span>
                <button
                  type="button"
                  className="gci-btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => navigate("/book")}
                >
                  📅 {language === "es" ? "Reservar una Habitación" : "Book a Room Now"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: STAY SUMMARY & ROOM PREFERENCES */}
          {step === 1 && booking && (
            <div>
              <h2 className="gci-title">
                {language === "es" ? `¡Bienvenido, ${booking.guest}!` : `Welcome, ${booking.guest}!`}
              </h2>
              <p className="gci-desc">
                {language === "es" ? "Verifique el resumen de su estancia y preferencias de habitación." : "Review your stay summary and room preferences."}
              </p>

              <div className="gci-summary-box">
                <div className="gci-summary-row">
                  <span className="gci-summary-label">Reservation Ref</span>
                  <span className="gci-summary-val">{booking.id}</span>
                </div>
                <div className="gci-summary-row">
                  <span className="gci-summary-label">Room Type</span>
                  <span className="gci-summary-val">{booking.roomType} (Room {selectedCleanRoom || "Assigned at Check-In"})</span>
                </div>
                <div className="gci-summary-row">
                  <span className="gci-summary-label">Check-In Date</span>
                  <span className="gci-summary-val">{booking.checkIn} (from 3:00 PM)</span>
                </div>
                <div className="gci-summary-row">
                  <span className="gci-summary-label">Check-Out Date</span>
                  <span className="gci-summary-val">{booking.checkOut} (until 11:00 AM)</span>
                </div>
                <div className="gci-summary-row">
                  <span className="gci-summary-label">Nights &amp; Guests</span>
                  <span className="gci-summary-val">{booking.nights} Night(s) • {booking.adults} Adult(s)</span>
                </div>
                <div className="gci-summary-row">
                  <span className="gci-summary-label">Total Amount</span>
                  <span className="gci-summary-val" style={{ color: "#4f46e5", fontSize: 16 }}>${booking.totalAmount}</span>
                </div>
              </div>

              {/* ROOM PREFERENCE SELECTOR */}
              <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a", marginBottom: 10, textTransform: "uppercase" }}>
                  🛏️ Room Location Preferences
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: "#475569" }}>FLOOR PREFERENCE</label>
                    <select className="gci-input" style={{ height: 38, fontSize: 12 }} value={floorPref} onChange={(e) => setFloorPref(e.target.value)}>
                      <option value="Any">Any Floor</option>
                      <option value="Ground Floor">Ground Floor (1st Floor)</option>
                      <option value="Upper Floor">Upper Floor (2nd/3rd Floor)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: "#475569" }}>VIEW PREFERENCE</label>
                    <select className="gci-input" style={{ height: 38, fontSize: 12 }} value={viewPref} onChange={(e) => setViewPref(e.target.value)}>
                      <option value="Any">Any View</option>
                      <option value="Quiet Side">Quiet / Garden Side</option>
                      <option value="City View">City / Courtyard View</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* FUTURE RESERVATION WARNING BANNER */}
              {isFutureBooking && (
                <div style={{ background: "#fffbebf0", border: "2px solid #f59e0b", borderRadius: 14, padding: "14px 16px", marginBottom: 16, boxShadow: "0 4px 12px rgba(245,158,11,0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>🛑</span>
                    <strong style={{ color: "#b45309", fontSize: 13.5, fontWeight: 900 }}>
                      {language === "es" ? "REGISTRO EN FECHA FUTURA" : "FUTURE RESERVATION NOTICE"}
                    </strong>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#92400e", fontWeight: 700, lineHeight: 1.4 }}>
                    {language === "es"
                      ? `Su fecha de llegada programada es el ${booking.checkIn}. El registro móvil se abre únicamente el día de su llegada.`
                      : `Your scheduled check-in date is ${booking.checkIn} (Check-in time starts at 3:00 PM). Self check-in is not permitted before arrival date. Please return on ${booking.checkIn} to complete mobile check-in.`}
                  </div>
                </div>
              )}

              <button
                type="button"
                className="gci-btn-primary"
                onClick={() => !isFutureBooking && setStep(2)}
                disabled={isFutureBooking}
                style={{ opacity: isFutureBooking ? 0.5 : 1, cursor: isFutureBooking ? "not-allowed" : "pointer" }}
              >
                {isFutureBooking
                  ? (language === "es" ? "🔒 Registro disponible el día de su llegada" : "🔒 Mobile Check-In opens on Arrival Date")
                  : (language === "es" ? "Continuar a Verificación de Identidad ➔" : "Continue to ID Verification ➔")}
              </button>
            </div>
          )}

          {/* STEP 2: ID VERIFICATION & VEHICLE INFO */}
          {step === 2 && (
            <div>
              <h2 className="gci-title">
                {language === "es" ? "Identificación y Vehículo" : "Identification & Vehicle Info"}
              </h2>
              <p className="gci-desc">
                {language === "es" ? "Escanee su identificación oficial y proporcione los datos de su vehículo si viaja en automóvil." : "Scan your photo ID & optionally add vehicle details for hotel parking."}
              </p>

              {/* ID SCANNER SECTION */}
              <div style={{ background: "#f8fafc", border: "1.5px dashed #4f46e5", borderRadius: 14, padding: 14, textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#4f46e5", marginBottom: 8, textTransform: "uppercase" }}>
                  📷 Photo ID Scanner &amp; AI Auto-Fill
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <select className="gci-input" style={{ height: 38 }} value={idType} onChange={(e) => setIdType(e.target.value)}>
                    <option value="US Driver's License">Driver's License</option>
                    <option value="US Passport">Passport</option>
                    <option value="US State ID">State ID Card</option>
                    <option value="Foreign Passport">Foreign Passport</option>
                  </select>
                  <input type="text" className="gci-input" style={{ height: 38 }} placeholder="Govt ID Number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  style={{ width: "100%", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  🤖 Scan Photo ID &amp; AI Auto-Fill
                </button>
              </div>

              {/* GUEST CONTACT DETAILS */}
              <div className="gci-field-group">
                <label>FULL NAME *</label>
                <input type="text" className="gci-input" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div className="gci-field-group">
                  <label>PHONE NUMBER *</label>
                  <input type="tel" className="gci-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="gci-field-group">
                  <label>EMAIL ADDRESS *</label>
                  <input type="email" className="gci-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="gci-field-group">
                <label>STREET ADDRESS</label>
                <input type="text" className="gci-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street Address" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.8fr", gap: 8, marginBottom: 16 }}>
                <div className="gci-field-group">
                  <label>CITY</label>
                  <input type="text" className="gci-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                </div>
                <div className="gci-field-group">
                  <label>STATE / PROVINCE</label>
                  <input type="text" className="gci-input" value={stateProv} onChange={(e) => setStateProv(e.target.value)} placeholder="State / Province" />
                </div>
                <div className="gci-field-group">
                  <label>ZIP / POSTAL</label>
                  <input type="text" className="gci-input" value={zip} onChange={(e) => handleZipChange(e.target.value)} placeholder="Zip Code" />
                </div>
              </div>

              {/* VEHICLE INFO OPTIONAL TOGGLE */}
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", margin: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>🚗 Register Vehicle for Parking Permit (Optional)</span>
                  <input type="checkbox" checked={hasVehicle} onChange={(e) => setHasVehicle(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#4f46e5" }} />
                </label>

                {hasVehicle && (
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                    <input type="text" className="gci-input" style={{ height: 38 }} placeholder="License Plate #" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
                    <input type="text" className="gci-input" style={{ height: 38 }} placeholder="State (ST)" value={plateState} onChange={(e) => setPlateState(e.target.value)} />
                    <input type="text" className="gci-input" style={{ height: 38 }} placeholder="Make (e.g. Toyota)" value={carMake} onChange={(e) => setCarMake(e.target.value)} />
                    <input type="text" className="gci-input" style={{ height: 38 }} placeholder="Model (e.g. Camry)" value={carModel} onChange={(e) => setCarModel(e.target.value)} />
                  </div>
                )}
              </div>

              <button type="button" className="gci-btn-primary" onClick={() => setStep(3)}>
                {language === "es" ? "Continuar a Firma Digital ➔" : "Continue to Digital Signature ➔"}
              </button>

              <button type="button" className="gci-btn-secondary" onClick={() => setStep(1)}>
                ⬅️ {language === "es" ? "Atrás" : "Back"}
              </button>
            </div>
          )}

          {/* STEP 3: DIGITAL SIGNATURE & GRC */}
          {step === 3 && (
            <div>
              <h2 className="gci-title">
                {language === "es" ? "Tarjeta de Registro y Poliza" : "Guest Registration & Terms"}
              </h2>
              <p className="gci-desc">
                {language === "es" ? "Revise las políticas del hotel y firme digitalmente con su dedo o ratón." : "Please review hotel policies and sign digitally below."}
              </p>

              {/* SCROLLABLE HOTEL POLICIES BOX */}
              <div className="gci-policy-box">
                <strong>Hotel Rules &amp; Liability Release:</strong>
                <br />
                • <strong>Check-In &amp; Check-Out:</strong> Check-in begins at 3:00 PM. Standard checkout is 11:00 AM.
                <br />
                • <strong>Smoking Policy:</strong> 100% Smoke-Free Property. $400 deep cleaning fee for smoking in rooms.
                <br />
                • <strong>Quiet Hours:</strong> 10:00 PM to 8:00 AM. Visitors must vacate by 10:00 PM.
                <br />
                • <strong>Liability:</strong> Guest is personally liable for room charges and accidental damages.
              </div>

              {/* SMS CONSENT CHECKBOX */}
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, marginBottom: 14 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", margin: 0 }}>
                  <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: "#4f46e5" }} />
                  <span style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.4 }}>
                    I agree to receive automated SMS updates regarding my reservation and room key. Reply STOP to cancel.
                  </span>
                </label>
              </div>

              {/* DIGITAL SIGNATURE CANVAS */}
              <div className="gci-field-group">
                <label>DIGITAL SIGNATURE *</label>
                <div className="gci-signature-wrap">
                  <button type="button" className="gci-signature-clear" onClick={clearSignature}>
                    Clear Signature
                  </button>
                  <canvas
                    ref={canvasRef}
                    className="gci-signature-canvas"
                    width={400}
                    height={140}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
                <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#4f46e5" }} />
                I agree to the hotel policies &amp; registration terms.
              </label>

              <button
                type="button"
                className="gci-btn-primary"
                onClick={handleCompleteCheckIn}
                disabled={!hasSigned || !agreedTerms || loading}
                style={{ opacity: !hasSigned || !agreedTerms || loading ? 0.6 : 1 }}
              >
                {loading
                  ? (language === "es" ? "Completando Registro..." : "Completing Check-In...")
                  : (language === "es" ? "Completar Registro y Obtener Llave 🔑" : "Complete Check-In & Get Digital Key 🔑")}
              </button>

              <button type="button" className="gci-btn-secondary" onClick={() => setStep(2)}>
                ⬅️ {language === "es" ? "Atrás" : "Back"}
              </button>
            </div>
          )}

          {/* STEP 4: COMPLETED & MOBILE ROOM KEY CARD */}
          {step === 4 && booking && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 48, marginBottom: 4 }}>🎉</div>
                <h2 className="gci-title" style={{ color: "#10b981" }}>
                  {language === "es" ? "¡Registro Completado!" : "Check-In Complete!"}
                </h2>
                <p className="gci-desc">
                  {language === "es"
                    ? `Su habitación está lista. ¡Bienvenido a ${hotel.name}!`
                    : `Your room is clean and ready. Welcome to ${hotel.name}!`}
                </p>
              </div>

              {/* MOBILE ROOM KEYCARD */}
              <div className="gci-keycard">
                <div className="gci-room-label">ROOM NUMBER</div>
                <div className="gci-room-number">{booking.room || selectedCleanRoom || "204"}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>
                  {booking.roomType} • {booking.guest}
                </div>

                <div className="gci-qr-placeholder">
                  <svg width="110" height="110" viewBox="0 0 100 100" fill="none">
                    <rect x="10" y="10" width="30" height="30" rx="4" fill="#0f172a" />
                    <rect x="15" y="15" width="20" height="20" rx="2" fill="#ffffff" />
                    <rect x="60" y="10" width="30" height="30" rx="4" fill="#0f172a" />
                    <rect x="65" y="15" width="20" height="20" rx="2" fill="#ffffff" />
                    <rect x="10" y="60" width="30" height="30" rx="4" fill="#0f172a" />
                    <rect x="15" y="65" width="20" height="20" rx="2" fill="#ffffff" />
                    <rect x="50" y="50" width="15" height="15" fill="#10b981" />
                    <rect x="70" y="50" width="20" height="10" fill="#0f172a" />
                    <rect x="50" y="70" width="10" height="20" fill="#0f172a" />
                    <rect x="70" y="75" width="20" height="15" fill="#10b981" />
                  </svg>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399", marginTop: 4 }}>
                  📱 Scan QR at Door Lock Reader or Lobby Kiosk
                </div>

                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #334155", textAlign: "left", fontSize: 12, color: "#cbd5e1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block", fontSize: 10 }}>HOTEL WIFI</span>
                    <strong>PeaSoup_Guest</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block", fontSize: 10 }}>WIFI PASSWORD</span>
                    <strong>Welcome2026</strong>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <button type="button" className="gci-btn-secondary" onClick={() => window.print()}>
                  🖨️ {language === "es" ? "Imprimir Recibo de Registro" : "Print Registration Slip"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
