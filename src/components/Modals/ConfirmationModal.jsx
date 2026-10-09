import React from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, X, Info } from 'lucide-react';
import './ConfirmationModal.css';

export const ConfirmationModal = ({
  isOpen,
  title,
  message,
  details = [],
  confirmText = 'Yes, Confirm',
  cancelText = 'Cancel',
  variant = 'primary', // 'primary' | 'danger' | 'warning' | 'info'
  onConfirm,
  onCancel,
  // Execution feedback state
  isExecutionState = false,
  executionTitle = 'Action Completed',
  executionMessage = 'The request has been successfully executed.',
  onCloseExecution
}) => {
  if (!isOpen) return null;

  if (isExecutionState) {
    return (
      <div className="pms-confirm-backdrop" onClick={onCloseExecution}>
        <div className="pms-confirm-card pms-execution-card" onClick={(e) => e.stopPropagation()}>
          <div className="pms-execution-icon-wrapper">
            <CheckCircle2 size={44} className="pms-execution-icon" />
          </div>
          <h3 className="pms-execution-title">{executionTitle}</h3>
          <p className="pms-execution-message">{executionMessage}</p>
          <div className="pms-confirm-footer justify-center margin-top-20">
            <button type="button" className="pms-btn pms-btn-light-grey width-100" onClick={onCloseExecution}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getHeaderIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="pms-icon-danger" size={22} />;
      case 'warning':
        return <AlertTriangle className="pms-icon-warning" size={22} />;
      case 'info':
        return <Info className="pms-icon-info" size={22} />;
      default:
        return <HelpCircle className="pms-icon-primary" size={22} />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'pms-btn pms-btn-danger';
      case 'warning':
        return 'pms-btn pms-btn-warning';
      default:
        return 'pms-btn pms-btn-primary';
    }
  };

  return (
    <div className="pms-confirm-backdrop" onClick={onCancel}>
      <div className="pms-confirm-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="pms-confirm-header">
          <div className="pms-confirm-title-row">
            <div className={`pms-icon-badge badge-${variant}`}>
              {getHeaderIcon()}
            </div>
            <h3 className="pms-confirm-title">{title || 'Confirm Action'}</h3>
          </div>
          <button type="button" className="pms-close-btn" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="pms-confirm-body">
          <p className="pms-confirm-message">{message}</p>

          {/* Context Details Card */}
          {Array.isArray(details) && details.length > 0 && (
            <div className="pms-details-card">
              {details.map((item, index) => {
                if (typeof item === 'string') {
                  return (
                    <div className="pms-detail-row" key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'flex-start' }}>
                      <span style={{ color: '#0284c7', fontWeight: 'bold', lineHeight: '1.4' }}>•</span>
                      <span style={{ color: '#334155', fontSize: '13px', fontWeight: '600', textAlign: 'left', flex: 1 }}>{item}</span>
                    </div>
                  );
                }
                return (
                  <div className="pms-detail-row" key={index}>
                    {item.label && <span className="pms-detail-label">{item.label}</span>}
                    {item.value && <span className="pms-detail-value">{item.value}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pms-confirm-footer">
          <button type="button" className="pms-btn pms-btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className={getConfirmButtonClass()} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
