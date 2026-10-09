import { dataStore } from "../services/dataStore";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import MiscOperations from "../pages/operations/MiscOperations";
import * as mockApi from "../services/api";

describe("Misc Operations Test Suite", () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it("1. Renders Misc page with configured REF ID column and clean state", () => {
    render(<MiscOperations />);

    expect(screen.getAllByText(/Misc/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/REF ID/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add Sale/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add Expense/i })).toBeTruthy();
    expect(screen.getByText(/No miscellaneous transactions logged for/i)).toBeTruthy();
  });

  it("2. Adds a new Misc Daily Sale using configured sequence ID (MSC-1001)", async () => {
    render(<MiscOperations />);

    // Click Add Sale
    fireEvent.click(screen.getByRole("button", { name: /Add Sale/i }));

    // Step 1: Item Name
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Water Bottle, Parking Pass/i), {
      target: { value: "Express Parking Pass" }
    });

    // Step 2: Amount
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "20.00" }
    });

    // Step 3: Settle & Save
    fireEvent.click(screen.getByRole("button", { name: /Save Record/i }));

    await waitFor(() => {
      expect(screen.getByText("Express Parking Pass")).toBeTruthy();
      expect(screen.getByText("MSC-01001")).toBeTruthy();
    });
  });

  it("3. Adds a new Misc Expense using sequence ID (MSC-1002)", async () => {
    render(<MiscOperations />);

    // Click Add Expense
    fireEvent.click(screen.getByRole("button", { name: /Add Expense/i }));

    // Step 1: Item Name
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Cleaning Supplies, Plumber Fee/i), {
      target: { value: "Front Desk Copy Paper" }
    });

    // Step 2: Amount
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "18.50" }
    });

    // Step 3: Settle & Save
    fireEvent.click(screen.getByRole("button", { name: /Save Record/i }));

    await waitFor(() => {
      expect(screen.getByText("Front Desk Copy Paper")).toBeTruthy();
      expect(screen.getByText("MSC-01001")).toBeTruthy();
    });
  });
});
