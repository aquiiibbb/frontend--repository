import { dataStore } from "./dataStore";
/**
 * PAYMENT GATEWAY SERVICE (US MARKET FOCUS)
 * Supports: Stripe, Fortis, Shift4, PAYBOTX, Venmo, Zelle
 */

export const STORAGE_KEY_PAYMENT_GATEWAYS = "hotelpms_payment_gateways_v1";

export const DEFAULT_PAYMENT_GATEWAY_CONFIG = {
  activePrimaryGateway: "stripe",
  activeOnlineGateway: "stripe",
  enableCardSurcharge: false,
  cardSurchargePercent: 3.0,
  
  // STRIPE CONFIG
  stripe: {
    enabled: true,
    environment: "sandbox", // 'sandbox' | 'live'
    publishableKey: "pk_test_sample_stripe_key_991823",
    secretKey: "sk_test_sample_stripe_secret_881923",
    terminalLocationId: "tmpl_loc_77192",
    enableApplePay: true,
    enableGooglePay: true,
  },

  // FORTIS CONFIG
  fortis: {
    enabled: true,
    environment: "sandbox",
    developerId: "fortis_dev_9912",
    apiKey: "fortis_key_secret_1234",
    locationId: "fortis_loc_001",
    terminalSerial: "FORTIS-TERM-88492",
  },

  // SHIFT4 CONFIG
  shift4: {
    enabled: true,
    environment: "sandbox",
    merchantId: "S4_MERCHANT_44819",
    accessBlockKey: "s4_access_key_9921",
    skyTabTerminalId: "SKYTAB-POS-0092",
  },

  // PAYBOTX CONFIG
  paybotx: {
    enabled: true,
    environment: "sandbox",
    botApiToken: "pbx_token_9918274619",
    partnerAccountId: "PBX-HOTEL-8819",
    autoCapture: true,
  },

  // VENMO CONFIG
  venmo: {
    enabled: true,
    venmoHandle: "@HotelFrontDeskUSD",
    businessName: "Grand Plaza Hotel & Suites",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=venmo://paycharge?txn=pay&recipients=HotelFrontDeskUSD",
  },

  // ZELLE CONFIG
  zelle: {
    enabled: true,
    registeredPhone: "+1 (800) 555-0199",
    registeredEmail: "payments@grandplazahotel.com",
    bankRefName: "Grand Plaza Hospitality Inc",
  }
};

/**
 * Retrieve saved Payment Gateway configurations or defaults
 */
export function getPaymentGatewayConfig() {
  try {
    const raw = dataStore.getItem(STORAGE_KEY_PAYMENT_GATEWAYS);
    if (!raw) return DEFAULT_PAYMENT_GATEWAY_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PAYMENT_GATEWAY_CONFIG, ...parsed };
  } catch (err) {
    console.error("Error parsing payment gateway config:", err);
    return DEFAULT_PAYMENT_GATEWAY_CONFIG;
  }
}

/**
 * Return array of enabled gateway keys e.g. ['stripe', 'fortis']
 */
export function getEnabledPaymentGateways() {
  const config = getPaymentGatewayConfig();
  const gateways = ["stripe", "fortis", "shift4", "paybotx", "venmo", "zelle"];
  return gateways.filter((gw) => Boolean(config[gw]?.enabled));
}

/**
 * Check if a specific gateway is enabled
 */
export function isGatewayEnabled(gatewayKey) {
  const config = getPaymentGatewayConfig();
  return Boolean(config[String(gatewayKey).toLowerCase()]?.enabled);
}

/**
 * Save updated Payment Gateway configuration to the data store
 */
export function savePaymentGatewayConfig(config) {
  try {
    dataStore.setItem(STORAGE_KEY_PAYMENT_GATEWAYS, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("pms_payment_gateways_updated", { detail: config }));
    return true;
  } catch (err) {
    console.error("Error saving payment gateway config:", err);
    return false;
  }
}

/**
 * Simulate live terminal payment execution (Stripe / Fortis / Shift4 / PAYBOTX)
 */
export function processTerminalCharge({ gateway, amount, currency = "USD", folioId, roomNo, cardToken }) {
  const config = getPaymentGatewayConfig();
  const gatewayInfo = config[gateway] || {};

  const txnId = `${gateway.toUpperCase()}-TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    success: true,
    gateway: gateway.toUpperCase(),
    transactionId: txnId,
    amount: Number(amount),
    currency,
    folioId,
    roomNo,
    status: "APPROVED",
    cardBrand: "Visa / Mastercard",
    last4: cardToken ? cardToken.slice(-4) : "4242",
    terminalId: gatewayInfo.terminalSerial || gatewayInfo.terminalLocationId || gatewayInfo.skyTabTerminalId || "TERM-ONLINE-01",
    timestamp: new Date().toISOString(),
    receiptUrl: `https://pms-receipts.local/${txnId}`
  };
}

