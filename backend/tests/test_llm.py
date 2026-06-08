"""
Tests for pipeline/llm.py and pipeline/memory.py.

All OpenAI/LangChain calls are mocked — no API key or network needed.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from pipeline.memory import get_history, append_messages, clear_history, session_count


# ---- memory.py tests --------------------------------------------------------

def test_get_history_creates_empty_list():
    sid = "mem-test-1"
    clear_history(sid)
    assert get_history(sid) == []


def test_append_messages_grows_history():
    from langchain_core.messages import HumanMessage, AIMessage
    sid = "mem-test-2"
    clear_history(sid)
    append_messages(sid, HumanMessage(content="hello"), AIMessage(content="hi"))
    assert len(get_history(sid)) == 2


def test_clear_history_removes_session():
    from langchain_core.messages import HumanMessage
    sid = "mem-test-3"
    append_messages(sid, HumanMessage(content="x"))
    clear_history(sid)
    assert get_history(sid) == []


def test_session_count_reflects_active_sessions():
    for sid in ["sc-1", "sc-2"]:
        clear_history(sid)
    before = session_count()
    get_history("sc-1")
    get_history("sc-2")
    assert session_count() >= before + 2


# ---- llm.py: get_session / clear_session ------------------------------------

@patch("pipeline.llm.ChatGroq")
def test_get_session_creates_entry(MockGroq):
    from pipeline.llm import get_session, clear_session
    sid = "llm-test-1"
    clear_session(sid)
    session = get_session(sid, role="SWE", jd="Build cool stuff")
    assert session["role"] == "SWE"
    assert session["jd"] == "Build cool stuff"
    assert "llm" in session


@patch("pipeline.llm.ChatGroq")
def test_get_session_returns_same_object(MockGroq):
    from pipeline.llm import get_session, clear_session
    sid = "llm-test-2"
    clear_session(sid)
    s1 = get_session(sid)
    s2 = get_session(sid)
    assert s1 is s2


@patch("pipeline.llm.ChatGroq")
def test_clear_session_removes_entry(MockGroq):
    from pipeline.llm import get_session, clear_session
    sid = "llm-test-3"
    get_session(sid, role="PM")
    clear_session(sid)
    fresh = get_session(sid, role="Designer")
    assert fresh["role"] == "Designer"


# ---- llm.py: get_feedback ---------------------------------------------------

MOCK_FEEDBACK = {
    "question": "Tell me about yourself.",
    "answer_transcript": "I am a software engineer.",
    "clarity_score": 8,
    "relevance_score": 7,
    "confidence_score": 9,
    "overall_score": 8,
    "strengths": ["Concise"],
    "improvements": ["Add examples"],
    "ideal_answer_hint": "Mention measurable impact.",
    "follow_up_question": "What is your greatest achievement?",
}


@pytest.mark.asyncio
async def test_get_feedback_returns_parsed_dict():
    from pipeline import llm as llm_module
    from pipeline.llm import get_feedback, clear_session
    sid = "llm-fb-1"
    clear_session(sid)
    clear_history(sid)

    mock_response = MagicMock()
    mock_response.content = json.dumps(MOCK_FEEDBACK)
    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)
    llm_module._sessions[sid] = {"role": "SWE", "jd": "", "mode": "behavioral", "difficulty": "mid", "llm": mock_llm}

    result = await get_feedback(sid, "I am a software engineer.")
    assert result["clarity_score"] == 8
    assert result["follow_up_question"] == "What is your greatest achievement?"


@pytest.mark.asyncio
async def test_get_feedback_retries_on_bad_json():
    from pipeline import llm as llm_module
    from pipeline.llm import get_feedback, clear_session

    sid = "llm-fb-2"
    clear_session(sid)
    clear_history(sid)

    good = MagicMock(content=json.dumps(MOCK_FEEDBACK))
    bad = MagicMock(content="not json {")
    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(side_effect=[bad, good])
    llm_module._sessions[sid] = {"role": "SWE", "jd": "", "mode": "behavioral", "difficulty": "mid", "llm": mock_llm}

    result = await get_feedback(sid, "My answer.")
    assert result["overall_score"] == 8
    assert mock_llm.ainvoke.call_count == 2


@pytest.mark.asyncio
async def test_get_feedback_raises_after_max_retries():
    from pipeline import llm as llm_module
    from pipeline.llm import get_feedback, clear_session

    sid = "llm-fb-3"
    clear_session(sid)
    clear_history(sid)

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="{{broken"))
    llm_module._sessions[sid] = {"role": "SWE", "jd": "", "mode": "behavioral", "difficulty": "mid", "llm": mock_llm}

    with pytest.raises(ValueError, match="invalid JSON"):
        await get_feedback(sid, "answer")


@pytest.mark.asyncio
async def test_get_feedback_appends_to_history():
    from pipeline import llm as llm_module
    from pipeline.llm import get_feedback, clear_session

    sid = "llm-fb-4"
    clear_session(sid)
    clear_history(sid)

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content=json.dumps(MOCK_FEEDBACK)))
    llm_module._sessions[sid] = {"role": "SWE", "jd": "", "mode": "behavioral", "difficulty": "mid", "llm": mock_llm}

    await get_feedback(sid, "First answer.")
    assert len(get_history(sid)) == 2   # HumanMessage + AIMessage
