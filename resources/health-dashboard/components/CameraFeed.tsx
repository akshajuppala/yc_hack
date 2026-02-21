import React from "react";

/* ── types ──────────────────────────────────────────────────────────────── */
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

interface CameraFeedProps {
  events: CameraEvent[];
}

/* ── helpers ────────────────────────────────────────────────────────────── */
const typeColor: Record<string, string> = {
  supplement: "#00ff88",
  meal: "#ffaa00",
  activity: "#00ccff",
};

const typeIcon: Record<string, string> = {
  supplement: "\uD83D\uDC8A",   // pill
  meal: "\uD83C\uDF4E",          // apple
  activity: "\u26A1",            // lightning
};

function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* ── component ──────────────────────────────────────────────────────────── */
export const CameraFeed: React.FC<CameraFeedProps> = ({ events }) => {
  // Show all confirmed events (newest first)
  const confirmed = events.filter((e) => e.status === "confirmed");

  return (
    <div className="camera-feed">
      <div className="camera-header">
        <span className="camera-title">{"\uD83D\uDCF7"} DETECTIONS</span>
        <span className="camera-badge">
          {confirmed.length > 0 ? (
            <>
              <span className="rec-dot" /> {confirmed.length} items
            </>
          ) : (
            <span style={{ color: "#666" }}>Waiting...</span>
          )}
        </span>
      </div>

      <div className="camera-events">
        {confirmed.length === 0 ? (
          <div className="camera-empty">
            <span className="camera-empty-icon">👁️</span>
            <span className="camera-empty-text">No items detected yet</span>
            <span className="camera-empty-hint">Point camera at supplements, food, or activities</span>
          </div>
        ) : (
          confirmed.map((ev, i) => {
            const color = typeColor[ev.type] ?? "#888";
            const icon = ev.icon || typeIcon[ev.type] || "\u2022";
            const isLatest = i === 0;
            return (
              <div
                key={ev.id}
                className={`camera-event ${isLatest ? "camera-event-new" : ""}`}
                style={{ "--accent": color } as React.CSSProperties}
              >
                <span className="camera-event-icon">{icon}</span>
                <div className="camera-event-body">
                  <div className="camera-event-row">
                    <span className="camera-event-item">{ev.item}</span>
                    {ev.dose && (
                      <span className="camera-event-dose">{ev.dose}</span>
                    )}
                  </div>
                  <div className="camera-event-meta">
                    <span className="camera-event-time">{fmtTime(ev.timestamp)}</span>
                    <span
                      className="camera-event-confidence"
                      style={{ color }}
                    >
                      {Math.round(ev.confidence * 100)}% conf
                    </span>
                  </div>
                </div>
                <div className="camera-conf-bar">
                  <div
                    className="camera-conf-fill"
                    style={{
                      width: `${Math.round(ev.confidence * 100)}%`,
                      background: color,
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
