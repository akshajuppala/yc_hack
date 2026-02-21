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
  confidence: number;
  status: string;
  icon: string;
}

interface AnalysisResult {
  status: string;
  title?: string;
  description: string;
  action_type?: string;
  macros?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  };
}

interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  water_ml: number;
}

interface ProtocolItem {
  id: string;
  action_type: string;
  title: string;
  description: string;
  timestamp: string;
  macros: Macros;
  micros: Record<string, string>;
  status: string;
}

interface NutritionTotals {
  calories_consumed: number;
  calories_burned: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  water_ml: number;
}

interface Protocol {
  total_actions: number;
  totals: NutritionTotals;
  net_calories: number;
  supplements_taken: string[];
  items: ProtocolItem[];
}

interface WatchData {
  heart_rate_bpm: number;
  blood_oxygen_spo2: number;
  hrv_ms: number;
  body_temperature_f: number;
  calories_burned: number;
  steps_today: number;
}

// Action type icons
const actionIcons: Record<string, string> = {
  food: "🍎",
  supplement: "💊",
  hydration: "💧",
  exercise: "🏃",
};

// ── Score Ring ───────────────────────────────────────────────────────────────
const ScoreRing: React.FC<{ score: number; total: number }> = ({ score, total }) => {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min((score / total) * 100, 100) : 0;
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

// ── Macro Bar ────────────────────────────────────────────────────────────────
const MacroBar: React.FC<{ label: string; value: number; max: number; color: string; unit: string }> = ({
  label, value, max, color, unit
}) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="macro-bar">
      <div className="macro-bar-header">
        <span className="macro-bar-label">{label}</span>
        <span className="macro-bar-value" style={{ color }}>{value.toFixed(1)}{unit}</span>
      </div>
      <div className="macro-bar-track">
        <div className="macro-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

// ── Nutrition Dashboard ──────────────────────────────────────────────────────
const NutritionDashboard: React.FC<{ totals: NutritionTotals; netCalories: number }> = ({ totals, netCalories }) => {
  return (
    <div className="nutrition-dashboard">
      <div className="nutrition-header">
        <span className="nutrition-title">📊 NUTRITION TRACKER</span>
      </div>
      
      {/* Calorie Ring */}
      <div className="calorie-ring-container">
        <div className="calorie-ring">
          <div className="calorie-ring-inner">
            <span className="calorie-ring-value">{netCalories}</span>
            <span className="calorie-ring-label">net kcal</span>
          </div>
        </div>
        <div className="calorie-breakdown">
          <div className="calorie-row consumed">
            <span>🍎 Consumed</span>
            <span>+{totals.calories_consumed} kcal</span>
          </div>
          <div className="calorie-row burned">
            <span>🔥 Burned</span>
            <span>-{totals.calories_burned} kcal</span>
          </div>
        </div>
      </div>
      
      {/* Macro Bars */}
      <div className="macro-bars">
        <MacroBar label="Protein" value={totals.protein_g} max={150} color="#00ff88" unit="g" />
        <MacroBar label="Carbs" value={totals.carbs_g} max={300} color="#ffaa00" unit="g" />
        <MacroBar label="Fat" value={totals.fat_g} max={80} color="#ff6b6b" unit="g" />
        <MacroBar label="Fiber" value={totals.fiber_g} max={30} color="#a78bfa" unit="g" />
      </div>
      
      {/* Hydration */}
      {totals.water_ml > 0 && (
        <div className="hydration-tracker">
          <span className="hydration-icon">💧</span>
          <span className="hydration-value">{totals.water_ml} ml</span>
          <span className="hydration-label">hydration</span>
        </div>
      )}
    </div>
  );
};

// ── Protocol List with Nutrition ─────────────────────────────────────────────
const ProtocolList: React.FC<{ protocol: Protocol }> = ({ protocol }) => {
  if (protocol.items.length === 0) {
    return (
      <div className="protocol-list">
        <div className="protocol-header">
          <span className="protocol-title">📋 HEALTH LOG</span>
          <span className="protocol-count">0 actions</span>
        </div>
        <div className="protocol-empty">
          <span className="protocol-empty-icon">👁️</span>
          <span className="protocol-empty-text">No health actions yet</span>
          <span className="protocol-empty-hint">Take supplements, eat food, drink water, or exercise</span>
        </div>
      </div>
    );
  }

  return (
    <div className="protocol-list">
      <div className="protocol-header">
        <span className="protocol-title">📋 HEALTH LOG</span>
        <span className="protocol-count">{protocol.total_actions} actions</span>
      </div>
      
      {/* Supplements Summary */}
      {protocol.supplements_taken.length > 0 && (
        <div className="supplements-summary">
          <span className="supplements-icon">💊</span>
          <span className="supplements-text">
            {protocol.supplements_taken.join(", ")}
          </span>
        </div>
      )}
      
      <div className="protocol-items">
        {protocol.items.slice().reverse().map((item) => {
          const time = new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const icon = actionIcons[item.action_type] || "✅";
          const cals = item.macros.calories;
          const calText = cals !== 0 ? ` • ${cals > 0 ? "+" : ""}${cals} kcal` : "";
          
          // Build macro summary for food
          let macroText = "";
          if (item.action_type === "food" && item.macros.protein_g > 0) {
            macroText = ` • P:${item.macros.protein_g.toFixed(0)}g C:${item.macros.carbs_g.toFixed(0)}g F:${item.macros.fat_g.toFixed(0)}g`;
          }
          
          return (
            <div key={item.id} className={`protocol-item protocol-item-${item.action_type}`}>
              <span className="protocol-item-icon">{icon}</span>
              <div className="protocol-item-body">
                <span className="protocol-item-name">{item.title}</span>
                <span className="protocol-item-meta">
                  {time}{calText}{macroText}
                </span>
              </div>
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
  const [protocol, setProtocol] = useState<Protocol>({ 
    total_actions: 0, 
    totals: {
      calories_consumed: 0,
      calories_burned: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      water_ml: 0,
    },
    net_calories: 0,
    supplements_taken: [],
    items: [] 
  });
  const [watchData, setWatchData] = useState<WatchData | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<{ hr: number[]; hrv: number[] }>({ hr: [], hrv: [] });

  // Clock update
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch watch data
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

  // Fetch protocol
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

  // Handle analysis results
  const handleAnalysisUpdate = useCallback((result: AnalysisResult) => {
    const title = result.title || result.description.slice(0, 40);
    const actionType = result.action_type || "food";
    const icon = actionIcons[actionType] || "✅";

    const newEvent: CameraEvent = {
      id: eventIdCounter,
      timestamp: new Date().toISOString(),
      type: actionType,
      item: title,
      confidence: 0.95,
      status: "confirmed",
      icon: icon,
    };

    console.log("Adding detection:", newEvent);
    setEventIdCounter((c) => c + 1);
    setDetectedEvents((prev) => [newEvent, ...prev].slice(0, 20));
  }, [eventIdCounter]);

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
        <Stat label="NET CAL" value={protocol.net_calories} unit="kcal" color="#ff6b6b" />
        <Stat label="PROTEIN" value={protocol.totals.protein_g.toFixed(0)} unit="g" color="#00ff88" />
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

      {/* ── Row 1: Webcam + Detections ─────────────────── */}
      <div className="bp-split">
        <div className="bp-card bp-split-cell">
          <WebcamFeed onAnalysisUpdate={handleAnalysisUpdate} />
        </div>
        <div className="bp-card bp-split-cell">
          <CameraFeed events={detectedEvents} />
        </div>
      </div>

      {/* ── Row 2: Nutrition + Protocol ─────────────────── */}
      <div className="bp-split">
        <div className="bp-card bp-split-cell">
          <NutritionDashboard totals={protocol.totals} netCalories={protocol.net_calories} />
        </div>
        <div className="bp-card bp-split-cell">
          <ProtocolList protocol={protocol} />
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────── */}
      <div className="bp-footer">
        <span className="bp-footer-mfg">Powered by Gemini AI</span>
        <span className="bp-footer-mfg">Blueprint Health Optimizer</span>
      </div>
    </div>
  );
};

export default App;
