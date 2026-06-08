import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    role: Mapped[str] = mapped_column(String(256), default="")
    jd: Mapped[str] = mapped_column(Text, default="")
    mode: Mapped[str] = mapped_column(String(32), default="behavioral")
    difficulty: Mapped[str] = mapped_column(String(16), default="mid")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    avg_overall: Mapped[float] = mapped_column(Float, default=0.0)
    question_count: Mapped[int] = mapped_column(Integer, default=0)

    entries: Mapped[list["FeedbackEntry"]] = relationship(
        "FeedbackEntry", back_populates="session", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "role": self.role,
            "mode": self.mode,
            "difficulty": self.difficulty,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "avg_overall": round(self.avg_overall, 1),
            "question_count": self.question_count,
        }


class FeedbackEntry(Base):
    __tablename__ = "feedback_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), nullable=False)
    turn: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    question: Mapped[str] = mapped_column(Text, default="")
    answer_transcript: Mapped[str] = mapped_column(Text, default="")
    clarity_score: Mapped[int] = mapped_column(Integer, default=0)
    relevance_score: Mapped[int] = mapped_column(Integer, default=0)
    confidence_score: Mapped[int] = mapped_column(Integer, default=0)
    overall_score: Mapped[int] = mapped_column(Integer, default=0)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    improvements: Mapped[list] = mapped_column(JSON, default=list)
    ideal_answer_hint: Mapped[str] = mapped_column(Text, default="")
    follow_up_question: Mapped[str] = mapped_column(Text, default="")

    session: Mapped["Session"] = relationship("Session", back_populates="entries")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "turn": self.turn,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "question": self.question,
            "answer_transcript": self.answer_transcript,
            "clarity_score": self.clarity_score,
            "relevance_score": self.relevance_score,
            "confidence_score": self.confidence_score,
            "overall_score": self.overall_score,
            "strengths": self.strengths,
            "improvements": self.improvements,
            "ideal_answer_hint": self.ideal_answer_hint,
            "follow_up_question": self.follow_up_question,
        }
