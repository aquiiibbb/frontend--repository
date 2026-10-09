import React, { useState } from "react";
import "./CustomCalendarPopover.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export default function CustomCalendarPopover({ selectedDate, onSelectDate, onClose, todayISO, minDate, maxDate }) {
  const initialDateParts = (selectedDate || todayISO || "2026-08-14").split("-");
  const [viewYear, setViewYear] = useState(Number(initialDateParts[0]) || 2026);
  const [viewMonth, setViewMonth] = useState((Number(initialDateParts[1]) - 1) >= 0 ? Number(initialDateParts[1]) - 1 : 0);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      dateStr: null
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${viewYear}-${mm}-${dd}`;
    cells.push({
      day: d,
      isCurrentMonth: true,
      dateStr
    });
  }

  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({
      day: d,
      isCurrentMonth: false,
      dateStr: null
    });
  }

  const handleCellClick = (cell) => {
    if (!cell.isCurrentMonth || !cell.dateStr) return;
    if (minDate && cell.dateStr < minDate) return;
    if (maxDate && cell.dateStr > maxDate) return;
    onSelectDate(cell.dateStr);
    onClose();
  };

  const handleTodayClick = (e) => {
    e.stopPropagation();
    const todayVal = todayISO || "2026-08-14";
    if (minDate && todayVal < minDate) return;
    if (maxDate && todayVal > maxDate) return;
    onSelectDate(todayVal);
    onClose();
  };

  return (
    <>
      <div className="cal-popover-backdrop" />
      <div className="cal-popover-container" onClick={(e) => e.stopPropagation()}>
        {/* NAVY TOP BAR */}
        <div className="cal-popover-header">
          <button type="button" className="cal-nav-btn" onClick={handlePrevMonth}>
            ‹
          </button>
          <span className="cal-month-title">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button type="button" className="cal-nav-btn" onClick={handleNextMonth}>
            ›
          </button>
        </div>

        {/* WEEKDAYS ROW */}
        <div className="cal-weekday-row">
          {WEEKDAYS.map((w) => (
            <span key={w} className="cal-weekday-cell">
              {w}
            </span>
          ))}
        </div>

        {/* DAYS GRID */}
        <div className="cal-days-grid">
          {cells.map((cell, idx) => {
            const isSelected = cell.dateStr === selectedDate;
            const isToday = cell.dateStr === (todayISO || "2026-08-14");
            const isOutMin = Boolean(minDate && cell.dateStr && cell.dateStr < minDate);
            const isOutMax = Boolean(maxDate && cell.dateStr && cell.dateStr > maxDate);
            const isDisabledCell = !cell.isCurrentMonth || isOutMin || isOutMax;

            let cellClass = "cal-day-cell";
            if (!cell.isCurrentMonth || isOutMin || isOutMax) cellClass += " muted";
            if (isSelected) cellClass += " selected";
            if (isToday) cellClass += " today";

            return (
              <button
                key={idx}
                type="button"
                className={cellClass}
                disabled={isDisabledCell}
                onClick={() => !isDisabledCell && handleCellClick(cell)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        {/* FOOTER BAR */}
        <div className="cal-popover-footer">
          <button type="button" className="cal-footer-btn today" onClick={handleTodayClick}>
            Today
          </button>
          <button type="button" className="cal-footer-btn close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
