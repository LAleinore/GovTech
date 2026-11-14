from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import (
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin
from app.models.enums import MaintenanceType, MaintenanceStatus

if TYPE_CHECKING:
    from app.models.sensor import Sensor
    from app.models.user import User


class MaintenanceTask(Base, TimestampMixin):
    """
    Scheduled or reactive maintenance orders for sensors, valves, and fire safety equipment.
    """
    __tablename__ = "maintenance_tasks"
    __table_args__ = (
        Index("ix_maintenance_tasks_status", "status"),
        Index("ix_maintenance_tasks_scheduled_date", "scheduled_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sensor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("sensors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    task_type: Mapped[MaintenanceType] = mapped_column(
        SAEnum(MaintenanceType, native_enum=False, length=50),
        default=MaintenanceType.INSPECTION,
        nullable=False,
    )
    status: Mapped[MaintenanceStatus] = mapped_column(
        SAEnum(MaintenanceStatus, native_enum=False, length=50),
        default=MaintenanceStatus.SCHEDULED,
        nullable=False,
    )
    scheduled_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    sensor: Mapped[Optional["Sensor"]] = relationship("Sensor", back_populates="maintenance_tasks")
    assigned_user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="maintenance_tasks",
        foreign_keys=[assigned_user_id],
    )

