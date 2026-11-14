import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.v1.buildings import (
    list_buildings,
    get_building,
    get_building_floors,
    get_building_zones,
)
from app.api.v1.sensors import (
    list_sensors,
    get_sensor,
    get_sensor_readings,
    get_current_sensor_readings,
)
from app.models import (
    Building,
    Floor,
    Zone,
    ZoneType,
    RiskLevel,
    Sensor,
    SensorType,
    SensorStatus,
    SensorReading,
)


def _seed_sample_data(db: Session):
    building = Building(
        code="BLD-TEST",
        name="Test Building",
        address="Test Ave 10",
        floors_count=1,
        is_demo=True,
    )
    db.add(building)
    db.flush()

    floor = Floor(
        building_id=building.id,
        floor_number=1,
        name="Ground Floor",
        elevation_meters=0.0,
        is_demo=True,
    )
    db.add(floor)
    db.flush()

    zone = Zone(
        floor_id=floor.id,
        code="Z-100",
        name="Server Room",
        zone_type=ZoneType.SERVER_ROOM,
        risk_level=RiskLevel.HIGH,
        is_demo=True,
    )
    db.add(zone)
    db.flush()

    sensor = Sensor(
        zone_id=zone.id,
        code="SN-TEST-01",
        name="Smoke Sensor 01",
        sensor_type=SensorType.SMOKE,
        status=SensorStatus.NORMAL,
        pos_x=1.0,
        pos_y=2.8,
        pos_z=3.0,
        battery_level=98.0,
        signal_strength=95.0,
        is_demo=True,
    )
    db.add(sensor)
    db.flush()

    reading = SensorReading(
        sensor_id=sensor.id,
        metric_type="SMOKE_OBSCURATION",
        value=0.05,
        unit="%/m",
        battery_level=98.0,
        signal_strength=95.0,
        is_demo=True,
    )
    db.add(reading)
    db.commit()
    return building, floor, zone, sensor, reading


def test_buildings_and_sensors_endpoints(db_session: Session):
    building, floor, zone, sensor, _ = _seed_sample_data(db_session)

    # 1. List buildings
    buildings = list_buildings(skip=0, limit=50, db=db_session)
    assert len(buildings) == 1
    assert buildings[0].code == "BLD-TEST"

    # 2. Get specific building with floors & zones
    detail = get_building(building_id=building.id, db=db_session)
    assert detail.id == building.id
    assert len(detail.floors) == 1
    assert len(detail.floors[0].zones) == 1
    assert detail.floors[0].zones[0].code == "Z-100"

    # 3. Get floors and zones
    floors = get_building_floors(building_id=building.id, db=db_session)
    assert len(floors) == 1
    zones = get_building_zones(building_id=building.id, floor_id=floor.id, zone_type=None, db=db_session)
    assert len(zones) == 1
    assert zones[0].id == zone.id

    # 4. List sensors and latest reading
    sensors = list_sensors(
        building_id=building.id,
        floor_id=None,
        zone_id=None,
        sensor_type=None,
        sensor_status=None,
        skip=0,
        limit=100,
        db=db_session,
    )
    assert len(sensors) == 1
    assert sensors[0].code == "SN-TEST-01"
    assert sensors[0].latest_reading is not None
    assert sensors[0].latest_reading.value == 0.05

    # 5. Get current sensor readings
    current_readings = get_current_sensor_readings(
        building_id=building.id,
        zone_id=None,
        sensor_id=None,
        db=db_session,
    )
    assert len(current_readings) == 1
    assert current_readings[0].sensor_code == "SN-TEST-01"
    assert current_readings[0].value == 0.05

    # 6. Get single sensor and its readings
    single_sensor = get_sensor(sensor_id=sensor.id, db=db_session)
    assert single_sensor.id == sensor.id
    readings = get_sensor_readings(sensor_id=sensor.id, limit=10, db=db_session)
    assert len(readings) == 1

    # 7. Error handling (404 Not Found)
    with pytest.raises(HTTPException) as exc_info:
        get_building(building_id=9999, db=db_session)
    assert exc_info.value.status_code == 404

    with pytest.raises(HTTPException) as exc_info_sensor:
        get_sensor(sensor_id=9999, db=db_session)
    assert exc_info_sensor.value.status_code == 404

