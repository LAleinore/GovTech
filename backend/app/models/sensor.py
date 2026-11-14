from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import (
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin, utc_now
from app.models.enums import SensorType, SensorStatus

if TYPE_CHECKING:
    from app.models.building import Zone
    from app.models.alarm import Alarm
    from app.models.maintenance import MaintenanceTask


class Sensor(Base, TimestampMixin):
    """
    Physical or simulated fire safety sensors (smoke detectors, heat sensors, gas sensors, etc.).
    Includes 3D spatial coordinates [pos_x, pos_y, pos_z] for Digital Twin visualization.
    """
    __tablename__ = "sensors"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    zone_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sensor_type: Mapped[SensorType] = mapped_column(
        SAEnum(SensorType, native_enum=False, length=50),
        default=SensorType.SMOKE,
        nullable=False,
        index=True,
    )
    status: Mapped[SensorStatus] = mapped_column(
        SAEnum(SensorStatus, native_enum=False, length=50),
        default=SensorStatus.NORMAL,
        nullable=False,
        index=True,
    )

    # 3D Digital Twin Coordinates (Local space relative to building/floor origin)
    pos_x: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    pos_y: Mapped[float] = mapped_column(Float, default=2.8, nullable=False) # e.g. ceiling height
    pos_z: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Diagnostics & Health
    battery_level: Mapped[float] = mapped_column(Float, default=100.0, nullable=False) # 0.0 - 100.0 %
    signal_strength: Mapped[float] = mapped_column(Float, default=100.0, nullable=False) # 0.0 - 100.0 %
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Meta
    model_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    firmware_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    zone: Mapped[Optional["Zone"]] = relationship("Zone", back_populates="sensors")
    readings: Mapped[List["SensorReading"]] = relationship(
        "SensorReading",
        back_populates="sensor",
        cascade="all, delete-orphan",
        order_by="desc(SensorReading.timestamp)",
    )
    alarms: Mapped[List["Alarm"]] = relationship(
        "Alarm",
        back_populates="sensor",
    )
    maintenance_tasks: Mapped[List["MaintenanceTask"]] = relationship(
        "MaintenanceTask",
        back_populates="sensor",
    )


class SensorReading(Base):
    """
    Telemetry timeseries records for sensor metrics (temperature, smoke obscuration, etc.).
    Always tagged with is_demo to guarantee separation between live test data and physical hardware.
    """
    __tablename__ = "sensor_readings"
    __table_args__ = (
        Index("ix_sensor_readings_sensor_timestamp", "sensor_id", "timestamp"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sensor_id: Mapped[int] = mapped_column(
        ForeignKey("sensors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    metric_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False) # e.g. "°C", "%/m", "ppm"
    battery_level: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    signal_strength: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )

    # Relationships
    sensor: Mapped["Sensor"] = relationship("Sensor", back_populates="readings")

