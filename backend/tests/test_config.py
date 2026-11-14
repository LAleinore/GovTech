import pytest
from app.core.config import Settings


def test_settings_load_defaults():
    settings = Settings()
    assert settings.APP_NAME == "FireGuard 360"
    assert settings.API_V1_PREFIX == "/api/v1"
    assert isinstance(settings.ALLOWED_ORIGINS, list)
    assert len(settings.ALLOWED_ORIGINS) > 0


def test_cors_origins_parsing():
    settings = Settings(ALLOWED_ORIGINS="http://localhost:5173, http://127.0.0.1:3000")
    assert settings.ALLOWED_ORIGINS == ["http://localhost:5173", "http://127.0.0.1:3000"]


def test_database_dialect_detection():
    sqlite_settings = Settings(DATABASE_URL="sqlite+aiosqlite:///./test.db")
    assert sqlite_settings.is_sqlite is True
    assert sqlite_settings.is_postgres is False

    pg_settings = Settings(DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/db")
    assert pg_settings.is_sqlite is False
    assert pg_settings.is_postgres is True


def test_settings_masked_dict_does_not_leak_secrets():
    settings = Settings()
    masked = settings.get_masked_dict()
    assert "secret_key" not in masked
    assert "SECRET_KEY" not in masked
    assert "password" not in masked
    assert "POSTGRES_PASSWORD" not in masked
    assert masked["app_name"] == "FireGuard 360"