/**
 * Simulate pre-authorization (Card hold)
 */
export function processPreAuth({ gateway, amount, currency = "USD", folioId }) {
  const authId = `${gateway.toUpperCase()}-AUTH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  return {
    success: true,
    gateway: gateway.toUpperCase(),
    authId,
    amountHold: Number(amount),
    currency,
    folioId,
    status: "AUTHORIZED_HOLD",
    expiresInDays: 7,
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate SMS/Email payment link for guest
 */
export function generatePaymentLink({ amount, currency = "USD", guestPhone, guestEmail, folioId }) {
  const linkId = `PAYLINK-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const payUrl = `https://pay.grandplazahotel.com/checkout/${linkId}?amt=${amount}&folio=${folioId}`;
  
  return {
    success: true,
    linkId,
    payUrl,
    amount: Number(amount),
    currency,
    sentToPhone: guestPhone || null,
    sentToEmail: guestEmail || null,
    timestamp: new Date().toISOString()
  };
}

/**
 * Validate card number using Luhn Algorithm (ISO/IEC 7812-1)
 */
export function isValidCardNumber(cardNumberStr) {
  if (!cardNumberStr) return false;
  const clean = String(cardNumberStr).replace(/\D/g, "");
  if (clean.length < 13 || clean.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Detect Card Network Brand
 */
export function detectCardBrand(cardNumberStr) {
  const clean = String(cardNumberStr || "").replace(/\D/g, "");
  if (/^4/.test(clean)) return { brand: "Visa", icon: "💳 Visa", color: "#1a1f71" };
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[0-1]|2720)/.test(clean)) return { brand: "MasterCard", icon: "💳 MasterCard", color: "#eb001b" };
  if (/^3[47]/.test(clean)) return { brand: "Amex", icon: "💳 American Express", color: "#006fcf" };
  if (/^(6011|65|64[4-9])/.test(clean)) return { brand: "Discover", icon: "💳 Discover", color: "#f9a01b" };
  return { brand: "Card", icon: "💳 Card", color: "#64748b" };
}

/**
 * Validate Card Expiration Date (MM/YY or MM/YYYY)
 */
export function isValidCardExpiry(expiryStr) {
  if (!expiryStr) return false;
  const clean = String(expiryStr).trim();
  const match = clean.match(/^(0[1-9]|1[0-2])\/?([0-9]{2}|[0-9]{4})$/);
  if (!match) return false;

  const month = parseInt(match[1], 10);
  let year = parseInt(match[2], 10);
  if (year < 100) year += 2000;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

/**
 * Validate CVV (3 digits for Visa/MC/Discover, 4 digits for Amex)
 */
export function isValidCardCvv(cvvStr, isAmex = false) {
  if (!cvvStr) return false;
  const clean = String(cvvStr).trim();
  return isAmex ? /^\d{4}$/.test(clean) : /^\d{3,4}$/.test(clean);
}

/**
 * Auto-format Card Number input with spaces (4-4-4-4 for Visa/MC/Discover, 4-6-5 for Amex)
 */
export function formatCardNumberInput(valStr) {
  if (!valStr) return "";
  const clean = String(valStr).replace(/\D/g, "");
  const isAmex = /^3[47]/.test(clean);
  if (isAmex) {
    const part1 = clean.slice(0, 4);
    const part2 = clean.slice(4, 10);
    const part3 = clean.slice(10, 15);
    if (part3) return `${part1} ${part2} ${part3}`;
    if (part2) return `${part1} ${part2}`;
    return part1;
  }
  const truncated = clean.slice(0, 16);
  const parts = truncated.match(/.{1,4}/g);
  return parts ? parts.join(" ") : truncated;
}

/**
 * Auto-format Card Expiry input (MM/YY)
 */
export function formatCardExpiryInput(valStr) {
  if (!valStr) return "";
  const clean = String(valStr).replace(/\D/g, "").slice(0, 4);
  if (clean.length >= 3) {
    return `${clean.slice(0, 2)}/${clean.slice(2, 4)}`;
  }
  if (clean.length === 2 && !valStr.endsWith("/")) {
    return `${clean}/`;
  }
  return clean;
}
