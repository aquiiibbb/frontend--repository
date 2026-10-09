import { dataStore } from "../../services/dataStore";
import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  PlusCircle,
  Calendar,
  Filter,
  Download,
  Trash2,
  Search,
  Receipt,
  Tag,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Building
} from 'lucide-react';
import { getTransactionCategories, addCustomTransactionCategory } from '../../services/hotelConfig';
import { usePMS } from '../../context/PMSContext';
import './DailyExpenses.css';
import CustomDatePicker from '../../components/CustomDatePicker';

const DEFAULT_CATEGORIES = getTransactionCategories().expense;

const PAYMENT_METHODS = [
  'Cash',
  'Company Credit Card',
  'Bank / Online Transfer',
  'Manager Out-of-Pocket (Reimburse)'
];

const INITIAL_EXPENSES = [
  {
    id: 'EXP-1001',
    date: new Date().toISOString().split('T')[0],
    time: '09:15 AM',
    category: 'Housekeeping & Cleaning',
    description: 'Bulk Laundry Detergent & Disinfectant Spray',
    amountUSD: 45.50,
    paymentMethod: 'Cash',
    vendor: 'Walmart Supercenter',
    staffId: 'Front Desk (#FD-104)',
    notes: 'Restocked housekeeping supply closet'
  },
  {
    id: 'EXP-1002',
    date: new Date().toISOString().split('T')[0],
    time: '11:40 AM',
    category: 'Maintenance & Repairs',
    description: '10x LED Bulbs & Plumbing Seal Tape',
    amountUSD: 32.00,
    paymentMethod: 'Company Credit Card',
    vendor: 'Home Depot',
    staffId: 'Maintenance (#M-02)',
    notes: 'Replaced halogen bulbs in Room 204'
  },
  {
    id: 'EXP-1003',
    date: new Date().toISOString().split('T')[0],
    time: '02:10 PM',
    category: 'F&B / Coffee & Snacks',
    description: 'Fresh Coffee Beans & Milk Cartons',
    amountUSD: 28.75,
    paymentMethod: 'Cash',
    vendor: 'Local Roasters',
    staffId: 'Front Desk (#FD-104)',
    notes: 'Lobby coffee station refill'
  }
];

