"""
Application configuration.
Loads all required environment variables and fails fast with a clear error
if any are missing. Uses pydantic-settings for validated config.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    All required environment variables for the salesrun backend.
    Values are loaded from the .env file in the backend directory.
    The app will refuse to start if any required variable is missing.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    supabase_url: str
    supabase_service_key: str
    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"

    # Optional: CORS origins (comma-separated). Defaults to allow all during dev.
    cors_origins: str = "*"

    # Optional: server host and port for reference (uvicorn uses its own CLI args)
    host: str = "0.0.0.0"
    port: int = 8000


# Singleton instance — import this everywhere
settings = Settings()
