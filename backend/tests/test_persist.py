"""
test_persist.py - Unit tests for pipeline/persist.py using in-memory SQLite.

Each test gets a fresh isolated DB so there is no state bleed.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from db import Base
from pipeline import persist as persist_module


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture()
async def db_session(tmp_path):
    """Create a fresh in-memory SQLite engine for each test."""
    db_file = tmp_path / "test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False)
    async with engine.begin() as conn:
        from models import db_models  # register ORM models
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    # Patch the module-level factory so persist functions use the test DB
    original = persist_module.AsyncSessionLocal
    persist_module.AsyncSessionLocal = session_factory
    yield session_factory
    persist_module.AsyncSessionLocal = original
    await engine.dispose()


FEEDBACK = {
    "question": "Tell me about yourself.",
    "answer_transcript": "I build distributed systems.",
    "clarity_score": 8,
    "relevance_score": 7,
    "confidence_score": 9,
    "overall_score": 8,
    "strengths": ["Clear"],
    "improvements": ["Examples"],
    "ideal_answer_hint": "Quantify impact.",
    "follow_up_question": "Tell me about a hard problem.",
}


# ── save_session ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_save_session_creates_row(db_session):
    from pipeline.persist import save_session
    from models.db_models import Session
    await save_session("s1", role="SWE", jd="Build stuff")
    async with db_session() as db:
        row = await db.get(Session, "s1")
    assert row is not None
    assert row.role == "SWE"


@pytest.mark.asyncio
async def test_save_session_idempotent(db_session):
    from pipeline.persist import save_session
    from models.db_models import Session
    await save_session("s2", role="PM", jd="")
    await save_session("s2", role="PM", jd="")   # second call — should not fail
    async with db_session() as db:
        row = await db.get(Session, "s2")
    assert row is not None


# ── save_feedback ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_save_feedback_creates_entry(db_session):
    from pipeline.persist import save_session, save_feedback
    from models.db_models import FeedbackEntry
    from sqlalchemy import select
    await save_session("s3", role="SWE", jd="")
    await save_feedback("s3", turn=1, feedback=FEEDBACK)
    async with db_session() as db:
        result = await db.execute(
            select(FeedbackEntry).where(FeedbackEntry.session_id == "s3")
        )
        entries = result.scalars().all()
    assert len(entries) == 1
    assert entries[0].overall_score == 8
    assert entries[0].turn == 1


@pytest.mark.asyncio
async def test_save_feedback_updates_aggregates(db_session):
    from pipeline.persist import save_session, save_feedback
    from models.db_models import Session
    await save_session("s4", role="SWE", jd="")
    await save_feedback("s4", turn=1, feedback={**FEEDBACK, "overall_score": 6})
    await save_feedback("s4", turn=2, feedback={**FEEDBACK, "overall_score": 8})
    async with db_session() as db:
        row = await db.get(Session, "s4")
    assert row.question_count == 2
    assert abs(row.avg_overall - 7.0) < 0.01


# ── get_all_sessions ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_all_sessions_returns_list(db_session):
    from pipeline.persist import save_session, get_all_sessions
    await save_session("s5", role="Designer", jd="")
    sessions = await get_all_sessions()
    ids = [s["id"] for s in sessions]
    assert "s5" in ids


@pytest.mark.asyncio
async def test_get_all_sessions_empty_ok(db_session):
    from pipeline.persist import get_all_sessions
    sessions = await get_all_sessions()
    assert isinstance(sessions, list)


# ── get_session_detail ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_session_detail_includes_entries(db_session):
    from pipeline.persist import save_session, save_feedback, get_session_detail
    await save_session("s6", role="SWE", jd="")
    await save_feedback("s6", turn=1, feedback=FEEDBACK)
    detail = await get_session_detail("s6")
    assert detail is not None
    assert detail["id"] == "s6"
    assert len(detail["entries"]) == 1
    assert detail["entries"][0]["question"] == "Tell me about yourself."


@pytest.mark.asyncio
async def test_get_session_detail_not_found(db_session):
    from pipeline.persist import get_session_detail
    result = await get_session_detail("nonexistent-id")
    assert result is None


# ── end_session ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_end_session_sets_ended_at(db_session):
    from pipeline.persist import save_session, end_session
    from models.db_models import Session
    await save_session("s7", role="SWE", jd="")
    await end_session("s7")
    async with db_session() as db:
        row = await db.get(Session, "s7")
    assert row.ended_at is not None
