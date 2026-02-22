import { MCPServer, object, text, widget, error, oauthWorkOSProvider } from "mcp-use/server";
import { MCPClient, HttpConnector, MCPSession } from "mcp-use";
import { z } from "zod";

// ── config ───────────────────────────────────────────────────────────────────
const PYTHON_MCP_URL = process.env.PYTHON_MCP_URL || "http://localhost:8001/mcp/";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const WORKOS_API_KEY = process.env.WORKOS_API_KEY || "sk_test_a2V5XzAxS0oxM1c2MlhEQ0M1MTY0SkFCNFlYUzRRLHREY05CV1ZiendWSjlzbklBYm93em9mT1o";
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID || "client_01KJ13W6NAEF3WQK8TSER70QBG";
const WORKOS_SUBDOMAIN = process.env.MCP_USE_OAUTH_WORKOS_SUBDOMAIN || "inspired-muffin-37-staging.authkit.app";
const ENABLE_OAUTH = process.env.ENABLE_OAUTH === "true";

// ── Python MCP client (mcp-use) ─────────────────────────────────────────────
let mcpSession: MCPSession | null = null;

async function getPythonSession(): Promise<MCPSession> {
  if (mcpSession?.isConnected) return mcpSession;

  const connector = new HttpConnector(PYTHON_MCP_URL);
  mcpSession = new MCPSession(connector);
  await mcpSession.initialize();
  return mcpSession;
}

async function callPythonTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const session = await getPythonSession();
      const result = await session.callTool(toolName, args);

      const textContent = result.content?.find((c: any) => c.type === "text");
      if (textContent && "text" in textContent) {
        try {
          return JSON.parse(textContent.text);
        } catch {
          return textContent.text;
        }
      }
      return result;
    } catch (e) {
      mcpSession = null;
      if (attempt === 1) throw e;
    }
  }
}

async function isPythonAvailable(): Promise<boolean> {
  try {
    const session = await getPythonSession();
    return session.isConnected;
  } catch {
    return false;
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
  ...(ENABLE_OAUTH && WORKOS_SUBDOMAIN
    ? {
        oauth: oauthWorkOSProvider({
          subdomain: WORKOS_SUBDOMAIN,
          clientId: WORKOS_CLIENT_ID,
          apiKey: WORKOS_API_KEY,
        }),
      }
    : {}),
});

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET TOOLS — visual interactive UI components
// ══════════════════════════════════════════════════════════════════════════════

