"""
memory.py - Session-scoped message history store.

Each session gets its own list of LangChain BaseMessage objects.
Clearing on disconnect prevents memory leaks across long-running servers.
"""

from langchain_core.messages import BaseMessage

# session_id -> list of messages (HumanMessage | AIMessage alternating)
_store: dict[str, list[BaseMessage]] = {}


def get_history(session_id: str) -> list[BaseMessage]:
    """Return the message list for this session, creating it if absent."""
    if session_id not in _store:
        _store[session_id] = []
    return _store[session_id]


def append_messages(session_id: str, *messages: BaseMessage) -> None:
    """Append one or more messages to the session history."""
    history = get_history(session_id)
    history.extend(messages)


def clear_history(session_id: str) -> None:
    """Remove the session history on disconnect."""
    _store.pop(session_id, None)


def session_count() -> int:
    """Return the number of active sessions (useful for monitoring)."""
    return len(_store)
