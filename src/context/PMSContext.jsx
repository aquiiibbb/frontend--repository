import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getBookings, getRooms, getAuditLogs } from '../services/api';
import { getBusinessDate, getTaxRules, getRoomTypes, getSellableRooms, isSellableRoom, isVirtualRoomOrBooking } from '../services/hotelConfig';
import { calculateTaxes } from '../utils/formatters';
import { ConfirmationModal } from '../components/Modals/ConfirmationModal';

const PMSContext = createContext();

export const PMSProvider = ({ children }) => {
  const [businessDate, setBusinessDate] = useState(() => getBusinessDate());
  const [taxRules, setTaxRules] = useState(() => getTaxRules());
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [folios, setFolios] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  const loadAllState = useCallback(async () => {
    try {
      const bDate = getBusinessDate();
      const tRules = getTaxRules();
      const [rList, bList, logs] = await Promise.all([
        getRooms().catch(() => []),
        getBookings().catch(() => []),
        getAuditLogs().catch(() => []),
      ]);

      setBusinessDate(bDate);
      setTaxRules(tRules || []);
      setRooms(rList || []);
      setReservations(bList || []);
      setAuditLogs(logs || []);
    } catch (err) {
      console.error("Error loading PMSContext data", err);
    }
  }, []);

  useEffect(() => {
    loadAllState();
    window.addEventListener("pms_bookings_updated", loadAllState);
    window.addEventListener("pms_rooms_updated", loadAllState);
    window.addEventListener("pms_taxes_updated", loadAllState);
    window.addEventListener("pms_business_date_updated", loadAllState);
    window.addEventListener("storage", loadAllState);
    return () => {
      window.removeEventListener("pms_bookings_updated", loadAllState);
      window.removeEventListener("pms_rooms_updated", loadAllState);
      window.removeEventListener("pms_taxes_updated", loadAllState);
      window.removeEventListener("pms_business_date_updated", loadAllState);
      window.removeEventListener("storage", loadAllState);
    };
  }, [loadAllState]);

  const showToast = useCallback((message, type = 'success') => {
    setToastMessage({ message, type, id: Date.now() });
    setTimeout(() => setToastMessage(null), 4000);

    if (message) {
      setConfirmState({
        isOpen: true,
        title: type === 'warning' ? 'Notice' : 'Operation Successful',
        message: '',
        details: [],
        confirmText: 'Done',
        cancelText: 'Close',
        variant: type === 'warning' || type === 'error' ? 'warning' : 'primary',
        onConfirm: null,
        isExecutionState: true,
        executionTitle: type === 'warning' ? 'Notice' : 'Operation Successful',
        executionMessage: message
      });
    }
  }, []);

  // Add new reservation
  const addReservation = (newResData) => {
    const resId = `res-${Date.now().toString().slice(-4)}`;
    const resCode = `GV-${Math.floor(1000 + Math.random() * 9000)}`;

    const newReservation = {
      id: resId,
      resCode,
      status: newResData.status || 'Reserved',
      nightlyRateUSD: parseFloat(newResData.nightlyRateUSD) || 150.00,
      isTaxExempt: newResData.isTaxExempt || false,
      guestsCount: parseInt(newResData.guestsCount, 10) || 1,
      vipStatus: newResData.vipStatus || 'Standard',
      ...newResData
    };

    setReservations((prev) => [newReservation, ...prev]);

    // Create empty folio structure
    setFolios((prev) => ({
      ...prev,
      [resId]: {
        reservationId: resId,
        guestName: newReservation.guestName,
        roomNumber: newReservation.roomNumber,
        folioA: [],
        folioB: [],
        payments: []
      }
    }));

    // Update room status if assigned (exclude unconfirmed enquiry bookings)
    if (newReservation.roomId) {
      const st = String(newReservation.status || "").toLowerCase().trim();
      const isEnquiry = newReservation.isEnquiry || st === "enquiry" || st === "inquiry" || st === "enquiry (hold)" || st === "enquiry_hold" || st === "group enquiry" || st === "group_enquiry";
      if (!isEnquiry) {
        setRooms((prevRooms) =>
          prevRooms.map((room) =>
            room.id === newReservation.roomId
              ? { ...room, status: newReservation.status === 'Checked-In' ? 'Occupied' : 'Reserved' }
              : room
          )
        );
      }
    }

    showToast(`Reservation ${resCode} created for ${newReservation.guestName}`);
    return newReservation;
  };

  // Update existing reservation
  const updateReservation = (resId, updatedFields) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === resId ? { ...r, ...updatedFields } : r))
    );
    showToast(`Reservation updated successfully`);
  };

  const deleteReservation = (resId) => {
    setReservations((prev) => prev.filter((r) => r.id !== resId));
    setFolios((prev) => {
      const copy = { ...prev };
      delete copy[resId];
      return copy;
    });
  };

  // Extend or adjust stay dates (Check-In / Check-Out drag handles)
  const extendStayDates = (resId, newCheckIn, newCheckOut) => {
    const res = reservations.find((r) => r.id === resId);
    if (!res) return;

    const updatedCheckIn = newCheckIn || res.checkIn;
    const updatedCheckOut = newCheckOut || res.checkOut;

    if (updatedCheckIn > updatedCheckOut) {
      showToast('Check-In date cannot be after Check-Out date', 'warning');
      return;
    }

    setReservations((prev) =>
      prev.map((r) =>
        r.id === resId
          ? {
              ...r,
              checkIn: updatedCheckIn,
              checkOut: updatedCheckOut
            }
          : r
      )
    );

    showToast(`Updated dates for ${res.guestName}: ${updatedCheckIn} to ${updatedCheckOut}`);
  };

  // Room move (mid-stay room change)
  const moveRoom = (resId, newRoomId, newRoomNumber, newRateUSD) => {
    const reservation = reservations.find((r) => r.id === resId);
    if (!reservation) return;

    const oldRoomId = reservation.roomId;

    setReservations((prev) =>
      prev.map((r) =>
        r.id === resId
          ? {
              ...r,
              roomId: newRoomId,
              roomNumber: newRoomNumber,
              nightlyRateUSD: newRateUSD ?? r.nightlyRateUSD
            }
          : r
      )
    );

    setRooms((prevRooms) =>
      prevRooms.map((room) => {
        if (room.id === oldRoomId) {
          return { ...room, status: 'Vacant', housekeeping: 'Dirty' };
        }
        if (room.id === newRoomId) {
          return { ...room, status: 'Occupied', housekeeping: 'Clean' };
        }
        return room;
      })
    );

    if (newRateUSD && newRateUSD !== reservation.nightlyRateUSD) {
      addFolioCharge(resId, 'folioA', {
        category: 'Room Move Adjustment',
        description: `Room Move from ${reservation.roomNumber} to ${newRoomNumber} (New Rate $${newRateUSD}/nt)`,
        amountUSD: 0
      });
    }

    showToast(`Guest moved from Room ${reservation.roomNumber} to Room ${newRoomNumber}`);
  };

  // Check-In Guest
  const checkInGuest = (resId) => {
    const reservation = reservations.find((r) => r.id === resId);
    if (!reservation) return;

    setReservations((prev) =>
      prev.map((r) => (r.id === resId ? { ...r, status: 'Checked-In' } : r))
    );

    if (reservation.roomId) {
      setRooms((prevRooms) =>
        prevRooms.map((room) =>
          room.id === reservation.roomId
            ? { ...room, status: 'Occupied', housekeeping: 'Clean' }
            : room
        )
      );
    }

    showToast(`Checked in ${reservation.guestName} to Room ${reservation.roomNumber}`);
  };

  // Check-Out Guest
  const checkOutGuest = (resId) => {
    const reservation = reservations.find((r) => r.id === resId);
    if (!reservation) return;

    setReservations((prev) =>
      prev.map((r) => (r.id === resId ? { ...r, status: 'Checked-Out' } : r))
    );

    if (reservation.roomId) {
      setRooms((prevRooms) =>
        prevRooms.map((room) =>
          room.id === reservation.roomId
            ? { ...room, status: 'Vacant', housekeeping: 'Dirty' }
            : room
        )
      );
    }

    showToast(`Checked out ${reservation.guestName} from Room ${reservation.roomNumber}`);
  };

  // Folio Operations: Add Charge
  const addFolioCharge = (resId, folioType = 'folioA', charge) => {
    const chargeItem = {
      id: `chg-${Date.now()}`,
      date: businessDate,
      category: charge.category || 'Incidental',
      description: charge.description,
      amountUSD: parseFloat(charge.amountUSD) || 0
    };

    setFolios((prev) => {
      const folio = prev[resId] || {
        reservationId: resId,
        folioA: [],
        folioB: [],
        payments: []
      };

      return {
        ...prev,
        [resId]: {
          ...folio,
          [folioType]: [...(folio[folioType] || []), chargeItem]
        }
      };
    });

    showToast(`Charge of $${chargeItem.amountUSD.toFixed(2)} added to ${folioType.toUpperCase()}`);
  };

  // Folio Operations: Add Payment
  const addFolioPayment = async (resId, payment) => {
    const paymentItem = {
      id: `pay-${Date.now()}`,
      date: businessDate,
      method: payment.method || payment.mode || "Cash",
      description: payment.description || payment.note || 'Payment Received',
      amountUSD: parseFloat(payment.amountUSD || payment.amount) || 0,
      amount: parseFloat(payment.amountUSD || payment.amount) || 0,
    };

    setFolios((prev) => {
      const folio = prev[resId] || {
        reservationId: resId,
        folioA: [],
        folioB: [],
        payments: []
      };

      return {
        ...prev,
        [resId]: {
          ...folio,
          payments: [...(folio.payments || []), paymentItem]
        }
      };
    });

    try {
      const { addPayment } = await import("../services/api");
      if (typeof addPayment === "function") {
        await addPayment(resId, paymentItem);
      }
    } catch (e) {
      console.error("Failed to post payment to backend API:", e);
    }

    showToast(`Payment of $${paymentItem.amountUSD.toFixed(2)} recorded`);
  };

  // Split Folio
  const moveFolioItem = (resId, itemId, fromFolioKey, toFolioKey) => {
    setFolios((prev) => {
      const folio = prev[resId];
      if (!folio) return prev;

      const itemToMove = folio[fromFolioKey]?.find((i) => i.id === itemId);
      if (!itemToMove) return prev;

      return {
        ...prev,
        [resId]: {
          ...folio,
          [fromFolioKey]: folio[fromFolioKey].filter((i) => i.id !== itemId),
          [toFolioKey]: [...folio[toFolioKey], itemToMove]
        }
      };
    });
    showToast(`Item moved to ${toFolioKey.toUpperCase()}`);
  };

  // Update Tax Rules
  const updateTaxRules = (newRules) => {
    setTaxRules(newRules);
    showToast('Tax rules updated successfully');
  };

  // Room Status Change & Room Blocking with Start & End Dates
  const updateRoomStatus = (roomId, newStatus, newHousekeeping) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              ...(newStatus && { status: newStatus }),
              ...(newHousekeeping && { housekeeping: newHousekeeping })
            }
          : r
      )
    );
    showToast(`Room status updated`);
  };

  // Block Room for Date Range
  const blockRoom = (roomId, blockReason = 'Maintenance / Out of Order', startDate, endDate) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    const fromDate = startDate || businessDate;
    const toDate = endDate || '2026-07-31';

    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, status: 'Out-of-Order', housekeeping: 'Maintenance', blockReason }
          : r
      )
    );

    const blockResId = `block-${Date.now().toString().slice(-4)}`;
    const newBlock = {
      id: blockResId,
      resCode: `BLOCK-${room.number}`,
      guestName: `[BLOCKED] ${blockReason}`,
      guestEmail: '',
      guestPhone: '',
      roomId: room.id,
      roomNumber: room.number,
      roomType: room.type,
      checkIn: fromDate,
      checkOut: toDate,
      status: 'Blocked',
      guestsCount: 0,
      nightlyRateUSD: 0,
      isTaxExempt: true,
      vipStatus: 'Blocked',
      notes: `${blockReason} (${fromDate} to ${toDate})`
    };

    setReservations((prev) => [newBlock, ...prev]);
    showToast(`Room ${room.number} blocked from ${fromDate} to ${toDate}`);
  };

  // Release Room Block
  const releaseRoomBlock = (roomId) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, status: 'Vacant', housekeeping: 'Clean', blockReason: null }
          : r
      )
    );

    setReservations((prev) =>
      prev.filter((res) => !(res.roomId === roomId && res.status === 'Blocked'))
    );

    showToast(`Room ${room.number} block released`);
  };

  // Automated Night Audit Execution
  const runNightAudit = (auditorName = 'Front Desk Manager') => {
    const roomTypes = getRoomTypes();
    const sellableRooms = getSellableRooms(rooms, roomTypes);
    const checkedInRes = reservations.filter((r) => r.status === 'Checked-In');

    let totalPostedRoomRev = 0;
    let totalPostedTaxes = 0;
    let postedCount = 0;

    checkedInRes.forEach((res) => {
      // Exclude virtual / staff rooms from commercial tariff posting
      const rTarget = res.roomNumber || res.roomNo || res.roomId || res.room;
      if (!isSellableRoom(rTarget, rooms, roomTypes) || isVirtualRoomOrBooking(res, rooms, roomTypes) || isVirtualRoomOrBooking(rTarget, rooms, roomTypes)) {
        return;
      }

      const roomCharge = res.nightlyRateUSD || 0;
      const { totalTax, breakdown } = calculateTaxes(roomCharge, taxRules, res.isTaxExempt);

      const roomChargeItem = {
        id: `na-chg-room-${Date.now()}-${res.id}`,
        date: businessDate,
        category: 'Room Rate',
        description: `Night Audit Room Posting - Room ${res.roomNumber}`,
        amountUSD: roomCharge
      };

      const taxItems = breakdown.map((t) => ({
        id: `na-chg-tax-${Date.now()}-${res.id}-${t.id}`,
        date: businessDate,
        category: 'Tax',
        description: `${t.name} (${t.type === 'percent' ? t.rate + '%' : '$' + t.rate})`,
        amountUSD: t.amount
      }));

      setFolios((prev) => {
        const folio = prev[res.id] || {
          reservationId: res.id,
          guestName: res.guestName,
          roomNumber: res.roomNumber,
          folioA: [],
          folioB: [],
          payments: []
        };
        return {
          ...prev,
          [res.id]: {
            ...folio,
            folioA: [...folio.folioA, roomChargeItem, ...taxItems]
          }
        };
      });

      totalPostedRoomRev += roomCharge;
      totalPostedTaxes += totalTax;
      postedCount++;
    });

    const sellableOccupiedCount = checkedInRes.filter((res) =>
      isSellableRoom(res.roomNumber || res.roomNo || res.roomId, rooms, roomTypes)
    ).length;
    const totalSellableRooms = sellableRooms.length;

    const occupancyPercent = totalSellableRooms > 0 ? parseFloat(((sellableOccupiedCount / totalSellableRooms) * 100).toFixed(1)) : 0;
    const adr = sellableOccupiedCount > 0 ? parseFloat((totalPostedRoomRev / sellableOccupiedCount).toFixed(2)) : 0;
    const revpar = totalSellableRooms > 0 ? parseFloat((totalPostedRoomRev / totalSellableRooms).toFixed(2)) : 0;

    const currentDate = new Date(businessDate);
    currentDate.setDate(currentDate.getDate() + 1);
    const nextBusinessDate = currentDate.toISOString().split('T')[0];

    const newAuditLog = {
      id: `na-${businessDate}`,
      auditDate: businessDate,
      completedAt: new Date().toLocaleString(),
      auditor: auditorName,
      totalRoomsOccupied: sellableOccupiedCount,
      occupancyPercent,
      totalRoomRevenueUSD: totalPostedRoomRev,
      totalTaxCollectedUSD: totalPostedTaxes,
      totalIncidentalRevenueUSD: 145.00,
      grandTotalRevenueUSD: totalPostedRoomRev + totalPostedTaxes + 145.00,
      adrUSD: adr,
      revparUSD: revpar,
      postedFolioCount: postedCount,
      status: 'COMPLETED & LOCKED'
    };

    setAuditLogs((prev) => [newAuditLog, ...prev]);
    setBusinessDate(nextBusinessDate);

    showToast(`Night Audit for ${businessDate} completed! Date rolled to ${nextBusinessDate}`);
    return newAuditLog;
  };

  // Execute Cancellation or No-Show Policy (Option 1: 1-Night, Option 2: Hotel Policy, Option 3: Void All Charges)
  const executeCancellationPolicy = (resId, { selectedOption = 'option1', actionType = 'cancel', penaltyAmount: customPenalty } = {}) => {
    const reservation = reservations.find((r) => r.id === resId || r.resCode === resId);
    if (!reservation) return;

    const isNoShow = actionType === 'noshow';
    const isOption3 = selectedOption === 'option3' || selectedOption === 'void_all_charges';
    const isOption2 = selectedOption === 'option2' || selectedOption === 'charge_per_policy';
    const nightlyRate = Number(reservation.nightlyRateUSD || reservation.ratePerNight || reservation.rate || 59.00);

    // Save snapshot of original nightly rates map if not already backed up
    const originalMap = reservation.originalNightlyRatesMap || { ...(reservation.nightlyRatesMap || {}) };
    const originalSubtotal = reservation.originalSubtotal || reservation.subtotal || (nightlyRate * (reservation.nights || 3));

    // Zero out all nightly stay rates for cancellation
    const updatedMap = {};
    if (reservation.checkIn && reservation.checkOut) {
      const start = new Date(reservation.checkIn + "T00:00:00");
      const end = new Date(reservation.checkOut + "T00:00:00");
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().slice(0, 10);
        updatedMap[dStr] = 0;
      }
    }

    let feeAmount = 0;
    let toastMessage = "";

    if (isOption3) {
      feeAmount = 0;
      toastMessage = isNoShow
        ? `No-Show Policy Executed: Waived penalty & voided all charges ($0.00).`
        : `Cancellation Policy Executed: Waived penalty & voided all charges ($0.00).`;
    } else if (isOption2) {
      if (customPenalty !== undefined) {
        feeAmount = Number(customPenalty);
      } else {
        const cancelPolicies = getCancellationPolicies?.() || [];
        const activePolicy = cancelPolicies.find((p) => p.isDefault) || cancelPolicies[0] || { noticeHours: 24, refundType: 'one_night', name: '24 Hours Policy' };
        const noticeHours = Number(activePolicy.noticeHours || 24);
        const stdCheckInTime = hotelProfile?.checkInTime || '15:00';
        const checkInStr = reservation.checkIn || getBusinessDate();
        const checkInDate = new Date(`${checkInStr}T${stdCheckInTime}:00`);
        const now = new Date();
        const diffHours = (checkInDate - now) / (1000 * 60 * 60);

        const isFree = noticeHours > 0 ? diffHours >= noticeHours : false;

        if (isFree || activePolicy.refundType === 'free_cancellation') {
          feeAmount = 0;
        } else if (activePolicy.refundType === 'no_refund') {
          feeAmount = Number(reservation.subtotal || reservation.totalAmount || originalSubtotal);
        } else if (activePolicy.refundType === 'half_refund') {
          feeAmount = Number(reservation.subtotal || reservation.totalAmount || originalSubtotal) * 0.5;
        } else {
          feeAmount = nightlyRate;
        }
      }

      toastMessage = feeAmount > 0
        ? `Cancellation Policy Executed: Charged Policy Fee ($${feeAmount.toFixed(2)}) as Cancellation Revenue.`
        : `Cancellation Policy Executed: 100% Free Cancellation (Cancelled prior to policy cutoff deadline).`;
    } else {
      feeAmount = nightlyRate;
      toastMessage = isNoShow
        ? `No-Show Policy Executed: Charged 1-Night Tariff ($${feeAmount.toFixed(2)}) as No-Show Revenue.`
        : `Cancellation Policy Executed: Charged 1-Night Tariff ($${feeAmount.toFixed(2)}) as Cancellation Revenue.`;
    }

    const newStatus = isNoShow ? 'No-Show' : 'Cancelled';
    const prevStatus = reservation.status || 'Reserved';

    const updatedReservation = {
      ...reservation,
      status: newStatus,
      previousStatus: prevStatus,
      cancellationFee: isNoShow ? 0 : feeAmount,
      noShowFee: isNoShow ? feeAmount : 0,
      subtotal: feeAmount,
      totalAmount: feeAmount,
      originalNightlyRatesMap: originalMap,
      originalSubtotal: originalSubtotal,
      nightlyRatesMap: updatedMap
    };

    setReservations((prev) =>
      prev.map((r) => (r.id === resId || r.resCode === resId ? updatedReservation : r))
    );

    // Release room back to available inventory
    if (reservation.roomId || reservation.roomNumber) {
      setRooms((prevRooms) =>
        prevRooms.map((room) =>
          room.id === reservation.roomId || String(room.number) === String(reservation.roomNumber)
            ? { ...room, status: 'Vacant', housekeeping: 'Clean' }
            : room
        )
      );
    }

    showToast(toastMessage);
  };

  // Reverse Cancellation or No-Show Policy (Undo Action)
  const reverseCancellationPolicy = (resId) => {
    const reservation = reservations.find((r) => r.id === resId || r.resCode === resId);
    if (!reservation) return;

    const restoredMap = reservation.originalNightlyRatesMap || reservation.nightlyRatesMap || {};
    const restoredSubtotal = reservation.originalSubtotal || reservation.subtotal || 177.00;
    const restoredStatus = reservation.previousStatus || 'Reserved';

    const updatedReservation = {
      ...reservation,
      status: restoredStatus,
      cancellationFee: 0,
      noShowFee: 0,
      subtotal: restoredSubtotal,
      totalAmount: restoredSubtotal,
      nightlyRatesMap: restoredMap
    };

    setReservations((prev) =>
      prev.map((r) => (r.id === resId || r.resCode === resId ? updatedReservation : r))
    );

    // Re-block room in inventory
    if (reservation.roomId || reservation.roomNumber) {
      setRooms((prevRooms) =>
        prevRooms.map((room) =>
          room.id === reservation.roomId || String(room.number) === String(reservation.roomNumber)
            ? { ...room, status: restoredStatus === 'Checked-In' ? 'Occupied' : 'Reserved' }
            : room
        )
      );
    }

    showToast(`Reservation Reopened & Cancellation Policy Reversed Successfully for ${reservation.guestName || 'Guest'}.`);
  };

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    details: [],
    confirmText: 'Yes, Confirm',
    cancelText: 'Cancel',
    variant: 'primary',
    onConfirm: null,
    isExecutionState: false,
    executionTitle: '',
    executionMessage: ''
  });

  const confirmAction = useCallback(({
    title,
    message,
    details = [],
    confirmText = 'Yes, Confirm',
    cancelText = 'Cancel',
    variant = 'primary',
    onConfirm,
    executionTitle,
    executionMessage
  }) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      details,
      confirmText,
      cancelText,
      variant,
      onConfirm: () => {
        if (typeof onConfirm === 'function') {
          onConfirm();
        }
        if (executionTitle) {
          setConfirmState((prev) => ({
            ...prev,
            isExecutionState: true,
            executionTitle: executionTitle || 'Action Completed',
            executionMessage: executionMessage || 'The request has been successfully executed.'
          }));
        } else {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
      isExecutionState: false,
      executionTitle: executionTitle || '',
      executionMessage: executionMessage || ''
    });
  }, []);

  const closeConfirmModal = () => {
    setConfirmState((prev) => ({ ...prev, isOpen: false, isExecutionState: false }));
  };

  return (
    <PMSContext.Provider
      value={{
        businessDate,
        taxRules,
        rooms,
        reservations,
        folios,
        auditLogs,
        toastMessage,
        confirmAction,
        addReservation,
        updateReservation,
        deleteReservation,
        extendStayDates,
        moveRoom,
        checkInGuest,
        checkOutGuest,
        addFolioCharge,
        addFolioPayment,
        moveFolioItem,
        updateTaxRules,
        updateRoomStatus,
        blockRoom,
        releaseRoomBlock,
        runNightAudit,
        executeCancellationPolicy,
        reverseCancellationPolicy,
        showToast
      }}
    >
      {children}
      <ConfirmationModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        details={confirmState.details}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirmModal}
        isExecutionState={confirmState.isExecutionState}
        executionTitle={confirmState.executionTitle}
        executionMessage={confirmState.executionMessage}
        onCloseExecution={closeConfirmModal}
      />
    </PMSContext.Provider>
  );
};

export const usePMS = () => {
  const context = useContext(PMSContext);
  if (!context) {
    return {
      rooms: [],
      reservations: [],
      folios: {},
      auditLogs: [],
      taxRules: [],
      businessDate: new Date().toISOString().slice(0, 10),
      showToast: () => {},
      executeCancellationPolicy: () => {},
      reverseCancellationPolicy: () => {},
      confirmAction: (opts) => {
        if (opts && typeof opts.onConfirm === 'function') {
          if (window.confirm(`${opts.title || 'Confirm'}: ${opts.message || 'Are you sure?'}`)) {
            opts.onConfirm();
          }
        }
      }
    };
  }
  return context;
};
