import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import OtaBadge, { getOtaChannelInfo } from '../components/OtaBadge';

describe('OtaBadge Component & Helper Tests', () => {
  it('correctly maps OTA channel names to branding info', () => {
    expect(getOtaChannelInfo('Booking.com').name).toBe('Booking.com');
    expect(getOtaChannelInfo('Expedia Partner').name).toBe('Expedia');
    expect(getOtaChannelInfo('Airbnb Host').name).toBe('Airbnb');
    expect(getOtaChannelInfo('Agoda YCS').name).toBe('Agoda');
    expect(getOtaChannelInfo('MakeMyTrip').name).toBe('MakeMyTrip');
    expect(getOtaChannelInfo('Walk-In').name).toBe('Walk-In');
    expect(getOtaChannelInfo('Direct Web').name).toBe('Direct Web');
  });

  it('renders OtaBadge chip without crashing in xs size', () => {
    render(<OtaBadge source="Booking.com" size="xs" showText={true} otaBookingId="BK1092" />);
    expect(screen.getByText('Booking.com')).toBeTruthy();
  });

  it('renders OtaBadge card with OTA ID in md size', () => {
    render(<OtaBadge source="Expedia" size="md" showText={true} otaBookingId="EXP9988" />);
    expect(screen.getByText('Expedia')).toBeTruthy();
    expect(screen.getByText('#EXP9988')).toBeTruthy();
  });
});
