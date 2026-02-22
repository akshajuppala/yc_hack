import {
  McpUseProvider,
  useWidget,
  useCallTool,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { z } from "zod";
import "../styles.css";

const propsSchema = z.object({
  backendUrl: z.string().default("http://localhost:8000"),
  autoAnalyze: z.boolean().default(true),
  analyzeIntervalMs: z.number().default(1000),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Live webcam feed with AI-powered health action detection. Detects supplements, food, hydration, and exercise.",
  props: propsSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Starting camera...",
    invoked: "Camera active",
    csp: { connectDomains: ["http://localhost:8000"] },
  },
};

type Props = z.infer<typeof propsSchema>;
type CamState = "loading" | "active" | "simulated" | "denied" | "unavailable";

interface AnalysisResult {
  status: string;
  action_type?: string;
  title?: string;
  description: string;
  macros?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  };
}

const SimulatedView: React.FC = () => {
  const [scanY, setScanY] = useState(0);
  const [detections, setDetections] = useState<string[]>([]);

  const labels = [
    "SUPPLEMENT BOTTLE — Omega-3",
    "HAND DETECTED — reaching",
    "PILL CAPSULE — 2 count",
    "GLASS OF WATER",
    "FOOD — Apple",
    "WRIST — watch detected",
  ];

  useEffect(() => {
    const scanId = setInterval(() => setScanY((y) => (y >= 100 ? 0 : y + 0.8)), 30);
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
          style={{ top: `${20 + i * 28}%`, left: i % 2 === 0 ? "8%" : "35%", animationDelay: `${i * 0.15}s` }}
        >
          <span className="sim-cam-det-dot" />
          <span>{label}</span>
        </div>
      ))}
      <div className="sim-cam-ts">
        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} — AI VISION
      </div>
    </div>
  );
};

const WebcamSkeleton: React.FC = () => (
  <McpUseProvider>
    <div className="bp-root" style={{ padding: 16 }}>
      <div className="bp-skel" style={{ height: 22, width: 180, marginBottom: 12 }} />
      <div className="bp-skel" style={{ height: 280, borderRadius: 16, marginBottom: 12 }} />
      <div className="bp-skel" style={{ height: 40, borderRadius: 8 }} />
    </div>
  </McpUseProvider>
);

