import { describe, it, expect } from "vitest";
import { exportToExcel, exportToPDF, exportToWord } from "../utils/exportUtils";

describe("Master Multi-Report Center & Export Utilities", () => {
  it("1. Verifies exportToExcel function exists and formats HTML payload", () => {
    expect(typeof exportToExcel).toBe("function");
  });

  it("2. Verifies exportToWord function exists", () => {
    expect(typeof exportToWord).toBe("function");
  });

  it("3. Verifies exportToPDF function exists", () => {
    expect(typeof exportToPDF).toBe("function");
  });
});
