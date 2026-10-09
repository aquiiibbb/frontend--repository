import React, { useState, useEffect, useRef } from "react";
import { Camera, RefreshCw, Check, X, Upload, AlertCircle } from "lucide-react";
import { usePMS } from "../context/PMSContext";

export default function CameraCaptureModal({ isOpen, onClose, onCapture, guestName = "" }) {
  const { confirmAction } = usePMS();
  const [stream, setStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraStatus, setCameraStatus] = useState("initializing"); // "initializing" | "active" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedPhoto(null);
      setCameraStatus("initializing");
      setErrorMessage("");
      return;
    }

    let mediaStream = null;

    async function initCamera() {
      try {
        setCameraStatus("initializing");
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
        setCameraStatus("active");
      } catch (err) {
        console.warn("Camera access error:", err);
        setCameraStatus("error");
        setErrorMessage("Camera access failed or permission was denied. You can upload an image file of the guest photo below.");
      }
    }

    initCamera();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleSnap = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const maxDim = 640;
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    setCapturedPhoto(dataUrl);
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    if (videoRef.current && stream) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleConfirm = () => {
    if (!capturedPhoto) return;

    confirmAction({
      title: "Save Guest Profile Photo",
      message: `Are you sure you want to save this photo to ${guestName ? guestName + "'s" : "the guest's"} profile?`,
      confirmText: "Yes, Save Photo",
      variant: "primary",
      executionTitle: "Guest Photo Saved Successfully",
      executionMessage: `Profile photo for ${guestName || "guest"} has been saved.`,
      onConfirm: () => {
        if (onCapture) {
          onCapture(capturedPhoto);
        }
        onClose();
      }
    });
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const rawUrl = ev.target.result;
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxDim = 640;
            let width = img.width || 640;
            let height = img.height || 480;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            setCapturedPhoto(canvas.toDataURL("image/jpeg", 0.75));
          };
          img.onerror = () => setCapturedPhoto(rawUrl);
          img.src = rawUrl;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          maxWidth: "520px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          border: "1px solid #e2e8f0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "16px 20px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>📷</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                Capture Guest Photo
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                {guestName ? `Guest: ${guestName}` : "Live Laptop / Computer Webcam Capture"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              fontSize: "18px",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "6px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* CAMERA FEED OR SNAPPED PHOTO PREVIEW */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "320px",
              borderRadius: "12px",
              background: "#0f172a",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {capturedPhoto ? (
              <img
                src={capturedPhoto}
                alt="Captured Guest Preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: cameraStatus === "active" ? "block" : "none",
                  }}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />

                {cameraStatus === "initializing" && (
                  <div style={{ color: "#ffffff", textAlign: "center", fontSize: "13px", fontWeight: 700 }}>
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔄</div>
                    Accessing Camera...
                  </div>
                )}

                {cameraStatus === "error" && (
                  <div style={{ color: "#ffffff", padding: "20px", textAlign: "center" }}>
                    <AlertCircle size={32} color="#f87171" style={{ marginBottom: "8px" }} />
                    <p style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 12px 0", color: "#fecaca" }}>
                      {errorMessage}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: "#ffffff",
                        color: "#0f172a",
                        border: "none",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        fontSize: "12.5px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Upload size={14} /> Upload Photo File
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />

          {/* ACTION BUTTONS */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #cbd5e1",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Upload size={14} /> Upload File
            </button>

            <div style={{ display: "flex", gap: "10px" }}>
              {capturedPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={handleRetake}
                    style={{
                      background: "#ffffff",
                      color: "#475569",
                      border: "1.5px solid #cbd5e1",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <RefreshCw size={14} /> Retake
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    style={{
                      background: "#0f172a",
                      color: "#ffffff",
                      border: "1.5px solid #0f172a",
                      padding: "8px 20px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Check size={14} /> Save &amp; Attach Photo
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={cameraStatus !== "active"}
                  onClick={handleSnap}
                  style={{
                    background: cameraStatus === "active" ? "#0f172a" : "#cbd5e1",
                    color: "#ffffff",
                    border: "none",
                    padding: "9px 24px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: cameraStatus === "active" ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Camera size={15} /> Snap Photo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}