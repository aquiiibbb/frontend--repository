import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import CompanyAccounts from '../pages/CompanyAccounts';

describe('CompanyAccounts Component Render Test', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it('should render CompanyAccounts page without crashing or going blank', () => {
    render(<CompanyAccounts />);
    expect(screen.getByPlaceholderText(/Search company name/i)).toBeTruthy();
  });
});
