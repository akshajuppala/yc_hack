"""
Agent module for health action detection with nutrition tracking.

Provides:
- AgentState with action progress tracking
- interpret_image() — detects health actions and returns nutrition info
- ProtocolManager — tracks actions with full macro/micronutrient data
"""

import os
import json
from enum import Enum
from typing import Any, Optional
from datetime import datetime

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class Macros(BaseModel):
    """Macronutrient data."""
    calories: int = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0
    water_ml: int = 0


class Micros(BaseModel):
    """Micronutrient/supplement data."""
    vitamin_a: str = ""
    vitamin_c: str = ""
    vitamin_d: str = ""
    vitamin_e: str = ""
    vitamin_b12: str = ""
    calcium: str = ""
    iron: str = ""
    magnesium: str = ""
    zinc: str = ""
    omega_3: str = ""
    other: list[str] = Field(default_factory=list)


class ProtocolItem(BaseModel):
    """A single item in the health protocol with full nutrition data."""
    id: str
    action_type: str  # "food", "supplement", "hydration", "exercise"
    title: str
    description: str
    timestamp: str
    macros: Macros = Field(default_factory=Macros)
    micros: Micros = Field(default_factory=Micros)
    status: str = "completed"


class ProtocolManager:
    """Manages the health protocol with nutrition tracking."""
    
    def __init__(self):
        self.protocol_items: list[ProtocolItem] = []
        self._id_counter = 1
    
    def add_completed_action(self, detection: dict) -> ProtocolItem:
        """Add a completed action with nutrition data."""
        # Parse macros
        macros_data = detection.get("macros", {})
        macros = Macros(
            calories=self._safe_int(macros_data.get("calories", 0)),
            protein_g=self._safe_float(macros_data.get("protein_g", 0)),
            carbs_g=self._safe_float(macros_data.get("carbs_g", 0)),
            fat_g=self._safe_float(macros_data.get("fat_g", 0)),
            fiber_g=self._safe_float(macros_data.get("fiber_g", 0)),
            sugar_g=self._safe_float(macros_data.get("sugar_g", 0)),
            water_ml=self._safe_int(macros_data.get("water_ml", 0)),
        )
        
        # Parse micros
        micros_data = detection.get("micros", {})
        micros = Micros(
            vitamin_a=str(micros_data.get("vitamin_a", "")),
            vitamin_c=str(micros_data.get("vitamin_c", "")),
            vitamin_d=str(micros_data.get("vitamin_d", "")),
            vitamin_e=str(micros_data.get("vitamin_e", "")),
            vitamin_b12=str(micros_data.get("vitamin_b12", "")),
            calcium=str(micros_data.get("calcium", "")),
            iron=str(micros_data.get("iron", "")),
            magnesium=str(micros_data.get("magnesium", "")),
            zinc=str(micros_data.get("zinc", "")),
            omega_3=str(micros_data.get("omega_3", "")),
            other=micros_data.get("other", []),
        )
        
        item = ProtocolItem(
            id=f"action_{self._id_counter}",
            action_type=detection.get("action_type", "food"),
            title=detection.get("title", "Activity"),
            description=detection.get("description", ""),
            timestamp=datetime.now().isoformat(),
            macros=macros,
            micros=micros,
            status="completed"
        )
        self._id_counter += 1
        self.protocol_items.append(item)
        return item
    
    def _safe_int(self, val) -> int:
        try:
            return int(val) if val else 0
        except (ValueError, TypeError):
            return 0
    
    def _safe_float(self, val) -> float:
        try:
            return float(val) if val else 0.0
        except (ValueError, TypeError):
            return 0.0
    
    def get_protocol(self) -> list[dict]:
        """Get the current protocol state."""
        return [item.model_dump() for item in self.protocol_items]
    
    def get_summary(self) -> dict:
        """Get a summary with totals for all nutrients."""
        totals = {
            "calories_consumed": 0,
            "calories_burned": 0,
            "protein_g": 0.0,
            "carbs_g": 0.0,
            "fat_g": 0.0,
            "fiber_g": 0.0,
            "sugar_g": 0.0,
            "water_ml": 0,
        }
        
        supplements_taken: list[str] = []
        
        for item in self.protocol_items:
            if item.action_type == "exercise":
                totals["calories_burned"] += abs(item.macros.calories)
            else:
                totals["calories_consumed"] += item.macros.calories
            
            totals["protein_g"] += item.macros.protein_g
            totals["carbs_g"] += item.macros.carbs_g
            totals["fat_g"] += item.macros.fat_g
            totals["fiber_g"] += item.macros.fiber_g
            totals["sugar_g"] += item.macros.sugar_g
            totals["water_ml"] += item.macros.water_ml
            
            # Collect supplements
            if item.action_type == "supplement":
                supplements_taken.append(item.title)
        
        return {
            "total_actions": len(self.protocol_items),
            "totals": totals,
            "net_calories": totals["calories_consumed"] - totals["calories_burned"],
            "supplements_taken": supplements_taken,
            "items": self.get_protocol()
        }
    
    def clear(self):
        """Clear all protocol items."""
        self.protocol_items = []
        self._id_counter = 1


# Global protocol manager
protocol_manager = ProtocolManager()


# ---------------------------------------------------------------------------
# State management
# ---------------------------------------------------------------------------

class ActionProgress(str, Enum):
    STARTED = "started"
    IN_PROGRESS = "in progress"
    FINISHED = "finished"


