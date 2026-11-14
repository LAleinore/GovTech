import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.database.session import check_db_connection, close_db_connection, init_db
from app.api.v1.router import api_v1_router
from app.services.simulation import ws_manager

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fireguard.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} [{settings.APP_ENV}]")
    init_db()
    db_ok, db_msg, db_info = check_db_connection()
    if db_ok:
        logger.info(f"Database connection verified: dialect={db_info.get('dialect')}")
    else:
        logger.warning(f"Database initial probe warning: {db_msg}")

    yield

    logger.info("Shutting down application resources...")
    close_db_connection()
    logger.info("Application shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Digital Twin Fire Safety Management Platform — Hackathon 2026",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "ValidationError",
            "message": "Invalid input parameters.",
            "details": exc.errors(),
            "path": request.url.path,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected server error occurred." if not settings.DEBUG else str(exc),
            "path": request.url.path,
        },
    )


app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)
app.include_router(api_v1_router, prefix="/api", include_in_schema=False)


@app.websocket("/ws/events")
@app.websocket("/ws")
async def websocket_events_endpoint(websocket: WebSocket):
    """Real-time WebSocket event bus broadcasting sensor telemetry and hazard alerts."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep alive and receive any client ping
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


@app.get("/", tags=["Root"])
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "demo_mode": settings.DEMO_MODE,
        "docs": "/docs",
        "health": "/api/health",
    }
