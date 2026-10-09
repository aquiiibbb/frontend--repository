import React from 'react';
import { FolioManager } from './Folio/FolioManager';
import './folioModal.css';

export default function FolioModal(props) {
  const { isOpen, onClose, booking } = props;
  if (!isOpen) return null;

  return (
    <div className="fm-overlay" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="fm-card" onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', width: '100%', maxWidth: '1120px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
        <button
          type="button"
          className="close-btn"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '20px',
            background: '#e2e8f0',
            border: 'none',
            color: '#334155',
            fontSize: '18px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            zIndex: 10
          }}
        >
          ✕
        </button>
        <FolioManager {...props} selectedResId={booking?.id || booking?.resCode || booking?._id || booking?.bookingId} booking={booking} />
      </div>
    </div>
  );
}
