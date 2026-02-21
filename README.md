# Blueprint Health Optimizer — MCP App

Bryan-Johnson-inspired real-time health optimization dashboard built as an **MCP App** with [Manufact](https://manufact.com) for the **MCP Apps Hackathon @ YC**.

Live-streaming vitals charts, webcam feed, AI-powered camera supplement detection, calorie/macro tracking, and protocol adherence — all in one widget rendered inside Claude, ChatGPT, or the Inspector.

Built on the official [hack-yc template](https://github.com/mcp-use/hack-yc).

## Quick Start

```bash
nvm use 22
npm install
npm run dev
```

Open http://localhost:3000/inspector → click **health-dashboard** → watch the dashboard stream to life.

## Connecting to Claude / ChatGPT

### Local (tunnel)

```bash
npm run dev -- --tunnel
```

Paste the printed URL into:
- **Claude**: Settings → Integrations → Add integration
- **ChatGPT**: Settings → Connectors → Add MCP server

### Deploy to Manufact Cloud

```bash
npx @mcp-use/cli login
npm run deploy
```

Live at `https://<slug>.run.mcp-use.com/mcp`.

## Tools

| Tool | Returns | Description |
|---|---|---|
| `health-dashboard` | **Widget** | Full visual dashboard with all components |
| `get-vitals` | JSON | Smart-watch time-series (HR, HRV, SpO2, skin temp) |
| `get-camera-events` | JSON | Smart-glasses camera detection events |

## Dashboard Components

| Section | Source | What it shows |
|---|---|---|
| **Vitals Chart** | Smart watch | Animated dual-line SVG (HR green, HRV cyan) scrolling live |
| **Webcam Feed** | Browser webcam | Live video with scan-line overlay and corner brackets |
| **Camera Events** | Smart glasses | Detections appearing one-by-one: supplements, meals, activities |
| **Calories Tracker** | Camera + manual | Calorie ring, macro bars (protein/fat/carbs/fiber), meal list |
| **Protocol List** | Camera + schedule | Supplement checklist with taken/missed/pending status |

## Data Structure Reference

All toy data lives in `data/`. To integrate real feeds, produce JSON matching these schemas. The server reads files at tool-call time so you can hot-swap them while running.

### data/vitals-stream.json — Smart Watch Vitals

Time-series from a smart watch. Each signal is an array at a fixed interval.

```json
{
  "source": "smart_watch",
  "startTime": "2026-02-21T06:00:00Z",
  "intervalMs": 30000,
  "signals": {
    "heart_rate": {
      "unit": "bpm",
      "label": "Heart Rate",
      "values": [49, 48, 50, 51]
    },
    "hrv": {
      "unit": "ms",
      "label": "HRV (RMSSD)",
      "values": [82, 84, 81, 80]
    },
    "spo2": {
      "unit": "%",
      "label": "SpO2",
      "values": [98, 98, 99, 98]
    },
    "skin_temp": {
      "unit": "C",
      "label": "Skin Temp",
      "values": [36.2, 36.2, 36.3, 36.2]
    }
  }
}
```

**Rules:**
- All signal arrays must be the **same length**
- `startTime` + `intervalMs` x index = timestamp for each point
- Chart shows a sliding window of 40 points — use 90+ points for a 30s animation loop
- Add new signals (e.g. blood_glucose) by extending the JSON and updating index.ts

### data/camera-events.json — Smart Glasses Camera

Events detected by smart glasses camera.

```json
{
  "source": "smart_glasses_camera",
  "date": "2026-02-21",
  "events": [
    {
      "id": 1,
      "timestamp": "2026-02-21T06:31:42Z",
      "type": "supplement",
      "item": "Omega-3 Fish Oil",
      "dose": "2g (2 capsules)",
      "confidence": 0.94,
      "status": "confirmed",
      "icon": "pill"
    }
  ]
}
```

**Fields:**
- `type`: "supplement", "meal", or "activity"
- `status`: "confirmed" (detected) or "scheduled" (upcoming)
- `confidence`: 0.0–1.0 detection confidence
- `dose`: optional, for supplements only
- `icon`: "pill", "powder", "shake", "smoothie", "meal", "workout", "checkmark", "sunrise", "light"

### data/nutrition-log.json — Calories & Macros

Daily nutrition with meals and macro breakdown.

```json
{
  "date": "2026-02-21",
  "targetCalories": 1977,
  "targetMacros": {
    "protein": { "target": 130, "unit": "g" },
    "fat": { "target": 110, "unit": "g" },
    "carbs": { "target": 120, "unit": "g" },
    "fiber": { "target": 50, "unit": "g" }
  },
  "meals": [
    {
      "id": 1,
      "name": "Super Veggie Smoothie",
      "time": "06:45",
      "timestamp": "2026-02-21T06:45:00Z",
      "calories": 400,
      "macros": { "protein": 30, "fat": 20, "carbs": 35, "fiber": 12 },
      "status": "consumed",
      "detectedBy": "camera"
    }
  ]
}
```

**Rules:**
- Only `"consumed"` meals count toward calorie ring and macro bars
- `detectedBy`: "camera" or null (manual/scheduled)

### data/protocol-log.json — Supplement Protocol

Daily supplement schedule with adherence tracking.

```json
{
  "date": "2026-02-21",
  "profile": "Blueprint Protocol",
  "protocol": [
    {
      "name": "Omega-3 Fish Oil",
      "dose": "2g",
      "scheduledTime": "06:30",
      "actualTime": "06:32",
      "status": "taken",
      "detectedBy": "camera",
      "category": "morning",
      "note": "optional"
    }
  ]
}
```

**Fields:**
- `status`: "taken", "pending", "missed", or "weekly_skip"
- `actualTime`: null if not yet taken
- `detectedBy`: "camera" or null
- `category`: "morning", "post_workout", "midday", "evening"
- Adherence score = taken / (total - weekly_skips) x 100

## Integrating Real Device Data

1. **Smart Watch** → Write time-series to `data/vitals-stream.json`. Server re-reads on each tool call.
2. **Smart Glasses Camera** → Append events to `data/camera-events.json` with `"status": "confirmed"`.
3. **Nutrition** → Update `data/nutrition-log.json` — flip meal status to `"consumed"` when detected.
4. **Protocol** → Update `data/protocol-log.json` — set status to `"taken"`, fill `actualTime`.

The MCP agent can call tools programmatically. You can add write-tools later to make the dashboard fully bidirectional.

## Project Structure

```
index.ts                        MCP server (tools + widget binding)
data/
  vitals-stream.json            smart watch time-series
  camera-events.json            camera detections
  nutrition-log.json            calories + macros
  protocol-log.json             supplement protocol
resources/
  styles.css                    dark theme + animations
  health-dashboard/
    widget.tsx                  main React widget
    types.ts                    Zod prop schema
    components/
      VitalsChart.tsx           animated SVG line chart
      WebcamFeed.tsx            live webcam via getUserMedia
      CameraFeed.tsx            camera detection event log
      CaloriesTracker.tsx       calorie ring + macro bars
      ProtocolList.tsx          supplement checklist
public/                         favicon, icons
.cursor/skills/                 mcp-apps-builder context
```

## Resources

- [mcp-use Docs](https://mcp-use.com/docs)
- [MCP Apps / Widgets](https://mcp-use.com/docs/typescript/server/mcp-apps)
- [Manufact Cloud](https://manufact.com)
- [hack-yc template](https://github.com/mcp-use/hack-yc)
