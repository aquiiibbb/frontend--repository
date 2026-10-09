import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getChannelConfig,
  saveChannelConfig,
  getChannelMappings,
  saveChannelMappings,
  getChannelRestrictions,
  saveChannelRestrictions,
  fetchOtaChannelCatalog,
  getSyncLogs,
  addSyncLog,
  clearSyncLogs,
  processIncomingOtaReservation,
  pushInventoryAndRatesToChannels,
  DEFAULT_CHANNEL_CONFIG,
} from "../services/channelManager";

describe("Channel Manager & Restrictions Engine Suite", () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it("should return default channel configuration when storage is empty", () => {
    const config = getChannelConfig();
    expect(config.masterEnabled).toBe(true);
    expect(config.channels).toHaveProperty("booking_com");
    expect(config.channels).toHaveProperty("expedia");
    expect(config.channels.booking_com.markupPct).toBe(15);
  });

  it("should save and retrieve custom channel configuration", () => {
    const customConfig = {
      ...DEFAULT_CHANNEL_CONFIG,
      masterEnabled: true,
      channels: {
        ...DEFAULT_CHANNEL_CONFIG.channels,
        booking_com: {
          ...DEFAULT_CHANNEL_CONFIG.channels.booking_com,
          markupPct: 20,
          hotelId: "HOTEL-TEST-123",
        },
      },
    };

    saveChannelConfig(customConfig);

    const loaded = getChannelConfig();
    expect(loaded.channels.booking_com.markupPct).toBe(20);
    expect(loaded.channels.booking_com.hotelId).toBe("HOTEL-TEST-123");
  });

  it("should fetch human-readable OTA Room Categories and Rate Plans by Hotel ID", async () => {
    const catalog = await fetchOtaChannelCatalog("booking_com", "BK-99824");
    expect(catalog).toHaveProperty("roomTypes");
    expect(catalog).toHaveProperty("ratePlans");
    expect(catalog.roomTypes.length).toBeGreaterThan(0);
    expect(catalog.roomTypes[0]).toHaveProperty("name");
    expect(catalog.roomTypes[0].name).toContain("Deluxe Double Room");
  });

  it("should save and retrieve OTA channel restrictions (StopSell, CTA, CTD, MinLOS, MaxLOS)", () => {
    const restrictions = {
      stopSell: { booking_com: { "rt-1": true } },
      cta: { booking_com: { "rt-1": true } },
      ctd: { booking_com: { "rt-1": false } },
      minLos: { booking_com: { "rt-1": 2 } },
      maxLos: { booking_com: { "rt-1": 14 } },
    };

    saveChannelRestrictions(restrictions);

    const loaded = getChannelRestrictions();
    expect(loaded.stopSell.booking_com["rt-1"]).toBe(true);
    expect(loaded.cta.booking_com["rt-1"]).toBe(true);
    expect(loaded.minLos.booking_com["rt-1"]).toBe(2);
    expect(loaded.maxLos.booking_com["rt-1"]).toBe(14);
  });

  it("should handle human-readable room and rate plan mappings", () => {
    const mappings = {
      roomMappings: {
        "rt-101": { booking_com: "Deluxe Double Room with Sea View", expedia: "Deluxe Room (1 King Bed)" },
      },
      rateMappings: {
        "rp-001": { booking_com: "Breakfast Included CP" },
      },
    };

    saveChannelMappings(mappings);

    const loaded = getChannelMappings();
    expect(loaded.roomMappings["rt-101"].booking_com).toBe("Deluxe Double Room with Sea View");
    expect(loaded.rateMappings["rp-001"].booking_com).toBe("Breakfast Included CP");
  });

  it("should manage sync audit logs properly", () => {
    clearSyncLogs();
    let logs = getSyncLogs();
    expect(logs.length).toBe(0);

    addSyncLog({
      channel: "Booking.com",
      channelKey: "booking_com",
      type: "INBOUND_RESERVATION",
      status: "SUCCESS",
      details: "Test booking imported",
    });

    logs = getSyncLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].details).toBe("Test booking imported");

    clearSyncLogs();
    expect(getSyncLogs().length).toBe(0);
  });

  it("should process incoming simulated OTA webhook reservation", async () => {
    const result = await processIncomingOtaReservation({
      channelKey: "booking_com",
      guestName: "Sarah Jenkins",
      guestEmail: "sarah@booking.com",
      roomType: "Deluxe Room",
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      amount: 320,
      paymentStatus: "Paid Online",
    });

    expect(result).toHaveProperty("guest", "Sarah Jenkins");
    expect(result.status).toBe("confirmed");
    expect(result.paidAmount).toBe(320);

    const logs = getSyncLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].channelKey).toBe("booking_com");
  });

  it("should execute outbound ARI inventory and restrictions push", async () => {
    saveChannelRestrictions({
      stopSell: { booking_com: { "rt-1": true } },
      cta: { booking_com: { "rt-1": true } },
    });

    const res = await pushInventoryAndRatesToChannels();
    expect(res.success).toBe(true);
    expect(res.count).toBeGreaterThan(0);

    const logs = getSyncLogs();
    const ariLog = logs.find((l) => l.type === "OUTBOUND_ARI_PUSH");
    expect(ariLog).toBeDefined();
    expect(ariLog.details).toContain("StopSell");
  });
});
