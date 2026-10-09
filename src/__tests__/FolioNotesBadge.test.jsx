import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import Calendar from "../pages/frontdesk/Calendar";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual("../services/api");
  const mockBooking = {
    id: "BK-1196",
    guest: "Baba Khan",
    room: "3",
    status: "checked-in",
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    notesList: [
      { id: "note-1", text: "Very Important Guest, Handle with Care", author: "Front Desk", createdAt: "2026-09-23T12:16:00.000Z" }
    ],
    notes: "Very Important Guest, Handle with Care",
    totalAmount: 211.86,
    balanceDue: 211.86,
    paidAmount: 0,
    source: "Walk-in"
  };

  const mockRooms = [
    { no: "3", type: "Standard Room", status: "occupied", floor: 1 }
  ];

  return {
    ...actual,
    getBookings: vi.fn().mockResolvedValue([mockBooking]),
    getBookingsSync: vi.fn().mockReturnValue([mockBooking]),
    getRooms: vi.fn().mockResolvedValue(mockRooms),
    getRoomsSync: vi.fn().mockReturnValue(mockRooms),
  };
});

describe("Folio Notes Badge Verification on Room Calendar", () => {
  it("Displays amber message badge on reservation bar when folio notes exist", async () => {
    const { container } = render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );

    await waitFor(() => {
      const amberBadge = container.querySelector(".pro-badge-amber");
      expect(amberBadge).not.toBeNull();
      expect(amberBadge.getAttribute("title")).toContain("Folio Note");
      expect(amberBadge.getAttribute("title")).toContain("Very Important Guest");
    });
  });
});
