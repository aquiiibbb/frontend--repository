import { dataStore } from "../services/dataStore";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getBookings, getRooms, getAuditLogs } from "../services/api";
import { getBusinessDate, getTransactionCategories, getRoomTypes, getSellableRooms, isSellableRoom } from "../services/hotelConfig";
import { formatUSD } from "../utils/formatters";
import { 
  TrendingUp, 
  Users, 
  Calendar as CalendarIcon, 
  Plus, 
  CheckSquare, 
  Square, 
  MoreHorizontal, 
  PieChart, 
  DollarSign, 
  Activity, 
  CheckCircle2, 
  Layers,
  Sparkles,
  RefreshCw,
  Zap,
  Building2,
  BedDouble,
  ShieldCheck,
  Trash2,
  X,
  ChevronRight,
  ArrowUpRight,
  Globe,
  Download
} from "lucide-react";
import "./Dashboard.css";

// Helpers for date formatting
const formatShortDate = (dateObj) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = months[dateObj.getMonth()];
  return `${day} ${month}`;
};

const formatMonthYearShort = (dateObj) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[dateObj.getMonth()];
  const yearShort = String(dateObj.getFullYear()).slice(-2);
  return `${month} '${yearShort}`;
};

const formatFullDate = (dateObj) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const month = months[dateObj.getMonth()];
  const day = dateObj.getDate();
  const year = dateObj.getFullYear();
  return `${month} ${day}, ${year}`;
};

