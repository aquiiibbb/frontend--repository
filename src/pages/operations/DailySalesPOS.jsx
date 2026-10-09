import { dataStore } from "../../services/dataStore";
import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Calendar,
  Search,
  Bed,
  CreditCard,
  DollarSign,
  TrendingUp,
  Tag,
  Receipt,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getBookings } from '../../services/api';
import CustomDatePicker from '../../components/CustomDatePicker';
import './DailySalesPOS.css';

const INITIAL_CATALOG = [
  { id: 'CAT-101', name: 'Bottled Mineral Water 500ml', category: 'Beverages', priceUSD: 2.50, stock: 45 },
  { id: 'CAT-102', name: 'Sparkling Soda Can 330ml', category: 'Beverages', priceUSD: 2.50, stock: 30 },
  { id: 'CAT-103', name: 'Crispy Chips & Snacks', category: 'Snacks', priceUSD: 3.00, stock: 25 },
  { id: 'CAT-104', name: 'Dental Toothbrush & Travel Kit', category: 'Toiletries', priceUSD: 4.00, stock: 20 },
  { id: 'CAT-105', name: 'Universal Travel Power Adapter', category: 'Electronics', priceUSD: 15.00, stock: 12 },
  { id: 'CAT-106', name: 'Daily Hotel Parking Pass', category: 'Services', priceUSD: 10.00, stock: 99 },
  { id: 'CAT-107', name: 'Continental Breakfast Voucher', category: 'F&B', priceUSD: 12.00, stock: 99 },
  { id: 'CAT-108', name: 'Hotel Souvenir Baseball Cap', category: 'Merchandise', priceUSD: 20.00, stock: 15 }
];

const INITIAL_SALES = [
  {
    id: 'POS-9001',
    date: new Date().toISOString().split('T')[0],
    time: '10:30 AM',
    category: 'F&B / Coffee & Snacks',
    itemsSummary: '2x Bottled Mineral Water, 1x Chips',
    totalAmountUSD: 8.00,
    paymentMethod: 'Cash',
    fulfillmentType: 'Direct Sale',
    roomNumber: 'N/A',
    guestName: 'Walk-In Guest'
  },
  {
    id: 'POS-9002',
    date: new Date().toISOString().split('T')[0],
    time: '01:15 PM',
    category: 'F&B / Coffee & Snacks',
    itemsSummary: '1x Continental Breakfast Voucher',
    totalAmountUSD: 12.00,
    paymentMethod: 'Credit Card',
    fulfillmentType: 'Direct Sale',
    roomNumber: 'N/A',
    guestName: 'Walk-In Guest'
  }
];