export default function WebcamWidget() {
  const { props, isPending, sendFollowUpMessage } = useWidget<Props>();
  const { callTool: analyzeFrame, isPending: isAnalyzingTool } = useCallTool("analyze-frame");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camState, setCamState] = useState<CamState>("loading");
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [framesBuffered, setFramesBuffered] = useState(0);
  const [backendStatus, setBackendStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [detectedEvents, setDetectedEvents] = useState<Array<{ id: number; type: string; item: string; timestamp: string }>>([]);

  const backendUrl = props?.backendUrl || "http://localhost:8000";
  const autoAnalyze = props?.autoAnalyze ?? true;
  const analyzeIntervalMs = props?.analyzeIntervalMs || 1000;

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch(`${backendUrl}/health`);
        setBackendStatus(res.ok ? "connected" : "disconnected");
      } catch {
        setBackendStatus("disconnected");
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCamState("simulated");
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
              setCamState("active");
            } catch {
              setCamState("simulated");
            }
          };
        }
      } catch (err: any) {
        if (!cancelled) setCamState(err?.name === "NotAllowedError" ? "denied" : "simulated");
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleAnalyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || backendStatus !== "connected") return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2 || video.paused) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    const imageBase64 = canvas.toDataURL("image/jpeg", 0.8);
    if (imageBase64.length < 1000) return;

    setIsAnalyzing(true);

    try {
      const res = await fetch(`${backendUrl}/api/analyze-frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: imageBase64 }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.analysis) {
          setLastAnalysis(data.analysis);
          setActionInProgress(data.action_in_progress || false);
          setFramesBuffered(data.frames_buffered || 0);

          if (data.action_completed && data.analysis.status === "finished") {
            const newEvent = {
              id: Date.now(),
              type: data.analysis.action_type || "activity",
              item: data.analysis.title || data.analysis.description,
              timestamp: new Date().toISOString(),
            };
            setDetectedEvents((prev) => [newEvent, ...prev].slice(0, 10));
          }
        }
      }
    } catch (err) {
      console.log("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, backendStatus, backendUrl]);

  useEffect(() => {
    if (camState !== "active" || backendStatus !== "connected" || !autoAnalyze) return;
    const interval = setInterval(handleAnalyzeFrame, analyzeIntervalMs);
    return () => clearInterval(interval);
  }, [camState, backendStatus, autoAnalyze, analyzeIntervalMs, handleAnalyzeFrame]);

  if (isPending) return <WebcamSkeleton />;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "started": return "#00ff88";
      case "in progress": return "#ffaa00";
      case "finished": return "#00ccff";
      default: return "#666";
    }
  };

  const actionIcons: Record<string, string> = {
    food: "🍎",
    supplement: "💊",
    hydration: "💧",
    exercise: "🏃",
  };

  return (
    <McpUseProvider>
      <div className="bp-root" style={{ padding: 16 }}>
        <div className="webcam-header">
          <span className="webcam-title">🎥 AI HEALTH CAMERA</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {backendStatus === "connected" && (
              <span className="webcam-badge" style={{ background: "rgba(0,255,136,0.1)", color: "#00ff88" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block" }} /> Backend
              </span>
            )}
            <span className="webcam-badge">
              <span className="rec-dot" /> {camState === "active" ? "LIVE" : "AI SIM"}
            </span>
          </div>
        </div>

        <div className="webcam-viewport" style={{ marginTop: 12 }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="webcam-video"
            style={{ display: camState === "active" ? "block" : "none" }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {camState === "loading" && (
            <div className="webcam-placeholder">
              <div className="webcam-spinner" />
              <span>Connecting camera…</span>
            </div>
          )}

          {camState === "simulated" && <SimulatedView />}
          {camState === "denied" && (
            <div className="webcam-placeholder">
              <span style={{ fontSize: 36 }}>🚫</span>
              <span>Camera access denied</span>
            </div>
          )}

          {camState === "active" && <div className="webcam-scanline" />}

          <div className="webcam-bracket webcam-bracket-tl" />
          <div className="webcam-bracket webcam-bracket-tr" />
          <div className="webcam-bracket webcam-bracket-bl" />
          <div className="webcam-bracket webcam-bracket-br" />

          {camState === "active" && lastAnalysis && lastAnalysis.status !== "not detected" && (
            <div className="webcam-analysis-overlay">
              <div className="webcam-status-badge" style={{ backgroundColor: getStatusColor(lastAnalysis.status) }}>
                {lastAnalysis.status.toUpperCase()}
              </div>
              <div className="webcam-description">
                {lastAnalysis.title || lastAnalysis.description}
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

        <div className="webcam-controls" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <span className="webcam-action-label">AI Auto-Detect:</span>
            {actionInProgress ? (
              <span style={{ color: "#ffaa00", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffaa00", animation: "rec-pulse 1s infinite" }} />
                Action in progress ({framesBuffered} frames)
              </span>
            ) : (
              <span style={{ color: "#00ff88", fontSize: 11 }}>Monitoring...</span>
            )}
          </div>
          <button
            className="webcam-analyze-btn"
            onClick={handleAnalyzeFrame}
            disabled={isAnalyzing || camState !== "active" || backendStatus !== "connected"}
          >
            {isAnalyzing ? "..." : "Scan"}
          </button>
        </div>

        {detectedEvents.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#888", marginBottom: 8 }}>📋 RECENT DETECTIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {detectedEvents.slice(0, 5).map((event) => (
                <div key={event.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", background: "#0e0e18", borderRadius: 10,
                  borderLeft: `3px solid ${event.type === "food" ? "#ffaa00" : event.type === "supplement" ? "#a78bfa" : event.type === "hydration" ? "#00ccff" : "#ff6b6b"}`,
                }}>
                  <span style={{ fontSize: 18 }}>{actionIcons[event.type] || "✅"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{event.item}</div>
                    <div style={{ fontSize: 10, color: "#666" }}>
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {backendStatus === "disconnected" && (
          <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(255,68,102,0.1)", borderRadius: 8, fontSize: 11, color: "#ff4466" }}>
            ⚠️ Python backend not running on port 8000. Start with: cd backend && python api.py
          </div>
        )}

        <div className="bp-footer" style={{ marginTop: 16 }}>
          <button
            className="bp-footer-btn"
            onClick={() => sendFollowUpMessage("What health actions have I performed today based on the camera detections? Give me a summary.")}
          >
            Ask AI for Summary →
          </button>
        </div>
      </div>
    </McpUseProvider>
  );
}
