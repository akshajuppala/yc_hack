import React, { useEffect, useState, useCallback } from "react";
import "./styles.css";

// Components
import { VitalsChart } from "../resources/health-dashboard/components/VitalsChart";
import { WebcamFeed } from "../resources/health-dashboard/components/WebcamFeed";
import { CameraFeed } from "../resources/health-dashboard/components/CameraFeed";

const BACKEND_URL = "http://localhost:8000";

// Types
interface CameraEvent {
  id: number;
  timestamp: string;
  type: string;
  item: string;
  dose?: string;
  confidence: number;
  status: string;
  icon: string;
}

interface AnalysisResult {
  status: string;
  action?: string;
  category?: string;
  item_name?: string;
  details?: {
    quantity?: string;
    dosage?: string;
    brand?: string;
  };
  description: string;
}

interface ProtocolItem {
  id: string;
  name: string;
  category: string;
  status: string;
  taken_at: string | null;
  details: Record<string, unknown>;
}

interface Protocol {
  total_actions: number;
  by_category: Record<string, string[]>;
  items: ProtocolItem[];
}

interface WatchData {
  heart_rate_bpm: number;
  blood_oxygen_spo2: number;
  hrv_ms: number;
  body_temperature_f: number;
  calories_burned: number;
  steps_today: number;
  stress_level: string;
}

// Category icons and colors
const categoryConfig: Record<string, { icon: string; color: string }> = {
  supplement: { icon: "💊", color: "#00ff88" },
  meal: { icon: "🍎", color: "#ffaa00" },
  hydration: { icon: "💧", color: "#00ccff" },
  exercise: { icon: "🏃", color: "#ff6b6b" },
  wellness: { icon: "🧘", color: "#a78bfa" },
};

