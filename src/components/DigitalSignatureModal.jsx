import React, { useRef, useState, useEffect } from "react";
import { usePMS } from "../context/PMSContext";
import "./DigitalSignatureModal.css";

export default function DigitalSignatureModal({
  isOpen,
  onClose,
  onSaveSignature,
  initialSignature = ""
}) {
  const { confirmAction } = usePMS();
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Initialize canvas context & draw existing signature if present
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      // Set canvas drawing properties
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (initialSignature) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = initialSignature;
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHasSigned(true);
        };
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSigned(false);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, initialSignature]);

  if (!isOpen) return null;

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (e.cancelable) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoordinates(e);

    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasSigned(true);
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    if (e.cancelable) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSigned) return;
    const signatureDataUrl = canvas.toDataURL("image/png");

    confirmAction({
      title: "Save Digital Signature",
      message: "Are you sure you want to save this digital signature to the guest registration record?",
      confirmText: "Yes, Save Signature",
      variant: "primary",
      executionTitle: "Digital Signature Saved Successfully",
      executionMessage: "The guest's digital signature has been recorded and attached to the registration card.",
      onConfirm: () => {
        if (onSaveSignature) {
          onSaveSignature(signatureDataUrl);
        }
        if (onClose) {
          onClose();
        }
      }
    });
  };

  return (
    <div className="sig-modal-overlay">
      <div className="sig-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="sig-modal-header">
          <h3 className="sig-modal-title">
            ✍️ Capture Guest Digital Signature
          </h3>
          <button type="button" className="sig-modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="sig-modal-body">
          <div className="sig-instruction">
            Sign inside the box using your mouse, trackpad, touchscreen, or tablet.
          </div>

          <div className="sig-canvas-wrapper">
            {!hasSigned && (
              <div className="sig-canvas-placeholder">
                Sign Here...
              </div>
            )}
            <canvas
              ref={canvasRef}
              width={500}
              height={190}
              className="sig-canvas"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
        </div>

        <div className="sig-modal-footer">
          <button type="button" className="sig-btn-clear" onClick={handleClear}>
            🧹 Clear
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="sig-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="sig-btn-save"
              onClick={handleSave}
              disabled={!hasSigned}
            >
              ✓ Save Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
