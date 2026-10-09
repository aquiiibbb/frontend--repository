import { dataStore } from "./services/dataStore";
import { useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout, { getDefaultAllowedRoute } from "./components/Layout";
import { getUserRights } from "./services/hotelConfig";
import Calendar from "./pages/frontdesk/Calendar";
import Masterreport from "./pages/frontdesk/masterreport";
import WalkinGuest from "./pages/frontdesk/WalkinGuest";
import Housekeeping from "./pages/Housekeeping";

import NightAudit from "./pages/frontdesk/NightAudit";
import GuestDatabase from "./pages/frontdesk/GuestDatabase";
import MobileCheckIn from "./pages/frontdesk/MobileCheckIn";
import CompanyAccounts from "./pages/CompanyAccounts";
import ConfigurationPanel from "./pages/ConfigurationPanel";
import ChannelManager from "./pages/ChannelManager";
import RateManagement from "./pages/frontdesk/RateManagement";

import ActivityDashboard from "./pages/frontdesk/ActivityDashboard";
import Dashboard from "./pages/Dashboard";
import DailyExpenses from "./pages/operations/DailyExpenses";
import DailySalesPOS from "./pages/operations/DailySalesPOS";
import MiscOperations from "./pages/operations/MiscOperations";

import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import ImpersonateEntry from "./pages/ImpersonateEntry";
import BookingEngine from "./pages/public/BookingEngine";
import PublicGuestCheckIn from "./pages/public/PublicGuestCheckIn";
import { FolioManager } from "./components/Folio/FolioManager";
import { PMSProvider } from "./context/PMSContext";

function IndexRedirect() {
  const userObj = useMemo(() => {
    try {
      return JSON.parse(dataStore.getItem("pms_user") || "{}");
    } catch (e) {
      return {};
    }
  }, []);
  const rights = getUserRights(userObj);
  const dest = getDefaultAllowedRoute(rights);
  return <Navigate to={dest} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <PMSProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/impersonate" element={<ImpersonateEntry />} />
          <Route path="/book" element={<BookingEngine />} />
          <Route path="/booking-engine" element={<BookingEngine />} />
          <Route path="/guest-checkin" element={<PublicGuestCheckIn />} />
          <Route path="/guest-checkin/:reservationId" element={<PublicGuestCheckIn />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<IndexRedirect />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="front-desk/activity" element={<ActivityDashboard />} />
              <Route path="configuration" element={<ConfigurationPanel />} />
              <Route path="settings" element={<ConfigurationPanel />} />
              <Route path="hotel-info" element={<ConfigurationPanel />} />
              <Route path="room-type" element={<ConfigurationPanel />} />
              <Route path="rooms" element={<ConfigurationPanel />} />
              <Route path="tax" element={<ConfigurationPanel />} />
              <Route path="rate-plans" element={<ConfigurationPanel />} />
              <Route path="extra" element={<ConfigurationPanel />} />
              <Route path="staff" element={<ConfigurationPanel />} />
              <Route path="gallery" element={<ConfigurationPanel />} />
              <Route path="policies" element={<ConfigurationPanel />} />

              <Route path="housekeeping" element={<Housekeeping />} />
              <Route path="rate-management" element={<RateManagement />} />
              <Route path="master-report" element={<Masterreport />} />
              <Route path="company-accounts" element={<CompanyAccounts />} />
              <Route path="night-audit" element={<NightAudit />} />
              <Route path="channel-manager" element={<ChannelManager />} />

              {/* FRONT DESK ROUTES & ALIASES */}
              <Route path="front-desk/calendar" element={<Calendar />} />
              <Route path="front-desk/rate-management" element={<RateManagement />} />
              <Route path="front-desk/housekeeping" element={<Housekeeping />} />
              <Route path="front-desk/room-availability" element={<Calendar />} />
              <Route path="master-report" element={<Masterreport />} />
              <Route path="reports" element={<Navigate to="/master-report" replace />} />
              <Route path="reports-hub" element={<Navigate to="/master-report" replace />} />
              <Route path="rate-inventory-report" element={<Navigate to="/master-report" replace />} />
              <Route path="night-audit-report" element={<Navigate to="/master-report" replace />} />
              <Route path="front-desk/masterreport" element={<Masterreport />} />
              <Route path="front-desk/reports" element={<Navigate to="/master-report" replace />} />
              <Route path="front-desk/reports-hub" element={<Navigate to="/master-report" replace />} />
              <Route path="front-desk/rate-inventory-report" element={<Navigate to="/master-report" replace />} />
              <Route path="front-desk/night-audit-report" element={<Navigate to="/master-report" replace />} />
              <Route path="front-desk/night-audit" element={<NightAudit />} />
              <Route path="front-desk/guest-database" element={<GuestDatabase />} />
              <Route path="front-desk/guest-details" element={<GuestDatabase />} />
              <Route path="front-desk/company-accounts" element={<CompanyAccounts />} />
              <Route path="front-desk/payment" element={<CompanyAccounts />} />
              <Route path="front-desk/digital-key" element={<MobileCheckIn />} />
              <Route path="folios" element={<FolioManager />} />
              <Route path="folio-operations" element={<FolioManager />} />
              <Route path="front-desk/folios" element={<FolioManager />} />
              <Route path="front-desk/folio-operations" element={<FolioManager />} />
              <Route path="front-desk/walk-in-guest" element={<WalkinGuest />} />
              <Route path="operations/expenses" element={<DailyExpenses />} />
              <Route path="operations/sales-pos" element={<DailySalesPOS />} />
              <Route path="front-desk/expenses" element={<DailyExpenses />} />
              <Route path="front-desk/sales-pos" element={<DailySalesPOS />} />
              <Route path="misc" element={<MiscOperations />} />
              <Route path="operations/misc" element={<MiscOperations />} />
              <Route path="front-desk/misc" element={<MiscOperations />} />
            </Route>
          </Route>
        </Routes>
      </PMSProvider>
    </BrowserRouter>
  );
}
