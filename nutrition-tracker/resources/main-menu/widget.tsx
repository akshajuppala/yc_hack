import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import {
  McpUseProvider,
  useCallTool,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React from "react";
import { Link } from "react-router";
import "../styles.css";
import type { MainMenuProps } from "./types";
import { propSchema } from "./types";

export const widgetMetadata: WidgetMetadata = {
  description: "Main menu for NutriScan - choose to scan food or view dashboard",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Starting NutriScan...",
    invoked: "NutriScan ready",
  },
};

const MainMenu: React.FC = () => {
  const { props, isPending, theme } = useWidget<MainMenuProps>();
  const isDark = theme === "dark";

  const { callTool: openCamera, isPending: isCameraLoading } = useCallTool<Record<string, never>>("capture_food");
  const { callTool: openDashboard, isPending: isDashboardLoading } = useCallTool<Record<string, never>>("get_nutrition_dashboard");

  if (isPending) {
    return (
      <McpUseProvider>
        <div className="min-h-[400px] flex items-center justify-center bg-surface-elevated border border-default rounded-3xl">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-info/20 animate-pulse" />
            <p className="text-secondary">Loading NutriScan...</p>
          </div>
        </div>
      </McpUseProvider>
    );
  }

  const { foodCount, lastFood } = props;

  return (
    <McpUseProvider>
      <AppsSDKUIProvider linkComponent={Link}>
        <div className={`min-h-[450px] bg-surface-elevated border border-default rounded-3xl overflow-hidden ${isDark ? "dark" : ""}`}>
          {/* Header */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold">NutriScan</h1>
                <p className="text-white/80 text-sm">Healthcare Food Tracker</p>
              </div>
            </div>
          </div>

          {/* Session Status */}
          {foodCount > 0 && (
            <div className="mx-6 -mt-4 relative z-10">
              <div className="bg-surface border border-default rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-secondary uppercase tracking-wide">Current Session</p>
                    <p className="font-semibold text-default">{foodCount} item{foodCount !== 1 ? "s" : ""} tracked</p>
                  </div>
                  {lastFood && (
                    <div className="text-right">
                      <p className="text-xs text-secondary">Last scanned</p>
                      <p className="text-sm font-medium text-info capitalize">{lastFood}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main Options */}
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-default mb-4">What would you like to do?</h2>

            {/* Scan Food Option */}
            <button
              onClick={() => openCamera({})}
              disabled={isCameraLoading}
              className="w-full p-5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-2xl text-white text-left transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Scan Food</h3>
                  <p className="text-white/80 text-sm">Use your camera to identify and track food items</p>
                </div>
                {isCameraLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </button>

            {/* View Dashboard Option */}
            <button
              onClick={() => openDashboard({})}
              disabled={isDashboardLoading}
              className="w-full p-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-2xl text-white text-left transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">View Dashboard</h3>
                  <p className="text-white/80 text-sm">See your nutritional analysis and food history</p>
                </div>
                {isDashboardLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </button>

            {/* Info Text */}
            <p className="text-center text-xs text-secondary pt-2">
              Point your camera at food to automatically identify and track nutrition
            </p>
          </div>
        </div>
      </AppsSDKUIProvider>
    </McpUseProvider>
  );
};

export default MainMenu;
