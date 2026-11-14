#!/usr/bin/env python3
"""
FireGuard 360 — Idempotent Database Seeder for Hackathon 2026.
Creates a complete Architectural Digital Twin:
- Building: 'Инженерно-лабораторный корпус Alpha' (3 floors, 6 zones)
- Hardware Sensors: Smoke, Heat, Gas with 3D coordinates and telemetry
- Personnel: Admin, Operator, Technician
- Maintenance Orders: Overdue, In Progress, Completed
- Historical Incident: Closed with resolution report for MTTR analytics

Usage:
    python backend/seed.py [--reset]
"""

import sys
import os
import argparse
import shutil
import hashlib
from datetime import datetime, timezone, timedelta

# Ensure backend directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
root_dir = os.path.dirname(current_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from sqlalchemy import select, delete
from app.database.base import Base
from app.database.session import engine, SessionLocal
from app.models.enums import (
    UserRole,
    ZoneType,
    RiskLevel,
    SensorType,
    SensorStatus,
    AlarmSeverity,
    AlarmStatus,
    IncidentPriority,
    IncidentStatus,
    MaintenanceType,
    MaintenanceStatus,
)
from app.models.building import Building, Floor, Zone
from app.models.sensor import Sensor, SensorReading
from app.models.alarm import Alarm
from app.models.incident import Incident, IncidentLog
from app.models.user import User
from app.models.maintenance import MaintenanceTask


def sync_db_files():
    """Ensures fireguard.db is identical at project root and backend/."""
    root_db = os.path.join(root_dir, "fireguard.db")
    backend_db = os.path.join(current_dir, "fireguard.db")
    
    # Check which one exists or is newer
    if os.path.exists(backend_db) and os.path.exists(root_db):
        if os.path.getmtime(backend_db) > os.path.getmtime(root_db):
            shutil.copyfile(backend_db, root_db)
        else:
            shutil.copyfile(root_db, backend_db)
    elif os.path.exists(backend_db):
        shutil.copyfile(backend_db, root_db)
    elif os.path.exists(root_db):
        shutil.copyfile(root_db, backend_db)


def seed_database(reset: bool = False):
    print("=" * 70)
    print(" FIREGUARD 360 // SEEDING DIGITAL TWIN DATABASE")
    print("=" * 70)

    # 1. Ensure all schema tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if reset:
            print("[INFO] Reset mode active. Purging existing demo records...")
            # Delete in child-to-parent order to respect foreign key constraints
            db.execute(delete(IncidentLog))
            db.execute(delete(Incident))
            db.execute(delete(Alarm))
            db.execute(delete(SensorReading))
            db.execute(delete(MaintenanceTask))
            db.execute(delete(Sensor))
            db.execute(delete(Zone))
            db.execute(delete(Floor))
            db.execute(delete(Building).where(Building.code == "BLD-ALPHA"))
            db.execute(delete(User).where(User.email.in_([
                "admin@fireguard.local",
                "operator@fireguard.local",
                "tech@fireguard.local",
            ])))
            db.commit()

        now = datetime.now(timezone.utc)

        # ---------------------------------------------------------------------
        # 1. PERSONNEL & ACCESS CONTROL (USERS)
        # ---------------------------------------------------------------------
        users_meta = [
            {
                "email": "admin@fireguard.local",
                "full_name": "Воронов А. С. (Главный инженер)",
                "role": UserRole.ADMIN,
                "password": "AdminPassword360!",
            },
            {
                "email": "operator@fireguard.local",
                "full_name": "Кузнецова Е. М. (Дежурный диспетчер)",
                "role": UserRole.OPERATOR,
                "password": "OperatorPassword360!",
            },
            {
                "email": "tech@fireguard.local",
                "full_name": "Смирнов И. П. (Старший техник ПБ)",
                "role": UserRole.TECHNICIAN,
                "password": "TechPassword360!",
            },
        ]

        users_dict = {}
        for u in users_meta:
            existing_user = db.execute(select(User).where(User.email == u["email"])).scalars().first()
            if not existing_user:
                new_user = User(
                    email=u["email"],
                    hashed_password=hashlib.sha256(u["password"].encode("utf-8")).hexdigest(),
                    full_name=u["full_name"],
                    role=u["role"],
                    is_active=True,
                    is_demo=True,
                )
                db.add(new_user)
                db.flush()
                users_dict[u["email"]] = new_user
            else:
                users_dict[u["email"]] = existing_user

        print(f"[OK] Seeded {len(users_dict)} personnel accounts (Admin, Operator, Technician).")

        # ---------------------------------------------------------------------
        # 2. BUILDING DIGITAL TWIN (3 FLOORS, 6 ZONES)
        # ---------------------------------------------------------------------
        building = db.execute(select(Building).where(Building.code == "BLD-ALPHA")).scalars().first()
        if not building:
            building = Building(
                code="BLD-ALPHA",
                name="Инженерно-лабораторный корпус Alpha",
                address="Технопарк Сколково, Инновационный проезд, д. 4",
                floors_count=3,
                description="Главный демонстрационный объект платформы FireGuard 360 с трехэтажной процедурной 3D-моделью.",
                is_demo=True,
            )
            db.add(building)
            db.flush()

        floors_meta = [
            {"num": 1, "name": "Этаж 1 — Вестибюль, КПП и электрощитовые", "elevation": 0.0},
            {"num": 2, "name": "Этаж 2 — Серверный кластер и лаборатории", "elevation": 3.5},
            {"num": 3, "name": "Этаж 3 — Ситуационный центр и диспетчерская", "elevation": 7.0},
        ]

        floors_dict = {}
        for f in floors_meta:
            fl = db.execute(
                select(Floor).where(Floor.building_id == building.id, Floor.floor_number == f["num"])
            ).scalars().first()
            if not fl:
                fl = Floor(
                    building_id=building.id,
                    floor_number=f["num"],
                    name=f["name"],
                    elevation_meters=f["elevation"],
                    is_demo=True,
                )
                db.add(fl)
                db.flush()
            floors_dict[f["num"]] = fl

        zones_meta = [
            # Floor 1
            {"code": "Z-101", "name": "Главный вестибюль и турникеты", "floor": 1, "type": ZoneType.LOBBY, "risk": RiskLevel.LOW},
            {"code": "Z-102", "name": "Центральная электрощитовая", "floor": 1, "type": ZoneType.ELECTRICAL_ROOM, "risk": RiskLevel.HIGH},
            # Floor 2
            {"code": "Z-201", "name": "Серверный зал и ЦОД", "floor": 2, "type": ZoneType.SERVER_ROOM, "risk": RiskLevel.CRITICAL},
            {"code": "Z-202", "name": "Лаборатория микроэлектроники", "floor": 2, "type": ZoneType.OFFICE, "risk": RiskLevel.MEDIUM},
            # Floor 3
            {"code": "Z-301", "name": "Ситуационный центр мониторинга", "floor": 3, "type": ZoneType.OFFICE, "risk": RiskLevel.LOW},
            {"code": "Z-302", "name": "Инженерный отсек и архив", "floor": 3, "type": ZoneType.CORRIDOR, "risk": RiskLevel.MEDIUM},
        ]

        zones_dict = {}
        for z in zones_meta:
            fl = floors_dict[z["floor"]]
            zn = db.execute(
                select(Zone).where(Zone.floor_id == fl.id, Zone.code == z["code"])
            ).scalars().first()
            if not zn:
                zn = Zone(
                    floor_id=fl.id,
                    code=z["code"],
                    name=z["name"],
                    zone_type=z["type"],
                    risk_level=z["risk"],
                    is_demo=True,
                )
                db.add(zn)
                db.flush()
            zones_dict[z["code"]] = zn

        print(f"[OK] Seeded Building '{building.name}' with 3 Floors and 6 Compartment Zones.")

        # ---------------------------------------------------------------------
        # 3. FIRE SAFETY SENSORS WITH 3D COORDINATES
        # ---------------------------------------------------------------------
        sensors_meta = [
            {
                "code": "SN-101-SMK",
                "name": "Оптический извещатель дыма ИП 212-141",
                "zone_code": "Z-101",
                "type": SensorType.SMOKE,
                "status": SensorStatus.NORMAL,
                "pos_x": -3.5, "pos_y": 2.8, "pos_z": 1.2,
                "metric": "SMOKE_OBSCURATION", "val": 0.03, "unit": "%/m",
            },
            {
                "code": "SN-102-GAS",
                "name": "Газоанализатор угарного газа CO электрощитовой",
                "zone_code": "Z-102",
                "type": SensorType.GAS,
                "status": SensorStatus.NORMAL,
                "pos_x": 3.8, "pos_y": 2.2, "pos_z": 1.2,
                "metric": "CO_CONCENTRATION", "val": 1.5, "unit": "ppm",
            },
            {
                "code": "SN-201-HEAT",
                "name": "Дифференциальный тепловой извещатель ИП 101-29",
                "zone_code": "Z-201",
                "type": SensorType.HEAT,
                "status": SensorStatus.NORMAL,
                "pos_x": -3.2, "pos_y": 2.8, "pos_z": 4.8,
                "metric": "TEMPERATURE", "val": 22.4, "unit": "°C",
            },
            {
                "code": "SN-202-SMK",
                "name": "Оптический датчик лаборатории ИП 212",
                "zone_code": "Z-202",
                "type": SensorType.SMOKE,
                "status": SensorStatus.NORMAL,
                "pos_x": 3.2, "pos_y": 2.8, "pos_z": 4.8,
                "metric": "SMOKE_OBSCURATION", "val": 0.04, "unit": "%/m",
            },
            {
                "code": "SN-301-SMK",
                "name": "Дымовой извещатель диспетчерского зала",
                "zone_code": "Z-301",
                "type": SensorType.SMOKE,
                "status": SensorStatus.NORMAL,
                "pos_x": -2.0, "pos_y": 2.8, "pos_z": 8.4,
                "metric": "SMOKE_OBSCURATION", "val": 0.02, "unit": "%/m",
            },
            {
                "code": "SN-302-HEAT",
                "name": "Тепловой извещатель инженерного отсека",
                "zone_code": "Z-302",
                "type": SensorType.HEAT,
                "status": SensorStatus.NORMAL,
                "pos_x": 2.5, "pos_y": 2.8, "pos_z": 8.4,
                "metric": "TEMPERATURE", "val": 21.8, "unit": "°C",
            },
        ]

        sensors_dict = {}
        for s in sensors_meta:
            zn = zones_dict[s["zone_code"]]
            sensor = db.execute(select(Sensor).where(Sensor.code == s["code"])).scalars().first()
            if not sensor:
                sensor = Sensor(
                    code=s["code"],
                    name=s["name"],
                    zone_id=zn.id,
                    sensor_type=s["type"],
                    status=s["status"],
                    pos_x=s["pos_x"],
                    pos_y=s["pos_y"],
                    pos_z=s["pos_z"],
                    battery_level=96.0,
                    signal_strength=94.0,
                    last_seen_at=now,
                    is_demo=True,
                )
                db.add(sensor)
                db.flush()
                # Initial baseline reading
                db.add(SensorReading(
                    sensor_id=sensor.id,
                    metric_type=s["metric"],
                    value=s["val"],
                    unit=s["unit"],
                    battery_level=96.0,
                    signal_strength=94.0,
                    timestamp=now - timedelta(minutes=5),
                    is_demo=True,
                ))
            sensors_dict[s["code"]] = sensor

        print(f"[OK] Seeded {len(sensors_dict)} Fire Safety Sensors with 3D coordinates & telemetry.")

        # ---------------------------------------------------------------------
        # 4. MAINTENANCE TASKS (REGULATION ORDERS)
        # ---------------------------------------------------------------------
        tech_user = users_dict["tech@fireguard.local"]
        admin_user = users_dict["admin@fireguard.local"]

        # Check if tasks exist
        existing_tasks = db.execute(select(MaintenanceTask)).scalars().all()
        if not existing_tasks:
            # Overdue task (for analytics demonstration)
            t_overdue = MaintenanceTask(
                title="Ежеквартальная поверка оптической камеры ИП 212",
                description="Очистка оптопары от пыли и замер чувствительности на тестовом аэрозоле.",
                task_type=MaintenanceType.INSPECTION,
                status=MaintenanceStatus.PENDING,
                sensor_id=sensors_dict["SN-101-SMK"].id,
                assigned_user_id=tech_user.id,
                scheduled_date=now - timedelta(days=2),
                is_demo=True,
            )
            # In progress task
            t_progress = MaintenanceTask(
                title="Плановая замена элемента питания CR123A",
                description="Замена резервного источника питания в серверном тепловом узле.",
                task_type=MaintenanceType.BATTERY_REPLACEMENT,
                status=MaintenanceStatus.IN_PROGRESS,
                sensor_id=sensors_dict["SN-201-HEAT"].id,
                assigned_user_id=tech_user.id,
                scheduled_date=now + timedelta(days=2),
                is_demo=True,
            )
            # Completed task with report
            t_done = MaintenanceTask(
                title="Метрологическая калибровка газоанализатора CO",
                description="Поверка контрольной смесью CO 50 ppm в электрощитовой.",
                task_type=MaintenanceType.RECALIBRATION,
                status=MaintenanceStatus.COMPLETED,
                sensor_id=sensors_dict["SN-102-GAS"].id,
                assigned_user_id=tech_user.id,
                scheduled_date=now - timedelta(days=8),
                completed_date=now - timedelta(days=7),
                resolution_notes="Калибровка успешно проведена. Погрешность сенсора 0.4 ppm соответствует ГОСТ Р 53325.",
                is_demo=True,
            )
            db.add(t_overdue)
            db.add(t_progress)
            db.add(t_done)
            db.flush()
            print("[OK] Seeded Maintenance Orders (Overdue, In-Progress, Completed).")

        # ---------------------------------------------------------------------
        # 5. HISTORICAL RESOLVED INCIDENT (FOR MTTR ANALYTICS)
        # ---------------------------------------------------------------------
        past_inc_exists = db.execute(
            select(Incident).where(Incident.incident_number == "INC-DEMO-HISTORICAL")
        ).scalars().first()

        if not past_inc_exists:
            alarm_hist = Alarm(
                sensor_id=sensors_dict["SN-201-HEAT"].id,
                zone_id=zones_dict["Z-201"].id,
                title="Учебная тревога: Локальный перегрев стойки ЦОД",
                description="Зафиксирована температура 58.4°C при проведении нагрузочного теста вентиляции.",
                severity=AlarmSeverity.HIGH,
                status=AlarmStatus.RESOLVED,
                trigger_value=58.4,
                threshold_value=55.0,
                triggered_at=now - timedelta(hours=3),
                acknowledged_at=now - timedelta(hours=2, minutes=55),
                resolved_at=now - timedelta(hours=2, minutes=30),
                is_demo=True,
            )
            db.add(alarm_hist)
            db.flush()

            inc_hist = Incident(
                incident_number="INC-DEMO-HISTORICAL",
                alarm_id=alarm_hist.id,
                zone_id=zones_dict["Z-201"].id,
                title="Инцидент: Перегрев серверного оборудования",
                description="Контроль теплового режима при проведении плановых работ.",
                priority=IncidentPriority.HIGH,
                status=IncidentStatus.CLOSED,
                assigned_user_id=admin_user.id,
                resolution_notes="Резервный прецизионный кондиционер введён в работу. Температура стабилизирована до 22.0°C.",
                created_at=now - timedelta(hours=2, minutes=50),
                closed_at=now - timedelta(hours=2, minutes=30),
                is_demo=True,
            )
            db.add(inc_hist)
            db.flush()

            db.add(IncidentLog(
                incident_id=inc_hist.id,
                actor_id=admin_user.id,
                action="STATUS_CHANGED_TO_CLOSED",
                previous_state=IncidentStatus.RESOLVED.value,
                new_state=IncidentStatus.CLOSED.value,
                notes="Инцидент штатно закрыт после проверки тепловизором.",
                created_at=now - timedelta(hours=2, minutes=30),
            ))
            print("[OK] Seeded Historical Closed Incident for realistic MTTR metric computation.")

        db.commit()
        print("=" * 70)
        print(" SEEDING COMPLETED SUCCESSFULLY! ALL DATA MARKED is_demo=True")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed during seeding: {e}", file=sys.stderr)
        raise
    finally:
        db.close()
        # Synchronize DB files across directories
        sync_db_files()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FireGuard 360 Idempotent Database Seeder")
    parser.add_argument("--reset", action="store_true", help="Purge and re-seed all demo entities")
    args = parser.parse_args()

    seed_database(reset=args.reset)