const toISODate = (val) => {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  if (typeof val === 'string') {
    const str = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return '';
};

const getBookingNetRevenue = (b) => {
  if (!b) return 0;
  const subtotal = Number(b.subtotal || 0);
  const taxAmount = Number(b.taxAmount || 0);
  const totalAmount = Number(b.totalAmountUSD || b.totalAmount || 0);
  const taxPercent = Number(b.taxPercent || 12);

  if (subtotal > 0) return subtotal;
  if (taxAmount > 0 && totalAmount > taxAmount) return totalAmount - taxAmount;
  if (totalAmount > 0) return totalAmount / (1 + (taxPercent / 100));
  const ratePerNight = Number(b.ratePerNight || b.nightlyRateUSD || 0);
  if (ratePerNight > 0) {
    const nights = Math.max(1, parseInt(b.nights || 1, 10));
    return (ratePerNight * nights) / (1 + (taxPercent / 100));
  }
  return 0;
};

const getBookingNetDailyRate = (b, cIn, cOut) => {
  if (!b) return 0;
  const nights = (cIn && cOut) ? (Math.max(1, Math.round((new Date(cOut) - new Date(cIn)) / 86400000)) || 1) : (Math.max(1, parseInt(b.nights || 1, 10)));
  const netRevenue = getBookingNetRevenue(b);
  return netRevenue / nights;
};

export default function Dashboard() {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Time Period Toggles
  const [revenuePeriod, setRevenuePeriod] = useState('6m'); // '6m' | '30d' | '12m'
  const [resPeriod, setResPeriod] = useState('7d'); // '7d' | '30d'
  const [occupiedTrendMode, setOccupiedTrendMode] = useState('daily'); // 'daily' | 'monthly'
  const [finTab, setFinTab] = useState('expense'); // 'income' | 'expense'
  const [transCategories, setTransCategories] = useState(() => getTransactionCategories());

  // Hover Tooltip States
  const [hoveredRevIdx, setHoveredRevIdx] = useState(null);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState(null);

  const activeBizDate = useMemo(() => getBusinessDate() || toISODate(new Date()), []);

  // Parse active business date into JS Date object
  const bizDateObj = useMemo(() => {
    try {
      const parts = activeBizDate.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    } catch (e) {}
    return new Date();
  }, [activeBizDate]);

  // Initial user tasks synchronized with current business date
  const initialTasksWithBizDate = useMemo(() => {
    const d1 = new Date(bizDateObj);
    const d2 = new Date(bizDateObj);
    d2.setDate(d2.getDate() + 1);

    return [
      { id: 't1', date: formatFullDate(d1), title: 'Set Up Conference Room B for 10 AM Meeting', category: 'Events', completed: false, style: 'mint' },
      { id: 't2', date: formatFullDate(d1), title: 'Restock Housekeeping Supplies on 3rd Floor', category: 'Housekeeping', completed: false, style: 'lime' },
      { id: 't3', date: formatFullDate(d2), title: 'Inspect and Clean the Pool Area & Patio', category: 'Maintenance', completed: false, style: 'amber' },
      { id: 't4', date: formatFullDate(d2), title: 'Check-In Assistance During Peak Hours (4 PM - 6 PM)', category: 'FrontDesk', completed: false, style: 'mint' }
    ];
  }, [bizDateObj]);

  // Tasks Checklist State
  const [tasks, setTasks] = useState(() => {
    if (typeof dataStore !== "undefined") {
      try {
        const saved = dataStore.getItem('pms_dashboard_tasks');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return initialTasksWithBizDate;
  });

  // Add Task Modal State
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(() => formatFullDate(bizDateObj));

  // Fetch live system data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [bList, rList, aLogs] = await Promise.all([
        getBookings().catch(() => []),
        getRooms().catch(() => []),
        getAuditLogs().catch(() => [])
      ]);
      setBookings(bList || []);
      setRooms(rList || []);
      setAuditLogs(aLogs || []);
    } catch (e) {
      console.error("Error loading live dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleSync = () => loadData();
    const handleCategoriesSync = () => setTransCategories(getTransactionCategories());

    window.addEventListener("pms_bookings_updated", handleSync);
    window.addEventListener("pms_rooms_updated", handleSync);
    window.addEventListener("pms_business_date_updated", handleSync);
    window.addEventListener("pms_categories_updated", handleCategoriesSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener("pms_bookings_updated", handleSync);
      window.removeEventListener("pms_rooms_updated", handleSync);
      window.removeEventListener("pms_business_date_updated", handleSync);
      window.removeEventListener("pms_categories_updated", handleCategoriesSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [loadData]);

  // Task Handlers
  const toggleTaskCompleted = (taskId) => {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    setTasks(updated);
    if (typeof dataStore !== "undefined") {
      dataStore.setItem('pms_dashboard_tasks', JSON.stringify(updated));
    }
  };

  const deleteTask = (taskId) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    setTasks(updated);
    if (typeof dataStore !== "undefined") {
      dataStore.setItem('pms_dashboard_tasks', JSON.stringify(updated));
    }
  };

  const handleAddNewTask = (e) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask = {
      id: `t_${Date.now()}`,
      date: newTaskDate || formatFullDate(bizDateObj),
      title: newTaskTitle.trim(),
      category: 'General',
      completed: false,
      style: tasks.length % 3 === 0 ? 'mint' : tasks.length % 3 === 1 ? 'lime' : 'amber'
    };

    const updated = [...tasks, newTask];
    setTasks(updated);
    if (typeof dataStore !== "undefined") {
      dataStore.setItem('pms_dashboard_tasks', JSON.stringify(updated));
    }

    setNewTaskTitle('');
    setShowAddTaskModal(false);
  };

  // 1. LIVE SYSTEM OCCUPANCY TODAY (Calculated 100% from actual PMS room & booking state, excluding Virtual/Staff rooms)
  const occupancyStats = useMemo(() => {
    const roomTypes = getRoomTypes();
    const sellableRooms = getSellableRooms(rooms, roomTypes);
    const totalRooms = sellableRooms.length;
    
    // Find rooms occupied on current business date
    const occupiedRoomNos = new Set();
    
    bookings.forEach((b) => {
      if (!b || b.isDeleted) return;
      const statusLower = (b.status || '').toLowerCase().trim();
      if (
        statusLower === 'canceled' ||
        statusLower === 'cancelled' ||
        statusLower === 'no-show' ||
        statusLower === 'enquiry' ||
        statusLower === 'inquiry' ||
        statusLower === 'group enquiry' ||
        statusLower === 'group_enquiry' ||
        Boolean(b.isEnquiry)
      )
        return;

      const cIn = toISODate(b.checkIn || b.checkInDate);
      const cOut = toISODate(b.checkOut || b.checkOutDate);
      const isDateMatch = cIn && cOut && cIn <= activeBizDate && activeBizDate < cOut;

      if (isDateMatch) {
        const roomNo = String(b.room || b.roomNo || b.number || b.roomNumber || '').trim();
        if (roomNo && isSellableRoom(roomNo, rooms, roomTypes)) {
          occupiedRoomNos.add(roomNo);
        }
      }
    });

    // Also include sellable rooms explicitly flagged Occupied in room master
    sellableRooms.forEach((r) => {
      const rNo = String(r.no || r.number || r.id || '').trim();
      if (r.status === 'Occupied' || r.housekeepingStatus === 'Occupied') {
        occupiedRoomNos.add(rNo);
      }
    });

    const occupiedCount = totalRooms > 0 ? Math.min(totalRooms, occupiedRoomNos.size) : 0;
    const occPercent = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

    // Group occupied and total count by actual sellable room types in PMS
    const roomTypeCounts = {};
    sellableRooms.forEach((r) => {
      const type = r.type || r.roomType || 'Standard Room';
      if (!roomTypeCounts[type]) roomTypeCounts[type] = { total: 0, occupied: 0 };
      roomTypeCounts[type].total += 1;

      const rNo = String(r.no || r.number || r.id || '').trim();
      if (occupiedRoomNos.has(rNo)) {
        roomTypeCounts[type].occupied += 1;
      }
    });

    return { totalRooms, occupiedCount, occPercent, roomTypeCounts };
  }, [bookings, rooms, activeBizDate]);

  // 2. LIVE REVENUE WAVE CURVE (100% Calculated Real Data with zero fake fallback multipliers)
  const revenueWaveData = useMemo(() => {
    const result = [];
    const svgWidth = 760;

    let itemCount = 6;
    if (revenuePeriod === '30d') itemCount = 30;
    else if (revenuePeriod === '12m') itemCount = 12;

    const rawSlotValues = [];

    for (let i = itemCount - 1; i >= 0; i--) {
      let label = '';
      let slotRev = 0;

      if (revenuePeriod === '6m' || revenuePeriod === '12m') {
        const d = new Date(bizDateObj.getFullYear(), bizDateObj.getMonth() - i, 1);
        label = formatMonthYearShort(d);

        const targetYear = d.getFullYear();
        const targetMonth = d.getMonth();
        const allRoomTypes = getRoomTypes();

        bookings.forEach((b) => {
          if (!b || b.isDeleted) return;
          const statusLower = (b.status || '').toLowerCase();
          if (statusLower === 'canceled' || statusLower === 'cancelled' || statusLower === 'no-show') return;

          const rNo = b.room || b.roomNumber || b.roomNo;
          if (rNo && !isSellableRoom(rNo, rooms, allRoomTypes)) return;

          const cInStr = toISODate(b.checkIn || b.checkInDate);
          const cOutStr = toISODate(b.checkOut || b.checkOutDate);
          if (!cInStr || !cOutStr) return;

          const startDate = new Date(cInStr + "T00:00:00");
          const endDate = new Date(cOutStr + "T00:00:00");
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) return;

          const stayNights = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
          const netDailyRate = getBookingNetDailyRate(b, cInStr, cOutStr);

          let currDay = new Date(startDate);
          while (currDay < endDate) {
            if (currDay.getFullYear() === targetYear && currDay.getMonth() === targetMonth) {
              slotRev += netDailyRate;
            }
            currDay.setDate(currDay.getDate() + 1);
          }
        });
      } else {
        // 30 Days Timeline - Calculate exact daily net room revenue (excluding tax)
        const d = new Date(bizDateObj);
        d.setDate(d.getDate() - i);
        label = formatShortDate(d);
        const slotDateStr = toISODate(d);
        const allRoomTypes = getRoomTypes();

        bookings.forEach((b) => {
          if (!b || b.isDeleted) return;
          const statusLower = (b.status || '').toLowerCase();
          if (statusLower === 'canceled' || statusLower === 'cancelled') return;

          const rNo = b.room || b.roomNumber || b.roomNo;
          if (rNo && !isSellableRoom(rNo, rooms, allRoomTypes)) return;

          const cIn = toISODate(b.checkIn || b.checkInDate);
          const cOut = toISODate(b.checkOut || b.checkOutDate);
          if (!cIn || !cOut) return;

          if (cIn <= slotDateStr && slotDateStr < cOut) {
            const netDailyRate = getBookingNetDailyRate(b, cIn, cOut);
            slotRev += netDailyRate;
          }
        });
      }

      rawSlotValues.push({ label, val: Math.round(slotRev), idx: itemCount - 1 - i });
    }

    const maxObservedRev = Math.max(100, ...rawSlotValues.map((r) => r.val));
    const maxScaleY = revenuePeriod === '30d' ? Math.max(5000, Math.ceil(maxObservedRev * 1.25 / 1000) * 1000) : Math.max(50000, Math.ceil(maxObservedRev * 1.25 / 50000) * 50000);

    rawSlotValues.forEach((item) => {
      const padX = revenuePeriod === '30d' ? 22 : 50;
      const x = padX + item.idx * ((svgWidth - (padX * 2)) / (itemCount - 1));
      const y = Math.max(35, Math.min(185, 185 - (item.val / maxScaleY) * 150));

      result.push({
        label: item.label,
        val: item.val,
        formatted: `$${item.val.toLocaleString()}`,
        x,
        y
      });
    });

    return { points: result, maxScaleY };
  }, [bookings, rooms, bizDateObj, revenuePeriod]);

  // SVG Smooth Cubic Bezier generator for Revenue Chart
  const revenueWavePath = useMemo(() => {
    const pts = revenueWaveData.points;
    if (!pts || pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [revenueWaveData]);

  const revenueAreaPath = useMemo(() => {
    const pts = revenueWaveData.points;
    if (!pts || pts.length === 0) return '';
    const lastPt = pts[pts.length - 1];
    const firstPt = pts[0];
    return `${revenueWavePath} L ${lastPt.x} 190 L ${firstPt.x} 190 Z`;
  }, [revenueWaveData, revenueWavePath]);

  // 3. LIVE RESERVATIONS STACKED / GROUPED 3D PRISM DATA (Booked, Canceled, No-Show)
  const reservationsBarData = useMemo(() => {
    const itemCount = resPeriod === '7d' ? 7 : 10;
    const intervalDays = resPeriod === '7d' ? 1 : 3;

    const rawData = [];
    for (let i = itemCount - 1; i >= 0; i--) {
      const d = new Date(bizDateObj);
      d.setDate(d.getDate() - (i * intervalDays));
      const dateStr = formatShortDate(d);
      const isoStr = toISODate(d);

      let bookedCount = 0;
      let canceledCount = 0;
      let noShowCount = 0;

      bookings.forEach((b) => {
        if (!b || b.isDeleted) return;
        const bStatus = (b.status || '').toLowerCase().trim();
        const cIn = toISODate(b.checkIn || b.checkInDate);
        const created = toISODate(b.createdAt || b.date);

        const isTargetDay = (cIn && cIn === isoStr) || (created && created === isoStr);

        if (isTargetDay) {
          if (bStatus === 'canceled' || bStatus === 'cancelled') {
            canceledCount++;
          } else if (bStatus === 'no-show' || bStatus === 'noshow' || bStatus === 'no_show') {
            noShowCount++;
          } else {
            bookedCount++;
          }
        }
      });

      rawData.push({ date: dateStr, bookedCount, canceledCount, noShowCount });
    }

    const maxSingleDay = Math.max(5, ...rawData.map(r => Math.max(r.bookedCount, r.canceledCount, r.noShowCount, 1)));

    return {
      items: rawData,
      maxSingleDay
    };
  }, [bookings, bizDateObj, resPeriod]);

  // 4. LIVE BOOKING BY PLATFORM DONUT (100% Calculated percents and dynamic SVG ring paths)
  const platformData = useMemo(() => {
    const channelCounts = {
      'Direct Booking': 0,
      'Booking.com': 0,
      'Agoda': 0,
      'Airbnb': 0,
      'Hotels.com': 0,
      'Others': 0
    };

    bookings.forEach((b) => {
      if (!b || b.isDeleted) return;
      const src = (b?.source || b?.channel || b?.bookingChannel || 'Direct Booking').toLowerCase();
      if (src.includes('booking')) channelCounts['Booking.com']++;
      else if (src.includes('agoda')) channelCounts['Agoda']++;
      else if (src.includes('airbnb')) channelCounts['Airbnb']++;
      else if (src.includes('hotel') || src.includes('expedia')) channelCounts['Hotels.com']++;
      else if (src.includes('direct') || src.includes('walk-in') || src.includes('phone') || src.includes('web')) channelCounts['Direct Booking']++;
      else channelCounts['Others']++;
    });

    const total = Object.values(channelCounts).reduce((a, b) => a + b, 0);

    const platformDefs = [
      { label: 'Direct Booking', key: 'Direct Booking', color: '#10b981' },
      { label: 'Booking.com', key: 'Booking.com', color: '#3b82f6' },
      { label: 'Agoda', key: 'Agoda', color: '#84cc16' },
      { label: 'Airbnb', key: 'Airbnb', color: '#f59e0b' },
      { label: 'Hotels.com', key: 'Hotels.com', color: '#8b5cf6' },
      { label: 'Others', key: 'Others', color: '#94a3b8' }
    ];

    const circumference = 2 * Math.PI * 35; // 219.9115
    let cumulativePercent = 0;

    return platformDefs.map((p) => {
      const count = channelCounts[p.key];
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      
      const dash = (percent / 100) * circumference;
      const dashArray = `${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}`;
      const dashOffset = (-((cumulativePercent / 100) * circumference)).toFixed(2);
      cumulativePercent += percent;

      return {
        label: p.label,
        count,
        percent,
        color: p.color,
        dashArray,
        dashOffset
      };
    });
  }, [bookings]);

  // 5. LIVE FINANCIAL INCOME VS EXPENSE (Grouped strictly by selected Categories / Types)
  const financialData = useMemo(() => {
    const circumference = 2 * Math.PI * 39; // 245.0442
    const catPalette = ['#f59e0b', '#10b981', '#0284c7', '#a855f7', '#e11d48', '#3b82f6', '#14b8a6', '#f97316'];

    // Read misc transactions
    let miscList = [];
    if (typeof dataStore !== "undefined") {
      try {
        const savedMisc = dataStore.getItem('pms_misc_transactions');
        if (savedMisc) {
          const parsed = JSON.parse(savedMisc);
          if (Array.isArray(parsed)) miscList = parsed;
        }
      } catch (e) {}
    }

    if (finTab === 'income') {
      const configuredSaleCats = transCategories?.sale || getTransactionCategories().sale || [];
      const incomeMap = {};
      configuredSaleCats.forEach((cat) => {
        incomeMap[cat] = 0;
      });

      // 1. Room Tariff / Rate from active reservations (accumulate if 'Room Tariff' or room category exists in configured categories)
      let roomTariffTotal = 0;
      bookings.forEach((b) => {
        if (b && !b.isDeleted && b.status !== 'canceled' && b.status !== 'cancelled') {
          const rAmt = getBookingNetRevenue(b);
          roomTariffTotal += rAmt;

          if (Array.isArray(b.extras)) {
            b.extras.forEach((e) => {
              if (e && e.category && incomeMap.hasOwnProperty(e.category)) {
                const eAmt = parseFloat(e.amount || 0);
                if (eAmt > 0) {
                  incomeMap[e.category] = (incomeMap[e.category] || 0) + eAmt;
                }
              }
            });
          }
        }
      });

      if (incomeMap.hasOwnProperty('Room Tariff')) {
        incomeMap['Room Tariff'] = Math.round(roomTariffTotal);
      } else {
        const roomCatKey = configuredSaleCats.find(c => c.toLowerCase().includes('room') || c.toLowerCase().includes('tariff'));
        if (roomCatKey) {
          incomeMap[roomCatKey] = (incomeMap[roomCatKey] || 0) + Math.round(roomTariffTotal);
        }
      }

      // 2. Misc Sales
      miscList.forEach((t) => {
        if (t && t.type === 'SALE') {
          const cat = t.category || 'Misc Sale';
          const amt = Number(t.amountUSD || t.amount || 0);
          if (amt > 0 && incomeMap.hasOwnProperty(cat)) {
            incomeMap[cat] = (incomeMap[cat] || 0) + amt;
          }
        }
      });

      // 3. POS Daily Sales
      if (typeof dataStore !== "undefined") {
        try {
          const savedSales = dataStore.getItem('pms_daily_sales');
          if (savedSales) {
            const parsed = JSON.parse(savedSales);
            if (Array.isArray(parsed)) {
              parsed.forEach((s) => {
                if (s.status !== 'voided' && s.status !== 'cancelled') {
                  const cat = s.category || 'POS Sale';
                  const amt = Number(s.totalUSD || s.totalAmount || s.amount || 0);
                  if (amt > 0 && incomeMap.hasOwnProperty(cat)) {
                    incomeMap[cat] = (incomeMap[cat] || 0) + amt;
                  }
                }
              });
            }
          }
        } catch (e) {}
      }

      const entries = Object.entries(incomeMap);
      let incomeTotalSum = entries.reduce((sum, [, val]) => sum + val, 0);

      const items = entries.map(([catName, amt], idx) => {
        const pct = incomeTotalSum > 0 ? Math.round((amt / incomeTotalSum) * 100) : 0;
        return {
          label: catName,
          percent: pct,
          amount: `$${amt.toLocaleString()}`,
          color: catPalette[idx % catPalette.length]
        };
      });

      let cumPct = 0;
      const itemsWithSvg = items.map((item) => {
        const dash = item.percent > 0 ? (item.percent / 100) * circumference : 0;
        const dashArray = `${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}`;
        const dashOffset = (-((cumPct / 100) * circumference)).toFixed(2);
        cumPct += item.percent;
        return { ...item, dashArray, dashOffset };
      });

      return {
        total: `$${incomeTotalSum.toLocaleString()}`,
        subLabel: 'TOTAL LIVE INCOME',
        items: itemsWithSvg
      };
    }

    // Expense Tab: Grouped strictly by selected Category / Type
    const configuredExpenseCats = transCategories?.expense || getTransactionCategories().expense || [];
    const expMap = {};
    configuredExpenseCats.forEach((cat) => {
      expMap[cat] = 0;
    });

    // 1. Daily Expenses page records
    let expList = [];
    if (typeof dataStore !== "undefined") {
      try {
        const savedExp = dataStore.getItem('pms_daily_expenses');
        if (savedExp) {
          const parsed = JSON.parse(savedExp);
          if (Array.isArray(parsed)) expList = parsed;
        }
      } catch (e) {}
    }
    expList.forEach((exp) => {
      const cat = exp.category || 'Misc / Other';
      const amt = Number(exp.amountUSD || exp.amount || 0);
      expMap[cat] = (expMap[cat] || 0) + amt;
    });

    // 2. Misc Expenses
    miscList.forEach((t) => {
      if (t && t.type === 'EXPENSE') {
        const cat = t.category || 'Misc / Other';
        const amt = Number(t.amountUSD || t.amount || 0);
        expMap[cat] = (expMap[cat] || 0) + amt;
      }
    });

    const entries = Object.entries(expMap);
    let expTotalSum = entries.reduce((sum, [, val]) => sum + val, 0);

    const items = entries.map(([catName, amt], idx) => {
      const pct = expTotalSum > 0 ? Math.round((amt / expTotalSum) * 100) : 0;
      return {
        label: catName,
        percent: pct,
        amount: `$${amt.toLocaleString()}`,
        color: catPalette[idx % catPalette.length]
      };
    });

    let cumPct = 0;
    const itemsWithSvg = items.map((item) => {
      const dash = item.percent > 0 ? (item.percent / 100) * circumference : 0;
      const dashArray = `${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}`;
      const dashOffset = (-((cumPct / 100) * circumference)).toFixed(2);
      cumPct += item.percent;
      return { ...item, dashArray, dashOffset };
    });

    return {
      total: `$${expTotalSum.toLocaleString()}`,
      subLabel: 'TOTAL LIVE EXPENSE',
      items: itemsWithSvg
    };
  }, [bookings, finTab, transCategories]);

  // 5.5 GEOGRAPHIC ORIGIN ANALYTICS DATA (Country / State / City tracking with 30d/6m/1y period filters)
  const [geoTab, setGeoTab] = useState('country');
  const [geoPeriod, setGeoPeriod] = useState('30d');

  const FLAG_MAP = useMemo(() => ({
    'United States': '🇺🇸',
    'USA': '🇺🇸',
    'Canada': '🇨🇦',
    'United Kingdom': '🇬🇧',
    'UK': '🇬🇧',
    'Mexico': '🇲🇽',
    'Germany': '🇩🇪',
    'France': '🇫🇷',
    'India': '🇮🇳',
    'Australia': '🇦🇺',
    'Japan': '🇯🇵',
    'Brazil': '🇧🇷',
    'Spain': '🇪🇸',
    'Italy': '🇮🇹',
    'Netherlands': '🇳🇱',
    'California': '🇺🇸 CA',
    'New York': '🇺🇸 NY',
    'Texas': '🇺🇸 TX',
    'Florida': '🇺🇸 FL',
    'Illinois': '🇺🇸 IL',
    'Nevada': '🇺🇸 NV',
    'Ontario': '🇨🇦 ON',
    'Quebec': '🇨🇦 QC',
    'British Columbia': '🇨🇦 BC'
  }), []);

  const geoData = useMemo(() => {
    const now = new Date(getBusinessDate() || new Date());
    let daysBack = 30;
    if (geoPeriod === '6m') daysBack = 180;
    if (geoPeriod === '1y') daysBack = 365;

    const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const countsMap = {};
    const revMap = {};

    bookings.forEach((b) => {
      if (!b || b.isDeleted || b.status === 'canceled' || b.status === 'cancelled') return;
      const bDate = new Date(b.createdDate || b.created || b.checkIn || b.bookingDate || now);
      if (bDate < cutoff) return;

      // Extract raw country
      let rawCountry = (
        b.country ||
        b.guestCountry ||
        b.guestDetails?.country ||
        b.guestDetails?.guestCountry ||
        b.addressDetails?.country ||
        b.guestAddress?.country ||
        ''
      ).toString().trim();

      const phoneStr = String(b.phone || b.phoneNumber || b.mobile || '');
      const emailStr = String(b.email || '').toLowerCase();

      let normalizedCountry = '';
      const cLow = rawCountry.toLowerCase();

      if (
        cLow.includes('india') || 
        cLow === 'in' || 
        cLow === 'ind' || 
        phoneStr.startsWith('+91') || 
        phoneStr.startsWith('91') ||
        emailStr.endsWith('.in') ||
        ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'jaipur', 'ahmedabad', 'chennai', 'kolkata', 'hyderabad', 'pune', 'surat'].some(c => (b.city || '').toLowerCase().includes(c)) ||
        ['maharashtra', 'gujarat', 'rajasthan', 'karnataka', 'delhi', 'punjab', 'haryana', 'uttar pradesh', 'tamil nadu', 'telangana'].some(s => (b.state || '').toLowerCase().includes(s))
      ) {
        normalizedCountry = 'India';
      } else if (cLow.includes('united states') || cLow.includes('usa') || cLow === 'us' || cLow.includes('america') || phoneStr.startsWith('+1')) {
        normalizedCountry = 'United States';
      } else if (cLow.includes('united kingdom') || cLow.includes('uk') || cLow === 'gb' || cLow.includes('britain') || phoneStr.startsWith('+44')) {
        normalizedCountry = 'United Kingdom';
      } else if (cLow.includes('canada') || cLow === 'ca') {
        normalizedCountry = 'Canada';
      } else if (cLow.includes('australia') || cLow === 'au' || phoneStr.startsWith('+61')) {
        normalizedCountry = 'Australia';
      } else if (cLow.includes('germany') || cLow === 'de' || phoneStr.startsWith('+49')) {
        normalizedCountry = 'Germany';
      } else if (cLow.includes('france') || cLow === 'fr' || phoneStr.startsWith('+33')) {
        normalizedCountry = 'France';
      } else if (cLow.includes('spain') || cLow === 'es') {
        normalizedCountry = 'Spain';
      } else if (cLow.includes('italy') || cLow === 'it') {
        normalizedCountry = 'Italy';
      } else if (cLow.includes('mexico') || cLow === 'mx') {
        normalizedCountry = 'Mexico';
      } else if (cLow.includes('japan') || cLow === 'jp' || phoneStr.startsWith('+81')) {
        normalizedCountry = 'Japan';
      } else if (cLow.includes('china') || cLow === 'cn' || phoneStr.startsWith('+86')) {
        normalizedCountry = 'China';
      } else if (cLow.includes('uae') || cLow.includes('emirates') || phoneStr.startsWith('+971')) {
        normalizedCountry = 'United Arab Emirates';
      } else if (rawCountry) {
        normalizedCountry = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1);
      } else {
        normalizedCountry = 'United States';
      }

      // State extraction
      let rawState = (
        b.state ||
        b.guestState ||
        b.guestDetails?.state ||
        b.guestDetails?.guestState ||
        b.addressDetails?.state ||
        ''
      ).toString().trim();

      // City extraction
      let rawCity = (
        b.city ||
        b.guestCity ||
        b.guestDetails?.city ||
        b.guestDetails?.guestCity ||
        b.addressDetails?.city ||
        ''
      ).toString().trim();

      let locationKey = normalizedCountry;
      if (geoTab === 'country') {
        locationKey = normalizedCountry;
      } else if (geoTab === 'state') {
        locationKey = rawState || (normalizedCountry === 'India' ? 'Gujarat' : 'California');
      } else if (geoTab === 'city') {
        locationKey = rawCity || (normalizedCountry === 'India' ? 'Ahmedabad' : 'Los Angeles');
      }

      const netRev = getBookingNetRevenue(b);
      countsMap[locationKey] = (countsMap[locationKey] || 0) + 1;
      revMap[locationKey] = (revMap[locationKey] || 0) + netRev;
    });

    const sortedList = Object.keys(countsMap).map((loc) => ({
      name: loc,
      flag: FLAG_MAP[loc] || '📍',
      bookings: countsMap[loc],
      revenue: revMap[loc]
    })).sort((a, b) => b.bookings - a.bookings);

    const totalBookings = sortedList.reduce((sum, item) => sum + item.bookings, 0);
    const totalRevenue = sortedList.reduce((sum, item) => sum + item.revenue, 0);

    return {
      items: sortedList,
      totalBookings,
      totalRevenue
    };
  }, [bookings, geoTab, geoPeriod, FLAG_MAP]);

  const handleExportGeoCsv = () => {
    const headers = ["Rank", "Location", "No of Bookings", "Total Revenue ($ USD)", "Percentage Share (%)"];
    const rows = geoData.items.map((item, idx) => [
      idx + 1,
      item.name,
      item.bookings,
      item.revenue.toFixed(2),
      geoData.totalBookings > 0 ? ((item.bookings / geoData.totalBookings) * 100).toFixed(1) + "%" : "0%"
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pms_geographic_origin_${geoTab}_${geoPeriod}.csv`;
    a.click();
  };

  // 6. ROOMS OCCUPIED VS DATE TREND (Full-Width 1000px SVG calculated from real daily bookings)
  const occupiedTrendDatasets = useMemo(() => {
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const roomTypes = getRoomTypes();
    const sellableRooms = getSellableRooms(rooms, roomTypes);

    const calcOccupiedCountForIsoDate = (targetIsoDate) => {
      const occupiedRoomNos = new Set();

      bookings.forEach((b) => {
        if (!b || b.isDeleted) return;
        const statusLower = (b.status || '').toLowerCase();
        if (
          statusLower === 'canceled' ||
          statusLower === 'cancelled' ||
          statusLower === 'no-show' ||
          statusLower === 'enquiry' ||
          statusLower === 'inquiry' ||
          statusLower === 'group enquiry' ||
          statusLower === 'group_enquiry' ||
          Boolean(b.isEnquiry)
        )
          return;

        const cIn = toISODate(b.checkIn || b.checkInDate);
        const cOut = toISODate(b.checkOut || b.checkOutDate);

        if (!cIn || !cOut || cIn > targetIsoDate || targetIsoDate >= cOut) return;

        const roomNo = String(b.room || b.roomNo || b.number || b.roomNumber || '').trim();
        if (roomNo && isSellableRoom(roomNo, rooms, roomTypes)) {
          occupiedRoomNos.add(roomNo);
        }
      });

      if (targetIsoDate === activeBizDate) {
        sellableRooms.forEach((r) => {
          const rNo = String(r.no || r.number || r.id || '').trim();
          if (r.status === 'Occupied' || r.housekeepingStatus === 'Occupied') {
            occupiedRoomNos.add(rNo);
          }
        });
      }

      return sellableRooms.length > 0 ? Math.min(sellableRooms.length, occupiedRoomNos.size) : occupiedRoomNos.size;
    };

    if (occupiedTrendMode === 'daily') {
      const dailyData = [];
      for (let i = 14; i >= 0; i--) {
        const d = new Date(bizDateObj);
        d.setDate(d.getDate() - i);
        const dateStr = formatShortDate(d);
        const isoStr = toISODate(d);
        const count = calcOccupiedCountForIsoDate(isoStr);

        dailyData.push({
          date: dateStr,
          count
        });
      }
      return dailyData;
    }

    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(bizDateObj.getFullYear(), bizDateObj.getMonth() - i, 1);
      const mStr = monthsShort[d.getMonth()];
      
      let count = 0;
      bookings.forEach((b) => {
        if (!b || b.isDeleted) return;
        const statusLower = (b.status || '').toLowerCase();
        if (statusLower === 'canceled' || statusLower === 'cancelled' || statusLower === 'no-show') return;

        const cInStr = toISODate(b.checkIn || b.checkInDate);
        if (cInStr) {
          const bDate = new Date(cInStr);
          if (bDate.getFullYear() === d.getFullYear() && bDate.getMonth() === d.getMonth()) {
            const roomNo = String(b.room || b.roomNo || b.number || '').trim();
            if (!roomNo || isSellableRoom(roomNo, rooms, roomTypes)) {
              count++;
            }
          }
        }
      });

      monthlyData.push({
        date: mStr,
        count
      });
    }
    return monthlyData;
  }, [bookings, rooms, bizDateObj, activeBizDate, occupiedTrendMode]);

  // Only user-created manual tasks (No system alerts!)
  const combinedTasks = useMemo(() => {
    return tasks.filter((t) => !t.isSystem);
  }, [tasks]);

  // Dynamic max scale for Rooms Occupied SVG
  const maxOccupiedVal = useMemo(() => {
    const sellableRooms = getSellableRooms(rooms, getRoomTypes());
    const totalSellable = sellableRooms.length || 10;
    const observed = Math.max(0, ...occupiedTrendDatasets.map(d => d.count));
    return Math.max(totalSellable, Math.ceil(observed * 1.1));
  }, [occupiedTrendDatasets, rooms]);

  // SVG Path generator for smooth cubic bezier curves
  const generateSmoothPath = (pts, width = 1000, height = 240, maxVal = 16) => {
    if (!pts || pts.length === 0) return '';
    const points = pts.map((pt, i) => ({
      x: 50 + i * ((width - 100) / (pts.length - 1)),
      y: height - 40 - (pt.count / maxVal) * (height - 80)
    }));

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  // KPI Summary stats
  const activeBookingsCount = useMemo(() => {
    return bookings.filter(b => !b || !b.isDeleted && (b.status || '').toLowerCase() !== 'canceled' && (b.status || '').toLowerCase() !== 'cancelled').length;
  }, [bookings]);

  const pendingTasksCount = useMemo(() => {
    return tasks.filter(t => !t.completed).length;
  }, [tasks]);

  const latestRevenueFormatted = useMemo(() => {
    if (!revenueWaveData.points || revenueWaveData.points.length === 0) return '$0';
    const totalSum = revenueWaveData.points.reduce((acc, p) => acc + (p.val || 0), 0);
    return `$${totalSum.toLocaleString()}`;
  }, [revenueWaveData]);

  return (
    <div className="dash-container">
      
      {/* 3D GLASS HEADER BAR WITH LIVE SYSTEM SYNC */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">
            📊 Hotel Operations Dashboard
            <span className="dash-live-badge">
              <span className="dash-live-dot" /> LIVE PMS SYNC
            </span>
          </h1>
          <p className="dash-subtitle">
            Business Date: <strong>{activeBizDate}</strong> | Real-Time Live Analytics &amp; Smart Operations
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={loadData}
            title="Sync System State"
            className="dash-btn-secondary"
          >
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} /> {loading ? 'Syncing...' : 'Sync Data'}
          </button>

          <button
            type="button"
            onClick={() => setShowAddTaskModal(true)}
            className="dash-btn-primary"
          >
            <Plus size={16} /> + Add Operation Task
          </button>
        </div>
      </div>

      {/* ROW 1: REVENUE 3D ISOMETRIC PRISM CHART & OCCUPANCY TODAY GAUGE */}
      <div className="dash-grid-2col">
        
        {/* REVENUE 3D ISOMETRIC PRISM CARD (Emerald Theme) */}
        <div className="dash-card card-revenue card-3d-elevated">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <span className="card-header-icon icon-emerald"><TrendingUp size={18} /></span>
              <h3 className="dash-card-title">Revenue</h3>
            </div>
            <select
              className="dash-select"
              value={revenuePeriod}
              onChange={(e) => {
                setRevenuePeriod(e.target.value);
                setHoveredRevIdx(null);
              }}
            >
              <option value="6m">Last 6 Months</option>
              <option value="30d">Last 30 Days</option>
              <option value="12m">12 Months</option>
            </select>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '230px', marginTop: '10px' }}>
            <svg viewBox="0 0 760 210" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              
              <defs>
                {/* 3D Front Face Gradient */}
                <linearGradient id="revFrontGrad3D" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>

                {/* 3D Side Facet Dark Gradient */}
                <linearGradient id="revSideGrad3D" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#064e3b" />
                </linearGradient>

                {/* 3D Top Cap Bright Highlight */}
                <linearGradient id="revTopGrad3D" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#a7f3d0" />
                  <stop offset="100%" stopColor="#6ee7b7" />
                </linearGradient>

                <filter id="emeraldGlow3D" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#10b981" floodOpacity="0.55" />
                </filter>
              </defs>

              {/* Background Grid Lines */}
              <line x1="0" y1="40" x2="760" y2="40" stroke="#f1f5f9" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="0" y1="90" x2="760" y2="90" stroke="#f1f5f9" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="0" y1="140" x2="760" y2="140" stroke="#f1f5f9" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="0" y1="190" x2="760" y2="190" stroke="#cbd5e1" strokeWidth="1.5" />

              {/* Y-Axis Metrics dynamically derived from maxScaleY */}
              <text x="-10" y="45" fontSize="11" fill="#94a3b8" fontWeight="700">
                ${(revenueWaveData.maxScaleY / 1000).toFixed(0)}K
              </text>
              <text x="-10" y="95" fontSize="11" fill="#94a3b8" fontWeight="700">
                ${((revenueWaveData.maxScaleY * 0.66) / 1000).toFixed(0)}K
              </text>
              <text x="-10" y="145" fontSize="11" fill="#94a3b8" fontWeight="700">
                ${((revenueWaveData.maxScaleY * 0.33) / 1000).toFixed(0)}K
              </text>
              <text x="-10" y="195" fontSize="11" fill="#94a3b8" fontWeight="700">$0</text>

              {/* 3D ISOMETRIC PRISM COLUMNS FOR REVENUE */}
              {revenueWaveData.points.map((pt, idx) => {
                const is30d = revenuePeriod === '30d';
                const w = is30d ? 14 : (revenuePeriod === '12m' ? 24 : 30);
                const dx = is30d ? 3 : 7;
                const dy = is30d ? 3 : 7;
                const x = pt.x - (w + dx) / 2;
                const height = Math.max(8, (pt.val / revenueWaveData.maxScaleY) * 145);
                const y = 190 - height;
                const isHovered = hoveredRevIdx === idx;

                const showXLabel = !is30d || idx % 3 === 0 || idx === revenueWaveData.points.length - 1;

                return (
                  <g 
                    key={`${pt.label}-${idx}`}
                    onMouseEnter={() => setHoveredRevIdx(idx)}
                    onMouseLeave={() => setHoveredRevIdx(null)}
                    style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
                    filter={isHovered ? "url(#emeraldGlow3D)" : undefined}
                  >
                    {/* 3D Base Drop Shadow */}
                    <ellipse
                      cx={pt.x}
                      cy="192"
                      rx={w / 1.5}
                      ry="4"
                      fill="rgba(15, 23, 42, 0.15)"
                    />

                    {/* Background Pillar Track Frame */}
                    <rect
                      x={x}
                      y="40"
                      width={w}
                      height="150"
                      rx={is30d ? "2" : "4"}
                      fill="#f8fafc"
                      stroke="#f1f5f9"
                      strokeWidth="1"
                    />

                    {/* 1. FRONT FACE */}
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={height}
                      rx={is30d ? "2" : "3"}
                      fill="url(#revFrontGrad3D)"
                    />

                    {/* 2. RIGHT SIDE FACET (Perspective 3D Depth) */}
                    <path
                      d={`M ${x + w} ${y} L ${x + w + dx} ${y - dy} L ${x + w + dx} ${y + height - dy} L ${x + w} ${y + height} Z`}
                      fill="url(#revSideGrad3D)"
                    />

                    {/* 3. TOP CAP FACET (Perspective 3D Top Cap) */}
                    <path
                      d={`M ${x} ${y} L ${x + dx} ${y - dy} L ${x + w + dx} ${y - dy} L ${x + w} ${y} Z`}
                      fill="url(#revTopGrad3D)"
                    />

                    {/* Value Label floating above 3D Prism when > 0 */}
                    {pt.val > 0 && (!is30d || isHovered || pt.val >= 1000) && (
                      <text
                        x={pt.x + dx / 2}
                        y={Math.max(28, y - dy - 6)}
                        textAnchor="middle"
                        fontSize={is30d ? "8.5" : "10.5"}
                        fontWeight="900"
                        fill={isHovered ? "#047857" : "#10b981"}
                      >
                        ${(pt.val / 1000).toFixed(pt.val >= 1000 ? 1 : 0)}K
                      </text>
                    )}

                    {/* Dynamic X-Axis Date Label */}
                    {showXLabel && (
                      <text
                        x={pt.x}
                        y="210"
                        textAnchor="middle"
                        fontSize={is30d ? "9.5" : "11"}
                        fill="#64748b"
                        fontWeight="700"
                      >
                        {pt.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* FLOATING HOVER TOOLTIP */}
            {hoveredRevIdx !== null && revenueWaveData.points[hoveredRevIdx] && (
              <div
                className="chart-tooltip"
                style={{
                  left: `${(revenueWaveData.points[hoveredRevIdx].x / 760) * 100}%`,
                  top: `${((190 - Math.max(8, (revenueWaveData.points[hoveredRevIdx].val / revenueWaveData.maxScaleY) * 145)) / 210) * 100}%`
                }}
              >
                <div className="chart-tooltip-label">{revenueWaveData.points[hoveredRevIdx].label}</div>
                <div className="chart-tooltip-val">{revenueWaveData.points[hoveredRevIdx].formatted}</div>
              </div>
            )}
          </div>
        </div>

        {/* OCCUPANCY TODAY GAUGE CARD (Sunset Orange Theme) */}
        <div className="dash-card card-occupancy card-3d-elevated">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <span className="card-header-icon icon-orange"><BedDouble size={18} /></span>
              <h3 className="dash-card-title">OCCUPANCY TODAY</h3>
            </div>
            <span className="dash-badge-subtle badge-orange">
              {occupancyStats.occupiedCount} / {occupancyStats.totalRooms} Rooms
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
            
            {/* 3D Circular Gauge with Inner Bevel Shadow */}
            <div style={{ position: 'relative', width: '135px', height: '135px', flexShrink: 0 }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', filter: 'drop-shadow(0 8px 16px rgba(234, 88, 12, 0.28))' }}>
                <circle cx="50" cy="50" r="38" fill="none" stroke="#ffedd5" strokeWidth="12" />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="url(#gaugeGrad3D)"
                  strokeWidth="12"
                  strokeDasharray="238.7"
                  strokeDashoffset={238.7 - (238.7 * (occupancyStats.occPercent || 0)) / 100}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="gaugeGrad3D" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ea580c" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
                  {occupancyStats.occPercent}%
                </div>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#ea580c', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  OCCUPANCY
                </div>
              </div>
            </div>

            {/* Room Type Progress Bars */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {Object.keys(occupancyStats.roomTypeCounts).length > 0 ? (
                Object.entries(occupancyStats.roomTypeCounts).map(([type, stats]) => (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '5px' }}>
                      <span>{type}</span>
                      <span style={{ color: '#ea580c' }}>{stats.occupied}/{stats.total}</span>
                    </div>
                    <div className="dash-progress-track">
                      <div
                        className="dash-progress-bar progress-orange"
                        style={{
                          width: `${stats.total > 0 ? (stats.occupied / stats.total) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                  No room inventory configured in system.
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* ROW 2: FINANCIAL BREAKDOWN & BOOKING BY PLATFORM */}
      <div className="dash-grid-equal">
        
        {/* FINANCIAL DONUT CARD (Gold Amber Theme) */}
        <div className="dash-card card-financial card-3d-elevated">
          <div className="dash-card-header" style={{ marginBottom: '16px' }}>
            <div className="dash-card-title-group">
              <span className="card-header-icon icon-amber"><DollarSign size={18} /></span>
              <div className="fin-tabs">
                <button
                  type="button"
                  className={`fin-tab ${finTab === 'income' ? 'active' : ''}`}
                  onClick={() => setFinTab('income')}
                >
                  Income
                </button>
                <button
                  type="button"
                  className={`fin-tab ${finTab === 'expense' ? 'active' : ''}`}
                  onClick={() => setFinTab('expense')}
                >
                  Expense
                </button>
              </div>
            </div>
            <span style={{ fontSize: '11.5px', color: '#d97706', fontWeight: '800', background: '#fef3c7', padding: '4px 10px', borderRadius: '6px' }}>Live Financials</span>
          </div>

          <div className="financial-side-layout">
            
            {/* Enlarged Donut Ring with 100% Dynamic Calculated Slices */}
            <div className="fin-donut-wrapper">
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', filter: 'drop-shadow(0 8px 18px rgba(245, 158, 11, 0.2))' }}>
                {financialData.items.map((item) => (
                  item.percent > 0 ? (
                    <circle
                      key={item.label}
                      cx="50"
                      cy="50"
                      r="39"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="12"
                      strokeDasharray={item.dashArray}
                      strokeDashoffset={item.dashOffset}
                    />
                  ) : null
                ))}
              </svg>

              {/* Center Glass Sphere */}
              <div className="donut-center-glass-sphere">
                <div className="donut-total-val" style={{ color: '#b45309' }}>{financialData.total}</div>
                <div className="donut-sub-label">{financialData.subLabel}</div>
              </div>
            </div>

            {/* Clean 2-Column Itemized List */}
            <div className="fin-itemized-grid">
              {financialData.items.map((item) => (
                <div key={item.label} className="fin-item-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="fin-item-dot" style={{ background: item.color, boxShadow: `0 2px 4px ${item.color}55` }} />
                    <span className="fin-item-title">{item.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="fin-item-percent">({item.percent}%)</span>
                    <span className="fin-item-amount">{item.amount}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* BOOKING BY PLATFORM DONUT CHART CARD (Vivid Purple Theme) */}
        <div className="dash-card card-platform card-3d-elevated">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <span className="card-header-icon icon-purple"><PieChart size={18} /></span>
              <h3 className="dash-card-title">Booking by Platform</h3>
            </div>
            <MoreHorizontal size={18} color="#7e22ce" style={{ cursor: 'pointer' }} />
          </div>

          <div className="donut-widget-layout">
            
            {/* Donut Chart Ring with 100% Dynamic Calculated Slices */}
            <div className="donut-chart-container">
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', filter: 'drop-shadow(0 6px 14px rgba(168, 85, 247, 0.2))' }}>
                {platformData.map((plat) => (
                  plat.percent > 0 ? (
                    <circle
                      key={plat.label}
                      cx="50"
                      cy="50"
                      r="35"
                      fill="none"
                      stroke={plat.color}
                      strokeWidth="16"
                      strokeDasharray={plat.dashArray}
                      strokeDashoffset={plat.dashOffset}
                    />
                  ) : null
                ))}
              </svg>
            </div>

            {/* Uncluttered 2-Column Grid Legend */}
            <div className="platform-legend-grid">
              {platformData.map((plat) => (
                <div key={plat.label} className="platform-legend-item">
                  <span className="platform-dot" style={{ background: plat.color, boxShadow: `0 2px 6px ${plat.color}66` }} />
                  <span className="platform-name">{plat.label}</span>
                  <span className="platform-percent">{plat.percent}%</span>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>

      {/* ROW 2.5: 📍 GEOGRAPHIC ORIGIN ANALYTICS (3D COLORFUL EXECUTIVE THEME) */}
      <div className="dash-card card-geo card-3d-elevated" style={{ marginBottom: '24px' }}>
        <div className="dash-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', paddingBottom: '14px', borderBottom: '1.5px solid #e2e8f0' }}>
          <div className="dash-card-title-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="card-header-icon" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', color: '#047857', border: '1px solid #6ee7b7', boxShadow: '0 4px 12px rgba(16,185,129,0.22)' }}>
              <Globe size={20} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="dash-card-title" style={{ margin: 0, fontSize: '16px', fontWeight: '900', letterSpacing: '-0.3px' }}>Reservation per Country &amp; Region</h3>
                <span className="dash-live-badge" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', color: '#0369a1', border: '1px solid #7dd3fc', padding: '3px 10px', fontSize: '10px' }}>
                  <span className="dash-live-dot" style={{ background: '#0284c7' }} /> Live Geo Analytics
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>Track guest origin, booking distribution volume &amp; total revenue worldwide</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select 
              className="dash-select" 
              value={geoPeriod} 
              onChange={(e) => setGeoPeriod(e.target.value)}
              style={{ padding: '7px 14px', fontSize: '12.5px', fontWeight: '800', borderRadius: '10px', border: '1.5px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
            >
              <option value="30d">🗓️ Last 30 Days</option>
              <option value="6m">🗓️ Last 6 Months</option>
              <option value="1y">🗓️ Last 1 Year</option>
            </select>

            <button 
              type="button" 
              onClick={handleExportGeoCsv} 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', fontSize: '12.5px', fontWeight: '800', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', color: '#0f172a', border: '1.5px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 3px 8px rgba(0,0,0,0.06)', transition: 'all 0.2s ease' }}
              title="Download Geographic Analytics CSV Report"
            >
              <Download size={14} style={{ color: '#0284c7' }} /> Export CSV
            </button>
          </div>
        </div>

        {/* 4 MINI 3D STAT METRIC CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '16px', marginBottom: '16px' }}>
          <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)', border: '1.5px solid #bbf7d0', borderRadius: '14px', padding: '12px 16px', boxShadow: '0 4px 12px rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '18px', boxShadow: '0 3px 8px rgba(16,185,129,0.2)' }}>🌍</div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Regions</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>{geoData.items.length} Markets</div>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)', border: '1.5px solid #bae6fd', borderRadius: '14px', padding: '12px 16px', boxShadow: '0 4px 12px rgba(2,132,199,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '18px', boxShadow: '0 3px 8px rgba(2,132,199,0.2)' }}>📊</div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Bookings</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>{geoData.totalBookings} Bookings</div>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fefce8 100%)', border: '1.5px solid #fef08a', borderRadius: '14px', padding: '12px 16px', boxShadow: '0 4px 12px rgba(234,179,8,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fef9c3', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '18px', boxShadow: '0 3px 8px rgba(234,179,8,0.2)' }}>💵</div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Revenue</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#059669' }}>{formatUSD(geoData.totalRevenue)}</div>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)', border: '1.5px solid #e9d5ff', borderRadius: '14px', padding: '12px 16px', boxShadow: '0 4px 12px rgba(168,85,247,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '18px', boxShadow: '0 3px 8px rgba(168,85,247,0.2)' }}>🥇</div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Origin</div>
              <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>
                {geoData.items[0]?.flag} {geoData.items[0]?.name || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* 3D PILL TAB CONTROLS (By Country | By State | By City) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', background: '#f1f5f9', padding: '5px', borderRadius: '12px', width: 'fit-content', border: '1px solid #cbd5e1', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)' }}>
          <button
            type="button"
            onClick={() => setGeoTab('country')}
            style={{ 
              padding: '7px 18px', 
              fontSize: '12.5px', 
              fontWeight: '900', 
              borderRadius: '9px', 
              border: 'none', 
              background: geoTab === 'country' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent', 
              color: geoTab === 'country' ? '#ffffff' : '#64748b', 
              cursor: 'pointer', 
              boxShadow: geoTab === 'country' ? '0 4px 12px rgba(2, 132, 199, 0.35)' : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            🌍 By Country
          </button>
          <button
            type="button"
            onClick={() => setGeoTab('state')}
            style={{ 
              padding: '7px 18px', 
              fontSize: '12.5px', 
              fontWeight: '900', 
              borderRadius: '9px', 
              border: 'none', 
              background: geoTab === 'state' ? 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' : 'transparent', 
              color: geoTab === 'state' ? '#ffffff' : '#64748b', 
              cursor: 'pointer', 
              boxShadow: geoTab === 'state' ? '0 4px 12px rgba(99, 102, 241, 0.35)' : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            🗺️ By State
          </button>
          <button
            type="button"
            onClick={() => setGeoTab('city')}
            style={{ 
              padding: '7px 18px', 
              fontSize: '12.5px', 
              fontWeight: '900', 
              borderRadius: '9px', 
              border: 'none', 
              background: geoTab === 'city' ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' : 'transparent', 
              color: geoTab === 'city' ? '#ffffff' : '#64748b', 
              cursor: 'pointer', 
              boxShadow: geoTab === 'city' ? '0 4px 12px rgba(168, 85, 247, 0.35)' : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            🏙️ By City
          </button>
        </div>

        {/* 2-COLUMN CONTENT LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '22px', alignItems: 'stretch' }}>
          
          {/* Left Column: 3D Breakdown Table */}
          <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', padding: '14px', boxShadow: '0 6px 18px -4px rgba(15, 23, 42, 0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: '#475569', textTransform: 'uppercase', fontSize: '11px', fontWeight: '900', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Rank &amp; Region</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Bookings</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Revenue</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Market Share</th>
                </tr>
              </thead>
              <tbody>
                {geoData.items.slice(0, 6).map((item, idx) => {
                  const sharePct = geoData.totalBookings > 0 ? Math.round((item.bookings / geoData.totalBookings) * 100) : 0;
                  const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                  const rankBg = idx === 0 ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : idx === 1 ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)' : idx === 2 ? 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)' : '#f1f5f9';
                  const rankBorder = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#f97316' : '#cbd5e1';

                  return (
                    <tr 
                      key={item.name} 
                      style={{ 
                        background: idx % 2 === 0 ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' : '#ffffff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        borderRadius: '10px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0f172a', borderRadius: '10px 0 0 10px', borderLeft: `3.5px solid ${rankBorder}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '900', padding: '3px 7px', borderRadius: '6px', background: rankBg, border: `1px solid ${rankBorder}`, color: '#1e293b', minWidth: '22px', textAlign: 'center' }}>
                            {rankMedal}
                          </span>
                          <span style={{ fontSize: '18px' }}>{item.flag}</span>
                          <span style={{ fontWeight: '800', color: '#0f172a' }}>{item.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '8px', fontWeight: '900', fontSize: '12.5px', border: '1px solid #bae6fd' }}>
                          {item.bookings} Bks
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '900', color: '#059669', fontSize: '13.5px' }}>
                        {formatUSD(item.revenue)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', borderRadius: '0 10px 10px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <span style={{ fontWeight: '800', color: '#475569', fontSize: '12px' }}>{sharePct}%</span>
                          <div style={{ width: '45px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${sharePct}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7 0%, #10b981 100%)', borderRadius: '3px' }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Total Footer Summary Bar (Light Grey / Executive Theme) */}
            <div style={{ marginTop: '12px', padding: '12px 16px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1.5px solid #cbd5e1', color: '#0f172a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 3px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ fontWeight: '900', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#0284c7' }}>📊 Total Volume</span>
                <span style={{ color: '#64748b' }}>({geoData.items.length} Active Regions)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginRight: '6px', fontWeight: '800' }}>Bookings:</span>
                  <span style={{ fontSize: '14px', fontWeight: '900', color: '#0284c7' }}>{geoData.totalBookings}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginRight: '6px', fontWeight: '800' }}>Revenue:</span>
                  <span style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{formatUSD(geoData.totalRevenue)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Wooden World Map Artwork (Exact Match to User Uploaded Photo with Pure White Background) */}
          <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -4px rgba(15, 23, 42, 0.05)', boxSizing: 'border-box', height: '100%', minHeight: '340px' }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '310px', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img 
                src="/wooden-world-map.png" 
                alt="3D Wooden World Map Artwork" 
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px', filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.18))' }} 
              />

              {/* Dynamic 3D Location Pulse Pins for Active Booking Markets */}
              {geoData.items.some(i => i.name.toLowerCase().includes('united states') || i.name.toLowerCase().includes('usa')) && (
                <div style={{ position: 'absolute', top: '44%', left: '26%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="United States Active Reservations">
                  <span style={{ position: 'absolute', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(2, 132, 199, 0.35)', animation: 'pulseGlow 1.8s infinite ease-in-out' }} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0284c7', border: '2px solid #ffffff', boxShadow: '0 0 10px rgba(2, 132, 199, 0.9)' }} />
                </div>
              )}

              {geoData.items.some(i => i.name.toLowerCase().includes('india') || i.name.toLowerCase().includes('gujarat') || i.name.toLowerCase().includes('ahmedabad') || i.name.toLowerCase().includes('mumbai')) && (
                <div style={{ position: 'absolute', top: '56%', left: '73%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="India Active Reservations">
                  <span style={{ position: 'absolute', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.4)', animation: 'pulseGlow 1.8s infinite ease-in-out' }} />
                  <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#10b981', border: '2px solid #ffffff', boxShadow: '0 0 10px rgba(16, 185, 129, 0.9)' }} />
                </div>
              )}

              {geoData.items.some(i => i.name.toLowerCase().includes('united kingdom') || i.name.toLowerCase().includes('uk')) && (
                <div style={{ position: 'absolute', top: '32%', left: '52%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="United Kingdom Active Reservations">
                  <span style={{ position: 'absolute', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.35)', animation: 'pulseGlow 1.8s infinite ease-in-out' }} />
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#6366f1', border: '2px solid #ffffff', boxShadow: '0 0 8px rgba(99, 102, 241, 0.9)' }} />
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ROW 3: RESERVATIONS & TASKS */}
      <div className="dash-grid-equal">
        
        {/* RESERVATIONS 3D ISOMETRIC PRISM CHART CARD (Electric Blue Theme) */}
        <div className="dash-card card-reservations card-3d-elevated">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <span className="card-header-icon icon-cyan"><CalendarIcon size={18} /></span>
              <h3 className="dash-card-title">Reservations</h3>
            </div>
            <select className="dash-select" value={resPeriod} onChange={(e) => setResPeriod(e.target.value)}>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          {/* Legend Item Badges: Booked, Canceled, No-Show */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '12px', fontWeight: '800', marginBottom: '14px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0369a1' }}>
              <span style={{ width: '10px', height: '10px', background: '#0284c7', borderRadius: '3px', boxShadow: '0 2px 4px rgba(2,132,199,0.35)' }} /> Booked
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#be123c' }}>
              <span style={{ width: '10px', height: '10px', background: '#e11d48', borderRadius: '3px', boxShadow: '0 2px 4px rgba(225,29,72,0.35)' }} /> Canceled
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#c2410c' }}>
              <span style={{ width: '10px', height: '10px', background: '#ea580c', borderRadius: '3px', boxShadow: '0 2px 4px rgba(234,88,12,0.35)' }} /> No-Show
            </span>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '185px', marginTop: '10px' }}>
            <svg viewBox="0 0 500 175" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                {/* Booked 3D Prisms */}
                <linearGradient id="resBookedFront" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
                <linearGradient id="resBookedSide" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0284c7" />
                  <stop offset="100%" stopColor="#0369a1" />
                </linearGradient>
                <linearGradient id="resBookedTop" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#bae6fd" />
                  <stop offset="100%" stopColor="#7dd3fc" />
                </linearGradient>

                {/* Canceled 3D Prisms */}
                <linearGradient id="resCanceledFront" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="100%" stopColor="#e11d48" />
                </linearGradient>
                <linearGradient id="resCanceledSide" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e11d48" />
                  <stop offset="100%" stopColor="#9f1239" />
                </linearGradient>
                <linearGradient id="resCanceledTop" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fecdd3" />
                  <stop offset="100%" stopColor="#fda4af" />
                </linearGradient>

                {/* No-Show 3D Prisms */}
                <linearGradient id="resNoShowFront" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
                <linearGradient id="resNoShowSide" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ea580c" />
                  <stop offset="100%" stopColor="#9a3412" />
                </linearGradient>
                <linearGradient id="resNoShowTop" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffedd5" />
                  <stop offset="100%" stopColor="#fed7aa" />
                </linearGradient>
              </defs>

              {/* Grid line at bottom base */}
              <line x1="0" y1="145" x2="500" y2="145" stroke="#cbd5e1" strokeWidth="1.5" />

              {/* 3D Grouped Prism Columns per Date */}
              {reservationsBarData.items.map((bar, idx) => {
                const itemCount = reservationsBarData.items.length;
                const xCenter = 35 + idx * ((500 - 70) / (itemCount - 1));
                const w = 8;
                const dx = 3;
                const dy = 3;

                const xBooked = xCenter - 14;
                const xCanceled = xCenter - 2;
                const xNoShow = xCenter + 10;

                const hBooked = Math.max(6, (bar.bookedCount / reservationsBarData.maxSingleDay) * 110);
                const yBooked = 145 - hBooked;

                const hCanceled = Math.max(6, (bar.canceledCount / reservationsBarData.maxSingleDay) * 110);
                const yCanceled = 145 - hCanceled;

                const hNoShow = Math.max(6, (bar.noShowCount / reservationsBarData.maxSingleDay) * 110);
                const yNoShow = 145 - hNoShow;

                return (
                  <g key={bar.date}>
                    {/* 1. BOOKED 3D PRISM */}
                    {bar.bookedCount > 0 ? (
                      <g title={`${bar.bookedCount} Booked`}>
                        <ellipse cx={xBooked + w / 2} cy="147" rx={w / 1.5} ry="3" fill="rgba(2, 132, 199, 0.25)" />
                        <rect x={xBooked} y={yBooked} width={w} height={hBooked} rx="2" fill="url(#resBookedFront)" />
                        <path d={`M ${xBooked + w} ${yBooked} L ${xBooked + w + dx} ${yBooked - dy} L ${xBooked + w + dx} ${yBooked + hBooked - dy} L ${xBooked + w} ${yBooked + hBooked} Z`} fill="url(#resBookedSide)" />
                        <path d={`M ${xBooked} ${yBooked} L ${xBooked + dx} ${yBooked - dy} L ${xBooked + w + dx} ${yBooked - dy} L ${xBooked + w} ${yBooked} Z`} fill="url(#resBookedTop)" />
                      </g>
                    ) : (
                      <line x1={xBooked} y1="145" x2={xBooked + w} y2="145" stroke="#e0f2fe" strokeWidth="3" rx="1.5" />
                    )}

                    {/* 2. CANCELED 3D PRISM */}
                    {bar.canceledCount > 0 ? (
                      <g title={`${bar.canceledCount} Canceled`}>
                        <ellipse cx={xCanceled + w / 2} cy="147" rx={w / 1.5} ry="3" fill="rgba(225, 29, 72, 0.25)" />
                        <rect x={xCanceled} y={yCanceled} width={w} height={hCanceled} rx="2" fill="url(#resCanceledFront)" />
                        <path d={`M ${xCanceled + w} ${yCanceled} L ${xCanceled + w + dx} ${yCanceled - dy} L ${xCanceled + w + dx} ${yCanceled + hCanceled - dy} L ${xCanceled + w} ${yCanceled + hCanceled} Z`} fill="url(#resCanceledSide)" />
                        <path d={`M ${xCanceled} ${yCanceled} L ${xCanceled + dx} ${yCanceled - dy} L ${xCanceled + w + dx} ${yCanceled - dy} L ${xCanceled + w} ${yCanceled} Z`} fill="url(#resCanceledTop)" />
                      </g>
                    ) : (
                      <line x1={xCanceled} y1="145" x2={xCanceled + w} y2="145" stroke="#ffe4e6" strokeWidth="3" rx="1.5" />
                    )}

                    {/* 3. NO-SHOW 3D PRISM */}
                    {bar.noShowCount > 0 ? (
                      <g title={`${bar.noShowCount} No-Show`}>
                        <ellipse cx={xNoShow + w / 2} cy="147" rx={w / 1.5} ry="3" fill="rgba(234, 88, 12, 0.25)" />
                        <rect x={xNoShow} y={yNoShow} width={w} height={hNoShow} rx="2" fill="url(#resNoShowFront)" />
                        <path d={`M ${xNoShow + w} ${yNoShow} L ${xNoShow + w + dx} ${yNoShow - dy} L ${xNoShow + w + dx} ${yNoShow + hNoShow - dy} L ${xNoShow + w} ${yNoShow + hNoShow} Z`} fill="url(#resNoShowSide)" />
                        <path d={`M ${xNoShow} ${yNoShow} L ${xNoShow + dx} ${yNoShow - dy} L ${xNoShow + w + dx} ${yNoShow - dy} L ${xNoShow + w} ${yNoShow} Z`} fill="url(#resNoShowTop)" />
                      </g>
                    ) : (
                      <line x1={xNoShow} y1="145" x2={xNoShow + w} y2="145" stroke="#ffedd5" strokeWidth="3" rx="1.5" />
                    )}

                    {/* Date Label */}
                    <text x={xCenter} y="165" textAnchor="middle" fontSize="10.5" fill="#64748b" fontWeight="800">{bar.date}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* TASKS CARD WITH FUNCTIONAL DELETE BUTTON (Rose Magenta Theme) */}
        <div className="dash-card card-tasks card-3d-elevated">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <span className="card-header-icon icon-rose"><CheckSquare size={18} /></span>
              <h3 className="dash-card-title">Tasks</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddTaskModal(true)}
              className="dash-add-task-btn"
              title="Add Task"
            >
              +
            </button>
          </div>

          <div className="task-timeline">
            {combinedTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                <CheckCircle2 size={32} style={{ opacity: 0.35, marginBottom: '8px', color: '#e11d48' }} />
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#334155' }}>No Tasks Added Yet</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Click <strong>+</strong> above to add custom operational tasks for your staff.
                </div>
              </div>
            ) : (
              combinedTasks.map((t) => (
                <div key={t.id} className="task-item">
                  
                  {/* Styled Checkbox */}
                  <button
                    type="button"
                    className={`task-check-btn ${t.completed ? 'checked' : ''}`}
                    onClick={() => toggleTaskCompleted(t.id)}
                    title={t.completed ? "Mark as Incomplete" : "Mark as Completed"}
                  >
                    {t.completed && <CheckCircle2 size={16} color="#ffffff" />}
                  </button>

                  {/* Task Content Card */}
                  <div className={`task-card ${t.style} ${t.completed ? 'completed' : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="task-date">{t.date}</span>
                      
                      {/* Delete Task Action Button */}
                      {!t.isSystem && (
                        <button
                          type="button"
                          onClick={() => deleteTask(t.id)}
                          className="task-delete-btn"
                          title="Delete Task"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="task-title">{t.title}</div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ROW 4: ROOMS OCCUPIED VS DATE FULL-WIDTH 3D ISOMETRIC PRISM CHART (Royal Indigo Theme) */}
      <div className="dash-card card-trend card-3d-elevated" style={{ marginBottom: '0' }}>
        <div className="dash-card-header">
          <div className="dash-card-title-group">
            <span className="card-header-icon icon-indigo"><Activity size={18} /></span>
            <div>
              <h3 className="dash-card-title">Rooms Occupied vs Date</h3>
              <span style={{ fontSize: '11.5px', color: '#4f46e5', fontWeight: '700' }}>
                {occupiedTrendMode === 'daily' ? 'Last 30 days — real-time occupied rooms count per day' : 'Monthly trend breakdown across current business year'}
              </span>
            </div>
          </div>

          <div className="dash-pill-group">
            <button
              type="button"
              className={`dash-pill-btn ${occupiedTrendMode === 'daily' ? 'active' : ''}`}
              onClick={() => {
                setOccupiedTrendMode('daily');
                setHoveredTrendIdx(null);
              }}
            >
              Daily 30D
            </button>
            <button
              type="button"
              className={`dash-pill-btn ${occupiedTrendMode === 'monthly' ? 'active' : ''}`}
              onClick={() => {
                setOccupiedTrendMode('monthly');
                setHoveredTrendIdx(null);
              }}
            >
              Monthly
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', height: '240px', marginTop: '16px' }}>
          <svg viewBox="0 0 1000 240" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            
            <defs>
              {/* 3D Front Face Gradient */}
              <linearGradient id="indigoFrontGrad3D" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>

              {/* 3D Side Facet Dark Gradient */}
              <linearGradient id="indigoSideGrad3D" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4338ca" />
                <stop offset="100%" stopColor="#312e81" />
              </linearGradient>

              {/* 3D Top Cap Bright Highlight */}
              <linearGradient id="indigoTopGrad3D" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#c7d2fe" />
                <stop offset="100%" stopColor="#a5b4fc" />
              </linearGradient>

              <filter id="indigoGlow3D" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#6366f1" floodOpacity="0.55" />
              </filter>
            </defs>

            {/* Grid Lines */}
            <line x1="0" y1="30" x2="1000" y2="30" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="0" y1="75" x2="1000" y2="75" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="0" y1="120" x2="1000" y2="120" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="0" y1="165" x2="1000" y2="165" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="0" y1="200" x2="1000" y2="200" stroke="#cbd5e1" strokeWidth="1.5" />

            {/* Y-Axis Metric Labels */}
            <text x="-15" y="34" fontSize="11" fill="#94a3b8" fontWeight="700">{maxOccupiedVal}</text>
            <text x="-15" y="79" fontSize="11" fill="#94a3b8" fontWeight="700">{Math.round(maxOccupiedVal * 0.75)}</text>
            <text x="-15" y="124" fontSize="11" fill="#94a3b8" fontWeight="700">{Math.round(maxOccupiedVal * 0.50)}</text>
            <text x="-15" y="169" fontSize="11" fill="#94a3b8" fontWeight="700">{Math.round(maxOccupiedVal * 0.25)}</text>
            <text x="-15" y="204" fontSize="11" fill="#94a3b8" fontWeight="700">0</text>

            {/* 3D ISOMETRIC PRISM COLUMNS FOR ROOMS OCCUPIED */}
            {occupiedTrendDatasets.map((pt, idx) => {
              const xCenter = 50 + idx * ((1000 - 100) / (occupiedTrendDatasets.length - 1));
              const w = occupiedTrendMode === 'daily' ? 22 : 32;
              const dx = 6;
              const dy = 6;
              const x = xCenter - (w + dx) / 2;
              const height = Math.max(8, (pt.count / maxOccupiedVal) * 155);
              const y = 200 - height;
              const isHovered = hoveredTrendIdx === idx;

              return (
                <g
                  key={`${pt.date}-${idx}`}
                  onMouseEnter={() => setHoveredTrendIdx(idx)}
                  onMouseLeave={() => setHoveredTrendIdx(null)}
                  style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
                  filter={isHovered ? "url(#indigoGlow3D)" : undefined}
                >
                  {/* Base Drop Shadow */}
                  <ellipse
                    cx={xCenter}
                    cy="202"
                    rx={w / 1.5}
                    ry="4"
                    fill="rgba(15, 23, 42, 0.15)"
                  />

                  {/* Pillar Track Frame */}
                  <rect
                    x={x}
                    y="30"
                    width={w}
                    height="170"
                    rx="4"
                    fill="#f8fafc"
                    stroke="#f1f5f9"
                    strokeWidth="1"
                  />

                  {/* 1. FRONT FACE */}
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={height}
                    rx="3"
                    fill="url(#indigoFrontGrad3D)"
                  />

                  {/* 2. RIGHT SIDE FACET (Perspective 3D Depth) */}
                  <path
                    d={`M ${x + w} ${y} L ${x + w + dx} ${y - dy} L ${x + w + dx} ${y + height - dy} L ${x + w} ${y + height} Z`}
                    fill="url(#indigoSideGrad3D)"
                  />

                  {/* 3. TOP CAP FACET (Perspective 3D Top Cap) */}
                  <path
                    d={`M ${x} ${y} L ${x + dx} ${y - dy} L ${x + w + dx} ${y - dy} L ${x + w} ${y} Z`}
                    fill="url(#indigoTopGrad3D)"
                  />

                  {/* Count text floating on top of 3D Prism when > 0 */}
                  {pt.count > 0 && (
                    <text
                      x={xCenter + dx / 2}
                      y={Math.max(22, y - dy - 6)}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="900"
                      fill={isHovered ? "#312e81" : "#4f46e5"}
                    >
                      {pt.count}
                    </text>
                  )}

                  {/* X-Axis Date Label */}
                  <text
                    x={xCenter}
                    y="222"
                    textAnchor="middle"
                    fontSize="10.5"
                    fill={isHovered ? "#4338ca" : "#64748b"}
                    fontWeight={isHovered ? "900" : "700"}
                  >
                    {pt.date}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Trend Tooltip */}
          {hoveredTrendIdx !== null && occupiedTrendDatasets[hoveredTrendIdx] && (
            <div
              className="chart-tooltip"
              style={{
                left: `${((50 + hoveredTrendIdx * ((1000 - 100) / (occupiedTrendDatasets.length - 1))) / 1000) * 100}%`,
                top: `${((200 - Math.max(8, (occupiedTrendDatasets[hoveredTrendIdx].count / maxOccupiedVal) * 155)) / 240) * 100}%`
              }}
            >
              <div className="chart-tooltip-label">{occupiedTrendDatasets[hoveredTrendIdx].date}</div>
              <div className="chart-tooltip-val">{occupiedTrendDatasets[hoveredTrendIdx].count} Rooms Occupied</div>
            </div>
          )}
        </div>
      </div>

      {/* ➕ ADD TASK MODAL */}
      {showAddTaskModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '460px', width: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(15,23,42,0.3)', border: '1px solid #e2e8f0', animation: 'fadeInUp 0.25s ease-out' }}>
            <div style={{ padding: '18px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>➕ Add New Hotel Operation Task</h3>
              <button type="button" onClick={() => setShowAddTaskModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>
            <form onSubmit={handleAddNewTask} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Task Title &amp; Description *</label>
                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="e.g. Inspect Room 204 AC unit" required style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Scheduled Date Header</label>
                <input type="text" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} placeholder="e.g. June 21, 2028" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddTaskModal(false)} className="dash-btn-secondary">Cancel</button>
                <button type="submit" className="dash-btn-primary">Add Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
