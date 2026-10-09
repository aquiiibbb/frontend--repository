import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCityStateFromZip, getFullStateName } from '../services/zipLookupService';

describe('Zip Lookup Service (US & Canada)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly maps US state abbreviations to Full Names', () => {
    expect(getFullStateName('CA')).toBe('California');
    expect(getFullStateName('NY')).toBe('New York');
    expect(getFullStateName('TX')).toBe('Texas');
    expect(getFullStateName('FL')).toBe('Florida');
    expect(getFullStateName('California')).toBe('California');
  });

  it('correctly maps Canadian province abbreviations to Full Names', () => {
    expect(getFullStateName('ON', true)).toBe('Ontario');
    expect(getFullStateName('BC', true)).toBe('British Columbia');
    expect(getFullStateName('QC', true)).toBe('Quebec');
    expect(getFullStateName('AB', true)).toBe('Alberta');
    expect(getFullStateName('Ontario', true)).toBe('Ontario');
  });

  it('returns null for invalid zip code formats', async () => {
    const invalidZip = await fetchCityStateFromZip('12');
    expect(invalidZip).toBeNull();

    const invalidAlpha = await fetchCityStateFromZip('INVALID');
    expect(invalidAlpha).toBeNull();
  });

  it('fetches City, State (Full Name), and Country for valid US 5-digit ZIP (90210)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        "post code": "90210",
        country: "United States",
        places: [
          {
            "place name": "Beverly Hills",
            state: "California",
            "state abbreviation": "CA"
          }
        ]
      })
    });

    const result = await fetchCityStateFromZip('90210');
    expect(result).not.toBeNull();
    expect(result.city).toBe('Beverly Hills');
    expect(result.state).toBe('California');
    expect(result.country).toBe('United States');
  });

  it('fetches City, Province (Full Name), and Country for valid Canadian Postal Code (K1A 0B1)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        "post code": "K1A",
        country: "Canada",
        places: [
          {
            "place name": "Ottawa",
            state: "Ontario",
            "state abbreviation": "ON"
          }
        ]
      })
    });

    const result = await fetchCityStateFromZip('K1A 0B1');
    expect(result).not.toBeNull();
    expect(result.city).toBe('Ottawa');
    expect(result.state).toBe('Ontario');
    expect(result.country).toBe('Canada');
  });

  it('fails gracefully when network request fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await fetchCityStateFromZip('90210');
    expect(result).toBeNull();
  });
});
