import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  getPaymentGatewayConfig,
  savePaymentGatewayConfig,
  processTerminalCharge,
  processPreAuth,
  generatePaymentLink,
  DEFAULT_PAYMENT_GATEWAY_CONFIG,
} from "../services/paymentGatewayService";
import { UNIFIED_PAYMENT_METHODS, normalizePaymentMethod, getEnabledPaymentMethods } from "../constants/paymentMethods";
import PaymentGatewayConfig from "../components/PaymentGateway/PaymentGatewayConfig";
import PaymentGatewayProcessModal from "../components/PaymentGateway/PaymentGatewayProcessModal";

describe("US Payment Gateway Module Test Suite", () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it("should return default payment gateway configuration when none saved", () => {
    const config = getPaymentGatewayConfig();
    expect(config.activePrimaryGateway).toBe("stripe");
    expect(config.stripe.enabled).toBe(true);
    expect(config.fortis.enabled).toBe(true);
    expect(config.shift4.enabled).toBe(true);
    expect(config.paybotx.enabled).toBe(true);
    expect(config.venmo.enabled).toBe(true);
    expect(config.zelle.enabled).toBe(true);
  });

  it("should save and update payment gateway config in localStorage", () => {
    const customConfig = { ...DEFAULT_PAYMENT_GATEWAY_CONFIG, activePrimaryGateway: "fortis" };
    const saved = savePaymentGatewayConfig(customConfig);
    expect(saved).toBe(true);

    const retrieved = getPaymentGatewayConfig();
    expect(retrieved.activePrimaryGateway).toBe("fortis");
  });

  it("should execute terminal charge simulation cleanly", () => {
    const charge = processTerminalCharge({
      gateway: "stripe",
      amount: 150.0,
      folioId: "FOLIO-8819",
      roomNo: "204",
      cardToken: "tok_visa_4242",
    });

    expect(charge.success).toBe(true);
    expect(charge.gateway).toBe("STRIPE");
    expect(charge.amount).toBe(150);
    expect(charge.status).toBe("APPROVED");
    expect(charge.transactionId).toContain("STRIPE-TXN-");
  });

  it("should execute pre-authorization hold simulation", () => {
    const auth = processPreAuth({
      gateway: "shift4",
      amount: 250.0,
      folioId: "FOLIO-7712",
    });

    expect(auth.success).toBe(true);
    expect(auth.gateway).toBe("SHIFT4");
    expect(auth.amountHold).toBe(250);
    expect(auth.status).toBe("AUTHORIZED_HOLD");
  });

  it("should generate SMS/Email payment links", () => {
    const link = generatePaymentLink({
      amount: 99.5,
      guestPhone: "+15550199",
      guestEmail: "guest@example.com",
      folioId: "FOLIO-101",
    });

    expect(link.success).toBe(true);
    expect(link.payUrl).toContain("https://pay.grandplazahotel.com/checkout/");
    expect(link.amount).toBe(99.5);
  });

  it("should recognize and normalize US gateway payment method strings", () => {
    expect(normalizePaymentMethod("Stripe Terminal")).toBe("Stripe");
    expect(normalizePaymentMethod("Fortis Pay")).toBe("Fortis");
    expect(normalizePaymentMethod("Shift4 SkyTab")).toBe("Shift4");
    expect(normalizePaymentMethod("PAYBOTX Auto")).toBe("PAYBOTX");
    expect(normalizePaymentMethod("Venmo QR")).toBe("Venmo");
    expect(normalizePaymentMethod("Zelle Express")).toBe("Zelle");

    const ids = UNIFIED_PAYMENT_METHODS.map((m) => m.id);
    expect(ids).toContain("Stripe");
    expect(ids).toContain("Fortis");
    expect(ids).toContain("Shift4");
    expect(ids).toContain("PAYBOTX");
    expect(ids).toContain("Venmo");
    expect(ids).toContain("Zelle");
  });

  it("should render PaymentGatewayConfig component without crashing", () => {
    render(<PaymentGatewayConfig />);
    expect(screen.getByText(/US Payment Gateway Interface & Terminals/i)).toBeTruthy();
    expect(screen.getByText(/Stripe Terminal \(Smart Reader\)/i)).toBeTruthy();
  });

  it("should render PaymentGatewayProcessModal when open", () => {
    render(
      <PaymentGatewayProcessModal
        isOpen={true}
        onClose={() => {}}
        defaultAmount={120}
      />
    );

    expect(screen.getByText(/US Payment Gateway Terminal & Instant Checkout/i)).toBeTruthy();
    expect(screen.getAllByText(/Stripe Terminal/i).length).toBeGreaterThan(0);
  });

  it("should dynamically filter disabled payment gateways in getEnabledPaymentMethods()", () => {
    const config = {
      ...DEFAULT_PAYMENT_GATEWAY_CONFIG,
      stripe: { enabled: false },
      fortis: { enabled: true },
      shift4: { enabled: false },
      paybotx: { enabled: false },
      venmo: { enabled: false },
      zelle: { enabled: false },
    };
    savePaymentGatewayConfig(config);

    const enabledMethods = getEnabledPaymentMethods();
    const enabledIds = enabledMethods.map((m) => m.id);

    expect(enabledIds).toContain("Fortis");
    expect(enabledIds).toContain("Cash");
    expect(enabledIds).toContain("Card");
    expect(enabledIds).not.toContain("Stripe");
    expect(enabledIds).not.toContain("Shift4");
    expect(enabledIds).not.toContain("PAYBOTX");
    expect(enabledIds).not.toContain("Venmo");
    expect(enabledIds).not.toContain("Zelle");
  });
});
