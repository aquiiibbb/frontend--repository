import { useState } from "react";
import "./quickActionModal.css";

function initFieldValues(fields = [], booking) {
  const values = {};
  fields.forEach((f) => {
    if (f.type === "checkbox" || f.type === "checkbox-readonly") {
      values[f.name] = f.fromBooking ? Boolean(booking?.[f.fromBooking]) : false;
    } else if (f.fromBooking) {
      values[f.name] = booking?.[f.fromBooking] ?? "";
    } else {
      values[f.name] = "";
    }
  });
  return values;
}

/**
 * Small popup form for a single reservation action (Modify Check In, Move
 * Room, Delete, Edit Contact Info, ...). Config comes from quickActionConfig.
 * Every submit calls onSubmit(values) which Calendar.jsx wires to the real
 * booking API — so it always reflects on the Calendar grid + Master Data.
 */
export default function QuickActionModal({ actionId, config, booking, rooms = [], ctx, onClose, onSubmit }) {
  const [values, setValues] = useState(() => initFieldValues(config?.fields, booking));
  const [busy, setBusy] = useState(false);

  if (!config || !booking) return null;

  function setField(name, val) {
    setValues((prev) => ({ ...prev, [name]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(values);
    } finally {
      setBusy(false);
    }
  }

  const title = `${config.label} - ${booking.guest}`;

  return (
    <div className="qam-overlay">
      <div className="qam-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="qam-head">
          <h3>{title}</h3>
          <button type="button" className="qam-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="qam-body">
            {config.infoLine && <p className="qam-infoline">{config.infoLine(booking)}</p>}

            {config.confirmOnly && (
              <p className={`qam-confirm-text ${config.dangerous ? "qam-danger-text" : ""}`}>
                {config.confirmText?.(booking, ctx)}
              </p>
            )}

            {!config.confirmOnly && (config.fields || []).map((field) => (
              <label className="qam-field" key={field.name}>
                <span className="qam-label">{field.label}</span>
                {field.type === "textarea" && (
                  <textarea
                    rows={3}
                    value={values[field.name]}
                    onChange={(e) => setField(field.name, e.target.value)}
                  />
                )}
                {field.type === "select" && (
                  <select value={values[field.name]} onChange={(e) => setField(field.name, e.target.value)}>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
                {field.type === "room-select" && (
                  <select value={values[field.name]} onChange={(e) => setField(field.name, e.target.value)}>
                    <option value="">Select room…</option>
                    {rooms
                      .filter((r) => r.no !== booking.room)
                      .map((r) => (
                        <option key={r.no} value={r.no}>{r.no} · {r.type}</option>
                      ))}
                  </select>
                )}
                {(field.type === "checkbox" || field.type === "checkbox-readonly") && (
                  <input
                    type="checkbox"
                    checked={Boolean(values[field.name])}
                    disabled={field.type === "checkbox-readonly"}
                    onChange={(e) => setField(field.name, e.target.checked)}
                  />
                )}
                {["text", "email", "number", "date", "time"].includes(field.type) && (
                  <input
                    type={field.type}
                    value={values[field.name]}
                    min={field.min}
                    max={field.max}
                    onChange={(e) => setField(field.name, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="qam-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className={`btn btn-sm ${config.dangerous ? "btn-danger-outline" : "btn-gold"}`}
              disabled={busy}
            >
              {busy ? "Saving…" : config.submitLabel || "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
