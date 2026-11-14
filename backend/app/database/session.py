import logging
from typing import Generator, Tuple, Dict, Any
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

# Normalize URL to standard synchronous driver for reliable cross-platform operation
db_url = settings.SYNC_DATABASE_URL.replace("+aiosqlite", "").replace("+asyncpg", "")

engine_kwargs: Dict[str, Any] = {
    "future": True,
}

if "sqlite" in db_url.lower():
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(db_url, **engine_kwargs)

if "sqlite" in db_url.lower():
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    expire_on_commit=False,
    autoflush=False,
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_db_connection() -> Tuple[bool, str, Dict[str, Any]]:
    """Executes SELECT 1 to verify database connectivity."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            if result.scalar() == 1:
                return (
                    True,
                    "Database connection operational",
                    {"dialect": engine.dialect.name, "pool_status": "ok"},
                )
            return (False, "Database returned unexpected response", {})
    except Exception as exc:
        logger.error(f"Database healthcheck failed: {exc}")
        return (False, str(exc), {"dialect": engine.dialect.name})


def init_db() -> None:
    """Ensures all ORM tables exist and seeds initial baseline records if database is empty."""
    import app.models  # noqa: F401
    from app.database.base import Base
    from app.models.building import Building, Floor, Zone
    from app.models.sensor import Sensor, SensorReading
    from app.models.enums import ZoneType, RiskLevel, SensorType, SensorStatus

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        existing_building = db.query(Building).first()
        if existing_building is None:
            building = Building(
                code="BLD-ALPHA",
                name="Инженерно-лабораторный корпус Alpha",
                address="Технопарк, корпус 1",
                floors_count=2,
                description="Главный демонстрационный корпус цифрового двойника FireGuard 360",
                is_demo=True,
            )
            db.add(building)
            db.flush()

            floor1 = Floor(
                building_id=building.id,
                floor_number=1,
                name="1 этаж — Входная группа и диспетчерская",
                elevation_meters=0.0,
                is_demo=True,
            )
            floor2 = Floor(
                building_id=building.id,
                floor_number=2,
                name="2 этаж — Серверная и лаборатории",
                elevation_meters=4.2,
                is_demo=True,
            )
            db.add_all([floor1, floor2])
            db.flush()

            zone1 = Zone(
                floor_id=floor1.id,
                code="Z-101",
                name="Главный вестибюль",
                zone_type=ZoneType.LOBBY,
                risk_level=RiskLevel.LOW,
                polygon_coordinates="[[0, 0], [15, 0], [15, 10], [0, 10]]",
                is_demo=True,
            )
            zone2 = Zone(
                floor_id=floor2.id,
                code="Z-201",
                name="Центральная серверная",
                zone_type=ZoneType.SERVER_ROOM,
                risk_level=RiskLevel.CRITICAL,
                polygon_coordinates="[[0, 0], [8, 0], [8, 6], [0, 6]]",
                is_demo=True,
            )
            zone3 = Zone(
                floor_id=floor2.id,
                code="Z-202",
                name="Электрощитовая",
                zone_type=ZoneType.ELECTRICAL_ROOM,
                risk_level=RiskLevel.HIGH,
                polygon_coordinates="[[8, 0], [15, 0], [15, 6], [8, 6]]",
                is_demo=True,
            )
            db.add_all([zone1, zone2, zone3])
            db.flush()

            s1 = Sensor(
                zone_id=zone1.id,
                code="SN-101-SMK",
                name="Датчик дыма Вестибюль-1",
                sensor_type=SensorType.SMOKE,
                status=SensorStatus.NORMAL,
                pos_x=7.5,
                pos_y=3.2,
                pos_z=5.0,
                battery_level=99.0,
                signal_strength=96.0,
                model_number="FG-SMK-300",
                firmware_version="1.4.2",
                is_demo=True,
            )
            s2 = Sensor(
                zone_id=zone2.id,
                code="SN-201-HEAT",
                name="Датчик температуры Серверная-А",
                sensor_type=SensorType.HEAT,
                status=SensorStatus.NORMAL,
                pos_x=4.0,
                pos_y=7.0,
                pos_z=3.0,
                battery_level=95.5,
                signal_strength=92.0,
                model_number="FG-THM-210",
                firmware_version="1.4.2",
                is_demo=True,
            )
            s3 = Sensor(
                zone_id=zone3.id,
                code="SN-202-GAS",
                name="Датчик CO Электрощитовая",
                sensor_type=SensorType.GAS,
                status=SensorStatus.NORMAL,
                pos_x=11.5,
                pos_y=7.0,
                pos_z=3.0,
                battery_level=97.0,
                signal_strength=90.5,
                model_number="FG-GAS-500",
                firmware_version="1.4.0",
                is_demo=True,
            )
            db.add_all([s1, s2, s3])
            db.flush()

            r1 = SensorReading(
                sensor_id=s1.id,
                metric_type="SMOKE_OBSCURATION",
                value=0.04,
                unit="%/m",
                battery_level=99.0,
                signal_strength=96.0,
                is_demo=True,
            )
            r2 = SensorReading(
                sensor_id=s2.id,
                metric_type="TEMPERATURE",
                value=22.4,
                unit="°C",
                battery_level=95.5,
                signal_strength=92.0,
                is_demo=True,
            )
            r3 = SensorReading(
                sensor_id=s3.id,
                metric_type="CO_PPM",
                value=3.1,
                unit="ppm",
                battery_level=97.0,
                signal_strength=90.5,
                is_demo=True,
            )
            db.add_all([r1, r2, r3])
            db.commit()


def close_db_connection() -> None:
    """Closes all connections in the pool."""
    engine.dispose()
