import React, { useEffect, useState } from "react";
import "./styles.css";

// Reuse the exact same components from the MCP widget
import { VitalsChart } from "../resources/health-dashboard/components/VitalsChart";
import { WebcamFeed } from "../resources/health-dashboard/components/WebcamFeed";
import { CameraFeed } from "../resources/health-dashboard/components/CameraFeed";
import { CaloriesTracker } from "../resources/health-dashboard/components/CaloriesTracker";
import { ProtocolList } from "../resources/health-dashboard/components/ProtocolList";

// Load toy data directly (Vite JSON imports)
import vitalsRaw from "../data/vitals-stream.json";
import cameraRaw from "../data/camera-events.json";
import nutritionRaw from "../data/nutrition-log.json";
import protocolRaw from "../data/protocol-log.json";

// ── Derive dashboard data (same logic as index.ts) ──────────────────────────
const vitals = {
  startTime: vitalsRaw.startTime,
  intervalMs: vitalsRaw.intervalMs,
  heartRate: vitalsRaw.signals.heart_rate.values,
  hrv: vitalsRaw.signals.hrv.values,
  spo2: vitalsRaw.signals.spo2.values,
  skinTemp: vitalsRaw.signals.skin_temp.values,
};

const takenCount = protocolRaw.protocol.filter((p) => p.status === "taken").length;
const totalCount = protocolRaw.protocol.filter((p) => p.status !== "weekly_skip").length;
const adherenceScore = Math.round((takenCount / totalCount) * 100);
const latestHR = vitals.heartRate[vitals.heartRate.length - 1];
const latestHRV = vitals.hrv[vitals.hrv.length - 1];
const caloriesConsumed = nutritionRaw.meals
  .filter((m) => m.status === "consumed")
  .reduce((s, m) => s + m.calories, 0);

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

// ── Main App ─────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bp-root" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* ── Header ────────────────────────────────────── */}
      <div className="bp-header">
        <div className="bp-header-left">
          <ScoreRing score={adherenceScore} />
          <div>
            <h1 className="bp-title">BLUEPRINT</h1>
            <p className="bp-subtitle">{protocolRaw.profile}</p>
            <p className="bp-clock">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        </div>
        <div className="bp-header-right">
          <span className="bp-live-badge">
            <span className="rec-dot" /> LIVE
          </span>
          <span className="bp-view-badge">LIVE</span>
        </div>
      </div>

      {/* ── Quick Stats ───────────────────────────────── */}
      <div className="bp-stats-row">
        <Stat label="HEART RATE" value={latestHR} unit="bpm" color="#00ff88" />
        <Stat label="HRV" value={latestHRV} unit="ms" color="#00ccff" />
        <Stat label="SpO2" value={vitals.spo2[vitals.spo2.length - 1]} unit="%" color="#a78bfa" />
        <Stat label="SKIN TEMP" value={vitals.skinTemp[vitals.skinTemp.length - 1]} unit="°C" color="#f59e0b" />
        <Stat
          label="CALORIES"
          value={`${caloriesConsumed}/${nutritionRaw.targetCalories}`}
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
          <WebcamFeed />
        </div>
        <div className="bp-card bp-split-cell">
          <CameraFeed events={cameraRaw.events} />
        </div>
      </div>

      {/* ── Row 2: Calories + Protocol ─────────────────── */}
      <div className="bp-split">
        <div className="bp-card bp-split-cell">
          <CaloriesTracker
            targetCalories={nutritionRaw.targetCalories}
            targetMacros={nutritionRaw.targetMacros}
            meals={nutritionRaw.meals}
          />
        </div>
        <div className="bp-card bp-split-cell">
          <ProtocolList items={protocolRaw.protocol} />
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────── */}
      <div className="bp-footer">
        <span className="bp-footer-mfg">Powered by Manufact · MCP Apps</span>
        <span className="bp-footer-mfg">Blueprint Health Optimizer</span>
      </div>
    </div>
  );
};

export default App;
