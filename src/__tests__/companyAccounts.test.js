import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCompanyAccounts,
  addCompanyAccount,
  deleteCompanyAccount,
  purgeAllCompanyAccounts,
  hasCompanyTransactions,
  parseBalanceNumber,
} from '../services/companyAccounts';
import { saveSequenceConfig, getSequenceConfig } from '../services/hotelConfig';

describe('companyAccounts Service & Protection Rules', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it('should accurately parse raw balance values into numbers', () => {
    expect(parseBalanceNumber(276.06)).toBe(276.06);
    expect(parseBalanceNumber("$276.06")).toBe(276.06);
    expect(parseBalanceNumber("$0.00")).toBe(0);
    expect(parseBalanceNumber("0")).toBe(0);
    expect(parseBalanceNumber(null)).toBe(0);
    expect(parseBalanceNumber(undefined)).toBe(0);
  });

  it('should auto-generate sequential City Ledger account numbers (e.g. CL-1001, CL-1002)', () => {
    saveSequenceConfig({
      cityLedger: { prefix: "CL-", suffix: "", nextNumber: 1001, padding: 4 }
    });

    const acc1 = addCompanyAccount({ name: "Google LLC" });
    expect(acc1.accountNo).toBe("CL-1001");

    const acc2 = addCompanyAccount({ name: "Microsoft Corp" });
    expect(acc2.accountNo).toBe("CL-1002");

    const seq = getSequenceConfig();
    expect(seq.cityLedger.nextNumber).toBe(1003);
  });

  it('should prevent deleting corporate accounts with active balance > 0', () => {
    const acc = addCompanyAccount({ name: "Apple Inc", balance: 500 });
    expect(() => deleteCompanyAccount(acc.id)).toThrow(/Cannot delete Corporate Account/);
  });

  it('should prevent purging corporate accounts when active balance or transactions exist', () => {
    addCompanyAccount({ name: "Amazon Inc", balance: 250 });
    expect(() => purgeAllCompanyAccounts()).toThrow(/active transactions or outstanding balance/);
  });

  it('should allow deleting corporate accounts with 0 balance and no transactions', () => {
    const acc = addCompanyAccount({ name: "Clean Account", balance: 0 });
    const remaining = deleteCompanyAccount(acc.id);
    expect(remaining.find(a => a.id === acc.id)).toBeUndefined();
  });

  it('should compute balance correctly when booking is linked with City Ledger payment', () => {
    const acc = addCompanyAccount({ name: "Tata Group" });
    const mockBooking = {
      id: "bk_1001",
      companyAccountId: acc.id,
      companyName: "Tata Group",
      paymentMethod: "House Account",
      totalAmount: 350.00,
      balanceDue: 0,
      advanceAmount: 350.00
    };
    dataStore.setItem("hotelpms_bookings_v3", JSON.stringify([mockBooking]));

    const accounts = getCompanyAccounts();
    const tataAcc = accounts.find(a => a.id === acc.id);
    expect(tataAcc.balance).toBe(350.00);
    expect(tataAcc.linkedBookingCount).toBe(1);
    expect(hasCompanyTransactions(tataAcc)).toBe(true);
  });
});