class AgentState(BaseModel):
    current_action: str = Field(default="")
    action_progress: ActionProgress = Field(default=ActionProgress.FINISHED)
    conversation_memory: list[Any] = Field(default_factory=list)

    def push_update(self, action: str, progress: ActionProgress) -> None:
        self.current_action = action
        self.action_progress = progress

    def clear_memory(self) -> None:
        self.conversation_memory = []


# ---------------------------------------------------------------------------
# LLM configuration
# ---------------------------------------------------------------------------

def _build_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=os.getenv("LLM_MODEL", "gemini-2.0-flash"),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.2")),
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )


# ---------------------------------------------------------------------------
# Detection Prompt with Nutrition
# ---------------------------------------------------------------------------

ACTION_DETECTION_PROMPT = """You are a HEALTH activity detector. Detect ONLY these activities:

1. 💊 SUPPLEMENT - Taking vitamins, pills, medications
2. 🍎 FOOD - Eating meals, snacks, fruits, any food
3. 💧 HYDRATION - Drinking water, juice, smoothies, healthy beverages
4. 🏃 EXERCISE - Stretching, yoga, push-ups, any physical exercise

IGNORE: talking, typing, sitting still, facial expressions, phone use.

RESPONSE FORMAT:

For "started" or "in progress" status (brief response):
{
  "status": "started" or "in progress",
  "action_type": "food|supplement|hydration|exercise",
  "title": "Brief title",
  "description": "What's happening"
}

For "finished" status (include FULL nutrition data):
{
  "status": "finished",
  "action_type": "food|supplement|hydration|exercise",
  "title": "Specific item name (e.g., 'Medium Apple', 'Vitamin D3 1000IU')",
  "description": "What was consumed/done",
  "macros": {
    "calories": <number, negative for exercise>,
    "protein_g": <number>,
    "carbs_g": <number>,
    "fat_g": <number>,
    "fiber_g": <number>,
    "sugar_g": <number>,
    "water_ml": <number for hydration>
  },
  "micros": {
    "vitamin_a": "<amount if applicable>",
    "vitamin_c": "<amount if applicable>",
    "vitamin_d": "<amount if applicable>",
    "vitamin_e": "<amount if applicable>",
    "vitamin_b12": "<amount if applicable>",
    "calcium": "<amount if applicable>",
    "iron": "<amount if applicable>",
    "magnesium": "<amount if applicable>",
    "zinc": "<amount if applicable>",
    "omega_3": "<amount if applicable>",
    "other": ["<any other nutrients/vitamins>"]
  }
}

For "not detected":
{
  "status": "not detected",
  "action_type": "",
  "title": "",
  "description": "No health activity"
}

NUTRITION ESTIMATION GUIDELINES:
- FOOD: Estimate based on typical serving size. E.g., medium apple = 95 cal, 25g carbs, 4g fiber
- SUPPLEMENTS: 0 calories, list vitamins/minerals in micros
- HYDRATION: Water = 0 cal, include water_ml. Juice = estimate sugars/calories
- EXERCISE: Negative calories (burned). E.g., 10 push-ups ≈ -30 cal

Be accurate with nutrition estimates based on your knowledge of food nutrition data."""


def _coerce_content(content: Any) -> str:
    if isinstance(content, list):
        return " ".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        ).strip()
    return content


# ---------------------------------------------------------------------------
# Image interpretation
# ---------------------------------------------------------------------------

def interpret_video(video_frames: bytes) -> str:
    """Interpret a video stream (placeholder — not yet implemented)."""
    return json.dumps({"summary": "Video analysis not yet implemented", "frames": 0})


def interpret_image(
    image_bytes: bytes,
    agent_state: AgentState,
    current_action: str = "",
) -> str:
    """
    Detect health actions and return nutrition data when action finishes.
    Single LLM call that returns full nutrition only for finished actions.
    """
    llm = _build_llm()

    new_frame_msg = HumanMessage(
        content=[
            {
                "type": "media",
                "mime_type": "image/jpeg",
                "data": image_bytes,
            },
        ],
    )

    messages = [SystemMessage(content=ACTION_DETECTION_PROMPT)]
    messages.extend(agent_state.conversation_memory)
    messages.append(new_frame_msg)

    response = llm.invoke(messages)
    result = _coerce_content(response.content)

    # Parse and update state
    try:
        parsed = json.loads(result.strip().removeprefix("```json").removesuffix("```").strip())
        status = parsed.get("status", "not detected")
        title = parsed.get("title", "Activity")

        if status == "started":
            agent_state.clear_memory()
            agent_state.push_update(title, ActionProgress.STARTED)
            agent_state.conversation_memory.append(new_frame_msg)
            agent_state.conversation_memory.append(AIMessage(content=result))
        elif status == "in progress":
            agent_state.conversation_memory.append(new_frame_msg)
            agent_state.conversation_memory.append(AIMessage(content=result))
            agent_state.push_update(title or agent_state.current_action, ActionProgress.IN_PROGRESS)
        elif status == "finished":
            agent_state.push_update(title or agent_state.current_action, ActionProgress.FINISHED)
            protocol_manager.add_completed_action(parsed)
            agent_state.clear_memory()
        else:
            agent_state.conversation_memory.append(new_frame_msg)
            agent_state.conversation_memory.append(AIMessage(content=result))
            
    except (json.JSONDecodeError, AttributeError):
        agent_state.conversation_memory.append(new_frame_msg)
        agent_state.conversation_memory.append(AIMessage(content=result))

    return result
