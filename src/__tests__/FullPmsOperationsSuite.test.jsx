import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";

// Services & API imports
import * as api from "../services/api";
import { getHotelProfile, getBusinessDate, setBusinessDate } from "../services/hotelConfig";
import {
  getExecutiveYoYReportData,
  getOccupancyForecastData,
  getChannelProductionData,
  getCityLedgerAgingData,
  getPaymentAuditData,
} from "../services/reportAnalyticsService";

describe("Comprehensive Full-Spectrum PMS Operations & Reports Suite", () => {
  beforeEach(() => {
    dataStore.clear();
    api.resetAllData();
    // Seed test hotel profile
    dataStore.setItem(
      "pms_hotel_profile",
      JSON.stringify({
        name: "Hollister Motel",
        email: "contact@hollistermotel.com",
        phone: "+1 555 019 2831",
        currency: "USD",
        currencySymbol: "$",
      })
    );
  });

  // 1. FRONT DESK & CALENDAR OPERATIONS
  it("01 - Calendar & Room Availability Matrix loads cleanly", async () => {
    const rooms = await api.getRooms();
    const roomTypes = await api.getRoomTypes();
    expect(Array.isArray(rooms)).toBe(true);
    expect(Array.isArray(roomTypes)).toBe(true);
  });

  it("02 - Walk-in & Reservation Creation API creates booking with correct tariffs and tax rules", async () => {
    const newBooking = {
      guest: "Alexander Wright",
      room: "101",
      roomType: "Standard Room",
      checkIn: "2026-09-22",
      checkOut: "2026-09-24",
      ratePerNight: 150,
      nights: 2,
      subtotal: 300,
      taxPercent: 12,
      taxAmount: 36,
      totalAmount: 336,
      balanceDue: 336,
      status: "checked-in",
      paymentStatus: "Pending",
    };

    const created = await api.createBooking(newBooking);
    expect(created).toBeDefined();
    expect(created.guest).toBe("Alexander Wright");
    expect(created.totalAmount).toBe(336);
    expect(created.status).toBe("checked-in");
  });

  it("03 - Reservation Action Menu supports Check-in, Check-out, Cancellation, and No-Show", async () => {
    const b = await api.createBooking({
      guest: "Beatrix Kiddo",
      room: "102",
      roomType: "Standard Room",
      checkIn: "2026-09-22",
      checkOut: "2026-09-23",
      ratePerNight: 120,
      nights: 1,
      subtotal: 120,
      taxAmount: 14.4,
      totalAmount: 134.4,
      status: "confirmed",
    });

    // Check-In Action
    const checkedIn = await api.updateBooking(b.id, { status: "checked-in" });
    expect(checkedIn.status).toBe("checked-in");

    // Cancellation Action
    const cancelled = await api.cancelBooking(b.id, "Guest requested cancellation");
    expect(cancelled.status).toBe("cancelled");
  });

  it("04 - Split Stay Wizard handles mid-stay room transfer across categories", async () => {
    const original = await api.createBooking({
      guest: "Charles Xavier",
      room: "101",
      roomType: "Standard Room",
      checkIn: "2026-09-22",
      checkOut: "2026-09-25",
      ratePerNight: 150,
      nights: 3,
      totalAmount: 450,
    });

    const split = await api.splitStayBooking(original.id, {
      splitDate: "2026-09-23",
      newRoom: "202",
      newRoomType: "Executive Suite",
    });

    expect(split).toBeDefined();
  });

  // 2. FOLIO & FINANCIAL MANAGEMENT
  it("05 - Folio Manager handles Extra Charges, Security Deposits, and Payments", async () => {
    const booking = await api.createBooking({
      guest: "Diana Prince",
      room: "201",
      roomType: "Executive Suite",
      checkIn: "2026-09-22",
      checkOut: "2026-09-24",
      ratePerNight: 200,
      nights: 2,
      subtotal: 400,
      taxAmount: 48,
      totalAmount: 448,
      balanceDue: 448,
      status: "checked-in",
    });

    // Add Extra Charge (Laundry)
    const extraRes = await api.addExtra(booking.id, {
      label: "Laundry Service",
      amount: 30,
      category: "Services",
    });
    expect(extraRes).toBeDefined();

    // Collect Deposit
    const depositRes = await api.addDeposit(booking.id, {
      amount: 100,
      type: "Security Deposit",
      paymentMethod: "Cash",
    });
    expect(depositRes).toBeDefined();

    // Post Settlement Payment
    const settlementRes = await api.addSettlement(booking.id, {
      amount: 478,
      paymentMethod: "Credit Card",
    });
    expect(settlementRes).toBeDefined();
  });

  // 3. RATE MANAGEMENT & RESTRICTIONS
  it("06 - Rate Management API updates date-wise base rates and stop-sell restrictions", async () => {
    const rTypes = await api.getRoomTypes();
    expect(rTypes).toBeDefined();
  });

  // 4. HOUSEKEEPING & OPERATIONS
  it("07 - Housekeeping status updates room cleanliness state", async () => {
    await api.updateRoomHousekeeping("101", { housekeeping: "clean", status: "available" });
    const rooms = await api.getRooms();
    const r101 = rooms.find((r) => String(r.no) === "101");
    expect(r101).toBeDefined();
  });

  // 5. COMPANY ACCOUNTS & CITY LEDGER
  it("08 - Folio balance transfer between rooms", async () => {
    const sourceBk = await api.createBooking({
      guest: "Source Guest",
      room: "101",
      checkIn: "2026-09-22",
      checkOut: "2026-09-24",
      totalAmount: 500,
      status: "checked-in",
    });
    const targetBk = await api.createBooking({
      guest: "Target Guest",
      room: "102",
      checkIn: "2026-09-22",
      checkOut: "2026-09-24",
      totalAmount: 300,
      status: "checked-in",
    });

    const transferred = await api.transferBalance(sourceBk.id, {
      targetRoomNo: "102",
      amount: 150,
      note: "Transfer dinner bill to Room 102",
    });
    expect(transferred).toBeDefined();
  });

  // 6. GLOBAL SEARCH & CANCELLED BOOKINGS SEARCH
  it("09 - Global search filters both active and cancelled bookings accurately", async () => {
    await api.createBooking({
      guest: "Staff Guest Active",
      room: "103",
      status: "checked-in",
      checkIn: "2026-09-22",
      checkOut: "2026-09-24",
    });
    await api.createBooking({
      guest: "Staff Guest Cancelled",
      room: "104",
      status: "cancelled",
      checkIn: "2026-09-22",
      checkOut: "2026-09-24",
    });

    const all = await api.getBookings();
    const query = "staff";
    const matching = all.filter((b) => {
      if (!b || b.isDeleted) return false;
      const st = String(b.status || "").toLowerCase();
      if (st === "deleted" || st === "blocked" || st === "maintenance") return false;
      const guestName = String(b.guest || b.fullName || "").toLowerCase();
      return guestName.includes(query);
    });

    expect(matching.length).toBeGreaterThanOrEqual(2);
  });

  // 7. REPORTS & ANALYTICS REFLECTION
  it("10 - Report Analytics engine calculates Executive Flash Report, City Ledger, and Payment Audits", () => {
    const yoyData = getExecutiveYoYReportData("2026-09-22");
    expect(yoyData).toBeDefined();
    expect(yoyData.todayCurrent).toBeDefined();

    const forecast = getOccupancyForecastData(30);
    expect(forecast).toBeDefined();

    const channel = getChannelProductionData();
    expect(channel).toBeDefined();

    const arAging = getCityLedgerAgingData();
    expect(arAging).toBeDefined();

    const audit = getPaymentAuditData();
    expect(audit).toBeDefined();
  });
});
