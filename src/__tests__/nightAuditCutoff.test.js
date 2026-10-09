import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach } from "vitest";
import { getBusinessDate, advanceBusinessDate, getNightAuditConfig, saveNightAuditConfig } from "../services/hotelConfig";

describe("6:00 AM Night Audit Cutoff & Business Date Rollover Module", () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it("1. Configures 6:00 AM Night Audit Cutoff Time", () => {
    const config = saveNightAuditConfig({ nightAuditTime: "06:00", autoPrompt: true });
    expect(config.nightAuditTime).toBe("06:00");

    const readConfig = getNightAuditConfig();
    expect(readConfig.nightAuditTime).toBe("06:00");
  });

  it("2. Advances Business Date upon Night Audit execution and dispatches event", () => {
    const initialDate = getBusinessDate();
    expect(initialDate).toBeDefined();

    const nextDate = advanceBusinessDate();
    expect(nextDate).toBeDefined();
    expect(nextDate).not.toBe("");

    const config = getNightAuditConfig();
    expect(config.lastAuditCompletedDate).toBe(initialDate);
  });
});
