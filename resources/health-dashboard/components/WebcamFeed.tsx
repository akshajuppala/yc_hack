import React, { useEffect, useRef, useState, useCallback } from "react";

type CamState = "loading" | "active" | "simulated" | "denied" | "unavailable";

interface AnalysisResult {
  status: string;
  description: string;
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

const BACKEND_URL = "http://localhost:8000";

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
}> = ({ onSmartWatchUpdate, onAnalysisUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<CamState>("loading");
  const streamRef = useRef<MediaStream | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [watchData, setWatchData] = useState<SmartWatchData | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [framesBuffered, setFramesBuffered] = useState(0);
  const [backendStatus, setBackendStatus] = useState<"connected" | "disconnected" | "checking">("checking");

  // Fetch smart watch data periodically via direct HTTP
  useEffect(() => {
    const fetchWatchData = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/smart-watch-data`);
        if (res.ok) {
          const data = await res.json();
          setWatchData(data);
          setBackendStatus("connected");
          onSmartWatchUpdate?.(data);
        } else {
          setBackendStatus("disconnected");
        }
      } catch (err) {
        console.log("Backend not available");
        setBackendStatus("disconnected");
      }
    };

    fetchWatchData();
    const interval = setInterval(fetchWatchData, 3000);
    return () => clearInterval(interval);
  }, [onSmartWatchUpdate]);

  // Analyze frame via direct HTTP - AI auto-detects actions
  const handleAnalyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ensure video has valid content before capturing
    // readyState 4 = HAVE_ENOUGH_DATA (video is playing with frames)
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log("[WebcamFeed] Video dimensions not ready, skipping");
      return;
    }
    if (video.readyState < 2) {
      console.log("[WebcamFeed] Video not ready (readyState:", video.readyState, "), skipping");
      return;
    }
    if (video.paused) {
      console.log("[WebcamFeed] Video is paused, trying to play...");
      video.play().catch(() => {});
      return;
    }

    // Set canvas dimensions and draw the video frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    // Convert to base64 JPEG
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.8);
    
    // Verify we got actual image data (not just a tiny black image)
    if (imageBase64.length < 1000) {
      console.log("[WebcamFeed] Image too small, skipping frame");
      return;
    }

    setIsAnalyzing(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/analyze-frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: imageBase64,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.analysis) {
          setLastAnalysis(data.analysis);
          setActionInProgress(data.action_in_progress || false);
          setFramesBuffered(data.frames_buffered || 0);
          
          // Only push UI update when action is COMPLETED
          if (data.action_completed) {
            console.log("Action completed! Pushing update:", data.analysis);
            onAnalysisUpdate?.(data.analysis);
          } else if (data.action_in_progress) {
            console.log(`Action in progress: ${data.analysis.action} (${data.frames_buffered} frames)`);
          }
        }
      }
    } catch (err) {
      console.log("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, onAnalysisUpdate]);

  // Auto-analyze every 1 second when camera is active and backend connected
  useEffect(() => {
    if (state !== "active" || backendStatus !== "connected") return;
    
    const interval = setInterval(() => {
      handleAnalyzeFrame();
    }, 1000);

    return () => clearInterval(interval);
  }, [state, backendStatus, handleAnalyzeFrame]);

  // Start camera
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
          
          // Wait for video to be ready and start playing
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current?.play();
              console.log(`[WebcamFeed] Camera playing: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
              setState("active");
            } catch (playErr) {
              console.error("[WebcamFeed] Failed to play video:", playErr);
              setState("simulated");
            }
          };
        } else {
          setState("active");
        }
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error(`[WebcamFeed] Camera error — name: ${e.name}, message: ${e.message}`);
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
          {backendStatus === "connected" && (
            <span className="webcam-badge" style={{ background: "rgba(0,255,136,0.1)", color: "#00ff88" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block" }} /> Backend
            </span>
          )}
          <span className="webcam-badge">
            <span className="rec-dot" /> {state === "active" ? "LIVE" : "AI SIM"}
          </span>
        </div>
      </div>

      <div className="webcam-viewport">
        {/* Video element - always in DOM for ref */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="webcam-video"
          style={{ display: state === "active" ? "block" : "none" }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Loading spinner */}
        {state === "loading" && (
          <div className="webcam-placeholder">
            <div className="webcam-spinner" />
            <span>Connecting camera…</span>
          </div>
        )}

        {/* Simulated AI vision view (fallback) */}
        {state === "simulated" && <SimulatedView />}

        {/* Scan-line overlay */}
        {state === "active" && <div className="webcam-scanline" />}

        {/* Corner brackets */}
        <div className="webcam-bracket webcam-bracket-tl" />
        <div className="webcam-bracket webcam-bracket-tr" />
        <div className="webcam-bracket webcam-bracket-bl" />
        <div className="webcam-bracket webcam-bracket-br" />

        {/* Analysis overlay */}
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

        {/* Analyzing indicator */}
        {isAnalyzing && (
          <div className="webcam-analyzing">
            <div className="webcam-spinner-small" />
            <span>Analyzing...</span>
          </div>
        )}
      </div>

      {/* Auto-detection status */}
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
          disabled={isAnalyzing || state !== "active" || backendStatus !== "connected"}
        >
          {isAnalyzing ? "..." : "Scan"}
        </button>
      </div>

      {/* Smart watch data mini display */}
      {watchData && (
        <div className="webcam-watch-data">
          <span>❤️ {watchData.heart_rate_bpm} bpm</span>
          <span>💨 {watchData.blood_oxygen_spo2}%</span>
          <span>🏃 {watchData.steps_today} steps</span>
        </div>
      )}

      {/* Backend status warning */}
      {backendStatus === "disconnected" && (
        <div style={{ 
          marginTop: 8, 
          padding: "8px 12px", 
          background: "rgba(255,68,102,0.1)", 
          borderRadius: 8,
          fontSize: 11,
          color: "#ff4466"
        }}>
          ⚠️ Python backend not running on port 8000
        </div>
      )}
    </div>
  );
};
