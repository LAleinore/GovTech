from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.alarm import Alarm
    from app.models.incident import Incident, IncidentLog
    from app.models.maintenance import MaintenanceTask
    from app.models.notification import Notification


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, native_enum=False, length=50),
        default=UserRole.DISPATCHER,
        nullable=False,
        index=True,
    )
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships (History preserved: user deletion does NOT cascade-delete audit trails)
    acknowledged_alarms: Mapped[List["Alarm"]] = relationship(
        "Alarm",
        back_populates="acknowledged_by",
        foreign_keys="[Alarm.acknowledged_by_id]",
    )
    assigned_incidents: Mapped[List["Incident"]] = relationship(
        "Incident",
        back_populates="assigned_user",
        foreign_keys="[Incident.assigned_user_id]",
    )
    incident_logs: Mapped[List["IncidentLog"]] = relationship(
        "IncidentLog",
        back_populates="actor",
        foreign_keys="[IncidentLog.actor_id]",
    )
    maintenance_tasks: Mapped[List["MaintenanceTask"]] = relationship(
        "MaintenanceTask",
        back_populates="assigned_user",
        foreign_keys="[MaintenanceTask.assigned_user_id]",
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )

