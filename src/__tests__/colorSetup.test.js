import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStatusColors,
  saveStatusColors,
  DEFAULT_STATUS_COLORS,
  getHkColors,
  saveHkColors,
  DEFAULT_HK_COLORS,
  getActivityColors,
  saveActivityColors,
  DEFAULT_ACTIVITY_COLORS,
} from '../services/hotelConfig';

describe('Color Setup persistent storage & dispatchers', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it('should return default factory colors when localStorage is empty', () => {
    const hk = getHkColors();
    expect(hk.clean.text).toBe('#16a34a');
    expect(hk.dirty.text).toBe('#dc2626');
    expect(Object.keys(hk).length).toBe(7);

    const act = getActivityColors();
    expect(act.arrivals.bg).toBe('#ffffff');
    expect(Object.keys(act).length).toBe(8);
  });

  it('should save and retrieve custom Housekeeping colors and dispatch pms_hk_colors_updated event', () => {
    const listener = vi.fn();
    window.addEventListener('pms_hk_colors_updated', listener);

    const customHk = {
      ...DEFAULT_HK_COLORS,
      clean: { bg: '#e6fffa', text: '#047857', border: '#a7f3d0' },
      dirty: { bg: '#fff5f5', text: '#b91c1c', border: '#fca5a5' },
    };

    saveHkColors(customHk);

    expect(listener).toHaveBeenCalled();
    const loaded = getHkColors();
    expect(loaded.clean.bg).toBe('#e6fffa');
    expect(loaded.clean.text).toBe('#047857');
    expect(loaded.clean.border).toBe('#a7f3d0');
  });

  it('should save and retrieve custom Activity colors and dispatch pms_activity_colors_updated event', () => {
    const listener = vi.fn();
    window.addEventListener('pms_activity_colors_updated', listener);

    const customAct = {
      ...DEFAULT_ACTIVITY_COLORS,
      arrivals: { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd' },
      departures: { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
    };

    saveActivityColors(customAct);

    expect(listener).toHaveBeenCalled();
    const loaded = getActivityColors();
    expect(loaded.arrivals.bg).toBe('#eff6ff');
    expect(loaded.arrivals.text).toBe('#1d4ed8');
    expect(loaded.arrivals.border).toBe('#93c5fd');
  });
});
