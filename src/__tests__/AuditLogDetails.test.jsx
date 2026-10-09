import { describe, it, expect } from "vitest";
import { createBooking, updateBooking, getAuditLogs } from "../services/api.store";

describe("Audit Log Detailed Action Verification", () => {
  it("Generates specific action titles and details for note addition instead of generic Modified Booking", async () => {
    const booking = await createBooking({
      guest: "Test Guest",
      room: "101",
      checkIn: "2026-09-23",
      checkOut: "2026-09-25",
      status: "confirmed"
    });
    expect(booking).toBeDefined();

    const patchData = {
      notesList: [
        { id: "note_1", text: "VIP Guest requires early check-in", author: "Front Desk" }
      ],
      notes: "VIP Guest requires early check-in"
    };

    const updated = await updateBooking(booking.id, patchData);
    expect(updated).toBeDefined();

    const logs = await getAuditLogs(booking.id);
    expect(logs.length).toBeGreaterThan(0);
    const latestLog = logs[0];

    expect(latestLog.action).not.toBe("Modified Booking");
    expect(latestLog.action).toContain("Note");
    expect(latestLog.details).toContain("VIP Guest requires early check-in");
  });

  it("Generates specific action titles for Check-In status update", async () => {
    const booking = await createBooking({
      guest: "Second Guest",
      room: "102",
      checkIn: "2026-09-23",
      checkOut: "2026-09-25",
      status: "confirmed"
    });

    const patchData = {
      status: "checked-in",
      auditAction: "Guest Checked In",
      auditDetails: `Checked in guest ${booking.guest} to Room ${booking.room}`
    };

    const updated = await updateBooking(booking.id, patchData);
    expect(updated).toBeDefined();

    const logs = await getAuditLogs(booking.id);
    const latestLog = logs[0];

    expect(latestLog.action).toBe("Guest Checked In");
    expect(latestLog.details).toContain("Checked in guest");
  });
});
