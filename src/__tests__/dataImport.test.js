import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach } from "vitest";
import { getBookings, importBatchBookings, resetAllData } from "../services/api";

describe("Historical Data Import Module", () => {
  beforeEach(async () => {
    dataStore.clear();
    if (typeof resetAllData === "function") await resetAllData();
  });

  it("1. Successfully imports batch past bookings and persists in database", async () => {
    const pastBookings = [
      {
        id: "imp_test_101",
        guest: "Historical Guest One",
        phone: "+1 555-9001",
        email: "hist1@example.com",
        room: "101",
        roomType: "Standard Room",
        checkIn: "2026-07-01",
        checkOut: "2026-07-04",
        ratePerNight: 100,
        nights: 3,
        subtotal: 300,
        totalAmount: 300,
        paidAmount: 300,
        balanceDue: 0,
        paymentStatus: "Paid",
        status: "checked-out",
        channel: "Booking.com",
        notes: "Historical import test",
      },
      {
        id: "imp_test_102",
        guest: "Historical Guest Two",
        phone: "+1 555-9002",
        email: "hist2@example.com",
        room: "102",
        roomType: "Deluxe Room",
        checkIn: "2026-07-05",
        checkOut: "2026-07-08",
        ratePerNight: 150,
        nights: 3,
        subtotal: 450,
        totalAmount: 450,
        paidAmount: 450,
        balanceDue: 0,
        paymentStatus: "Paid",
        status: "checked-out",
        channel: "Expedia",
        notes: "Historical import test",
      },
    ];

    const result = await importBatchBookings(pastBookings);
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);

    const allBookings = await getBookings();
    const imported1 = allBookings.find((b) => b.id === "imp_test_101");
    const imported2 = allBookings.find((b) => b.id === "imp_test_102");

    expect(imported1).toBeDefined();
    expect(imported1.guest).toBe("Historical Guest One");
    expect(imported1.status).toBe("checked-out");

    expect(imported2).toBeDefined();
    expect(imported2.guest).toBe("Historical Guest Two");
    expect(imported2.totalAmount).toBe(450);
  });

  it("2. Throws error if empty booking list is provided", async () => {
    await expect(importBatchBookings([])).rejects.toThrow("No bookings provided for import");
  });
});
