import { dataStore } from "../services/dataStore";
import { Navigate, Outlet } from "react-router-dom";

// Only a logged-in hotel session (backend token + user) may open the PMS screens.
export default function ProtectedRoute() {
  let isAuth = false;
  try {
    const auth = dataStore.getItem("pms_authenticated") === "true";
    const token = Boolean(dataStore.getItem("pms_token"));
    const tenantId = dataStore.getItem("pms_tenant_id");
    isAuth = auth && token && Boolean(tenantId) && tenantId !== "default";
  } catch (e) {
    isAuth = false;
  }

  if (!isAuth) return <Navigate to="/login" replace />;
  return <Outlet />;
}
