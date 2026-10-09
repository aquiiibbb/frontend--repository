import React, { useState } from "react";
import { getHotelProfile } from "../services/hotelConfig";
import "./SendSelfCheckInModal.css";

export default function SendSelfCheckInModal({ isOpen, booking, onClose }) {
  const [activeChannel, setActiveChannel] = useState("whatsapp"); // "whatsapp" | "sms" | "email" | "copy"
  const [phoneInput, setPhoneInput] = useState(booking?.phone || "");
  const [emailInput, setEmailInput] = useState(booking?.email || "");
  const [toastMsg, setToastMsg] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isOpen || !booking) return null;

  const hotel = getHotelProfile() || { name: "Pea Soup Andersen's", city: "Solvang" };
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const checkInUrl = `${origin}/guest-checkin/${booking.id || ""}`;

  const defaultMsg = `Hello ${booking.guest || "Guest"}! Welcome to ${hotel.name || "Pea Soup Andersen's"}! Please complete your contactless mobile self check-in before your arrival here: ${checkInUrl}`;

  const cleanPhone = (phoneInput || booking.phone || "").replace(/[^0-9+]/g, "");

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // 1. WhatsApp Action
  const handleOpenWhatsApp = () => {
    if (!cleanPhone) {
      showToast("⚠️ Please enter a valid guest phone number.");
      return;
    }
    const waUrl = `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(defaultMsg)}`;
    window.open(waUrl, "_blank");
    showToast(`🟢 WhatsApp chat opened for ${booking.guest}!`);
  };

  // 2. SMS Action
  const handleSendSMS = () => {
    if (!cleanPhone) {
      showToast("⚠️ Please enter a valid guest phone number.");
      return;
    }
    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(defaultMsg)}`;
    window.open(smsUrl, "_self");
    showToast(`📱 SMS Check-In link dispatched to ${cleanPhone}!`);
  };

  // 3. Email Action
  const handleSendEmail = (e) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      showToast("⚠️ Please enter a valid recipient email address.");
      return;
    }
    const subject = `Contactless Mobile Check-In — ${hotel.name || "Pea Soup Andersen's"} (Ref: ${booking.id || ""})`;
    const mailtoUrl = `mailto:${encodeURIComponent(emailInput.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(defaultMsg)}`;
    window.open(mailtoUrl, "_blank");
    showToast(`📧 Email composer launched for ${emailInput}!`);
    setTimeout(() => onClose?.(), 1500);
  };

  // 4. Copy Link Action
  const handleCopyLink = () => {
    navigator.clipboard.writeText(checkInUrl);
    setCopied(true);
    showToast("✓ Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="sci-backdrop">
      <div className="sci-modal" onClick={(e) => e.stopPropagation()}>
        {toastMsg && <div className="sci-toast">{toastMsg}</div>}

        {/* MODAL HEADER */}
        <div className="sci-header">
          <div>
            <h3 className="sci-title">📱 Send Mobile Self Check-In Link</h3>
            <p className="sci-sub">
              Dispatch pre-arrival registration link to <strong>{booking.guest}</strong>
            </p>
          </div>
          <button type="button" className="sci-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* SUMMARY CARD */}
        <div className="sci-summary-card">
          <div className="sci-summary-row">
            <div>
              <span className="sci-label">Guest Name</span>
              <strong className="sci-val">{booking.guest || "Guest"}</strong>
            </div>
            <div>
              <span className="sci-label">Reservation Ref</span>
              <strong className="sci-val">{booking.id}</strong>
            </div>
            <div>
              <span className="sci-label">Assigned Room</span>
              <strong className="sci-val">Room {booking.room || "Unassigned"} ({booking.roomType || "Standard"})</strong>
            </div>
            <div>
              <span className="sci-label">Check-In Date</span>
              <strong className="sci-val">{booking.checkIn}</strong>
            </div>
          </div>
        </div>

        {/* CHANNEL TAB NAVIGATION */}
        <div className="sci-channel-tabs">
          <button
            type="button"
            className={`sci-tab ${activeTabChannel("whatsapp")}`}
            onClick={() => setActiveChannel("whatsapp")}
          >
            💬 WhatsApp
          </button>
          <button
            type="button"
            className={`sci-tab ${activeTabChannel("sms")}`}
            onClick={() => setActiveChannel("sms")}
          >
            📱 SMS Text
          </button>
          <button
            type="button"
            className={`sci-tab ${activeTabChannel("email")}`}
            onClick={() => setActiveChannel("email")}
          >
            📧 Email
          </button>
          <button
            type="button"
            className={`sci-tab ${activeTabChannel("copy")}`}
            onClick={() => setActiveChannel("copy")}
          >
            🔗 Copy Link
          </button>
        </div>

        {/* CHANNEL CONTENT BODY */}
        <div className="sci-body">
          {/* 1. WHATSAPP */}
          {activeChannel === "whatsapp" && (
            <div className="sci-panel">
              <label className="sci-field-label">Guest Phone Number (WhatsApp Enabled)</label>
              <input
                type="tel"
                className="sci-input"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />

              <label className="sci-field-label" style={{ marginTop: 12 }}>Pre-formatted WhatsApp Message</label>
              <textarea className="sci-textarea" value={defaultMsg} readOnly />

              <a
                href={cleanPhone ? `https://wa.me/${cleanPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(defaultMsg)}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="sci-btn sci-btn-whatsapp"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={(e) => {
                  if (!cleanPhone) {
                    e.preventDefault();
                    showToast("⚠️ Please enter a valid guest phone number.");
                  } else {
                    showToast(`🟢 WhatsApp chat opened for ${booking.guest || "Guest"}!`);
                  }
                }}
              >
                💬 Send via WhatsApp Web / App ➔
              </a>
            </div>
          )}

          {/* 2. SMS TEXT */}
          {activeChannel === "sms" && (
            <div className="sci-panel">
              <label className="sci-field-label">Guest Mobile Number</label>
              <input
                type="tel"
                className="sci-input"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />

              <label className="sci-field-label" style={{ marginTop: 12 }}>SMS Body</label>
              <textarea className="sci-textarea" value={defaultMsg} readOnly />

              <a
                href={cleanPhone ? `sms:${cleanPhone}?body=${encodeURIComponent(defaultMsg)}` : "#"}
                className="sci-btn sci-btn-sms"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={(e) => {
                  if (!cleanPhone) {
                    e.preventDefault();
                    showToast("⚠️ Please enter a valid guest phone number.");
                  } else {
                    showToast(`📱 SMS launcher opened for ${cleanPhone}!`);
                  }
                }}
              >
                📱 Dispatch Direct SMS Text ➔
              </a>
            </div>
          )}

          {/* 3. EMAIL */}
          {activeChannel === "email" && (
            <div className="sci-panel">
              <label className="sci-field-label">Guest Email Address</label>
              <input
                type="email"
                className="sci-input"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="guest@example.com"
                required
              />

              <label className="sci-field-label" style={{ marginTop: 12 }}>Email Subject</label>
              <input
                type="text"
                className="sci-input"
                value={`Contactless Mobile Check-In — ${hotel.name} (Ref: ${booking.id})`}
                readOnly
              />

              <label className="sci-field-label" style={{ marginTop: 12 }}>Message Preview</label>
              <textarea className="sci-textarea" value={defaultMsg} readOnly />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                <a
                  href={emailInput.trim() ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailInput.trim())}&su=${encodeURIComponent(`Contactless Mobile Check-In — ${hotel.name} (Ref: ${booking.id})`)}&body=${encodeURIComponent(defaultMsg)}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sci-btn sci-btn-email"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ea4335' }}
                  onClick={(e) => {
                    if (!emailInput.trim()) {
                      e.preventDefault();
                      showToast("⚠️ Please enter a valid recipient email address.");
                    } else {
                      showToast(`🌐 Gmail Web composer launched for ${emailInput}!`);
                      setTimeout(() => onClose?.(), 1500);
                    }
                  }}
                >
                  🌐 Open Gmail Web Composer ➔
                </a>

                <a
                  href={emailInput.trim() ? `mailto:${encodeURIComponent(emailInput.trim())}?subject=${encodeURIComponent(`Contactless Mobile Check-In — ${hotel.name} (Ref: ${booking.id})`)}&body=${encodeURIComponent(defaultMsg)}` : "#"}
                  className="sci-btn"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#475569', color: '#ffffff' }}
                  onClick={(e) => {
                    if (!emailInput.trim()) {
                      e.preventDefault();
                      showToast("⚠️ Please enter a valid recipient email address.");
                    } else {
                      showToast(`✉️ Desktop Mail App launched for ${emailInput}!`);
                      setTimeout(() => onClose?.(), 1500);
                    }
                  }}
                >
                  ✉️ Open Desktop Mail App (Outlook/Apple Mail) ➔
                </a>
              </div>
            </div>
          )}

          {/* 4. COPY LINK */}
          {activeChannel === "copy" && (
            <div className="sci-panel">
              <label className="sci-field-label">Public Guest Self Check-In URL</label>
              <div className="sci-copy-row">
                <input type="text" className="sci-input" value={checkInUrl} readOnly />
                <button type="button" className="sci-btn-copy" onClick={handleCopyLink}>
                  {copied ? "✓ Copied" : "📋 Copy"}
                </button>
              </div>
              <p className="sci-copy-hint">
                You can copy this link and share it directly via any messaging system, email client, or PMS integration.
              </p>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="sci-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  function activeTabChannel(ch) {
    return activeChannel === ch ? "active" : "";
  }
}
