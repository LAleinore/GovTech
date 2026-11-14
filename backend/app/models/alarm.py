from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import (
    String,
    Float,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin, utc_now
from app.models.enums import AlarmSeverity, AlarmStatus

if TYPE_CHECKING:
    from app.models.sensor import Sensor
    from app.models.building import Zone
    from app.models.user import User
    from app.models.incident import Incident


class Alarm(Base, TimestampMixin):
    """
    Fire / Safety alarm event generated when sensor telemetry violates safety thresholds.
    Maintains historical integrity: deleting a sensor or user preserves the alarm record (SET NULL).
    """
    __tablename__ = "alarms"
    __table_args__ = (
        Index("ix_alarms_status_severity", "status", "severity"),
        Index("ix_alarms_triggered_at", "triggered_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sensor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("sensors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    zone_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[AlarmSeverity] = mapped_column(
        SAEnum(AlarmSeverity, native_enum=False, length=50),
        default=AlarmSeverity.HIGH,
        nullable=False,
        index=True,
    )
    status: Mapped[AlarmStatus] = mapped_column(
        SAEnum(AlarmStatus, native_enum=False, length=50),
        default=AlarmStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    # Telemetry threshold context
    trigger_value: Mapped[float] = mapped_column(Float, nullable=False)
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)

    # Timeline & Auditing
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Simulation safety flag
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    sensor: Mapped[Optional["Sensor"]] = relationship("Sensor", back_populates="alarms")
    zone: Mapped[Optional["Zone"]] = relationship("Zone", back_populates="alarms")
    acknowledged_by: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="acknowledged_alarms",
        foreign_keys=[acknowledged_by_id],
    )
    incident: Mapped[Optional["Incident"]] = relationship(
        "Incident",
        back_populates="alarm",
        uselist=False,
    )

