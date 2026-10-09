import { dataStore } from "../services/dataStore";
import React, { useState, useRef, useEffect } from "react";
import { usePMS } from "../context/PMSContext";
import "./AIIDScannerModal.css";

// Inbuilt AI API Keys
const INBUILT_GOOGLE_VISION_API_KEY = "AIzaSyAlzo0FlfeUJI7t-HoFU1sdJC9T-ibaJ74";
const INBUILT_MINDEE_API_KEY = "MY_API_KEY";

// 1. Helper: Clean Title Casing
const titleCase = (s = "") =>
  s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .trim();

// 2. Dual Format Date Normalizer (Supports "18 OCT 2000", "30 OCT/OCT 1994", "1994/10/30", "1994-10-30", and "08/19/2000")
const normalizeDate = (rawStr = "") => {
  if (!rawStr) return { standard: "", iso: "" };
  let str = rawStr.trim();

  // Clean up Canadian bilingual month duplicates (e.g. "OCT/OCT", "OCT / OCT", "JUIN/JUN")
  str = str.replace(/([A-Za-z]{3,9})[\/\s]+([A-Za-z]{3,9})/g, "$1");

  const months = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
  };

  // 1. Day-Month-Year: e.g. "30 OCT 1994" or "30-OCT-1994" or "30 OCT 94"
  const dmyMatch = str.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,9})[\s\-]+(\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const mon = dmyMatch[2].toLowerCase().slice(0, 3);
    let yr = dmyMatch[3];
    if (yr.length === 2) yr = parseInt(yr, 10) > 26 ? `19${yr}` : `20${yr}`;
    if (months[mon]) {
      const monthNum = months[mon];
      return { standard: `${monthNum}/${day}/${yr}`, iso: `${yr}-${monthNum}-${day}` };
    }
  }

  // 2. Month-Day-Year: e.g. "OCT 30 1994" or "OCTOBER 30 1994"
  const mdyMatch = str.match(/^([A-Za-z]{3,9})[\s\-]+(\d{1,2})[,\s\-]+(\d{2,4})$/);
  if (mdyMatch) {
    const mon = mdyMatch[1].toLowerCase().slice(0, 3);
    const day = mdyMatch[2].padStart(2, "0");
    let yr = mdyMatch[3];
    if (yr.length === 2) yr = parseInt(yr, 10) > 26 ? `19${yr}` : `20${yr}`;
    if (months[mon]) {
      const monthNum = months[mon];
      return { standard: `${monthNum}/${day}/${yr}`, iso: `${yr}-${monthNum}-${day}` };
    }
  }

  // 3. Year-Month-Day: e.g. "1994/10/30" or "1994-10-30" or "1994.10.30"
  const ymdNumMatch = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymdNumMatch) {
    const y = ymdNumMatch[1];
    const m = ymdNumMatch[2].padStart(2, "0");
    const d = ymdNumMatch[3].padStart(2, "0");
    return { standard: `${m}/${d}/${y}`, iso: `${y}-${m}-${d}` };
  }

  // 4. Standard Numeric: e.g. "10/30/1994" or "30/10/1994"
  const numMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (numMatch) {
    let p1 = parseInt(numMatch[1], 10);
    let p2 = parseInt(numMatch[2], 10);
    let y = numMatch[3];
    if (y.length === 2) y = parseInt(y, 10) > 26 ? `19${y}` : `20${y}`;
    let monthStr = "";
    let dayStr = "";

    if (p1 > 12 && p2 <= 12) {
      monthStr = String(p2).padStart(2, "0");
      dayStr = String(p1).padStart(2, "0");
    } else {
      monthStr = String(p1).padStart(2, "0");
      dayStr = String(p2).padStart(2, "0");
    }

    return { standard: `${monthStr}/${dayStr}/${y}`, iso: `${y}-${monthStr}-${dayStr}` };
  }

  return { standard: str, iso: str };
};
// Scan Validator
export function isMeaningfulScan(data) {
  if (!data) return false;
  const hasName = !!(data.fullName && data.fullName.trim().length >= 2);
  const hasId = !!(data.idProofNumber && data.idProofNumber.replace(/[^A-Z0-9]/gi, "").length >= 5);
  return hasName || hasId;
}

// 3. Barcode AAMVA Parser (Back of Card)
export function parseAAMVAPDF417Text(rawText = "") {
  if (!rawText) return null;

  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const isAAMVA = /ANSI|63600|DAQ|DCS|DAC|DDB|DAJ/i.test(text);

  const getSubfield = (code) => {
    const reg = new RegExp(`${code}\\s*([A-Za-z0-9\\s,.-]+?)(?=(?:D[A-D][A-Z]|\\n|\\r|$))`, "i");
    const m = text.match(reg);
    if (!m || !m[1]) return "";
    return m[1].replace(/NONE/gi, "").trim();
  };

  let dlNumber = getSubfield("DAQ") || getSubfield("DAB") || getSubfield("DL");
  if (!dlNumber) {
    const dlMatch = text.match(/\b([A-Z]\d{7,8}|\d{7,10}|\d{6}-\d{3})\b/);
    if (dlMatch) dlNumber = dlMatch[1];
  }

  let firstName = getSubfield("DAC") || getSubfield("DCT") || getSubfield("FIRST");
  let lastName = getSubfield("DCS") || getSubfield("DAB") || getSubfield("LAST");
  let middleName = getSubfield("DAD") || "";

  const daaLine = getSubfield("DAA");
  if (daaLine && daaLine.includes(",")) {
    const parts = daaLine.split(",");
    if (parts[0] && !lastName) lastName = parts[0];
    if (parts[1] && !firstName) firstName = parts[1];
    if (parts[2] && !middleName) middleName = parts[2];
  }

  let fullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, " ").trim();
  let address1 = getSubfield("DAG") || getSubfield("DAH") || getSubfield("ADDR");

  let city = getSubfield("DAI") || getSubfield("CITY");
  let state = getSubfield("DAJ") || getSubfield("STATE") || "";
  if (state.length > 2) state = state.substring(0, 2).toUpperCase();

  let zip = getSubfield("DAK") || getSubfield("DAW") || getSubfield("ZIP");
  const zipMatch = (zip || text).match(/\b(\d{5}(?:-\d{4})?|[A-Z][0-9O][A-Z]\s*[0-9O][A-Z][0-9O])\b/i);
  if (zipMatch) zip = zipMatch[1].toUpperCase().replace(/O/g, "0");

  const dobRaw = getSubfield("DBB");
  const sexCode = getSubfield("DBC");

  if (fullName) fullName = titleCase(fullName);
  if (address1) address1 = titleCase(address1);
  if (city) city = titleCase(city);

  let dobStandard = "";
  let dobIso = "";
  if (dobRaw && dobRaw.length === 8) {
    if (parseInt(dobRaw.substring(0, 2), 10) <= 12) {
      const m = dobRaw.substring(0, 2);
      const d = dobRaw.substring(2, 4);
      const y = dobRaw.substring(4);
      dobStandard = `${m}/${d}/${y}`;
      dobIso = `${y}-${m}-${d}`;
    } else {
      const y = dobRaw.substring(0, 4);
      const m = dobRaw.substring(4, 6);
      const d = dobRaw.substring(6);
      dobStandard = `${m}/${d}/${y}`;
      dobIso = `${y}-${m}-${d}`;
    }
  }

  const isCanadian = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"].includes(state);
  const gender = sexCode === "1" ? "Male" : sexCode === "2" ? "Female" : "";

  return {
    isAAMVA,
    fullName: fullName || "",
    firstName: firstName ? titleCase(firstName) : "",
    lastName: lastName ? titleCase(lastName) : "",
    idProofNumber: dlNumber ? (state ? `${state}-${dlNumber}` : dlNumber) : "",
    rawIdNumber: dlNumber || "",
    address: address1 || "",
    city: city || "",
    state: state || "",
    zip: zip || "",
    dob: dobStandard || "",
    dobIso: dobIso || "",
    gender: gender || "",
    type: isCanadian ? "Canadian Driver's Licence" : "US Driver's License",
    rawAAMVA: text
  };
}

