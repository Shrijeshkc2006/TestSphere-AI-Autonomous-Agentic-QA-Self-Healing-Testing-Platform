"""Application configuration via pydantic-settings."""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_ENV: str = "development"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Database — defaults to SQLite for zero-dependency local dev
    DATABASE_URL: str = "sqlite+aiosqlite:///./testsphere.db"
    DATABASE_URL_SYNC: str = "sqlite:///./testsphere.db"

    # Redis / Celery — optional for local dev
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # AI
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # File upload
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 100

    # Test execution
    PLAYWRIGHT_BROWSER: str = "chromium"
    TEST_TIMEOUT_SECONDS: int = 120
    CONTAINER_MEMORY_LIMIT: str = "512m"
    CONTAINER_CPU_LIMIT: float = 1.0

    # Self-healing
    SELF_HEAL_ENABLED: bool = True
    SELF_HEAL_CONFIDENCE_THRESHOLD: float = 0.75

    # Artifacts
    ARTIFACT_DIR: str = "./artifacts"
    ARTIFACT_RETENTION_DAYS: int = 30

    # Demo mode
    DEMO_MODE: bool = False

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    ALGORITHM: str = "HS256"

    @property
    def IS_SQLITE(self) -> bool:
        return "sqlite" in self.DATABASE_URL

    @property
    def ALLOWED_ORIGINS_LIST(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def MAX_UPLOAD_SIZE_BYTES(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def AI_AVAILABLE(self) -> bool:
        return bool(self.GOOGLE_API_KEY)

    @property
    def REDIS_AVAILABLE(self) -> bool:
        """Check if Redis is configured and reachable."""
        try:
            import redis
            r = redis.from_url(self.REDIS_URL, socket_connect_timeout=1)
            r.ping()
            return True
        except Exception:
            return False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
