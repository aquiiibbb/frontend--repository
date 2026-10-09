// Lightweight inline icon set (no external icon library dependency)
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

export const IconDashboard = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);
export const IconHotel = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 10h.01M12 10h.01M15 10h.01" />
  </svg>
);
export const IconBed = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7" /><path d="M3 18h18" /><path d="M3 14h18" /><path d="M7 9V6a1 1 0 0 1 1-1h3" />
  </svg>
);
export const IconDoor = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <rect x="5" y="2" width="14" height="20" rx="1" /><path d="M14 12h.01" />
  </svg>
);
export const IconUsers = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
    <circle cx="17" cy="9" r="2.4" /><path d="M15.7 14.6c2.4.3 4.1 2 4.6 4.7" />
  </svg>
);
export const IconImage = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.7" /><path d="M21 16.5 16 12l-9 8" />
  </svg>
);
export const IconShield = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <path d="M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5l-8-3Z" /><path d="m9 12 2 2 4-4" />
  </svg>
);
export const IconFrontDesk = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <path d="M3 21V9l9-5 9 5v12" /><path d="M9 21v-6h6v6" /><path d="M3 12h18" />
  </svg>
);
export const IconCalendar = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18" /><path d="M8 3v3M16 3v3" />
  </svg>
);
export const IconCheckIn = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <path d="M13 3h6v18h-6" /><path d="M3 12h13" /><path d="m10 7 5 5-5 5" />
  </svg>
);
export const IconCheckOut = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <path d="M13 3h6v18h-6" /><path d="M16 12H3" /><path d="m9 7-5 5 5 5" />
  </svg>
);
export const IconWalkIn = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <circle cx="12" cy="5" r="2.5" /><path d="M12 8v6" /><path d="m8 22 4-8 4 8" /><path d="m8 12-3 3M16 12l3 3" />
  </svg>
);
export const IconRoomAvail = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" /><path d="m15 17 2 2 4-4" />
  </svg>
);
export const IconGuestDetails = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M6 17c.6-2 1.7-3 3-3s2.4 1 3 3" /><path d="M14 9h4M14 13h4" />
  </svg>
);
export const IconPayment = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19" /><path d="M6 14.5h4" />
  </svg>
);
export const IconChevronRight = (p) => (
  <svg viewBox="0 0 24 24" className="chevron" width="14" height="14" {...base} {...p}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" width="15" height="15" {...base} {...p}>
    <circle cx="11" cy="11" r="7" /><path d="m21 21-3.5-3.5" />
  </svg>
);
export const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconSetup = (p) => (
  <svg viewBox="0 0 24 24" className="nav-icon" {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const IconLock = (p) => (
  <svg viewBox="0 0 24 24" width="15" height="15" {...base} {...p}>
    <rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
  </svg>
);
export const IconLogout = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
  </svg>
);
export const IconMenu = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);
export const IconRefresh = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
    <path d="M3.5 9a8.5 8.5 0 0 1 14.5-4.5M20.5 15a8.5 8.5 0 0 1-14.5 4.5" />
    <path d="M18 3v5h-5M6 21v-5h5" />
  </svg>
);
