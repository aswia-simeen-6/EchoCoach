import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from db import AsyncSessionLocal
from models.db_models import Session, FeedbackEntry

logger = logging.getLogger(__name__)


async def save_session(session_id: str, role: str, jd: str, mode: str = "behavioral", difficulty: str = "mid") -> None:
    try:
        async with AsyncSessionLocal() as db:
            existing = await db.get(Session, session_id)
            if existing is None:
                db.add(Session(id=session_id, role=role, jd=jd, mode=mode, difficulty=difficulty))
                await db.commit()
    except SQLAlchemyError as exc:
        logger.error("save_session failed: %s", exc)


async def save_feedback(session_id: str, turn: int, feedback: dict) -> None:
    try:
        async with AsyncSessionLocal() as db:
            entry = FeedbackEntry(
                session_id=session_id,
                turn=turn,
                question=feedback.get("question", ""),
                answer_transcript=feedback.get("answer_transcript", ""),
                clarity_score=feedback.get("clarity_score", 0),
                relevance_score=feedback.get("relevance_score", 0),
                confidence_score=feedback.get("confidence_score", 0),
                overall_score=feedback.get("overall_score", 0),
                strengths=feedback.get("strengths", []),
                improvements=feedback.get("improvements", []),
                ideal_answer_hint=feedback.get("ideal_answer_hint", ""),
                follow_up_question=feedback.get("follow_up_question", ""),
            )
            db.add(entry)
            session_row = await db.get(Session, session_id)
            if session_row:
                session_row.question_count += 1
                total = (session_row.avg_overall * (session_row.question_count - 1)
                         + feedback.get("overall_score", 0))
                session_row.avg_overall = total / session_row.question_count
            await db.commit()
    except SQLAlchemyError as exc:
        logger.error("save_feedback failed: %s", exc)


async def end_session(session_id: str) -> None:
    try:
        async with AsyncSessionLocal() as db:
            row = await db.get(Session, session_id)
            if row:
                row.ended_at = datetime.now(timezone.utc)
                await db.commit()
    except SQLAlchemyError as exc:
        logger.error("end_session failed: %s", exc)


async def get_all_sessions(limit: int = 50) -> list[dict]:
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Session).order_by(Session.started_at.desc()).limit(limit)
            )
            return [row.to_dict() for row in result.scalars()]
    except SQLAlchemyError as exc:
        logger.error("get_all_sessions failed: %s", exc)
        return []


async def get_session_detail(session_id: str) -> dict | None:
    try:
        async with AsyncSessionLocal() as db:
            row = await db.get(Session, session_id)
            if row is None:
                return None
            result = await db.execute(
                select(FeedbackEntry)
                .where(FeedbackEntry.session_id == session_id)
                .order_by(FeedbackEntry.turn)
            )
            return {**row.to_dict(), "entries": [e.to_dict() for e in result.scalars()]}
    except SQLAlchemyError as exc:
        logger.error("get_session_detail failed: %s", exc)
        return None
