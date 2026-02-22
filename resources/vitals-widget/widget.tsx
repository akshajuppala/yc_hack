import {
  McpUseProvider,
  useWidget,
  useCallTool,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useEffect, useState } from "react";
import { z } from "zod";
import "../styles.css";

const propsSchema = z.object({
  heartRate: z.array(z.number()),
  hrv: z.array(z.number()),
  spo2: z.array(z.number()),
  skinTemp: z.array(z.number()),
  startTime: z.string(),
  intervalMs: z.number(),
  latestHR: z.number(),
  latestHRV: z.number(),
  latestSpO2: z.number(),
  latestTemp: z.number(),
  stepsToday: z.number().optional(),
  caloriesBurned: z.number().optional(),
  stressLevel: z.string().optional(),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Real-time vitals display showing heart rate, HRV, SpO2, and temperature with live chart",
  props: propsSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Loading vitals...",
    invoked: "Vitals streaming",
  },
};

type Props = z.infer<typeof propsSchema>;

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

const VitalsChart: React.FC<{
  heartRate: number[];
  hrv: number[];
  startTime: string;
  intervalMs: number;
}> = ({ heartRate, hrv }) => {
  const hrMin = Math.min(...heartRate);
  const hrMax = Math.max(...heartRate);
  const hrvMin = Math.min(...hrv);
  const hrvMax = Math.max(...hrv);

  const normalize = (val: number, min: number, max: number) => {
    if (max === min) return 50;
    return ((val - min) / (max - min)) * 80 + 10;
  };

  const width = 100;
  const hrPath = heartRate.map((v, i) => {
    const x = (i / (heartRate.length - 1)) * width;
    const y = 100 - normalize(v, hrMin, hrMax);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  const hrvPath = hrv.map((v, i) => {
    const x = (i / (hrv.length - 1)) * width;
    const y = 100 - normalize(v, hrvMin, hrvMax);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  return (
    <div className="vitals-chart">
      <div className="vitals-chart-header">
        <span className="vitals-chart-title">📈 VITALS STREAM</span>
        <div className="vitals-chart-legend">
          <span className="vitals-legend-item">
            <span className="vitals-legend-dot" style={{ background: "#00ff88" }} /> HR
          </span>
          <span className="vitals-legend-item">
            <span className="vitals-legend-dot" style={{ background: "#00ccff" }} /> HRV
          </span>
        </div>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="vitals-svg">
        <defs>
          <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ccff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00ccff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${hrPath} L 100 100 L 0 100 Z`} fill="url(#hrGrad)" />
        <path d={hrPath} fill="none" stroke="#00ff88" strokeWidth="1.5" />
        <path d={`${hrvPath} L 100 100 L 0 100 Z`} fill="url(#hrvGrad)" />
        <path d={hrvPath} fill="none" stroke="#00ccff" strokeWidth="1" strokeDasharray="3 2" />
      </svg>
      <div className="vitals-chart-footer">
        <span>HR: {hrMin}-{hrMax} bpm</span>
        <span>HRV: {hrvMin}-{hrvMax} ms</span>
      </div>
    </div>
  );
};

const VitalsSkeleton: React.FC = () => (
  <McpUseProvider>
    <div className="bp-root" style={{ padding: 16 }}>
      <div className="bp-skel" style={{ height: 22, width: 180, marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bp-skel" style={{ height: 60, borderRadius: 12 }} />
        ))}
      </div>
      <div className="bp-skel" style={{ height: 200, borderRadius: 16 }} />
    </div>
  </McpUseProvider>
);

export default function VitalsWidget() {
  const { props, isPending, sendFollowUpMessage } = useWidget<Props>();
  const { callTool: refreshVitals, isPending: isRefreshing } = useCallTool("get-vitals");

  const [liveHR, setLiveHR] = useState<number[]>([]);
  const [liveHRV, setLiveHRV] = useState<number[]>([]);

  useEffect(() => {
    if (!isPending && props) {
      setLiveHR(props.heartRate);
      setLiveHRV(props.hrv);
    }
  }, [isPending, props]);

  if (isPending) return <VitalsSkeleton />;

  const { latestHR, latestHRV, latestSpO2, latestTemp, stepsToday, caloriesBurned, stressLevel } = props;

  return (
    <McpUseProvider>
      <div className="bp-root" style={{ padding: 16 }}>
        <div className="bp-header" style={{ marginBottom: 16 }}>
          <div className="bp-header-left">
            <h2 className="bp-title" style={{ fontSize: 18, margin: 0 }}>⌚ SMART WATCH VITALS</h2>
          </div>
          <div className="bp-header-right">
            <span className="bp-live-badge">
              <span className="rec-dot" /> LIVE
            </span>
          </div>
        </div>

        <div className="bp-stats-row" style={{ marginBottom: 16 }}>
          <Stat label="HEART RATE" value={latestHR} unit="bpm" color="#00ff88" />
          <Stat label="HRV" value={latestHRV} unit="ms" color="#00ccff" />
          <Stat label="SpO2" value={latestSpO2} unit="%" color="#a78bfa" />
          <Stat label="TEMP" value={latestTemp.toFixed(1)} unit="°F" color="#f59e0b" />
        </div>

        {stepsToday !== undefined && caloriesBurned !== undefined && (
          <div className="bp-stats-row" style={{ marginBottom: 16 }}>
            <Stat label="STEPS" value={stepsToday} unit="" color="#00ff88" />
            <Stat label="CALORIES" value={caloriesBurned} unit="kcal" color="#ff6b6b" />
            {stressLevel && <Stat label="STRESS" value={stressLevel.toUpperCase()} unit="" color={stressLevel === "low" ? "#00ff88" : stressLevel === "moderate" ? "#ffaa00" : "#ff4466"} />}
          </div>
        )}

        {liveHR.length > 5 && (
          <div className="bp-card">
            <VitalsChart
              heartRate={liveHR}
              hrv={liveHRV}
              startTime={props.startTime}
              intervalMs={props.intervalMs}
            />
          </div>
        )}

        <div className="bp-footer" style={{ marginTop: 16 }}>
          <button
            className="bp-footer-btn"
            onClick={() => refreshVitals({})}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "🔄 Refresh"}
          </button>
          <button
            className="bp-footer-btn"
            onClick={() => sendFollowUpMessage("Analyze my current vitals and give me health recommendations based on my heart rate, HRV, and SpO2 levels.")}
          >
            Ask AI for Analysis →
          </button>
        </div>
      </div>
    </McpUseProvider>
  );
}