export default function DailyExpenses() {
  const { confirmAction } = usePMS();
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [expenses, setExpenses] = useState(() => {
    try {
      const saved = dataStore.getItem('pms_daily_expenses');
      return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
    } catch (e) {
      return INITIAL_EXPENSES;
    }
  });

  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    date: getTodayStr(),
    category: DEFAULT_CATEGORIES[0],
    customCategory: '',
    description: '',
    amountUSD: '',
    paymentMethod: PAYMENT_METHODS[0],
    vendor: '',
    staffId: 'Front Desk (#FD-104)',
    notes: ''
  });

  useEffect(() => {
    try {
      dataStore.setItem('pms_daily_expenses', JSON.stringify(expenses));
    } catch (e) {}
  }, [expenses]);

  const handleDateChange = (offsetDays) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offsetDays);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    const finalCategory = formData.category === 'Misc / Other' && formData.customCategory.trim()
      ? formData.customCategory.trim()
      : formData.category;

    if (finalCategory) {
      addCustomTransactionCategory('expense', finalCategory);
    }

    const newExpense = {
      id: `EXP-${Date.now().toString().slice(-6)}`,
      date: formData.date || getTodayStr(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: finalCategory,
      description: formData.description.trim() || 'Daily Operational Expense',
      amountUSD: Math.abs(parseFloat(formData.amountUSD) || 0),
      paymentMethod: formData.paymentMethod,
      vendor: formData.vendor.trim() || 'General Vendor',
      staffId: formData.staffId || 'Front Desk',
      notes: formData.notes.trim()
    };

    setExpenses([newExpense, ...expenses]);
    setShowAddModal(false);
    setFormData({
      date: getTodayStr(),
      category: DEFAULT_CATEGORIES[0],
      customCategory: '',
      description: '',
      amountUSD: '',
      paymentMethod: PAYMENT_METHODS[0],
      vendor: '',
      staffId: 'Front Desk (#FD-104)',
      notes: ''
    });
  };

  const handleDeleteExpense = (id) => {
    const expToDelete = expenses.find((exp) => exp.id === id);
    const expDesc = expToDelete?.description || expToDelete?.category || 'Expense Record';
    const expAmount = expToDelete?.amountUSD || 0;

    confirmAction({
      title: "Delete Expense Record",
      message: `Are you sure you want to delete this operational expense record?`,
      details: [
        { label: "Expense ID", value: id },
        { label: "Description", value: expDesc },
        { label: "Category", value: expToDelete?.category || 'General' },
        { label: "Amount", value: `$${Number(expAmount).toFixed(2)}` }
      ],
      confirmText: "Yes, Delete Expense",
      variant: "danger",
      executionTitle: "Expense Deleted",
      executionMessage: `Expense record '${expDesc}' ($${Number(expAmount).toFixed(2)}) has been deleted.`,
      onConfirm: () => {
        setExpenses(expenses.filter((exp) => exp.id !== id));
      }
    });
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Time', 'Category', 'Description', 'Amount USD', 'Payment Method', 'Vendor', 'Staff ID', 'Notes'];
    const rows = filteredExpenses.map(e => [
      e.id,
      e.date,
      e.time,
      `"${e.category}"`,
      `"${e.description}"`,
      e.amountUSD,
      `"${e.paymentMethod}"`,
      `"${e.vendor}"`,
      `"${e.staffId}"`,
      `"${e.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Daily_Expenses_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesDate = exp.date === selectedDate;
      const matchesCategory = categoryFilter === 'ALL' || exp.category === categoryFilter;
      const matchesPayment = paymentFilter === 'ALL' || exp.paymentMethod === paymentFilter;
      const query = searchQuery.toLowerCase();
      const matchesQuery = !query ||
        exp.description.toLowerCase().includes(query) ||
        exp.vendor.toLowerCase().includes(query) ||
        exp.category.toLowerCase().includes(query) ||
        exp.id.toLowerCase().includes(query);

      return matchesDate && matchesCategory && matchesPayment && matchesQuery;
    });
  }, [expenses, selectedDate, categoryFilter, paymentFilter, searchQuery]);

  // Analytics KPIs
  const todayTotal = useMemo(() => {
    return expenses
      .filter((exp) => exp.date === selectedDate)
      .reduce((sum, exp) => sum + (Number(exp.amountUSD) || 0), 0);
  }, [expenses, selectedDate]);

  const monthTotal = useMemo(() => {
    const selectedMonth = selectedDate.slice(0, 7); // YYYY-MM
    return expenses
      .filter((exp) => exp.date.startsWith(selectedMonth))
      .reduce((sum, exp) => sum + (Number(exp.amountUSD) || 0), 0);
  }, [expenses, selectedDate]);

  return (
    <div className="daily-expenses-page">
      {/* Page Header */}
      <div className="de-header-bar">
        <div>
          <h1 className="de-title">
            <TrendingDown size={22} className="de-title-icon" /> Daily Hotel Expenses
          </h1>
          <p className="de-subtitle">Log & track minor hotel operational outlays on a daily basis.</p>
        </div>

        <div className="de-header-actions">
          <button className="de-btn de-btn-secondary" onClick={handleExportCSV} title="Export CSV Report">
            <Download size={15} /> Export CSV
          </button>
          <button className="de-btn de-btn-primary" onClick={() => setShowAddModal(true)}>
            <PlusCircle size={15} /> + Record Expense
          </button>
        </div>
      </div>

      {/* KPI Cards Stack */}
      <div className="de-kpi-grid">
        <div className="de-kpi-card active-slate">
          <div className="de-kpi-icon-badge">
            <DollarSign size={18} />
          </div>
          <div>
            <span className="de-kpi-label">Today's Total Expenses</span>
            <h2 className="de-kpi-val">${todayTotal.toFixed(2)}</h2>
          </div>
        </div>

        <div className="de-kpi-card">
          <div className="de-kpi-icon-badge">
            <Calendar size={18} />
          </div>
          <div>
            <span className="de-kpi-label">Month-to-Date Expenses</span>
            <h2 className="de-kpi-val">${monthTotal.toFixed(2)}</h2>
          </div>
        </div>

        <div className="de-kpi-card">
          <div className="de-kpi-icon-badge">
            <Receipt size={18} />
          </div>
          <div>
            <span className="de-kpi-label">Expense Items Logged</span>
            <h2 className="de-kpi-val">{filteredExpenses.length} Entries</h2>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="de-toolbar-card">
        {/* Date Navigator */}
        <div className="de-date-nav">
          <button className="de-icon-btn" onClick={() => handleDateChange(-1)} title="Previous Day">
            <ChevronLeft size={16} />
          </button>
          <div className="de-date-display" style={{ width: "160px" }}>
            <CustomDatePicker
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <button className="de-icon-btn" onClick={() => handleDateChange(1)} title="Next Day">
            <ChevronRight size={16} />
          </button>
          <button
            className="de-btn-today"
            onClick={() => setSelectedDate(getTodayStr())}
            disabled={selectedDate === getTodayStr()}
          >
            Today
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="de-filters-group">
          <div className="de-search-box">
            <Search size={15} className="de-search-icon" />
            <input
              type="text"
              placeholder="Search description, vendor, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="de-search-input"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="de-select-filter"
          >
            <option value="ALL">All Categories</option>
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="de-select-filter"
          >
            <option value="ALL">All Payment Methods</option>
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm} value={pm}>{pm}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expense Log Table */}
      <div className="de-table-card">
        <table className="de-table">
          <thead>
            <tr>
              <th>REF ID</th>
              <th>TIME</th>
              <th>CATEGORY</th>
              <th>DESCRIPTION / ITEM DETAILS</th>
              <th>PAYMENT METHOD</th>
              <th>VENDOR / MERCH.</th>
              <th className="text-right">AMOUNT ($ USD)</th>
              <th className="text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={8} className="de-empty-state">
                  No operational expenses recorded for {selectedDate}. Click <strong>+ Record Expense</strong> to log an outlay.
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp) => (
                <tr key={exp.id}>
                  <td className="de-ref-code">{exp.id}</td>
                  <td className="de-time-text">{exp.time}</td>
                  <td>
                    <span className="de-cat-badge">{exp.category}</span>
                  </td>
                  <td className="de-desc-text">
                    <strong>{exp.description}</strong>
                    {exp.notes && <span className="de-sub-note">{exp.notes}</span>}
                  </td>
                  <td className="de-pm-text">{exp.paymentMethod}</td>
                  <td className="de-vendor-text">{exp.vendor}</td>
                  <td className="de-amount-text text-right">${Number(exp.amountUSD).toFixed(2)}</td>
                  <td className="text-center">
                    <button
                      className="de-action-btn-danger"
                      onClick={() => handleDeleteExpense(exp.id)}
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

      {/* Record Expense Modal */}
      {showAddModal && (
        <div className="de-modal-backdrop" >
          <div className="de-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="de-modal-header">
              <h3>+ Record Daily Hotel Expense</h3>
              <button className="de-modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <form onSubmit={handleAddExpense}>
              <div className="de-modal-body">
                <div className="de-form-row">
                  <div className="de-form-group">
                    <label>Expense Date</label>
                    <CustomDatePicker
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="de-form-group">
                    <label>Expense Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.category === 'Misc / Other' && (
                  <div className="de-form-group">
                    <label>Specify Custom Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Pool Chemicals, Locksmith, Gardening"
                      value={formData.customCategory}
                      onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div className="de-form-group">
                  <label>Item Description / Detail</label>
                  <input
                    type="text"
                    placeholder="e.g. 10x LED Light Bulbs for Room 204"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <div className="de-form-row">
                  <div className="de-form-group">
                    <label>Expense Amount ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amountUSD}
                      onChange={(e) => setFormData({ ...formData, amountUSD: e.target.value })}
                      required
                    />
                  </div>

                  <div className="de-form-group">
                    <label>Payment Method</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm} value={pm}>{pm}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="de-form-row">
                  <div className="de-form-group">
                    <label>Vendor / Payee Merchant</label>
                    <input
                      type="text"
                      placeholder="e.g. Home Depot, Walmart, Local Plumber"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    />
                  </div>

                  <div className="de-form-group">
                    <label>Logged By Staff ID</label>
                    <input
                      type="text"
                      value={formData.staffId}
                      onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="de-form-group">
                  <label>Additional Notes (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Receipt details or notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="de-modal-footer">
                <button type="button" className="de-btn de-btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="de-btn de-btn-primary">
                  Save Expense Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
