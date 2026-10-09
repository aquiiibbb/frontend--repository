// Utility functions for GrandVista PMS ($ USD)

export const formatUSD = (amount) => {
  let numeric = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  if (isNaN(numeric) || Math.abs(numeric) < 0.0001) numeric = 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [y, m, d] = dateString.split('-');
      return `${m}/${d}/${y}`;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  } catch (e) {
    return String(dateString || '');
  }
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${mm}/${dd}/${yyyy}, ${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return String(dateString || '');
  }
};

export const formatShortDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    return String(dateString || '');
  }
};

export const getDaysDifference = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays || 1;
};

export const calculateTaxes = (amount, taxRules = [], isTaxExempt = false) => {
  if (isTaxExempt) return { totalTax: 0, breakdown: [] };
  
  let totalTax = 0;
  const breakdown = [];

  taxRules.forEach(rule => {
    if (!rule.enabled) return;
    let taxAmount = 0;
    if (rule.type === 'percent') {
      taxAmount = (amount * rule.rate) / 100;
    } else if (rule.type === 'flat') {
      taxAmount = rule.rate;
    }
    totalTax += taxAmount;
    breakdown.push({
      id: rule.id,
      name: rule.name,
      rate: rule.rate,
      type: rule.type,
      amount: taxAmount
    });
  });

  return { totalTax, breakdown };
};

export const getStatusBadgeClass = (status) => {
  switch (status?.toLowerCase()) {
    case 'checked-in':
    case 'occupied':
    case 'clean':
      return 'badge-success';
    case 'reserved':
    case 'dirty':
      return 'badge-warning';
    case 'checked-out':
    case 'inspected':
      return 'badge-info';
    case 'out-of-order':
    case 'cancelled':
    case 'blocked':
      return 'badge-danger';
    default:
      return 'badge-secondary';
  }
};