// ── Score Ring ───────────────────────────────────────────────────────────────
const ScoreRing: React.FC<{ score: number; total: number }> = ({ score, total }) => {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? (score / total) * 100 : 0;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? "#00ff88" : pct >= 50 ? "#ffaa00" : "#ff4466";
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
        actions
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

// ── Dynamic Protocol List ────────────────────────────────────────────────────
const DynamicProtocolList: React.FC<{ protocol: Protocol }> = ({ protocol }) => {
  if (protocol.items.length === 0) {
    return (
      <div className="protocol-list">
        <div className="protocol-header">
          <span className="protocol-title">📋 TODAY'S PROTOCOL</span>
          <span className="protocol-count">0 actions</span>
        </div>
        <div className="protocol-empty">
          <span className="protocol-empty-icon">👁️</span>
          <span className="protocol-empty-text">No actions recorded yet</span>
          <span className="protocol-empty-hint">Actions will appear here as they're detected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="protocol-list">
      <div className="protocol-header">
        <span className="protocol-title">📋 TODAY'S PROTOCOL</span>
        <span className="protocol-count">{protocol.total_actions} actions</span>
      </div>
      <div className="protocol-items">
        {protocol.items.slice().reverse().map((item) => {
          const config = categoryConfig[item.category] || categoryConfig.wellness;
          const time = item.taken_at 
            ? new Date(item.taken_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";
          return (
            <div key={item.id} className="protocol-item protocol-item-taken">
              <span className="protocol-item-icon">{config.icon}</span>
              <div className="protocol-item-body">
                <span className="protocol-item-name">{item.name}</span>
                <span className="protocol-item-meta">
                  {item.category} • {time}
                </span>
              </div>
              <span className="protocol-item-check" style={{ color: config.color }}>✓</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main App ─────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [now, setNow] = useState(new Date());
  const [detectedEvents, setDetectedEvents] = useState<CameraEvent[]>([]);
  const [eventIdCounter, setEventIdCounter] = useState(1);
  const [protocol, setProtocol] = useState<Protocol>({ total_actions: 0, by_category: {}, items: [] });
  const [watchData, setWatchData] = useState<WatchData | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<{ hr: number[]; hrv: number[] }>({ hr: [], hrv: [] });

  // Clock update
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch watch data and build vitals history
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/smart-watch-data`);
        if (res.ok) {
          const data = await res.json();
          setWatchData(data);
          setVitalsHistory(prev => ({
            hr: [...prev.hr.slice(-59), data.heart_rate_bpm],
            hrv: [...prev.hrv.slice(-59), data.hrv_ms],
          }));
        }
      } catch (err) {
        console.log("Failed to fetch watch data");
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch protocol periodically
  useEffect(() => {
    const fetchProtocol = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/protocol`);
        if (res.ok) {
          const data = await res.json();
          setProtocol(data);
        }
      } catch (err) {
        console.log("Failed to fetch protocol");
      }
    };
    fetchProtocol();
    const interval = setInterval(fetchProtocol, 2000);
    return () => clearInterval(interval);
  }, []);

  // Handle analysis results from webcam
  const handleAnalysisUpdate = useCallback((result: AnalysisResult) => {
    const category = result.category || "wellness";
    const config = categoryConfig[category] || categoryConfig.wellness;
    
    const itemName = result.item_name || result.action || result.description.slice(0, 40);

    const newEvent: CameraEvent = {
      id: eventIdCounter,
      timestamp: new Date().toISOString(),
      type: category,
      item: itemName,
      dose: result.details?.dosage,
      confidence: 0.95,
      status: "confirmed",
      icon: config.icon,
    };

    console.log("Adding detection:", newEvent);
    setEventIdCounter((c) => c + 1);
    setDetectedEvents((prev) => [newEvent, ...prev].slice(0, 20));
  }, [eventIdCounter]);

  // Calculate stats
  const totalCalories = watchData?.calories_burned || 0;

  return (
    <div className="bp-root" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* ── Header ────────────────────────────────────── */}
      <div className="bp-header">
        <div className="bp-header-left">
          <ScoreRing score={protocol.total_actions} total={10} />
          <div>
            <h1 className="bp-title">BLUEPRINT</h1>
            <p className="bp-subtitle">Health Optimizer</p>
            <p className="bp-clock">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        </div>
        <div className="bp-header-right">
          <span className="bp-live-badge">
            <span className="rec-dot" /> LIVE
          </span>
          <span className="bp-view-badge">AI MONITOR</span>
        </div>
      </div>

      {/* ── Quick Stats ───────────────────────────────── */}
      <div className="bp-stats-row">
        <Stat label="HEART RATE" value={watchData?.heart_rate_bpm || "--"} unit="bpm" color="#00ff88" />
        <Stat label="HRV" value={watchData?.hrv_ms || "--"} unit="ms" color="#00ccff" />
        <Stat label="SpO2" value={watchData?.blood_oxygen_spo2 || "--"} unit="%" color="#a78bfa" />
        <Stat label="TEMP" value={watchData?.body_temperature_f || "--"} unit="°F" color="#f59e0b" />
        <Stat label="CALORIES" value={totalCalories} unit="kcal" color="#ff6b6b" />
      </div>

      {/* ── Vitals Chart ──────────────────────────────── */}
      {vitalsHistory.hr.length > 5 && (
        <div className="bp-card">
          <VitalsChart
            heartRate={vitalsHistory.hr}
            hrv={vitalsHistory.hrv}
            startTime={new Date(Date.now() - vitalsHistory.hr.length * 3000).toISOString()}
            intervalMs={3000}
          />
        </div>
      )}

      {/* ── Row 1: Webcam + Camera Events ─────────────── */}
      <div className="bp-split">
        <div className="bp-card bp-split-cell">
          <WebcamFeed onAnalysisUpdate={handleAnalysisUpdate} />
        </div>
        <div className="bp-card bp-split-cell">
          <CameraFeed events={detectedEvents} />
        </div>
      </div>

      {/* ── Row 2: Protocol List ─────────────────────────────── */}
      <div className="bp-card">
        <DynamicProtocolList protocol={protocol} />
      </div>

      {/* ── Category Summary ────────────────────────────────── */}
      {Object.keys(protocol.by_category).length > 0 && (
        <div className="bp-card">
          <div className="category-summary">
            <span className="category-summary-title">📊 CATEGORY BREAKDOWN</span>
            <div className="category-grid">
              {Object.entries(protocol.by_category).map(([cat, items]) => {
                const config = categoryConfig[cat] || categoryConfig.wellness;
                return (
                  <div key={cat} className="category-item">
                    <span className="category-icon">{config.icon}</span>
                    <span className="category-name">{cat}</span>
                    <span className="category-count" style={{ color: config.color }}>{items.length}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────── */}
      <div className="bp-footer">
        <span className="bp-footer-mfg">Powered by Gemini AI</span>
        <span className="bp-footer-mfg">Blueprint Health Optimizer</span>
      </div>
    </div>
  );
};

export default App;
