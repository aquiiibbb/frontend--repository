# 🏨 Hotel PMS - Master Business Logic & Troubleshooting Guide

This guide serves as the authoritative technical reference and troubleshooting manual for the **Frontend PMS** application. Use this document whenever you need to verify business rules, locate code files, or debug calculation discrepancies.

---

## 📌 Table of Contents
1. [Core Business Logics & Accounting Rules](#1-core-business-logics--accounting-rules)
2. [File Map & Code Reference](#2-file-map--code-reference)
3. [Troubleshooting Guide & Diagnostic Hints](#3-troubleshooting-guide--diagnostic-hints)
4. [Testing & Verification Protocol](#4-testing--verification-protocol)

---

## 1. Core Business Logics & Accounting Rules

### Rule 1: Total Property Inventory Calculation
* **Logic**: Property inventory counts **only physical sellable rooms**. Virtual room categories are completely excluded from the total inventory denominator.
* **Example**: 3 Standard Rooms + 4 Deluxe Rooms + 5 Virtual Rooms = **7 Total Inventory** (never 12).
* **Formula**:
  $$\text{Total Available Rooms} = \text{Count of Physical Sellable Rooms}$$

---

### Rule 2: Virtual Room Exclusion
* **Logic**: Any booking, stay, or check-in assigned to a Virtual Room (or virtual room type) is **100% excluded** from operational and financial metrics.
* **Excluded Metrics**: Rooms Occupied, Occupancy %, ADR, RevPAR, Room Tariff Revenue, Taxes, Extras.

---

### Rule 3: Booking Status Eligibility
* **Logic**: Unconfirmed enquiries and hold bookings are **excluded** from room occupancy and revenue metrics.
* **Eligible Statuses**: Only bookings with status `Confirmed`, `Checked-In`, or `Checked-Out` contribute to active statistics.
* **Ineligible Statuses**: `Enquiry`, `Inquiry`, `Hold`, `Cancelled`, `No-Show`, `Deleted`.

---

### Rule 4: Revenue & Accounting Definitions
* **Gross Revenue** = **Pure Room Tariff Revenue ONLY** (excludes taxes, extra charges, F&B, POS sales).
* **Net Revenue** = **Pure Room Tariff + Taxes + Folio Extras + POS/Misc Sales − Operational Expenses**.

$$\text{Gross Revenue} = \text{Room Tariff}$$

$$\text{Net Revenue} = \text{Room Tariff} + \text{Taxes} + \text{Extras} + \text{POS Sales} - \text{Expenses}$$

---

### Rule 5: Night-by-Night Earned Revenue Recognition (Accrual Basis)
* **Logic**: Room tariff and room nights are recognized **day-by-day across the stay duration**.
* **Example**: A 3-night stay from Oct 1 to Oct 4 for $300 ($100/night):
  * **Oct 1**: 1 Room Occupied, $100.00 Room Revenue
  * **Oct 2**: 1 Room Occupied, $100.00 Room Revenue
  * **Oct 3**: 1 Room Occupied, $100.00 Room Revenue
  * **Oct 4 (Departure)**: 0 Rooms Occupied, $0.00 Room Revenue

---

### Rule 6: PMS Working Business Date & Night Audit Rollover
* **Logic**: Operations and reports run on the active **PMS Business Date**, not the system clock time.
* **Midnight (12:00 AM) Rule**: Passing midnight does **NOT** advance the business date. Transactions between 12:00 AM and cutoff (e.g., 4:00 AM or until audit execution) belong to the active Business Date.
* **Date Rollover Trigger**: The PMS Business Date advances to the next date **ONLY when Night Audit is executed**.

---

### Rule 7: Housekeeping Auto-Dirty Status Transitions
* **Check-Out Trigger**: Checking out a room automatically changes its housekeeping status from `Clean` (or `Inspected`) to `Dirty`.
* **Night Audit Trigger**: Executing Night Audit automatically transitions occupied stayover rooms and departed rooms with `Clean` status to `Dirty`.

---

## 2. File Map & Code Reference

| Feature / Logic | Source File Path | Key Functions / State |
| :--- | :--- | :--- |
| **Analytics Engine & YoY Matrix** | `src/services/reportAnalyticsService.js` | `getExecutiveYoYReportData()`, `computeDateRangeBucket()` |
| **Forecast Report** | `src/services/reportAnalyticsService.js` | `getOccupancyForecastData()` |
| **Channel & Payment Audits** | `src/services/reportAnalyticsService.js` | `getChannelProductionData()`, `getPaymentAuditData()` |
| **Master Financial Report** | `src/pages/frontdesk/masterreport.jsx` | `LegacyMasterReportView()`, `aggregates` |
| **Room & Tax Configurations** | `src/services/hotelConfig.js` | `getSellableRooms()`, `isSellableRoom()`, `getTaxRules()` |
| **Night Audit & Business Date** | `src/pages/frontdesk/NightAudit.jsx` | `advanceBusinessDate()`, `getWorkingBusinessDate()` |
| **Housekeeping State Transitions** | `src/services/api.store.js` | `updateBooking()`, `updateRoomHousekeeping()` |
| **Client-Side Database Storage** | `src/services/pmsDb.js` | `db.bookings`, `db.rooms`, `persist()`, `resetAllData()` |

---

## 3. Troubleshooting Guide & Diagnostic Hints

### 🔴 Symptom 1: Occupancy % Exceeds 100% (e.g. 125%)
* **Possible Cause**: A booking assigned to a Virtual Room is being counted in `Rooms Occupied` while the room was excluded from `Available Rooms`.
* **Fix Location**: `src/services/reportAnalyticsService.js` in `computeDateRangeBucket()`.
* **Fix Hint**: Ensure `isSellableRoom(b.room)` check is performed inside the date iteration loop.

---

### 🔴 Symptom 2: Report Shows $0.00 / Empty Table Despite Bookings
* **Possible Cause A**: Timezone shift when converting dates to ISO strings (`.toISOString().slice(0, 10)` shifting local midnight back by 1 day).
* **Fix Location**: Use local calendar date formatting `formatLocalDateISO(d)` instead of `.toISOString()`.
* **Possible Cause B**: `getAllBookings()` failing to read `hotelpms_mock_db`.
* **Fix Location**: Check `getAllBookings()` in `reportAnalyticsService.js` to ensure fallback reads `hotelpms_mock_db` (`parsed.bookings`).

---

### 🔴 Symptom 3: Gross Revenue Included Taxes or Extras
* **Possible Cause**: `grossRevenue` formula added `extraRevenue` or `dailySalesRevenue`.
* **Fix Location**: `reportAnalyticsService.js` line 326 (`const grossRevenue = roomRevenue`).

---

### 🔴 Symptom 4: Midnight Clock Change Roll Over Date Prematurely
* **Possible Cause**: Code reading `new Date()` system clock instead of `getWorkingBusinessDate()`.
* **Fix Location**: Check `hotelConfig.js` -> `getBusinessDate()`.

---

## 4. Testing & Verification Protocol

Whenever you modify any report, room config, or booking logic, run the full Vitest automated regression test suite:

```bash
# Run all unit tests
node node_modules/vitest/vitest.mjs run
```

* **Expected Output**: `30 passed (30 test files), 156 passed (156 tests)`
* Tests cover: Category availability, overbooking alerts, tax exemptions, deposit vaults, revenue definitions (Scenario 19), and housekeeping transitions (Scenario 20).
