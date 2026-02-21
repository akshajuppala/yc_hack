from fastmcp import FastMCP
from dotenv import load_dotenv
import json
import os
import random

from backend.agent import AgentState, interpret_image, interpret_video

load_dotenv()

mcp = FastMCP("yc-mcp")

# Shared agent state — accessible to all tools
agent_state = AgentState()


@mcp.tool(task=True)
def interpret_health_snapshot(img_bytes: bytes, current_action: str) -> str:
    """Interpret a health snapshot image and detect the specified action."""
    return interpret_image(img_bytes, agent_state, current_action)


@mcp.tool(task=True)
def interpret_video_stream(video_frames:bytes) -> str:
    """Interpret a video stream and return a summary of what is on screen."""
    return interpret_video(video_frames)

def _generate_watch_data() -> dict:
    """Generate realistic fake smart watch health statistics."""
    return {
        "heart_rate_bpm": random.randint(58, 102),
        "blood_oxygen_spo2": round(random.uniform(95.0, 100.0), 1),
        "sleep_score": random.randint(55, 98),
        "steps_today": random.randint(800, 14000),
        "calories_burned": random.randint(120, 2800),
        "stress_level": random.choice(["low", "moderate", "high"]),
        "body_temperature_f": round(random.uniform(97.0, 99.2), 1),
        "respiratory_rate": random.randint(12, 20),
        "hrv_ms": random.randint(20, 80),
        "active_minutes": random.randint(0, 180),
    }


@mcp.tool()
def get_smart_watch_data(override_data: str | None = None) -> str:
    """
    Return smart watch health statistics as JSON.

    Generates realistic fake data by default. Pass override_data as a JSON
    string to replace or merge specific fields (e.g. '{"heart_rate_bpm": 72}').
    """
    data = _generate_watch_data()

    if override_data:
        try:
            overrides = json.loads(override_data)
            data.update(overrides)
        except json.JSONDecodeError:
            pass  # Ignore invalid JSON, use generated data

    return json.dumps(data, indent=2)


if __name__ == "__main__":
    mcp.run(
        transport="http",
        host=os.getenv("MCP_HOST", "127.0.0.1"),
        port=int(os.getenv("MCP_PORT", "8000")),
    )
