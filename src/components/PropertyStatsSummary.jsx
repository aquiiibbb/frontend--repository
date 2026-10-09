import React, { useState, useMemo, useEffect } from "react";
import { Printer, Eye, Shield, Zap, DollarSign, CreditCard, Calendar as CalendarIcon, ChevronDown, ChevronRight, ChevronLeft, TrendingUp, BarChart2 } from "lucide-react";
import { getBusinessDate, getRoomTypes, getSellableRooms, isSellableRoom, getVirtualRoomTypeNames } from "../services/hotelConfig";
import { isInventoryConsumingBooking } from "../services/overbookingService";
import { UNIFIED_PAYMENT_METHODS, normalizePaymentMethod } from "../constants/paymentMethods";
import CustomDatePicker from "./CustomDatePicker";
import "./propertyStatsSummary.css";

export default function PropertyStatsSummary({ rooms = [], bookings = [], roomTypes = [] }) {
  const [activeBizDate, setActiveBizDate] = useState(() => getBusinessDate());
  
  // State for user-selected start date (defaults to business date)
  const [selectedStartDate, setSelectedStartDate] = useState(() => getBusinessDate());

  useEffect(() => {
    function handleBizDateUpdate() {
      const bDate = getBusinessDate();
      setActiveBizDate(bDate);
      setSelectedStartDate(bDate);
    }
    window.addEventListener("pms_business_date_updated", handleBizDateUpdate);
    return () => window.removeEventListener("pms_business_date_updated", handleBizDateUpdate);
  }, []);

  // Expandable toggle states
  const [isAvailableExpanded, setIsAvailableExpanded] = useState(false);
  const [isPaymentExpanded, setIsPaymentExpanded] = useState(false);

  // Extract list of unique room types across roomTypes prop & rooms array (excluding Virtual room types)
  const roomTypesList = useMemo(() => {
    const set = new Set();
    const allRoomTypes = getRoomTypes();
    const virtualTypeNames = getVirtualRoomTypeNames(allRoomTypes);

    if (Array.isArray(roomTypes) && roomTypes.length > 0) {
      roomTypes.forEach((rt) => {
        if (rt && (rt.isVirtual || rt.isStaffRoom || rt.isHouseUse)) return;
        const name = typeof rt === "string" ? rt : (rt.name || rt.title || rt.type);
        if (name && name.trim() && !virtualTypeNames.includes(name.trim().toLowerCase())) {
          set.add(name.trim());
        }
      });
    }
    if (Array.isArray(rooms) && rooms.length > 0) {
      rooms.forEach((r) => {
        const typeName = r.type || r.roomType || r.category || "Standard Room";
        if (typeName && typeName.trim() && !virtualTypeNames.includes(typeName.trim().toLowerCase())) {
          set.add(typeName.trim());
        }
      });
    }
    if (set.size === 0) {
      set.add("Standard Room");
    }
    return Array.from(set);
  }, [rooms, roomTypes]);

  // Extract payment methods list from standardized UNIFIED_PAYMENT_METHODS
  const paymentMethodsList = useMemo(() => {
    return UNIFIED_PAYMENT_METHODS;
  }, []);

  // Compute 7-day range starting from selectedStartDate
  const days = useMemo(() => {
    const baseDate = new Date(selectedStartDate.length === 10 ? selectedStartDate + "T00:00:00" : selectedStartDate);
    const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
    const result = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(validBase);
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateISO = `${yyyy}-${mm}-${dd}`;
      const monthShort = d.toLocaleString("en-US", { month: "short" });
      const dayNum = d.getDate();
      const weekdayShort = d.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
      result.push({
        date: dateISO,
        dayNum,
        monthShort,
        weekdayShort,
        label: `${dayNum} ${monthShort}`,
      });
    }
    return result;
  }, [selectedStartDate]);

  // Compute daily metrics + room type & payment breakdown across the 7 days
  const dailyStats = useMemo(() => {
    const allRoomTypes = getRoomTypes();
    const sellableRooms = getSellableRooms(rooms, allRoomTypes);
    const totalRoomCount = sellableRooms.length;

    return days.map((day) => {
      let soldCount = 0;
      let dailyRevenue = 0;

      const activeBookingsOnDay = (bookings || []).filter((b) => {
        if (!isInventoryConsumingBooking(b)) return false;
        const rNo = b.room || b.roomNumber || b.roomNo;
        if (rNo && !isSellableRoom(rNo, rooms, allRoomTypes)) return false;
        const cIn = String(b.checkIn || "").slice(0, 10);
        const cOut = String(b.checkOut || "").slice(0, 10);
        return cIn <= day.date && cOut > day.date;
      });

      activeBookingsOnDay.forEach((b) => {
        soldCount++;
        const cIn = String(b.checkIn || "").slice(0, 10);
        const cOut = String(b.checkOut || "").slice(0, 10);
        const nights = Math.max(1, Math.round((new Date(cOut) - new Date(cIn)) / 86400000)) || 1;
        const rate = Number(b.ratePerNight || b.nightlyRateUSD || (b.totalAmount ? b.totalAmount / nights : 120));
        dailyRevenue += rate;
      });

      const availableCount = Math.max(0, totalRoomCount - soldCount);
      const occupancyPct = totalRoomCount > 0 ? Math.min(100, Math.round((soldCount / totalRoomCount) * 100)) : 0;
      const adr = soldCount > 0 ? Math.round(dailyRevenue / soldCount) : 0;
      const revpar = totalRoomCount > 0 ? Math.round(dailyRevenue / totalRoomCount) : 0;

      // Calculate total daily payment collected & payment method breakdown
      const paymentMethodBreakdown = {};
      UNIFIED_PAYMENT_METHODS.forEach((pm) => {
        paymentMethodBreakdown[pm.name] = 0;
      });

      let dailyPaymentTotal = 0;

      (bookings || []).forEach((b) => {
        if (!b || b.status === "cancelled" || b.isDeleted) return;

        if (Array.isArray(b.payments) && b.payments.length > 0) {
          const paysForDay = b.payments.filter((p) => {
            const pDate = String(p.date || p.createdAt || p.timestamp || "").slice(0, 10);
            return pDate === day.date;
          });
          paysForDay.forEach((p) => {
            const amt = Number(p.amountUSD || p.amount || 0);
            dailyPaymentTotal += amt;
            const pmNorm = normalizePaymentMethod(p.mode || p.method || p.paymentMethod || b.paymentMethod);
            if (paymentMethodBreakdown[pmNorm] !== undefined) {
              paymentMethodBreakdown[pmNorm] += amt;
            } else {
              paymentMethodBreakdown[pmNorm] = amt;
            }
          });
        } else if (Number(b.advanceAmount || b.paidAmount || 0) > 0) {
          const advanceTxnDate = String(
            b.advancePaymentDate || b.paymentDate || b.bookingDate || b.createdAt || b.createdDate || b.date || ""
          ).slice(0, 10);
          if (advanceTxnDate === day.date) {
            const amt = Number(b.advanceAmount || b.paidAmount || 0);
            dailyPaymentTotal += amt;
            const pmNorm = normalizePaymentMethod(b.paymentMethod || b.paymentMode || "Cash");
            if (paymentMethodBreakdown[pmNorm] !== undefined) {
              paymentMethodBreakdown[pmNorm] += amt;
            } else {
              paymentMethodBreakdown[pmNorm] = amt;
            }
          }
        }
      });

      // Room Type Breakdown calculation for this date
      const roomTypeBreakdown = {};
      roomTypesList.forEach((rt) => {
        const catRooms = (rooms || []).filter(
          (r) => (r.type || r.roomType || r.category || "Standard Room").toLowerCase() === rt.toLowerCase()
        );
        const totalPhysical = catRooms.length;

        const totalSoldForType = activeBookingsOnDay.filter((b) => {
          const assignedRoom = (rooms || []).find(
            (r) => String(r.no || r.number || r.roomNumber) === String(b.room || b.roomNumber)
          );
          const bType = assignedRoom
            ? (assignedRoom.type || assignedRoom.roomType || assignedRoom.category || "Standard Room")
            : (b.roomType || b.accommodation || b.category || "Standard Room");
          return bType.toLowerCase() === rt.toLowerCase();
        }).length;

        roomTypeBreakdown[rt] = {
          total: totalPhysical,
          sold: totalSoldForType,
          available: Math.max(0, totalPhysical - totalSoldForType),
        };
      });

      return {
        date: day.date,
        sold: soldCount,
        available: availableCount,
        occupancy: occupancyPct,
        adr,
        revpar,
        revenue: Math.round(dailyRevenue),
        payment: Math.round(dailyPaymentTotal),
        roomTypeBreakdown,
        paymentMethodBreakdown,
      };
    });
  }, [days, rooms, bookings, roomTypesList, paymentMethodsList]);

  // Date navigation handlers
  const handlePrevWeek = () => {
    const d = new Date(selectedStartDate + "T00:00:00");
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() - 7);
      setSelectedStartDate(d.toISOString().slice(0, 10));
    }
  };

  const handleNextWeek = () => {
    const d = new Date(selectedStartDate + "T00:00:00");
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 7);
      setSelectedStartDate(d.toISOString().slice(0, 10));
    }
  };

  const handleResetToday = () => {
    setSelectedStartDate(activeBizDate && activeBizDate.length === 10 ? activeBizDate : new Date().toISOString().slice(0, 10));
  };

  function handlePrintReport() {
    window.print();
  }

  return (
    <div className="property-stats-card">
      <div className="stats-card-header">
        <div className="stats-title-group">
          <h3>📊 Property Stats & Daily Inventory</h3>
          <p>Real-time occupancy, inventory availability, revenue, and collections summary</p>
        </div>

        <div className="stats-header-actions">
          {/* Date Selector Provision */}
          <div className="stats-date-picker-wrap" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label htmlFor="stats-start-date" style={{ fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
              <CalendarIcon size={14} /> Start Date:
            </label>
            <div style={{ width: "160px" }}>
              <CustomDatePicker
                id="stats-start-date"
                value={selectedStartDate}
                onChange={(e) => e.target.value && setSelectedStartDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="stats-nav-btn"
              title="Previous 7 Days"
              onClick={handlePrevWeek}
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              className="stats-nav-btn today-btn"
              title="Reset to Business Date"
              onClick={handleResetToday}
            >
              Today
            </button>
            <button
              type="button"
              className="stats-nav-btn"
              title="Next 7 Days"
              onClick={handleNextWeek}
            >
              <ChevronRight size={13} />
            </button>
          </div>

          <button type="button" className="stats-print-action-btn" onClick={handlePrintReport}>
            <Printer size={14} /> Print Stats Report
          </button>
        </div>
      </div>

      <div className="stats-matrix-table-wrap">
        <table className="stats-matrix-table">
          <thead>
            <tr>
              <th className="th-metric-header">METRIC / DATE</th>
              {days.map((d) => (
                <th key={d.date} className="th-date-col">
                  <span className="th-day-badge">{d.dayNum} {d.monthShort}</span>
                  <span className="th-weekday">{d.weekdayShort}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ROW 1: OCCUPANCY (%) */}
            <tr className="tr-occupancy">
              <td className="td-metric-label">
                <Eye size={14} className="metric-icon" /> <span>OCCUPANCY (%)</span>
              </td>
              {dailyStats.map((s) => (
                <td key={`occ-${s.date}`} className="td-val highlight-occ">
                  {s.occupancy}%
                </td>
              ))}
            </tr>

            {/* ROW 2: TOTAL AVAILABLE (EXPANDABLE) */}
            <tr 
              className="tr-available tr-available-clickable"
              onClick={() => setIsAvailableExpanded(!isAvailableExpanded)}
              title="Click to view room type availability breakdown"
            >
              <td className="td-metric-label">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Shield size={14} className="metric-icon" /> 
                    <span>TOTAL AVAILABLE</span>
                  </div>
                  <button
                    type="button"
                    className={`expand-toggle-icon-btn ${isAvailableExpanded ? 'expanded' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAvailableExpanded(!isAvailableExpanded);
                    }}
                    title={isAvailableExpanded ? "Collapse Room Types" : "Expand Room Types"}
                  >
                    {isAvailableExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
              </td>
              {dailyStats.map((s) => (
                <td key={`avail-${s.date}`} className="td-val highlight-avail">
                  {s.available}
                </td>
              ))}
            </tr>

            {/* EXPANDED ROOM TYPE SUB-ROWS */}
            {isAvailableExpanded && (
              roomTypesList.map((roomType) => (
                <tr key={`rt-sub-${roomType}`} className="tr-roomtype-sub">
                  <td className="td-metric-sub-label">
                    <span style={{ color: '#16a34a', marginRight: '6px', fontWeight: '800' }}>└</span>
                    <span>{roomType}</span>
                  </td>
                  {dailyStats.map((s) => {
                    const availForType = s.roomTypeBreakdown?.[roomType]?.available ?? 0;
                    return (
                      <td 
                        key={`rt-${roomType}-${s.date}`} 
                        className={`td-val-sub ${availForType > 0 ? 'has-avail' : 'no-avail'}`}
                      >
                        {availForType}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}

            {/* ROW 3: TOTAL SOLD */}
            <tr className="tr-sold">
              <td className="td-metric-label">
                <Zap size={14} className="metric-icon" /> <span>TOTAL SOLD</span>
              </td>
              {dailyStats.map((s) => (
                <td key={`sold-${s.date}`} className="td-val highlight-sold">
                  {s.sold}
                </td>
              ))}
            </tr>

            {/* ROW 4: ADR ($) */}
            <tr className="tr-adr">
              <td className="td-metric-label">
                <TrendingUp size={14} className="metric-icon" /> <span>ADR ($)</span>
              </td>
              {dailyStats.map((s) => (
                <td key={`adr-${s.date}`} className="td-val highlight-adr">
                  ${s.adr.toLocaleString()}
                </td>
              ))}
            </tr>

            {/* ROW 5: REVPAR ($) */}
            <tr className="tr-revpar">
              <td className="td-metric-label">
                <BarChart2 size={14} className="metric-icon" /> <span>REVPAR ($)</span>
              </td>
              {dailyStats.map((s) => (
                <td key={`revpar-${s.date}`} className="td-val highlight-revpar">
                  ${s.revpar.toLocaleString()}
                </td>
              ))}
            </tr>

            {/* ROW 6: ROOM REVENUE ($) */}
            <tr className="tr-revenue">
              <td className="td-metric-label">
                <DollarSign size={14} className="metric-icon" /> <span>ROOM REVENUE</span>
              </td>
              {dailyStats.map((s) => (
                <td key={`rev-${s.date}`} className="td-val highlight-rev">
                  ${s.revenue.toLocaleString()}
                </td>
              ))}
            </tr>

            {/* ROW 7: PAYMENT COLLECTED ($) (EXPANDABLE) */}
            <tr 
              className="tr-payment tr-payment-clickable"
              onClick={() => setIsPaymentExpanded(!isPaymentExpanded)}
              title="Click to view payment method breakdown"
            >
              <td className="td-metric-label">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <CreditCard size={14} className="metric-icon" /> 
                    <span>PAYMENT COLLECTED</span>
                  </div>
                  <button
                    type="button"
                    className={`expand-toggle-icon-btn ${isPaymentExpanded ? 'expanded-blue' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPaymentExpanded(!isPaymentExpanded);
                    }}
                    title={isPaymentExpanded ? "Collapse Payment Methods" : "Expand Payment Methods"}
                  >
                    {isPaymentExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
              </td>
              {dailyStats.map((s) => (
                <td key={`pay-${s.date}`} className="td-val highlight-pay">
                  ${s.payment.toLocaleString()}
                </td>
              ))}
            </tr>

            {/* EXPANDED PAYMENT METHOD SUB-ROWS */}
            {isPaymentExpanded && (
              UNIFIED_PAYMENT_METHODS.map((pmItem) => (
                <tr key={`pm-sub-${pmItem.name}`} className="tr-paymentmethod-sub">
                  <td className="td-metric-sub-label-blue">
                    <span style={{ color: '#059669', marginRight: '6px', fontWeight: '800' }}>└</span>
                    <span>{pmItem.icon} {pmItem.name}</span>
                  </td>
                  {dailyStats.map((s) => {
                    const amtForMethod = s.paymentMethodBreakdown?.[pmItem.name] ?? 0;
                    return (
                      <td 
                        key={`pm-${pmItem.name}-${s.date}`} 
                        className={`td-val-sub ${amtForMethod > 0 ? 'has-pay' : 'no-pay'}`}
                      >
                        ${amtForMethod.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


