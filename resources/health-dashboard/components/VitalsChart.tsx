import React, { useEffect, useState, useMemo } from "react";

/* ── constants ──────────────────────────────────────────────────────────── */
const W = 600;           // SVG viewBox width
const H = 180;           // SVG viewBox height
const PAD_TOP = 8;
const PAD_BOT = 24;
const WINDOW = 40;       // how many points visible at once
const INITIAL = 20;      // points visible on first render
const TICK_MS = 350;     // ms between new points

/* ── helpers ────────────────────────────────────────────────────────────── */
function buildPath(
  data: number[],
  minV: number,
  maxV: number,
  w: number,
  h: number
): string {
  if (data.length === 0) return "";
  const usableH = h - PAD_TOP - PAD_BOT;
  return data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * w;
      const y = PAD_TOP + usableH - ((v - minV) / (maxV - minV)) * usableH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildArea(path: string, w: number, h: number): string {
  if (!path) return "";
  return `${path} L${w},${h - PAD_BOT} L0,${h - PAD_BOT} Z`;
}

function formatTime(startISO: string, intervalMs: number, index: number): string {
  const d = new Date(new Date(startISO).getTime() + index * intervalMs);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ── component ──────────────────────────────────────────────────────────── */
interface VitalsChartProps {
  heartRate: number[];
  hrv: number[];
  startTime: string;
  intervalMs: number;
}

export const VitalsChart: React.FC<VitalsChartProps> = ({
  heartRate,
  hrv,
  startTime,
  intervalMs,
}) => {
  const total = heartRate.length;
  const [cursor, setCursor] = useState(INITIAL);

  useEffect(() => {
    const id = setInterval(() => {
      setCursor((c) => {
        if (c >= total) return INITIAL;   // loop
        return c + 1;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [total]);

  const windowStart = Math.max(0, cursor - WINDOW);
  const visHR = heartRate.slice(windowStart, cursor);
  const visHRV = hrv.slice(windowStart, cursor);

  const currentHR = visHR[visHR.length - 1] ?? 0;
  const currentHRV = visHRV[visHRV.length - 1] ?? 0;

  const hrMin = 35, hrMax = 100;
  const hrvMin = 30, hrvMax = 90;

  const hrPath = useMemo(() => buildPath(visHR, hrMin, hrMax, W, H), [visHR]);
  const hrvPath = useMemo(() => buildPath(visHRV, hrvMin, hrvMax, W, H), [visHRV]);

  const hrArea = useMemo(() => buildArea(hrPath, W, H), [hrPath]);
  const hrvArea = useMemo(() => buildArea(hrvPath, W, H), [hrvPath]);

  // last‐point coords for pulsing dot
  const lastX = W;
  const hrLastY = PAD_TOP + (H - PAD_TOP - PAD_BOT) - ((currentHR - hrMin) / (hrMax - hrMin)) * (H - PAD_TOP - PAD_BOT);
  const hrvLastY = PAD_TOP + (H - PAD_TOP - PAD_BOT) - ((currentHRV - hrvMin) / (hrvMax - hrvMin)) * (H - PAD_TOP - PAD_BOT);

  const timeLabel = formatTime(startTime, intervalMs, cursor - 1);

  return (
    <div className="vitals-chart-wrapper">
      {/* live readouts */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <span className="chart-label" style={{ color: "#00ff88" }}>♥ HEART RATE</span>
            <span className="chart-value" style={{ color: "#00ff88" }}>{currentHR} <small>bpm</small></span>
          </div>
          <div>
            <span className="chart-label" style={{ color: "#00ccff" }}>◇ HRV</span>
            <span className="chart-value" style={{ color: "#00ccff" }}>{currentHRV} <small>ms</small></span>
          </div>
        </div>
        <span className="chart-time">{timeLabel}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          {/* green glow for HR */}
          <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
          </linearGradient>
          {/* cyan glow for HRV */}
          <linearGradient id="hrvFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ccff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00ccff" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = PAD_TOP + (H - PAD_TOP - PAD_BOT) * (1 - frac);
          return (
            <line
              key={frac}
              x1={0} y1={y} x2={W} y2={y}
              stroke="#1e1e2e" strokeWidth="1" strokeDasharray="4 6"
            />
          );
        })}

        {/* area fills */}
        {hrArea && <path d={hrArea} fill="url(#hrFill)" />}
        {hrvArea && <path d={hrvArea} fill="url(#hrvFill)" />}

        {/* HR line */}
        {hrPath && (
          <path
            d={hrPath}
            fill="none"
            stroke="#00ff88"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#glow)"
          />
        )}

        {/* HRV line */}
        {hrvPath && (
          <path
            d={hrvPath}
            fill="none"
            stroke="#00ccff"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#glow)"
          />
        )}

        {/* pulsing dots at line tips */}
        {visHR.length > 1 && (
          <>
            <circle cx={lastX} cy={hrLastY} r="5" fill="#00ff88" opacity="0.5" className="pulse-dot" />
            <circle cx={lastX} cy={hrLastY} r="3" fill="#00ff88" />
          </>
        )}
        {visHRV.length > 1 && (
          <>
            <circle cx={lastX} cy={hrvLastY} r="5" fill="#00ccff" opacity="0.5" className="pulse-dot" />
            <circle cx={lastX} cy={hrvLastY} r="3" fill="#00ccff" />
          </>
        )}
      </svg>
    </div>
  );
};
