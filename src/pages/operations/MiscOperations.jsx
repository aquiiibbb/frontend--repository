import { dataStore } from "../../services/dataStore";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Trash2,
  Download,
  Plus,
  Minus,
  CheckCircle2
} from 'lucide-react';
import { getBookings, addExtra } from '../../services/api';
import { getHotelProfile, generateNextSequence, getTransactionCategories, addCustomTransactionCategory, getBusinessDate } from '../../services/hotelConfig';
import CustomCalendarPopover from '../../components/CustomCalendarPopover';
import { usePMS } from '../../context/PMSContext';
import './MiscOperations.css';

export const SALE_CATEGORIES = getTransactionCategories().sale;
export const EXPENSE_CATEGORIES = getTransactionCategories().expense;

export default function MiscOperations() {
  const { confirmAction } = usePMS();
  const getTodayStr = () => getBusinessDate();

  const [hotelProfile, setHotelProfile] = useState(() => getHotelProfile());
  const [configuredCategories, setConfiguredCategories] = useState(() => getTransactionCategories());
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = dataStore.getItem('pms_misc_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out old legacy hardcoded dummy records if present
          return parsed.filter(t => t && t.id !== 'MSC-1001' && t.id !== 'MSC-1002' && t.id !== 'MSC-1003');
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  // Calendar State & Popover Positioning
  const [selectedDate, setSelectedDate] = useState(() => getBusinessDate());
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const iconBtnRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, SALE, EXPENSE

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [txType, setTxType] = useState('SALE');
  const [txDate, setTxDate] = useState(() => getBusinessDate());
  const [category, setCategory] = useState(() => getTransactionCategories().sale[0] || 'Misc / Other');
  const [itemName, setItemName] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [settlementMethod, setSettlementMethod] = useState('Cash');
  const [selectedRoomResCode, setSelectedRoomResCode] = useState('');
  const [activeBookings, setActiveBookings] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeCategoryList = useMemo(() => {
    return txType === 'SALE' ? configuredCategories.sale : configuredCategories.expense;
  }, [txType, configuredCategories]);

  const currencySymbol = useMemo(() => {
    const cur = hotelProfile?.currency || 'US Dollar ($)';
    if (cur.includes('€') || cur.toLowerCase().includes('euro')) return '€';
    if (cur.includes('£') || cur.toLowerCase().includes('pound')) return '£';
    if (cur.includes('₹') || cur.toLowerCase().includes('inr') || cur.toLowerCase().includes('rupee')) return '₹';
    return '$';
  }, [hotelProfile]);

  const reloadTransactionsFromStorage = () => {
    try {
      const saved = dataStore.getItem('pms_misc_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setTransactions(parsed.filter(t => t && t.id !== 'MSC-1001' && t.id !== 'MSC-1002' && t.id !== 'MSC-1003'));
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    function updateProfileAndCategories() {
      setHotelProfile(getHotelProfile());
      setConfiguredCategories(getTransactionCategories());
      setSelectedDate((prev) => prev || getBusinessDate());
    }
    window.addEventListener('pms_hotel_profile_updated', updateProfileAndCategories);
    window.addEventListener('pms_categories_updated', updateProfileAndCategories);
    window.addEventListener('pms_business_date_updated', updateProfileAndCategories);
    window.addEventListener('pms_misc_transactions_updated', reloadTransactionsFromStorage);
    window.addEventListener('storage', reloadTransactionsFromStorage);
    return () => {
      window.removeEventListener('pms_hotel_profile_updated', updateProfileAndCategories);
      window.removeEventListener('pms_categories_updated', updateProfileAndCategories);
      window.removeEventListener('pms_business_date_updated', updateProfileAndCategories);
      window.removeEventListener('pms_misc_transactions_updated', reloadTransactionsFromStorage);
      window.removeEventListener('storage', reloadTransactionsFromStorage);
    };
  }, []);

  // Save clean transactions to the data store
  useEffect(() => {
    try {
      const cleanList = transactions.filter(t => t && t.id !== 'MSC-1001' && t.id !== 'MSC-1002' && t.id !== 'MSC-1003');
      dataStore.setItem('pms_misc_transactions', JSON.stringify(cleanList));
    } catch (e) {}
  }, [transactions]);

  // Load Active Checked-In Bookings for Room Charge Settlement
  const fetchActiveBookings = async () => {
    try {
      const allRes = (await getBookings()) || [];
      const checkedIn = allRes.filter((b) => {
        if (!b || b.status === 'cancelled' || b.isDeleted) return false;
        const s = String(b.status || '').toLowerCase();
        return s === 'checked-in' || s === 'checkedin' || s === 'occupied' || s === 'confirmed';
      });
      setActiveBookings(checkedIn);
      if (checkedIn.length > 0 && !selectedRoomResCode) {
        setSelectedRoomResCode(checkedIn[0].id || checkedIn[0].resCode);
      }
    } catch (e) {
      setActiveBookings([]);
    }
  };

  useEffect(() => {
    fetchActiveBookings();
    window.addEventListener('pms_bookings_updated', fetchActiveBookings);
    return () => window.removeEventListener('pms_bookings_updated', fetchActiveBookings);
  }, []);

  // Calendar Icon Click Handler
  const handleOpenDatePicker = (e) => {
    if (e) e.stopPropagation();
    if (!showCalendarPopover && iconBtnRef.current) {
      const rect = iconBtnRef.current.getBoundingClientRect();
      let top = rect.bottom + 8;
      let left = rect.left;
      if (left + 260 > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - 260 - 12);
      }
      setPopoverPos({ top, left });
    }
    setShowCalendarPopover((prev) => !prev);
  };

  const openAddModal = (type) => {
    setTxType(type);
    setTxDate(selectedDate || getBusinessDate());
    const cats = type === 'SALE' ? configuredCategories.sale : configuredCategories.expense;
    setCategory(cats[0] || 'Misc / Other');
    setIsCustomCategoryMode(false);
    setCustomCategoryInput('');
    setItemName('');
    setAmountUSD('');
    setSettlementMethod('Cash');
    fetchActiveBookings();
    setShowModal(true);
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!itemName.trim() || !amountUSD || parseFloat(amountUSD) <= 0) {
      alert('Please enter a valid Item Name and Amount.');
      return;
    }

    let finalCategory = category;
    if (isCustomCategoryMode) {
      if (!customCategoryInput.trim()) {
        alert('Please enter your custom category name.');
        return;
      }
      finalCategory = customCategoryInput.trim();
      addCustomTransactionCategory(txType, finalCategory);
    }

    const valAmount = Math.abs(parseFloat(amountUSD));
    let roomNumber = 'N/A';
    let guestName = 'N/A';
    let targetBookingId = null;

    setIsSubmitting(true);

    try {
      if (txType === 'SALE' && settlementMethod === 'Room Charge') {
        const targetRes = activeBookings.find((b) => String(b.id || b.resCode) === String(selectedRoomResCode));
        if (!targetRes) {
          alert('Please select an active guest room for Room Charge settlement.');
          setIsSubmitting(false);
          return;
        }

        targetBookingId = targetRes.id || targetRes.resCode;
        roomNumber = `Room ${targetRes.roomNumber || targetRes.room || 'N/A'}`;
        guestName = targetRes.guestName || targetRes.guest || 'Guest';

        // Post extra charge to PMS Folio
        await addExtra(targetBookingId, {
          label: itemName.trim(),
          amount: valAmount
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pms_bookings_updated'));
        }
      }

      // Generate sequence ID dynamically configured in Configuration Panel
      const seqId = generateNextSequence('misc', true);
      const targetDateStr = String(txDate || selectedDate || getBusinessDate()).slice(0, 10);

      const newTx = {
        id: seqId,
        date: targetDateStr,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: txType,
        category: finalCategory || (txType === 'SALE' ? 'Misc Sale' : 'Misc Expense'),
        itemName: itemName.trim(),
        amountUSD: valAmount,
        settlement: settlementMethod,
        roomNumber,
        guestName: txType === 'SALE' ? guestName : 'N/A',
        bookingId: targetBookingId
      };

      const currentList = (() => {
        try {
          const raw = dataStore.getItem('pms_misc_transactions');
          return raw ? JSON.parse(raw) : transactions;
        } catch (e) {
          return transactions;
        }
      })();

      const updatedList = [newTx, ...currentList.filter(t => t && t.id !== newTx.id)];
      dataStore.setItem('pms_misc_transactions', JSON.stringify(updatedList));
      setTransactions(updatedList);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pms_misc_transactions_updated'));
      }

      setSelectedDate(targetDateStr);

      setShowModal(false);
      setItemName('');
      setAmountUSD('');

      const msg = txType === 'SALE' && settlementMethod === 'Room Charge'
        ? `Posted ${currencySymbol}${valAmount.toFixed(2)} to ${roomNumber} (${guestName}) [${seqId}].`
        : `${txType === 'SALE' ? 'Sale' : 'Expense'} record ${seqId} saved successfully.`;

      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(`Error posting transaction: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = (id) => {
    const txToDelete = transactions.find((t) => t && t.id === id);
    const txName = txToDelete?.itemName || txToDelete?.category || 'Transaction Record';
    const txAmount = txToDelete?.amountUSD || txToDelete?.amount || 0;
    const txType = txToDelete?.type || 'Transaction';

    confirmAction({
      title: "Delete Transaction Record",
      message: `Are you sure you want to delete this ${txType} record?`,
      details: [
        { label: "Ref ID", value: id },
        { label: "Item Name", value: txName },
        { label: "Type / Category", value: `${txType} (${txToDelete?.category || 'General'})` },
        { label: "Amount", value: `$${Number(txAmount).toFixed(2)}` }
      ],
      confirmText: "Yes, Delete Record",
      variant: "danger",
      executionTitle: "Transaction Record Deleted",
      executionMessage: `Transaction record '${txName}' ($${Number(txAmount).toFixed(2)}) has been deleted.`,
      onConfirm: () => {
        const updatedList = transactions.filter((t) => t && t.id !== id);
        dataStore.setItem('pms_misc_transactions', JSON.stringify(updatedList));
        setTransactions(updatedList);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pms_misc_transactions_updated'));
        }
      }
    });
  };

  // Filtered List
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!t) return false;
      const tDate = String(t.date || '').slice(0, 10);
      const sDate = String(selectedDate || '').slice(0, 10);
      const matchesDate = !selectedDate || tDate === sDate;
      const matchesType = typeFilter === 'ALL' || String(t.type || '').toUpperCase() === typeFilter;
      const query = searchQuery.toLowerCase().trim();
      const catStr = String(t.category || '').toLowerCase();
      const itemStr = String(t.itemName || '').toLowerCase();
      const idStr = String(t.id || '').toLowerCase();
      const settleStr = String(t.settlement || '').toLowerCase();
      const roomStr = String(t.roomNumber || '').toLowerCase();

      const matchesQuery = !query ||
        itemStr.includes(query) ||
        idStr.includes(query) ||
        catStr.includes(query) ||
        settleStr.includes(query) ||
        roomStr.includes(query);

      return matchesDate && matchesType && matchesQuery;
    });
  }, [transactions, selectedDate, typeFilter, searchQuery]);

  const handleExportCSV = () => {
    const headers = ['Ref ID', 'Date', 'Time', 'Type / Category', 'Item Name', 'Amount', 'Settlement', 'Room / Guest'];
    const rows = filteredTransactions.map((t) => [
      t.id,
      t.date,
      t.time,
      `"${t.category || t.type}"`,
      `"${t.itemName}"`,
      t.amountUSD,
      `"${t.settlement}"`,
      `"${t.roomNumber !== 'N/A' ? `${t.roomNumber} (${t.guestName})` : 'N/A'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Misc_Journal_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="misc-page">
      {/* Sleek Top Header & Action Buttons */}
      <div className="misc-header-bar">
        <div className="misc-header-title-group" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 className="misc-title">Misc</h1>

          {/* EXACT PURE SVG CALENDAR ICON BUTTON MATCHING DAILY ACTIVITIES LIST */}
          <button
            ref={iconBtnRef}
            type="button"
            className="act-pure-icon-btn"
            onClick={handleOpenDatePicker}
            title={`Selected Date: ${selectedDate}`}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
          >
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="10" width="36" height="32" rx="6" fill="#FFFFFF" stroke="#475569" strokeWidth="2.5" />
              <path d="M6 16C6 12.6863 8.68629 10 12 10H36C39.3137 10 42 12.6863 42 16V18H6V16Z" fill="#EF4444" />
              <rect x="14" y="6" width="4" height="8" rx="2" fill="#1E293B" />
              <rect x="30" y="6" width="4" height="8" rx="2" fill="#1E293B" />
              <circle cx="14" cy="25" r="2.5" fill="#1E293B" />
              <circle cx="24" cy="25" r="2.5" fill="#1E293B" />
              <circle cx="34" cy="25" r="2.5" fill="#1E293B" />
              <circle cx="14" cy="33" r="2.5" fill="#1E293B" />
              <circle cx="24" cy="33" r="2.5" fill="#1E293B" />
              <circle cx="34" cy="33" r="2.5" fill="#1E293B" />
            </svg>
          </button>
        </div>

        <div className="misc-header-actions">
          {successMsg && (
            <span className="misc-toast-badge">
              <CheckCircle2 size={15} /> {successMsg}
            </span>
          )}

          <button className="misc-btn misc-btn-dark" onClick={() => openAddModal('SALE')}>
            <Plus size={15} /> Add Sale
          </button>
          <button className="misc-btn misc-btn-outline" onClick={() => openAddModal('EXPENSE')}>
            <Minus size={15} /> Add Expense
          </button>
        </div>
      </div>

      {/* Slim Filter Row */}
      <div className="misc-filter-row">
        <div className="misc-search-box">
          <Search size={15} className="misc-search-icon" />
          <input
            type="text"
            placeholder="Search item, ref id, room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="misc-search-input"
          />
        </div>

        <div className="misc-right-filters">
          <div className="misc-type-pills">
            <button
              className={`misc-pill ${typeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setTypeFilter('ALL')}
            >
              All
            </button>
            <button
              className={`misc-pill ${typeFilter === 'SALE' ? 'active' : ''}`}
              onClick={() => setTypeFilter('SALE')}
            >
              Sales
            </button>
            <button
              className={`misc-pill ${typeFilter === 'EXPENSE' ? 'active' : ''}`}
              onClick={() => setTypeFilter('EXPENSE')}
            >
              Expenses
            </button>
          </div>

          <button className="misc-btn misc-btn-outline" onClick={handleExportCSV} title="Export CSV">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Journal Table (Configured Sequence REF ID Column Included) */}
      <div className="misc-table-card">
        <table className="misc-table">
          <thead>
            <tr>
              <th>REF ID</th>
              <th>TIME</th>
              <th>TYPE / CATEGORY</th>
              <th>ITEM NAME / DESCRIPTION</th>
              <th>SETTLEMENT</th>
              <th>ROOM / GUEST DETAILS</th>
              <th className="text-right">AMOUNT ({currencySymbol})</th>
              <th className="text-center">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="misc-empty-state">
                  No miscellaneous transactions logged for {selectedDate}.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((t) => (
                <tr key={t.id}>
                  <td className="misc-ref-code">{t.id}</td>
                  <td className="misc-time-text">{t.time}</td>
                  <td>
                    <span className="misc-type-badge">
                      {t.category || (t.type === 'SALE' ? 'Misc Sale' : 'Misc Expense')}
                    </span>
                  </td>
                  <td className="misc-item-name">
                    <strong>{t.itemName}</strong>
                  </td>
                  <td className="misc-settle-text">{t.settlement}</td>
                  <td className="misc-room-text">
                    {t.roomNumber !== 'N/A' ? `${t.roomNumber} (${t.guestName})` : '—'}
                  </td>
                  <td className="misc-amount-text text-right">
                    {t.type === 'SALE' ? '+' : '-'}{currencySymbol} {Number(t.amountUSD).toFixed(2)}
                  </td>
                  <td className="text-center">
                    <button
                      className="misc-action-btn"
                      onClick={() => handleDeleteTransaction(t.id)}
                      title="Delete Record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CALENDAR POPOVER PORTAL */}
      {showCalendarPopover &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              zIndex: 9999999,
            }}
          >
            <CustomCalendarPopover
              selectedDate={selectedDate}
              onSelectDate={(newDate) => {
                setSelectedDate(newDate);
                setShowCalendarPopover(false);
              }}
              onClose={() => setShowCalendarPopover(false)}
              todayISO={getTodayStr()}
            />
          </div>,
          document.body
        )}

      {/* SIMPLE TRANSACTION MODAL WITH CATEGORY SELECTOR */}
      {showModal && (
        <div className="misc-modal-backdrop" >
          <div className="misc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="misc-modal-header">
              <h3>{txType === 'SALE' ? 'Add Daily Sale' : 'Add Expense'}</h3>
              <button className="misc-modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSaveTransaction}>
              <div className="misc-modal-body">
                {/* Type Selector */}
                <div className="misc-modal-type-toggle">
                  <button
                    type="button"
                    className={`toggle-btn ${txType === 'SALE' ? 'active' : ''}`}
                    onClick={() => {
                      setTxType('SALE');
                      setCategory(configuredCategories.sale[0] || 'Misc / Other');
                      setIsCustomCategoryMode(false);
                    }}
                  >
                    Sale
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${txType === 'EXPENSE' ? 'active' : ''}`}
                    onClick={() => {
                      setTxType('EXPENSE');
                      setCategory(configuredCategories.expense[0] || 'Misc / Other');
                      setIsCustomCategoryMode(false);
                    }}
                  >
                    Expense
                  </button>
                </div>

                {/* Transaction Date */}
                <div className="misc-form-group">
                  <label>Transaction Date</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    required
                  />
                </div>

                {/* Step 1: Category / Transaction Type */}
                <div className="misc-form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Category / Transaction Type</span>
                    {!isCustomCategoryMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategoryMode(true);
                          setCustomCategoryInput('');
                        }}
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                      >
                        + Add Custom Category
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategoryMode(false);
                          setCategory(activeCategoryList[0] || 'Misc / Other');
                        }}
                        style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                      >
                        ← Select Configured List
                      </button>
                    )}
                  </label>

                  {!isCustomCategoryMode ? (
                    <select
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setIsCustomCategoryMode(true);
                          setCustomCategoryInput('');
                        } else {
                          setCategory(e.target.value);
                        }
                      }}
                    >
                      {activeCategoryList.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__ADD_NEW__">+ Type Custom Category...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Type custom category name (e.g. Spa & Wellness, Coffee Bar)..."
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      autoFocus
                      required
                    />
                  )}
                </div>

                {/* Step 2: Item Name */}
                <div className="misc-form-group">
                  <label>Item Name / Description</label>
                  <input
                    type="text"
                    placeholder={txType === 'SALE' ? 'e.g. Water Bottle, Parking Pass' : 'e.g. Cleaning Supplies, Plumber Fee'}
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                {/* Step 3: Amount */}
                <div className="misc-form-group">
                  <label>Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amountUSD}
                    onChange={(e) => setAmountUSD(e.target.value)}
                    required
                  />
                </div>

                {/* Step 4: Settlement */}
                <div className="misc-form-group">
                  <label>Settlement Method</label>
                  <select
                    value={settlementMethod}
                    onChange={(e) => setSettlementMethod(e.target.value)}
                  >
                    {txType === 'SALE' ? (
                      <>
                        <option value="Cash">Cash</option>
                        <option value="Credit / Debit Card">Credit / Debit Card</option>
                        <option value="Online / UPI">Online / UPI</option>
                        <option value="Room Charge">Room Charge (Post to Folio)</option>
                      </>
                    ) : (
                      <>
                        <option value="Cash">Cash</option>
                        <option value="Company Card">Company Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Out-of-Pocket">Manager Out-of-Pocket</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Room Select if Room Charge */}
                {txType === 'SALE' && settlementMethod === 'Room Charge' && (
                  <div className="misc-form-group">
                    <label>Select Active Checked-In Guest Room</label>
                    {activeBookings.length === 0 ? (
                      <p className="misc-warn-text">No active checked-in rooms found. Select Cash or Card.</p>
                    ) : (
                      <select
                        value={selectedRoomResCode}
                        onChange={(e) => setSelectedRoomResCode(e.target.value)}
                      >
                        {activeBookings.map((b) => (
                          <option key={b.id || b.resCode} value={b.id || b.resCode}>
                            Room {b.roomNumber || b.room || 'N/A'} — {b.guestName || b.guest} ({b.id || b.resCode})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              <div className="misc-modal-footer">
                <button type="button" className="misc-btn misc-btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="misc-btn misc-btn-dark" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
