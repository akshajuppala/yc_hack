import React from "react";

interface NutritionDisplayProps {
  caloriesConsumed: number;
  caloriesBurned: number;
  netCalories: number;
  targetCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl?: number;
  compact?: boolean;
}

const MacroBar: React.FC<{ label: string; value: number; max: number; color: string; unit: string }> = ({
  label, value, max, color, unit,
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

export const NutritionDisplay: React.FC<NutritionDisplayProps> = ({
  caloriesConsumed,
  caloriesBurned,
  netCalories,
  targetCalories,
  protein,
  carbs,
  fat,
  fiber,
  waterMl,
  compact = false,
}) => {
  const calorieProgress = targetCalories > 0 ? (netCalories / targetCalories) * 100 : 0;
  const calorieColor = calorieProgress > 120 ? "#ff4466" : calorieProgress > 90 ? "#ffaa00" : "#00ff88";

  if (compact) {
    return (
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#666" }}>NET</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: calorieColor }}>{netCalories}</div>
          <div style={{ fontSize: 9, color: "#666" }}>/ {targetCalories}</div>
        </div>
        <div style={{ flex: 1 }}>
          <MacroBar label="P" value={protein} max={150} color="#00ff88" unit="g" />
          <MacroBar label="C" value={carbs} max={300} color="#ffaa00" unit="g" />
          <MacroBar label="F" value={fat} max={80} color="#ff6b6b" unit="g" />
        </div>
      </div>
    );
  }

  return (
    <div className="nutrition-dashboard">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <div className="calorie-card">
          <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>🍎 CONSUMED</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#ffaa00" }}>+{caloriesConsumed}</div>
          <div style={{ fontSize: 10, color: "#666" }}>kcal</div>
        </div>
        <div className="calorie-card">
          <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>🔥 BURNED</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#ff6b6b" }}>-{caloriesBurned}</div>
          <div style={{ fontSize: 10, color: "#666" }}>kcal</div>
        </div>
        <div className="calorie-card" style={{ border: `1px solid ${calorieColor}40` }}>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>⚡ NET</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: calorieColor }}>{netCalories}</div>
          <div style={{ fontSize: 10, color: "#666" }}>/ {targetCalories} kcal</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        <MacroBar label="Protein" value={protein} max={150} color="#00ff88" unit="g" />
        <MacroBar label="Carbs" value={carbs} max={300} color="#ffaa00" unit="g" />
        <MacroBar label="Fat" value={fat} max={80} color="#ff6b6b" unit="g" />
        <MacroBar label="Fiber" value={fiber} max={30} color="#a78bfa" unit="g" />
      </div>

      {waterMl !== undefined && waterMl > 0 && (
        <div className="hydration-tracker">
          <span className="hydration-icon">💧</span>
          <span className="hydration-value">{waterMl} ml</span>
          <span className="hydration-label">hydration</span>
        </div>
      )}
    </div>
  );
};

export default NutritionDisplay;
