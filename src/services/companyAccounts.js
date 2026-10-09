import { dataStore } from "./dataStore";
import { generateNextSequence } from "./hotelConfig";

const STORAGE_KEY = "hotelpms_company_accounts_v1";

function notifyChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pms_company_accounts_updated"));
  }
}

export function parseBalanceNumber(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]+/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getAllSystemBookings() {
  const keys = ["hotelpms_bookings_v1", "hotelpms_bookings_v2", "hotelpms_bookings_v3", "pms_bookings"];
  const allBookings = [];
  const seenIds = new Set();

  keys.forEach((key) => {
    try {
      const raw = dataStore.getItem(key);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((b) => {
            if (b && (b.id || b._id) && !seenIds.has(b.id || b._id)) {
              seenIds.add(b.id || b._id);
              allBookings.push(b);
            }
          });
        }
      }
    } catch (e) {}
  });


  return allBookings;
}

export function getRawCompanyAccounts() {
  try {
    const raw = dataStore.getItem(STORAGE_KEY);
    if (!raw) {
      dataStore.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

export function isBookingLinkedToCompany(b, account) {
  if (!b || !account) return false;

  const accIdStr = String(account.id || "").trim();
  const accNameLower = String(account.name || "").trim().toLowerCase();
  const accCodeLower = String(account.accountNo || account.code || "").trim().toLowerCase();
  const accGstinLower = String(account.gstin || "").trim().toLowerCase();

  const bCompId = String(b.companyAccountId || b.companyId || b.cityLedgerCompanyId || "").trim();
  const bCompNameLower = String(b.companyName || b.company || b.groupName || b.subSegment || "").trim().toLowerCase();
  const bPayMethodLower = String(b.paymentMethod || b.paymentMode || b.method || "").trim().toLowerCase();
  const bGstinLower = String(b.gstNumber || b.gstin || b.taxId || "").trim().toLowerCase();

  // 1. Direct ID match
  if (accIdStr && bCompId && bCompId === accIdStr) return true;

  // 2. Company Name match
  if (accNameLower && bCompNameLower) {
    if (accNameLower === bCompNameLower) return true;
    if (accNameLower.length >= 3 && bCompNameLower.length >= 3) {
      if (bCompNameLower.includes(accNameLower) || accNameLower.includes(bCompNameLower)) return true;
    }
  }

  // 3. Code / Account # match
  if (accCodeLower && bCompNameLower && (accCodeLower === bCompNameLower || bCompNameLower.includes(accCodeLower))) return true;

  // 4. GSTIN match
  if (accGstinLower && bGstinLower && accGstinLower === bGstinLower) return true;

  // 5. Payment method / City Ledger match
  const isCityLedgerOrHouse =
    bPayMethodLower.includes("city ledger") ||
    bPayMethodLower.includes("post to company") ||
    bPayMethodLower.includes("house account") ||
    bPayMethodLower.includes("direct bill") ||
    bPayMethodLower.includes("post_to_company");

  if (isCityLedgerOrHouse) {
    if (accNameLower && bCompNameLower && (bCompNameLower.includes(accNameLower) || accNameLower.includes(bCompNameLower))) return true;
    const notesStr = String(b.notes || b.remark || b.note || b.paymentDescription || "").toLowerCase();
    if (accNameLower && notesStr.includes(accNameLower)) return true;
    if (accCodeLower && notesStr.includes(accCodeLower)) return true;
    // If direct account ID match exists
    if (accIdStr && bCompId && bCompId === accIdStr) return true;
  }

  // 6. Payments array inside booking
  if (Array.isArray(b.payments)) {
    for (const p of b.payments) {
      if (!p) continue;
      if (p.companyAccountId && String(p.companyAccountId).trim() === accIdStr) return true;
      const pStr = `${p.method || ""} ${p.mode || ""} ${p.description || ""} ${p.note || ""}`.toLowerCase();
      if (accNameLower && accNameLower.length >= 3 && pStr.includes(accNameLower)) return true;
      if (accCodeLower && accCodeLower.length >= 3 && pStr.includes(accCodeLower)) return true;
    }
  }

  return false;
}

export function getCompanyAccounts() {
  const accounts = getRawCompanyAccounts();
  const bookings = getAllSystemBookings();

  return accounts.map((acc) => {
    const linkedBookings = bookings.filter((b) => isBookingLinkedToCompany(b, acc));

    let computedOutstanding = 0;

    bookings.forEach((b) => {
      if (!b || b.status === "cancelled") return;

      if (isBookingLinkedToCompany(b, acc)) {
        const totalAmt = Number(b.totalAmount || b.total || b.grandTotal || 0);
        const advanceAmt = Number(b.advanceAmount || b.advance || 0);
        const balDue = Number(b.balanceDue !== undefined ? b.balanceDue : (totalAmt - advanceAmt));

        const bPayMethodLower = String(b.paymentMethod || b.paymentMode || b.method || "").toLowerCase();
        const bSubSegmentLower = String(b.subSegment || b.companyName || b.company || "").toLowerCase();

        const isCityLedgerBooking =
          bPayMethodLower.includes("city ledger") ||
          bPayMethodLower.includes("post to company") ||
          bPayMethodLower.includes("house account") ||
          bPayMethodLower.includes("direct bill") ||
          bPayMethodLower.includes("post_to_company") ||
          bSubSegmentLower.includes("company") ||
          bSubSegmentLower.includes("corporate") ||
          (b.companyAccountId && String(b.companyAccountId).trim() === String(acc.id).trim());

        let bCharge = 0;
        if (isCityLedgerBooking) {
          bCharge = totalAmt > 0 ? totalAmt : (advanceAmt > 0 ? advanceAmt : balDue);
        }

        let paymentsSum = 0;
        if (Array.isArray(b.payments)) {
          b.payments.forEach((p) => {
            if (!p) return;
            const pMode = String(p.mode || p.method || p.description || p.note || "").toLowerCase();
            const isCityLedgerPay =
              pMode.includes("city ledger") ||
              pMode.includes("company") ||
              pMode.includes("direct bill") ||
              pMode.includes("house account") ||
              pMode.includes("post_to_company");

            if (isCityLedgerPay) {
              const pAmt = Number(p.amount || p.amountUSD || 0);
              if (pAmt > 0) paymentsSum += pAmt;
            }
          });
        }

        const finalBilledForBooking = Math.max(bCharge, paymentsSum);
        computedOutstanding += finalBilledForBooking;
      }
    });

    let settlementsSum = 0;
    if (Array.isArray(acc.settlements)) {
      settlementsSum = acc.settlements.reduce((sum, s) => sum + parseBalanceNumber(s.amount), 0);
    }

    const storedBalance = parseBalanceNumber(acc.balance);
    const rawOutstanding = Math.max(storedBalance, computedOutstanding);
    const finalBalance = Math.max(0, rawOutstanding - settlementsSum);

    return {
      ...acc,
      balance: finalBalance,
      settlementsSum,
      linkedBookingCount: linkedBookings.length,
    };
  });
}

export function hasCompanyTransactions(account) {
  if (!account) return false;

  const bal = parseBalanceNumber(account.balance);
  if (Math.abs(bal) > 0.001) return true;

  const bookings = getAllSystemBookings();
  const hasLinkedBooking = bookings.some((b) => isBookingLinkedToCompany(b, account));
  if (hasLinkedBooking) return true;

  try {
    const rawMisc = dataStore.getItem("pms_misc_transactions");
    if (rawMisc) {
      const miscList = JSON.parse(rawMisc);
      if (Array.isArray(miscList)) {
        const hasMisc = miscList.some((m) => isBookingLinkedToCompany(m, account));
        if (hasMisc) return true;
      }
    }
  } catch (e) {}

  return false;
}

export function recordCompanyAccountCharge(companyIdentifier, amount) {
  if (!companyIdentifier || !amount || Number(amount) <= 0) return;
  try {
    const rawAccounts = getRawCompanyAccounts();
    let targetId = "";
    let targetName = "";
    let targetNo = "";

    if (typeof companyIdentifier === "object" && companyIdentifier !== null) {
      targetId = String(companyIdentifier.id || "").toLowerCase().trim();
      targetName = String(companyIdentifier.name || "").toLowerCase().trim();
      targetNo = String(companyIdentifier.accountNo || "").toLowerCase().trim();
    } else {
      const strVal = String(companyIdentifier).toLowerCase().trim();
      targetId = strVal;
      targetName = strVal;
      targetNo = strVal;
    }

    let foundMatch = false;
    const updated = rawAccounts.map((a) => {
      const aId = String(a.id || "").toLowerCase().trim();
      const aName = String(a.name || "").toLowerCase().trim();
      const aNo = String(a.accountNo || "").toLowerCase().trim();

      const matchId = targetId && aId && targetId === aId;
      const matchName = targetName && aName && (targetName === aName || aName.includes(targetName) || targetName.includes(aName));
      const matchNo = targetNo && aNo && targetNo === aNo;

      if (matchId || matchName || matchNo) {
        foundMatch = true;
        return {
          ...a,
          balance: parseBalanceNumber(a.balance) + Number(amount),
        };
      }
      return a;
    });

    if (foundMatch) {
      dataStore.setItem(STORAGE_KEY, JSON.stringify(updated));
      notifyChange();
    }
  } catch (err) {
    console.error("Error recording company account charge:", err);
  }
}

export function addCompanyAccount(companyData) {
  const accounts = getRawCompanyAccounts();
  const nextSeq = generateNextSequence("cityLedger", true);
  const accountNo = companyData.accountNo && companyData.accountNo.trim() !== "" 
    ? companyData.accountNo 
    : nextSeq;

  const newAccount = {
    id: `ca_${Date.now()}`,
    name: companyData.name || "Corporate Account",
    accountNo: accountNo,
    gstin: companyData.gstin || "",
    balance: parseBalanceNumber(companyData.balance),
    contact: companyData.contact || "",
    email: companyData.email || "",
  };
  const updated = [...accounts, newAccount];
  dataStore.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyChange();
  return newAccount;
}

export function updateCompanyAccount(id, patchData) {
  const accounts = getRawCompanyAccounts();
  const updated = accounts.map((a) => (a.id === id ? { ...a, ...patchData } : a));
  dataStore.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyChange();
  return updated;
}

export function deleteCompanyAccount(id) {
  const accounts = getCompanyAccounts();
  const account = accounts.find((a) => (a.id || a.name) === id || a.id === id || a.name === id);
  if (account) {
    const bal = parseBalanceNumber(account.balance);
    if (bal > 0.001 || hasCompanyTransactions(account)) {
      throw new Error(
        `Cannot delete Corporate Account "${account.name}" because it has associated transactions or an outstanding balance ($${bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}). Please delete or clear all associated transactions first.`
      );
    }
  }
  const rawAccounts = getRawCompanyAccounts();
  const filtered = rawAccounts.filter((a) => (a.id || a.name) !== id && a.id !== id && a.name !== id);
  dataStore.setItem(STORAGE_KEY, JSON.stringify(filtered));
  notifyChange();
  return filtered;
}

export function purgeAllCompanyAccounts() {
  const accounts = getCompanyAccounts();
  const blockedAccounts = accounts.filter(
    (a) => parseBalanceNumber(a.balance) > 0.001 || hasCompanyTransactions(a)
  );
  if (blockedAccounts.length > 0) {
    const blockedNames = blockedAccounts.map((a) => a.name).join(", ");
    throw new Error(
      `Cannot clear corporate accounts because the following account(s) have active transactions or outstanding balance: ${blockedNames}. Please clear or delete associated transactions first.`
    );
  }
  dataStore.setItem(STORAGE_KEY, JSON.stringify([]));
  notifyChange();
  return [];
}

export function settleCompanyAccountBalance(companyIdentifier, settlementAmount, details = {}) {
  const amountToSettle = parseBalanceNumber(settlementAmount);
  if (!companyIdentifier || amountToSettle <= 0) return;

  try {
    const rawAccounts = getRawCompanyAccounts();
    let targetId = "";
    let targetName = "";
    let targetNo = "";

    if (typeof companyIdentifier === "object" && companyIdentifier !== null) {
      targetId = String(companyIdentifier.id || "").toLowerCase().trim();
      targetName = String(companyIdentifier.name || "").toLowerCase().trim();
      targetNo = String(companyIdentifier.accountNo || "").toLowerCase().trim();
    } else {
      const strVal = String(companyIdentifier).toLowerCase().trim();
      targetId = strVal;
      targetName = strVal;
      targetNo = strVal;
    }

    let foundMatch = false;
    const updated = rawAccounts.map((a) => {
      const aId = String(a.id || "").toLowerCase().trim();
      const aName = String(a.name || "").toLowerCase().trim();
      const aNo = String(a.accountNo || "").toLowerCase().trim();

      const matchId = targetId && aId && targetId === aId;
      const matchName = targetName && aName && (targetName === aName || aName.includes(targetName) || targetName.includes(aName));
      const matchNo = targetNo && aNo && targetNo === aNo;

      if (matchId || matchName || matchNo) {
        foundMatch = true;
        const currentBal = parseBalanceNumber(a.balance);
        const newBal = Math.max(0, currentBal - amountToSettle);
        const settlements = Array.isArray(a.settlements) ? a.settlements : [];
        const newSettlement = {
          id: `stl_${Date.now()}`,
          date: new Date().toISOString(),
          amount: amountToSettle,
          method: details.method || "Cash",
          reference: details.reference || "",
          notes: details.notes || "",
          settledBy: details.settledBy || "Front Desk"
        };

        return {
          ...a,
          balance: newBal,
          settlements: [newSettlement, ...settlements]
        };
      }
      return a;
    });

    if (foundMatch) {
      dataStore.setItem(STORAGE_KEY, JSON.stringify(updated));
      notifyChange();
    }
  } catch (err) {
    console.error("Error settling company account balance:", err);
  }
}
