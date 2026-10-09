import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import FolioModal from "../components/FolioModal";

const mockBooking = {
  id: "b202",
  guest: "Sophia Martinez",
  room: "302",
  roomType: "Luxury Suite",
  checkIn: "2026-08-10",
  checkOut: "2026-08-13",
  ratePerNight: 8000,
  nights: 3,
  subtotal: 24000,
  taxPercent: 12,
  taxAmount: 2880,
  totalAmount: 26880,
  advanceAmount: 0,
  balanceDue: 26880,
  payments: [],
  extras: [],
  deposits: [
    { id: "dep-1", amount: 500, mode: "Cash", note: "Damage deposit", status: "held", date: "2026-08-10" }
  ],
  depositBalance: 500,
};

const mockRooms = [
  { no: "302", type: "Luxury Suite", status: "occupied" },
  { no: "303", type: "Executive Deluxe", status: "available" },
];

describe("FolioModal Ledger Workspace & Operations Component", () => {
  it("Renders 3-Column Ledger Table Headers (Excl. Tax, Tax Amount, Total Incl. Tax)", () => {
    render(
      <FolioModal
        isOpen={true}
        booking={mockBooking}
        rooms={mockRooms}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Excl. Tax \(\$\)/i)).toBeDefined();
    expect(screen.getByText(/Tax Amount \(\$\)/i)).toBeDefined();
    expect(screen.getByText(/Total Incl. Tax \(\$\)/i)).toBeDefined();
  });

  it("Triggers Transfer Balance Submodal on button click", () => {
    render(
      <FolioModal
        isOpen={true}
        booking={mockBooking}
        rooms={mockRooms}
        onClose={vi.fn()}
      />
    );

    const xferBtn = screen.getByRole("button", { name: /Transfer Balance/i });
    fireEvent.click(xferBtn);

    expect(screen.getByText(/Transfer Balance to/i)).toBeDefined();
  });


  it("Renders Security Deposit row in Master Ledger Table with interactive action buttons", () => {
    render(
      <FolioModal
        isOpen={true}
        booking={mockBooking}
        rooms={mockRooms}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Security Deposit \(Cash\)/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /✏️ Edit/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /💳 Apply/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /💸 Refund/i })).toBeDefined();
  });
});
