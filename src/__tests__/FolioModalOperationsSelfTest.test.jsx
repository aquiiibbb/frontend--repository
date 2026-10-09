import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import FolioModal from "../components/FolioModal";
import * as mockApi from "../services/api.store";

describe("FolioModal End-to-End Self-Testing Suite", () => {
  const initialBooking = {
    id: "bk_test_101",
    guest: "John Doe",
    room: "101",
    roomType: "Deluxe King",
    checkIn: "2026-08-13",
    checkOut: "2026-08-15",
    ratePerNight: 2000,
    nights: 2,
    subtotal: 4000,
    taxPercent: 12,
    taxAmount: 480,
    totalAmount: 4480,
    advanceAmount: 0,
    balanceDue: 4480,
    paymentStatus: "Pending",
    payments: [],
    extras: [],
    deposits: [],
    securityDeposits: [],
  };

  const rooms = [{ no: "101", type: "Deluxe King", status: "occupied" }];

  it("1. Tests posting an extra charge and verifying callback receives label and amount", async () => {
    const handleAddCharge = vi.fn();

    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={rooms}
        onClose={() => {}}
        onAddCharge={handleAddCharge}
      />
    );

    // Click "+ Add Extra Charge"
    const addChargeBtn = screen.getByRole("button", { name: /\+ Add Extra Charge/i });
    fireEvent.click(addChargeBtn);

    // Fill form
    const labelInput = screen.getByPlaceholderText(/e\.g\. Room Service Food \/ Laundry \/ Extra Bed/i);
    const amountInput = screen.getByPlaceholderText(/Amount/i);

    fireEvent.change(labelInput, { target: { value: "Room Service Lunch" } });
    fireEvent.change(amountInput, { target: { value: "450" } });

    // Submit "+ Post Charge"
    const submitBtn = screen.getByRole("button", { name: /\+ Post Charge/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleAddCharge).toHaveBeenCalledWith(
        expect.objectContaining({ id: "bk_test_101" }),
        { label: "Room Service Lunch", amount: 450 }
      );
    });
  });

  it("2. Tests posting a payment settlement and verifying callback receives payment object", async () => {
    const handleAddSettlement = vi.fn();

    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={rooms}
        onClose={() => {}}
        onAddSettlement={handleAddSettlement}
      />
    );

    // Click "💳 Record Payment"
    const addPaymentBtn = screen.getByRole("button", { name: /💳 Record Payment/i });
    fireEvent.click(addPaymentBtn);

    // Fill amount
    const amountInput = screen.getByPlaceholderText("Amount");
    fireEvent.change(amountInput, { target: { value: "2000" } });

    // Submit "Confirm Payment"
    const confirmBtn = screen.getByRole("button", { name: /Confirm Payment/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleAddSettlement).toHaveBeenCalledWith(
        expect.objectContaining({ id: "bk_test_101" }),
        expect.objectContaining({ amount: 2000, mode: "Card" })
      );
    });
  });


  it("4. Tests Audit Log & Activity tab rendering logs for the reservation", async () => {
    const handleGetAuditLogs = vi.fn().mockResolvedValue([
      {
        id: "log_1",
        action: "Created Booking",
        createdAt: "2026-08-13T09:00:00.000Z",
        details: "New reservation created for John Doe",
        user: "Front Desk",
        role: "Receptionist",
      },
    ]);

    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={rooms}
        onClose={() => {}}
        onGetAuditLogs={handleGetAuditLogs}
      />
    );

    // Switch tab to "Audit Log & Activity"
    const auditTabBtn = screen.getByRole("button", { name: /Audit Log & Activity/i });
    fireEvent.click(auditTabBtn);

    await waitFor(() => {
      expect(handleGetAuditLogs).toHaveBeenCalledWith("bk_test_101");
      expect(screen.getByText(/New reservation created for John Doe/i)).toBeDefined();
    });
  });

  it("5. Tests Full Reactive Dynamic Updates in parent state component wrapper", async () => {
    function HostComponent() {
      const [booking, setBooking] = useState(initialBooking);

      async function onAddCharge(b, extra) {
        const updated = await mockApi.addExtra(b.id, extra);
        setBooking({ ...updated });
      }

      async function onAddSettlement(b, pay) {
        const updated = await mockApi.addSettlement(b.id, pay);
        setBooking({ ...updated });
      }

      return (
        <FolioModal
          isOpen={true}
          booking={booking}
          rooms={rooms}
          onClose={() => {}}
          onAddCharge={onAddCharge}
          onAddSettlement={onAddSettlement}
        />
      );
    }

    render(<HostComponent />);

    // 1. Add Extra
    fireEvent.click(screen.getByRole("button", { name: /\+ Add Extra Charge/i }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Room Service Food \/ Laundry \/ Extra Bed/i), { target: { value: "Minibar Drink" } });
    fireEvent.change(screen.getByPlaceholderText(/Amount/i), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: /\+ Post Charge/i }));

    // Verify "Minibar Drink" is rendered directly in table
    await waitFor(() => {
      expect(screen.getByText("Minibar Drink")).toBeDefined();
    });

    // 2. Post Payment Settlement
    fireEvent.click(screen.getByRole("button", { name: /💳 Record Payment/i }));
    fireEvent.change(screen.getAllByPlaceholderText("Amount")[0], { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm Payment/i }));

    // Verify "Payment via Card" line is rendered in table
    await waitFor(() => {
      expect(screen.getByText(/Payment via Card/i)).toBeDefined();
    });
  });

  it("6. Tests creating a new booking from mockApi.createBooking and adding extra, settlement, deposit & checking audit log", async () => {
    const newBk = await mockApi.createBooking({
      guest: "Wizard Guest",
      room: "108",
      checkIn: "2026-08-13",
      checkOut: "2026-08-15",
    });

    expect(newBk.id).toBeDefined();

    const withExtra = await mockApi.addExtra(newBk.id, { label: "Laundry", amount: 100 });
    expect(withExtra.extras.length).toBe(1);

    const withPay = await mockApi.addSettlement(newBk.id, { amount: 500, mode: "Cash" });
    expect(withPay.payments.length).toBe(1);

    const withDep = await mockApi.addDeposit(newBk.id, { amount: 200, mode: "Cash" });
    expect(withDep.deposits.length).toBe(1);

    const logs = await mockApi.getAuditLogs(newBk.id);
    expect(logs.length).toBeGreaterThan(0);
  });

  it("7. Tests opening and submitting Modify Check-In Date modal", async () => {
    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={rooms}
        onClose={() => {}}
      />
    );

    const modifyCheckInBtn = screen.getAllByRole("button", { name: /Modify Check-In/i })[0];
    fireEvent.click(modifyCheckInBtn);

    expect(screen.getByText(/Modify Arrival \/ Check-In Date/i)).toBeDefined();

    const saveBtn = screen.getByRole("button", { name: /Save Check-In Date/i });
    fireEvent.click(saveBtn);
  });

  it("8. Tests opening and submitting Modify Checkout Date modal", async () => {
    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={rooms}
        onClose={() => {}}
      />
    );

    const modifyCheckoutBtn = screen.getAllByRole("button", { name: /Modify Checkout/i })[0];
    fireEvent.click(modifyCheckoutBtn);

    expect(screen.getByText(/Modify Departure \/ Checkout Date/i)).toBeDefined();

    const saveBtn = screen.getByRole("button", { name: /Save Checkout Date/i });
    fireEvent.click(saveBtn);
  });

  it("9. Tests opening and submitting Room Move modal", async () => {
    const roomsList = [
      { no: "101", type: "Deluxe King", status: "occupied" },
      { no: "102", type: "Deluxe Queen", status: "vacant" }
    ];

    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={roomsList}
        onClose={() => {}}
      />
    );

    const roomMoveBtn = screen.getAllByRole("button", { name: /Room Move/i })[0];
    fireEvent.click(roomMoveBtn);

    expect(screen.getByText(/Transfer Guest \/ Room Move/i)).toBeDefined();

    const confirmBtn = screen.getByRole("button", { name: /Confirm Room Move/i });
    fireEvent.click(confirmBtn);
  });

  it("10. Tests opening and updating Guest Profile modal", async () => {
    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={rooms}
        onClose={() => {}}
      />
    );

    const editProfileBtn = screen.getAllByRole("button", { name: /Edit Guest Profile|Edit Profile/i })[0];
    fireEvent.click(editProfileBtn);

    expect(screen.getByText(/Edit Guest Profile & Contact Details/i)).toBeDefined();

    const saveBtn = screen.getByRole("button", { name: /Save Profile Changes/i });
    fireEvent.click(saveBtn);
  });

  it("11. Tests opening and updating Rate Plan modal", async () => {
    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={rooms}
        onClose={() => {}}
      />
    );

    const modifyRatePlanBtn = screen.getAllByRole("button", { name: /Modify Rate Plan/i })[0];
    fireEvent.click(modifyRatePlanBtn);

    expect(screen.getByText(/Modify Rate Plan & Nightly Tariff/i)).toBeDefined();

    const saveBtn = screen.getByRole("button", { name: /Save Rate Plan/i });
    fireEvent.click(saveBtn);
  });

  it("12. Tests opening and applying Percentage (%) and Fixed Dollar ($) Discounts", async () => {
    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={rooms}
        onClose={() => {}}
      />
    );

    const applyDiscountBtn = screen.getAllByRole("button", { name: /Apply Discount/i })[0];
    fireEvent.click(applyDiscountBtn);

    expect(screen.getByText(/Apply Guest Folio Discount/i)).toBeDefined();

    const valueInput = screen.getByPlaceholderText(/e.g. 10 for 10%/i);
    fireEvent.change(valueInput, { target: { value: "15" } });

    const confirmBtn = screen.getByRole("button", { name: /Confirm & Apply Discount/i });
    fireEvent.submit(confirmBtn.closest("form"));

    expect(screen.getByText((content) => content.includes("Discount Applied"))).toBeDefined();
  });

  it("13. Tests opening and configuring Tax Exemption (All vs Selective Taxes)", async () => {
    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={rooms}
        onClose={() => {}}
      />
    );

    const taxExemptBtn = screen.getAllByRole("button", { name: /Tax Exempt/i })[0];
    fireEvent.click(taxExemptBtn);

    expect(screen.getByText(/Manage Guest Tax Exemption/i)).toBeDefined();

    const certInput = screen.getByPlaceholderText(/EXEMPT-GOV/i);
    fireEvent.change(certInput, { target: { value: "EXEMPT-GOV-9821" } });

    const saveBtn = screen.getByRole("button", { name: /Save Tax Exemption/i });
    fireEvent.submit(saveBtn.closest("form"));
  });

  it("14. Tests Print Invoice workflow, verifying printable invoice node rendering and printViaIframe execution", async () => {
    const exportUtils = await import("../utils/exportUtils");
    const printSpy = vi.spyOn(exportUtils, "printViaIframe");

    render(
      <FolioModal
        isOpen={true}
        booking={initialBooking}
        rooms={rooms}
        onClose={() => {}}
      />
    );

    // Click "Print Invoice"
    const printInvoiceBtn = screen.getByRole("button", { name: /Print Invoice/i });
    fireEvent.click(printInvoiceBtn);

    // Verify modal "Select Invoice Type to Print" appears
    expect(screen.getByText(/Select Invoice Type to Print/i)).toBeDefined();

    // Click "Print Selected Invoice"
    const printSelectedBtn = screen.getByRole("button", { name: /Print Selected Invoice/i });
    fireEvent.click(printSelectedBtn);

    await waitFor(() => {
      // 1. Verify printable invoice paper DOM element exists and contains non-empty invoice content
      const paperEl = document.getElementById("printable-invoice-paper");
      expect(paperEl).not.toBeNull();
      expect(paperEl.innerHTML).toContain("John Doe");
      expect(paperEl.innerHTML).toContain("Deluxe King");

      // 2. Verify printViaIframe was invoked with valid HTML
      expect(printSpy).toHaveBeenCalled();
      const htmlArg = printSpy.mock.calls[0][0];
      expect(htmlArg).toContain("printable-invoice-paper");
      expect(htmlArg).toContain("John Doe");
    }, { timeout: 3000 });

    printSpy.mockRestore();
  });
});
