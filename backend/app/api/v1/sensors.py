from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.building import Floor, Zone
from app.models.sensor import Sensor, SensorReading
from app.models.enums import SensorType, SensorStatus
from app.schemas.sensor import (
    SensorRead,
    SensorReadingRead,
    SensorCurrentReadingRead,
)

router = APIRouter(prefix="/sensors", tags=["Sensors & Telemetry"])


def _attach_latest_reading(db: Session, sensor: Sensor) -> SensorRead:
    """Fetches the most recent reading for a sensor from the database and attaches it to the DTO."""
    latest = db.execute(
        select(SensorReading)
        .where(SensorReading.sensor_id == sensor.id)
        .order_by(desc(SensorReading.timestamp), desc(SensorReading.id))
        .limit(1)
    ).scalar_one_or_none()

    sensor_dto = SensorRead.model_validate(sensor)
    if latest is not None:
        sensor_dto.latest_reading = SensorReadingRead.model_validate(latest)
    return sensor_dto


@router.get("", response_model=List[SensorRead], status_code=status.HTTP_200_OK)
def list_sensors(
    building_id: Optional[int] = Query(None, gt=0, description="Filter by building ID"),
    floor_id: Optional[int] = Query(None, gt=0, description="Filter by floor ID"),
    zone_id: Optional[int] = Query(None, gt=0, description="Filter by zone ID"),
    sensor_type: Optional[SensorType] = Query(None, description="Filter by sensor hardware type"),
    sensor_status: Optional[SensorStatus] = Query(None, alias="status", description="Filter by operational status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    db: Session = Depends(get_db),
) -> List[SensorRead]:
    """Retrieve list of sensors with their current operational state and latest reading."""
    stmt = select(Sensor)

    if building_id is not None or floor_id is not None:
        stmt = stmt.join(Zone, Sensor.zone_id == Zone.id)
        if floor_id is not None:
            stmt = stmt.where(Zone.floor_id == floor_id)
        if building_id is not None:
            stmt = stmt.join(Floor, Zone.floor_id == Floor.id).where(Floor.building_id == building_id)

    if zone_id is not None:
        stmt = stmt.where(Sensor.zone_id == zone_id)
    if sensor_type is not None:
        stmt = stmt.where(Sensor.sensor_type == sensor_type)
    if sensor_status is not None:
        stmt = stmt.where(Sensor.status == sensor_status)

    stmt = stmt.order_by(Sensor.id).offset(skip).limit(limit)
    sensors = db.execute(stmt).scalars().all()
    return [_attach_latest_reading(db, s) for s in sensors]


@router.get("/readings", response_model=List[SensorCurrentReadingRead], status_code=status.HTTP_200_OK)
@router.get("/readings/current", response_model=List[SensorCurrentReadingRead], status_code=status.HTTP_200_OK)
def get_current_sensor_readings(
    building_id: Optional[int] = Query(None, gt=0, description="Filter by building ID"),
    zone_id: Optional[int] = Query(None, gt=0, description="Filter by zone ID"),
    sensor_id: Optional[int] = Query(None, gt=0, description="Filter by specific sensor ID"),
    db: Session = Depends(get_db),
) -> List[SensorCurrentReadingRead]:
    """Retrieve the latest reading for each matching sensor from the database."""
    stmt = select(Sensor)
    if building_id is not None:
        stmt = (
            stmt.join(Zone, Sensor.zone_id == Zone.id)
            .join(Floor, Zone.floor_id == Floor.id)
            .where(Floor.building_id == building_id)
        )
    if zone_id is not None:
        stmt = stmt.where(Sensor.zone_id == zone_id)
    if sensor_id is not None:
        stmt = stmt.where(Sensor.id == sensor_id)

    sensors = db.execute(stmt.order_by(Sensor.id)).scalars().all()
    results: List[SensorCurrentReadingRead] = []

    for sensor in sensors:
        latest = db.execute(
            select(SensorReading)
            .where(SensorReading.sensor_id == sensor.id)
            .order_by(desc(SensorReading.timestamp), desc(SensorReading.id))
            .limit(1)
        ).scalar_one_or_none()

        if latest is not None:
            results.append(
                SensorCurrentReadingRead(
                    sensor_id=sensor.id,
                    sensor_code=sensor.code,
                    sensor_name=sensor.name,
                    sensor_type=sensor.sensor_type,
                    status=sensor.status,
                    zone_id=sensor.zone_id,
                    metric_type=latest.metric_type,
                    value=latest.value,
                    unit=latest.unit,
                    battery_level=latest.battery_level if latest.battery_level is not None else sensor.battery_level,
                    signal_strength=latest.signal_strength if latest.signal_strength is not None else sensor.signal_strength,
                    is_demo=latest.is_demo,
                    timestamp=latest.timestamp,
                )
            )

    return results


@router.get("/{sensor_id}", response_model=SensorRead, status_code=status.HTTP_200_OK)
def get_sensor(
    sensor_id: int = Path(..., gt=0, description="Unique ID of the sensor"),
    db: Session = Depends(get_db),
) -> SensorRead:
    """Retrieve a single sensor and its latest reading."""
    sensor = db.get(Sensor, sensor_id)
    if sensor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sensor with id={sensor_id} not found",
        )
    return _attach_latest_reading(db, sensor)


@router.get("/{sensor_id}/readings", response_model=List[SensorReadingRead], status_code=status.HTTP_200_OK)
def get_sensor_readings(
    sensor_id: int = Path(..., gt=0, description="Unique ID of the sensor"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of readings to return"),
    db: Session = Depends(get_db),
) -> List[SensorReadingRead]:
    """Retrieve telemetry readings for a specific sensor ordered from newest to oldest."""
    sensor = db.get(Sensor, sensor_id)
    if sensor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sensor with id={sensor_id} not found",
        )

    stmt = (
        select(SensorReading)
        .where(SensorReading.sensor_id == sensor_id)
        .order_by(desc(SensorReading.timestamp), desc(SensorReading.id))
        .limit(limit)
    )
    readings = db.execute(stmt).scalars().all()
    return [SensorReadingRead.model_validate(r) for r in readings]

