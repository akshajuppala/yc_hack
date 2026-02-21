"""
REST API endpoints for the health optimizer frontend.

- Dynamic protocol tracking (no test data)
- Google Search enrichment for detected items
- Frame buffering and action completion tracking
"""

import json
import random
import base64
import os
import traceback
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import (
    AgentState, ActionProgress, interpret_image, 
    search_item_info, protocol_manager
)

app = FastAPI(title="Health Optimizer API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared agent state
agent_state = AgentState()

# Frame buffer for tracking action sequences
frame_buffer: list[bytes] = []
MAX_BUFFER_FRAMES = 20


class ImageAnalysisRequest(BaseModel):
    image_base64: str
    enrich_with_search: bool = False  # Enable Google search for item info


class SmartWatchData(BaseModel):
    heart_rate_bpm: int
    blood_oxygen_spo2: float
    sleep_score: int
    steps_today: int
    calories_burned: int
    stress_level: str
    body_temperature_f: float
    respiratory_rate: int
    hrv_ms: int
    active_minutes: int


def generate_watch_data() -> dict:
    """Generate realistic smart watch health statistics."""
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


@app.get("/")
def root():
    return {"status": "ok", "service": "Health Optimizer API v2"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/smart-watch-data")
def get_smart_watch_data(override: Optional[str] = None):
    """Get current smart watch health data."""
    data = generate_watch_data()
    if override:
        try:
            overrides = json.loads(override)
            data.update(overrides)
        except json.JSONDecodeError:
            pass
    return data


@app.get("/api/protocol")
def get_protocol():
    """Get the current dynamic protocol state."""
    return protocol_manager.get_summary()


@app.post("/api/analyze-frame")
def analyze_frame(request: ImageAnalysisRequest):
    """
    Analyze a camera frame for health-related actions.
    Automatically detects actions and updates the protocol when completed.
    """
    global frame_buffer
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500, 
            detail="GOOGLE_API_KEY not configured"
        )
    
    try:
        # Decode base64 image
        if request.image_base64.startswith("data:"):
            image_data = request.image_base64.split(",")[1]
        else:
            image_data = request.image_base64
        
        image_bytes = base64.b64decode(image_data)
        print(f"Analyzing frame: {len(image_bytes)} bytes")
        
        # Analyze with the agent
        result = interpret_image(image_bytes, agent_state)
        print(f"Analysis result: {result}")
        
        # Parse the result
        try:
            parsed = json.loads(result.strip().removeprefix("```json").removesuffix("```").strip())
            status = parsed.get("status", "not detected")
        except json.JSONDecodeError:
            parsed = {"status": "unknown", "description": result}
            status = "unknown"
        
        # Buffer management based on action progress
        if status in ["started", "in progress"]:
            frame_buffer.append(image_bytes)
            if len(frame_buffer) > MAX_BUFFER_FRAMES:
                frame_buffer.pop(0)
            
            return {
                "success": True,
                "analysis": parsed,
                "action_in_progress": True,
                "frames_buffered": len(frame_buffer),
                "protocol": protocol_manager.get_summary(),
                "agent_state": {
                    "current_action": agent_state.current_action,
                    "action_progress": agent_state.action_progress.value,
                }
            }
        
        elif status == "finished":
            detected_action = parsed.get("action", "health action")
            item_name = parsed.get("item_name", "")
            category = parsed.get("category", "wellness")
            frames_analyzed = len(frame_buffer)
            
            # Optionally enrich with Google Search
            search_info = None
            if request.enrich_with_search and item_name:
                print(f"Searching for info about: {item_name}")
                search_info = search_item_info(item_name, category)
            
            # Clear buffer
            frame_buffer = []
            
            return {
                "success": True,
                "analysis": parsed,
                "action_in_progress": False,
                "action_completed": True,
                "detected_action": detected_action,
                "item_name": item_name,
                "category": category,
                "frames_analyzed": frames_analyzed,
                "search_info": search_info,
                "protocol": protocol_manager.get_summary(),
                "agent_state": {
                    "current_action": agent_state.current_action,
                    "action_progress": agent_state.action_progress.value,
                }
            }
        
        else:
            return {
                "success": True,
                "analysis": parsed,
                "action_in_progress": False,
                "action_completed": False,
                "frames_buffered": len(frame_buffer),
                "protocol": protocol_manager.get_summary(),
                "agent_state": {
                    "current_action": agent_state.current_action,
                    "action_progress": agent_state.action_progress.value,
                }
            }
            
    except Exception as e:
        print(f"ERROR in analyze_frame: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agent-state")
def get_agent_state():
    """Get the current agent state."""
    return {
        "current_action": agent_state.current_action,
        "action_progress": agent_state.action_progress.value,
        "frames_buffered": len(frame_buffer),
        "protocol": protocol_manager.get_summary(),
    }


@app.post("/api/reset-agent")
def reset_agent():
    """Reset the agent state, clear memory, and reset protocol."""
    global frame_buffer
    agent_state.clear_memory()
    agent_state.current_action = ""
    agent_state.action_progress = ActionProgress.FINISHED
    frame_buffer = []
    protocol_manager.clear()
    return {"status": "reset", "message": "Agent and protocol cleared"}


@app.post("/api/search-item")
def search_item(item_name: str, category: str = "supplement"):
    """Search for health information about an item."""
    if not item_name:
        raise HTTPException(status_code=400, detail="item_name is required")
    
    info = search_item_info(item_name, category)
    if not info:
        raise HTTPException(status_code=404, detail=f"Could not find info for {item_name}")
    
    return info


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
