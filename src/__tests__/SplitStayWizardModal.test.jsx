import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import SplitStayWizardModal from "../components/SplitStayWizardModal";

const mockBooking = {
  id: "b101",
  guest: "Arthur Pendelton",
  room: "101",
  roomType: "Deluxe King",
  checkIn: "2026-08-10",
  checkOut: "2026-08-15",
  ratePerNight: 5000,
  nights: 5,
  subtotal: 25000,
  totalAmount: 28000,
};

const mockRooms = [
  { no: "101", type: "Deluxe King", price: 5000 },
  { no: "202", type: "Luxury Suite", price: 7500 },
  { no: "303", type: "Executive Deluxe", price: 6000 },
];

const mockRoomTypes = [
  { name: "Deluxe King", price: 5000 },
  { name: "Luxury Suite", price: 7500 },
  { name: "Executive Deluxe", price: 6000 },
];

describe("Split Stay Wizard Modal Component", () => {
  it("Renders Split Stay Wizard modal with Break Date and Target Room selectors", () => {
    render(
      <SplitStayWizardModal
        booking={mockBooking}
        rooms={mockRooms}
        roomTypes={mockRoomTypes}
        onClose={vi.fn()}
        onConfirmSplit={vi.fn()}
      />
    );

    expect(screen.getByText(/Split Stay — Arthur Pendelton/i)).toBeDefined();
    expect(screen.getByText(/From when to break\?/i)).toBeDefined();
    expect(screen.getByText(/Move to which room\?/i)).toBeDefined();
  });

  it("Submits split stay request on confirm button click", () => {
    const handleConfirm = vi.fn();
    render(
      <SplitStayWizardModal
        booking={mockBooking}
        rooms={mockRooms}
        roomTypes={mockRoomTypes}
        onClose={vi.fn()}
        onConfirmSplit={handleConfirm}
      />
    );

    const selects = screen.getAllByRole("combobox");
    // Target room selector is the 2nd combobox
    fireEvent.change(selects[1], { target: { value: "202" } });

    const form = selects[0].closest("form");
    fireEvent.submit(form);

    expect(handleConfirm).toHaveBeenCalled();
  });
});
