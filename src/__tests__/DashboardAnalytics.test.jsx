import { dataStore } from "../services/dataStore";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import Dashboard from "../pages/Dashboard";

// Mock API service calls
vi.mock("../services/api", () => ({
  getBookings: vi.fn().mockResolvedValue([
    { id: "b1", status: "checked-in", roomType: "Deluxe Suite", isDeleted: false },
    { id: "b2", status: "occupied", roomType: "King Room", isDeleted: false }
  ]),
  getRooms: vi.fn().mockResolvedValue([
    { id: "r1", number: "101", type: "Deluxe Suite" },
    { id: "r2", number: "102", type: "King Room" },
    { id: "r3", number: "103", type: "Standard" }
  ])
}));

describe("Dashboard Analytics Self-Test Suite", () => {
  beforeEach(() => {
    dataStore.clear();
    vi.clearAllMocks();
  });

  it("1. Renders main Dashboard widgets and headers correctly", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Hotel Operations Dashboard/i)).toBeTruthy();
    });

    expect(screen.getByText(/^Revenue$/i)).toBeTruthy();
    expect(screen.getByText(/OCCUPANCY TODAY/i)).toBeTruthy();
    expect(screen.getByText(/^Reservations$/i)).toBeTruthy();
    expect(screen.getByText(/Booking by Platform/i)).toBeTruthy();
    expect(screen.getByText(/Income/i)).toBeTruthy();
    expect(screen.getByText(/^Tasks$/i)).toBeTruthy();
    expect(screen.getByText(/Rooms Occupied vs Date/i)).toBeTruthy();
  });

  it("2. Toggles Financial Breakdown tabs between Expense and Income", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Total.*Expense/i)).toBeTruthy();
    });

    const incomeBtn = screen.getByRole("button", { name: /^Income$/i });
    fireEvent.click(incomeBtn);

    expect(screen.getByText(/Total.*Income/i)).toBeTruthy();
    expect(screen.getByText(/Room Tariff/i)).toBeTruthy();

    const expenseBtn = screen.getByRole("button", { name: /^Expense$/i });
    fireEvent.click(expenseBtn);

    expect(screen.getByText(/Total.*Expense/i)).toBeTruthy();
    expect(screen.getByText(/Housekeeping & Cleaning/i)).toBeTruthy();
  });

  it("3. Toggles task completed status and persists to localStorage", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Set Up Conference Room B/i)).toBeTruthy();
    });

    const checkBtns = screen.getAllByTitle(/Mark as Completed/i);
    expect(checkBtns.length).toBeGreaterThan(0);
    fireEvent.click(checkBtns[0]);

    const saved = JSON.parse(dataStore.getItem("pms_dashboard_tasks") || "[]");
    expect(saved.some((t) => t.id === 't1' && t.completed)).toBe(true);
  });

  it("4. Opens Add Task modal, creates a new task, and renders it in timeline", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/\+ Add Operation Task/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/\+ Add Operation Task/i));

    expect(screen.getByText(/Add New Hotel Operation Task/i)).toBeTruthy();

    const input = screen.getByPlaceholderText(/e\.g\. Inspect Room 204 AC unit/i);
    fireEvent.change(input, { target: { value: "Perform monthly fire safety check" } });

    fireEvent.click(screen.getByRole("button", { name: /^Add Task$/i }));

    expect(screen.getByText("Perform monthly fire safety check")).toBeTruthy();
    const saved = JSON.parse(dataStore.getItem("pms_dashboard_tasks") || "[]");
    expect(saved.some((t) => t.title === "Perform monthly fire safety check")).toBe(true);
  });

  it("5. Deletes a task when the trash button is clicked", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Restock Housekeeping Supplies/i)).toBeTruthy();
    });

    const deleteBtns = screen.getAllByTitle(/Delete Task/i);
    expect(deleteBtns.length).toBeGreaterThan(0);
    fireEvent.click(deleteBtns[0]);

    const saved = JSON.parse(dataStore.getItem("pms_dashboard_tasks") || "[]");
    expect(saved.some((t) => t.id === 't1')).toBe(false);
  });

  it("6. Switches Rooms Occupied trend view between Daily 30D and Monthly", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Daily 30D/i)).toBeTruthy();
    });

    const monthlyBtn = screen.getByRole("button", { name: /^Monthly$/i });
    fireEvent.click(monthlyBtn);

    expect(screen.getByText(/Monthly trend breakdown/i)).toBeTruthy();

    const dailyBtn = screen.getByRole("button", { name: /^Daily 30D$/i });
    fireEvent.click(dailyBtn);

    expect(screen.getByText(/Last 30 days — real-time occupied/i)).toBeTruthy();
  });
});
