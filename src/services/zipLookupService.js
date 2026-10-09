// Service to look up City and State/Province (Full Name) for US and Canada Zip/Postal Codes

const US_STATE_MAP = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
  PR: "Puerto Rico",
  VI: "Virgin Islands",
  GU: "Guam"
};

const CA_PROVINCE_MAP = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon"
};

/**
 * Global Country Code Mapping & Standardizers
 */
export const COUNTRY_MAP = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  UK: "United Kingdom",
  MX: "Mexico",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  AU: "Australia",
  IN: "India",
  JP: "Japan",
  BR: "Brazil"
};

/**
 * Normalizes state abbreviation to Full Name if applicable
 */
export function getFullStateName(stateStr, isCanada = false) {
  if (!stateStr) return "";
  const trimmed = stateStr.trim();
  const upper = trimmed.toUpperCase();

  if (isCanada) {
    if (CA_PROVINCE_MAP[upper]) return CA_PROVINCE_MAP[upper];
  } else {
    if (US_STATE_MAP[upper]) return US_STATE_MAP[upper];
  }

  return trimmed;
}

/**
 * Fetches City, State (Full Name), and Country for any given worldwide zip/postal code.
 */
export async function fetchCityStateFromZip(inputZip) {
  if (!inputZip || typeof inputZip !== "string") return null;

  const cleaned = inputZip.trim().toUpperCase().replace(/\s+/g, "");
  if (cleaned.length < 3) return null;

  const isUsZip = /^\d{5}$/.test(cleaned);
  const isCaPostal = /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned) || /^[A-Z]\d[A-Z]$/.test(cleaned);
  const isUkPostal = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned);

  // 1. Try Zippopotam API for supported countries
  const targetCountry = isUsZip ? "us" : isCaPostal ? "ca" : isUkPostal ? "gb" : "us";

  try {
    const lookupKey = isCaPostal ? cleaned.substring(0, 3) : isUkPostal ? cleaned.substring(0, 4) : cleaned;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 1500) : null;
    const response = await fetch(`https://api.zippopotam.us/${targetCountry}/${lookupKey}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    }).finally(() => { if (timeoutId) clearTimeout(timeoutId); });

    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.places) && data.places.length > 0) {
        const place = data.places[0];
        const rawCity = place["place name"] || "";
        const rawStateAbbr = place["state abbreviation"] || place["state"] || "";
        const fullStateName = getFullStateName(rawStateAbbr, isCaPostal);
        const countryName = COUNTRY_MAP[data["country abbreviation"]?.toUpperCase()] || data["country"] || (isUsZip ? "United States" : "Canada");

        return {
          city: rawCity,
          state: fullStateName || rawStateAbbr,
          stateAbbr: rawStateAbbr,
          country: countryName
        };
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // 2. Global OpenStreetMap Nominatim Geocoding API Fallback for ALL world postal codes
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 1500) : null;
    const response = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleaned)}&format=json&addressdetails=1`, {
      method: "GET",
      headers: { "Accept-Language": "en" },
      signal: controller?.signal,
    }).finally(() => { if (timeoutId) clearTimeout(timeoutId); });


    if (response.ok) {
      const results = await response.json();
      if (Array.isArray(results) && results.length > 0) {
        const addr = results[0].address || {};
        const rawCity = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.county || "";
        const rawState = addr.state || addr.region || addr.province || addr.state_district || "";
        const rawCountry = addr.country || "";

        if (rawCity || rawState || rawCountry) {
          return {
            city: rawCity,
            state: getFullStateName(rawState),
            stateAbbr: rawState,
            country: rawCountry || "United States"
          };
        }
      }
    }
  } catch (err) {
    // Fail silently so typing is smooth
  }

  return null;
}
