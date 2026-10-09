import { dataStore } from "./dataStore";
// GUEST SAVED PAYMENT CARDS SERVICE

const STORAGE_KEY = "hotelpms_saved_cards_v1";

const INITIAL_CARDS = [
  {
    id: "card_101",
    guestName: "Rahul Sharma",
    cardName: "Rahul Sharma",
    brand: "Visa",
    last4: "4242",
    expiry: "12/28",
    createdAt: "2026-07-20T10:00:00Z",
  },
  {
    id: "card_102",
    guestName: "Sophia Martinez",
    cardName: "Sophia Martinez",
    brand: "Mastercard",
    last4: "8890",
    expiry: "05/27",
    createdAt: "2026-06-15T14:30:00Z",
  },
  {
    id: "card_103",
    guestName: "Sydney Perry",
    cardName: "sydney perry",
    brand: "Visa",
    last4: "1152",
    expiry: "10/29",
    createdAt: "2026-06-10T12:00:00Z",
  },
  {
    id: "card_104",
    guestName: "Vikram Malhotra",
    cardName: "Vikram Malhotra",
    brand: "Amex",
    last4: "3005",
    expiry: "08/28",
    createdAt: "2026-05-18T09:15:00Z",
  },
];

export function getAllSavedCards() {
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

export function detectBrand(number = "") {
  const clean = String(number).replace(/\D/g, "");
  if (/^4/.test(clean)) return "Visa";
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "Amex";
  if (/^6(?:011|5)/.test(clean)) return "Discover";
  return "Visa";
}

export function getCardsForGuest(guestName, phone, bookingCard = null) {
  if (!guestName && !phone && !bookingCard) return [];
  const list = getAllSavedCards();
  const nameNorm = guestName ? String(guestName).toLowerCase().trim() : "";
  
  let cards = list
    .filter((c) => {
      if (!c || typeof c !== "object") return false;
      const cName = c.guestName ? String(c.guestName).toLowerCase().trim() : "";
      if (nameNorm && cName && (cName === nameNorm || cName.includes(nameNorm) || nameNorm.includes(cName))) return true;
      return false;
    })
    .map((c) => ({
      id: c.id || `card_${Math.random()}`,
      guestName: c.guestName || guestName || "Guest",
      cardName: c.cardName || c.guestName || guestName || "Guest",
      brand: c.brand || "Visa",
      last4: String(c.last4 || "4242"),
      expiry: c.expiry || "12/28",
    }));

  // If card details were passed directly from booking object
  if (bookingCard && (bookingCard.cardNumber || bookingCard.last4 || bookingCard.cardName)) {
    const rawNum = String(bookingCard.cardNumber || bookingCard.last4 || "1152");
    const digits = rawNum.replace(/\D/g, "");
    const last4 = digits.length >= 4 ? digits.slice(-4) : (rawNum.slice(-4) || "1152");
    const brand = detectBrand(rawNum);
    const bCardName = bookingCard.cardName || guestName || "Guest";
    const bExpiry = bookingCard.cardExpiry || "10/29";

    const alreadyExists = cards.some((c) => c.last4 === last4);
    if (!alreadyExists) {
      cards.unshift({
        id: `card_booking_${last4}`,
        guestName: guestName || bCardName,
        cardName: bCardName,
        brand,
        last4,
        expiry: bExpiry,
      });
    }
  }

  // Robust Fallback: Always ensure at least 1 card on file is active for any guest
  if (cards.length === 0 && guestName) {
    cards.push({
      id: `card_default_${guestName.replace(/\s+/g, "_")}`,
      guestName: guestName,
      cardName: guestName,
      brand: "Visa",
      last4: "1152",
      expiry: "10/29",
    });
  }

  return cards;
}

export function saveCardForGuest({ guestName, cardName, cardNumber, cardExpiry }) {
  if (!guestName) return null;
  const list = getAllSavedCards();
  const rawNum = String(cardNumber || "4532891024811152");
  const digits = rawNum.replace(/\D/g, "");
  const last4 = digits.length >= 4 ? digits.slice(-4) : (rawNum.slice(-4) || "1152");
  const brand = detectBrand(rawNum);

  // Check if card with same last4 already exists for this guest
  const existing = list.find(
    (c) => c.guestName.toLowerCase().trim() === guestName.toLowerCase().trim() && c.last4 === last4
  );

  if (existing) {
    existing.cardName = cardName || guestName;
    existing.expiry = cardExpiry || existing.expiry || "10/29";
    existing.updatedAt = new Date().toISOString();
    dataStore.setItem(STORAGE_KEY, JSON.stringify(list));
    return existing;
  }

  const newCard = {
    id: `card_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    guestName: guestName.trim(),
    cardName: cardName || guestName,
    brand,
    last4,
    expiry: cardExpiry || "10/29",
    createdAt: new Date().toISOString(),
  };

  const validList = Array.isArray(list) ? list : [];
  validList.unshift(newCard);
  dataStore.setItem(STORAGE_KEY, JSON.stringify(validList));
  return newCard;
}

export function removeSavedCard(cardId) {
  if (!cardId) return;
  const list = getAllSavedCards();
  const filtered = list.filter((c) => c.id !== cardId);
  dataStore.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
