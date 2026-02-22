import {
  McpUseProvider,
  useWidget,
  useCallTool,
  type WidgetMetadata,
} from "mcp-use/react";
import React from "react";
import { z } from "zod";
import "../styles.css";

const propsSchema = z.object({
  caloriesConsumed: z.number(),
  caloriesBurned: z.number(),
  netCalories: z.number(),
  targetCalories: z.number(),
  macros: z.object({
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
    fiber_g: z.number(),
    sugar_g: z.number().optional(),
    water_ml: z.number().optional(),
  }),
  targetMacros: z.object({
    protein: z.number().optional(),
    carbs: z.number().optional(),
    fat: z.number().optional(),
    fiber: z.number().optional(),
  }).optional(),
  meals: z.array(z.object({
    id: z.string(),
    title: z.string(),
    timestamp: z.string(),
    calories: z.number(),
    macros: z.object({
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
    }),
  })).optional(),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Nutrition tracking dashboard showing calories, macros, and meal history",
  props: propsSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Loading nutrition data...",
    invoked: "Nutrition tracker ready",
  },
};

type Props = z.infer<typeof propsSchema>;

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

const NutritionSkeleton: React.FC = () => (
  <McpUseProvider>
    <div className="bp-root" style={{ padding: 16 }}>
      <div className="bp-skel" style={{ height: 22, width: 200, marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bp-skel" style={{ height: 80, borderRadius: 12 }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bp-skel" style={{ height: 36, borderRadius: 8 }} />
        ))}
      </div>
    </div>
  </McpUseProvider>
);

export default function NutritionWidget() {
  const { props, isPending, sendFollowUpMessage } = useWidget<Props>();
  const { callTool: refreshProtocol, isPending: isRefreshing } = useCallTool("get-protocol");

  if (isPending) return <NutritionSkeleton />;

  const {
    caloriesConsumed,
    caloriesBurned,
    netCalories,
    targetCalories,
    macros,
    targetMacros,
    meals,
  } = props;

  const calorieProgress = targetCalories > 0 ? (netCalories / targetCalories) * 100 : 0;
  const calorieColor = calorieProgress > 120 ? "#ff4466" : calorieProgress > 90 ? "#ffaa00" : "#00ff88";

  const proteinTarget = targetMacros?.protein || 150;
  const carbsTarget = targetMacros?.carbs || 300;
  const fatTarget = targetMacros?.fat || 80;
  const fiberTarget = targetMacros?.fiber || 30;

  return (
    <McpUseProvider>
      <div className="bp-root" style={{ padding: 16 }}>
        <div className="nutrition-dashboard">
          <div className="nutrition-header" style={{ marginBottom: 16 }}>
            <span className="nutrition-title">📊 NUTRITION TRACKER</span>
            <button
              className="webcam-analyze-btn"
              onClick={() => refreshProtocol({})}
              disabled={isRefreshing}
              style={{ padding: "4px 12px", fontSize: 10 }}
            >
              {isRefreshing ? "..." : "🔄"}
            </button>
          </div>

          {/* Calorie Summary */}
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

          {/* Calorie Progress Bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
              <span style={{ color: "#888" }}>Daily Progress</span>
              <span style={{ color: calorieColor, fontWeight: 600 }}>{calorieProgress.toFixed(0)}%</span>
            </div>
            <div style={{ height: 10, background: "#1a1a2e", borderRadius: 5, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(calorieProgress, 100)}%`,
                background: `linear-gradient(90deg, ${calorieColor}, ${calorieColor}aa)`,
                borderRadius: 5,
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>

          {/* Macro Bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            <MacroBar label="Protein" value={macros.protein_g} max={proteinTarget} color="#00ff88" unit="g" />
            <MacroBar label="Carbs" value={macros.carbs_g} max={carbsTarget} color="#ffaa00" unit="g" />
            <MacroBar label="Fat" value={macros.fat_g} max={fatTarget} color="#ff6b6b" unit="g" />
            <MacroBar label="Fiber" value={macros.fiber_g} max={fiberTarget} color="#a78bfa" unit="g" />
          </div>

          {/* Hydration */}
          {macros.water_ml !== undefined && macros.water_ml > 0 && (
            <div style={{
              padding: 12,
              background: "#0e0e18",
              borderRadius: 10,
              border: "1px solid rgba(0,204,255,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 20 }}>💧</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#00ccff" }}>{macros.water_ml} ml</span>
              <span style={{ fontSize: 11, color: "#666" }}>hydration</span>
            </div>
          )}

          {/* Recent Meals */}
          {meals && meals.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#888", marginBottom: 8 }}>🍽️ RECENT MEALS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 150, overflowY: "auto" }}>
                {meals.slice().reverse().slice(0, 5).map((meal) => (
                  <div key={meal.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    background: "#0e0e18",
                    borderRadius: 10,
                    borderLeft: "3px solid #ffaa00",
                  }}>
                    <span style={{ fontSize: 16 }}>🍎</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{meal.title}</div>
                      <div style={{ fontSize: 10, color: "#666" }}>
                        {new Date(meal.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · +{meal.calories} kcal · P:{meal.macros.protein_g.toFixed(0)}g
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bp-footer" style={{ marginTop: 16 }}>
          <button
            className="bp-footer-btn"
            onClick={() => sendFollowUpMessage(`Based on my nutrition data (${netCalories}/${targetCalories} kcal, ${macros.protein_g.toFixed(0)}g protein, ${macros.carbs_g.toFixed(0)}g carbs, ${macros.fat_g.toFixed(0)}g fat), what should I eat for my next meal to meet my macro goals?`)}
          >
            Ask AI for Meal Suggestions →
          </button>
        </div>
      </div>
    </McpUseProvider>
  );
}
