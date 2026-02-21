"""
Agent module with state tracking and LangChain image/video interpretation.

Provides:
- AgentState with current_action / action_progress tracking
- interpret_image() — sends raw image bytes to Gemini, determines action progress
- interpret_video() — sends raw video bytes to Gemini for a screen summary
"""

import os
import json
from enum import Enum
from typing import Any

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()


# ---------------------------------------------------------------------------
# State management
# ---------------------------------------------------------------------------

class ActionProgress(str, Enum):
    """Progress status for the current agent action."""
    STARTED = "started"
    IN_PROGRESS = "in progress"
    FINISHED = "finished"


class AgentState(BaseModel):
    """
    Tracks the agent's current action and its progress.
    Maintains conversation memory so the LLM has context from prior frames.
    """
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
# LLM configuration (from .env)
# ---------------------------------------------------------------------------

def _build_llm() -> ChatGoogleGenerativeAI:
    """Construct the Gemini chat model from environment variables."""
    return ChatGoogleGenerativeAI(
        model=os.getenv("LLM_MODEL", "gemini-2.5-flash"),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.2")),
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )


ACTION_DETECTION_PROMPT = """You are an action detection assistant. You are monitoring a camera feed for a specific action.

The action you are looking for is: "{action}"

Analyze the image and determine whether the action is currently happening.
You will receive a history of prior observations to help you track continuity.
Respond with ONLY a JSON object (no markdown, no extra text):
{{"status": "<started|in progress|finished|not detected>", "description": "<brief description of what you see>"}}

Rules:
- "started" = the action has just begun in this frame
- "in progress" = the action is actively happening
- "finished" = the action was happening but has now completed
- "not detected" = the action is not visible in this frame"""


def _coerce_content(content: Any) -> str:
    """Coerce LLM response content (str or list of blocks) to a plain string."""
    if isinstance(content, list):
        return " ".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        ).strip()
    return content


# ---------------------------------------------------------------------------
# Image interpretation
# ---------------------------------------------------------------------------

def interpret_image(
    image_bytes: bytes,
    agent_state: AgentState,
    current_action: str,
) -> str:
    """
    Send raw image bytes to Google Gemini with conversation memory.
    The model determines whether the specified action is starting,
    in progress, or finished, and updates AgentState accordingly.
    Memory is cleared when the action finishes.

    Args:
        image_bytes:    Raw bytes of the image file (png, jpg, etc.).
        agent_state:    Shared AgentState instance with conversation memory.
        current_action: The action to look for (e.g. "taking a supplement").

    Returns:
        The model's JSON response with status and description.
    """
    llm = _build_llm()
    prompt = ACTION_DETECTION_PROMPT.format(action=current_action)

    # Build message list: system prompt + conversation history + new frame
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

        if status == "started":
            agent_state.push_update(current_action, ActionProgress.STARTED)
        elif status == "in progress":
            agent_state.push_update(current_action, ActionProgress.IN_PROGRESS)
        elif status == "finished":
            agent_state.push_update(current_action, ActionProgress.FINISHED)
            agent_state.clear_memory()
        # "not detected" -> don't change state
    except (json.JSONDecodeError, AttributeError):
        pass  # LLM didn't return valid JSON; leave state unchanged

    return result


# ---------------------------------------------------------------------------
# Video interpretation
# ---------------------------------------------------------------------------

def interpret_video(video_frames: bytes) -> str:
    """
    Send raw video bytes to Google Gemini and return a summary
    of what is occurring on screen.

    Args:
        video_frames: Raw bytes of the video file (e.g. mp4).

    Returns:
        The model's text response summarizing the video content.
    """
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
