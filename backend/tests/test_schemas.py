"""
Tests for models/schemas.py — Pydantic v2 validation.
"""

import pytest
from pydantic import ValidationError

from models.schemas import FeedbackResult, TranscriptMessage, ErrorMessage


# ── FeedbackResult ────────────────────────────────────────────────────────────

VALID_FEEDBACK = {
    "question": "Tell me about yourself.",
    "answer_transcript": "I am a software engineer with 5 years of experience.",
    "clarity_score": 8,
    "relevance_score": 7,
    "confidence_score": 9,
    "overall_score": 8,
    "strengths": ["Clear structure", "Good examples"],
    "improvements": ["Could be more concise"],
    "ideal_answer_hint": "Focus on relevant experience and impact.",
    "follow_up_question": "What is your greatest technical achievement?",
}


def test_feedback_result_valid():
    fb = FeedbackResult(**VALID_FEEDBACK)
    assert fb.clarity_score == 8
    assert fb.strengths == ["Clear structure", "Good examples"]


def test_feedback_result_score_bounds_low():
    bad = {**VALID_FEEDBACK, "clarity_score": 0}
    with pytest.raises(ValidationError):
        FeedbackResult(**bad)


def test_feedback_result_score_bounds_high():
    bad = {**VALID_FEEDBACK, "overall_score": 11}
    with pytest.raises(ValidationError):
        FeedbackResult(**bad)


def test_feedback_result_missing_field():
    bad = {k: v for k, v in VALID_FEEDBACK.items() if k != "question"}
    with pytest.raises(ValidationError):
        FeedbackResult(**bad)


def test_feedback_result_empty_lists_ok():
    fb = FeedbackResult(**{**VALID_FEEDBACK, "strengths": [], "improvements": []})
    assert fb.strengths == []


# ── TranscriptMessage ─────────────────────────────────────────────────────────

def test_transcript_message_defaults():
    msg = TranscriptMessage(text="Hello world")
    assert msg.type == "transcript"
    assert msg.is_final is True
    assert msg.text == "Hello world"


def test_transcript_message_partial():
    msg = TranscriptMessage(text="Hello", is_final=False)
    assert msg.is_final is False


# ── ErrorMessage ──────────────────────────────────────────────────────────────

def test_error_message():
    err = ErrorMessage(message="Something went wrong")
    assert err.type == "error"
    assert err.message == "Something went wrong"


def test_error_message_missing_message():
    with pytest.raises(ValidationError):
        ErrorMessage()  # type: ignore
