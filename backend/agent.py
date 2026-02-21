"""
Agent module with LangGraph, Google Search, and image interpretation.

Provides:
- AgentState with current_action / action_progress tracking
- interpret_image() — sends raw image bytes to Gemini, detects health actions
- search_item_info() — uses Google search to get info about detected items
- ProtocolManager — tracks and updates health protocol based on detections
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
# Protocol Management - Dynamic tracking of health actions
# ---------------------------------------------------------------------------

class ProtocolItem(BaseModel):
    """A single item in the health protocol."""
    id: str
    name: str
    category: str  # supplement, meal, exercise, wellness, hydration
    scheduled_time: Optional[str] = None
    status: str = "pending"  # pending, taken, skipped
    taken_at: Optional[str] = None
    details: dict = Field(default_factory=dict)


class ProtocolManager:
    """Manages the dynamic health protocol based on detected actions."""
    
    def __init__(self):
        self.protocol_items: list[ProtocolItem] = []
        self.completed_actions: list[dict] = []
        self._id_counter = 1
    
    def add_completed_action(self, detection: dict) -> ProtocolItem:
        """Add a completed action to the protocol."""
        item = ProtocolItem(
            id=f"action_{self._id_counter}",
            name=detection.get("item_name") or detection.get("action", "Unknown action"),
            category=detection.get("category", "wellness"),
            status="taken",
            taken_at=datetime.now().isoformat(),
            details={
                "description": detection.get("description", ""),
                "quantity": detection.get("details", {}).get("quantity"),
                "dosage": detection.get("details", {}).get("dosage"),
                "brand": detection.get("details", {}).get("brand"),
            }
        )
        self._id_counter += 1
        self.protocol_items.append(item)
        self.completed_actions.append(detection)
        return item
    
    def get_protocol(self) -> list[dict]:
        """Get the current protocol state."""
        return [item.model_dump() for item in self.protocol_items]
    
    def get_summary(self) -> dict:
        """Get a summary of today's protocol."""
        by_category = {}
        for item in self.protocol_items:
            cat = item.category
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(item.name)
        
        return {
            "total_actions": len(self.protocol_items),
            "by_category": by_category,
            "items": self.get_protocol()
        }
    
    def clear(self):
        """Clear all protocol items."""
        self.protocol_items = []
        self.completed_actions = []
        self._id_counter = 1


# Global protocol manager
protocol_manager = ProtocolManager()


# ---------------------------------------------------------------------------
# State management
# ---------------------------------------------------------------------------

class ActionProgress(str, Enum):
    """Progress status for the current agent action."""
    STARTED = "started"
    IN_PROGRESS = "in progress"
    FINISHED = "finished"


class AgentState(BaseModel):
    """Tracks the agent's current action and its progress."""
    current_action: str = Field(default="", description="Description of the current action")
    action_progress: ActionProgress = Field(
        default=ActionProgress.FINISHED,
        description="Progress status of the current action",
    )
    conversation_memory: list[Any] = Field(
        default_factory=list,
        description="Message history for the current action sequence",
    )

    def push_update(self, action: str, progress: ActionProgress) -> None:
        """Update the current action and its progress status."""
        self.current_action = action
        self.action_progress = progress

    def clear_memory(self) -> None:
        """Clear conversation memory."""
        self.conversation_memory = []


# ---------------------------------------------------------------------------
# LLM configuration
# ---------------------------------------------------------------------------

def _build_llm() -> ChatGoogleGenerativeAI:
    """Construct the Gemini chat model."""
    return ChatGoogleGenerativeAI(
        model=os.getenv("LLM_MODEL", "gemini-2.0-flash"),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.2")),
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )


def _build_search_llm() -> ChatGoogleGenerativeAI:
    """Construct LLM with Google Search grounding enabled."""
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=0.1,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

ACTION_DETECTION_PROMPT = """You are a health action detection assistant monitoring a camera feed.

Your job is to automatically detect and track health-related actions with SPECIFIC DETAILS:

SUPPLEMENTS/MEDICATIONS:
- Identify the specific supplement if visible (e.g., "Vitamin D3", "Omega-3 Fish Oil", "Magnesium", "Multivitamin")
- Read bottle labels carefully for brand and dosage
- Note dosage form (pill, capsule, liquid, gummy)
- Estimate quantity if possible

FOOD/BEVERAGES:
- Identify specific food items (e.g., "Greek yogurt", "Apple", "Protein shake")
- Note if it's a meal (breakfast/lunch/dinner) or snack
- Estimate portion size if possible

EXERCISE/ACTIVITY:
- Identify specific exercise type (e.g., "Push-ups", "Stretching", "Walking")
- Note intensity level if apparent

WELLNESS:
- Meditation, breathing exercises, posture adjustments
- Sleep/rest related activities

HYDRATION:
- Water, tea, coffee, other beverages
- Estimate amount if possible

Analyze the image and determine if any health action is happening.
You will receive a history of prior observations to help you track continuity.

Respond with ONLY a JSON object (no markdown, no extra text):
{{
  "status": "<started|in progress|finished|not detected>",
  "action": "<specific action name>",
  "category": "<supplement|meal|exercise|wellness|hydration>",
  "item_name": "<specific item if identifiable, e.g., 'Vitamin D3', 'Water', 'Apple'>",
  "details": {{
    "quantity": "<amount if visible>",
    "dosage": "<dosage if applicable>",
    "brand": "<brand if visible>"
  }},
  "description": "<detailed description of what you observe>"
}}

Rules:
- "started" = action just began (be specific about what)
- "in progress" = action is actively happening
- "finished" = action has completed
- "not detected" = no health action visible
- Be as SPECIFIC as possible about items (READ LABELS if visible)
- If you can see a brand name, ALWAYS include it"""


