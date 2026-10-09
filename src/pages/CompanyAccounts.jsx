import { useState, useEffect } from "react";
import AddCompanyModal from "../components/AddCompanyModal";
import {
  getCompanyAccounts,
  addCompanyAccount,
  updateCompanyAccount,
  deleteCompanyAccount,
  purgeAllCompanyAccounts,
  hasCompanyTransactions,
  parseBalanceNumber,
  settleCompanyAccountBalance,
} from "../services/companyAccounts";
import { CheckCircle2 } from "lucide-react";
import { isGatewayEnabled } from "../services/paymentGatewayService";
import { usePMS } from "../context/PMSContext";
import "./companyAccounts.css";

export default function CompanyAccounts() {
  const { confirmAction } = usePMS();
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [toast, setToast] = useState("");

  // Due Statement Email Modal State
  const [emailModalAccount, setEmailModalAccount] = useState(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Settle Balance Modal State
  const [settleModalAccount, setSettleModalAccount] = useState(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleMethod, setSettleMethod] = useState("Credit Card");
  const [settleReference, setSettleReference] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    refreshAccounts();
    window.addEventListener("pms_company_accounts_updated", refreshAccounts);
    window.addEventListener("pms_bookings_updated", refreshAccounts);
    window.addEventListener("storage", refreshAccounts);
    return () => {
      window.removeEventListener("pms_company_accounts_updated", refreshAccounts);
      window.removeEventListener("pms_bookings_updated", refreshAccounts);
      window.removeEventListener("storage", refreshAccounts);
    };
  }, []);

  function refreshAccounts() {
    setAccounts(getCompanyAccounts());
  }

  function triggerToast(msg) {
    setToast(msg);
    setTimeout(() => {
      setToast("");
    }, 4000);
  }

  function handleSaveAccount(accountData) {
    if (editingAccount) {
      updateCompanyAccount(editingAccount.id, {
        name: accountData.name,
        accountNo: accountData.accountNo,
        gstin: accountData.gstin,
        contact: accountData.contact,
        email: accountData.email,
      });
      triggerToast(`Updated corporate account for ${accountData.name}`);
    } else {
      addCompanyAccount(accountData);
      triggerToast(`Registered new corporate account for ${accountData.name}`);
    }
    refreshAccounts();
    setShowAddModal(false);
    setEditingAccount(null);
  }

  function handleDeleteAccount(account) {
    const rawBalStr = String(account?.balance || "").trim();
    const numBal = parseBalanceNumber(account?.balance);
    const isBalanceNonZero =
      numBal > 0.0001 || (rawBalStr !== "" && rawBalStr !== "0" && rawBalStr !== "$0" && rawBalStr !== "$0.00");
    const isProtected =
      isBalanceNonZero || hasCompanyTransactions(account) || (account?.linkedBookingCount || 0) > 0;

    if (isProtected) {
      alert(
        `Cannot delete Corporate Account "${account?.name}" (${account?.accountNo}) because it has associated transactions or an outstanding balance ($${numBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}). Please delete or clear all associated transactions first.`
      );
      return;
    }

    confirmAction({
      title: "Delete Corporate Account",
      message: `Are you sure you want to delete Corporate Account '${account.name}'?`,
      details: [
        { label: "Account Name", value: account.name },
        { label: "Account No", value: account.accountNo || 'N/A' },
        { label: "Contact Person", value: account.contactPerson || 'N/A' }
      ],
      confirmText: "Yes, Delete Account",
      variant: "danger",
      executionTitle: "Corporate Account Deleted",
      executionMessage: `Corporate Account '${account.name}' (${account.accountNo}) has been deleted.`,
      onConfirm: () => {
        try {
          deleteCompanyAccount(account.id);
          refreshAccounts();
          triggerToast(`Deleted ${account.name}`);
        } catch (err) {
          alert(err.message);
        }
      }
    });
  }

  function handlePurgeAll() {
    confirmAction({
      title: "Clear All Corporate Accounts",
      message: "Are you sure you want to clear ALL corporate accounts? This action cannot be undone.",
      confirmText: "Yes, Clear All Accounts",
      variant: "danger",
      executionTitle: "Accounts Cleared",
      executionMessage: "All corporate accounts have been purged from the system.",
      onConfirm: () => {
        try {
          purgeAllCompanyAccounts();
          refreshAccounts();
          triggerToast("Cleared all corporate accounts.");
        } catch (err) {
          alert(err.message);
        }
      }
    });
  }

  function handleOpenSettleModal(account) {
    const numBal = parseBalanceNumber(account.balance);
    setSettleModalAccount(account);
    setSettleAmount(numBal > 0 ? String(numBal.toFixed(2)) : "0.00");
    setSettleMethod("Credit Card");
    setSettleReference("");
    setSettleNotes("");
  }

  function handleConfirmSettlement() {
    const amt = parseBalanceNumber(settleAmount);
    if (!settleModalAccount || amt <= 0) {
      alert("Please enter a valid settlement amount greater than $0.00.");
      return;
    }

    try {
      setSettling(true);
      settleCompanyAccountBalance(settleModalAccount.id, amt, {
        method: settleMethod,
        reference: settleReference,
        notes: settleNotes,
        settledBy: "System Administrator"
      });
      triggerToast(`Recorded $${amt.toFixed(2)} settlement payment for ${settleModalAccount.name}!`);
      refreshAccounts();
      setSettleModalAccount(null);
    } catch (err) {
      alert("Failed to record settlement: " + err.message);
    } finally {
      setSettling(false);
    }
  }

  function handleOpenEmailModal(account) {
    setEmailModalAccount(account);
    setRecipientEmail(account.email || (account.contact ? `${account.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@company.com` : "billing@company.com"));
    setEmailSubject(`Statement of Account & Outstanding Balance Due (${account.accountNo}) - ${account.name}`);
  }

  function handleSendDueEmail() {
    if (!recipientEmail) return;
    setSendingEmail(true);
    setTimeout(() => {
      setSendingEmail(false);
      triggerToast(`Due balance statement email successfully sent to ${recipientEmail}`);
      setEmailModalAccount(null);
    }, 500);
  }

  const filteredAccounts = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.accountNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="company-accounts-page" style={{ paddingTop: 16 }}>
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

      {/* SEARCH BAR & ADD BUTTON ROW */}
      <div className="ca-filter-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="🔍 Search company name, account #, GSTIN, or contact..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="ca-search-input"
          style={{ flex: 1 }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {accounts.length > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handlePurgeAll}
              style={{ color: "#ef4444", borderColor: "#fca5a5", height: 38 }}
            >
              🗑️ Clear All
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setEditingAccount(null);
              setShowAddModal(true);
            }}
            style={{ background: "#f1f5f9", color: "#0f172a", border: "1.5px solid #cbd5e1", fontWeight: 700, height: 38 }}
          >
            + Add Corporate Account
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="ca-table-card">
        <table className="ca-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>City Ledger #</th>
              <th>GSTIN / Tax ID</th>
              <th>Authorized Contact</th>
              <th>Current Outstanding Balance ($)</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
                  <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 15, marginBottom: 4 }}>
                    No Corporate Accounts Registered Yet
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    Click <strong>"+ Register New Company Account"</strong> above to add your first corporate client.
                  </div>
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account) => {
                const rawBalStr = String(account?.balance || "").trim();
                const numBal = parseBalanceNumber(account?.balance);
                const isBalanceNonZero =
                  numBal > 0.0001 || (rawBalStr !== "" && rawBalStr !== "0" && rawBalStr !== "$0" && rawBalStr !== "$0.00");
                const isProtected =
                  isBalanceNonZero || hasCompanyTransactions(account) || (account?.linkedBookingCount || 0) > 0;

                return (
                  <tr key={account.id}>
                    <td>
                      <strong style={{ color: "#0f172a", fontSize: 14 }}>{account.name}</strong>
                      {account.email && (
                        <div style={{ fontSize: 11, color: "#64748b" }}>✉️ {account.email}</div>
                      )}
                    </td>
                    <td>
                      <span className="ca-badge">{account.accountNo}</span>
                    </td>
                    <td>
                      <code>{account.gstin || "N/A"}</code>
                    </td>
                    <td>{account.contact || "—"}</td>
                    <td>
                      <span className={numBal > 0 ? "balance-due" : "balance-clean"}>
                        ${numBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        {numBal > 0 && (
                          <>
                            <button
                              type="button"
                              className="btn btn-xs"
                              title="Settle Outstanding Corporate Balance"
                              onClick={() => handleOpenSettleModal(account)}
                              style={{
                                background: "#dcfce7",
                                color: "#166534",
                                border: "1.5px solid #bbf7d0",
                                fontWeight: 800,
                                borderRadius: 6,
                                padding: "4px 10px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4
                              }}
                            >
                              💳 Settle Balance
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary-outline btn-xs"
                              title="Send Email Statement of Due Balance"
                              onClick={() => handleOpenEmailModal(account)}
                            >
                              📧 Send Email Due
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => {
                            setEditingAccount(account);
                            setShowAddModal(true);
                          }}
                        >
                          ✏️ Edit
                        </button>
                        {!isProtected && (
                          <button
                            type="button"
                            className="btn btn-danger-outline btn-xs"
                            onClick={() => handleDeleteAccount(account)}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ADD / EDIT COMPANY MODAL */}
      <AddCompanyModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingAccount(null);
        }}
        initialData={editingAccount}
        onCompanyCreated={handleSaveAccount}
      />

      {/* EMAIL DUE STATEMENT MODAL */}
      {emailModalAccount && (
        <div className="fm-submodal-overlay" style={{ zIndex: 99999 }}>
          <div className="block-edit-card" style={{ width: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="block-edit-header">
              <div className="block-header-title">
                <span className="icon">📧</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
                    Send City Ledger Due Balance Email
                  </h3>
                  <p className="sub" style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                    Send itemized outstanding statement to <strong>{emailModalAccount.name}</strong>
                  </p>
                </div>
              </div>
              <button type="button" className="block-close-btn" onClick={() => setEmailModalAccount(null)}>✕</button>
            </div>

            <div className="block-edit-form" style={{ gap: 12 }}>
              <div className="block-form-group">
                <label>Recipient Email Address *</label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>

              <div className="block-form-group">
                <label>Email Subject *</label>
                <input
                  type="text"
                  required
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>

              {/* STATEMENT PREVIEW BOX */}
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6, fontSize: 13, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
                  📄 Statement Preview
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#64748b" }}>Company:</span>
                  <strong>{emailModalAccount.name} ({emailModalAccount.accountNo})</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#64748b" }}>Contact:</span>
                  <span>{emailModalAccount.contact || "Authorized Accounts Desk"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#64748b" }}>Statement Date:</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: "1.5px solid #cbd5e1", fontSize: 14 }}>
                  <strong style={{ color: "#ef4444" }}>Total Due Balance:</strong>
                  <strong style={{ color: "#ef4444" }}>${Number(emailModalAccount.balance).toLocaleString()}</strong>
                </div>
                <p style={{ marginTop: 8, fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
                  Includes itemized list of corporate guest stays, room charges, taxes, and payment wiring details.
                </p>
              </div>

              <div className="block-edit-actions" style={{ marginTop: 8 }}>
                <button type="button" className="btn-cancel-soft" onClick={() => setEmailModalAccount(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-save-primary"
                  disabled={sendingEmail}
                  onClick={handleSendDueEmail}
                >
                  {sendingEmail ? "Sending..." : "📤 Send Due Balance Email"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTLE CORPORATE BALANCE MODAL */}
      {settleModalAccount && (
        <div className="fm-submodal-overlay" style={{ zIndex: 1100 }}>
          <div className="block-edit-card" style={{ maxWidth: 540, width: "90%", padding: 24 }}>
            <div className="block-edit-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a", fontWeight: 800 }}>
                  💳 Settle Corporate Account Balance
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Record payment settlement & clear outstanding balance for direct-bill corporate clients
                </span>
              </div>
              <button
                type="button"
                className="btn-close-submodal"
                onClick={() => setSettleModalAccount(null)}
                style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div className="block-edit-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* COMPANY DETAILS SUMMARY HEADER */}
              <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 15 }}>
                    {settleModalAccount.name}
                  </span>
                  <span className="ca-badge" style={{ background: "#e2e8f0", color: "#334155", fontWeight: 700 }}>
                    {settleModalAccount.accountNo}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  <span>Contact / Desk: <strong>{settleModalAccount.contact || "N/A"}</strong></span>
                  <span>GSTIN / Tax ID: <code>{settleModalAccount.gstin || "N/A"}</code></span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px dashed #cbd5e1", fontSize: 14 }}>
                  <span style={{ fontWeight: 700, color: "#475569" }}>Current Outstanding Balance:</span>
                  <span style={{ fontWeight: 800, color: "#ef4444", fontSize: 16 }}>
                    ${parseBalanceNumber(settleModalAccount.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* SETTLEMENT INPUT FIELDS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Settlement Amount ($) <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="fm-input"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1.5px solid #cbd5e1", fontSize: 14, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Payment Method <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    className="fm-select"
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 600 }}
                  >
                    <option value="Credit Card">💳 Credit Card</option>
                    <option value="Cash">💵 Cash</option>
                    <option value="Bank Wire / ACH">🏦 Bank Wire / ACH</option>
                    {isGatewayEnabled("zelle") && <option value="Zelle">⚡ Zelle</option>}
                    {isGatewayEnabled("venmo") && <option value="Venmo">📱 Venmo</option>}
                    <option value="Company Check">📜 Company Check</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Reference / Check # / Auth Code (Optional)
                </label>
                <input
                  type="text"
                  className="fm-input"
                  value={settleReference}
                  onChange={(e) => setSettleReference(e.target.value)}
                  placeholder="e.g. CHK-99201, Wire Ref #88219"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1.5px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Internal Notes / Remark (Optional)
                </label>
                <textarea
                  className="fm-textarea"
                  rows={2}
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Settled via monthly corporate statement clearance..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1.5px solid #cbd5e1", fontSize: 13, resize: "vertical" }}
                />
              </div>

              {/* ACTION BUTTONS */}
              <div className="block-edit-actions" style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn-cancel-soft"
                  onClick={() => setSettleModalAccount(null)}
                  style={{ padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-save-primary"
                  disabled={settling || !settleAmount || parseFloat(settleAmount) <= 0}
                  onClick={handleConfirmSettlement}
                  style={{
                    background: "#16a34a",
                    borderColor: "#15803d",
                    color: "#fff",
                    fontWeight: 800,
                    padding: "8px 20px",
                    borderRadius: 6,
                    cursor: "pointer"
                  }}
                >
                  {settling ? "Recording..." : "✓ Confirm Settlement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
