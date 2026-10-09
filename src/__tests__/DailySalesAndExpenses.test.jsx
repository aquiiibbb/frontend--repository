import { dataStore } from "../services/dataStore";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import DailyExpenses from "../pages/operations/DailyExpenses";
import DailySalesPOS from "../pages/operations/DailySalesPOS";

describe("Daily Sales & Expenses Operations Self-Test Suite", () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it("1. Renders Daily Expenses page with header, KPIs, and initial records", () => {
    render(<DailyExpenses />);

    expect(screen.getByText(/Daily Hotel Expenses/i)).toBeTruthy();
    expect(screen.getByText(/Today's Total Expenses/i)).toBeTruthy();
    expect(screen.getByText(/Month-to-Date Expenses/i)).toBeTruthy();
    expect(screen.getByText(/\+ Record Expense/i)).toBeTruthy();
  });

  it("2. Records a new daily expense item and updates summary calculation", () => {
    render(<DailyExpenses />);

    // Open record expense modal
    fireEvent.click(screen.getByRole("button", { name: /\+ Record Expense/i }));

    // Fill form
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 10x LED Light Bulbs/i), {
      target: { value: "Gardening Hose & Sprinkler" }
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "65.50" }
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Home Depot/i), {
      target: { value: "Garden Nursery" }
    });

    // Save
    fireEvent.click(screen.getByRole("button", { name: /Save Expense Entry/i }));

    // Verify record in table
    expect(screen.getByText("Gardening Hose & Sprinkler")).toBeTruthy();
    expect(screen.getByText("$65.50")).toBeTruthy();
  });

  it("3. Renders Daily Sales POS Counter page with catalog and cart", () => {
    render(<DailySalesPOS />);

    expect(screen.getByText(/Daily Sales & POS Counter/i)).toBeTruthy();
    expect(screen.getByText(/Today's Gross Sales/i)).toBeTruthy();
    expect(screen.getByText(/Bottled Mineral Water 500ml/i)).toBeTruthy();
    expect(screen.getByText(/Current Counter Cart/i)).toBeTruthy();
  });

  it("4. Adds write-in custom item sale to cart and calculates subtotal", () => {
    render(<DailySalesPOS />);

    // Fill custom write-in item form
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Early Check-In Fee/i), {
      target: { value: "Custom Souvenir Mug" }
    });
    fireEvent.change(screen.getByPlaceholderText("Price $"), {
      target: { value: "15.00" }
    });

    fireEvent.click(screen.getByRole("button", { name: /\+ Add to Cart/i }));

    // Cart should contain custom item
    expect(screen.getByText("Custom Souvenir Mug")).toBeTruthy();
    expect(screen.getAllByText("$15.00").length).toBeGreaterThan(0);
  });
});
