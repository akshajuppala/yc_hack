import React, { useEffect, useRef, useState } from "react";

type CamState = "loading" | "active" | "denied" | "unavailable";

export const WebcamFeed: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CamState>("loading");
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setState("unavailable");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setState("active");
      } catch (err: any) {
        if (!cancelled) {
          setState(err?.name === "NotAllowedError" ? "denied" : "unavailable");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="webcam-feed">
      <div className="webcam-header">
        <span className="webcam-title">{"\uD83C\uDFA5"} LIVE CAMERA</span>
        {state === "active" && (
          <span className="webcam-badge">
            <span className="rec-dot" /> LIVE
          </span>
        )}
      </div>

      <div className="webcam-viewport">
        {state === "active" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="webcam-video"
          />
        )}

        {state === "loading" && (
          <div className="webcam-placeholder">
            <div className="webcam-spinner" />
            <span>Requesting camera…</span>
          </div>
        )}

        {state === "denied" && (
          <div className="webcam-placeholder">
            <span className="webcam-icon-large">{"\uD83D\uDEAB"}</span>
            <span>Camera access denied</span>
            <span className="webcam-hint">Allow camera in browser settings</span>
          </div>
        )}

        {state === "unavailable" && (
          <div className="webcam-placeholder">
            <span className="webcam-icon-large">{"\uD83D\uDCF7"}</span>
            <span>No camera available</span>
            <span className="webcam-hint">Connect a webcam or smart glasses</span>
          </div>
        )}

        {/* Scan-line overlay for that futuristic look */}
        {state === "active" && <div className="webcam-scanline" />}

        {/* Corner brackets */}
        <div className="webcam-bracket webcam-bracket-tl" />
        <div className="webcam-bracket webcam-bracket-tr" />
        <div className="webcam-bracket webcam-bracket-bl" />
        <div className="webcam-bracket webcam-bracket-br" />
      </div>
    </div>
  );
};
