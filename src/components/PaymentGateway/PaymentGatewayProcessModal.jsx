import React, { useState } from "react";
import {
  getPaymentGatewayConfig,
  processTerminalCharge,
  processPreAuth,
  generatePaymentLink,
} from "../../services/paymentGatewayService";
import "./paymentGatewayProcessModal.css";

export default function PaymentGatewayProcessModal({
  isOpen,
  onClose,
  onSuccess,
  defaultAmount = 0,
  folioId = "FOLIO-1001",
  roomNo = "101",
  guestPhone = "",
  guestEmail = "",
}) {
  const config = getPaymentGatewayConfig();
  const [selectedGateway, setSelectedGateway] = useState(config.activePrimaryGateway || "stripe");
  const [amount, setAmount] = useState(defaultAmount || 100);
  const [txnType, setTxnType] = useState("charge"); // 'charge' | 'preauth' | 'paylink' | 'venmo_zelle'
  const [isProcessing, setIsProcessing] = useState(false);
  const [terminalStep, setTerminalStep] = useState("idle"); // 'idle' | 'pushing' | 'waiting_card' | 'approved'
  const [resultData, setResultData] = useState(null);

  if (!isOpen) return null;

  const activeGatewayConfig = config[selectedGateway] || {};
  const isSurchargeEnabled = config.enableCardSurcharge;
  const surchargeVal = isSurchargeEnabled ? (Number(amount) * (config.cardSurchargePercent / 100)) : 0;
  const totalChargeAmount = Number(amount) + surchargeVal;

  const handleExecuteTerminalCharge = () => {
    setIsProcessing(true);
    setTerminalStep("pushing");

    setTimeout(() => {
      setTerminalStep("waiting_card");
      setTimeout(() => {
        const res = txnType === "preauth"
          ? processPreAuth({ gateway: selectedGateway, amount: totalChargeAmount, folioId })
          : processTerminalCharge({ gateway: selectedGateway, amount: totalChargeAmount, folioId, roomNo });
        
        setIsProcessing(false);
        setTerminalStep("approved");
        setResultData(res);
      }, 1500);
    }, 1000);
  };

  const handleSendPaymentLink = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const linkRes = generatePaymentLink({
        amount: totalChargeAmount,
        guestPhone,
        guestEmail,
        folioId,
      });
      setIsProcessing(false);
      setTerminalStep("approved");
      setResultData(linkRes);
    }, 800);
  };

  const handleConfirmManualPayment = () => {
    if (onSuccess && resultData) {
      onSuccess({
        paymentMethod: selectedGateway.toUpperCase(),
        amount: totalChargeAmount,
        transactionId: resultData.transactionId || resultData.authId || resultData.linkId || `TXN-${Date.now()}`,
        gatewayDetails: resultData,
      });
    }
    onClose();
  };

  return (
    <div className="pg-modal-overlay">
      <div className="pg-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="pg-modal-head">
          <h3>💳 US Payment Gateway Terminal &amp; Instant Checkout</h3>
          <button type="button" className="pg-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="pg-modal-body">
          {terminalStep === "idle" && (
            <>
              {/* TRANSACTION TYPE SELECTOR */}
              <div className="pg-modal-section">
                <label className="pg-label">1. Select Action Type</label>
                <div className="pg-btn-group">
                  <button
                    type="button"
                    className={`pg-mode-btn ${txnType === "charge" ? "active" : ""}`}
                    onClick={() => setTxnType("charge")}
                  >
                    💳 Live Terminal Charge
                  </button>
                  <button
                    type="button"
                    className={`pg-mode-btn ${txnType === "preauth" ? "active" : ""}`}
                    onClick={() => setTxnType("preauth")}
                  >
                    🛡️ Pre-Auth Hold
                  </button>
                  <button
                    type="button"
                    className={`pg-mode-btn ${txnType === "paylink" ? "active" : ""}`}
                    onClick={() => setTxnType("paylink")}
                  >
                    📩 Send Pay Link (SMS/Email)
                  </button>
                  <button
                    type="button"
                    className={`pg-mode-btn ${txnType === "venmo_zelle" ? "active" : ""}`}
                    onClick={() => setTxnType("venmo_zelle")}
                  >
                    📲 Venmo / Zelle QR
                  </button>
                </div>
              </div>

              {/* GATEWAY SELECTION */}
              {txnType !== "venmo_zelle" ? (
                <div className="pg-modal-section">
                  <label className="pg-label">2. Select Payment Gateway / POS Terminal</label>
                  <div className="pg-gateway-grid">
                    {[
                      { key: "stripe", label: "⚡ Stripe Terminal", desc: "Smart Reader BBPOS / S700" },
                      { key: "fortis", label: "🏛️ Fortis Pay", desc: "Enterprise EMV Terminal" },
                      { key: "shift4", label: "⚡ Shift4 SkyTab", desc: "Hotel POS Terminal" },
                      { key: "paybotx", label: "🤖 PAYBOTX Auto", desc: "Virtual Auto-Bot Terminal" },
                    ]
                      .filter((gw) => Boolean(config[gw.key]?.enabled))
                      .map((gw) => (
                        <button
                          key={gw.key}
                          type="button"
                          className={`pg-gw-card ${selectedGateway === gw.key ? "selected" : ""}`}
                          onClick={() => setSelectedGateway(gw.key)}
                        >
                          <strong>{gw.label}</strong>
                          <span>{gw.desc}</span>
                        </button>
                      ))}
                    {![config.stripe?.enabled, config.fortis?.enabled, config.shift4?.enabled, config.paybotx?.enabled].some(Boolean) && (
                      <div style={{ color: "#64748b", fontSize: "12px", padding: "10px", gridColumn: "1 / -1" }}>
                        ⚠️ No credit card terminal gateways currently enabled in Settings.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pg-modal-section">
                  <label className="pg-label">2. Select Mobile App P2P</label>
                  <div className="pg-gateway-grid">
                    {config.venmo?.enabled && (
                      <button
                        type="button"
                        className={`pg-gw-card ${selectedGateway === "venmo" ? "selected" : ""}`}
                        onClick={() => setSelectedGateway("venmo")}
                      >
                        <strong>💙 Venmo Business QR</strong>
                        <span>Guest scans &amp; pays via Venmo</span>
                      </button>
                    )}
                    {config.zelle?.enabled && (
                      <button
                        type="button"
                        className={`pg-gw-card ${selectedGateway === "zelle" ? "selected" : ""}`}
                        onClick={() => setSelectedGateway("zelle")}
                      >
                        <strong>💜 Zelle Express</strong>
                        <span>Direct bank transfer reference</span>
                      </button>
                    )}
                    {!config.venmo?.enabled && !config.zelle?.enabled && (
                      <div style={{ color: "#64748b", fontSize: "12px", padding: "10px", gridColumn: "1 / -1" }}>
                        ⚠️ Neither Venmo nor Zelle are currently enabled in Settings.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AMOUNT INPUT & SURCHARGE SUMMARY */}
              <div className="pg-modal-section pg-amount-card">
                <div className="pg-grid-2">
                  <div>
                    <label className="pg-label">Payment Amount ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="pg-input"
                      style={{ fontSize: 18, fontWeight: 800 }}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="pg-label">Summary &amp; Surcharge Breakdown</label>
                    <div className="pg-summary-box">
                      <div>Base Amount: <strong>${Number(amount).toFixed(2)}</strong></div>
                      {isSurchargeEnabled && (
                        <div>Card Surcharge ({config.cardSurchargePercent}%): <strong>+${surchargeVal.toFixed(2)}</strong></div>
                      )}
                      <div className="pg-total-line">
                        Total Charge: <span>${totalChargeAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* VENMO / ZELLE DISPLAY PANEL */}
              {txnType === "venmo_zelle" && (
                <div className="pg-modal-section pg-qr-box">
                  {selectedGateway === "venmo" && (
                    <div style={{ textAlign: "center" }}>
                      <h4>💙 Venmo QR Code for Guest Scanning</h4>
                      <p>Guest opens Venmo app &amp; scans QR code or sends to <strong>{config.venmo.venmoHandle}</strong></p>
                      <img
                        src={config.venmo.qrCodeUrl}
                        alt="Venmo QR"
                        style={{ width: 160, height: 160, borderRadius: 12, border: "2px solid #cbd5e1", marginTop: 8 }}
                      />
                      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>
                        Amount to Pay: <span style={{ color: "#008CFF" }}>${totalChargeAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {selectedGateway === "zelle" && (
                    <div style={{ textAlign: "center" }}>
                      <h4>💜 Zelle Express Bank Transfer Details</h4>
                      <p>Instruct guest to send Zelle payment from their mobile banking app:</p>
                      <div className="pg-zelle-details">
                        <div>Business Name: <strong>{config.zelle.bankRefName}</strong></div>
                        <div>Zelle Phone: <strong>{config.zelle.registeredPhone}</strong></div>
                        <div>Zelle Email: <strong>{config.zelle.registeredEmail}</strong></div>
                        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800 }}>
                          Exact Amount: <span style={{ color: "#7414CA" }}>${totalChargeAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ACTION FOOTER */}
              <div className="pg-modal-actions">
                <button type="button" className="pg-btn-secondary" onClick={onClose}>Cancel</button>

                {txnType === "charge" && (
                  <button type="button" className="pg-btn-primary" onClick={handleExecuteTerminalCharge}>
                    🚀 Push ${totalChargeAmount.toFixed(2)} to {selectedGateway.toUpperCase()} Terminal
                  </button>
                )}

                {txnType === "preauth" && (
                  <button type="button" className="pg-btn-primary" onClick={handleExecuteTerminalCharge}>
                    🛡️ Hold ${totalChargeAmount.toFixed(2)} Pre-Auth Hold
                  </button>
                )}

                {txnType === "paylink" && (
                  <button type="button" className="pg-btn-primary" onClick={handleSendPaymentLink}>
                    📩 Send SMS/Email Payment Link
                  </button>
                )}

                {txnType === "venmo_zelle" && (
                  <button
                    type="button"
                    className="pg-btn-primary"
                    onClick={() => {
                      setResultData({
                        transactionId: `${selectedGateway.toUpperCase()}-P2P-${Date.now()}`,
                        status: "VERIFIED_MOBILE_RECEIPT",
                        amount: totalChargeAmount
                      });
                      setTerminalStep("approved");
                    }}
                  >
                    ✅ Confirm Received Payment
                  </button>
                )}
              </div>
            </>
          )}

          {/* STEP: PUSHING / WAITING */}
          {(terminalStep === "pushing" || terminalStep === "waiting_card") && (
            <div className="pg-processing-box">
              <div className="pg-spinner">⚡</div>
              {terminalStep === "pushing" && <h4>Sending payment command to {selectedGateway.toUpperCase()} Terminal...</h4>}
              {terminalStep === "waiting_card" && <h4>Waiting for guest to Insert, Swipe, or Tap Card on Terminal...</h4>}
              <p>Amount: <strong>${totalChargeAmount.toFixed(2)} USD</strong> (Folio #{folioId}, Room #{roomNo})</p>
            </div>
          )}

          {/* STEP: APPROVED RESULT */}
          {terminalStep === "approved" && resultData && (
            <div className="pg-approved-box">
              <div className="pg-approved-badge">✅ APPROVED</div>
              <h4>Payment Processed Successfully!</h4>

              <div className="pg-receipt-details">
                <div>Gateway: <strong>{resultData.gateway || selectedGateway.toUpperCase()}</strong></div>
                <div>Transaction ID: <strong>{resultData.transactionId || resultData.authId || resultData.linkId}</strong></div>
                <div>Amount Paid: <strong>${totalChargeAmount.toFixed(2)} USD</strong></div>
                {resultData.payUrl && (
                  <div style={{ marginTop: 8 }}>
                    Payment Link Sent: <a href={resultData.payUrl} target="_blank" rel="noreferrer">{resultData.payUrl}</a>
                  </div>
                )}
              </div>

              <div className="pg-modal-actions" style={{ marginTop: 20 }}>
                <button type="button" className="pg-btn-primary" onClick={handleConfirmManualPayment}>
                  📥 Post to Guest Folio &amp; Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