export default function DailySalesPOS() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [sales, setSales] = useState(() => {
    try {
      const saved = dataStore.getItem('pms_daily_sales');
      return saved ? JSON.parse(saved) : INITIAL_SALES;
    } catch (e) {
      return INITIAL_SALES;
    }
  });

  const [catalog, setCatalog] = useState(() => {
    try {
      const saved = dataStore.getItem('pms_pos_catalog');
      return saved ? JSON.parse(saved) : INITIAL_CATALOG;
    } catch (e) {
      return INITIAL_CATALOG;
    }
  });

  const [activeBookings, setActiveBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);

  // Custom Write-in Sale Form
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  // Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash'); // Cash, Credit Card, Room Charge
  const [selectedRoomResCode, setSelectedRoomResCode] = useState('');
  const [checkoutSuccessMsg, setCheckoutSuccessMsg] = useState('');

  // Load active checked-in bookings for Room Charge selection
  useEffect(() => {
    try {
      const allRes = getBookings() || [];
      const checkedIn = allRes.filter((b) => {
        const s = (b.status || '').toLowerCase();
        return s === 'checked-in' || s === 'checkedin' || s === 'occupied' || s === 'confirmed';
      });
      setActiveBookings(checkedIn);
      if (checkedIn.length > 0) {
        setSelectedRoomResCode(checkedIn[0].resCode || checkedIn[0].id);
      }
    } catch (e) {
      setActiveBookings([]);
    }
  }, []);

  useEffect(() => {
    try {
      dataStore.setItem('pms_daily_sales', JSON.stringify(sales));
    } catch (e) {}
  }, [sales]);

  useEffect(() => {
    try {
      dataStore.setItem('pms_pos_catalog', JSON.stringify(catalog));
    } catch (e) {}
  }, [catalog]);

  const categories = useMemo(() => {
    const set = new Set(catalog.map((i) => i.category));
    return ['ALL', ...Array.from(set)];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const matchesCat = activeCategory === 'ALL' || item.category === activeCategory;
      const query = searchQuery.toLowerCase();
      const matchesQuery = !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
      return matchesCat && matchesQuery;
    });
  }, [catalog, activeCategory, searchQuery]);

  // Cart operations
  const addToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.id === product.id);
      if (existing) {
        return prevCart.map((ci) =>
          ci.id === product.id ? { ...ci, qty: ci.qty + 1 } : ci
        );
      }
      return [...prevCart, { ...product, qty: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart((prevCart) => {
      return prevCart
        .map((ci) => {
          if (ci.id === id) {
            const newQty = ci.qty + delta;
            return newQty > 0 ? { ...ci, qty: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean);
    });
  };

  const removeFromCart = (id) => {
    setCart((prevCart) => prevCart.filter((ci) => ci.id !== id));
  };

  const addCustomItemToCart = (e) => {
    e.preventDefault();
    if (!customItemName.trim() || !customItemPrice || parseFloat(customItemPrice) <= 0) {
      alert('Please enter a valid item name and price.');
      return;
    }

    const customProd = {
      id: `CUSTOM-${Date.now()}`,
      name: customItemName.trim(),
      category: 'Custom Item',
      priceUSD: Math.abs(parseFloat(customItemPrice)),
      qty: 1
    };

    addToCart(customProd);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, ci) => acc + ci.priceUSD * ci.qty, 0);
  }, [cart]);

  // Complete Sale
  const handleCompleteCheckout = (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    let roomNumber = 'N/A';
    let guestName = 'Walk-In Guest';

    if (paymentMode === 'Room Charge') {
      const targetRes = activeBookings.find((b) => (b.resCode || b.id) === selectedRoomResCode);
      if (targetRes) {
        roomNumber = `Room ${targetRes.roomNumber || targetRes.room || 'N/A'}`;
        guestName = targetRes.guestName || targetRes.guest || 'Guest';

        // Post charge to local PMS Folio Ledger if available
        try {
          const rawFolios = dataStore.getItem('pms_folios');
          const foliosMap = rawFolios ? JSON.parse(rawFolios) : {};
          const key = targetRes.resCode || targetRes.id;
          const currentFolio = foliosMap[key] || { folioA: [] };

          cart.forEach((ci) => {
            currentFolio.folioA.push({
              id: `CHG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              date: getTodayStr(),
              category: 'Incidentals & F&B',
              description: `Counter Sale: ${ci.qty}x ${ci.name}`,
              amountUSD: ci.priceUSD * ci.qty,
              exclTax: ci.priceUSD * ci.qty * 0.88,
              taxAmount: ci.priceUSD * ci.qty * 0.12,
              notes: 'Posted via Front Desk Daily Sales POS'
            });
          });

          foliosMap[key] = currentFolio;
          dataStore.setItem('pms_folios', JSON.stringify(foliosMap));
        } catch (err) {}
      }
    }

    const itemsSummary = cart.map((ci) => `${ci.qty}x ${ci.name}`).join(', ');
    const primaryCategory = cart[0]?.category === 'Services' || cart[0]?.category === 'Merchandise'
      ? 'Guest Amenities & Services'
      : 'F&B / Coffee & Snacks';

    const newSale = {
      id: `POS-${Date.now().toString().slice(-6)}`,
      date: getTodayStr(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: primaryCategory,
      itemsSummary,
      totalAmountUSD: cartTotal,
      paymentMethod: paymentMode,
      fulfillmentType: paymentMode === 'Room Charge' ? 'Room Charge' : 'Direct Sale',
      roomNumber,
      guestName
    };

    setSales([newSale, ...sales]);
    setCart([]);
    setShowCheckoutModal(false);
    setCheckoutSuccessMsg(`Sale POS-${newSale.id.slice(-6)} completed successfully!`);
    setTimeout(() => setCheckoutSuccessMsg(''), 4000);
  };

  // Daily Expenses reference for Net Balance Calculation
  const todayExpensesTotal = useMemo(() => {
    try {
      const savedExpenses = dataStore.getItem('pms_daily_expenses');
      if (!savedExpenses) return 0;
      const list = JSON.parse(savedExpenses);
      return list
        .filter((e) => e.date === selectedDate)
        .reduce((sum, e) => sum + (Number(e.amountUSD) || 0), 0);
    } catch (e) {
      return 0;
    }
  }, [selectedDate, sales]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => s.date === selectedDate);
  }, [sales, selectedDate]);

  const todaySalesTotal = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + (Number(s.totalAmountUSD) || 0), 0);
  }, [filteredSales]);

  const netDailyBalance = todaySalesTotal - todayExpensesTotal;

  const handleDateChange = (offsetDays) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offsetDays);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  return (
    <div className="daily-sales-page">
      {/* Page Header */}
      <div className="pos-header-bar">
        <div>
          <h1 className="pos-title">
            <ShoppingBag size={22} className="pos-title-icon" /> Daily Sales &amp; POS Counter
          </h1>
          <p className="pos-subtitle">Record daily retail item sales, snacks, amenities, and custom counter charges.</p>
        </div>

        {checkoutSuccessMsg && (
          <div className="pos-success-banner">
            <CheckCircle size={16} /> {checkoutSuccessMsg}
          </div>
        )}
      </div>

      {/* KPI Cards Stack */}
      <div className="pos-kpi-grid">
        <div className="pos-kpi-card active-slate">
          <div className="pos-kpi-icon-badge">
            <TrendingUp size={18} />
          </div>
          <div>
            <span className="pos-kpi-label">Today's Gross Sales (+)</span>
            <h2 className="pos-kpi-val text-emerald">${todaySalesTotal.toFixed(2)}</h2>
          </div>
        </div>

        <div className="pos-kpi-card">
          <div className="pos-kpi-icon-badge">
            <DollarSign size={18} />
          </div>
          <div>
            <span className="pos-kpi-label">Today's Expenses (-)</span>
            <h2 className="pos-kpi-val text-rose">${todayExpensesTotal.toFixed(2)}</h2>
          </div>
        </div>

        <div className="pos-kpi-card">
          <div className="pos-kpi-icon-badge">
            <Receipt size={18} />
          </div>
          <div>
            <span className="pos-kpi-label">Net Daily Operating Balance</span>
            <h2 className={`pos-kpi-val ${netDailyBalance >= 0 ? 'text-emerald' : 'text-rose'}`}>
              ${netDailyBalance.toFixed(2)}
            </h2>
          </div>
        </div>
      </div>

      {/* Main 2-Column Register Grid */}
      <div className="pos-main-layout">
        {/* Left Column: Product Catalog & Custom Item Creator */}
        <div className="pos-catalog-section">
          {/* Custom Write-in Sale Card */}
          <div className="pos-card pos-custom-item-card">
            <h3 className="pos-card-title">
              <Plus size={16} /> Write-In Custom Daily Sale
            </h3>
            <form onSubmit={addCustomItemToCart} className="pos-custom-form">
              <input
                type="text"
                placeholder="e.g. Early Check-In Fee, Parking Pass, Extra Towel"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                className="pos-input-custom-name"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Price $"
                value={customItemPrice}
                onChange={(e) => setCustomItemPrice(e.target.value)}
                className="pos-input-custom-price"
              />
              <button type="submit" className="pos-btn pos-btn-primary">
                + Add to Cart
              </button>
            </form>
          </div>

          {/* Catalog Filter Tabs & Search */}
          <div className="pos-card pos-catalog-card">
            <div className="pos-catalog-header">
              <div className="pos-category-tabs">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`pos-cat-tab ${activeCategory === cat ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="pos-search-box">
                <Search size={14} className="pos-search-icon" />
                <input
                  type="text"
                  placeholder="Search retail item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Catalog Grid */}
            <div className="pos-grid">
              {filteredCatalog.map((item) => (
                <div
                  key={item.id}
                  className="pos-product-card"
                  onClick={() => addToCart(item)}
                >
                  <span className="pos-prod-cat">{item.category}</span>
                  <h4 className="pos-prod-name">{item.name}</h4>
                  <div className="pos-prod-footer">
                    <span className="pos-prod-price">${item.priceUSD.toFixed(2)}</span>
                    <button className="pos-add-btn">+ Add</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Active Cart & Checkout */}
        <div className="pos-cart-section">
          <div className="pos-card pos-cart-card">
            <div className="pos-cart-header">
              <h3>
                <ShoppingBag size={17} /> Current Counter Cart
              </h3>
              {cart.length > 0 && (
                <button className="pos-btn-clear" onClick={() => setCart([])}>
                  Clear All
                </button>
              )}
            </div>

            <div className="pos-cart-body">
              {cart.length === 0 ? (
                <div className="pos-empty-cart">
                  <ShoppingBag size={32} style={{ color: '#cbd5e1', marginBottom: 8 }} />
                  <p>Cart is empty. Select catalog items or add a write-in sale.</p>
                </div>
              ) : (
                <div className="pos-cart-items">
                  {cart.map((ci) => (
                    <div key={ci.id} className="pos-cart-item">
                      <div className="pos-ci-info">
                        <span className="pos-ci-name">{ci.name}</span>
                        <span className="pos-ci-unit">${ci.priceUSD.toFixed(2)} each</span>
                      </div>

                      <div className="pos-ci-controls">
                        <button className="pos-qty-btn" onClick={() => updateCartQty(ci.id, -1)}>
                          <Minus size={13} />
                        </button>
                        <span className="pos-qty-num">{ci.qty}</span>
                        <button className="pos-qty-btn" onClick={() => updateCartQty(ci.id, 1)}>
                          <Plus size={13} />
                        </button>

                        <span className="pos-ci-subtotal">${(ci.priceUSD * ci.qty).toFixed(2)}</span>

                        <button className="pos-remove-btn" onClick={() => removeFromCart(ci.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Summary Footer */}
            <div className="pos-cart-footer">
              <div className="pos-cart-summary-line">
                <span>Subtotal ({cart.reduce((a, c) => a + c.qty, 0)} items)</span>
                <strong>${cartTotal.toFixed(2)}</strong>
              </div>
              <div className="pos-cart-summary-line total-line">
                <span>Total Amount Due:</span>
                <strong className="text-emerald">${cartTotal.toFixed(2)}</strong>
              </div>

              <button
                className="pos-btn pos-btn-checkout"
                disabled={cart.length === 0}
                onClick={() => setShowCheckoutModal(true)}
              >
                Complete Sale (${cartTotal.toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Sales History Table */}
      <div className="pos-card pos-history-card">
        <div className="pos-history-header">
          <div className="pos-date-nav">
            <button className="pos-icon-btn" onClick={() => handleDateChange(-1)}>
              <ChevronLeft size={16} />
            </button>
            <div className="pos-date-display" style={{ width: "160px" }}>
              <CustomDatePicker
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <button className="pos-icon-btn" onClick={() => handleDateChange(1)}>
              <ChevronRight size={16} />
            </button>
            <button
              className="pos-btn-today"
              onClick={() => setSelectedDate(getTodayStr())}
              disabled={selectedDate === getTodayStr()}
            >
              Today
            </button>
          </div>

          <h3 className="pos-history-title">Daily Sales Register ({filteredSales.length} Transactions)</h3>
        </div>

        <table className="pos-table">
          <thead>
            <tr>
              <th>SALE ID</th>
              <th>TIME</th>
              <th>PURCHASED ITEMS SUMMARY</th>
              <th>SETTLEMENT MODE</th>
              <th>ROOM / GUEST</th>
              <th className="text-right">TOTAL SALE ($ USD)</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={6} className="pos-empty-state">
                  No counter sales recorded for {selectedDate}. Use the register above to log a sale.
                </td>
              </tr>
            ) : (
              filteredSales.map((s) => (
                <tr key={s.id}>
                  <td className="pos-ref-code">{s.id}</td>
                  <td className="pos-time-text">{s.time}</td>
                  <td className="pos-desc-text">
                    <strong>{s.itemsSummary}</strong>
                  </td>
                  <td>
                    <span className={`pos-mode-badge ${s.fulfillmentType === 'Room Charge' ? 'room-charge' : 'direct-sale'}`}>
                      {s.paymentMethod}
                    </span>
                  </td>
                  <td>{s.roomNumber !== 'N/A' ? `${s.roomNumber} (${s.guestName})` : 'Walk-In Guest'}</td>
                  <td className="pos-amount-text text-right">${Number(s.totalAmountUSD).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="pos-modal-backdrop" >
          <div className="pos-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h3>Complete Counter Sale Settlement</h3>
              <button className="pos-modal-close" onClick={() => setShowCheckoutModal(false)}>×</button>
            </div>

            <form onSubmit={handleCompleteCheckout}>
              <div className="pos-modal-body">
                <div className="pos-checkout-amount-box">
                  <span>TOTAL AMOUNT TO COLLECT</span>
                  <h2>${cartTotal.toFixed(2)}</h2>
                </div>

                <div className="pos-form-group">
                  <label>Select Payment / Settlement Method</label>
                  <div className="pos-payment-options">
                    {['Cash', 'Credit Card', 'Online / UPI', 'Room Charge'].map((mode) => (
                      <button
                        type="button"
                        key={mode}
                        className={`pos-pm-option ${paymentMode === mode ? 'active' : ''}`}
                        onClick={() => setPaymentMode(mode)}
                      >
                        {mode === 'Room Charge' ? <Bed size={16} /> : <CreditCard size={16} />}
                        <span>{mode}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMode === 'Room Charge' && (
                  <div className="pos-form-group pos-room-select-group">
                    <label>Select Active Checked-In Guest Room</label>
                    {activeBookings.length === 0 ? (
                      <p className="pos-warn-text">No active checked-in guests found. Please select Cash or Credit Card.</p>
                    ) : (
                      <select
                        value={selectedRoomResCode}
                        onChange={(e) => setSelectedRoomResCode(e.target.value)}
                        className="pos-select-room"
                      >
                        {activeBookings.map((b) => (
                          <option key={b.resCode || b.id} value={b.resCode || b.id}>
                            Room {b.roomNumber || b.room || 'N/A'} — {b.guestName || b.guest} ({b.resCode || b.id})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              <div className="pos-modal-footer">
                <button type="button" className="pos-btn pos-btn-secondary" onClick={() => setShowCheckoutModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="pos-btn pos-btn-primary">
                  Confirm &amp; Complete Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
