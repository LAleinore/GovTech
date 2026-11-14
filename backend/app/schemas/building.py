from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import ZoneType, RiskLevel


class ZoneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    floor_id: int
    code: str
    name: str
    zone_type: ZoneType
    risk_level: RiskLevel
    polygon_coordinates: Optional[str] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime


class FloorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    building_id: int
    floor_number: int
    name: str
    elevation_meters: float
    plan_image_url: Optional[str] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    zones: List[ZoneRead] = Field(default_factory=list)


class BuildingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    address: str
    floors_count: int
    description: Optional[str] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime


class BuildingDetailRead(BuildingRead):
    floors: List[FloorRead] = Field(default_factory=list)

