import os
import sys
import time

import cv2

sys.path.insert(0, os.path.dirname(__file__))

from agent import AgentState, ActionProgress, interpret_image, interpret_video

TEST_DIR = os.path.join(os.path.dirname(__file__), "test_data")
VIDEO_FILE = "WIN_20260221_12_20_56_Pro.mp4"
ACTION = "taking a supplement"

# Frame extraction interval in seconds (1 frame every N seconds)
FRAME_INTERVAL_SEC = 1


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_frames(video_path: str, interval_sec: float = FRAME_INTERVAL_SEC):
    """
    Extract frames from a video at the given interval using OpenCV.

    Yields (timestamp_sec, jpeg_bytes) tuples.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_skip = int(fps * interval_sec)
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % frame_skip == 0:
            timestamp = frame_idx / fps
            _, buf = cv2.imencode(".jpg", frame)
            yield timestamp, buf.tobytes()
        frame_idx += 1

    cap.release()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_state_tracking():
    """Verify AgentState transitions without any LLM call."""
    state = AgentState()
    assert state.current_action == ""
    assert state.action_progress == ActionProgress.FINISHED

    state.push_update("action-1", ActionProgress.STARTED)
    assert state.current_action == "action-1"
    assert state.action_progress == ActionProgress.STARTED

    state.push_update("action-1", ActionProgress.IN_PROGRESS)
    assert state.action_progress == ActionProgress.IN_PROGRESS

    state.push_update("action-1", ActionProgress.FINISHED)
    assert state.action_progress == ActionProgress.FINISHED

    state.push_update("action-2", ActionProgress.STARTED)
    assert state.current_action == "action-2"
    assert state.action_progress == ActionProgress.STARTED


def test_action_detection_on_video_frames():
    """
    Extract frames from the test video, feed each to interpret_image
    with the action 'taking a supplement', and print timestamps when
    the action state changes.
    """
    video_path = os.path.join(TEST_DIR, VIDEO_FILE)
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"{video_path} not found -- add video to test_data/")

    state = AgentState()
    prev_progress = state.action_progress

    print(f"\n  Video: {VIDEO_FILE}")
    print(f"  Action: '{ACTION}'")
    print(f"  Frame interval: every {FRAME_INTERVAL_SEC}s")
    print(f"  {'='*55}")

    for timestamp, jpeg_bytes in extract_frames(video_path):
        ts_str = f"{timestamp:6.1f}s"

        result = interpret_image(jpeg_bytes, state, ACTION)
        result_str = str(result).strip()
        mem_size = len(state.conversation_memory)

        # Print every frame's result
        print(f"  [{ts_str}] progress={state.action_progress.value:<12} mem={mem_size:<3} | {result_str[:80]}")

        # Log transitions
        if state.action_progress != prev_progress:
            if state.action_progress == ActionProgress.STARTED:
                print(f"  >>> ACTION STARTED at {ts_str}")
            elif state.action_progress == ActionProgress.FINISHED:
                print(f"  >>> ACTION FINISHED at {ts_str} (memory cleared)")
            prev_progress = state.action_progress

    print(f"  {'='*55}")
    print(f"  Final state: action={state.current_action!r}  progress={state.action_progress.value!r}")

    assert state.action_progress == ActionProgress.FINISHED, (
        f"Expected action '{ACTION}' to finish within the video, "
        f"but final state was '{state.action_progress.value}'"
    )


def test_video_interpretation():
    """Test interpret_video returns a non-empty summary."""
    video_path = os.path.join(TEST_DIR, VIDEO_FILE)
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"{video_path} not found -- add video to test_data/")

    with open(video_path, "rb") as f:
        video_bytes = f.read()

    result = interpret_video(video_bytes)
    assert isinstance(result, str) and len(result) > 0
    print(f"\n  Video summary preview: {result[:200]}...")
