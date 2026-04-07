"""Central configuration for PrivateLens API."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "PrivateLens API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # Cache TTL in seconds (1 hour)
    CACHE_TTL: int = 3600

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 30

    # Data collector timeouts
    HTTP_TIMEOUT: float = 8.0

    # CORS
    ALLOWED_ORIGINS: list = ["*"]

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
