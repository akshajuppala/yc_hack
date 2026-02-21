import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import {
  McpUseProvider,
  useCallTool,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useState } from "react";
import { Link } from "react-router";
import "../styles.css";
import type { NutritionDashboardProps, FoodItem, Nutrition } from "./types";
import { propSchema } from "./types";

export const widgetMetadata: WidgetMetadata = {
  description: "Nutrition dashboard showing food tracking analysis and nutritional breakdown",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Loading dashboard...",
    invoked: "Dashboard ready",
  },
};

const categoryColors: Record<string, string> = {
  fruit: "bg-orange-500",
  vegetable: "bg-green-500",
  protein: "bg-red-500",
  dairy: "bg-blue-400",
  grain: "bg-amber-600",
  snack: "bg-purple-500",
  beverage: "bg-cyan-500",
  dessert: "bg-pink-500",
  meal: "bg-indigo-500",
};

const categoryIcons: Record<string, string> = {
  fruit: "🍎",
  vegetable: "🥬",
  protein: "🍗",
  dairy: "🥛",
  grain: "🍞",
  snack: "🍿",
  beverage: "🥤",
  dessert: "🍰",
  meal: "🍽️",
};

interface NutritionBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  unit?: string;
}

const NutritionBar: React.FC<NutritionBarProps> = ({ label, value, max, color, unit = "g" }) => {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-secondary">{label}</span>
        <span className="font-medium text-default">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const NutritionDashboard: React.FC = () => {
  const { props, isPending, theme, requestDisplayMode, displayMode } = useWidget<NutritionDashboardProps>();
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = useState<"overview" | "foods" | "breakdown">("overview");

  const { callTool: goToMenu } = useCallTool<Record<string, never>>("start_session");
  const { callTool: goToCamera } = useCallTool<Record<string, never>>("capture_food");
  const { callTool: clearSession, isPending: isClearing } = useCallTool<Record<string, never>>("clear_session");

  if (isPending) {
    return (
      <McpUseProvider>
        <div className="min-h-[500px] flex items-center justify-center bg-surface-elevated border border-default rounded-3xl">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 animate-pulse" />
            <p className="text-secondary">Loading dashboard...</p>
          </div>
        </div>
      </McpUseProvider>
    );
  }

  const { foods, totals, categoryBreakdown, itemCount } = props;
  const isFullscreen = displayMode === "fullscreen";

  const dailyTargets = {
    calories: 2000,
    protein: 50,
    carbs: 300,
    fat: 65,
    fiber: 25,
    sugar: 50,
  };

  const isEmpty = itemCount === 0;

  return (
    <McpUseProvider>
      <AppsSDKUIProvider linkComponent={Link}>
        <div className={`min-h-[550px] bg-surface-elevated border border-default rounded-3xl overflow-hidden ${isDark ? "dark" : ""}`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-bold text-lg">Nutrition Dashboard</h1>
                  <p className="text-white/70 text-xs">{itemCount} item{itemCount !== 1 ? "s" : ""} tracked</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isFullscreen && (
                  <button
                    onClick={() => requestDisplayMode("fullscreen")}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title="Fullscreen"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => goToMenu({})}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {isEmpty ? (
            /* Empty State */
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
                <svg className="w-10 h-10 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-default mb-2">No Food Tracked Yet</h2>
              <p className="text-secondary mb-6">Start scanning food items to see your nutritional analysis</p>
              <button
                onClick={() => goToCamera({})}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all cursor-pointer"
              >
                Scan Food Now
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-default">
                {(["overview", "foods", "breakdown"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-sm font-medium capitalize transition-colors cursor-pointer ${
                      activeTab === tab
                        ? "text-info border-b-2 border-info"
                        : "text-secondary hover:text-default"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-4">
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    {/* Calorie Summary Card */}
                    <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-5 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-white/70 text-sm">Total Calories</p>
                          <p className="text-4xl font-bold">{Math.round(totals.calories)}</p>
                        </div>
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                          <span className="text-2xl">🔥</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((totals.calories / dailyTargets.calories) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-white/70 text-xs mt-2">
                        {Math.round((totals.calories / dailyTargets.calories) * 100)}% of {dailyTargets.calories} daily target
                      </p>
                    </div>

                    {/* Macros Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-surface border border-default rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-blue-500">{totals.protein.toFixed(1)}g</p>
                        <p className="text-xs text-secondary">Protein</p>
                      </div>
                      <div className="bg-surface border border-default rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-amber-500">{totals.carbs.toFixed(1)}g</p>
                        <p className="text-xs text-secondary">Carbs</p>
                      </div>
                      <div className="bg-surface border border-default rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-red-500">{totals.fat.toFixed(1)}g</p>
                        <p className="text-xs text-secondary">Fat</p>
                      </div>
                    </div>

                    {/* Progress Bars */}
                    <div className="bg-surface border border-default rounded-xl p-4">
                      <h3 className="font-semibold text-default mb-4">Daily Progress</h3>
                      <NutritionBar label="Protein" value={totals.protein} max={dailyTargets.protein} color="bg-blue-500" />
                      <NutritionBar label="Carbs" value={totals.carbs} max={dailyTargets.carbs} color="bg-amber-500" />
                      <NutritionBar label="Fat" value={totals.fat} max={dailyTargets.fat} color="bg-red-500" />
                      <NutritionBar label="Fiber" value={totals.fiber} max={dailyTargets.fiber} color="bg-green-500" />
                      <NutritionBar label="Sugar" value={totals.sugar} max={dailyTargets.sugar} color="bg-pink-500" />
                    </div>
                  </div>
                )}

                {activeTab === "foods" && (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {foods.map((food, idx) => (
                      <div
                        key={food.id || idx}
                        className="bg-surface border border-default rounded-xl p-4 flex items-center gap-4"
                      >
                        <div className={`w-12 h-12 ${categoryColors[food.category] || "bg-gray-500"} rounded-xl flex items-center justify-center text-2xl`}>
                          {categoryIcons[food.category] || "🍽️"}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-default capitalize">{food.name}</p>
                          <p className="text-xs text-secondary capitalize">{food.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-default">{food.nutrition.calories} cal</p>
                          <p className="text-xs text-secondary">
                            P: {food.nutrition.protein}g · C: {food.nutrition.carbs}g · F: {food.nutrition.fat}g
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "breakdown" && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-default">Category Breakdown</h3>
                    <div className="space-y-3">
                      {Object.entries(categoryBreakdown).map(([category, count]: [string, number]) => (
                        <div key={category} className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${categoryColors[category] || "bg-gray-500"} rounded-lg flex items-center justify-center text-xl`}>
                            {categoryIcons[category] || "🍽️"}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="capitalize font-medium text-default">{category}</span>
                              <span className="text-secondary">{count} item{count !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="h-2 bg-surface rounded-full overflow-hidden">
                              <div
                                className={`h-full ${categoryColors[category] || "bg-gray-500"} rounded-full`}
                                style={{ width: `${(count / itemCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Macros Pie Chart Simulation */}
                    <div className="bg-surface border border-default rounded-xl p-4 mt-4">
                      <h3 className="font-semibold text-default mb-4">Macro Distribution</h3>
                      <div className="flex items-center justify-center gap-6">
                        <div className="relative w-32 h-32">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            {(() => {
                              const total = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
                              const proteinPct = total > 0 ? (totals.protein * 4 / total) * 100 : 33.33;
                              const carbsPct = total > 0 ? (totals.carbs * 4 / total) * 100 : 33.33;
                              const fatPct = total > 0 ? (totals.fat * 9 / total) * 100 : 33.34;
                              
                              return (
                                <>
                                  <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#3b82f6" strokeWidth="3"
                                    strokeDasharray={`${proteinPct} ${100 - proteinPct}`} strokeDashoffset="0" />
                                  <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#f59e0b" strokeWidth="3"
                                    strokeDasharray={`${carbsPct} ${100 - carbsPct}`} strokeDashoffset={`${-proteinPct}`} />
                                  <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#ef4444" strokeWidth="3"
                                    strokeDasharray={`${fatPct} ${100 - fatPct}`} strokeDashoffset={`${-(proteinPct + carbsPct)}`} />
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full" />
                            <span className="text-sm text-secondary">Protein</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-500 rounded-full" />
                            <span className="text-sm text-secondary">Carbs</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full" />
                            <span className="text-sm text-secondary">Fat</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-default flex gap-3">
                <button
                  onClick={() => goToCamera({})}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all cursor-pointer"
                >
                  Add More Food
                </button>
                <button
                  onClick={() => clearSession({})}
                  disabled={isClearing}
                  className="px-4 py-3 border border-default hover:bg-surface text-secondary rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isClearing ? "..." : "Clear"}
                </button>
              </div>
            </>
          )}
        </div>
      </AppsSDKUIProvider>
    </McpUseProvider>
  );
};

export default NutritionDashboard;
