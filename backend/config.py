from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    groq_api_key: str
    openai_api_key: str = ""          # kept for backwards compat; not used by default
    whisper_model: str = "whisper-large-v3-turbo"
    groq_llm_model: str = "llama-3.3-70b-versatile"
    edge_tts_voice: str = "en-US-GuyNeural"
    cors_origins: List[str] = ["http://localhost:5173"]
    session_secret: str = "change-me-in-production"
    database_url: str = "sqlite+aiosqlite:///./echocoach.db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
