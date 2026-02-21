import React, { useEffect, useState } from "react";

/* ── types ──────────────────────────────────────────────────────────────── */
interface MacroTarget {
  target: number;
  unit: string;
}

interface Meal {
  id: number;
  name: string;
  time: string;
  calories: number;
  macros: { protein: number; fat: number; carbs: number; fiber: number };
  status: string;
  detectedBy: string | null;
}

interface CaloriesTrackerProps {
  targetCalories: number;
  targetMacros: {
    protein: MacroTarget;
    fat: MacroTarget;
    carbs: MacroTarget;
    fiber: MacroTarget;
  };
  meals: Meal[];
}

/* ── helpers ────────────────────────────────────────────────────────────── */
const macroColors: Record<string, string> = {
  protein: "#00ff88",
  fat: "#ffaa00",
  carbs: "#00ccff",
  fiber: "#a78bfa",
};

/* ── component ──────────────────────────────────────────────────────────── */
export const CaloriesTracker: React.FC<CaloriesTrackerProps> = ({
  targetCalories,
  targetMacros,
  meals,
}) => {
  const consumed = meals.filter((m) => m.status === "consumed");
  const calConsumed = consumed.reduce((s, m) => s + m.calories, 0);
  const calPct = Math.min(Math.round((calConsumed / targetCalories) * 100), 100);

  // aggregate macros consumed
  const macroConsumed = consumed.reduce(
    (acc, m) => ({
      protein: acc.protein + m.macros.protein,
      fat: acc.fat + m.macros.fat,
      carbs: acc.carbs + m.macros.carbs,
      fiber: acc.fiber + m.macros.fiber,
    }),
    { protein: 0, fat: 0, carbs: 0, fiber: 0 }
  );

  // animate reveal for meals
  const [visCount, setVisCount] = useState(1);
  useEffect(() => {
    const id = setInterval(() => {
      setVisCount((c) => (c >= meals.length ? meals.length : c + 1));
    }, 900);
    return () => clearInterval(id);
  }, [meals.length]);

  // calorie ring SVG
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - (calPct / 100) * circ;
  const ringColor = calPct >= 80 ? "#00ff88" : calPct >= 40 ? "#ffaa00" : "#555";

  return (
    <div className="cal-tracker">
      <div className="cal-header">
        <span className="cal-title">{"\uD83D\uDD25"} CALORIES</span>
        <span className="cal-count" style={{ color: ringColor }}>
          {calConsumed} / {targetCalories}
        </span>
      </div>

      {/* Ring + Macros side-by-side */}
      <div className="cal-top">
        {/* Ring */}
        <svg width="80" height="80" className="cal-ring">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#1a1a2e" strokeWidth="7" />
          <circle
            cx="40" cy="40" r={r}
            fill="none" stroke={ringColor} strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            transform="rotate(-90 40 40)"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
          <text x="40" y="38" textAnchor="middle" fill="#ddd" fontSize="16" fontWeight="bold">
            {calPct}%
          </text>
          <text x="40" y="52" textAnchor="middle" fill="#555" fontSize="8">
            kcal
          </text>
        </svg>

        {/* Macro bars */}
        <div className="cal-macros">
          {(["protein", "fat", "carbs", "fiber"] as const).map((key) => {
            const consumed = macroConsumed[key];
            const target = targetMacros[key].target;
            const pct = Math.min(Math.round((consumed / target) * 100), 100);
            return (
              <div key={key} className="cal-macro-row">
                <div className="cal-macro-label">
                  <span className="cal-macro-dot" style={{ background: macroColors[key] }} />
                  <span>{key}</span>
                </div>
                <div className="cal-macro-bar-bg">
                  <div
                    className="cal-macro-bar-fill"
                    style={{ width: `${pct}%`, background: macroColors[key] }}
                  />
                </div>
                <span className="cal-macro-num">
                  {consumed}/{target}{targetMacros[key].unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Meal list */}
      <div className="cal-meals">
        {meals.slice(0, visCount).map((meal) => {
          const isConsumed = meal.status === "consumed";
          return (
            <div
              key={meal.id}
              className={`cal-meal ${isConsumed ? "" : "cal-meal-pending"}`}
            >
              <span className="cal-meal-icon">
                {isConsumed ? "\u2714" : "\u25CB"}
              </span>
              <div className="cal-meal-body">
                <span className="cal-meal-name">{meal.name}</span>
                <span className="cal-meal-meta">
                  {meal.time} · {meal.calories} kcal
                  {meal.detectedBy && ` · \uD83D\uDCF7`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
