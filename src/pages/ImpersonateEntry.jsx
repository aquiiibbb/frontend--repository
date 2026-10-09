import { useEffect, useState } from "react";
import { startImpersonation } from "../services/backendSync";

// Landing page for the separate Super Admin app ("Open Hotel"). The one-time login is passed in the URL #hash
// (never sent to a server). It is read, removed from the address bar, and the hotel opens as its admin.
export default function ImpersonateEntry() {
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const raw = window.location.hash.replace(/^#/, "");
        const payload = JSON.parse(decodeURIComponent(escape(atob(raw))));
        if (!payload?.token || !payload?.tenantId) throw new Error("Invalid link");
        window.history.replaceState(null, "", "/impersonate");
        await startImpersonation(payload);
        window.location.replace("/");
      } catch (e) {
        setError("This link is not valid or has expired. Open the hotel again from the Super Admin panel.");
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif", color: "#0f172a" }}>
      {error ? <div style={{ maxWidth: 420, textAlign: "center", fontWeight: 600 }}>{error}</div> : <div style={{ fontWeight: 700 }}>Opening hotel…</div>}
    </div>
  );
}
