"""
FastMCP server for health tracking with image/video analysis.

Flow:
1. interpret_health_snapshot checks if action is in progress
2. Frames are buffered while action is ongoing
3. When action finishes, interpret_video_stream analyzes the sequence
4. Status update is returned with full analysis
"""

from fastmcp import FastMCP
from dotenv import load_dotenv
import json
import os
import random
import io
from typing import Optional

from agent import AgentState, ActionProgress, interpret_image, interpret_video

load_dotenv()

mcp = FastMCP("yc-mcp")

# Shared agent state — accessible to all tools
agent_state = AgentState()

# Buffer to store frames during an action sequence
frame_buffer: list[bytes] = []
MAX_BUFFER_FRAMES = 20


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
            pass

    return json.dumps(data, indent=2)


@mcp.tool(task=True)
def interpret_health_snapshot(img_bytes: bytes, current_action: str = "") -> str:
    """
    Interpret a health snapshot image and auto-detect health actions.
    
    The AI automatically detects actions like taking supplements, drinking water,
    eating, exercising, etc. No need to specify the action - it will be detected.
    
    Tracks action progress across frames:
    - Buffers frames while action is in progress
    - Returns immediate status for each frame
    - When action finishes, returns completed analysis
    """
    global frame_buffer
    
    # Analyze the current frame
    result = interpret_image(img_bytes, agent_state, current_action)
    
    # Parse the result to check status
    try:
        parsed = json.loads(result.strip().removeprefix("```json").removesuffix("```").strip())
        status = parsed.get("status", "not detected")
    except json.JSONDecodeError:
        status = "unknown"
        parsed = {"status": status, "description": result}
    
    # Buffer management based on action progress
    if status in ["started", "in progress"]:
        # Add frame to buffer (keep recent frames only)
        frame_buffer.append(img_bytes)
        if len(frame_buffer) > MAX_BUFFER_FRAMES:
            frame_buffer.pop(0)
        
        return json.dumps({
            "frame_analysis": parsed,
            "action_progress": status,
            "frames_buffered": len(frame_buffer),
            "video_analysis": None
        })
    
    elif status == "finished":
        # Action completed - analyze the buffered sequence
        detected_action = parsed.get("action", "health action")
        video_summary = None
        if len(frame_buffer) > 0:
            video_summary = f"Action '{detected_action}' completed. Captured {len(frame_buffer)} frames during the action sequence."
        
        # Clear buffer after action completes
        frames_analyzed = len(frame_buffer)
        frame_buffer = []
        
        return json.dumps({
            "frame_analysis": parsed,
            "action_progress": "finished",
            "detected_action": detected_action,
            "frames_buffered": 0,
            "frames_analyzed": frames_analyzed,
            "video_analysis": video_summary,
            "action_completed": True
        })
    
    else:
        # Not detected - don't buffer
        return json.dumps({
            "frame_analysis": parsed,
            "action_progress": "not detected",
            "frames_buffered": len(frame_buffer),
            "video_analysis": None
        })


@mcp.tool(task=True)
def interpret_video_stream(video_frames: bytes) -> str:
    """
    Interpret a video stream and return a summary of what is on screen.
    
    Use this for analyzing recorded video clips or compiled frame sequences.
    """
    return interpret_video(video_frames)


@mcp.tool()
def get_agent_state() -> str:
    """Get the current agent state including action progress."""
    return json.dumps({
        "current_action": agent_state.current_action,
        "action_progress": agent_state.action_progress.value,
        "frames_buffered": len(frame_buffer)
    })


@mcp.tool()
def reset_agent() -> str:
    """Reset the agent state and clear all buffers."""
    global frame_buffer
    agent_state.clear_memory()
    agent_state.current_action = ""
    agent_state.action_progress = ActionProgress.FINISHED
    frame_buffer = []
    return json.dumps({"status": "reset", "message": "Agent state and buffers cleared"})


if __name__ == "__main__":
    print("Starting FastMCP server...")
    mcp.run(
        transport="http",
        host=os.getenv("MCP_HOST", "127.0.0.1"),
        port=int(os.getenv("MCP_PORT", "8000")),
    )
