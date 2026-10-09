import { useState, useEffect } from "react";
import { generateNextSequence } from "../services/hotelConfig";

export default function AddCompanyModal({ isOpen, onClose, initialData = null, onCompanyCreated }) {
  const [formData, setFormData] = useState({
    name: "",
    accountNo: generateNextSequence("cityLedger", false),
    gstin: "",
    contact: "",
    email: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        accountNo: initialData.accountNo || "",
        gstin: initialData.gstin || "",
        contact: initialData.contact || "",
        email: initialData.email || "",
      });
    } else if (isOpen) {
      setFormData({
        name: "",
        accountNo: generateNextSequence("cityLedger", false),
        gstin: "",
        contact: "",
        email: "",
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onCompanyCreated?.(formData);
    onClose();
  }

  return (
    <div className="fm-submodal-overlay" style={{ zIndex: 99999 }}>
      <div className="block-edit-card" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="block-edit-header">
          <div className="block-header-title">
            <span className="icon">🏢</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
                {initialData ? "Edit Corporate Account" : "Register Corporate Account"}
              </h3>
              <p className="sub" style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                City Ledger Direct Billing Account
              </p>
            </div>
          </div>
          <button type="button" className="block-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="block-edit-form" style={{ gap: 12 }}>
          <div className="block-form-group">
            <label>Company Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Tata Consultancy Services"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="block-form-group">
            <label>City Ledger Account No. *</label>
            <input
              type="text"
              required
              placeholder="e.g. CL-1002"
              value={formData.accountNo}
              onChange={(e) => setFormData({ ...formData, accountNo: e.target.value })}
            />
          </div>

          <div className="block-form-group">
            <label>GSTIN / Tax ID</label>
            <input
              type="text"
              placeholder="e.g. 27AAACT2708Q1ZP"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
            />
          </div>

          <div className="block-form-group">
            <label>Billing Email Address</label>
            <input
              type="email"
              placeholder="e.g. billing@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="block-form-group">
            <label>Authorized Contact Person &amp; Phone</label>
            <input
              type="text"
              placeholder="e.g. Robert Johnson (+1 310 555-0199)"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
            />
          </div>

          <div className="block-edit-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn-cancel-soft" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-save-primary">
              💾 Save Corporate Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
