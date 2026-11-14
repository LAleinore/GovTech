import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import AlarmStatus, IncidentStatus, MaintenanceStatus, SensorStatus, UserRole


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_e2e_7_step_user_scenario(client: TestClient):
    """
    End-to-End Validation of the complete FireGuard 360 User Scenario (Module 13):
    1. System launch & Dashboard data loading
    2. 3D Digital Twin building and floors discovery
    3. Sensors monitoring, filtering, and telemetry history
    4. Fire safety demo simulation trigger & real-time alarm generation
    5. Alarm acknowledgment, incident generation, and validated lifecycle closing
    6. Personnel registry & Technical maintenance order lifecycle
    7. Analytical overview calculation & unified audit event log
    """

    # -------------------------------------------------------------------------
    # STEP 1: System launch & Dashboard data loading
    # -------------------------------------------------------------------------
    res_bld = client.get("/api/v1/buildings")
    assert res_bld.status_code == 200
    buildings = res_bld.json()
    assert len(buildings) >= 1
    building_id = buildings[0]["id"]

    res_bld_detail = client.get(f"/api/v1/buildings/{building_id}")
    assert res_bld_detail.status_code == 200
    building = res_bld_detail.json()
    assert "floors" in building
    assert len(building["floors"]) >= 1

    # -------------------------------------------------------------------------
    # STEP 2: 3D Digital Twin building and floors discovery
    # -------------------------------------------------------------------------
    res_sensors = client.get("/api/v1/sensors")
    assert res_sensors.status_code == 200
    sensors = res_sensors.json()
    assert len(sensors) >= 3

    # Verify sensor coordinates are available for 3D placement
    for s in sensors:
        assert "pos_x" in s
        assert "pos_y" in s
        assert "pos_z" in s

    # -------------------------------------------------------------------------
    # STEP 3: Sensors monitoring, filtering, and telemetry history
    # -------------------------------------------------------------------------
    # Filter by sensor type
    res_filtered = client.get("/api/v1/sensors?sensor_type=SMOKE")
    assert res_filtered.status_code == 200
    for s in res_filtered.json():
        assert s["sensor_type"] == "SMOKE"

    # Query sensor telemetry readings history
    target_sensor_id = sensors[0]["id"]
    res_readings = client.get(f"/api/v1/sensors/{target_sensor_id}/readings")
    assert res_readings.status_code == 200
    assert isinstance(res_readings.json(), list)

    # -------------------------------------------------------------------------
    # STEP 4: Fire safety demo simulation trigger & real-time alarm generation
    # -------------------------------------------------------------------------
    res_sim = client.post("/api/v1/simulation/scenario", json={"scenario": "FIRE_ALARM"})
    assert res_sim.status_code == 200
    sim_data = res_sim.json()
    assert sim_data["scenario"] == "FIRE_ALARM"
    assert sim_data["is_demo"] is True
    assert sim_data["alarm"] is not None

    # Verify an active alarm exists
    res_alarms = client.get("/api/v1/alarms?status=ACTIVE")
    assert res_alarms.status_code == 200
    active_alarms = res_alarms.json()
    assert len(active_alarms) >= 1

    active_alarm = active_alarms[0]
    alarm_id = active_alarm["id"]
    assert active_alarm["is_demo"] is True

    # -------------------------------------------------------------------------
    # STEP 5: Alarm acknowledgment, incident generation, and validated lifecycle closing
    # -------------------------------------------------------------------------
    # 5.1 Acknowledge alarm
    res_ack = client.post(f"/api/v1/alarms/{alarm_id}/acknowledge")
    assert res_ack.status_code == 200
    assert res_ack.json()["status"] == "ACKNOWLEDGED"

    # 5.2 Create incident from alarm
    res_create_inc = client.post(f"/api/v1/alarms/{alarm_id}/create-incident")
    assert res_create_inc.status_code in (200, 201)
    incident_id = res_create_inc.json()["id"]

    # 5.3 Fetch incident details
    res_inc = client.get(f"/api/v1/incidents/{incident_id}")
    assert res_inc.status_code == 200
    inc_detail = res_inc.json()
    assert inc_detail["status"] in ("NEW", "ACKNOWLEDGED")

    # 5.4 Transition to IN_PROGRESS
    res_in_prog = client.patch(
        f"/api/v1/incidents/{incident_id}/status",
        json={
            "new_status": "IN_PROGRESS",
            "notes": "Пожарный расчёт выдвинулся на осмотр зоны.",
            "actor_name": "Диспетчер Alpha",
        },
    )
    assert res_in_prog.status_code == 200
    assert res_in_prog.json()["status"] == "IN_PROGRESS"

    # 5.5 Attempt to CLOSE without resolution notes (must fail with 422)
    res_close_fail = client.patch(
        f"/api/v1/incidents/{incident_id}/status",
        json={
            "new_status": "CLOSED",
            "notes": "Закрытие без отчёта",
            "actor_name": "Диспетчер Alpha",
        },
    )
    assert res_close_fail.status_code == 422

    # 5.6 Transition to RESOLVED then CLOSED with mandatory resolution notes
    res_resolved = client.patch(
        f"/api/v1/incidents/{incident_id}/status",
        json={
            "new_status": "RESOLVED",
            "notes": "Очаг тления локализован дежурным персоналом.",
            "actor_name": "Диспетчер Alpha",
        },
    )
    assert res_resolved.status_code == 200

    res_closed = client.patch(
        f"/api/v1/incidents/{incident_id}/status",
        json={
            "new_status": "CLOSED",
            "notes": "Помещение проветрено, оборудование возвращено в штатный режим.",
            "resolution_notes": "Ложное срабатывание при проведении ремонтных работ. Система переведена в норму.",
            "actor_name": "Диспетчер Alpha",
        },
    )
    assert res_closed.status_code == 200
    assert res_closed.json()["status"] == "CLOSED"
    assert res_closed.json()["resolution_notes"] is not None

    # Verify audit logs in incident
    assert len(res_closed.json()["logs"]) >= 3

    # -------------------------------------------------------------------------
    # STEP 6: Personnel registry & Technical maintenance order lifecycle
    # -------------------------------------------------------------------------
    # 6.1 Users list and creation
    res_users = client.get("/api/v1/users")
    assert res_users.status_code == 200
    initial_user_count = len(res_users.json())

    test_email = f"scenario_tech_{int(datetime.now(timezone.utc).timestamp())}@fireguard.local"
    res_new_user = client.post(
        "/api/v1/users",
        json={
            "full_name": "Тестовый Инженер Сценария",
            "email": test_email,
            "role": "TECHNICIAN",
            "password": "Password123!",
        },
    )
    assert res_new_user.status_code == 201
    tech_id = res_new_user.json()["id"]

    # 6.2 Maintenance task creation
    res_task = client.post(
        "/api/v1/maintenance",
        json={
            "title": "Внеплановая калибровка теплового сенсора",
            "sensor_id": target_sensor_id,
            "assigned_user_name": "Тестовый Инженер Сценария",
            "task_type": "RECALIBRATION",
            "description": "Проведение контрольного замера после теплового инцидента.",
        },
    )
    assert res_task.status_code == 201
    task_id = res_task.json()["id"]

    # 6.3 Complete maintenance task with report
    res_task_complete = client.post(
        f"/api/v1/maintenance/{task_id}/complete",
        json={
            "resolution_notes": "Калибровка выполнена эталонным термометром. Погрешность 0.1°C в пределах нормы.",
        },
    )
    assert res_task_complete.status_code == 200
    assert res_task_complete.json()["status"] == "COMPLETED"

    # -------------------------------------------------------------------------
    # STEP 7: Analytical overview calculation & unified audit event log
    # -------------------------------------------------------------------------
    # 7.1 Overview
    res_overview = client.get("/api/v1/analytics/overview?period=ALL")
    assert res_overview.status_code == 200
    overview = res_overview.json()
    assert overview["alarms_count"] >= 1
    assert overview["closed_incidents_count"] >= 1
    assert overview["total_maintenance_count"] >= 1
    assert overview["sensor_states"]["total"] >= 3

    # 7.2 Unified events stream
    res_events = client.get("/api/v1/analytics/events?limit=50")
    assert res_events.status_code == 200
    events = res_events.json()
    assert len(events) >= 1

    # Verify event types are unified
    event_types = {e["event_type"] for e in events}
    assert any("ALARM" in et or "STATUS" in et or "MAINTENANCE" in et for et in event_types)

    # Reset simulation back to NORMAL for clean state
    res_norm = client.post("/api/v1/simulation/scenario", json={"scenario": "NORMAL"})
    assert res_norm.status_code == 200
