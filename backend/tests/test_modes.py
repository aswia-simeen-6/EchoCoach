"""
test_modes.py - Tests for prompts/modes.py covering all 12 mode x difficulty combos.
"""

import pytest
from prompts.modes import InterviewMode, Difficulty, get_prompt_for_mode

ALL_MODES = list(InterviewMode)
ALL_DIFFICULTIES = list(Difficulty)
ALL_COMBOS = [(m, d) for m in ALL_MODES for d in ALL_DIFFICULTIES]


# ── Enum sanity ───────────────────────────────────────────────────────────────

def test_four_modes():
    assert len(ALL_MODES) == 4


def test_three_difficulties():
    assert len(ALL_DIFFICULTIES) == 3


# ── get_prompt_for_mode: all 12 combos ───────────────────────────────────────

@pytest.mark.parametrize("mode,difficulty", ALL_COMBOS)
def test_prompt_returns_non_empty_string(mode, difficulty):
    prompt = get_prompt_for_mode(mode, difficulty, role="SWE", jd="Build cool stuff")
    assert isinstance(prompt, str)
    assert len(prompt) > 200


@pytest.mark.parametrize("mode,difficulty", ALL_COMBOS)
def test_prompt_contains_mode_label(mode, difficulty):
    from prompts.modes import _MODE_LABELS
    prompt = get_prompt_for_mode(mode, difficulty, role="SWE", jd="")
    assert _MODE_LABELS[mode] in prompt


@pytest.mark.parametrize("mode,difficulty", ALL_COMBOS)
def test_prompt_contains_difficulty_label(mode, difficulty):
    from prompts.modes import _DIFFICULTY_LABELS
    prompt = get_prompt_for_mode(mode, difficulty, role="SWE", jd="")
    assert _DIFFICULTY_LABELS[difficulty] in prompt


@pytest.mark.parametrize("mode,difficulty", ALL_COMBOS)
def test_prompt_contains_json_schema(mode, difficulty):
    prompt = get_prompt_for_mode(mode, difficulty, role="SWE", jd="")
    assert '"question"' in prompt
    assert '"overall_score"' in prompt
    assert '"follow_up_question"' in prompt


# ── Interpolation edge cases ──────────────────────────────────────────────────

def test_prompt_uses_custom_role():
    prompt = get_prompt_for_mode(
        InterviewMode.TECHNICAL, Difficulty.SENIOR, role="Staff Engineer", jd=""
    )
    assert "Staff Engineer" in prompt


def test_prompt_uses_jd_when_provided():
    prompt = get_prompt_for_mode(
        InterviewMode.BEHAVIORAL, Difficulty.MID, role="SWE", jd="Build distributed systems at scale"
    )
    assert "distributed systems" in prompt


def test_prompt_handles_empty_jd():
    prompt = get_prompt_for_mode(
        InterviewMode.SYSTEM_DESIGN, Difficulty.JUNIOR, role="SWE", jd=""
    )
    assert "Not provided" in prompt


def test_prompt_handles_empty_role():
    prompt = get_prompt_for_mode(
        InterviewMode.CODING, Difficulty.MID, role="", jd=""
    )
    assert "Software Engineer" in prompt


# ── Behavioral-specific content ───────────────────────────────────────────────

def test_behavioral_junior_mentions_star():
    prompt = get_prompt_for_mode(InterviewMode.BEHAVIORAL, Difficulty.JUNIOR, "SWE", "")
    assert "STAR" in prompt


def test_behavioral_senior_mentions_strategy():
    prompt = get_prompt_for_mode(InterviewMode.BEHAVIORAL, Difficulty.SENIOR, "SWE", "")
    assert "strategic" in prompt.lower()


# ── Technical-specific content ────────────────────────────────────────────────

def test_technical_junior_mentions_data_structures():
    prompt = get_prompt_for_mode(InterviewMode.TECHNICAL, Difficulty.JUNIOR, "SWE", "")
    assert "data structure" in prompt.lower()


def test_technical_senior_mentions_distributed():
    prompt = get_prompt_for_mode(InterviewMode.TECHNICAL, Difficulty.SENIOR, "SWE", "")
    assert "distributed" in prompt.lower()


# ── System design ─────────────────────────────────────────────────────────────

def test_system_design_senior_mentions_sharding():
    prompt = get_prompt_for_mode(InterviewMode.SYSTEM_DESIGN, Difficulty.SENIOR, "SWE", "")
    assert "sharding" in prompt.lower() or "shard" in prompt.lower()


# ── Coding ───────────────────────────────────────────────────────────────────

def test_coding_mid_mentions_complexity():
    prompt = get_prompt_for_mode(InterviewMode.CODING, Difficulty.MID, "SWE", "")
    assert "complexity" in prompt.lower()
