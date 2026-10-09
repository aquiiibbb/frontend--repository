import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import ConfigurationPanel from "../pages/ConfigurationPanel";

describe("ConfigurationPanel Component", () => {
  it("renders ConfigurationPanel and clicks on Rooms sub-tab without throwing error", () => {
    render(
      <BrowserRouter>
        <ConfigurationPanel />
      </BrowserRouter>
    );

    const roomsBtn = screen.getByText("• Rooms");
    expect(roomsBtn).toBeDefined();

    // Click on Rooms tab
    fireEvent.click(roomsBtn);

    // Verify Manage Rooms header appears
    expect(screen.getByText("Manage Rooms")).toBeDefined();
  });

  it("clicks on User Management sub-tab and renders User Management section cleanly without crashing", () => {
    render(
      <BrowserRouter>
        <ConfigurationPanel />
      </BrowserRouter>
    );

    const userMgmtBtn = screen.getByText("• User Management");
    expect(userMgmtBtn).toBeDefined();

    fireEvent.click(userMgmtBtn);

    // Verify User Management section and user list render cleanly
    expect(screen.getByRole("heading", { name: "User Management" })).toBeDefined();
    expect(screen.getByText("+ Add Housekeeper")).toBeDefined();
    expect(screen.getByText("+ Add New User")).toBeDefined();
  });

  it("renders Email & Notifications workspace and saves email config", async () => {
    const { getEmailConfig, saveEmailConfig, getGuestNotifications, getHotelierNotifications } = await import("../services/hotelConfig");
    
    saveEmailConfig({ fromName: "AWS SES Test Hotel", fromEmail: "test@aws-ses.com", provider: "AWS SES (Amazon Simple Email Service)" });
    const cfg = getEmailConfig();
    expect(cfg.fromName).toBe("AWS SES Test Hotel");
    expect(cfg.provider).toBe("AWS SES (Amazon Simple Email Service)");

    const guestCfg = getGuestNotifications();
    expect(guestCfg.confirmation.enabled).toBe(true);

    const hotelierCfg = getHotelierNotifications();
    expect(hotelierCfg.staffEmails).toBeDefined();

    render(
      <BrowserRouter>
        <ConfigurationPanel />
      </BrowserRouter>
    );

    const notificationsGroup = screen.getByText("3) Notifications");
    expect(notificationsGroup).toBeDefined();
    fireEvent.click(notificationsGroup);

    const notificationsBtn = screen.getByText("• Guest Notification");
    expect(notificationsBtn).toBeDefined();
    fireEvent.click(notificationsBtn);

    expect(screen.getByText(/Email Server Gateway \(SMTP \/ AWS SES \/ APIs\)/i)).toBeDefined();
  });
});
