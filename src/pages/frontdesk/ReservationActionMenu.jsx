import { useEffect, useRef, useState } from "react";
import { MENU_GROUPS } from "./quickActionConfig";
import "./reservationActionMenu.css";

/**
 * Context-aware dynamic filtering based on reservation status
 */
function isItemRelevant(itemId, booking) {
  const status = (booking?.status || "").toLowerCase();

  // If room is blocked / maintenance -> show Unblock, hide Block / CheckIn / CheckOut
  if (status === "blocked" || status === "maintenance") {
    if (itemId === "block") return false;
    if (itemId === "checkIn") return false;
    if (itemId === "checkOut") return false;
    if (itemId === "noShow") return false;
    if (itemId === "unblock") return true;
  } else {
    // Room is not blocked -> hide Unblock
    if (itemId === "unblock") return false;
  }

  // If guest is already checked in -> hide Check In, No Show & Send Self Check-In Link
  if (status === "checked-in" || status === "checkedin" || status === "occupied") {
    if (itemId === "checkIn") return false;
    if (itemId === "noShow") return false;
    if (itemId === "sendSelfCheckIn") return false;
  }

  // If guest is upcoming / reserved -> show Check In & No Show, hide Check Out
  if (status === "reserved" || status === "confirmed" || status === "new") {
    if (itemId === "checkOut") return false;
  }

  // If guest is already checked out -> hide Check In, Check Out, No Show & Send Self Check-In Link
  if (status === "checked-out" || status === "checkedout") {
    if (itemId === "checkIn") return false;
    if (itemId === "checkOut") return false;
    if (itemId === "noShow") return false;
    if (itemId === "modifyCheckIn") return false;
    if (itemId === "sendSelfCheckIn") return false;
  }

  return true;
}

export default function ReservationActionMenu({ booking, room, style, onClose, onSelectAction }) {
  const rootRef = useRef(null);
  // Default to the first group tab ("RESERVATION")
  const [activeTab, setActiveTab] = useState(() => MENU_GROUPS[0]?.title || "RESERVATION");

  useEffect(() => {
    function handleOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.();
    }
    function handleEscape(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  if (!booking) return null;

  const currentGroup = MENU_GROUPS.find((g) => g.title === activeTab) || MENU_GROUPS[0];
  const relevantItems = (currentGroup?.items || []).filter((item) => isItemRelevant(item.id, booking));

  return (
    <div className="ram-root" style={style} ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <div className="ram-menu">
        {/* TAB HEADERS */}
        <div className="ram-header-row">
          {MENU_GROUPS.map((group) => {
            const isActive = activeTab === group.title;
            return (
              <button
                type="button"
                key={group.title}
                className={`ram-header-btn ${isActive ? "is-active" : ""}`}
                style={{ color: isActive ? group.accent : "inherit" }}
                onClick={() => setActiveTab(group.title)}
              >
                {group.title}
                <span className="ram-col-underline" style={{ background: group.accent, opacity: isActive ? 1 : 0 }} />
              </button>
            );
          })}
        </div>

        {/* ACTIVE TAB ITEMS (SINGLE COLUMN DISPLAY) */}
        <div className="ram-single-col-body">
          <div className="ram-col-title" style={{ color: currentGroup.accent }}>
            {currentGroup.title}
          </div>
          <div className="ram-items-list">
            {relevantItems.length === 0 ? (
              <p className="ram-empty-msg">No actions available for current status</p>
            ) : (
              relevantItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="ram-item"
                  onClick={() => onSelectAction?.(item.id, booking, room)}
                >
                  <span className="ram-item-icon">{item.icon}</span>
                  <span className="ram-item-label">{item.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
