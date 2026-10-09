import { dataStore } from "../services/dataStore";
import { Navigate, Outlet } from "react-router-dom";

// Only a logged-in hotel session (backend token + user) may open the PMS screens.
export default function ProtectedRoute() {
  let isAuth = false;
  try {
    isAuth = dataStore.getItem("pms_authenticated") === "true" && Boolean(dataStore.getItem("pms_token"));
  } catch (e) {
    isAuth = false;
  }

  if (!isAuth) return <Navigate to="/login" replace />;
  return <Outlet />;
}
