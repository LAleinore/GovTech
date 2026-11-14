import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Centralized application configuration loaded from environment variables and .env file.
    Designed with secure defaults and masked sensitive representations.
    """
    # Application Metadata
    APP_NAME: str = "FireGuard 360"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    API_V1_PREFIX: str = "/api/v1"
    DEMO_MODE: bool = True

    # Security
    SECRET_KEY: str = "fireguard-dev-insecure-secret-key-change-in-production-minimum-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./fireguard.db"
    SYNC_DATABASE_URL: str = "sqlite:///./fireguard.db"

    # PostgreSQL specific helper credentials (for docker-compose / health probes)
    POSTGRES_USER: str = "fireguard"
    POSTGRES_PASSWORD: str = "fireguard_secret"
    POSTGRES_DB: str = "fireguard360"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    # CORS
    ALLOWED_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL.lower()

    @property
    def is_postgres(self) -> bool:
        return "postgres" in self.DATABASE_URL.lower()

    def get_masked_dict(self) -> dict:
        """Returns a sanitized dict safe for debugging and health responses without leaking secrets."""
        return {
            "app_name": self.APP_NAME,
            "version": self.APP_VERSION,
            "env": self.APP_ENV,
            "debug": self.DEBUG,
            "demo_mode": self.DEMO_MODE,
            "database_type": "sqlite" if self.is_sqlite else "postgresql",
            "cors_origins": self.ALLOWED_ORIGINS,
        }

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


# Instantiate singleton settings instance
settings = Settings()

