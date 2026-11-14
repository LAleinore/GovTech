from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, desc
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.models.alarm import Alarm
from app.models.enums import AlarmSeverity, AlarmStatus, IncidentPriority, IncidentStatus
from app.models.incident import Incident, IncidentLog
from app.models.sensor import Sensor
from app.models.building import Zone

router = APIRouter(prefix="/alarms", tags=["Alarms & Hazard Detection"])


class AlarmRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sensor_id: Optional[int] = None
    zone_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    severity: AlarmSeverity
    status: AlarmStatus
    trigger_value: float
    threshold_value: float
    triggered_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    is_demo: bool
    sensor_code: Optional[str] = None
    zone_code: Optional[str] = None
    incident_id: Optional[int] = None


@router.get("", response_model=List[AlarmRead], status_code=status.HTTP_200_OK)
def list_alarms(
    alarm_status: Optional[AlarmStatus] = Query(None, alias="status", description="Filter by alarm status"),
    from_time: Optional[datetime] = Query(None, description="Filter alarms triggered after this timestamp"),
    to_time: Optional[datetime] = Query(None, description="Filter alarms triggered before this timestamp"),
    is_demo: Optional[bool] = Query(None, description="Filter demo alarms"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[AlarmRead]:
    """Retrieve list of alarm records with status, time filters, and attached sensor/incident metadata."""
    stmt = (
        select(Alarm)
        .options(selectinload(Alarm.sensor), selectinload(Alarm.zone), selectinload(Alarm.incident))
        .order_by(desc(Alarm.triggered_at), desc(Alarm.id))
    )

    if alarm_status is not None:
        stmt = stmt.where(Alarm.status == alarm_status)
    if from_time is not None:
        stmt = stmt.where(Alarm.triggered_at >= from_time)
    if to_time is not None:
        stmt = stmt.where(Alarm.triggered_at <= to_time)
    if is_demo is not None:
        stmt = stmt.where(Alarm.is_demo == is_demo)

    stmt = stmt.offset(skip).limit(limit)
    alarms = db.execute(stmt).scalars().all()

    result: List[AlarmRead] = []
    for a in alarms:
        dto = AlarmRead.model_validate(a)
        if a.sensor:
            dto.sensor_code = a.sensor.code
        if a.zone:
            dto.zone_code = a.zone.code
        if a.incident:
            dto.incident_id = a.incident.id
        result.append(dto)

    return result


@router.post("/{alarm_id}/acknowledge", response_model=AlarmRead, status_code=status.HTTP_200_OK)
def acknowledge_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
) -> AlarmRead:
    """Mark an alarm as acknowledged by operator."""
    alarm = db.get(Alarm, alarm_id)
    if not alarm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alarm id={alarm_id} not found")

    alarm.status = AlarmStatus.ACKNOWLEDGED
    alarm.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alarm)

    return AlarmRead.model_validate(alarm)


@router.post("/{alarm_id}/create-incident", status_code=status.HTTP_201_CREATED)
def create_incident_from_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
):
    """Generate an operational response incident directly linked to this fire alarm."""
    alarm = db.get(Alarm, alarm_id)
    if not alarm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alarm id={alarm_id} not found")

    # Check if incident already linked
    existing = db.execute(select(Incident).where(Incident.alarm_id == alarm_id)).scalar_one_or_none()
    if existing:
        return {"id": existing.id, "incident_number": existing.incident_number, "status": existing.status.value}

    now = datetime.now(timezone.utc)
    inc_num = f"INC-{now.strftime('%y%m%d')}-{alarm.id:03d}"

    incident = Incident(
        incident_number=inc_num,
        alarm_id=alarm.id,
        zone_id=alarm.zone_id,
        title=f"Инцидент: {alarm.title}",
        description=f"Сформирован по тревоге датчика. Зафиксировано значение: {alarm.trigger_value} (порог {alarm.threshold_value}).",
        priority=IncidentPriority.CRITICAL if alarm.severity == AlarmSeverity.CRITICAL else IncidentPriority.HIGH,
        status=IncidentStatus.NEW,
        is_demo=alarm.is_demo,
    )
    db.add(incident)
    db.flush()

    # Initial audit log
    log = IncidentLog(
        incident_id=incident.id,
        action="INCIDENT_CREATED",
        previous_state=None,
        new_state=IncidentStatus.NEW.value,
        notes="Инцидент сформирован автоматически по пожарной тревоге.",
        created_at=now,
    )
    db.add(log)
    db.commit()
    db.refresh(incident)

    return {"id": incident.id, "incident_number": incident.incident_number, "status": incident.status.value}
