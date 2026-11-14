from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
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
from app.database.base import Base, TimestampMixin, utc_now
from app.models.enums import IncidentPriority, IncidentStatus

if TYPE_CHECKING:
    from app.models.alarm import Alarm
    from app.models.building import Zone
    from app.models.user import User


class Incident(Base, TimestampMixin):
    """
    Formal operational incident created from a fire alarm or manual operator dispatch.
    Tracks assignment of response personnel, operational status, and resolution post-mortem.
    """
    __tablename__ = "incidents"
    __table_args__ = (
        Index("ix_incidents_status_priority", "status", "priority"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    incident_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    alarm_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("alarms.id", ondelete="SET NULL"),
        unique=True,
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
    priority: Mapped[IncidentPriority] = mapped_column(
        SAEnum(IncidentPriority, native_enum=False, length=50),
        default=IncidentPriority.HIGH,
        nullable=False,
        index=True,
    )
    status: Mapped[IncidentStatus] = mapped_column(
        SAEnum(IncidentStatus, native_enum=False, length=50),
        default=IncidentStatus.NEW,
        nullable=False,
        index=True,
    )
    assigned_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    alarm: Mapped[Optional["Alarm"]] = relationship("Alarm", back_populates="incident")
    zone: Mapped[Optional["Zone"]] = relationship("Zone", back_populates="incidents")
    assigned_user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="assigned_incidents",
        foreign_keys=[assigned_user_id],
    )
    logs: Mapped[List["IncidentLog"]] = relationship(
        "IncidentLog",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentLog.created_at",
    )


class IncidentLog(Base):
    """
    Immutable audit trail for all operational actions taken on an incident.
    Deleting an operator account never erases the historic actions they recorded (actor_id -> SET NULL).
    """
    __tablename__ = "incident_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    previous_state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    new_state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )

    # Relationships
    incident: Mapped["Incident"] = relationship("Incident", back_populates="logs")
    actor: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="incident_logs",
        foreign_keys=[actor_id],
    )

