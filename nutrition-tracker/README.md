# NutriScan - Healthcare Food Nutrition Tracker

An MCP App built with [mcp-use](https://github.com/mcp-use/mcp-use) that uses AI-powered food recognition to track nutritional intake.

## Features

- **Camera Food Recognition**: Point your camera at food items to automatically identify them using GPT-4 Vision
- **Nutritional Tracking**: Track calories, protein, carbs, fat, fiber, and sugar
- **Interactive Dashboard**: Beautiful UI showing your nutritional analysis with progress bars, category breakdowns, and macro distribution
- **Session Management**: Track multiple food items in a session and clear when done

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key (for food recognition)

### Installation

```bash
cd nutrition-tracker
npm install
```

### Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_api_key_here
```

### Running the Server

```bash
npm run dev
```

The server will start at `http://localhost:3000` with the MCP Inspector available at `http://localhost:3000/inspector`.

## Available Tools

| Tool | Description |
|------|-------------|
| `start_session` | Opens the main menu with options to scan food or view dashboard |
| `capture_food` | Opens the webcam interface for food scanning |
| `analyze_food_image` | Analyzes a captured image using GPT-4 Vision |
| `add_food_manually` | Manually add a food item if camera doesn't work |
| `get_nutrition_dashboard` | Shows the nutritional analysis dashboard |
| `clear_session` | Clears all tracked food items |

## Usage with MCP Clients

### Claude Desktop / ChatGPT

Connect to this MCP server using the server URL. When connected:

1. Say "Start NutriScan" or the AI will call `start_session`
2. Choose "Scan Food" to open the camera
3. Point your camera at food and tap the capture button
4. The AI will identify the food and add it to your session
5. View "Dashboard" to see your nutritional analysis

### Manual Testing

Visit the MCP Inspector at `http://localhost:3000/inspector` to test tools directly.

## Widgets

- **Main Menu**: Starting point with options for camera or dashboard
- **Webcam Capture**: Camera interface with real-time food scanning
- **Nutrition Dashboard**: Beautiful analytics with tabs for overview, food list, and category breakdown

## Tech Stack

- [mcp-use](https://github.com/mcp-use/mcp-use) - MCP framework for server and widgets
- [OpenAI GPT-4 Vision](https://openai.com/gpt-4) - Food recognition
- React 19 + TypeScript
- Tailwind CSS 4

## License

MIT
