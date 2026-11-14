from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Integer, Float, Text, Boolean, ForeignKey, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin
from app.models.enums import ZoneType, RiskLevel

if TYPE_CHECKING:
    from app.models.sensor import Sensor
    from app.models.alarm import Alarm
    from app.models.incident import Incident


class Building(Base, TimestampMixin):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    floors_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    floors: Mapped[List["Floor"]] = relationship(
        "Floor",
        back_populates="building",
        cascade="all, delete-orphan",
        order_by="Floor.floor_number",
    )


class Floor(Base, TimestampMixin):
    __tablename__ = "floors"
    __table_args__ = (
        UniqueConstraint("building_id", "floor_number", name="uq_building_floor_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    building_id: Mapped[int] = mapped_column(
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    floor_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    elevation_meters: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    plan_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    building: Mapped["Building"] = relationship("Building", back_populates="floors")
    zones: Mapped[List["Zone"]] = relationship(
        "Zone",
        back_populates="floor",
        cascade="all, delete-orphan",
    )


class Zone(Base, TimestampMixin):
    """
    Zones represent distinct fire compartments, rooms, corridors, or functional spaces.
    Used for 3D bounding mesh visualization, risk assessment, and incident localization.
    """
    __tablename__ = "zones"
    __table_args__ = (
        UniqueConstraint("floor_id", "code", name="uq_floor_zone_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    floor_id: Mapped[int] = mapped_column(
        ForeignKey("floors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    zone_type: Mapped[ZoneType] = mapped_column(
        SAEnum(ZoneType, native_enum=False, length=50),
        default=ZoneType.OFFICE,
        nullable=False,
        index=True,
    )
    risk_level: Mapped[RiskLevel] = mapped_column(
        SAEnum(RiskLevel, native_enum=False, length=50),
        default=RiskLevel.MEDIUM,
        nullable=False,
    )
    # 3D spatial boundary: JSON string of polygon vertices [[x1, z1], [x2, z2], ...] and height
    polygon_coordinates: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    floor: Mapped["Floor"] = relationship("Floor", back_populates="zones")
    sensors: Mapped[List["Sensor"]] = relationship("Sensor", back_populates="zone")
    alarms: Mapped[List["Alarm"]] = relationship("Alarm", back_populates="zone")
    incidents: Mapped[List["Incident"]] = relationship("Incident", back_populates="zone")

