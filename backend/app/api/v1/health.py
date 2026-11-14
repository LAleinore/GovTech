from datetime import datetime, timezone
from fastapi import APIRouter, status
from app.core.config import settings
from app.database.session import check_db_connection
from app.schemas.health import HealthResponse, DatabaseStatus

router = APIRouter(tags=["Health & Diagnostics"])


@router.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
def get_health_status() -> HealthResponse:
    """Performs full health diagnostic check."""
    db_healthy, db_message, db_details = check_db_connection()
    overall_status = "healthy" if db_healthy else "degraded"

    return HealthResponse(
        status=overall_status,
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
        demo_mode=settings.DEMO_MODE,
        timestamp=datetime.now(timezone.utc),
        database=DatabaseStatus(
            connected=db_healthy,
            dialect=db_details.get("dialect", "unknown"),
            message=db_message,
            details=db_details,
        ),
    )
