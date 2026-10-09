import { dataStore } from "../services/dataStore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUsers, getUserRights, ALL_YES_RIGHTS, logSystemAuditAction } from "../services/hotelConfig";
import { loginToBackend, startSessionAfterLogin, logoutFromBackend } from "../services/backendSync";
import "./login.css";

export default function Login() {
  const navigate = useNavigate();
  const [hotelId, setHotelId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const rawHotel = hotelId.trim();
    const rawInput = email.trim().toLowerCase();
    const cleanInput = rawInput.replace(/\s+/g, "");
    const inputPass = password.trim();

    try {
      // 1. Backend checks Hotel ID + username + password (POST /api/session/login)
      const data = await loginToBackend(rawInput, inputPass, rawHotel);
      if (!data?.success || !data?.token) {
        throw new Error(data?.message || "Invalid username or password.");
      }

      // 2. Load this hotel's data from the backend (GET /api/store)
      await startSessionAfterLogin({ token: data.token, tenantId: data.tenantId });
      dataStore.setItem("pms_hotel_id", rawHotel || data.tenantId || "");

      // 3. Work out the staff member's rights from the hotel's user list
      const allUsers = getUsers();
      const serverUser = data.user || {};
      const matched = (allUsers || []).find((u) => {
        if (!u) return false;
        const uName = (u.username || "").trim().toLowerCase();
        const uEmail = (u.email || "").trim().toLowerCase();
        const uFullName = (u.name || "").trim().toLowerCase();
        return (
          uName === rawInput ||
          uEmail === rawInput ||
          uName.replace(/\s+/g, "") === cleanInput ||
          uFullName === rawInput ||
          (serverUser.username && uName === String(serverUser.username).trim().toLowerCase()) ||
          (rawInput.includes("@") && uEmail.startsWith(rawInput.split("@")[0]))
        );
      });

      if (matched && matched.status === "Suspended") {
        await logoutFromBackend();
        setLoading(false);
        setError("Account is suspended. Please contact your system administrator.");
        return;
      }

      const userRights = matched ? getUserRights(matched) : { ...ALL_YES_RIGHTS };
      const displayName = (matched && matched.name) || serverUser.name || serverUser.username || rawInput.toUpperCase();
      const userObj = {
        id: (matched && matched.id) || serverUser.id || serverUser.username || rawInput,
        name: displayName,
        role: (matched && matched.role) || serverUser.role || "Front Desk Staff",
        email: (matched && matched.email) || serverUser.email || (rawInput.includes("@") ? rawInput : `${rawInput}@hotelpms.com`),
        username: (matched && matched.username) || serverUser.username || rawInput,
        initials: String(displayName).slice(0, 2).toUpperCase(),
        rights: userRights,
      };

      dataStore.setItem("pms_authenticated", "true");
      dataStore.setItem("pms_user", JSON.stringify(userObj));
      logSystemAuditAction({
        module: "Security & Auth",
        action: "User Login",
        details: `User '${userObj.username}' (${userObj.role}) logged in successfully from Workstation.`,
        user: userObj.name,
        role: userObj.role,
      });
      setLoading(false);

      let dest = "/dashboard";
      if (userRights.frontDesk) dest = "/front-desk/calendar";
      else if (userRights.housekeeping) dest = "/housekeeping";
      else if (userRights.reportsAudit) dest = "/master-report";
      else if (userRights.folioPayments) dest = "/front-desk/company-accounts";
      else if (userRights.hotelSettings || userRights.manageUsers) dest = "/configuration";

      navigate(dest, { replace: true });
    } catch (err) {
      setLoading(false);
      const unreachable = !err?.status && /failed to fetch|networkerror|load failed/i.test(String(err?.message || ""));
      setError(unreachable ? "Cannot reach the server. Please check your connection and try again." : err?.message || "Login failed. Please try again.");
    }
  };

  return (
    <div className="login-page">
      {/* ANIMATED BACKGROUND AMBIENT ORBS */}
      <div className="ambient-orb orb-1"></div>
      <div className="ambient-orb orb-2"></div>
      <div className="ambient-orb orb-3"></div>

      <div className="login-card">
        <div className="login-card-inner">
          {/* LOGO HEADER VIDEO */}
          <div className="login-logo-header">
            <video
              autoPlay
              loop
              muted
              playsInline
              src="/logo-header.mp4"
              className="login-header-video"
            />
          </div>

          {/* LOGIN FORM */}
          <form onSubmit={handleLoginSubmit} className="login-form">
            {error && <div className="login-error-alert">{error}</div>}

            {/* HOTEL ID FIELD */}
            <div className="login-field-box">
              <span className="field-icon">🏨</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value.replace(/\D/g, ""))}
                placeholder="Hotel ID (Numeric)"
                autoFocus
              />
            </div>

            {/* USERNAME FIELD */}
            <div className="login-field-box">
              <span className="field-icon">👤</span>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Username"
              />
            </div>

            {/* PASSWORD FIELD */}
            <div className="login-field-box">
              <span className="field-icon">🔒</span>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
              <button
                type="button"
                className="pw-toggle-btn"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "🙈"}
              </button>
            </div>

            {/* REMEMBER ME CHECKBOX */}
            <label className="remember-me-container">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="custom-checkmark">
                <svg viewBox="0 0 12 10" fill="none">
                  <path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="remember-text">Remember me</span>
            </label>

            {/* LOGIN SUBMIT BUTTON */}
            <div className="login-btn-wrapper">
              <button type="submit" disabled={loading} className="login-pill-btn">
                <span className="btn-text">{loading ? "Logging in..." : "Login"}</span>
                <span className="btn-shine"></span>
              </button>
            </div>
          </form>
        </div>

        {/* CARD FOOTER BANNER */}
        <div className="login-card-footer">
          <a href="#forgot-password" onClick={(e) => { e.preventDefault(); alert("Password Reset: Please contact your Hotel Administrator or IT Manager to reset your password."); }}>
            Forgot Password?
          </a>
        </div>
      </div>
    </div>
  );
}
