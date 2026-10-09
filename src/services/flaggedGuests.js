import { dataStore } from "./dataStore";
// FLAGGED GUESTS (BLACKLIST / VIP / ALERTS) SERVICE

const STORAGE_KEY = "hotelpms_flagged_guests_v1";

const INITIAL_FLAGGED_GUESTS = [
  {
    guestName: "Rahul Sharma",
    phone: "+91 98765 43210",
    email: "rahul.sharma@example.com",
    category: "Blacklisted",
    reason: "Unpaid folio balance of $450 & damaged room TV in room 204",
    flaggedAt: "2026-07-15T10:30:00Z",
    flaggedBy: "Front Desk Manager",
  },
  {
    guestName: "Vikram Malhotra",
    phone: "+1 (555) 987-6543",
    email: "vikram@malhotra.com",
    category: "Payment Alert",
    reason: "Credit card declined twice during previous stay. Collect 100% upfront.",
    flaggedAt: "2026-06-20T14:15:00Z",
    flaggedBy: "Accounts Team",
  },
  {
    guestName: "Sophia Martinez",
    phone: "+1 (555) 234-5678",
    email: "sophia.m@example.com",
    category: "VIP Guest",
    reason: "Frequent High-Spender VIP. Provide complimentary fruit basket & room upgrade.",
    flaggedAt: "2026-05-10T09:00:00Z",
    flaggedBy: "General Manager",
  },
];

export function getFlaggedGuests() {
  try {
    const saved = dataStore.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return [];
  }
  return [];
}

export function saveFlaggedGuests(list) {
  try {
    dataStore.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to save flagged guests:", err);
  }
}

export function flagGuest({ guestName, phone, email, category = "Blacklisted", reason = "" }) {
  if (!guestName) return null;
  const list = getFlaggedGuests();
  const validList = Array.isArray(list) ? list : [];
  const existingIdx = validList.findIndex(
    (g) => g.guestName.toLowerCase().trim() === guestName.toLowerCase().trim()
  );

  const newRecord = {
    guestName: guestName.trim(),
    phone: phone || "",
    email: email || "",
    category,
    reason,
    flaggedAt: new Date().toISOString(),
    flaggedBy: "Front Desk Agent",
  };

  if (existingIdx >= 0) {
    validList[existingIdx] = newRecord;
  } else {
    validList.unshift(newRecord);
  }

  saveFlaggedGuests(validList);
  return newRecord;
}

export function unflagGuest(guestName) {
  if (!guestName) return;
  const list = getFlaggedGuests();
  const filtered = list.filter(
    (g) => g.guestName.toLowerCase().trim() !== guestName.toLowerCase().trim()
  );
  saveFlaggedGuests(filtered);
}

export function checkGuestFlag(guestName, phone, email) {
  if (!guestName && !phone && !email) return null;
  const list = getFlaggedGuests();

  const nameNorm = guestName ? guestName.toLowerCase().trim() : "";
  const phoneDigits = phone ? phone.replace(/\D/g, "") : "";
  const emailNorm = email ? email.toLowerCase().trim() : "";

  return list.find((g) => {
    const gName = g.guestName ? g.guestName.toLowerCase().trim() : "";
    const gPhone = g.phone ? g.phone.replace(/\D/g, "") : "";
    const gEmail = g.email ? g.email.toLowerCase().trim() : "";

    // Match full or partial name if at least 2 chars
    if (nameNorm.length >= 2 && gName) {
      if (gName === nameNorm || gName.includes(nameNorm) || nameNorm.includes(gName)) return true;
      // Compare first name or last name
      const nameParts = nameNorm.split(" ").filter(Boolean);
      const gParts = gName.split(" ").filter(Boolean);
      const hasPartMatch = nameParts.some((p) => p.length >= 2 && gParts.some((gp) => gp.includes(p) || p.includes(gp)));
      if (hasPartMatch) return true;
    }

    if (phoneDigits.length >= 5 && gPhone && (gPhone.includes(phoneDigits) || phoneDigits.includes(gPhone))) return true;
    if (emailNorm.length >= 3 && gEmail && (gEmail.includes(emailNorm) || emailNorm.includes(gEmail))) return true;

    return false;
  }) || null;
}
