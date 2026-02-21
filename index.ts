import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MCPServer, object, text, widget, error, oauthWorkOSProvider } from "mcp-use/server";
import { z } from "zod";

// ── helpers ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");

function load<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf-8")) as T;
}

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const WORKOS_API_KEY = process.env.WORKOS_API_KEY;
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;

async function callBackend(endpoint: string, options?: RequestInit) {
  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, options);
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    return await res.json();
  } catch (e) {
    throw new Error(`Backend unavailable: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── server ───────────────────────────────────────────────────────────────────
const server = new MCPServer({
  name: "health-optimizer-mcp",
  title: "Blueprint Health Optimizer",
  version: "1.0.0",
  description:
    "Real-time health optimization dashboard — smart watch vitals, smart glasses camera detection, supplement protocol tracking. Bryan Johnson Blueprint inspired. Powered by WorkOS auth.",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  favicon: "favicon.ico",
  websiteUrl: "https://manufact.com",
  icons: [
    { src: "icon.svg", mimeType: "image/svg+xml", sizes: ["512x512"] },
  ],
  // WorkOS OAuth — protects all /mcp routes, requires login via AuthKit
  ...(process.env.MCP_USE_OAUTH_WORKOS_SUBDOMAIN
    ? {
        oauth: oauthWorkOSProvider({
          subdomain: process.env.MCP_USE_OAUTH_WORKOS_SUBDOMAIN,
          clientId: process.env.WORKOS_CLIENT_ID,
          apiKey: process.env.WORKOS_API_KEY,
        }),
      }
    : {}),
});

// ── Tool 1: Health Dashboard (visual widget — always accessible) ─────────────
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

// ── Tool 4: Get Smart Watch Data (from Python backend) ─────────────────────
server.tool(
  {
    name: "get-smart-watch-data",
    description:
      "Get real-time smart watch health data from the backend (heart rate, SpO2, HRV, steps, calories, stress level, temperature)",
    schema: z.object({}),
  },
  async () => {
    try {
      const data = await callBackend("/api/smart-watch-data");
      return object(data);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ── Tool 5: Analyze Camera Frame (from Python backend) ──────────────────────
server.tool(
  {
    name: "analyze-frame",
    description:
      "Send a camera frame to the backend for AI analysis to detect health-related actions (taking supplements, drinking water, eating, exercising)",
    schema: z.object({
      imageBase64: z.string().describe("Base64 encoded image data"),
      currentAction: z
        .string()
        .optional()
        .default("taking a supplement")
        .describe("The action to detect"),
    }),
  },
  async ({ imageBase64, currentAction }) => {
    try {
      const data = await callBackend("/api/analyze-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: imageBase64,
          current_action: currentAction,
        }),
      });
      return object(data);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ── Tool 6: WorkOS Auth Demo (shows WorkOS integration) ─────────────────────
server.tool(
  {
    name: "workos-auth-demo",
    description:
      "Demonstrates WorkOS authentication integration. Lists users from WorkOS User Management API and generates an AuthKit login URL. Requires WORKOS_API_KEY and WORKOS_CLIENT_ID in .env.",
    schema: z.object({
      action: z
        .enum(["status", "list-users", "login-url"])
        .default("status")
        .describe("status: check config, list-users: fetch users from WorkOS, login-url: generate AuthKit login URL"),
    }),
  },
  async ({ action }) => {
    if (action === "status") {
      return object({
        workos_integrated: true,
        api_key_configured: !!WORKOS_API_KEY,
        client_id_configured: !!WORKOS_CLIENT_ID,
        client_id: WORKOS_CLIENT_ID ?? "not set",
        auth_provider: "WorkOS AuthKit",
        features: [
          "OAuth 2.0 / OIDC authentication",
          "Dynamic Client Registration (DCR) for MCP",
          "Enterprise SSO (SAML/OIDC)",
          "User Management API",
          "Role-Based Access Control",
        ],
        note: "WorkOS is a hackathon sponsor — MCP Auth secures this server in production",
      });
    }

    if (!WORKOS_API_KEY) {
      return error("WORKOS_API_KEY not configured in .env");
    }

    if (action === "list-users") {
      try {
        const res = await fetch(
          "https://api.workos.com/user_management/users?limit=10",
          {
            headers: {
              Authorization: `Bearer ${WORKOS_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (!res.ok) {
          return error(`WorkOS API error: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        return object({
          source: "WorkOS User Management API",
          total_users: data.data?.length ?? 0,
          users: (data.data ?? []).map((u: any) => ({
            id: u.id,
            email: u.email,
            first_name: u.first_name,
            last_name: u.last_name,
            created_at: u.created_at,
          })),
        });
      } catch (e) {
        return error(`Failed to fetch users: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (action === "login-url") {
      if (!WORKOS_CLIENT_ID) {
        return error("WORKOS_CLIENT_ID not configured in .env");
      }
      const subdomain = process.env.MCP_USE_OAUTH_WORKOS_SUBDOMAIN ?? "inspired-muffin-37-staging.authkit.app";
      const loginUrl = `https://${subdomain}/authorize?client_id=${WORKOS_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent("http://localhost:3000/oauth/callback")}`;
      return object({
        login_url: loginUrl,
        provider: "WorkOS AuthKit",
        subdomain,
        client_id: WORKOS_CLIENT_ID,
        instruction: "Open this URL in your browser to authenticate via WorkOS",
      });
    }

    return error("Unknown action");
  }
);

// ── start ────────────────────────────────────────────────────────────────────
server.listen().then(() => {
  console.log("Blueprint Health Optimizer — MCP server running on port 3000");
  console.log("Make sure Python backend is running on port 8000");
  if (WORKOS_API_KEY) {
    console.log("WorkOS integration: ACTIVE (API key configured)");
  }
});
