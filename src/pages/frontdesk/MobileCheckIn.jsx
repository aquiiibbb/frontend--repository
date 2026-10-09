import { useState, useRef, useEffect } from "react";
import SendSelfCheckInModal from "../../components/SendSelfCheckInModal";
import "./mobileCheckIn.css";
import { getBookings, updateBooking } from "../../services/api";

export default function MobileCheckIn() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [activeTab, setActiveTab] = useState("frontdesk"); // "frontdesk" or "simulator"
  const [toast, setToast] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);

  // Email Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  // Guest Simulator State
  const [step, setStep] = useState(1); // 1: Verify, 2: Upload ID, 3: Digital Signature, 4: Complete
  const [idFileUploaded, setIdFileUploaded] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // HTML5 Signature Canvas Ref
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [signatureData, setSignatureData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const list = await getBookings().catch(() => []);
      setBookings(list || []);
      if (list && list.length > 0) {
        setSelectedBooking(list[0]);
        setEmailInput(list[0].email || "");
      }
    } catch (err) {
      console.error("Error loading bookings for Mobile Check-in", err);
    } finally {
      setLoading(false);
    }
  }

  // SIGNATURE CANVAS DRAWING HANDLERS
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
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawingRef.current && canvasRef.current) {
      isDrawingRef.current = false;
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  // COMPLETE MOBILE CHECK-IN
  const handleCompleteCheckIn = async (b) => {
    await updateBooking(b.id, {
      status: "checked-in",
      notes: `${b.notes || ""} [Contactless Mobile Check-In & Digital Signature Verified]`,
    });

    setToast(`✅ Contactless Check-In completed for ${b.guest}!`);
    setTimeout(() => setToast(""), 4000);

    const updated = bookings.map((item) =>
      item.id === b.id ? { ...item, status: "checked-in" } : item
    );
    setBookings(updated);
    if (selectedBooking?.id === b.id) {
      setSelectedBooking({ ...selectedBooking, status: "checked-in" });
    }
  };

  // SEND VIA SMS
  const handleSendSMS = (b) => {
    setToast(`💬 Mobile Check-In link sent via SMS to ${b.phone || "+91 98765 43210"}`);
    setTimeout(() => setToast(""), 3500);
  };

  // SEND VIA EMAIL SUBMIT
  const handleSendEmailSubmit = (e) => {
    e.preventDefault();
    setShowEmailModal(false);
    setToast(`📧 Mobile Check-In link emailed to ${emailInput}`);
    setTimeout(() => setToast(""), 3500);
  };

  if (loading) {
    return (
      <div className="mc-loading">
        <div className="mc-spinner" />
        <p>Loading Contactless Check-In Engine...</p>
      </div>
    );
  }

  return (
    <div className="mc-container">
      {toast && <div className="mc-toast">{toast}</div>}

      {/* HEADER BANNER */}
      <div className="mc-header">
        <div>
          <h2>📱 Contactless Mobile Check-In &amp; Digital Signature</h2>
          <p className="mc-sub">
            Send instant mobile registration links via SMS or Email &amp; capture verified guest digital signatures.
          </p>
        </div>

        <div className="mc-mode-switch">
          <button
            type="button"
            className={`mode-btn ${activeTab === "frontdesk" ? "active" : ""}`}
            onClick={() => setActiveTab("frontdesk")}
          >
            🖥️ Receptionist View
          </button>
          <button
            type="button"
            className={`mode-btn ${activeTab === "simulator" ? "active" : ""}`}
            onClick={() => setActiveTab("simulator")}
          >
            📱 Guest Mobile Simulator
          </button>
        </div>
      </div>

      {/* VIEW A: RECEPTIONIST MONITOR */}
      {activeTab === "frontdesk" && (
        <div className="mc-main-grid">
          {/* LEFT: BOOKINGS LIST */}
          <div className="mc-card">
            <div className="mc-card-head">
              <h3>In-House &amp; Arriving Guests</h3>
              <p>Select a guest to dispatch mobile check-in link via SMS or Email.</p>
            </div>

            <div className="mc-bookings-list">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className={`mc-booking-item ${selectedBooking?.id === b.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedBooking(b);
                    setEmailInput(b.email || "");
                  }}
                >
                  <div className="mc-b-head">
                    <strong>{b.guest}</strong>
                    <span className={`status-badge ${b.status}`}>{b.status}</span>
                  </div>
                  <div className="mc-b-sub">
                    <span>Room {b.room} · {b.roomType || "Standard"}</span>
                    <span>{b.checkIn} to {b.checkOut}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: DISPATCH & REGISTRATION PANEL */}
          {selectedBooking && (
            <div className="mc-card highlight-card">
              <div className="mc-card-head">
                <h3>📋 Dispatch Mobile Check-In: {selectedBooking.guest}</h3>
                <p>Room {selectedBooking.room} · {selectedBooking.roomType || "Standard"}</p>
              </div>

              <div className="mc-console-body">
                {/* DISPATCH ACTION CARDS */}
                <div className="mc-dispatch-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <div className="dispatch-card">
                    <div className="icon">💬</div>
                    <h4>WhatsApp Link</h4>
                    <p>Open WhatsApp chat with pre-filled check-in URL.</p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ background: "#16a34a", border: "none" }}
                      onClick={() => setShowSendModal(true)}
                    >
                      💬 Send WhatsApp
                    </button>
                  </div>

                  <div className="dispatch-card">
                    <div className="icon">📱</div>
                    <h4>Send via SMS</h4>
                    <p>Dispatch instant mobile check-in link to guest phone.</p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowSendModal(true)}
                    >
                      📱 Send SMS Link
                    </button>
                  </div>

                  <div className="dispatch-card">
                    <div className="icon">📧</div>
                    <h4>Send via Email</h4>
                    <p>Send itemized registration link to guest email.</p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowSendModal(true)}
                    >
                      📧 Send Email Link
                    </button>
                  </div>
                </div>

                <SendSelfCheckInModal
                  isOpen={showSendModal}
                  booking={selectedBooking}
                  onClose={() => setShowSendModal(false)}
                />

                {/* FRONT DESK TABLET QR CODE */}
                <div className="mc-qr-section">
                  <div className="mc-qr-box">
                    <div className="qr-sim">
                      <span>📱 QR SCAN</span>
                      <strong>CHECK-IN</strong>
                    </div>
                  </div>
                  <div className="mc-qr-info">
                    <h4>Front Desk Tablet QR Code</h4>
                    <p>Allow walk-in or arriving guests to scan QR code on front desk tablet to complete check-in on their own device.</p>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setActiveTab("simulator")}
                    >
                      📱 Open Mobile Simulator
                    </button>
                  </div>
                </div>

                {/* MANUAL CHECK-IN TRIGGER */}
                <div className="mc-action-box">
                  <div>
                    <strong>Check-In &amp; Signature Status</strong>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                      Current Status: <strong style={{ color: "#0f172a" }}>{selectedBooking.status.toUpperCase()}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => handleCompleteCheckIn(selectedBooking)}
                  >
                    ✅ Complete Check-In &amp; Verify Signature
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW B: GUEST SMARTPHONE SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="mc-simulator-container">
          <div className="smartphone-frame">
            {/* PHONE NOTCH HEADER */}
            <div className="phone-header">
              <div className="notch" />
              <div className="phone-topbar">
                <span>9:41</span>
                <span>📶 5G 🔋 100%</span>
              </div>
            </div>

            {/* PHONE SCREEN BODY */}
            <div className="phone-screen">
              <div className="phone-app-header">
                <h3>🏨 Bhopal Grand Luxury Resort</h3>
                <p>Contactless Mobile Express Check-In</p>
              </div>

              {/* SIMULATOR STEP 1: VERIFY BOOKING */}
              {step === 1 && (
                <div className="sim-step-box">
                  <h4>Step 1: Welcome Guest</h4>
                  <p className="sim-desc">Confirm your reservation details to begin contactless mobile check-in.</p>

                  <div className="sim-card">
                    <span className="lbl">Guest Name</span>
                    <strong>{selectedBooking?.guest || "Rahul Deshmukh"}</strong>
                    <span className="lbl" style={{ marginTop: 8 }}>Room Reserved</span>
                    <strong>Room {selectedBooking?.room || "201"} (Deluxe Suite)</strong>
                    <span className="lbl" style={{ marginTop: 8 }}>Stay Dates</span>
                    <strong>{selectedBooking?.checkIn || "2026-07-30"} to {selectedBooking?.checkOut || "2026-08-01"}</strong>
                  </div>

                  <button type="button" className="sim-btn" onClick={() => setStep(2)}>
                    Start Verification ➔
                  </button>
                </div>
              )}

              {/* SIMULATOR STEP 2: DOCUMENT & TERMS */}
              {step === 2 && (
                <div className="sim-step-box">
                  <h4>Step 2: Upload ID &amp; Terms</h4>
                  <p className="sim-desc">Upload US Driver's License / Passport photo for instant verification.</p>

                  <div className="sim-upload-box" onClick={() => setIdFileUploaded(true)}>
                    <div className="icon">📷</div>
                    <strong>{idFileUploaded ? "✅ Govt ID Verified" : "Tap to Upload US Driver's License / Passport ID"}</strong>
                    <p>{idFileUploaded ? "Document stored in encrypted PMS vault" : "PNG, JPG, PDF supported"}</p>
                  </div>

                  <label className="sim-checkbox">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                    />
                    <span>I agree to Hotel Terms &amp; Conditions and Safety Policy.</span>
                  </label>

                  <button
                    type="button"
                    className="sim-btn"
                    disabled={!idFileUploaded || !acceptedTerms}
                    onClick={() => setStep(3)}
                  >
                    Proceed to Digital Signature ➔
                  </button>
                </div>
              )}

              {/* SIMULATOR STEP 3: INTERACTIVE HTML5 DIGITAL SIGNATURE PAD */}
              {step === 3 && (
                <div className="sim-step-box">
                  <h4>Step 3: Draw Digital Signature</h4>
                  <p className="sim-desc">Draw your signature inside the box using mouse or touch screen.</p>

                  <div className="canvas-wrapper">
                    <canvas
                      ref={canvasRef}
                      width={300}
                      height={140}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <button type="button" className="canvas-clear" onClick={clearSignature}>
                      🧹 Clear
                    </button>
                  </div>

                  {signatureData && (
                    <p className="sig-status">✅ Digital Signature Captured</p>
                  )}

                  <button
                    type="button"
                    className="sim-btn"
                    disabled={!signatureData}
                    onClick={() => {
                      setStep(4);
                      handleCompleteCheckIn(selectedBooking || bookings[0]);
                    }}
                  >
                    Complete Mobile Check-In 🚀
                  </button>
                </div>
              )}

              {/* SIMULATOR STEP 4: CHECK-IN COMPLETE CONFIRMATION */}
              {step === 4 && (
                <div className="sim-step-box text-center">
                  <div className="success-icon-badge">✅</div>
                  <h4>Check-In Complete!</h4>
                  <p className="sim-desc">Your registration &amp; digital signature have been verified.</p>

                  <div className="sim-confirm-card">
                    <span className="lbl">ROOM ASSIGNED</span>
                    <strong className="room-no">Room {selectedBooking?.room || "201"}</strong>
                    <span className="sub">Please collect your key card from Reception desk.</span>
                  </div>
                </div>
              )}
            </div>

            {/* PHONE HOME INDICATOR BAR */}
            <div className="phone-footer">
              <div className="home-bar" />
            </div>
          </div>
        </div>
      )}

      {/* EMAIL LINK SUBMODAL */}
      {showEmailModal && (
        <div className="mc-submodal-overlay">
          <div className="mc-submodal-card" onClick={(e) => e.stopPropagation()}>
            <h3>📧 Send Mobile Check-In via Email</h3>
            <p className="sub">Send instant digital signature registration link to guest email address</p>
            <form onSubmit={handleSendEmailSubmit}>
              <div className="mc-form-group">
                <label>Guest Email Recipient:</label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="guest@example.com"
                />
              </div>
              <div className="mc-submodal-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowEmailModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  🚀 Send Email Registration Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
