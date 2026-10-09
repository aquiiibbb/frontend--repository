import { describe, it, expect } from "vitest";
import { parseFrontOCRText, parseAAMVAPDF417Text } from "../components/AIIDScannerModal";

describe("AIIDScannerModal OCR & Barcode Parser Suite", () => {
  it("correctly parses Alberta Canada Driver's License with PO Box, City, Province, Postal Code, DOB", () => {
    const rawText = `
      Alberta DRIVER'S LICENCE
      No 178366-647
      SHETA, VEER HARESH
      3 DOB 30 OCT 1994
      PO BOX 231
      LAC LA BICHE AB T0A 2C0
    `;

    const parsed = parseFrontOCRText(rawText);
    expect(parsed).toBeTruthy();
    expect(parsed.firstName).toBe("Veer Haresh");
    expect(parsed.lastName).toBe("Sheta");
    expect(parsed.idProofNumber).toBe("178366-647");
    expect(parsed.address).toBe("PO Box 231");
    expect(parsed.city).toBe("Lac La Biche");
    expect(parsed.state).toBe("AB");
    expect(parsed.zip).toBe("T0A 2C0");
    expect(parsed.dob).toBe("10/30/1994");
    expect(parsed.type).toBe("Canadian Driver's Licence");
  });

  it("correctly parses Ontario Canada Driver's License with numeric YYYY/MM/DD DOB", () => {
    const rawText = `
      Ontario DRIVER'S LICENCE
      Licence No. B8837-29910-12345
      SMITH, JOHN
      3 DOB 1995/05/15
      123 MAIN ST
      TORONTO ON M5V 2T6
    `;

    const parsed = parseFrontOCRText(rawText);
    expect(parsed).toBeTruthy();
    expect(parsed.firstName).toBe("John");
    expect(parsed.lastName).toBe("Smith");
    expect(parsed.idProofNumber).toBe("B8837-29910-12345");
    expect(parsed.address).toBe("123 Main St");
    expect(parsed.city).toBe("Toronto");
    expect(parsed.state).toBe("ON");
    expect(parsed.zip).toBe("M5V 2T6");
    expect(parsed.dob).toBe("05/15/1995");
    expect(parsed.type).toBe("Canadian Driver's Licence");
  });

  it("correctly parses California US Driver's License with LN/FN, City, State, ZIP", () => {
    const rawText = `
      CALIFORNIA DRIVER LICENSE
      DL Y6809658
      LN DOE
      FN JANE
      DOB 08/19/1990
      110 SAN FELIPE RD
      HOLLISTER, CA 95023
    `;

    const parsed = parseFrontOCRText(rawText);
    expect(parsed).toBeTruthy();
    expect(parsed.firstName).toBe("Jane");
    expect(parsed.lastName).toBe("Doe");
    expect(parsed.idProofNumber).toBe("CA-Y6809658");
    expect(parsed.address).toBe("110 San Felipe Rd");
    expect(parsed.city).toBe("Hollister");
    expect(parsed.state).toBe("CA");
    expect(parsed.zip).toBe("95023");
    expect(parsed.dob).toBe("08/19/1990");
    expect(parsed.type).toBe("US Driver's License");
  });

  it("correctly parses Canadian bilingual month DOB format (e.g. 30 OCT/OCT 1994)", () => {
    const rawText = `
      Alberta DRIVER'S LICENCE
      No 178366-647
      SHETA, VEER HARESH
      3 DOB 30 OCT/OCT 1994
      PO BOX 231
      LAC LA BICHE AB T0A 2C0
    `;

    const parsed = parseFrontOCRText(rawText);
    expect(parsed).toBeTruthy();
    expect(parsed.dob).toBe("10/30/1994");
  });
});
