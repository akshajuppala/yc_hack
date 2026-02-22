import {
  McpUseProvider,
  useWidget,
  useCallTool,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useState } from "react";
import { z } from "zod";
import "../styles.css";

const propsSchema = z.object({
  totalActions: z.number(),
  supplementsTaken: z.array(z.string()),
  items: z.array(z.object({
    id: z.string(),
    action_type: z.string(),
    title: z.string(),
    description: z.string(),
    timestamp: z.string(),
    macros: z.object({
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      fiber_g: z.number().optional(),
      water_ml: z.number().optional(),
    }),
    status: z.string(),
  })),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Health protocol log showing all detected activities: supplements, food, hydration, and exercise",
  props: propsSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Loading health log...",
    invoked: "Health log ready",
  },
};

type Props = z.infer<typeof propsSchema>;

const actionIcons: Record<string, string> = {
  food: "🍎",
  supplement: "💊",
  hydration: "💧",
  exercise: "🏃",
};

const actionColors: Record<string, string> = {
  food: "#ffaa00",
  supplement: "#a78bfa",
  hydration: "#00ccff",
  exercise: "#ff6b6b",
};

const ProtocolSkeleton: React.FC = () => (
  <McpUseProvider>
    <div className="bp-root" style={{ padding: 16 }}>
      <div className="bp-skel" style={{ height: 22, width: 180, marginBottom: 16 }} />
      <div className="bp-skel" style={{ height: 50, borderRadius: 10, marginBottom: 16 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bp-skel" style={{ height: 60, borderRadius: 10 }} />
        ))}
      </div>
    </div>
  </McpUseProvider>
);

export default function ProtocolWidget() {
  const { props, isPending, sendFollowUpMessage } = useWidget<Props>();
  const { callTool: resetAgent, isPending: isResetting } = useCallTool("reset-agent-state");
  const [filter, setFilter] = useState<string>("all");

  if (isPending) return <ProtocolSkeleton />;

  const { totalActions, supplementsTaken, items } = props;

  const filteredItems = filter === "all" ? items : items.filter(item => item.action_type === filter);

  const actionCounts = {
    food: items.filter(i => i.action_type === "food").length,
    supplement: items.filter(i => i.action_type === "supplement").length,
    hydration: items.filter(i => i.action_type === "hydration").length,
    exercise: items.filter(i => i.action_type === "exercise").length,
  };

  return (
    <McpUseProvider>
      <div className="bp-root" style={{ padding: 16 }}>
        <div className="protocol-list">
          <div className="protocol-header" style={{ marginBottom: 16 }}>
            <span className="protocol-title">📋 HEALTH LOG</span>
            <span className="protocol-count">{totalActions} actions</span>
          </div>

          {/* Filter buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button
              onClick={() => setFilter("all")}
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                border: "none",
                background: filter === "all" ? "#00ff88" : "#1a1a2e",
                color: filter === "all" ? "#000" : "#888",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              All ({totalActions})
            </button>
            {Object.entries(actionCounts).map(([type, count]) => (
              count > 0 && (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 16,
                    border: "none",
                    background: filter === type ? actionColors[type] : "#1a1a2e",
                    color: filter === type ? "#000" : "#888",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {actionIcons[type]} {type} ({count})
                </button>
              )
            ))}
          </div>

          {/* Supplements Summary */}
          {supplementsTaken.length > 0 && filter === "all" && (
            <div style={{
              padding: 12,
              background: "#0e0e18",
              borderRadius: 10,
              border: "1px solid rgba(167,139,250,0.2)",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>💊</span>
              <span style={{ fontSize: 12, color: "#a78bfa" }}>{supplementsTaken.join(", ")}</span>
            </div>
          )}

          {/* Items List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 350, overflowY: "auto" }}>
            {filteredItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👁️</div>
                <div>No {filter === "all" ? "health actions" : filter} logged yet</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Take supplements, eat food, drink water, or exercise</div>
              </div>
            ) : (
              filteredItems.slice().reverse().map((item) => {
                const time = new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const icon = actionIcons[item.action_type] || "✅";
                const color = actionColors[item.action_type] || "#666";
                const cals = item.macros.calories;
                const calText = cals !== 0 ? ` · ${cals > 0 ? "+" : ""}${cals} kcal` : "";
                
                let macroText = "";
                if (item.action_type === "food" && item.macros.protein_g > 0) {
                  macroText = ` · P:${item.macros.protein_g.toFixed(0)}g C:${item.macros.carbs_g.toFixed(0)}g F:${item.macros.fat_g.toFixed(0)}g`;
                }
                
                return (
                  <div key={item.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: "#0e0e18",
                    borderRadius: 10,
                    borderLeft: `3px solid ${color}`,
                  }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                      <div style={{ fontSize: 10, color: "#666" }}>
                        {time}{calText}{macroText}
                      </div>
                      {item.description && item.description !== item.title && (
                        <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{item.description}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: `${color}20`,
                      color: color,
                    }}>
                      {item.action_type}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bp-footer" style={{ marginTop: 16 }}>
          <button
            className="bp-footer-btn"
            onClick={() => resetAgent({})}
            disabled={isResetting}
            style={{ background: "rgba(255,68,102,0.1)", color: "#ff4466", border: "1px solid #ff446640" }}
          >
            {isResetting ? "Resetting..." : "🗑️ Clear Log"}
          </button>
          <button
            className="bp-footer-btn"
            onClick={() => sendFollowUpMessage(`I've completed ${totalActions} health actions today: ${supplementsTaken.length} supplements, ${actionCounts.food} food items, ${actionCounts.hydration} hydration events, ${actionCounts.exercise} exercises. How am I doing with my health protocol? Any recommendations?`)}
          >
            Ask AI for Analysis →
          </button>
        </div>
      </div>
    </McpUseProvider>
  );
}
