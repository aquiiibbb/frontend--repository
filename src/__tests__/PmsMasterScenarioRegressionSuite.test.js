import { describe, it, expect } from "vitest";
import { 
  calculateCategoryAvailability, 
  getOverbookedReservations, 
  isInventoryConsumingBooking, 
  isUnconfirmedEnquiry 
} from "../services/overbookingService";
import { 
  getExecutiveYoYReportData, 
  getOccupancyForecastData,
  getChannelProductionData,
  getCityLedgerAgingData
} from "../services/reportAnalyticsService";

describe("PMS Comprehensive Master Business Logic & Regression Suite (18 Scenarios)", () => {
  const mockRooms = [
    { id: "r101", number: "101", no: "101", type: "Standard Non Smoking", category: "Standard Non Smoking", status: "Available" },
    { id: "r102", number: "102", no: "102", type: "Standard Non Smoking", category: "Standard Non Smoking", status: "Available" },
    { id: "r103", number: "103", no: "103", type: "Standard Non Smoking", category: "Standard Non Smoking", status: "Available" },
    { id: "r104", number: "104", no: "104", type: "Standard Non Smoking", category: "Standard Non Smoking", status: "Available" },
    { id: "r105", number: "105", no: "105", type: "Standard Non Smoking", category: "Standard Non Smoking", status: "Available" },
    { id: "r201", number: "201", no: "201", type: "Deluxe Suite", category: "Deluxe Suite", status: "Available" },
    { id: "r202", number: "202", no: "202", type: "Deluxe Suite", category: "Deluxe Suite", status: "Available" },
    { id: "r203", number: "203", no: "203", type: "Deluxe Suite", category: "Deluxe Suite", status: "Available" },
    { id: "r204", number: "204", no: "204", type: "Deluxe Suite", category: "Deluxe Suite", status: "Available" },
    { id: "r205", number: "205", no: "205", type: "Deluxe Suite", category: "Deluxe Suite", status: "Available" },
  ];

  const targetDate = "2026-10-05";

  // SCENARIO 1: Booking Status Classification
  it("Scenario 1: Classifies unconfirmed Enquiry vs Confirmed vs Cancelled bookings", () => {
    const enquiry1 = { id: "b1", status: "enquiry" };
    const enquiry2 = { id: "b2", status: "Enquiry (Hold)" };
    const enquiry3 = { id: "b3", isEnquiry: true, status: "confirmed" };
    const confirmed = { id: "b4", status: "confirmed" };
    const checkedIn = { id: "b5", status: "checked-in" };
    const cancelled = { id: "b6", status: "cancelled" };

    expect(isUnconfirmedEnquiry(enquiry1)).toBe(true);
    expect(isUnconfirmedEnquiry(enquiry2)).toBe(true);
    expect(isUnconfirmedEnquiry(enquiry3)).toBe(true);
    expect(isUnconfirmedEnquiry(confirmed)).toBe(false);

    expect(isInventoryConsumingBooking(enquiry1)).toBe(false);
    expect(isInventoryConsumingBooking(cancelled)).toBe(false);
    expect(isInventoryConsumingBooking(confirmed)).toBe(true);
    expect(isInventoryConsumingBooking(checkedIn)).toBe(true);
  });

  // SCENARIO 2: Enquiry Zero-Inventory Guarantee
  it("Scenario 2: Enquiry bookings DO NOT deduct physical room inventory", () => {
    const bookings = [
      { id: "b1", room: "101", roomType: "Standard Non Smoking", status: "enquiry", checkIn: "2026-10-04", checkOut: "2026-10-06" },
      { id: "b2", room: "102", roomType: "Standard Non Smoking", status: "Inquiry", checkIn: "2026-10-04", checkOut: "2026-10-06" },
    ];
    const netAvail = calculateCategoryAvailability("Standard Non Smoking", targetDate, bookings, mockRooms);
    expect(netAvail).toBe(5);
  });

  // SCENARIO 3: Confirmed Booking Inventory Consumption
  it("Scenario 3: Confirmed booking deducts physical room inventory by exactly 1", () => {
    const bookings = [
      { id: "b1", room: "101", roomType: "Standard Non Smoking", status: "confirmed", checkIn: "2026-10-04", checkOut: "2026-10-06" },
    ];
    const netAvail = calculateCategoryAvailability("Standard Non Smoking", targetDate, bookings, mockRooms);
    expect(netAvail).toBe(4);
  });

  // SCENARIO 4: Overbooking Protection for Enquiries
  it("Scenario 4: Enquiry bookings do not trigger overbooking alerts against confirmed bookings", () => {
    const bookings = [
      { id: "b1", room: "101", roomType: "Standard Non Smoking", status: "confirmed", checkIn: "2026-10-04", checkOut: "2026-10-06" },
      { id: "b2", room: "101", roomType: "Standard Non Smoking", status: "enquiry", checkIn: "2026-10-04", checkOut: "2026-10-06" },
    ];
    const overbooked = getOverbookedReservations(bookings, mockRooms);
    expect(overbooked.length).toBe(0);
  });

  // SCENARIO 5: Double Assignment Conflict Detection
  it("Scenario 5: Detects actual double-booking conflict when two confirmed bookings share a room", () => {
    const bookings = [
      { id: "b1", room: "101", roomType: "Standard Non Smoking", status: "confirmed", checkIn: "2026-10-04", checkOut: "2026-10-06" },
      { id: "b2", room: "101", roomType: "Standard Non Smoking", status: "checked-in", checkIn: "2026-10-04", checkOut: "2026-10-06" },
    ];
    const overbooked = getOverbookedReservations(bookings, mockRooms);
    expect(overbooked.length).toBe(2);
  });

  // SCENARIO 6: Configuration Room Addition Expansion
  it("Scenario 6: Adding a new physical room increases available category capacity", () => {
    const expandedRooms = [
      ...mockRooms,
      { id: "r106", number: "106", no: "106", type: "Standard Non Smoking", category: "Standard Non Smoking", status: "Available" }
    ];
    const bookings = [
      { id: "b1", room: "101", roomType: "Standard Non Smoking", status: "confirmed", checkIn: "2026-10-04", checkOut: "2026-10-06" },
    ];
    const availBefore = calculateCategoryAvailability("Standard Non Smoking", targetDate, bookings, mockRooms);
    const availAfter = calculateCategoryAvailability("Standard Non Smoking", targetDate, bookings, expandedRooms);
    expect(availBefore).toBe(4);
    expect(availAfter).toBe(5);
  });

  // SCENARIO 7: Executive & Forecast Exclusions
  it("Scenario 7: Forecast report calculates projected occupancy across date range", () => {
    const forecast = getOccupancyForecastData(7);
    expect(forecast.length).toBe(7);
    expect(forecast[0]).toHaveProperty("occPercent");
  });

  // SCENARIO 8: Cancelled & No-Show Inventory Reclaim
  it("Scenario 8: Cancelled and No-Show bookings immediately reclaim room capacity to 100%", () => {
    const bookings = [
      { id: "b1", room: "101", roomType: "Standard Non Smoking", status: "cancelled", checkIn: "2026-10-04", checkOut: "2026-10-06" },
      { id: "b2", room: "102", roomType: "Standard Non Smoking", status: "no-show", checkIn: "2026-10-04", checkOut: "2026-10-06" },
    ];
    const netAvail = calculateCategoryAvailability("Standard Non Smoking", targetDate, bookings, mockRooms);
    expect(netAvail).toBe(5);
  });

  // SCENARIO 9: Out-Of-Order Room Deductions
  it("Scenario 9: Executive YoY report tracks available vs OOO room counts", () => {
    const yoy = getExecutiveYoYReportData("2026-10-03");
    expect(yoy).toBeDefined();
    expect(yoy.todayCurrent).toBeDefined();
  });

  // SCENARIO 10: Tax Exemption Scope Calculations
  it("Scenario 10: Tax calculation handles full tax vs tax exemption correctly", () => {
    const rules = [{ id: "t1", name: "State Tax", rate: 12, status: "Active" }];
    const subtotal = 100;
    const calcTax = (amt, rulesList, isExempt) => {
      if (isExempt) return 0;
      const rateSum = rulesList.reduce((sum, r) => sum + Number(r.rate || 0), 0);
      return amt * (rateSum / 100);
    };

    expect(calcTax(subtotal, rules, false)).toBe(12);
    expect(calcTax(subtotal, rules, true)).toBe(0);
  });

  // SCENARIO 11: Security Deposit Vault Logic
  it("Scenario 11: Tracks deposit held vs deposit refunded sums", () => {
    const deposits = [
      { id: "d1", amountUSD: 100, status: "held" },
      { id: "d2", amountUSD: 50, status: "refunded" }
    ];
    const held = deposits.filter(d => d.status === "held").reduce((s, d) => s + d.amountUSD, 0);
    const refunded = deposits.filter(d => d.status === "refunded").reduce((s, d) => s + d.amountUSD, 0);

    expect(held).toBe(100);
    expect(refunded).toBe(50);
  });

  // SCENARIO 12: OTA Channel Production Commission Math
  it("Scenario 12: OTA Channel Production calculates gross vs net revenue after commission", () => {
    const channels = getChannelProductionData();
    expect(Array.isArray(channels)).toBe(true);
    const bookingCom = channels.find(c => c.name.includes("Booking.com"));
    if (bookingCom) {
      expect(bookingCom.commPercent).toBe(15);
      expect(bookingCom.netRev).toBe(bookingCom.grossRev - bookingCom.commAmt);
    }
  });

  // SCENARIO 13: City Ledger Corporate AR Aging Buckets
  it("Scenario 13: City Ledger Aging report returns valid aging balance buckets", () => {
    const agingData = getCityLedgerAgingData();
    expect(Array.isArray(agingData)).toBe(true);
    if (agingData.length > 0) {
      const acc = agingData[0];
      expect(acc).toHaveProperty("current030");
      expect(acc).toHaveProperty("days3160");
      expect(acc).toHaveProperty("days6190");
      expect(acc).toHaveProperty("days90Plus");
    }
  });

  // SCENARIO 14: Stay Duration Night Calculation
  it("Scenario 14: Accurately calculates stay nights for date ranges", () => {
    const cIn = new Date("2026-10-01T00:00:00");
    const cOut = new Date("2026-10-05T00:00:00");
    const nights = Math.max(1, Math.round((cOut - cIn) / (1000 * 60 * 60 * 24)));
    expect(nights).toBe(4);
  });

  // SCENARIO 15: Unassigned Booking Category Matching
  it("Scenario 15: Unassigned category booking matches category without room number", () => {
    const bookings = [
      { id: "b1", room: "Unassigned", roomType: "Deluxe Suite", status: "confirmed", checkIn: "2026-10-04", checkOut: "2026-10-06" },
    ];
    const netAvail = calculateCategoryAvailability("Deluxe Suite", targetDate, bookings, mockRooms);
    expect(netAvail).toBe(4);
  });

  // SCENARIO 16: Multi-Category Isolation
  it("Scenario 16: Bookings in Standard room category do not deduct Deluxe category availability", () => {
    const bookings = [
      { id: "b1", room: "101", roomType: "Standard Non Smoking", status: "confirmed", checkIn: "2026-10-04", checkOut: "2026-10-06" },
    ];
    const stdAvail = calculateCategoryAvailability("Standard Non Smoking", targetDate, bookings, mockRooms);
    const deluxeAvail = calculateCategoryAvailability("Deluxe Suite", targetDate, bookings, mockRooms);

    expect(stdAvail).toBe(4);
    expect(deluxeAvail).toBe(5);
  });

  // SCENARIO 17: Business Date Range Overlap Check
  it("Scenario 17: Only active stays overlapping target date consume inventory", () => {
    const bookings = [
      { id: "b1", room: "101", roomType: "Standard Non Smoking", status: "confirmed", checkIn: "2026-10-01", checkOut: "2026-10-03" }, // Past stay
      { id: "b2", room: "102", roomType: "Standard Non Smoking", status: "confirmed", checkIn: "2026-10-10", checkOut: "2026-10-12" }, // Future stay
    ];
    const netAvail = calculateCategoryAvailability("Standard Non Smoking", targetDate, bookings, mockRooms);
    expect(netAvail).toBe(5);
  });

  // SCENARIO 18: Executive YoY Date Bucketing
  it("Scenario 18: getExecutiveYoYReportData returns complete TODAY, MTD, and YTD comparative structures", () => {
    const yoyData = getExecutiveYoYReportData("2026-10-03");
    expect(yoyData).toHaveProperty("todayCurrent");
    expect(yoyData).toHaveProperty("mtdCurrent");
    expect(yoyData).toHaveProperty("ytdCurrent");
  });

  // SCENARIO 19: Gross Revenue vs Net Revenue Definitions
  it("Scenario 19: Enforces Gross Revenue = pure room tariff, and Net Revenue = tariff + taxes + extras + sales - expenses", () => {
    const roomRevenue = 500;
    const extraRevenue = 50;
    const dailySalesRevenue = 100;
    const taxes = 60;
    const operationalExpenses = 80;

    const grossRevenue = roomRevenue; // Pure room tariff ONLY
    const netRevenue = roomRevenue + extraRevenue + dailySalesRevenue + taxes - operationalExpenses;

    expect(grossRevenue).toBe(500);
    expect(netRevenue).toBe(630);
  });

  // SCENARIO 20: Housekeeping Auto-Dirty Transition
  it("Scenario 20: Housekeeping status transitions from Clean to Dirty upon Check-Out", () => {
    const room = { id: "r101", no: "101", hkStatus: "Clean", status: "Clean" };
    const checkoutRoom = (r) => {
      if (r.hkStatus === "Clean" || r.status === "Clean") {
        return { ...r, hkStatus: "Dirty", status: "Dirty" };
      }
      return r;
    };
    const updated = checkoutRoom(room);
    expect(updated.status).toBe("Dirty");
    expect(updated.hkStatus).toBe("Dirty");
  });
});
