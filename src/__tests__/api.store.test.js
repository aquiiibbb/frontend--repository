import { describe, it, expect, beforeEach } from "vitest";
import {
  getRooms,
  getRoomTypes,
  createBooking,
  splitStayBooking,
  transferBalance,
  addDeposit,
  refundDeposit,
  applyDepositToFolio,
  updateDeposit,
  deleteDeposit,
  addExtra,
  addSettlement,
  cancelBooking,
  noShowBooking,
  resetAllData,
} from "../services/api.store";

describe("Hotel PMS API Operations & Business Logic", () => {
  beforeEach(() => {
    const store = {};
    global.localStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    };
    resetAllData();
  });

  it("1. Fetch Initial Rooms & Room Types", async () => {
    const rooms = await getRooms();
    const roomTypes = await getRoomTypes();
    expect(Array.isArray(rooms)).toBe(true);
    expect(Array.isArray(roomTypes)).toBe(true);
  });

  it("2. Create New Standard Reservation & Calculate Dues", async () => {
    const newBookingData = {
      guest: "Test Guest Alpha",
      phone: "+91 99999 11111",
      email: "alpha@example.com",
      room: "101",
      roomType: "Deluxe King",
      checkIn: "2026-08-10",
      checkOut: "2026-08-13",
      ratePerNight: 5000,
      nights: 3,
      subtotal: 15000,
      taxPercent: 12,
      taxAmount: 1800,
      extraCharges: 0,
      totalAmount: 16800,
      advanceAmount: 0,
      balanceDue: 16800,
      paymentStatus: "Pending",
      status: "confirmed",
    };

    const created = await createBooking(newBookingData);
    expect(created.id).toBeDefined();
    expect(created.guest).toBe("Test Guest Alpha");
    expect(created.totalAmount).toBe(16800);
    expect(created.balanceDue).toBe(16800);
  });

  it("3. Create 🎁 Complimentary Room (Zero Tariff)", async () => {
    const compBookingData = {
      guest: "VIP Guest Complimentary",
      phone: "+91 88888 22222",
      room: "102",
      roomType: "Luxury Suite",
      checkIn: "2026-08-10",
      checkOut: "2026-08-12",
      isComplimentary: true,
      ratePerNight: 0,
      nights: 2,
      subtotal: 0,
      taxAmount: 0,
      totalAmount: 0,
      balanceDue: 0,
      status: "confirmed",
    };

    const created = await createBooking(compBookingData);
    expect(created.isComplimentary).toBe(true);
    expect(created.subtotal).toBe(0);
    expect(created.totalAmount).toBe(0);
    expect(created.balanceDue).toBe(0);
  });

  it("4. Mid-Stay Split Stay Transfer (splitStayBooking)", async () => {
    const baseBooking = await createBooking({
      guest: "Split Stay Guest",
      room: "201",
      checkIn: "2026-08-15",
      checkOut: "2026-08-20",
      ratePerNight: 4000,
      nights: 5,
      subtotal: 20000,
      taxAmount: 2400,
      totalAmount: 22400,
    });

    const updated = await splitStayBooking(baseBooking.id, {
      splitDate: "2026-08-17",
      targetRoom: "302",
    });

    expect(updated.splitSegments).toBeDefined();
    expect(updated.splitSegments.length).toBe(2);
    expect(updated.splitSegments[0].room).toBe("201");
    expect(updated.splitSegments[1].room).toBe("302");
    expect(updated.splitSegments[1].checkIn).toBe("2026-08-17");
  });

  it("5. Room-to-Room Balance Transfer (transferBalance)", async () => {
    const b1 = await createBooking({
      guest: "Source Guest A",
      room: "301",
      checkIn: "2026-08-10",
      checkOut: "2026-08-12",
      subtotal: 10000,
      totalAmount: 11200,
      balanceDue: 11200,
    });

    const b2 = await createBooking({
      guest: "Target Guest B",
      room: "302",
      checkIn: "2026-08-10",
      checkOut: "2026-08-12",
      subtotal: 10000,
      totalAmount: 11200,
      balanceDue: 11200,
    });

    const result = await transferBalance(b1.id, {
      targetRoomNo: "302",
      amount: 5000,
      note: "Transferring half balance to Room 302",
    });

    expect(result.sourceBooking).toBeDefined();
    expect(result.targetBooking).toBeDefined();

    // Source booking payments should have a transfer record
    const xferPay = result.sourceBooking.payments.find((p) => p.mode === "Balance Transfer");
    expect(xferPay).toBeDefined();
    expect(xferPay.amount).toBe(5000);

    // Target booking extras should have received the transfer charge
    const xferExtra = result.targetBooking.extras.find((e) => e.label.includes("Balance Transfer"));
    expect(xferExtra).toBeDefined();
    expect(xferExtra.amount).toBe(5000);
  });

  it("6. Security Deposit Operations (Add, Update, Apply, Refund, Delete)", async () => {
    const booking = await createBooking({
      guest: "Deposit Test Guest",
      room: "401",
      checkIn: "2026-08-10",
      checkOut: "2026-08-15",
      subtotal: 20000,
      totalAmount: 22400,
      balanceDue: 22400,
    });

    // 6a. Collect Security Deposit
    const withDep = await addDeposit(booking.id, {
      amount: 500,
      mode: "Cash",
      note: "Damage & keycard deposit",
    });

    expect(withDep.deposits.length).toBe(1);
    expect(withDep.depositBalance).toBe(500);

    const depId = withDep.deposits[0].id;

    // 6b. Update Security Deposit
    const updatedDep = await updateDeposit(booking.id, {
      depositId: depId,
      amount: 750,
      mode: "Card",
      note: "Increased damage deposit",
    });

    expect(updatedDep.depositBalance).toBe(750);
    expect(updatedDep.deposits[0].amount).toBe(750);

    // 6c. Apply Security Deposit to Dues
    const appliedDep = await applyDepositToFolio(booking.id, {
      amount: 250,
      note: "Applying $250 towards room tariff dues",
    });

    expect(appliedDep.depositBalance).toBe(500);

    // 6d. Refund Security Deposit
    const refundedDep = await refundDeposit(booking.id, {
      depositId: depId,
      amount: 500,
      mode: "Cash",
      note: "Returned remaining deposit at checkout",
    });

    expect(refundedDep.depositBalance).toBe(0);

    // 6e. Delete Security Deposit
    const finalBooking = await deleteDeposit(booking.id, depId);
    expect(finalBooking.deposits.length).toBe(0);
  });

  it("7. Post Extra Charge & Settlement Payment", async () => {
    const booking = await createBooking({
      guest: "Incidental Guest",
      room: "501",
      checkIn: "2026-08-10",
      checkOut: "2026-08-12",
      subtotal: 10000,
      totalAmount: 11200,
      balanceDue: 11200,
    });

    // Add Laundry Extra Charge
    const withExtra = await addExtra(booking.id, {
      label: "Express Laundry Service",
      amount: 800,
    });
    expect(withExtra.extras.length).toBe(1);

    // Add Cash Settlement Payment
    const settled = await addSettlement(booking.id, {
      amount: 5000,
      mode: "Cash",
      note: "Partial settlement",
    });
    expect(settled.payments.length).toBe(1);
  });

  it("8. Cancellation & No-Show Policy Execution", async () => {
    const b1 = await createBooking({
      guest: "Cancel Guest",
      room: "502",
      checkIn: "2026-08-10",
      checkOut: "2026-08-12",
      subtotal: 10000,
      totalAmount: 11200,
    });

    const cancelled = await cancelBooking(b1.id, { option: "dont_void" });
    expect(cancelled.status).toBe("cancelled");

    const b2 = await createBooking({
      guest: "No-Show Guest",
      room: "503",
      checkIn: "2026-08-10",
      checkOut: "2026-08-12",
      subtotal: 10000,
      totalAmount: 11200,
    });

    const noShow = await noShowBooking(b2.id, { option: "apply_policy" });
    expect(noShow.status).toBe("no-show");
  });
});
