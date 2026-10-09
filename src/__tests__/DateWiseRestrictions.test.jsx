import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RateManagement from '../pages/frontdesk/RateManagement';
import {
  getDailyChannelRestrictions,
  saveDailyChannelRestriction,
  bulkSaveDailyChannelRestrictions,
  getEffectiveRestriction
} from '../services/channelManager';

describe('Date-Wise OTA Restrictions Matrix Unit Tests', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it('saves and retrieves date-wise channel restriction for specific date and channel', () => {
    saveDailyChannelRestriction('booking_com_King Bed_2026-09-20', {
      stopSell: true,
      cta: true,
      ctd: false,
      minLos: 2,
      maxLos: 14
    });

    const rest = getEffectiveRestriction('booking_com', 'King Bed', '2026-09-20');
    expect(rest.stopSell).toBe(true);
    expect(rest.cta).toBe(true);
    expect(rest.ctd).toBe(false);
    expect(rest.minLos).toBe(2);
    expect(rest.maxLos).toBe(14);
  });

  it('correctly performs bulk save of daily channel restrictions across date range', () => {
    bulkSaveDailyChannelRestrictions({
      startDate: '2026-09-20',
      endDate: '2026-09-22',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      roomTypes: ['Deluxe King'],
      channelKeys: ['expedia'],
      stopSell: false,
      cta: true,
      ctd: true,
      minLos: 3,
      maxLos: 30
    });

    const day1 = getEffectiveRestriction('expedia', 'Deluxe King', '2026-09-20');
    const day2 = getEffectiveRestriction('expedia', 'Deluxe King', '2026-09-21');

    expect(day1.cta).toBe(true);
    expect(day1.ctd).toBe(true);
    expect(day1.minLos).toBe(3);

    expect(day2.cta).toBe(true);
    expect(day2.ctd).toBe(true);
    expect(day2.minLos).toBe(3);
  });

  it('renders RateManagement page with view mode toggles and OTA channel filters cleanly', () => {
    render(
      <MemoryRouter>
        <RateManagement />
      </MemoryRouter>
    );

    expect(screen.getByText(/Rate & Restrictions Management/i)).toBeTruthy();
    expect(screen.getByText(/Rates & Restrictions Matrix/i)).toBeTruthy();
    expect(screen.getByText(/Date-Wise Restrictions Only/i)).toBeTruthy();
    expect(screen.getByText(/Bulk Restrictions Matrix/i)).toBeTruthy();
  });
});
