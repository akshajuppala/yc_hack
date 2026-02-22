import React from "react";

interface ProtocolItem {
  id: string;
  action_type: string;
  title: string;
  description?: string;
  timestamp: string;
  macros: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  status: string;
}

interface ProtocolDisplayProps {
  totalActions: number;
  supplementsTaken: string[];
  items: ProtocolItem[];
  maxItems?: number;
  showFilters?: boolean;
}

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

export const ProtocolDisplay: React.FC<ProtocolDisplayProps> = ({
  totalActions,
  supplementsTaken,
  items,
  maxItems = 10,
  showFilters = false,
}) => {
  const [filter, setFilter] = React.useState<string>("all");
  
  const filteredItems = filter === "all" ? items : items.filter(item => item.action_type === filter);
  const displayItems = filteredItems.slice().reverse().slice(0, maxItems);

  const actionCounts = {
    food: items.filter(i => i.action_type === "food").length,
    supplement: items.filter(i => i.action_type === "supplement").length,
    hydration: items.filter(i => i.action_type === "hydration").length,
    exercise: items.filter(i => i.action_type === "exercise").length,
  };

  return (
    <div className="protocol-list">
      <div className="protocol-header" style={{ marginBottom: 12 }}>
        <span className="protocol-title">📋 HEALTH LOG</span>
        <span className="protocol-count">{totalActions} actions</span>
      </div>

      {showFilters && totalActions > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "4px 10px",
              borderRadius: 12,
              border: "none",
              background: filter === "all" ? "#00ff88" : "#1a1a2e",
              color: filter === "all" ? "#000" : "#888",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            All
          </button>
          {Object.entries(actionCounts).map(([type, count]) => (
            count > 0 && (
              <button
                key={type}
                onClick={() => setFilter(type)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 12,
                  border: "none",
                  background: filter === type ? actionColors[type] : "#1a1a2e",
                  color: filter === type ? "#000" : "#888",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {actionIcons[type]} {count}
              </button>
            )
          ))}
        </div>
      )}

      {supplementsTaken.length > 0 && filter === "all" && (
        <div className="supplements-summary">
          <span className="supplements-icon">💊</span>
          <span className="supplements-text">{supplementsTaken.join(", ")}</span>
        </div>
      )}

      <div className="protocol-items">
        {displayItems.length === 0 ? (
          <div className="protocol-empty">
            <span className="protocol-empty-icon">👁️</span>
            <span className="protocol-empty-text">No health actions yet</span>
            <span className="protocol-empty-hint">Take supplements, eat food, drink water, or exercise</span>
          </div>
        ) : (
          displayItems.map((item) => {
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
          })
        )}
      </div>
    </div>
  );
};

export default ProtocolDisplay;
