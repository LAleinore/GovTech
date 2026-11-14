from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import (
    User,
    UserRole,
    Building,
    Floor,
    Zone,
    ZoneType,
    RiskLevel,
    Sensor,
    SensorType,
    SensorStatus,
    SensorReading,
    Alarm,
    AlarmSeverity,
    AlarmStatus,
    Incident,
    IncidentPriority,
    IncidentStatus,
    IncidentLog,
    MaintenanceTask,
    MaintenanceType,
    MaintenanceStatus,
    Notification,
    NotificationType,
    NotificationPriority,
)


def test_full_domain_models_creation_and_relations(db_session: Session):
    user = User(
        email="operator@fireguard.internal",
        hashed_password="fake-hashed-password",
        full_name="Alexey Smirnov",
        role=UserRole.DISPATCHER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    building = Building(
        code="BLD-HQ",
        name="Main Engineering Tower",
        address="100 Digital Boulevard",
        floors_count=5,
    )
    db_session.add(building)
    db_session.flush()

    floor = Floor(
        building_id=building.id,
        floor_number=2,
        name="2nd Floor - Laboratory",
        elevation_meters=7.2,
    )
    db_session.add(floor)
    db_session.flush()

    zone = Zone(
        floor_id=floor.id,
        code="R-204",
        name="Server & Electronics Lab",
        zone_type=ZoneType.SERVER_ROOM,
        risk_level=RiskLevel.HIGH,
        polygon_coordinates="[[0, 0], [12.5, 0], [12.5, 8.0], [0, 8.0]]",
    )
    db_session.add(zone)
    db_session.flush()

    sensor = Sensor(
        zone_id=zone.id,
        code="SN-204-SMK",
        name="Optical Smoke Detector 204-A",
        sensor_type=SensorType.SMOKE,
        status=SensorStatus.NORMAL,
        pos_x=6.25,
        pos_y=2.85,
        pos_z=4.0,
        battery_level=98.5,
        signal_strength=94.0,
        is_demo=True,
    )
    db_session.add(sensor)
    db_session.flush()

    reading = SensorReading(
        sensor_id=sensor.id,
        metric_type="SMOKE_OBSCURATION",
        value=0.03,
        unit="%/m",
        battery_level=98.5,
        signal_strength=94.0,
        is_demo=True,
    )
    db_session.add(reading)

    alarm = Alarm(
        sensor_id=sensor.id,
        zone_id=zone.id,
        title="Elevated Smoke Obscuration Detected",
        severity=AlarmSeverity.HIGH,
        status=AlarmStatus.ACTIVE,
        trigger_value=2.45,
        threshold_value=1.50,
        is_demo=True,
    )
    db_session.add(alarm)
    db_session.flush()

    incident = Incident(
        incident_number="INC-2026-0001",
        alarm_id=alarm.id,
        zone_id=zone.id,
        title="Fire Investigation in Server Lab R-204",
        priority=IncidentPriority.HIGH,
        status=IncidentStatus.NEW,
        assigned_user_id=user.id,
        is_demo=True,
    )
    db_session.add(incident)
    db_session.flush()

    log_entry = IncidentLog(
        incident_id=incident.id,
        actor_id=user.id,
        action="INCIDENT_ASSIGNED",
        previous_state="NEW",
        new_state="IN_PROGRESS",
        notes="Dispatcher assigned technician to investigate alarm.",
    )
    db_session.add(log_entry)

    task = MaintenanceTask(
        sensor_id=sensor.id,
        assigned_user_id=user.id,
        title="Annual Smoke Sensor Recalibration",
        task_type=MaintenanceType.RECALIBRATION,
        status=MaintenanceStatus.SCHEDULED,
        is_demo=True,
    )
    db_session.add(task)

    notif = Notification(
        user_id=user.id,
        title="High Priority Incident Assigned",
        message="Incident INC-2026-0001 assigned to your queue.",
        notification_type=NotificationType.INCIDENT,
        priority=NotificationPriority.URGENT,
    )
    db_session.add(notif)
    db_session.commit()

    found_building = db_session.execute(
        select(Building).where(Building.code == "BLD-HQ")
    ).scalar_one()
    assert found_building.name == "Main Engineering Tower"


def test_historical_integrity_preservation_on_delete(db_session: Session):
    user = User(
        email="leaving_employee@fireguard.internal",
        hashed_password="pw",
        full_name="Dmitry Morozov",
        role=UserRole.TECHNICIAN,
    )
    db_session.add(user)

    building = Building(code="BLD-AUDIT", name="Audit Wing", address="Test St 1")
    db_session.add(building)
    db_session.flush()

    floor = Floor(building_id=building.id, floor_number=1, name="1F")
    db_session.add(floor)
    db_session.flush()

    zone = Zone(floor_id=floor.id, code="Z-AUDIT", name="Audit Zone", zone_type=ZoneType.CORRIDOR)
    db_session.add(zone)
    db_session.flush()

    sensor = Sensor(zone_id=zone.id, code="SN-AUDIT", name="Sensor for Audit", sensor_type=SensorType.HEAT)
    db_session.add(sensor)
    db_session.flush()

    alarm = Alarm(
        sensor_id=sensor.id,
        zone_id=zone.id,
        title="Audit Alarm",
        severity=AlarmSeverity.CRITICAL,
        status=AlarmStatus.ACTIVE,
        trigger_value=75.0,
        threshold_value=60.0,
        acknowledged_by_id=user.id,
    )
    db_session.add(alarm)
    db_session.flush()

    incident = Incident(
        incident_number="INC-AUDIT-99",
        alarm_id=alarm.id,
        zone_id=zone.id,
        title="Audit Incident",
        assigned_user_id=user.id,
    )
    db_session.add(incident)
    db_session.flush()

    log_entry = IncidentLog(
        incident_id=incident.id,
        actor_id=user.id,
        action="NOTE_ADDED",
        notes="Sample investigation note by operator.",
    )
    db_session.add(log_entry)
    db_session.commit()

    # Delete user and sensor
    db_session.delete(user)
    db_session.delete(sensor)
    db_session.commit()
    db_session.expire_all()

    refetched_incident = db_session.get(Incident, incident.id)
    assert refetched_incident is not None
    assert refetched_incident.assigned_user_id is None

    refetched_log = db_session.get(IncidentLog, log_entry.id)
    assert refetched_log is not None
    assert refetched_log.actor_id is None

    refetched_alarm = db_session.get(Alarm, alarm.id)
    assert refetched_alarm is not None
    assert refetched_alarm.sensor_id is None
