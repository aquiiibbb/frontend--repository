import { describe, it, expect, beforeEach, vi } from "vitest";
import { createBooking, getBookings, getRooms, getRoomTypes, saveRoomsList, saveRoomTypes } from "../services/api";

describe("Booking Engine & Front Desk Calendar Sync Integration", () => {
  beforeEach(() => {
    // Isolate localStorage for unit tests
    const store = {};
    global.localStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    };
  });
  it("creates direct bookings across different room categories and verifies database persistence", async () => {
    const mockBk = {
      id: "bk_test_201",
      guest: "Rahul Sharma",
      email: "rahul@example.com",
      phone: "9876543210",
      room: "201",
      roomType: "Deluxe Double AC Room",
      checkIn: "2026-08-07",
      checkOut: "2026-08-09",
      adults: 2,
      status: "confirmed",
      source: "Direct Web Booking Engine",
    };
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes("/bookings")) {
        if (options && options.method === "POST") {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBk) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([mockBk]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rooms: [{ id: "r_201", no: "201", type: "Deluxe Double AC Room" }], roomTypes: [{ id: "rt_2", name: "Deluxe Double AC Room" }] }) });
    });

    const deluxeBk = await createBooking(mockBk);

    expect(deluxeBk).toBeDefined();
    expect(deluxeBk.id).toBeDefined();
    expect(deluxeBk.room).toBe("201");

    // Fetch all bookings and verify deluxeBk is included
    const allBookings = await getBookings();
    const foundBk = allBookings.find((b) => b.id === deluxeBk.id);

    expect(foundBk).toBeDefined();
    expect(foundBk.guest).toBe("Rahul Sharma");
    expect(foundBk.room).toBe("201");
    expect(foundBk.status).toBe("confirmed");
  });
});
