import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import WebSocket
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.models.alarm import Alarm
from app.models.enums import AlarmSeverity, AlarmStatus, SensorStatus, SensorType
from app.models.sensor import Sensor, SensorReading

logger = logging.getLogger("fireguard.simulation")


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts real-time telemetry events."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcasts a JSON-serializable dictionary to all active connections."""
        payload = json.dumps(message, default=str)
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket connection: {e}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)


# Global singleton instance of WebSocket connection manager
ws_manager = ConnectionManager()


def apply_simulation_scenario(db: Session, scenario: str) -> Dict[str, Any]:
    """
    Executes a controlled fire safety simulation scenario on the database.
    Updates sensor status, creates timestamped SensorReading with is_demo=True,
    and manages active alarms without creating duplicates.
    """
    now = datetime.now(timezone.utc)
    scenario_upper = scenario.upper().strip()

    # Find registered sensors
    sensors = db.execute(select(Sensor).order_by(Sensor.id)).scalars().all()
    if not sensors:
        raise ValueError("No sensors found in database to simulate.")

    sensor_map = {s.code: s for s in sensors}

    # Target specific sensors or pick first available
    smoke_sensor = sensor_map.get("SN-101-SMK", sensors[0])
    heat_sensor = sensor_map.get("SN-201-HEAT", sensors[1] if len(sensors) > 1 else sensors[0])
    gas_sensor = sensor_map.get("SN-202-GAS", sensors[2] if len(sensors) > 2 else sensors[-1])

    affected_sensor = heat_sensor
    new_alarm: Optional[Alarm] = None
    event_description = ""

    if scenario_upper == "NORMAL":
        event_description = "Штатный режим: все зоны в норме, пороговые значения восстановлены."
        # Reset all sensors to NORMAL
        for s in sensors:
            s.status = SensorStatus.NORMAL
            s.battery_level = max(s.battery_level, 95.0)
            s.signal_strength = max(s.signal_strength, 90.0)

        # Resolve any active demo alarms
        active_demo_alarms = db.execute(
            select(Alarm).where(Alarm.is_demo == True, Alarm.status == AlarmStatus.ACTIVE)
        ).scalars().all()
        for a in active_demo_alarms:
            a.status = AlarmStatus.RESOLVED
            a.resolved_at = now

        # Record normal telemetry
        db.add(SensorReading(
            sensor_id=smoke_sensor.id,
            metric_type="SMOKE_OBSCURATION",
            value=0.04,
            unit="%/m",
            battery_level=smoke_sensor.battery_level,
            signal_strength=smoke_sensor.signal_strength,
            is_demo=True,
            timestamp=now,
        ))
        db.add(SensorReading(
            sensor_id=heat_sensor.id,
            metric_type="TEMPERATURE",
            value=21.8,
            unit="°C",
            battery_level=heat_sensor.battery_level,
            signal_strength=heat_sensor.signal_strength,
            is_demo=True,
            timestamp=now,
        ))
        affected_sensor = heat_sensor

    elif scenario_upper == "SMOKE":
        event_description = "Обнаружение оптического задымления: превышен порог внимания в вестибюле."
        smoke_sensor.status = SensorStatus.WARNING
        reading = SensorReading(
            sensor_id=smoke_sensor.id,
            metric_type="SMOKE_OBSCURATION",
            value=0.38,
            unit="%/m",
            battery_level=smoke_sensor.battery_level,
            signal_strength=smoke_sensor.signal_strength,
            is_demo=True,
            timestamp=now,
        )
        db.add(reading)
        affected_sensor = smoke_sensor

    elif scenario_upper in ("TEMP_WARNING", "TEMPERATURE_WARNING"):
        event_description = "Предупреждение по температуре: зафиксирован локальный перегрев в серверной."
        heat_sensor.status = SensorStatus.WARNING
        reading = SensorReading(
            sensor_id=heat_sensor.id,
            metric_type="TEMPERATURE",
            value=49.5,
            unit="°C",
            battery_level=heat_sensor.battery_level,
            signal_strength=heat_sensor.signal_strength,
            is_demo=True,
            timestamp=now,
        )
        db.add(reading)
        affected_sensor = heat_sensor

    elif scenario_upper in ("FIRE_ALARM", "FIRE"):
        event_description = "ПОЖАРНАЯ ТРЕВОГА: Критическая температура 78.5 °C в центральной серверной!"
        heat_sensor.status = SensorStatus.ALARM
        reading = SensorReading(
            sensor_id=heat_sensor.id,
            metric_type="TEMPERATURE",
            value=78.5,
            unit="°C",
            battery_level=heat_sensor.battery_level,
            signal_strength=heat_sensor.signal_strength,
            is_demo=True,
            timestamp=now,
        )
        db.add(reading)
        affected_sensor = heat_sensor

        # Check if active alarm already exists for this sensor to avoid duplicates
        existing_alarm = db.execute(
            select(Alarm).where(
                Alarm.sensor_id == heat_sensor.id,
                Alarm.status == AlarmStatus.ACTIVE,
            )
        ).scalar_one_or_none()

        if existing_alarm is None:
            new_alarm = Alarm(
                sensor_id=heat_sensor.id,
                zone_id=heat_sensor.zone_id,
                title="Пожарная тревога: Возгорание в центральной серверной",
                description="Критический перегрев серверной стойки Z-201. Температура 78.5 °C превысила аварийный порог 58.0 °C.",
                severity=AlarmSeverity.HIGH,
                status=AlarmStatus.ACTIVE,
                trigger_value=78.5,
                threshold_value=58.0,
                triggered_at=now,
                is_demo=True,
            )
            db.add(new_alarm)
        else:
            new_alarm = existing_alarm

    elif scenario_upper in ("DEVICE_OFFLINE", "OFFLINE"):
        event_description = "Отказ оборудования: потеря радиоканала извещателя в электрощитовой."
        gas_sensor.status = SensorStatus.OFFLINE
        gas_sensor.signal_strength = 0.0
        affected_sensor = gas_sensor

    else:
        raise ValueError(
            f"Unknown simulation scenario '{scenario}'. Supported: NORMAL, SMOKE, TEMP_WARNING, FIRE_ALARM, DEVICE_OFFLINE"
        )

    db.commit()
    db.refresh(affected_sensor)
    if new_alarm and new_alarm.id is None:
        db.refresh(new_alarm)

    # Format result payload
    payload: Dict[str, Any] = {
        "event": "SIMULATION_UPDATE",
        "scenario": scenario_upper,
        "description": event_description,
        "is_demo": True,
        "timestamp": now.isoformat(),
        "affected_sensor": {
            "id": affected_sensor.id,
            "code": affected_sensor.code,
            "name": affected_sensor.name,
            "sensor_type": affected_sensor.sensor_type.value if hasattr(affected_sensor.sensor_type, "value") else str(affected_sensor.sensor_type),
            "status": affected_sensor.status.value if hasattr(affected_sensor.status, "value") else str(affected_sensor.status),
            "battery_level": affected_sensor.battery_level,
            "signal_strength": affected_sensor.signal_strength,
            "pos_x": affected_sensor.pos_x,
            "pos_y": affected_sensor.pos_y,
            "pos_z": affected_sensor.pos_z,
        },
        "alarm": {
            "id": new_alarm.id,
            "title": new_alarm.title,
            "severity": new_alarm.severity.value if hasattr(new_alarm.severity, "value") else str(new_alarm.severity),
            "status": new_alarm.status.value if hasattr(new_alarm.status, "value") else str(new_alarm.status),
            "trigger_value": new_alarm.trigger_value,
            "threshold_value": new_alarm.threshold_value,
        } if new_alarm else None,
    }

    return payload

