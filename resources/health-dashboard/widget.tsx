import {
  McpUseProvider,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useEffect, useState } from "react";
import "../styles.css";
import { propSchema, type HealthDashboardProps } from "./types";
import { VitalsChart } from "./components/VitalsChart";
import { WebcamFeed } from "./components/WebcamFeed";
import { CameraFeed } from "./components/CameraFeed";
import { CaloriesTracker } from "./components/CaloriesTracker";
import { ProtocolList } from "./components/ProtocolList";

// ── Widget Metadata ──────────────────────────────────────────────────────────
export const widgetMetadata: WidgetMetadata = {
  description:
    "Real-time health optimization dashboard — animated vitals, live webcam, camera supplement detection, calories, protocol tracking",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Loading health data…",
    invoked: "Dashboard streaming",
  },
};

// ── Skeleton ─────────────────────────────────────────────────────────────────
const DashboardSkeleton: React.FC = () => (
  <McpUseProvider>
    <div className="bp-root">
      <div className="bp-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="bp-skel" style={{ width: 180, height: 22 }} />
          <div className="bp-skel" style={{ width: 60, height: 18 }} />
        </div>
      </div>
      <div className="bp-skel" style={{ height: 220, borderRadius: 16, margin: "0 0 16px" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="bp-skel" style={{ height: 220, borderRadius: 16 }} />
        <div className="bp-skel" style={{ height: 220, borderRadius: 16 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <div className="bp-skel" style={{ height: 200, borderRadius: 16 }} />
        <div className="bp-skel" style={{ height: 200, borderRadius: 16 }} />
      </div>
    </div>
  </McpUseProvider>
);

// ── Score Ring ───────────────────────────────────────────────────────────────
const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#00ff88" : score >= 50 ? "#ffaa00" : "#ff4466";
  return (
    <svg width="96" height="96" className="score-ring">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#1a1a2e" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={r}
        fill="none" stroke={color} strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 48 48)"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      <text x="48" y="44" textAnchor="middle" fill={color} fontSize="22" fontWeight="bold">
        {score}
      </text>
      <text x="48" y="60" textAnchor="middle" fill="#555" fontSize="10">
        / 100
      </text>
    </svg>
  );
};

// ── Stat Pill ────────────────────────────────────────────────────────────────
const Stat: React.FC<{ label: string; value: string | number; unit: string; color: string }> = ({
  label, value, unit, color,
}) => (
  <div className="bp-stat">
    <span className="bp-stat-label">{label}</span>
    <span className="bp-stat-value" style={{ color }}>
      {value} <small>{unit}</small>
    </span>
  </div>
);

// ── Types for live data ─────────────────────────────────────────────────────
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

interface AnalysisResult {
  status: string;
  description: string;
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
const HealthDashboard: React.FC = () => {
  const { props, isPending, sendFollowUpMessage } =
    useWidget<HealthDashboardProps>();

  // live clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Live data from backend
  const [liveWatchData, setLiveWatchData] = useState<SmartWatchData | null>(null);
  const [liveAnalysis, setLiveAnalysis] = useState<AnalysisResult | null>(null);
  const [cameraDetections, setCameraDetections] = useState<Array<{
    id: number;
    timestamp: string;
    type: string;
    item: string;
    confidence: number;
    status: string;
    icon: string;
  }>>([]);

  // Handle smart watch updates
  const handleSmartWatchUpdate = (data: SmartWatchData) => {
    setLiveWatchData(data);
  };

  // Handle analysis updates and add to camera events
  const handleAnalysisUpdate = (result: AnalysisResult) => {
    setLiveAnalysis(result);
    if (result.status !== "not detected") {
      const newEvent = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: result.status,
        item: result.description.slice(0, 50),
        confidence: result.status === "finished" ? 95 : result.status === "in progress" ? 80 : 60,
        status: result.status,
        icon: result.status === "finished" ? "✅" : result.status === "in progress" ? "🔄" : "🎯",
      };
      setCameraDetections((prev) => [newEvent, ...prev].slice(0, 10));
    }
  };

  if (isPending) return <DashboardSkeleton />;

  const {
    view,
    vitals,
    cameraEvents,
    protocol,
    nutrition,
    profileName,
    summary,
  } = props;

  // Merge live data with props
  const displayHR = liveWatchData?.heart_rate_bpm ?? summary.latestHR;
  const displayHRV = liveWatchData?.hrv_ms ?? summary.latestHRV;
  const displaySpO2 = liveWatchData?.blood_oxygen_spo2 ?? vitals.spo2[vitals.spo2.length - 1];
  const displayTemp = liveWatchData ? ((liveWatchData.body_temperature_f - 32) * 5/9).toFixed(1) : vitals.skinTemp[vitals.skinTemp.length - 1];
  
  // Combine static and live camera events
  const allCameraEvents = [...cameraDetections, ...cameraEvents].slice(0, 15);

  return (
    <McpUseProvider>
      <div className="bp-root">
        {/* ── Header ────────────────────────────────────── */}
        <div className="bp-header">
          <div className="bp-header-left">
            <ScoreRing score={summary.adherenceScore} />
            <div>
              <h1 className="bp-title">BLUEPRINT</h1>
              <p className="bp-subtitle">{profileName}</p>
              <p className="bp-clock">
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="bp-header-right">
            <span className="bp-live-badge">
              <span className="rec-dot" /> LIVE
            </span>
            <span className="bp-view-badge">{view.toUpperCase()}</span>
          </div>
        </div>

        {/* ── Quick Stats ───────────────────────────────── */}
        <div className="bp-stats-row">
          <Stat label="HEART RATE" value={displayHR} unit="bpm" color="#00ff88" />
          <Stat label="HRV" value={displayHRV} unit="ms" color="#00ccff" />
          <Stat label="SpO2" value={displaySpO2} unit="%" color="#a78bfa" />
          <Stat label="SKIN TEMP" value={displayTemp} unit="°C" color="#f59e0b" />
          <Stat
            label="CALORIES"
            value={liveWatchData ? liveWatchData.calories_burned : `${summary.caloriesConsumed}/${summary.caloriesTarget}`}
            unit="kcal"
            color="#ff6b6b"
          />
        </div>

        {/* ── Vitals Chart ──────────────────────────────── */}
        <div className="bp-card">
          <VitalsChart
            heartRate={vitals.heartRate}
            hrv={vitals.hrv}
            startTime={vitals.startTime}
            intervalMs={vitals.intervalMs}
          />
        </div>

        {/* ── Row 1: Webcam + Camera Events ─────────────── */}
        <div className="bp-split">
          <div className="bp-card bp-split-cell">
            <WebcamFeed 
              onSmartWatchUpdate={handleSmartWatchUpdate}
              onAnalysisUpdate={handleAnalysisUpdate}
            />
          </div>
          <div className="bp-card bp-split-cell">
            <CameraFeed events={allCameraEvents} />
          </div>
        </div>

        {/* ── Row 2: Calories + Protocol ─────────────────── */}
        <div className="bp-split">
          <div className="bp-card bp-split-cell">
            <CaloriesTracker
              targetCalories={nutrition.targetCalories}
              targetMacros={nutrition.targetMacros}
              meals={nutrition.meals}
            />
          </div>
          <div className="bp-card bp-split-cell">
            <ProtocolList items={protocol} />
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div className="bp-footer">
          <span className="bp-footer-mfg">Powered by Manufact · MCP Apps</span>
          <button
            className="bp-footer-btn"
            onClick={() =>
              sendFollowUpMessage(
                "Based on my vitals, nutrition, and supplement protocol, give me personalized recommendations to optimize my biomarkers. Focus on what I'm missing and calorie adjustments."
              )
            }
          >
            Ask AI for recommendations →
          </button>
        </div>
      </div>
    </McpUseProvider>
  );
};

export default HealthDashboard;