SEARCH_ENRICHMENT_PROMPT = """You have access to Google Search to find information about health items.

Given this detected health action:
{detection}

Search for and provide helpful information about this item including:
- Health benefits
- Recommended dosage (if supplement)
- Best time to take
- Any interactions or warnings
- Nutritional information (if food)

Respond with a JSON object:
{{
  "item_name": "<name of item>",
  "health_benefits": ["<benefit 1>", "<benefit 2>"],
  "recommended_usage": "<when/how to use>",
  "warnings": ["<any warnings>"],
  "fun_fact": "<interesting fact about this item>"
}}"""


def _coerce_content(content: Any) -> str:
    """Coerce LLM response content to a plain string."""
    if isinstance(content, list):
        return " ".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        ).strip()
    return content


# ---------------------------------------------------------------------------
# Google Search Integration
# ---------------------------------------------------------------------------

def search_item_info(item_name: str, category: str) -> Optional[dict]:
    """
    Use Google Search to get information about a detected health item.
    """
    if not item_name or item_name.lower() in ["unknown", ""]:
        return None
    
    try:
        llm = _build_search_llm()
        
        search_query = f"{item_name} health benefits dosage"
        if category == "supplement":
            search_query = f"{item_name} supplement benefits dosage when to take"
        elif category == "meal":
            search_query = f"{item_name} nutrition facts health benefits"
        elif category == "exercise":
            search_query = f"{item_name} exercise benefits calories burned"
        
        messages = [
            SystemMessage(content=f"""You are a health information assistant. 
            Search for information about: {search_query}
            
            Provide accurate, helpful health information in JSON format:
            {{
                "item_name": "{item_name}",
                "category": "{category}",
                "health_benefits": ["benefit1", "benefit2", "benefit3"],
                "recommended_usage": "when and how to use/consume",
                "warnings": ["any relevant warnings"],
                "calories": "if applicable",
                "fun_fact": "interesting health fact"
            }}
            
            Respond with ONLY the JSON object, no markdown."""),
            HumanMessage(content=f"Get health information about: {item_name}")
        ]
        
        response = llm.invoke(messages)
        result = _coerce_content(response.content)
        
        # Parse JSON response
        parsed = json.loads(result.strip().removeprefix("```json").removesuffix("```").strip())
        return parsed
        
    except Exception as e:
        print(f"Search failed for {item_name}: {e}")
        return None


# ---------------------------------------------------------------------------
# Image interpretation
# ---------------------------------------------------------------------------

def interpret_image(
    image_bytes: bytes,
    agent_state: AgentState,
    current_action: str = "",
) -> str:
    """
    Send raw image bytes to Google Gemini with conversation memory.
    The model auto-detects health actions and tracks their progress.
    """
    llm = _build_llm()
    prompt = ACTION_DETECTION_PROMPT

    new_frame_msg = HumanMessage(
        content=[
            {
                "type": "media",
                "mime_type": "image/jpeg",
                "data": image_bytes,
            },
        ],
    )

    messages = [SystemMessage(content=prompt)]
    messages.extend(agent_state.conversation_memory)
    messages.append(new_frame_msg)

    response = llm.invoke(messages)
    result = _coerce_content(response.content)

    # Save this exchange to memory
    agent_state.conversation_memory.append(new_frame_msg)
    agent_state.conversation_memory.append(AIMessage(content=result))

    # Parse the model's status and update agent state
    try:
        parsed = json.loads(result.strip().removeprefix("```json").removesuffix("```").strip())
        status = parsed.get("status", "not detected")
        detected_action = parsed.get("action", "")

        if status == "started":
            agent_state.push_update(detected_action, ActionProgress.STARTED)
        elif status == "in progress":
            agent_state.push_update(detected_action or agent_state.current_action, ActionProgress.IN_PROGRESS)
        elif status == "finished":
            agent_state.push_update(detected_action or agent_state.current_action, ActionProgress.FINISHED)
            # Add to protocol when action finishes
            protocol_manager.add_completed_action(parsed)
            agent_state.clear_memory()
            
    except (json.JSONDecodeError, AttributeError):
        pass

    return result


# ---------------------------------------------------------------------------
# Video interpretation
# ---------------------------------------------------------------------------

def interpret_video(video_frames: bytes) -> str:
    """Send raw video bytes to Google Gemini for analysis."""
    system_prompt = os.getenv(
        "VIDEO_SYSTEM_PROMPT",
        "Analyze the provided video and summarize what is occurring on screen.",
    )
    llm = _build_llm()

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(
            content=[
                {
                    "type": "media",
                    "mime_type": "video/mp4",
                    "data": video_frames,
                },
            ],
        ),
    ]

    response = llm.invoke(messages)
    return response.content
