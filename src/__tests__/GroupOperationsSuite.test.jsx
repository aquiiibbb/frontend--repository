import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GroupOperationsModal from "../components/GroupOperationsModal";
import * as api from "../services/api";

vi.mock("../services/api", () => ({
  updateBooking: vi.fn().mockResolvedValue({ id: "bk-1", status: "checked-in" }),
}));

describe("GroupOperationsModal — 6 Group Master Actions Test Suite", () => {
  const mockBookings = [
    {
      id: "bk-g-1",
      groupId: "grp_1001",
      groupName: "Sharma Wedding Party",
      guest: "Raj Sharma",
      room: "101",
      roomType: "Single Queen",
      checkIn: "2026-08-25",
      checkOut: "2026-08-27",
      status: "confirmed",
      totalAmount: 200,
      balanceDue: 200,
      nights: 2,
      ratePerNight: 100,
    },
    {
      id: "bk-g-2",
      groupId: "grp_1001",
      groupName: "Sharma Wedding Party",
      guest: "Priya Sharma",
      room: "102",
      roomType: "Single Queen",
      checkIn: "2026-08-25",
      checkOut: "2026-08-27",
      status: "confirmed",
      totalAmount: 200,
      balanceDue: 200,
      nights: 2,
      ratePerNight: 100,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders group header, room counts, and total group revenue", () => {
    render(
      <GroupOperationsModal
        isOpen={true}
        onClose={vi.fn()}
        groupId="grp_1001"
        groupName="Sharma Wedding Party"
        bookingsList={mockBookings}
      />
    );

    expect(screen.getByText("🏢 Group Master Operations")).toBeTruthy();
    expect(screen.getByText("Sharma Wedding Party")).toBeTruthy();
    expect(screen.getByText("2 Rooms")).toBeTruthy();
    expect(screen.getAllByText("$400.00").length).toBeGreaterThan(0);
  });

  it("triggers Express Group Check-In for all confirmed group rooms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onComplete = vi.fn();

    render(
      <GroupOperationsModal
        isOpen={true}
        onClose={vi.fn()}
        groupId="grp_1001"
        groupName="Sharma Wedding Party"
        bookingsList={mockBookings}
        onGroupActionComplete={onComplete}
      />
    );

    const checkInBtn = screen.getByText(/Express Check-In Group/i);
    fireEvent.click(checkInBtn);

    await waitFor(() => {
      expect(api.updateBooking).toHaveBeenCalledTimes(2);
      expect(api.updateBooking).toHaveBeenCalledWith("bk-g-1", expect.objectContaining({ status: "checked-in" }));
      expect(api.updateBooking).toHaveBeenCalledWith("bk-g-2", expect.objectContaining({ status: "checked-in" }));
    });
  });

  it("triggers Group Master Payment processing", async () => {
    const onComplete = vi.fn();

    render(
      <GroupOperationsModal
        isOpen={true}
        onClose={vi.fn()}
        groupId="grp_1001"
        groupName="Sharma Wedding Party"
        bookingsList={mockBookings}
        onGroupActionComplete={onComplete}
      />
    );

    // Open Payment Modal
    const payBtn = screen.getByText(/Group Master Payment/i);
    fireEvent.click(payBtn);

    // Enter Amount
    const amountInput = screen.getByPlaceholderText("e.g. 500.00");
    fireEvent.change(amountInput, { target: { value: "300" } });

    // Submit Payment
    const processBtn = screen.getByText("Process Group Payment");
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(api.updateBooking).toHaveBeenCalled();
    });
  });
});