// 4. Universal Front Card OCR Parser (Supports US/Canada DL, Aadhaar, Passport, PAN, State IDs)
export function parseFrontOCRText(rawText = "") {
  if (!rawText) return null;

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const cleanText = lines.join("\n");

  // A. Region & Document Type Detection
  const isAadhaar = /AADHAAR|UNIQUE IDENTIFICATION|GOVERNMENT OF INDIA|BHARAT SARKAR/i.test(cleanText);
  const isPassport = /PASSPORT|PASSEPORT|REPUBLIC OF|COUNTRY CODE/i.test(cleanText);
  const isPan = /PERMANENT ACCOUNT NUMBER|INCOME TAX DEPARTMENT/i.test(cleanText);

  // Canadian Province Full Names Map
  const CANADIAN_PROVINCES = {
    "ALBERTA": "AB",
    "BRITISH COLUMBIA": "BC",
    "MANITOBA": "MB",
    "NEW BRUNSWICK": "NB",
    "NOUVEAU-BRUNSWICK": "NB",
    "NEWFOUNDLAND": "NL",
    "TERRE-NEUVE": "NL",
    "NOVA SCOTIA": "NS",
    "NOUVELLE-ÉCOSSE": "NS",
    "NOUVELLE-ECOSSE": "NS",
    "NORTHWEST TERRITORIES": "NT",
    "TERRITOIRES DU NORD-OUEST": "NT",
    "NUNAVUT": "NU",
    "ONTARIO": "ON",
    "PRINCE EDWARD ISLAND": "PE",
    "ÎLE-DU-PRINCE-ÉDOUARD": "PE",
    "ILE-DU-PRINCE-EDOUARD": "PE",
    "QUEBEC": "QC",
    "QUÉBEC": "QC",
    "SASKATCHEWAN": "SK",
    "YUKON": "YT"
  };

  // Canadian Postal Code First Letter -> Province Map
  const POSTAL_FIRST_CHAR_PROV = {
    'T': 'AB',
    'V': 'BC',
    'R': 'MB',
    'E': 'NB',
    'A': 'NL',
    'B': 'NS',
    'X': 'NT',
    'K': 'ON', 'L': 'ON', 'M': 'ON', 'N': 'ON', 'P': 'ON',
    'C': 'PE',
    'G': 'QC', 'H': 'QC', 'J': 'QC',
    'S': 'SK',
    'Y': 'YT'
  };

  // Canadian indicators (Ensure city "Ontario, CA" in California is not mistaken for Ontario province)
  const isAlberta = /ALBERTA/i.test(cleanText);
  const isOntarioCanada = /ONTARIO/i.test(cleanText) && !/\bONTARIO[,\s]+CA\b/i.test(cleanText) && !/CALIFORNIA/i.test(cleanText);
  const hasCanadianProvinceName = Object.keys(CANADIAN_PROVINCES).some((prov) => new RegExp(`\\b${prov}\\b`, "i").test(cleanText));
  const hasCanadianProvince = isAlberta || isOntarioCanada || hasCanadianProvinceName || /PROVINCE OF/i.test(cleanText);
  
  // Canadian Postal Code Regex (e.g. T0A 2C0, M5V 2T6, T0A2C0)
  let postalRegex = /\b([A-Z][0-9O][A-Z])[\s\-]*([0-9O][A-Z][0-9O])\b/i;
  const postMatch = cleanText.match(postalRegex);
  let extractedCanadianZip = "";
  if (postMatch) {
    const p1 = postMatch[1].toUpperCase().replace(/O/g, "0");
    const p2 = postMatch[2].toUpperCase().replace(/O/g, "0");
    extractedCanadianZip = `${p1} ${p2}`;
  }

  const isCanada = Boolean((isAlberta || hasCanadianProvince || extractedCanadianZip || /CANADA/i.test(cleanText)) && !/CALIFORNIA|FLORIDA|TEXAS|NEW YORK|CONNECTICUT|USA|U\.S\.A\./i.test(cleanText));
  
  // State/Province Detection
  let state = "";

  if (isAlberta) state = "AB";
  else if (isOntarioCanada) state = "ON";
  else {
    for (const [provName, provCode] of Object.entries(CANADIAN_PROVINCES)) {
      if (new RegExp(`\\b${provName}\\b`, "i").test(cleanText)) {
        state = provCode;
        break;
      }
    }
  }

  if (!state && (/CONNECTICUT/i.test(cleanText) || /\bCT\b/.test(cleanText))) state = "CT";
  else if (!state && (/CALIFORNIA/i.test(cleanText) || /\bCA\b/.test(cleanText))) state = "CA";
  else if (!state && (/FLORIDA/i.test(cleanText) || /\bFL\b/.test(cleanText))) state = "FL";
  else if (!state && (/TEXAS/i.test(cleanText) || /\bTX\b/.test(cleanText))) state = "TX";
  else if (!state && (/NEW YORK/i.test(cleanText) || /\bNY\b/.test(cleanText))) state = "NY";

  if (!state && isCanada) {
    const canProvMatch = cleanText.match(/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/);
    if (canProvMatch) state = canProvMatch[1].toUpperCase();
    else if (extractedCanadianZip && POSTAL_FIRST_CHAR_PROV[extractedCanadianZip[0]]) {
      state = POSTAL_FIRST_CHAR_PROV[extractedCanadianZip[0]];
    }
  } else if (!state) {
    const stMatch = cleanText.match(/\b(CA|FL|TX|NY|WA|IL|PA|OH|GA|NC|MI|NJ|VA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|ID|WV|HI|NH|ME|MT|RI|DE|SD|ND|AK|DC|VT|WY)\b/);
    if (stMatch && !/Lac\s+La/i.test(cleanText)) {
      state = stMatch[1].toUpperCase();
    }
  }

  // B. ID / DL / Document Number Parsing
  let rawDl = "";

  // 1. Aadhaar 12-digit number (e.g. 1234 5678 9012)
  const aadhaarMatch = cleanText.match(/\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/);
  if (isAadhaar && aadhaarMatch) {
    rawDl = aadhaarMatch[1].replace(/[\s-]/g, "");
  }

  // 2. PAN Card (5 letters, 4 numbers, 1 letter)
  if (!rawDl && isPan) {
    const panMatch = cleanText.match(/\b([A-Z]{5}\d{4}[A-Z])\b/i);
    if (panMatch) rawDl = panMatch[1].toUpperCase();
  }

  // 3. Passport (1 letter + 7-8 digits or MRZ format)
  if (!rawDl && (isPassport || /PASSPORT/i.test(cleanText))) {
    const passMatch = cleanText.match(/(?:Passport\s*No\.?|P<[A-Z]{3})[\s:]*([A-Z0-9]{7,9})\b/i) || cleanText.match(/\b([A-Z]\d{7,8})\b/i);
    if (passMatch) rawDl = passMatch[1].toUpperCase();
  }

  // 4. US / Canadian / Universal DL numbers (Supports "No 178366-647", "Licence No. B8837-29910-12345", "4d LIC # 119855324", "DL Y6809658")
  if (!rawDl) {
    const usDlMatch = cleanText.match(/(?:^|\n|\s)\s*(?:4d\s+)?(?:DL|LIC|LIC#|DL#|ID#?)\b\s*[#:]*\s*([A-Z0-9-]{7,18})\b/i);
    if (usDlMatch && !/CLASS|EXP|DOB|NONE|FEDERAL|CANADA|DRIVER|LICENCE|LICENSE/i.test(usDlMatch[1])) {
      rawDl = usDlMatch[1].replace(/\s+/g, "").toUpperCase();
    }
  }

  if (!rawDl) {
    const canNumMatch = cleanText.match(/(?:No\.?|N[°º]|Mo\.?|ID\s*No\.?|Licence\s*No\.?|License\s*No\.?)\s*[:.]?\s*([A-Z0-9]{1,5}[-\s–—]?[0-9]{3,8}[-\s–—]?[0-9]{2,5}|[A-Z0-9]{7,18})/i);
    if (canNumMatch && !/CLASS|EXP|DOB|NONE|FEDERAL|CANADA/i.test(canNumMatch[1])) {
      rawDl = canNumMatch[1].trim().replace(/\s+/g, "-");
    }
  }

  // 5. Fallback standalone DL or ID number pattern (e.g. 178366-647 or 178366 647 or Y6809658 or B8837299)
  if (!rawDl) {
    const directPattern = cleanText.match(/\b([A-Z]\d{7,8}|\d{5,8}[-\s–—]\d{2,4}|\d{9,12})\b/);
    if (directPattern && !/CLASS|EXP|DOB|NONE|FEDERAL|CANADA|DRIVER|LICENCE|LICENSE/i.test(directPattern[1])) {
      rawDl = directPattern[1].replace(/\s+/g, "-");
    }
  }

  // C. Name Parsing
  let lastName = "";
  let firstName = "";

  const titleBlacklist = /GOVERNMENT|REPUBLIC|DEPARTMENT|DRIVER|LICENCE|LICENSE|IDENTITY|CARD|ADDRESS|MALE|FEMALE|INDIA|UNION|STATE|AUTHORITY|SIGNATURE|DOB|DATE|CALIFORNIA|USA|FEDERAL|CONNECTICUT|COMMISSIONER|NOT\s+FOR|LIMITS|APPLY|CLASS|EXPIRES|EXP|COND|END|NONE|REST|RSTR|ORGAN|DONOR|PERMANENT|ACCOUNT|NUMBER|INCOME|TAX|PROVINCE|ALBERTA|ONTARIO|QUEBEC|BRITISH|COLUMBIA|MANITOBA|SASKATCHEWAN|NEWFOUNDLAND|NOVA|SCOTIA|NEW|BRUNSWICK|PRINCE|EDWARD|ISLAND|NORTHWEST|TERRITORIES|NUNAVUT|YUKON|HEIGHT|WEIGHT|EYES|HAIR|HGT|WGT|SEX|ISS|ISSUED|DD|DUP|REPLACEMENT|PRIMARY|SECONDARY|FULL\s*NAME|SURNAME|GIVEN|FIRST\s*NAME|LAST\s*NAME|DL\s*NO|DL#|ID#|PERMIT|BHARAT|SARKAR|UNIQUE|IDENTIFICATION/i;
  const US_CANADA_STATES_PROVS = /^(?:AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/i;

  // 1. AAMVA Standard Real ID fields: "1 <LAST_NAME>", "2 <FIRST_NAME>" (Connecticut, NY, NJ, MA, PA DLs) OR "LN <LAST_NAME>", "FN <FIRST_NAME>" (California, FL, TX DLs)
  const aamva1Match = cleanText.match(/(?:^|\n)\s*(?:1\b|1N\b|LN\b)\s*[:.]?\s*([A-Za-z'.-]{2,25})/i);
  const aamva2Match = cleanText.match(/(?:^|\n)\s*(?:2\b|2N\b|FN\b)\s*[:.]?\s*([A-Za-z '.-]{2,30})/i);
  if (aamva1Match && aamva2Match && !titleBlacklist.test(aamva1Match[1])) {
    lastName = aamva1Match[1].trim();
    firstName = aamva2Match[1].replace(/(?:\bCLASS\b|\bEND\b|\bNONE\b|\bRSTR\b|\bFEDERAL\b|\bDOB\b|\bEXP\b|\bSEX\b|\d).*/i, "").trim();
  }

  // 2. Explicit Surname & Given Name matching (Passport / Standard ID labels)
  if (!lastName || !firstName) {
    if (!lastName) {
      const surnameMatch = cleanText.match(/(?:Surname|Family\s*Name|Last\s*Name)[ \t:]+([A-Za-z'.-]{2,25})/i);
      if (surnameMatch && !titleBlacklist.test(surnameMatch[1])) {
        lastName = surnameMatch[1].trim();
      }
    }

    if (!firstName) {
      const givenNameMatch = cleanText.match(/(?:Given\s*Names?|First\s*Name)[ \t:]+([A-Za-z '.-]{2,30})/i);
      if (givenNameMatch) {
        let cleanGiven = givenNameMatch[1].replace(/(?:DOB|BIRTH|DATE|GENDER|SEX|PASSPORT|AADHAAR|EXP|CLASS|\d).*/i, "").trim();
        if (cleanGiven && !titleBlacklist.test(cleanGiven)) firstName = cleanGiven;
      }
    }
  }

  // 3. Generic Labelled Name
  if (!firstName && !lastName) {
    const labelNameMatch = cleanText.match(/(?:Full\s*Name|Given\s*Name|Name\s*of\s*Holder|Guest\s*Name|^Name)[ \t:]+([A-Za-z '.-]{2,35})/im);
    if (labelNameMatch && !titleBlacklist.test(labelNameMatch[1])) {
      let cleanVal = labelNameMatch[1].replace(/(?:DOB|BIRTH|DATE|GENDER|SEX|PASSPORT|AADHAAR|EXP|CLASS|\d).*/i, "").trim();
      if (cleanVal.length >= 2) {
        const parts = cleanVal.split(/\s+/).filter(Boolean);
        firstName = parts[0] || "";
        lastName = parts.slice(1).join(" ") || "";
      }
    }
  }

  // 4. Canadian-style "LASTNAME, First Middle" (e.g. SHETA, VEER HARESH or SHETA, Veer Haresh)
  if (!firstName || !lastName) {
    const canNameMatch = cleanText.match(/\b([A-Z'.-]{2,25}),[ \t]*([A-Za-z '.-]{2,35})/);
    if (canNameMatch && !titleBlacklist.test(canNameMatch[1])) {
      const candLast = canNameMatch[1].trim();
      let rawFn = canNameMatch[2].replace(/(?:PO Box|Class|None|Cond|End|DOB|EXP|SEX|EYES|HAIR|HT|WT|HGT|WGT|ISS|\d+).*/i, "").trim();
      const parts = rawFn.split(/\s+/).filter(Boolean);
      const isStateAbbr = parts.length === 1 && US_CANADA_STATES_PROVS.test(parts[0]);
      if (parts.length > 0 && !isStateAbbr) {
        lastName = candLast;
        firstName = parts.join(" ");
      }
    }
  }

  let fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  // 5. Standalone line fallback if name is still empty or lacks both first and last name
  if (!firstName || !lastName || !fullName) {
    for (const line of lines) {
      if (/\d/.test(line)) continue;
      if (line.length < 3 || line.length > 40) continue;
      if (titleBlacklist.test(line)) continue;

      if (!/^[A-Za-z'.-]+(?:\s+[A-Za-z'.-]+){1,3}$/.test(line.trim())) continue;

      const parts = line.trim().split(/\s+/).filter(Boolean);
      if (parts.length < 2) continue;

      const hasStateCode = parts.some((p) => US_CANADA_STATES_PROVS.test(p));
      if (hasStateCode) continue;

      const validWords = parts.every((p) => p.length >= 2 || (p.length === 1 && /[A-Za-z]/.test(p)));
      if (!validWords) continue;

      fullName = line.trim();
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
      break;
    }
  }

  if (fullName) fullName = titleCase(fullName);
  if (firstName) firstName = titleCase(firstName);
  if (lastName) lastName = titleCase(lastName);

  // D. Date of Birth (DOB) & Expiry (EXP)
  let dobObj = { standard: "", iso: "" };
  let expObj = { standard: "", iso: "" };

  // 1. Text Month DOB (e.g. "3 DOB 30 OCT 1994", "DOB: 30 OCT 1994", "DOB 30 OCT/OCT 1994", "DOB OCT 30 1994", "3 30 OCT 1994")
  const textMonthDob = cleanText.match(/(?:3\b[\s:.]*)?(?:DOB|BIRTH|DBB|D0B|DO8|D\.O\.B|Date of Birth|Birth Date|YOB|Year of Birth)[\s:.]*(\d{1,2}[\s\-]+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*(?:[\/\s]+[A-Za-z]{3,9})?[\s\-]+\d{2,4}|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*[\s\-]+\d{1,2}[,\s\-]+\d{2,4})/i);
  if (textMonthDob) {
    dobObj = normalizeDate(textMonthDob[1]);
  }

  // 1b. Canadian / AAMVA Field 3 DOB without explicit DOB label (e.g. "3 30 OCT 1994" or "3 30 OCT/OCT 1994")
  if (!dobObj.standard) {
    const field3Dob = cleanText.match(/(?:^|\n)\s*3\b[\s:.]*(\d{1,2}[\s\-]+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*(?:[\/\s]+[A-Za-z]{3,9})?[\s\-]+\d{2,4})/i);
    if (field3Dob) dobObj = normalizeDate(field3Dob[1]);
  }

  // 2. Numeric DOB (e.g. "3 DOB 1994/10/30", "DOB 10/30/1994", "3 1994-10-30")
  if (!dobObj.standard) {
    const numDob = cleanText.match(/(?:3\b[\s:.]*)?(?:DOB|BIRTH|DBB|D0B|DO8|D\.O\.B|Date of Birth|Birth Date)[\s:.]*(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
    if (numDob) dobObj = normalizeDate(numDob[1]);
  }

  if (!dobObj.standard) {
    const field3NumDob = cleanText.match(/(?:^|\n)\s*3\b[\s:.]*(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
    if (field3NumDob) dobObj = normalizeDate(field3NumDob[1]);
  }

  // 3. Expiry
  const textMonthExp = cleanText.match(/(?:4b\b[\s:.]*)?(?:EXP|EXPIRES|Expiry|Valid Until)[\s:.]*(\d{1,2}[\s\-]+[A-Za-z]{3,9}(?:[\/\s]+[A-Za-z]{3,9})?[\s\-]+\d{2,4}|[A-Za-z]{3,9}[\s\-]+\d{1,2}[,\s\-]+\d{2,4})/i);
  if (textMonthExp) {
    expObj = normalizeDate(textMonthExp[1]);
  } else {
    const numExp = cleanText.match(/(?:4b\b[\s:.]*)?(?:EXP|EXPIRES|Expiry|Valid Until)[\s:.]*(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
    if (numExp) expObj = normalizeDate(numExp[1]);
  }

  // 4. Standalone DOB fallbacks
  if (!dobObj.standard) {
    const standAloneDates = [...cleanText.matchAll(/\b(\d{1,2}[\s\-]+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*(?:[\/\s]+[A-Za-z]{3,9})?[\s\-]+(?:19\d{2}|20[0-2]\d))\b/gi)];
    const validDobMatches = standAloneDates.filter((m) => {
      const idx = m.index;
      const prefix = cleanText.substring(Math.max(0, idx - 35), idx);
      const isIssOrExp = /ISS|ISSUED|ISSUE|EXP|EXPIRES|VALID|4b|4a/i.test(prefix);
      return !isIssOrExp;
    });
    if (validDobMatches.length >= 1) {
      dobObj = normalizeDate(validDobMatches[0][1]);
    }
  }

  if (!dobObj.standard) {
    const standAloneNumDates = [...cleanText.matchAll(/\b((?:19\d{2}|20[0-2]\d)[\/\-.](?:0?[1-9]|1[0-2])[\/\-.](?:0?[1-9]|[12]\d|3[01])|(?:0?[1-9]|1[0-2])[\/\-.](?:0?[1-9]|[12]\d|3[01])[\/\-.](?:19\d{2}|20[0-2]\d))\b/g)];
    const validNumDobMatches = standAloneNumDates.filter((m) => {
      const idx = m.index;
      const prefix = cleanText.substring(Math.max(0, idx - 35), idx);
      const isIssOrExp = /ISS|ISSUED|ISSUE|EXP|EXPIRES|VALID|4b|4a/i.test(prefix);
      return !isIssOrExp;
    });
    if (validNumDobMatches.length >= 1) {
      dobObj = normalizeDate(validNumDobMatches[0][1]);
    }
  }

  // E. Address, City, State/Province, ZIP/Postal
  let address = "";
  let city = "";
  let zip = extractedCanadianZip;

  const poBoxMatch = cleanText.match(/\b(PO\s*Box\s*\d+|P\.?O\.?\s*BOX\s*\d+)\b/i);
  if (poBoxMatch) {
    address = titleCase(poBoxMatch[1]).replace(/^Po\b/i, "PO");
  }

  if (!address) {
    for (const l of lines) {
      if (/Aiseon|Oe18|Cond|None|Class|Oct|Nov|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Dec|DOB|EXP|RSTR|SEX|HGT|WGT|ISS|DD\s/i.test(l)) continue;
      let cleanLine = l.replace(/^8\s+/, "").trim(); // Strip AAMVA field tag 8 prefix
      const stMatch = cleanLine.match(/\b(\d{1,6}\s+[A-Za-z0-9\s.,#-]+(?:RD|ST|STREET|ROAD|AVE|AVENUE|BLVD|LANE|LN|WAY|CT|DR|DRIVE|STE\s*\d+))\b/i);
      if (stMatch) {
        address = titleCase(stMatch[1].trim());
        break;
      }
    }
  }

  // City extraction
  const provAndStateCodes = [
    "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
  ];

  // 1. Line match with City + Province/State + Zip
  for (let l of lines) {
    let lineForCity = l.replace(/^(?:PO\s*BOX\s*\d+|P\.?O\.?\s*BOX\s*\d+|\d{1,6}\s+[A-Za-z0-9\s.,#-]+(?:RD|ST|STREET|ROAD|AVE|AVENUE|BLVD|LANE|LN|WAY|CT|DR|DRIVE|STE\s*\d+))[,\s]*/i, "").trim();

    const cityLineMatch = lineForCity.match(new RegExp(`^([A-Za-z\\s'.-]{2,30})[,\\s]+(${provAndStateCodes.join("|")})\\b[\\s,]*([A-Z0-9\\s-]{3,10})?`, "i"));
    if (cityLineMatch) {
      let candidate = cityLineMatch[1].replace(/^[,\s.-]+|[,\s.-]+$/g, "").trim();
      if (candidate && !/DRIVER|LICENCE|LICENSE|CANADA|ALBERTA|ONTARIO|CALIFORNIA|FLORIDA|TEXAS|CONNECTICUT|USA|CLASS|SEX|DOB|EXP/i.test(candidate)) {
        city = titleCase(candidate);
        if (!state) state = cityLineMatch[2].toUpperCase();
        if (cityLineMatch[3] && !zip) {
          const rawZ = cityLineMatch[3].trim();
          const canZMatch = rawZ.match(/\b([A-Z][0-9O][A-Z])[\s\-]*([0-9O][A-Z][0-9O])\b/i);
          if (canZMatch) {
            zip = `${canZMatch[1].toUpperCase().replace(/O/g, "0")} ${canZMatch[2].toUpperCase().replace(/O/g, "0")}`;
          } else {
            const usZMatch = rawZ.match(/\b\d{5}(?:-\d{4})?\b/);
            if (usZMatch) zip = usZMatch[0];
          }
        }
        break;
      }
    }
  }

  // 2. City line standalone fallback after address
  if (!city) {
    let foundAddressLine = false;
    for (const l of lines) {
      if (/\b(?:PO\s*Box|\d{1,6}\s+[A-Za-z0-9\s.,#-]+(?:RD|ST|STREET|ROAD|AVE|AVENUE|BLVD|LANE|LN|WAY|CT|DR|DRIVE))\b/i.test(l)) {
        foundAddressLine = true;
        continue;
      }
      if (foundAddressLine && !/\d/.test(l)) {
        const cleaned = l.replace(/^[,\s.-]+|[,\s.-]+$/g, "").trim();
        if (cleaned.length >= 3 && cleaned.length <= 30 && !/DRIVER|LICENCE|LICENSE|CANADA|ALBERTA|ONTARIO|QUEBEC|CALIFORNIA|FLORIDA|TEXAS|CLASS|SEX|DOB|EXP|ISSUED|DONOR|ORGAN/i.test(cleaned)) {
          city = titleCase(cleaned);
          break;
        }
      }
    }
  }

  // Universal ZIP / Postal Code Fallbacks if not already captured
  if (!zip) {
    const zip9Match = cleanText.match(/\b(\d{5}-\d{4})\b/);
    if (zip9Match) zip = zip9Match[1];
  }

  if (!zip) {
    const stateZipMatch = cleanText.match(/\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s*[:.,-]?\s*(\d{5})\b/i);
    if (stateZipMatch) zip = stateZipMatch[1];
  }

  if (!zip) {
    const labelZipMatch = cleanText.match(/(?:ZIP|Postal|Pin|Post\s*Code)[\s:]*(\d{5,6}|\d{5}-\d{4}|[A-Z][0-9O][A-Z]\s*[0-9O][A-Z][0-9O])\b/i);
    if (labelZipMatch) zip = labelZipMatch[1].toUpperCase().replace(/O/g, "0");
  }

  if (!zip) {
    const fiveDigitMatches = [...cleanText.matchAll(/\b(\d{5})\b/g)];
    for (const m of fiveDigitMatches) {
      const idx = m.index;
      const prefix = cleanText.substring(Math.max(0, idx - 20), idx);
      const suffix = cleanText.substring(idx + 5, Math.min(cleanText.length, idx + 25));

      const isDate = /[\/\-\d]$/.test(prefix) || /^[\/\-\d]/.test(suffix);
      const isLongNum = /\d$/.test(prefix) || /^\d/.test(suffix);

      if (!isDate && !isLongNum) {
        zip = m[1];
        break;
      }
    }
  }

  let gender = "";
  const sexMatch = cleanText.match(/\b(?:Sex|Gender)\s*[:.]?\s*(Male|Female|M|F|Transgender)\b/i);
  if (sexMatch) {
    const val = sexMatch[1].toUpperCase();
    gender = val.startsWith("M") ? "Male" : val.startsWith("F") ? "Female" : "Transgender";
  }

  const finalType = isAadhaar
    ? "Aadhaar Card"
    : isPassport
    ? "Passport"
    : isPan
    ? "PAN Card"
    : (isCanada || ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"].includes(state))
    ? "Canadian Driver's Licence"
    : "US Driver's License";

  const formattedIdProofNumber = rawDl
    ? (isCanada || state === "AB" || rawDl.includes("-") ? rawDl : (state ? `${state}-${rawDl}` : rawDl))
    : "";

  return {
    fullName: fullName || "",
    firstName: firstName ? titleCase(firstName) : "",
    lastName: lastName ? titleCase(lastName) : "",
    idProofNumber: formattedIdProofNumber,
    rawIdNumber: rawDl || "",
    address: address || "",
    city: city || "",
    state: state || "",
    zip: zip || "",
    dob: dobObj.standard || "",
    dobIso: dobObj.iso || "",
    exp: expObj.standard || "",
    gender: gender || "",
    type: finalType
  };
}

// 4.1 Helper to ensure Blob input
export async function ensureBlob(fileOrUrl) {
  if (!fileOrUrl) return null;
  if (fileOrUrl instanceof Blob || fileOrUrl instanceof File) {
    return fileOrUrl;
  }
  if (typeof fileOrUrl === "string") {
    try {
      const res = await fetch(fileOrUrl);
      return await res.blob();
    } catch (e) {
      console.warn("Failed to convert URL to blob for OCR:", e);
    }
  }
  return null;
}

// 4.1b Compress Blob for OCR API to keep under 900KB limit
export async function compressBlobForOCR(blob, maxKBytes = 900) {
  if (!blob || blob.size <= maxKBytes * 1024) return blob;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const maxDim = 1280;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => resolve(b || blob), "image/jpeg", 0.82);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
  });
}

// 4.1c Extract Guest Face Portrait from ID Document using Smart Face Centroid & Centered Portrait Crop
export async function extractFacePhotoFromID(fileOrUrl) {
  if (!fileOrUrl) return "";
  return new Promise((resolve) => {
    const srcUrl = typeof fileOrUrl === "string" ? fileOrUrl : URL.createObjectURL(fileOrUrl);
    let triedWithoutCors = false;

    const processImg = (img) => {
      try {
        const w = img.width || 400;
        const h = img.height || 400;
        const aspect = w / h;

        let totalSkinX = 0;
        let totalSkinY = 0;
        let skinCount = 0;

        // 1. Analyze skin-tone pixel cluster in portrait region to detect face centroid position
        try {
          const sampleCanvas = document.createElement("canvas");
          const sampleW = 200;
          const sampleH = 200;
          sampleCanvas.width = sampleW;
          sampleCanvas.height = sampleH;
          const sampleCtx = sampleCanvas.getContext("2d");
          sampleCtx.drawImage(img, 0, 0, sampleW, sampleH);

          const imgData = sampleCtx.getImageData(0, 0, sampleW, sampleH);
          const data = imgData.data;

          // Search portrait region (left 45% of card)
          const searchMaxX = Math.round(sampleW * 0.45);

          for (let y = Math.round(sampleH * 0.15); y < Math.round(sampleH * 0.85); y += 2) {
            for (let x = Math.round(sampleW * 0.05); x < searchMaxX; x += 2) {
              const idx = (y * sampleW + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              // Skin-tone detection threshold
              if (r > 60 && g > 35 && b > 20 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b)) > 15) {
                totalSkinX += x;
                totalSkinY += y;
                skinCount++;
              }
            }
          }
        } catch (err) {}

        let cropX = 0;
        let cropY = 0;
        let cropW = w;
        let cropH = h;

        if (skinCount > 40) {
          // Centroid of face skin pixels in relative scale (0 to 1)
          const faceCenterX = (totalSkinX / skinCount) / 200;
          const faceCenterY = (totalSkinY / skinCount) / 200;

          const cropDim = Math.min(w, h) * 0.38;
          cropW = cropDim;
          cropH = cropDim;
          cropX = Math.max(0, Math.min(w - cropW, faceCenterX * w - cropW / 2));
          cropY = Math.max(0, Math.min(h - cropH, faceCenterY * h - cropH * 0.45));
        } else if (aspect >= 1.1) {
          // Fallback: Perfectly centered face portrait crop (12% from left, 22% from top)
          cropX = Math.round(w * 0.12);
          cropY = Math.round(h * 0.22);
          cropW = Math.round(w * 0.25);
          cropH = Math.round(h * 0.54);
        } else {
          cropX = Math.round(w * 0.15);
          cropY = Math.round(h * 0.15);
          cropW = Math.round(w * 0.70);
          cropH = Math.round(h * 0.60);
        }

        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 400, 400);

        try {
          const faceDataUrl = canvas.toDataURL("image/jpeg", 0.92);
          if (typeof fileOrUrl !== "string") {
            URL.revokeObjectURL(srcUrl);
          }
          resolve(faceDataUrl);
        } catch (e) {
          // Canvas export blocked by CORS
          resolve(srcUrl);
        }
      } catch (e) {
        resolve(srcUrl);
      }
    };

    const loadImg = (useCors) => {
      const img = new Image();
      if (useCors) img.crossOrigin = "anonymous";
      img.onload = () => processImg(img);
      img.onerror = () => {
        if (useCors && !triedWithoutCors) {
          triedWithoutCors = true;
          loadImg(false);
        } else {
          resolve(srcUrl);
        }
      };
      img.src = srcUrl;
    };

    loadImg(true);
  });
}

// 4.2 Free Cloud OCR API Integrator (OCR.space API with Base64 & Dual Engine Fallback)
export async function performFreeOCRAPI(fileOrBlob) {
  if (!fileOrBlob) return { success: false, text: "", engine: null };

  const rawBlob = await ensureBlob(fileOrBlob);
  if (!rawBlob) return { success: false, text: "", engine: null };

  const blob = await compressBlobForOCR(rawBlob, 900);

  // Convert blob to base64 Data URL for robust API transmission
  let base64Image = "";
  try {
    base64Image = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch (e) {}

  const apiKeys = [
    import.meta.env?.VITE_OCR_SPACE_API_KEY,
    "898822888888888",
    "K87899142388957",
    "K83489115788957",
    "helloworld"
  ].filter(Boolean);

  const engines = ["2", "1"];

  for (const apiKey of apiKeys) {
    for (const engine of engines) {
      try {
        const formData = new FormData();
        formData.append("apikey", apiKey);
        formData.append("language", "eng");
        formData.append("isOverlayRequired", "false");
        formData.append("detectOrientation", "true");
        formData.append("scale", "true");
        formData.append("OCREngine", engine);

        if (base64Image) {
          formData.append("base64image", base64Image);
        } else {
          const fileName = blob.name || "scanned_id.jpg";
          formData.append("file", blob, fileName);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const result = await response.json();

        if (result && !result.IsErroredOnProcessing && Array.isArray(result.ParsedResults) && result.ParsedResults.length > 0) {
          const extractedText = result.ParsedResults.map((r) => r.ParsedText).join("\n").trim();
          if (extractedText && extractedText.length > 3) {
            return {
              success: true,
              text: extractedText,
              engine: `⚡ Cloud Free OCR API (Engine ${engine})`
            };
          }
        }
      } catch (err) {
        console.warn(`Free OCR API call failed with key: ${apiKey}, engine: ${engine}`, err);
      }
    }
  }

  return { success: false, text: "", engine: null };
}

// 4.3 Mindee Cloud AI Document API Integrator
export async function performMindeeOCRAPI(fileOrBlob, apiKey = INBUILT_MINDEE_API_KEY) {
  const keyToUse = (apiKey || INBUILT_MINDEE_API_KEY).trim();
  if (!fileOrBlob || !keyToUse) return { success: false, text: "", parsed: null, engine: null };

  const rawBlob = await ensureBlob(fileOrBlob);
  if (!rawBlob) return { success: false, text: "", parsed: null, engine: null };

  const blob = await compressBlobForOCR(rawBlob, 900);
  const fileName = blob.name || "scanned_id.jpg";

  const endpoints = [
    "https://api.mindee.net/v1/products/mindee/us_driver_license/v1/predict",
    "https://api.mindee.net/v1/products/mindee/passport/v1/predict",
    "https://api.mindee.net/v1/products/mindee/international_id/v1/predict",
    "https://api.mindee.net/v1/products/mindee/idcard_fr/v1/predict"
  ];

  for (const endpoint of endpoints) {
    try {
      const formData = new FormData();
      formData.append("document", blob, fileName);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Token ${keyToUse}`
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();
      const prediction = data?.document?.inference?.prediction;
      if (!prediction) continue;

      let textLines = [];

      let givenNames = "";
      if (Array.isArray(prediction.given_names)) {
        givenNames = prediction.given_names.map((g) => g?.value).filter(Boolean).join(" ");
      } else if (prediction.given_names?.value) {
        givenNames = prediction.given_names.value;
      } else if (prediction.first_name?.value) {
        givenNames = prediction.first_name.value;
      }

      let surname = prediction.surname?.value || prediction.last_name?.value || prediction.family_name?.value || "";
      if (surname) textLines.push(`LN: ${surname}`);
      if (givenNames) textLines.push(`FN: ${givenNames}`);

      const idNum = prediction.id_number?.value || prediction.document_number?.value || prediction.license_number?.value || prediction.passport_number?.value || "";
      if (idNum) textLines.push(`DL: ${idNum}`);

      const dobVal = prediction.birth_date?.value || prediction.dob?.value || prediction.date_of_birth?.value || "";
      if (dobVal) textLines.push(`DOB: ${dobVal}`);

      const expVal = prediction.expiry_date?.value || prediction.exp_date?.value || "";
      if (expVal) textLines.push(`EXP: ${expVal}`);

      const addrVal = prediction.address?.value || prediction.street_address?.value || "";
      if (addrVal) textLines.push(`ADDRESS: ${addrVal}`);

      const cityVal = prediction.city?.value || "";
      const stateVal = prediction.state?.value || prediction.province?.value || "";
      const zipVal = prediction.postal_code?.value || prediction.zip_code?.value || "";

      if (cityVal || stateVal || zipVal) {
        textLines.push(`${cityVal} ${stateVal} ${zipVal}`.trim());
      }

      // Reconstruct raw text from pages if available
      const pages = data?.document?.inference?.pages || [];
      for (const page of pages) {
        if (page.prediction) {
          for (const key of Object.keys(page.prediction)) {
            const field = page.prediction[key];
            if (field && typeof field === "object") {
              if (field.value) textLines.push(String(field.value));
              else if (Array.isArray(field.values)) {
                field.values.forEach((v) => v?.value && textLines.push(String(v.value)));
              }
            }
          }
        }
      }

      const reconstructedText = textLines.join("\n").trim();
      const ocrParsed = parseFrontOCRText(reconstructedText) || {};

      const normDob = dobVal ? normalizeDate(dobVal) : { standard: "", iso: "" };
      const normExp = expVal ? normalizeDate(expVal) : { standard: "", iso: "" };

      const finalParsed = {
        firstName: givenNames ? titleCase(givenNames) : (ocrParsed.firstName || ""),
        lastName: surname ? titleCase(surname) : (ocrParsed.lastName || ""),
        fullName: [givenNames, surname].filter(Boolean).map(titleCase).join(" ") || ocrParsed.fullName || "",
        idProofNumber: idNum || ocrParsed.idProofNumber || "",
        rawIdNumber: idNum || ocrParsed.rawIdNumber || "",
        address: addrVal ? titleCase(addrVal) : (ocrParsed.address || ""),
        city: cityVal ? titleCase(cityVal) : (ocrParsed.city || ""),
        state: stateVal ? stateVal.toUpperCase() : (ocrParsed.state || ""),
        zip: zipVal || ocrParsed.zip || "",
        dob: normDob.standard || ocrParsed.dob || "",
        dobIso: normDob.iso || ocrParsed.dobIso || "",
        exp: normExp.standard || ocrParsed.exp || "",
        gender: ocrParsed.gender || "",
        type: ocrParsed.type || "Driver's License / ID"
      };

      if (finalParsed.fullName || finalParsed.idProofNumber) {
        return {
          success: true,
          text: reconstructedText,
          parsed: finalParsed,
          engine: "🧠 Mindee AI Document API"
        };
      }
    } catch (err) {
      console.warn(`Mindee API call failed for endpoint ${endpoint}:`, err);
    }
  }

  return { success: false, text: "", parsed: null, engine: null };
}

// Helper: Precise Canvas Cropping for AI Face Bounding Boxes
export function cropImageCanvas(blob, cropX, cropY, cropW, cropH) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.src = url;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = Math.max(cropW, cropH, 300);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);

        const scale = Math.min(size / cropW, size / cropH);
        const drawW = cropW * scale;
        const drawH = cropH * scale;
        const offsetX = (size - drawW) / 2;
        const offsetY = (size - drawH) / 2;

        ctx.drawImage(img, cropX, cropY, cropW, cropH, offsetX, offsetY, drawW, drawH);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (err) {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}

// 4.4 Google Cloud Vision AI Document & Face Integrator
export async function performGoogleVisionOCRAPI(fileOrBlob, apiKey = INBUILT_GOOGLE_VISION_API_KEY) {
  const keyToUse = (apiKey || INBUILT_GOOGLE_VISION_API_KEY).trim();
  if (!fileOrBlob || !keyToUse) return { success: false, text: "", parsed: null, engine: null, faceCropUrl: null };

  const rawBlob = await ensureBlob(fileOrBlob);
  if (!rawBlob) return { success: false, text: "", parsed: null, engine: null, faceCropUrl: null };

  try {
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result || "";
        resolve(res.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(rawBlob);
    });

    if (!base64Data) return { success: false, text: "", parsed: null, engine: null, faceCropUrl: null };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${keyToUse}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Data },
            features: [
              { type: "TEXT_DETECTION" },
              { type: "FACE_DETECTION" }
            ]
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("Google Vision API error status:", response.status);
      return { success: false, text: "", parsed: null, engine: null, faceCropUrl: null };
    }

    const json = await response.json();
    const resObj = json?.responses?.[0] || {};

    const textAnnotations = resObj.textAnnotations || [];
    const fullText = textAnnotations[0]?.description || "";

    let faceCropUrl = null;
    const faceAnnotations = resObj.faceAnnotations || [];
    if (faceAnnotations.length > 0) {
      const face = faceAnnotations[0];
      const poly = face.fdBoundingPoly || face.boundingPoly;
      if (poly && Array.isArray(poly.vertices) && poly.vertices.length > 0) {
        const xs = poly.vertices.map((v) => v.x ?? 0);
        const ys = poly.vertices.map((v) => v.y ?? 0);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const faceW = maxX - minX;
        const faceH = maxY - minY;

        if (faceW > 10 && faceH > 10) {
          const padX = Math.round(faceW * 0.25);
          const padY = Math.round(faceH * 0.25);

          const cropX = Math.max(0, minX - padX);
          const cropY = Math.max(0, minY - padY);
          const cropW = faceW + padX * 2;
          const cropH = faceH + padY * 2;

          faceCropUrl = await cropImageCanvas(rawBlob, cropX, cropY, cropW, cropH);
        }
      }
    }

    if (!fullText) {
      return { success: false, text: "", parsed: null, engine: null, faceCropUrl };
    }

    const ocrParsed = parseFrontOCRText(fullText) || {};

    if (ocrParsed.zip) {
      ocrParsed.zip = ocrParsed.zip.replace(/\s+/g, "");
    }

    return {
      success: true,
      text: fullText,
      parsed: ocrParsed,
      engine: "🥇 Google Cloud Vision AI",
      faceCropUrl
    };
  } catch (err) {
    console.warn("Google Cloud Vision API failed:", err);
    return { success: false, text: "", parsed: null, engine: null, faceCropUrl: null };
  }
}

// 5. Image Pre-processor
export async function enhanceImageForOCR(fileUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = fileUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = 2.0;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          const contrast = (gray - 128) * 1.25 + 128;
          const finalVal = Math.min(255, Math.max(0, contrast));
          data[i] = finalVal;
          data[i + 1] = finalVal;
          data[i + 2] = finalVal;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      } catch (e) {
        resolve(fileUrl);
      }
    };
    img.onerror = () => resolve(fileUrl);
  });
}

// 6. Barcode Pipeline
export async function scanAllBarcodePipeline(fileUrl) {
  if ("BarcodeDetector" in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ["pdf417", "qr_code", "code_128"] });
      const img = new Image();
      img.src = fileUrl;
      await new Promise((r) => (img.onload = r));
      const barcodes = await detector.detect(img);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch (e) {}
  }

  if (!window.ZXing) {
    await new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  if (!window.ZXing) return null;

  try {
    const reader = new window.ZXing.BrowserPDF417Reader();
    const result = await reader.decodeFromImageUrl(fileUrl);
    if (result && typeof result.getText === "function" && result.getText()) {
      return result.getText();
    }
  } catch (e) {}

  return null;
}

export default function AIIDScannerModal({ isOpen, onClose, onScanComplete }) {
  const { confirmAction } = usePMS();
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("Ready");
  const [scannedData, setScannedData] = useState(null);
  const [googleVisionApiKey, setGoogleVisionApiKey] = useState(() => {
    return dataStore.getItem("GOOGLE_VISION_API_KEY") || import.meta.env?.VITE_GOOGLE_VISION_API_KEY || INBUILT_GOOGLE_VISION_API_KEY;
  });
  const [mindeeApiKey, setMindeeApiKey] = useState(() => {
    return dataStore.getItem("MINDEE_API_KEY") || import.meta.env?.VITE_MINDEE_API_KEY || "";
  });
  const [showMindeeConfig, setShowMindeeConfig] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "environment"
          }
        });
      } catch (e) {
        // Fallback for laptop webcams / USB cameras without environment facingMode
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      }
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Camera access failed:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  if (!isOpen) return null;

  const processFile = async (file) => {
    if (!file) return;
    setIsScanning(true);
    setScanStatus("In Process............");

    let fileUrl = "";
    let fileBlob = null;
    let fileName = "license_image.jpg";

    if (file instanceof Blob || file instanceof File) {
      fileBlob = file;
      fileUrl = URL.createObjectURL(file);
      fileName = file.name || "license_image.jpg";
    } else if (typeof file === "string") {
      fileUrl = file;
      fileBlob = await ensureBlob(file);
    }

    try {
      // Extract Face Portrait from ID image
      const facePhotoUrl = await extractFacePhotoFromID(fileBlob || fileUrl);

      // 1. Try PDF417 / ZXing Barcode Scanning (Back of card)
      const decodedBarcode = await scanAllBarcodePipeline(fileUrl);
      let finalResult = null;

      if (decodedBarcode) {
        const parsedAAMVA = parseAAMVAPDF417Text(decodedBarcode);
        if (parsedAAMVA && isMeaningfulScan(parsedAAMVA)) {
          finalResult = {
            ...parsedAAMVA,
            zip: parsedAAMVA.zip ? parsedAAMVA.zip.replace(/\s+/g, "") : "",
            photo: fileUrl,
            fullScanPhoto: fileUrl,
            scannedIdUrl: fileUrl,
            idFront: fileUrl,
            facePhoto: facePhotoUrl || "",
            guestPhoto: facePhotoUrl || "",
            photoUrl: facePhotoUrl || "",
            capturedPhoto: facePhotoUrl || "",
            fileName: fileName,
            email: "",
            phone: "",
            scanSource: "📦 PDF417 Barcode (Back)",
            isAAMVAValid: true
          };
        }
      }

      // 2. Front Photo OCR: Priority 1 = Google Cloud Vision API, Priority 2 = Mindee AI API, Priority 3 = Free Cloud OCR API, Priority 4 = Local Tesseract
      if (!finalResult) {
        let ocrText = "";
        let usedEngine = "Front Photo OCR";

        if (fileBlob) {
          setScanStatus("In Process............");
          const googleRes = await performGoogleVisionOCRAPI(fileBlob, googleVisionApiKey || INBUILT_GOOGLE_VISION_API_KEY);
          if (googleRes.success && googleRes.parsed) {
            const extractedFace = googleRes.faceCropUrl || facePhotoUrl;
            finalResult = {
              title: `Uploaded Document: ${fileName}`,
              ...googleRes.parsed,
              zip: googleRes.parsed.zip ? googleRes.parsed.zip.replace(/\s+/g, "") : "",
              email: "",
              phone: "",
              photo: fileUrl,
              fullScanPhoto: fileUrl,
              scannedIdUrl: fileUrl,
              idFront: fileUrl,
              facePhoto: extractedFace || "",
              guestPhoto: extractedFace || "",
              photoUrl: extractedFace || "",
              capturedPhoto: extractedFace || "",
              fileName: fileName,
              rawAAMVA: googleRes.text,
              scanSource: googleRes.engine || "🥇 Google Cloud Vision AI",
              isAAMVAValid: isMeaningfulScan(googleRes.parsed)
            };
          }
        }

        if (!finalResult && fileBlob) {
          setScanStatus("In Process............");
          const mindeeRes = await performMindeeOCRAPI(fileBlob, mindeeApiKey || INBUILT_MINDEE_API_KEY);
          if (mindeeRes.success && mindeeRes.parsed) {
            finalResult = {
              title: `Uploaded Document: ${fileName}`,
              ...mindeeRes.parsed,
              zip: mindeeRes.parsed.zip ? mindeeRes.parsed.zip.replace(/\s+/g, "") : "",
              email: "",
              phone: "",
              photo: fileUrl,
              fullScanPhoto: fileUrl,
              scannedIdUrl: fileUrl,
              idFront: fileUrl,
              facePhoto: facePhotoUrl || "",
              guestPhoto: facePhotoUrl || "",
              photoUrl: facePhotoUrl || "",
              capturedPhoto: facePhotoUrl || "",
              fileName: fileName,
              rawAAMVA: mindeeRes.text,
              scanSource: mindeeRes.engine || "🧠 Mindee AI Document API",
              isAAMVAValid: isMeaningfulScan(mindeeRes.parsed)
            };
          }
        }

        if (!finalResult) {
          setScanStatus("In Process............");
          if (fileBlob) {
            const apiRes = await performFreeOCRAPI(fileBlob);
            if (apiRes.success) {
              ocrText = apiRes.text;
              usedEngine = apiRes.engine || "⚡ Cloud Free OCR API";
            }
          }

          // Fallback to local Tesseract if cloud API returned no text or network was offline
          if (!ocrText || ocrText.trim().length < 4) {
            setScanStatus("In Process............");
            const enhancedImageUrl = await enhanceImageForOCR(fileUrl);

            if (!window.Tesseract) {
              const cdns = [
                "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
                "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js",
                "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js"
              ];
              for (const src of cdns) {
                try {
                  await new Promise((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = src;
                    script.onload = () => resolve();
                    script.onerror = () => reject();
                    document.head.appendChild(script);
                  });
                  if (window.Tesseract) break;
                } catch (e) {}
              }
            }

            if (window.Tesseract) {
              try {
                const res = await window.Tesseract.recognize(enhancedImageUrl, "eng");
                ocrText = res?.data?.text || "";
                usedEngine = "💻 Local Tesseract Engine (Offline)";
              } catch (e) {
                console.warn("Local Tesseract recognition failed:", e);
              }
            }
          }

          const ocrParsed = parseFrontOCRText(ocrText);
          finalResult = {
            title: `Uploaded Document: ${fileName}`,
            type: ocrParsed.type || "Driver's License / ID",
            fullName: ocrParsed.fullName || "",
            firstName: ocrParsed.firstName || "",
            lastName: ocrParsed.lastName || "",
            idProofNumber: ocrParsed.idProofNumber || "",
            rawIdNumber: ocrParsed.rawIdNumber || "",
            address: ocrParsed.address || "",
            city: ocrParsed.city || "",
            state: ocrParsed.state || "",
            zip: ocrParsed.zip ? ocrParsed.zip.replace(/\s+/g, "") : "",
            dob: ocrParsed.dob || "",
            dobIso: ocrParsed.dobIso || "",
            gender: ocrParsed.gender || "",
            email: "",
            phone: "",
            photo: fileUrl,
            fullScanPhoto: fileUrl,
            scannedIdUrl: fileUrl,
            idFront: fileUrl,
            facePhoto: facePhotoUrl || "",
            guestPhoto: facePhotoUrl || "",
            photoUrl: facePhotoUrl || "",
            capturedPhoto: facePhotoUrl || "",
            fileName: fileName,
            rawAAMVA: ocrText,
            scanSource: usedEngine,
            isAAMVAValid: isMeaningfulScan(ocrParsed)
          };
        }
      }

      setScannedData(finalResult);
    } catch (err) {
      console.error("Scan processing error:", err);
    } finally {
      setIsScanning(false);
      setScanStatus("Ready");
    }
  };

  const captureCameraFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
        processFile(file);
      }
    }, "image/jpeg", 0.95);
  };

  // Maps values to all possible parent form keys
  const handleApply = () => {
    if (scannedData && onScanComplete) {
      let fName = scannedData.firstName?.trim() || "";
      let lName = scannedData.lastName?.trim() || "";

      if (!fName && scannedData.fullName) {
        const parts = scannedData.fullName.trim().split(" ");
        fName = parts[0] || "";
        lName = parts.slice(1).join(" ") || "";
      }

      const rawDob = scannedData.dob || "";
      const rawIsoDob = scannedData.dobIso || "";

      // Full US State & Canadian Province Map Dictionary
      const stateMap = {
        AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
        CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
        HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
        KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
        MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
        MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
        NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
        OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
        SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
        VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
        DC: "District of Columbia",
        AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
        NL: "Newfoundland", NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut",
        ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon"
      };

      let fullState = scannedData.state ? (stateMap[scannedData.state.toUpperCase()] || scannedData.state) : "";
      const effectiveIdNumber = scannedData.rawIdNumber || scannedData.idProofNumber || "";
      const fullDocUrl = scannedData.fullScanPhoto || scannedData.scannedIdUrl || scannedData.idFront || scannedData.photo;
      const facePhotoUrl = scannedData.facePhoto || scannedData.guestPhoto || scannedData.capturedPhoto || "";
      const cleanZip = scannedData.zip ? scannedData.zip.replace(/\s+/g, "") : "";

      const payload = {
        ...scannedData,
        firstName: fName,
        lastName: lName,
        fullName: `${fName} ${lName}`.trim() || scannedData.fullName,
        email: scannedData.email?.trim() || "",
        emailAddress: scannedData.email?.trim() || "",
        phoneNumber: scannedData.phone?.trim() || "",
        // Maps ID number to all commonly used parent keys
        govtIdNumber: effectiveIdNumber,
        govtId: effectiveIdNumber,
        idNumber: effectiveIdNumber,
        idProofNumber: scannedData.idProofNumber || effectiveIdNumber,
        licenseNumber: effectiveIdNumber,
        streetAddress: scannedData.address || "",
        address: scannedData.address || "",
        city: scannedData.city || "",
        // Maps state / province to all commonly used parent keys
        state: fullState,
        province: fullState,
        stateCode: scannedData.state || "",
        zip: cleanZip,
        zipCode: cleanZip,
        postalCode: cleanZip,
        // Maps DOB to all commonly used parent keys
        dob: rawDob,
        dateOfBirth: rawDob,
        birthDate: rawDob,
        guestDob: rawDob,
        dobIso: rawIsoDob,
        birthDateIso: rawIsoDob,
        gender: scannedData.gender || "",
        selectIdType: scannedData.type || "Driver's License",

        // 1. Full ID Document Scan Image (Section 1: Scanned Images / Identity Documents)
        photo: fullDocUrl,
        fullScanPhoto: fullDocUrl,
        scannedIdUrl: fullDocUrl,
        idFront: fullDocUrl,
        idDocumentUrl: fullDocUrl,
        scannedImages: [
          {
            id: `scanned_${Date.now()}`,
            title: `${scannedData.type || "US Driver's License"} - Front`,
            idType: scannedData.type || "Driver's License",
            idNumber: effectiveIdNumber || 'Verified',
            issueCountry: fullState || scannedData.state || 'United States',
            url: fullDocUrl,
            uploadedAt: new Date().toISOString(),
            source: scannedData.scanSource || 'AI ID Scanner'
          }
        ],

        // 2. Extracted Face Photo (Hover Window & Section 2: Captured Images / Profile Photo)
        facePhoto: facePhotoUrl,
        guestPhoto: facePhotoUrl,
        photoUrl: facePhotoUrl,
        capturedPhoto: facePhotoUrl,
        capturedImages: facePhotoUrl ? [
          {
            id: `captured_${Date.now()}`,
            title: 'Guest Check-In Photo (Extracted Face)',
            url: facePhotoUrl,
            capturedAt: new Date().toISOString(),
            source: 'AI ID Scanner (Face Extraction)',
            resolution: '400x400'
          }
        ] : []
      };

      const performApply = () => {
        onScanComplete(payload);
        onClose();
      };

      const fullName = `${fName} ${lName}`.trim() || scannedData.fullName || "Guest";

      confirmAction({
        title: "Import Scanned ID Data",
        message: `Are you sure you want to apply extracted ID details for ${fullName} onto the reservation?`,
        details: [
          { label: "Guest Name", value: fullName },
          { label: "Document Type", value: scannedData.documentType || "ID Card" },
          { label: "ID / Passport #", value: scannedData.idNumber || "Extracted" }
        ],
        confirmText: "Yes, Apply Data",
        variant: "primary",
        executionTitle: "ID Data Applied Successfully",
        executionMessage: `Scanned document details for ${fullName} have been auto-filled onto the guest profile & reservation.`,
        onConfirm: performApply
      });
    }
  };

  const handleFieldChange = (field, value) => {
    setScannedData((prev) => {
      if (!prev) return null;
      const updated = { ...prev, [field]: value };
      if (field === "fullName") {
        const parts = value.trim().split(" ");
        updated.firstName = parts[0] || "";
        updated.lastName = parts.slice(1).join(" ") || "";
      }
      if (field === "dob") {
        const normalized = normalizeDate(value);
        updated.dob = value;
        updated.dobIso = normalized.iso;
      }
      if (field === "zip") {
        updated.zip = value ? value.replace(/\s+/g, "") : "";
      }
      return updated;
    });
  };

  return (
    <div className="ai-modal-overlay">
      <div className="ai-modal-card dark-theme-scanner" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="ai-modal-head">
          <div className="ai-title-box">
            <h3>Capture Front ID</h3>
          </div>
          <button type="button" className="ai-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ai-modal-body">
          <div className="camera-viewfinder-container">
            <video ref={videoRef} className="camera-video-feed" autoPlay playsInline muted />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            
            {/* White L-bracket corner guides */}
            <div className="corner-bracket top-left"></div>
            <div className="corner-bracket top-right"></div>
            <div className="corner-bracket bottom-left"></div>
            <div className="corner-bracket bottom-right"></div>

            {/* Instruction overlay pill */}
            <div className="scan-instruction-pill">
              Fit the entire front of the ID inside the frame
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            style={{ display: "none" }}
          />

          <div className="camera-action-bar" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button
              type="button"
              className="btn-upload-photo"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
            >
              📥 Upload Photo
            </button>
            <button
              type="button"
              className="btn-capture-scan"
              onClick={captureCameraFrame}
              disabled={isScanning}
            >
              {isScanning ? scanStatus : "📷 Capture & Scan Photo"}
            </button>
          </div>

          {scannedData && (
            <div
              className="ai-extracted-results"
              style={{
                background: "#f8fafc",
                border: "1.5px solid #cbd5e1",
                color: "#0f172a",
                borderRadius: 12,
                padding: 14,
                marginTop: 14
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, color: scannedData.isAAMVAValid ? "#16a34a" : "#b45309", fontSize: "13.5px", fontWeight: 800 }}>
                    {scannedData.isAAMVAValid ? "✅ ID Details Extracted Successfully" : "⚠️ Please Verify Extracted ID Details"}
                  </h4>
                </div>
                <button
                  type="button"
                  style={{
                    background: "#0f172a",
                    color: "#ffffff",
                    fontWeight: 700,
                    padding: "6px 14px",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                  onClick={handleApply}
                >
                  Apply Details to Reservation
                </button>
              </div>

              <div style={{ display: "flex", gap: 14 }}>
                {/* Dual Image Preview: Extracted Face (Hover & Profile) + Full ID Scan */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <img
                      src={scannedData.facePhoto || scannedData.photo}
                      alt="Extracted Guest Face"
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "2px solid #2563eb", background: "#f1f5f9" }}
                    />
                    <span style={{ color: "#1e293b", fontSize: "10px", fontWeight: 800 }}>👤 Face Image</span>
                    <span style={{ color: "#64748b", fontSize: "9px" }}>(Hover Window)</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <img
                      src={scannedData.photo || scannedData.fullScanPhoto}
                      alt="Full ID Document Scan"
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "2px solid #16a34a", background: "#f1f5f9" }}
                    />
                    <span style={{ color: "#1e293b", fontSize: "10px", fontWeight: 800 }}>🆔 Full Document</span>
                    <span style={{ color: "#64748b", fontSize: "9px" }}>(Scanned ID)</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: 1 }}>
                  <div className="result-field">
                    <span style={{ color: "#475569", fontSize: "11px", fontWeight: 700 }}>First Name:</span>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={scannedData.firstName || ""}
                      placeholder="e.g. Veer Haresh"
                      onChange={(e) => handleFieldChange("firstName", e.target.value)}
                    />
                  </div>

                  <div className="result-field">
                    <span style={{ color: "#475569", fontSize: "11px", fontWeight: 700 }}>Last Name:</span>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={scannedData.lastName || ""}
                      placeholder="e.g. Sheta"
                      onChange={(e) => handleFieldChange("lastName", e.target.value)}
                    />
                  </div>

                  <div className="result-field">
                    <span style={{ color: "#475569", fontSize: "11px", fontWeight: 700 }}>Driver Licence / ID No:</span>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={scannedData.rawIdNumber || scannedData.idProofNumber || ""}
                      placeholder="e.g. 178366-647"
                      onChange={(e) => {
                        handleFieldChange("rawIdNumber", e.target.value);
                        handleFieldChange("idProofNumber", e.target.value);
                      }}
                    />
                  </div>

                  <div className="result-field">
                    <span style={{ color: "#475569", fontSize: "11px", fontWeight: 700 }}>Street Address / PO Box:</span>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={scannedData.address || ""}
                      placeholder="e.g. PO Box 231"
                      onChange={(e) => handleFieldChange("address", e.target.value)}
                    />
                  </div>

                  <div className="result-field">
                    <span style={{ color: "#475569", fontSize: "11px", fontWeight: 700 }}>City:</span>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={scannedData.city || ""}
                      placeholder="e.g. Lac La Biche"
                      onChange={(e) => handleFieldChange("city", e.target.value)}
                    />
                  </div>

                  <div className="result-field">
                    <span style={{ color: "#475569", fontSize: "11px", fontWeight: 700 }}>Province / State:</span>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={scannedData.state === "AB" ? "Alberta" : (scannedData.state || "")}
                      placeholder="e.g. Alberta"
                      onChange={(e) => handleFieldChange("state", e.target.value)}
                    />
                  </div>

                  <div className="result-field">
                    <span style={{ color: "#475569", fontSize: "11px", fontWeight: 700 }}>Postal Code / ZIP:</span>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={scannedData.zip || ""}
                      placeholder="e.g. T0A 2C0"
                      onChange={(e) => handleFieldChange("zip", e.target.value)}
                    />
                  </div>

                  <div className="result-field">
                    <span style={{ color: "#475569", fontSize: "11px", fontWeight: 700 }}>Date of Birth (DOB):</span>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={scannedData.dob || ""}
                      placeholder="MM/DD/YYYY"
                      onChange={(e) => handleFieldChange("dob", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}