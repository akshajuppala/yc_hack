import React, { useEffect, useState } from "react";

/* ── types ──────────────────────────────────────────────────────────────── */
interface ProtocolItem {
  name: string;
  dose: string;
  scheduledTime: string;
  actualTime: string | null;
  status: string;
  detectedBy: string | null;
  category: string;
  note?: string;
}

interface ProtocolListProps {
  items: ProtocolItem[];
}

/* ── helpers ────────────────────────────────────────────────────────────── */
const statusConfig: Record<string, { icon: string; color: string; label: string }> = {
  taken:       { icon: "\u2714", color: "#00ff88", label: "Taken" },
  pending:     { icon: "\u25CB", color: "#666",    label: "Pending" },
  missed:      { icon: "\u2718", color: "#ff4466", label: "Missed" },
  weekly_skip: { icon: "\u2014", color: "#555",    label: "Skip" },
};

/* ── component ──────────────────────────────────────────────────────────── */
export const ProtocolList: React.FC<ProtocolListProps> = ({ items }) => {
  // Animate: reveal items one at a time
  const [visCount, setVisCount] = useState(1);

  useEffect(() => {
    const id = setInterval(() => {
      setVisCount((c) => {
        if (c >= items.length) return items.length; // stay
        return c + 1;
      });
    }, 800);
    return () => clearInterval(id);
  }, [items.length]);

  // Sort: taken first, then pending, missed, weekly_skip
  const order = ["taken", "missed", "pending", "weekly_skip"];
  const sorted = [...items].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status)
  );

  const visible = sorted.slice(0, visCount);

  const takenCount = items.filter((i) => i.status === "taken").length;
  const totalActive = items.filter((i) => i.status !== "weekly_skip").length;

  return (
    <div className="protocol-list">
      <div className="protocol-header">
        <span className="protocol-title">\uD83D\uDCCB PROTOCOL</span>
        <span className="protocol-score">
          {takenCount}/{totalActive}
        </span>
      </div>

      <div className="protocol-items">
        {visible.map((item, i) => {
          const cfg = statusConfig[item.status] ?? statusConfig.pending;
          const isNew = i === visCount - 1 && visCount <= items.length;
          return (
            <div
              key={item.name}
              className={`protocol-item ${isNew ? "protocol-item-new" : ""}`}
            >
              <span className="protocol-icon" style={{ color: cfg.color }}>
                {cfg.icon}
              </span>
              <div className="protocol-body">
                <div className="protocol-name">{item.name}</div>
                <div className="protocol-detail">
                  {item.dose}
                  {item.actualTime && (
                    <span className="protocol-time">
                      {" "}· {item.actualTime}
                    </span>
                  )}
                  {!item.actualTime && item.status === "pending" && (
                    <span className="protocol-time">
                      {" "}· sched {item.scheduledTime}
                    </span>
                  )}
                  {item.detectedBy && (
                    <span className="protocol-source">
                      {" "}· {item.detectedBy === "camera" ? "\uD83D\uDCF7" : "\u231A"}
                    </span>
                  )}
                </div>
                {item.note && (
                  <div className="protocol-note">{item.note}</div>
                )}
              </div>
              <span className="protocol-badge" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