// ── 🏥 Health Dashboard (combined widget) ─────────────────────────────────────
server.tool(
  {
    name: "health-dashboard",
    description:
      "🏥 Show the real-time health optimization dashboard with animated vital signs chart, camera supplement detection feed, and protocol checklist. Opens as an interactive widget.",
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
      const [watchData, protocolData] = await Promise.all([
        callPythonTool("get_smart_watch_data"),
        callPythonTool("get_protocol"),
      ]);

      const takenCount = protocolData.supplements_taken?.length ?? 0;
      const totalActions = protocolData.total_actions ?? 0;
      const adherenceScore = totalActions > 0 ? Math.round((takenCount / totalActions) * 100) : 0;
      const caloriesConsumed = protocolData.totals?.calories_consumed ?? 0;
      const targetCalories = 1950;

      return widget({
        props: {
          view,
          vitals: {
            startTime: new Date().toISOString(),
            intervalMs: 5000,
            heartRate: [watchData.heart_rate_bpm],
            hrv: [watchData.hrv_ms],
            spo2: [watchData.blood_oxygen_spo2],
            skinTemp: [watchData.body_temperature_f],
          },
          cameraEvents: [],
          protocol: protocolData.items?.map((item: any) => ({
            name: item.title,
            dose: item.description,
            status: item.status === "completed" ? "taken" : "pending",
            actualTime: item.timestamp,
          })) ?? [],
          nutrition: {
            targetCalories,
            targetMacros: { protein: { target: 130 }, fat: { target: 70 }, carbs: { target: 200 }, fiber: { target: 30 } },
            meals: protocolData.items?.filter((i: any) => i.action_type === "food") ?? [],
          },
          profileName: "Blueprint Protocol",
          date: new Date().toISOString().split("T")[0],
          summary: {
            adherenceScore,
            takenCount,
            totalCount: totalActions,
            latestHR: watchData.heart_rate_bpm,
            latestHRV: watchData.hrv_ms,
            caloriesConsumed,
            caloriesTarget: targetCalories,
          },
        },
        output: text(
          `🏥 Blueprint Health Dashboard — ${view} view. Adherence: ${adherenceScore}%. Latest HR: ${watchData.heart_rate_bpm} bpm, HRV: ${watchData.hrv_ms} ms. Calories: ${caloriesConsumed}/${targetCalories} kcal.`
        ),
      });
    } catch (e) {
      return error(
        `Dashboard error: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
);

// ── ⌚ Show Vitals Widget ──────────────────────────────────────────────────────
server.tool(
  {
    name: "show-vitals",
    description:
      "⌚ Display a real-time vitals monitoring widget showing heart rate, HRV, SpO2, and temperature with live charts. Best for when the user wants to see their current health metrics.",
    schema: z.object({}),
    widget: {
      name: "vitals-widget",
      invoking: "⌚ Loading vitals...",
      invoked: "⌚ Vitals streaming",
    },
  },
  async () => {
    try {
      const watchData = await callPythonTool("get_smart_watch_data");

      const vitalsData = {
        heartRate: [watchData.heart_rate_bpm],
        hrv: [watchData.hrv_ms],
        spo2: [watchData.blood_oxygen_spo2],
        skinTemp: [watchData.body_temperature_f],
        startTime: new Date().toISOString(),
        intervalMs: 5000,
        latestHR: watchData.heart_rate_bpm,
        latestHRV: watchData.hrv_ms,
        latestSpO2: watchData.blood_oxygen_spo2,
        latestTemp: watchData.body_temperature_f,
        stepsToday: watchData.steps_today,
        caloriesBurned: watchData.calories_burned,
        stressLevel: watchData.stress_level,
      };

      return widget({
        props: vitalsData,
        output: text(
          `⌚ Vitals: HR ${vitalsData.latestHR} bpm, HRV ${vitalsData.latestHRV} ms, SpO2 ${vitalsData.latestSpO2}%, Temp ${vitalsData.latestTemp}°F`
        ),
      });
    } catch (e) {
      return error(`Vitals error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

// ── 📷 Show Webcam Widget ──────────────────────────────────────────────────────
server.tool(
  {
    name: "show-webcam",
    description:
      "📷 Display the live webcam widget with AI-powered health action detection. Shows real-time camera feed that automatically detects supplements, food, hydration, and exercise activities.",
    schema: z.object({
      autoAnalyze: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to automatically analyze frames"),
      analyzeIntervalMs: z
        .number()
        .optional()
        .default(1000)
        .describe("Interval between automatic frame analyses in milliseconds"),
    }),
    widget: {
      name: "webcam-widget",
      invoking: "📷 Starting camera...",
      invoked: "📷 Camera active",
    },
  },
  async ({ autoAnalyze, analyzeIntervalMs }) => {
    return widget({
      props: {
        backendUrl: BACKEND_URL,
        autoAnalyze,
        analyzeIntervalMs,
      },
      output: text(
        `📷 Webcam widget active. Auto-analyze: ${autoAnalyze ? "ON" : "OFF"}. Detecting: supplements, food, hydration, exercise.`
      ),
    });
  }
);

// ── 🍎 Show Nutrition Widget ──────────────────────────────────────────────────
server.tool(
  {
    name: "show-nutrition",
    description:
      "🍎 Display the nutrition tracking widget showing calories consumed/burned, macro breakdown (protein, carbs, fat, fiber), and recent meals. Best for tracking diet and nutrition goals.",
    schema: z.object({}),
    widget: {
      name: "nutrition-widget",
      invoking: "🍎 Loading nutrition data...",
      invoked: "🍎 Nutrition tracker ready",
    },
  },
  async () => {
    try {
      const protocolData = await callPythonTool("get_protocol");
      const targetCalories = 1950;

      return widget({
        props: {
          caloriesConsumed: protocolData.totals?.calories_consumed ?? 0,
          caloriesBurned: protocolData.totals?.calories_burned ?? 0,
          netCalories: protocolData.net_calories ?? 0,
          targetCalories,
          macros: {
            protein_g: protocolData.totals?.protein_g ?? 0,
            carbs_g: protocolData.totals?.carbs_g ?? 0,
            fat_g: protocolData.totals?.fat_g ?? 0,
            fiber_g: protocolData.totals?.fiber_g ?? 0,
            sugar_g: protocolData.totals?.sugar_g ?? 0,
            water_ml: protocolData.totals?.water_ml ?? 0,
          },
          targetMacros: {
            protein: 130,
            carbs: 200,
            fat: 70,
            fiber: 30,
          },
          meals: (protocolData.items ?? [])
            .filter((i: any) => i.action_type === "food")
            .map((i: any) => ({
              id: i.id,
              title: i.title,
              timestamp: i.timestamp,
              calories: i.macros?.calories ?? 0,
              macros: {
                protein_g: i.macros?.protein_g ?? 0,
                carbs_g: i.macros?.carbs_g ?? 0,
                fat_g: i.macros?.fat_g ?? 0,
              },
            })),
        },
        output: text(
          `🍎 Nutrition: ${protocolData.net_calories ?? 0}/${targetCalories} kcal. Protein: ${(protocolData.totals?.protein_g ?? 0).toFixed(0)}g, Carbs: ${(protocolData.totals?.carbs_g ?? 0).toFixed(0)}g, Fat: ${(protocolData.totals?.fat_g ?? 0).toFixed(0)}g`
        ),
      });
    } catch (e) {
      return error(`Nutrition error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

// ── 📋 Show Protocol Widget ──────────────────────────────────────────────────
server.tool(
  {
    name: "show-protocol",
    description:
      "📋 Display the health protocol log widget showing all detected activities: supplements taken, food eaten, hydration events, and exercises. Includes filtering and summary of the day's health actions.",
    schema: z.object({}),
    widget: {
      name: "protocol-widget",
      invoking: "📋 Loading health log...",
      invoked: "📋 Health log ready",
    },
  },
  async () => {
    try {
      const protocolData = await callPythonTool("get_protocol");

      return widget({
        props: {
          totalActions: protocolData.total_actions ?? 0,
          supplementsTaken: protocolData.supplements_taken ?? [],
          items: protocolData.items ?? [],
        },
        output: text(
          `📋 Health Log: ${protocolData.total_actions ?? 0} actions. Supplements: ${(protocolData.supplements_taken ?? []).join(", ") || "none"}.`
        ),
      });
    } catch (e) {
      return error(`Protocol error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// DATA TOOLS — JSON responses, no UI
// ══════════════════════════════════════════════════════════════════════════════

// ── ⌚ Get Smart Watch Data ──────────────────────────────────────────────────
server.tool(
  {
    name: "get-smart-watch-data",
    description:
      "⌚ Get real-time smart watch health data from the Python MCP server (heart rate, SpO2, HRV, steps, calories, stress level, temperature)",
    schema: z.object({
      override: z
        .string()
        .optional()
        .describe("Optional JSON string to override specific fields (e.g. '{\"heart_rate_bpm\": 72}')"),
    }),
  },
  async ({ override }) => {
    try {
      const args: Record<string, any> = {};
      if (override) args.override_data = override;
      const data = await callPythonTool("get_smart_watch_data", args);
      return object(data);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ── 📊 Get Vitals ───────────────────────────────────────────────────────────
server.tool(
  {
    name: "get-vitals",
    description:
      "📊 Return current smart-watch vital signs (heart rate, HRV, SpO2, skin temp) as structured JSON from the Python MCP server",
    schema: z.object({
      signal: z
        .enum(["all", "heart_rate", "hrv", "spo2", "skin_temp"])
        .optional()
        .default("all")
        .describe("Which signal to return"),
    }),
  },
  async ({ signal }) => {
    try {
      const watchData = await callPythonTool("get_smart_watch_data");
      const signals: Record<string, any> = {
        heart_rate: { unit: "bpm", label: "Heart Rate", value: watchData.heart_rate_bpm },
        hrv: { unit: "ms", label: "HRV", value: watchData.hrv_ms },
        spo2: { unit: "%", label: "SpO2", value: watchData.blood_oxygen_spo2 },
        skin_temp: { unit: "°F", label: "Temperature", value: watchData.body_temperature_f },
      };

      const result = signal === "all"
        ? signals
        : { [signal]: signals[signal] };

      return object({
        source: "python_mcp_server",
        timestamp: new Date().toISOString(),
        signals: result,
      });
    } catch (e) {
      return error(String(e));
    }
  }
);

// ── 🔬 Analyze Camera Frame ──────────────────────────────────────────────────
server.tool(
  {
    name: "analyze-frame",
    description:
      "🔬 Send a camera frame to the Python MCP server for AI analysis to detect health-related actions (taking supplements, drinking water, eating, exercising)",
    schema: z.object({
      imageBase64: z.string().describe("Base64 encoded image data"),
      currentAction: z
        .string()
        .optional()
        .default("")
        .describe("The action to detect (leave empty for auto-detection)"),
    }),
  },
  async ({ imageBase64, currentAction }) => {
    try {
      let imageBytes = imageBase64;
      if (imageBytes.startsWith("data:")) {
        imageBytes = imageBytes.split(",")[1];
      }

      const data = await callPythonTool("interpret_health_snapshot", {
        img_bytes: imageBytes,
        current_action: currentAction,
      });
      return object(data);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ── 📋 Get Protocol Data ────────────────────────────────────────────────────
server.tool(
  {
    name: "get-protocol",
    description:
      "📋 Get the current health protocol data from the Python MCP server as structured JSON. Includes all detected actions, nutrition totals, and supplements taken.",
    schema: z.object({}),
  },
  async () => {
    try {
      const data = await callPythonTool("get_protocol");
      return object(data);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ── 🤖 Get Agent State ──────────────────────────────────────────────────────
server.tool(
  {
    name: "get-agent-state",
    description:
      "🤖 Get the current state of the AI health agent including current action being detected, progress, and frame buffer status.",
    schema: z.object({}),
  },
  async () => {
    try {
      const data = await callPythonTool("get_agent_state");
      return object(data);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ── 🔄 Reset Agent State ────────────────────────────────────────────────────
server.tool(
  {
    name: "reset-agent-state",
    description:
      "🔄 Reset the AI health agent state and clear all detected protocol items. Use this to start fresh tracking.",
    schema: z.object({}),
    annotations: {
      destructiveHint: true,
    },
  },
  async () => {
    try {
      const data = await callPythonTool("reset_agent");
      return object({ ...data, agent_reset: true });
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ── 🎬 Interpret Video Stream ───────────────────────────────────────────────
server.tool(
  {
    name: "interpret-video",
    description:
      "🎬 Interpret a video stream and return a summary of what is on screen. Use for analyzing recorded video clips or compiled frame sequences.",
    schema: z.object({
      videoFramesBase64: z.string().describe("Base64 encoded video frames data"),
    }),
  },
  async ({ videoFramesBase64 }) => {
    try {
      const data = await callPythonTool("interpret_video_stream", {
        video_frames: videoFramesBase64,
      });
      return object(data);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ── 💡 Health Assistant ──────────────────────────────────────────────────────
server.tool(
  {
    name: "health-assistant",
    description:
      "💡 Get AI-powered health recommendations based on current vitals, nutrition, and protocol data. The agent analyzes your data and provides personalized suggestions.",
    schema: z.object({
      focus: z
        .enum(["vitals", "nutrition", "supplements", "overall"])
        .optional()
        .default("overall")
        .describe("What aspect of health to focus recommendations on"),
    }),
  },
  async ({ focus }) => {
    try {
      const [watchData, protocolData] = await Promise.all([
        callPythonTool("get_smart_watch_data"),
        callPythonTool("get_protocol"),
      ]);

      return object({
        focus,
        vitals: {
          heart_rate: watchData.heart_rate_bpm,
          hrv: watchData.hrv_ms,
          spo2: watchData.blood_oxygen_spo2,
          temperature: watchData.body_temperature_f,
          steps: watchData.steps_today,
          stress: watchData.stress_level,
        },
        nutrition: {
          calories_consumed: protocolData.totals?.calories_consumed ?? 0,
          calories_burned: protocolData.totals?.calories_burned ?? 0,
          net_calories: protocolData.net_calories ?? 0,
          target_calories: 1950,
          protein_g: protocolData.totals?.protein_g ?? 0,
          carbs_g: protocolData.totals?.carbs_g ?? 0,
          fat_g: protocolData.totals?.fat_g ?? 0,
        },
        supplements_taken: protocolData.supplements_taken ?? [],
        total_actions: protocolData.total_actions ?? 0,
        source: "python_mcp_server",
      });
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ── 🔐 WorkOS Auth Demo ─────────────────────────────────────────────────────
server.tool(
  {
    name: "workos-auth-demo",
    description:
      "🔐 Demonstrates WorkOS authentication integration. Lists users from WorkOS User Management API and generates an AuthKit login URL. Requires WORKOS_API_KEY and WORKOS_CLIENT_ID in .env.",
    schema: z.object({
      action: z
        .enum(["status", "list-users", "login-url"])
        .default("status")
        .describe("status: check config, list-users: fetch users from WorkOS, login-url: generate AuthKit login URL"),
    }),
  },
  async ({ action }) => {
    if (action === "status") {
      const pythonAvailable = await isPythonAvailable();
      return object({
        workos_integrated: true,
        api_key_configured: !!WORKOS_API_KEY,
        client_id_configured: !!WORKOS_CLIENT_ID,
        client_id: WORKOS_CLIENT_ID ?? "not set",
        auth_provider: "WorkOS AuthKit",
        python_mcp_connected: pythonAvailable,
        features: [
          "OAuth 2.0 / OIDC authentication",
          "Dynamic Client Registration (DCR) for MCP",
          "Enterprise SSO (SAML/OIDC)",
          "User Management API",
          "Role-Based Access Control",
        ],
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
      const subdomain = WORKOS_SUBDOMAIN;
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
  console.log(`Python MCP server: ${PYTHON_MCP_URL}`);
  console.log("");
  console.log("Available widget tools:");
  console.log("  🏥 health-dashboard  : Full combined dashboard");
  console.log("  ⌚ show-vitals       : Real-time vital signs");
  console.log("  📷 show-webcam       : AI camera with health action detection");
  console.log("  🍎 show-nutrition    : Calorie and macro tracking");
  console.log("  📋 show-protocol     : Health action log");
  console.log("");
  console.log("Data tools:");
  console.log("  ⌚ get-smart-watch-data : Smart watch health data");
  console.log("  📊 get-vitals          : Current vital signs");
  console.log("  🔬 analyze-frame       : AI frame analysis");
  console.log("  📋 get-protocol        : Health protocol data");
  console.log("  🤖 get-agent-state     : Agent status");
  console.log("  🔄 reset-agent-state   : Reset agent");
  console.log("  🎬 interpret-video     : Video stream analysis");
  console.log("  💡 health-assistant    : AI health recommendations");
  console.log("  🔐 workos-auth-demo   : WorkOS auth integration");
  console.log("");
  if (ENABLE_OAUTH) {
    console.log("WorkOS OAuth: ENABLED");
  } else {
    console.log("WorkOS OAuth: DISABLED (set ENABLE_OAUTH=true to enable)");
  }
});
