import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import WalkinGuest, { isAddonPerNight } from "../pages/frontdesk/WalkinGuest";

const mockRooms = [
  { no: "101", type: "Deluxe King", status: "available" },
  { no: "102", type: "Luxury Suite", status: "available" },
];

const mockRoomTypes = [
  { name: "Deluxe King", price: 5000 },
  { name: "Luxury Suite", price: 8000 },
];

describe("WalkinGuest Component", () => {
  it("Renders WalkinGuest form in modal mode (embedded=true)", () => {
    render(<WalkinGuest rooms={mockRooms} roomTypes={mockRoomTypes} embedded={true} initialRoomNo="101" />);
    expect(screen.getByText(/1. Stay Details/i)).toBeDefined();
    expect(screen.getAllByText(/Deluxe King/i).length).toBeGreaterThan(0);
  });

  it("Renders Price Details section directly on single page", () => {
    render(<WalkinGuest rooms={mockRooms} roomTypes={mockRoomTypes} embedded={true} initialRoomNo="101" />);
    const priceSection = screen.getByText(/4. Price Details/i);
    expect(priceSection).toBeDefined();
  });

  it("Auto-populates non-zero room rate for commercial rooms with numeric initialRoomNo", () => {
    const rooms = [{ no: 101, type: "Deluxe King", status: "available" }];
    const roomTypes = [{ name: "Deluxe King", price: 175.50 }];
    render(<WalkinGuest rooms={rooms} roomTypes={roomTypes} embedded={true} initialRoomNo="101" />);
    const rateInputs = screen.getAllByDisplayValue("175.50");
    expect(rateInputs.length).toBeGreaterThan(0);
  });

  it("Auto-populates $0 rate for Virtual / Staff room types", () => {
    const rooms = [{ no: "V1", type: "Staff Room", status: "available" }];
    const roomTypes = [{ name: "Staff Room", price: 0, isVirtual: true }];
    render(<WalkinGuest rooms={rooms} roomTypes={roomTypes} embedded={true} initialRoomNo="V1" />);
    const rateInputs = screen.getAllByDisplayValue("0.00");
    expect(rateInputs.length).toBeGreaterThan(0);
  });

  it("Correctly identifies per-night add-ons using isAddonPerNight", () => {
    expect(isAddonPerNight({ billingType: "Per Night" })).toBe(true);
    expect(isAddonPerNight({ pricingType: "per_night" })).toBe(true);
    expect(isAddonPerNight({ postingType: "Daily" })).toBe(true);
    expect(isAddonPerNight({ perNight: true })).toBe(true);
    expect(isAddonPerNight({ billingType: "Per Stay" })).toBe(false);
    expect(isAddonPerNight({ pricingType: "per_stay" })).toBe(false);
  });

  it("Validates Credit/Debit card numbers with Luhn check, brand detection, and expiry validation", async () => {
    const { isValidCardNumber, detectCardBrand, isValidCardExpiry, isValidCardCvv, formatCardNumberInput, formatCardExpiryInput } = await import("../services/paymentGatewayService");
    
    expect(isValidCardNumber("4242424242424242")).toBe(true);
    expect(isValidCardNumber("1234567812345671")).toBe(false);

    expect(detectCardBrand("4242424242424242").brand).toBe("Visa");
    expect(detectCardBrand("5105105105105100").brand).toBe("MasterCard");
    expect(detectCardBrand("378282246310005").brand).toBe("Amex");

    expect(isValidCardExpiry("12/30")).toBe(true);
    expect(isValidCardExpiry("01/20")).toBe(false);

    expect(isValidCardCvv("123")).toBe(true);
    expect(isValidCardCvv("1234", true)).toBe(true);

    expect(formatCardNumberInput("4242424242424242")).toBe("4242 4242 4242 4242");
    expect(formatCardNumberInput("378282246310005")).toBe("3782 822463 10005");
    expect(formatCardExpiryInput("1230")).toBe("12/30");
  });

  it("Auto-formats US phone numbers and validates 10-digit requirement", async () => {
    const { formatPhoneNumberInput, isValidPhoneNumber } = await import("../pages/frontdesk/WalkinGuest");
    expect(formatPhoneNumberInput("3105550199")).toBe("(310) 555-0199");
    expect(isValidPhoneNumber("3105550199")).toBe(true);
    expect(isValidPhoneNumber("310555")).toBe(false);
  });

  it("Ensures formatUSD handles floating-point -0 and NaN safely", async () => {
    const { formatUSD } = await import("../utils/formatters");
    expect(formatUSD(0)).toBe("$0.00");
    expect(formatUSD(-0.0000001)).toBe("$0.00");
    expect(formatUSD(NaN)).toBe("$0.00");
  });
});
