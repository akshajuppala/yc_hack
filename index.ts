import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MCPServer, object, text, widget, error } from "mcp-use/server";
import { z } from "zod";

// ── helpers ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");

function load<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf-8")) as T;
}

// ── server ───────────────────────────────────────────────────────────────────
const server = new MCPServer({
  name: "health-optimizer-mcp",
  title: "Blueprint Health Optimizer",
  version: "1.0.0",
  description:
    "Real-time health optimization dashboard — smart watch vitals, smart glasses camera detection, supplement protocol tracking. Bryan Johnson Blueprint inspired.",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  favicon: "favicon.ico",
  websiteUrl: "https://manufact.com",
  icons: [
    { src: "icon.svg", mimeType: "image/svg+xml", sizes: ["512x512"] },
  ],
});

// ── Tool 1: Health Dashboard (visual widget) ─────────────────────────────────
server.tool(
  {
    name: "health-dashboard",
    description:
      "Show the real-time health optimization dashboard with animated vital signs chart, camera supplement detection feed, and protocol checklist. Opens as an interactive widget.",
    schema: z.object({
      view: z
        .enum(["live", "morning", "full_day"])
        .optional()
        .default("live")
        .describe("Dashboard view mode"),
    }),
    widget: {
      name: "health-dashboard",
      invoking: "Loading health data…",
      invoked: "Dashboard streaming",
    },
  },
  async ({ view }) => {
    try {
      const vitals = load<any>("vitals-stream.json");
      const camera = load<any>("camera-events.json");
      const protocol = load<any>("protocol-log.json");
      const nutrition = load<any>("nutrition-log.json");

      const takenCount = protocol.protocol.filter(
        (p: any) => p.status === "taken"
      ).length;
      const totalCount = protocol.protocol.filter(
        (p: any) => p.status !== "weekly_skip"
      ).length;
      const adherenceScore = Math.round((takenCount / totalCount) * 100);

      const latestHR =
        vitals.signals.heart_rate.values[
          vitals.signals.heart_rate.values.length - 1
        ];
      const latestHRV =
        vitals.signals.hrv.values[vitals.signals.hrv.values.length - 1];

      const caloriesConsumed = nutrition.meals
        .filter((m: any) => m.status === "consumed")
        .reduce((s: number, m: any) => s + m.calories, 0);

      return widget({
        props: {
          view,
          vitals: {
            startTime: vitals.startTime,
            intervalMs: vitals.intervalMs,
            heartRate: vitals.signals.heart_rate.values,
            hrv: vitals.signals.hrv.values,
            spo2: vitals.signals.spo2.values,
            skinTemp: vitals.signals.skin_temp.values,
          },
          cameraEvents: camera.events,
          protocol: protocol.protocol,
          nutrition: {
            targetCalories: nutrition.targetCalories,
            targetMacros: nutrition.targetMacros,
            meals: nutrition.meals,
          },
          profileName: protocol.profile,
          date: protocol.date,
          summary: {
            adherenceScore,
            takenCount,
            totalCount,
            latestHR,
            latestHRV,
            caloriesConsumed,
            caloriesTarget: nutrition.targetCalories,
          },
        },
        output: text(
          `Blueprint Health Dashboard — ${view} view. Adherence: ${adherenceScore}% (${takenCount}/${totalCount}). Latest HR: ${latestHR} bpm, HRV: ${latestHRV} ms. Calories: ${caloriesConsumed}/${nutrition.targetCalories} kcal.`
        ),
      });
    } catch (e) {
      return error(
        `Dashboard error: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
);

// ── Tool 2: Vitals Stream (JSON) ────────────────────────────────────────────
server.tool(
  {
    name: "get-vitals",
    description:
      "Return raw smart-watch vital signs time-series (heart rate, HRV, SpO2, skin temp) as structured JSON",
    schema: z.object({
      signal: z
        .enum(["all", "heart_rate", "hrv", "spo2", "skin_temp"])
        .optional()
        .default("all")
        .describe("Which signal to return"),
      last: z
        .number()
        .optional()
        .default(0)
        .describe("Return only last N data points (0 = all)"),
    }),
  },
  async ({ signal, last }) => {
    try {
      const vitals = load<any>("vitals-stream.json");
      const result: any = {
        source: vitals.source,
        startTime: vitals.startTime,
        intervalMs: vitals.intervalMs,
        signals: {} as any,
      };
      const keys =
        signal === "all"
          ? Object.keys(vitals.signals)
          : [signal];
      for (const k of keys) {
        const sig = vitals.signals[k];
        const vals =
          last > 0 ? sig.values.slice(-last) : sig.values;
        result.signals[k] = { unit: sig.unit, label: sig.label, values: vals };
      }
      return object(result);
    } catch (e) {
      return error(String(e));
    }
  }
);

// ── Tool 3: Camera Events (JSON) ────────────────────────────────────────────
server.tool(
  {
    name: "get-camera-events",
    description:
      "Return smart-glasses camera detection events (supplements, meals, activities) as structured JSON",
    schema: z.object({
      type: z
        .enum(["all", "supplement", "meal", "activity"])
        .optional()
        .default("all")
        .describe("Filter by event type"),
    }),
  },
  async ({ type }) => {
    try {
      const camera = load<any>("camera-events.json");
      const events =
        type === "all"
          ? camera.events
          : camera.events.filter((e: any) => e.type === type);
      return object({ source: camera.source, date: camera.date, events });
    } catch (e) {
      return error(String(e));
    }
  }
);

// ── start ────────────────────────────────────────────────────────────────────
server.listen().then(() => {
  console.log("Blueprint Health Optimizer — MCP server running");
});
