from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.enums import SensorType, SensorStatus


class SensorReadingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sensor_id: int
    metric_type: str
    value: float
    unit: str
    battery_level: Optional[float] = None
    signal_strength: Optional[float] = None
    is_demo: bool
    timestamp: datetime


class SensorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    zone_id: Optional[int] = None
    code: str
    name: str
    sensor_type: SensorType
    status: SensorStatus
    pos_x: float
    pos_y: float
    pos_z: float
    battery_level: float
    signal_strength: float
    last_seen_at: Optional[datetime] = None
    model_number: Optional[str] = None
    firmware_version: Optional[str] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    latest_reading: Optional[SensorReadingRead] = None


class SensorCurrentReadingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sensor_id: int
    sensor_code: str
    sensor_name: str
    sensor_type: SensorType
    status: SensorStatus
    zone_id: Optional[int] = None
    metric_type: str
    value: float
    unit: str
    battery_level: Optional[float] = None
    signal_strength: Optional[float] = None
    is_demo: bool
    timestamp: datetime

