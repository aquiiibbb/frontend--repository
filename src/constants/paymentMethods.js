import { getPaymentGatewayConfig } from "../services/paymentGatewayService";

export const UNIFIED_PAYMENT_METHODS = [
  { id: "Cash", name: "Cash", icon: "💵", label: "💵 Cash" },
  { id: "Deposit", name: "Deposit", icon: "🛡️", label: "🛡️ Deposit" },
  { id: "Card", name: "Card", icon: "💳", label: "💳 Card (Manual)" },
  { id: "Stripe", name: "Stripe", icon: "⚡", label: "⚡ Stripe Terminal" },
  { id: "Fortis", name: "Fortis", icon: "🏛️", label: "🏛️ Fortis Pay" },
  { id: "Shift4", name: "Shift4", icon: "⚡", label: "⚡ Shift4 SkyTab" },
  { id: "PAYBOTX", name: "PAYBOTX", icon: "🤖", label: "🤖 PAYBOTX Auto" },
  { id: "Venmo", name: "Venmo", icon: "💙", label: "💙 Venmo QR" },
  { id: "Zelle", name: "Zelle", icon: "💜", label: "💜 Zelle Express" },
  { id: "Swipe", name: "Swipe", icon: "📲", label: "📲 POS Swipe" },
  { id: "Company", name: "Company", icon: "🏢", label: "🏢 Company" },
];

export function getEnabledPaymentMethods() {
  const pgConfig = getPaymentGatewayConfig();
  return UNIFIED_PAYMENT_METHODS.filter((pm) => {
    const key = pm.id.toLowerCase();
    if (["stripe", "fortis", "shift4", "paybotx", "venmo", "zelle"].includes(key)) {
      return Boolean(pgConfig[key]?.enabled);
    }
    return true;
  });
}


export function normalizePaymentMethod(methodStr) {
  if (!methodStr) return "Cash";
  const str = String(methodStr).trim().toLowerCase();

  if (str.includes("stripe")) return "Stripe";
  if (str.includes("fortis")) return "Fortis";
  if (str.includes("shift4")) return "Shift4";
  if (str.includes("paybotx") || str.includes("paybot")) return "PAYBOTX";
  if (str.includes("venmo")) return "Venmo";
  if (str.includes("zelle")) return "Zelle";

  if (str.includes("deposit") || str.includes("security")) {
    return "Deposit";
  }
  if (str.includes("swipe") || str.includes("terminal") || str.includes("offline card") || str.includes("card_offline")) {
    return "Swipe";
  }
  if (
    str.includes("company") ||
    str.includes("city ledger") ||
    str.includes("post to company") ||
    str.includes("post_to_company") ||
    str.includes("direct bill") ||
    str.includes("house account") ||
    str.includes("corporate")
  ) {
    return "Company";
  }
  if (str.includes("cheque") || str.includes("check")) {
    return "Cheque";
  }
  if (str === "offline" || str.includes("offline payment")) {
    return "Offline";
  }
  if (
    str.includes("card") ||
    str.includes("visa") ||
    str.includes("master") ||
    str.includes("amex") ||
    str.includes("credit") ||
    str.includes("debit") ||
    str.includes("add_new_card") ||
    str.includes("saved_card")
  ) {
    return "Card";
  }
  if (str.includes("cash")) {
    return "Cash";
  }
  return "Cash";
}
