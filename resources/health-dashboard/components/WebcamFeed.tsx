import React, { useEffect, useRef, useState, useCallback } from "react";

type CamState = "loading" | "active" | "simulated" | "denied" | "unavailable";

interface AnalysisResult {
  status: string;
  description: string;
  action?: string;
  action_type?: string;
  title?: string;
  action_in_progress?: boolean;
  action_completed?: boolean;
  frames_buffered?: number;
}

interface SmartWatchData {
  heart_rate_bpm: number;
  blood_oxygen_spo2: number;
  sleep_score: number;
  steps_today: number;
  calories_burned: number;
  stress_level: string;
  body_temperature_f: number;
  respiratory_rate: number;
  hrv_ms: number;
  active_minutes: number;
}

/* ── Simulated camera view (fallback when camera unavailable) ────────────── */
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
    const scanId = setInterval(() => {
      setScanY((y) => (y >= 100 ? 0 : y + 0.8));
    }, 30);

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
      <div className="sim-cam-bg" />
      <div className="sim-cam-grid" />
      <div className="sim-cam-scan" style={{ top: `${scanY}%` }} />
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
      <div className="sim-cam-reticle">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="16" stroke="#00ff8866" strokeWidth="1" />
          <line x1="24" y1="4" x2="24" y2="14" stroke="#00ff8844" strokeWidth="1" />
          <line x1="24" y1="34" x2="24" y2="44" stroke="#00ff8844" strokeWidth="1" />
          <line x1="4" y1="24" x2="14" y2="24" stroke="#00ff8844" strokeWidth="1" />
          <line x1="34" y1="24" x2="44" y2="24" stroke="#00ff8844" strokeWidth="1" />
        </svg>
      </div>
      <div className="sim-cam-ts">
        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        {" "} — AI VISION ACTIVE
      </div>
    </div>
  );
};

/* ── Main WebcamFeed component ───────────────────────────────────────────── */
export const WebcamFeed: React.FC<{
  onSmartWatchUpdate?: (data: SmartWatchData) => void;
  onAnalysisUpdate?: (result: AnalysisResult) => void;
  onAnalyzeFrame?: (imageBase64: string) => Promise<any>;
  mcpConnected?: boolean;
}> = ({ onSmartWatchUpdate, onAnalysisUpdate, onAnalyzeFrame, mcpConnected = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<CamState>("loading");
  const streamRef = useRef<MediaStream | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [framesBuffered, setFramesBuffered] = useState(0);

  const handleAnalyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || !onAnalyzeFrame) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    if (video.readyState < 2) return;
    if (video.paused) {
      video.play().catch(() => {});
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    const imageBase64 = canvas.toDataURL("image/jpeg", 0.8);
    if (imageBase64.length < 1000) return;

    setIsAnalyzing(true);

    try {
      const data = await onAnalyzeFrame(imageBase64);
      if (data && typeof data === "object") {
        if (data.success !== false && (data.analysis || data.status || data.description)) {
          const analysis = data.analysis || data;
          setLastAnalysis(analysis);
          setActionInProgress(data.action_in_progress || analysis.action_in_progress || false);
          setFramesBuffered(data.frames_buffered || analysis.frames_buffered || 0);

          if (data.action_completed || analysis.action_completed) {
            onAnalysisUpdate?.(analysis);
          }
        }
      }
    } catch (err) {
      console.log("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, onAnalyzeFrame, onAnalysisUpdate]);

  // Auto-analyze every 1 second when camera is active and MCP is connected
  useEffect(() => {
    if (state !== "active" || !mcpConnected || !onAnalyzeFrame) return;

    const interval = setInterval(() => {
      handleAnalyzeFrame();
    }, 1000);

    return () => clearInterval(interval);
  }, [state, mcpConnected, onAnalyzeFrame, handleAnalyzeFrame]);

  // Start camera
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setState("simulated");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current?.play();
              setState("active");
            } catch {
              setState("simulated");
            }
          };
        } else {
          setState("active");
        }
      } catch {
        if (!cancelled) setState("simulated");
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "started": return "#00ff88";
      case "in progress": return "#ffaa00";
      case "finished": return "#00ccff";
      default: return "#666";
    }
  };

  return (
    <div className="webcam-feed">
      <div className="webcam-header">
        <span className="webcam-title">{"\uD83C\uDFA5"} LIVE CAMERA</span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {mcpConnected && (
            <span className="webcam-badge" style={{ background: "rgba(0,255,136,0.1)", color: "#00ff88" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block" }} /> MCP
            </span>
          )}
          <span className="webcam-badge">
            <span className="rec-dot" /> {state === "active" ? "LIVE" : "AI SIM"}
          </span>
        </div>
      </div>

      <div className="webcam-viewport">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="webcam-video"
          style={{ display: state === "active" ? "block" : "none" }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {state === "loading" && (
          <div className="webcam-placeholder">
            <div className="webcam-spinner" />
            <span>Connecting camera…</span>
          </div>
        )}

        {state === "simulated" && <SimulatedView />}
        {state === "active" && <div className="webcam-scanline" />}

        <div className="webcam-bracket webcam-bracket-tl" />
        <div className="webcam-bracket webcam-bracket-tr" />
        <div className="webcam-bracket webcam-bracket-bl" />
        <div className="webcam-bracket webcam-bracket-br" />

        {state === "active" && lastAnalysis && (
          <div className="webcam-analysis-overlay">
            <div
              className="webcam-status-badge"
              style={{ backgroundColor: getStatusColor(lastAnalysis.status) }}
            >
              {lastAnalysis.status.toUpperCase()}
            </div>
            <div className="webcam-description">
              {lastAnalysis.description}
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div className="webcam-analyzing">
            <div className="webcam-spinner-small" />
            <span>Analyzing...</span>
          </div>
        )}
      </div>

      <div className="webcam-controls">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <span className="webcam-action-label">AI Auto-Detect:</span>
          {actionInProgress ? (
            <span style={{
              color: "#ffaa00",
              fontSize: 11,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ffaa00",
                animation: "rec-pulse 1s infinite"
              }} />
              Action in progress ({framesBuffered} frames)
            </span>
          ) : (
            <span style={{ color: "#00ff88", fontSize: 11 }}>
              Monitoring...
            </span>
          )}
        </div>
        <button
          className="webcam-analyze-btn"
          onClick={handleAnalyzeFrame}
          disabled={isAnalyzing || state !== "active" || !mcpConnected || !onAnalyzeFrame}
        >
          {isAnalyzing ? "..." : "Scan"}
        </button>
      </div>

      {!mcpConnected && (
        <div style={{
          marginTop: 8,
          padding: "8px 12px",
          background: "rgba(255,68,102,0.1)",
          borderRadius: 8,
          fontSize: 11,
          color: "#ff4466"
        }}>
          ⚠️ MCP server not connected
        </div>
      )}
    </div>
  );
};
