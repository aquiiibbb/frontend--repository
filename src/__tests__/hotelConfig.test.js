import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getHotelProfile,
  saveHotelProfile,
  getSequenceConfig,
  saveSequenceConfig,
  generateNextSequence,
  formatSequence,
  getUserRights,
  USER_RIGHTS_LABELS
} from '../services/hotelConfig';

describe('hotelConfig Service', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it('should return default profile when the data store is empty', () => {
    const profile = getHotelProfile();
    expect(profile).toHaveProperty('name');
    expect(profile).toHaveProperty('logoUrl');
    expect(profile.currency).toBe('US Dollar ($)');
  });

  it('should save and retrieve updated hotel profile including logoUrl', () => {
    const updated = {
      name: 'Grand Luxury Resort & Spa',
      tagline: 'Supreme Comfort',
      phone: '+1 555-0199',
      email: 'stay@grandluxury.com',
      website: 'https://grandluxury.com',
      taxId: 'TAX-998877',
      address: '100 Beach Boulevard',
      city: 'Miami',
      state: 'FL',
      zipcode: '33139',
      country: 'USA',
      logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    };

    const listener = vi.fn();
    window.addEventListener('pms_hotel_profile_updated', listener);

    saveHotelProfile(updated);

    expect(listener).toHaveBeenCalled();

    const retrieved = getHotelProfile();
    expect(retrieved.name).toBe('Grand Luxury Resort & Spa');
    expect(retrieved.logoUrl).toContain('data:image/png');
  });

  it('should handle sequence config defaults and customization', () => {
    const seq = getSequenceConfig();
    expect(seq.invoice.prefix).toBe('INV-');
    expect(seq.grc.prefix).toBe('GRC-');

    saveSequenceConfig({
      invoice: { prefix: 'BILL-', nextNumber: 50, padding: 5 },
      grc: { prefix: 'REG-', nextNumber: 10, padding: 4 }
    });

    const updatedSeq = getSequenceConfig();
    expect(updatedSeq.invoice.prefix).toBe('BILL-');
    expect(updatedSeq.invoice.nextNumber).toBe(50);
  });

  it('should format sequence numbers correctly', () => {
    const formatted = formatSequence('INV-', 5, 4, '-US');
    expect(formatted).toBe('INV-0005-US');
  });

  it('should generate sequential numbers correctly and auto-increment nextNumber', () => {
    saveSequenceConfig({
      invoice: { prefix: 'INV-', nextNumber: 1, padding: 4 },
      grc: { prefix: 'GRC-', nextNumber: 10, padding: 4 },
      cityLedger: { prefix: 'CL-', nextNumber: 1001, padding: 4 }
    });

    const inv1 = generateNextSequence('invoice', true);
    expect(inv1).toBe('INV-0001');

    const inv2 = generateNextSequence('invoice', true);
    expect(inv2).toBe('INV-0002');

    const grc1 = generateNextSequence('grc', true);
    expect(grc1).toBe('GRC-0010');

    const cl1 = generateNextSequence('cityLedger', true);
    expect(cl1).toBe('CL-1001');

    const cl2 = generateNextSequence('cityLedger', true);
    expect(cl2).toBe('CL-1002');
  });

  it('should resolve user rights correctly for staff vs admin roles', () => {
    expect(USER_RIGHTS_LABELS.length).toBe(18);

    const staffRights = getUserRights({ role: 'Front Desk Staff' });
    expect(staffRights.frontDesk).toBe(true);
    expect(staffRights.hotelSettings).toBe(false);
    expect(staffRights.manageUsers).toBe(false);

    const adminRights = getUserRights({ role: 'Manager' });
    expect(adminRights.hotelSettings).toBe(true);
    expect(adminRights.manageUsers).toBe(true);
    expect(adminRights.reportsAudit).toBe(true);
  });
});
