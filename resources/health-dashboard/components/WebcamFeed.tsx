import React, { useEffect, useRef, useState } from "react";

type CamState = "loading" | "active" | "simulated";

/* ── Simulated camera view (always shows something) ────────────────────── */
const SimulatedView: React.FC = () => {
  const [scanY, setScanY] = useState(0);
  const [detections, setDetections] = useState<string[]>([]);

  const labels = [
    "SUPPLEMENT BOTTLE — Omega-3",
    "HAND DETECTED — reaching",
    "PILL CAPSULE — 2 count",
    "GLASS OF WATER",
    "SUPPLEMENT BOTTLE — Vitamin D3",
    "FOOD CONTAINER — smoothie",
    "WRIST — watch detected",
    "POSTURE — upright",
  ];

  useEffect(() => {
    // scanning line animation
    const scanId = setInterval(() => {
      setScanY((y) => (y >= 100 ? 0 : y + 0.8));
    }, 30);

    // detection labels appearing
    let idx = 0;
    const detId = setInterval(() => {
      setDetections((prev) => {
        const next = [labels[idx % labels.length], ...prev].slice(0, 3);
        idx++;
        return next;
      });
    }, 2800);

    return () => { clearInterval(scanId); clearInterval(detId); };
  }, []);

  return (
    <div className="sim-cam">
      {/* dark gradient background with grid */}
      <div className="sim-cam-bg" />
      <div className="sim-cam-grid" />

      {/* scanning line */}
      <div className="sim-cam-scan" style={{ top: `${scanY}%` }} />

      {/* detection boxes */}
      {detections.map((label, i) => (
        <div
          key={`${label}-${i}`}
          className="sim-cam-det"
          style={{
            top: `${20 + i * 28}%`,
            left: i % 2 === 0 ? "8%" : "35%",
            animationDelay: `${i * 0.15}s`,
          }}
        >
          <span className="sim-cam-det-dot" />
          <span>{label}</span>
        </div>
      ))}

      {/* center reticle */}
      <div className="sim-cam-reticle">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="16" stroke="#00ff8866" strokeWidth="1" />
          <line x1="24" y1="4" x2="24" y2="14" stroke="#00ff8844" strokeWidth="1" />
          <line x1="24" y1="34" x2="24" y2="44" stroke="#00ff8844" strokeWidth="1" />
          <line x1="4" y1="24" x2="14" y2="24" stroke="#00ff8844" strokeWidth="1" />
          <line x1="34" y1="24" x2="44" y2="24" stroke="#00ff8844" strokeWidth="1" />
        </svg>
      </div>

      {/* timestamp overlay */}
      <div className="sim-cam-ts">
        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        {" "} — AI VISION ACTIVE
      </div>
    </div>
  );
};

/* ── Main component ────────────────────────────────────────────────────── */
export const WebcamFeed: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CamState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          console.error("[WebcamFeed] navigator.mediaDevices.getUserMedia is not available");
          setState("simulated");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log("[WebcamFeed] Camera stream loaded and playing");
            setState("active");
          };
        } else {
          console.warn("[WebcamFeed] videoRef is null, cannot attach stream");
          setState("active");
        }
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error(`[WebcamFeed] Camera error — name: ${e.name}, message: ${e.message}`);
        console.error("[WebcamFeed] Full error object:", err);
        if (!cancelled) setState("simulated");
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="wcf">
      <div className="wcf-header">
        <span className="wcf-title">{"\uD83C\uDFA5"} LIVE CAMERA</span>
        <span className="wcf-badge">
          <span className="rec-dot" /> {state === "active" ? "LIVE" : "AI SIM"}
        </span>
      </div>

      <div className="wcf-viewport">
        {/* video element always in DOM so ref is available for stream attachment */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="wcf-video"
          style={{ display: state === "active" ? "block" : "none" }}
        />
        {state === "active" && <div className="wcf-scanline" />}

        {/* loading spinner */}
        {state === "loading" && (
          <div className="wcf-placeholder">
            <div className="webcam-spinner" />
            <span>Connecting camera…</span>
          </div>
        )}

        {/* simulated AI vision view */}
        {state === "simulated" && <SimulatedView />}

        {/* corner brackets (always shown) */}
        <div className="wcf-bracket wcf-bracket-tl" />
        <div className="wcf-bracket wcf-bracket-tr" />
        <div className="wcf-bracket wcf-bracket-bl" />
        <div className="wcf-bracket wcf-bracket-br" />
      </div>
    </div>
  );
};
