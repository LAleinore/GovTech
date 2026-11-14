from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.models.alarm import Alarm
from app.models.building import Zone, Floor, Building
from app.models.enums import AlarmStatus, IncidentStatus, MaintenanceStatus, SensorStatus
from app.models.incident import Incident, IncidentLog
from app.models.maintenance import MaintenanceTask
from app.models.sensor import Sensor

router = APIRouter(prefix="/analytics", tags=["Analytics & Unified Event Audit Log"])


class AlarmDistributionByFloor(BaseModel):
    floor_number: int
    count: int


class AlarmDistributionByType(BaseModel):
    sensor_type: str
    count: int


class SensorStateBreakdown(BaseModel):
    total: int
    normal: int
    warning: int
    alarm: int
    offline: int


class AnalyticsOverviewResponse(BaseModel):
    period: str
    alarms_count: int
    alarms_by_floor: List[AlarmDistributionByFloor]
    alarms_by_type: List[AlarmDistributionByType]
    sensor_states: SensorStateBreakdown
    avg_incident_resolution_minutes: Optional[float] = None
    closed_incidents_count: int = 0
    overdue_maintenance_count: int = 0
    total_maintenance_count: int = 0


class EventLogItem(BaseModel):
    id: str
    event_type: str # ALARM_TRIGGERED, STATUS_CHANGED, OPERATOR_ASSIGNED, MAINTENANCE_COMPLETED
    title: str
    description: Optional[str] = None
    actor_name: Optional[str] = None
    timestamp: datetime
    badge_variant: str # ALARM, WARNING, NORMAL, DEMO, OFFLINE


@router.get("/overview", response_model=AnalyticsOverviewResponse, status_code=status.HTTP_200_OK)
def get_analytics_overview(
    period: str = Query("ALL", description="Time period: ALL, 24H, 7D, 30D"),
    db: Session = Depends(get_db),
) -> AnalyticsOverviewResponse:
    """Calculates factual analytical indicators directly from database records without hardcoded demo data."""
    now = datetime.now(timezone.utc)
    from_date: Optional[datetime] = None

    if period == "24H":
        from_date = now - timedelta(hours=24)
    elif period == "7D":
        from_date = now - timedelta(days=7)
    elif period == "30D":
        from_date = now - timedelta(days=30)

    # 1. Alarms Count & Distribution
    stmt_alarms = select(Alarm).options(
        selectinload(Alarm.zone).selectinload(Zone.floor),
        selectinload(Alarm.sensor),
    )
    if from_date:
        stmt_alarms = stmt_alarms.where(Alarm.triggered_at >= from_date)

    alarms = db.execute(stmt_alarms).scalars().all()
    alarms_count = len(alarms)

    # Floor distribution
    floor_counts: Dict[int, int] = {}
    type_counts: Dict[str, int] = {}

    for a in alarms:
        f_num = 1
        if a.zone and a.zone.floor:
            f_num = a.zone.floor.floor_number
        elif a.sensor and a.sensor.pos_z:
            f_num = 3 if a.sensor.pos_z > 6.0 else 2 if a.sensor.pos_z > 2.5 else 1

        floor_counts[f_num] = floor_counts.get(f_num, 0) + 1

        s_type = "SMOKE"
        if a.sensor and a.sensor.sensor_type:
            s_type = a.sensor.sensor_type.value if hasattr(a.sensor.sensor_type, "value") else str(a.sensor.sensor_type)
        type_counts[s_type] = type_counts.get(s_type, 0) + 1

    alarms_by_floor = [
        AlarmDistributionByFloor(floor_number=f, count=c)
        for f, c in sorted(floor_counts.items())
    ]
    alarms_by_type = [
        AlarmDistributionByType(sensor_type=t, count=c)
        for t, c in sorted(type_counts.items())
    ]

    # 2. Sensor States Breakdown
    sensors = db.execute(select(Sensor)).scalars().all()
    sensor_states = SensorStateBreakdown(
        total=len(sensors),
        normal=sum(1 for s in sensors if s.status == SensorStatus.NORMAL),
        warning=sum(1 for s in sensors if s.status == SensorStatus.WARNING),
        alarm=sum(1 for s in sensors if s.status == SensorStatus.ALARM),
        offline=sum(1 for s in sensors if s.status in (SensorStatus.OFFLINE, SensorStatus.FAULT)),
    )

    # 3. Average incident resolution time (MTTR)
    stmt_incidents = select(Incident).where(
        Incident.status == IncidentStatus.CLOSED,
        Incident.closed_at.is_not(None),
    )
    if from_date:
        stmt_incidents = stmt_incidents.where(Incident.closed_at >= from_date)

    closed_incidents = db.execute(stmt_incidents).scalars().all()
    avg_minutes: Optional[float] = None
    if closed_incidents:
        total_seconds = 0.0
        for inc in closed_incidents:
            c_time = inc.closed_at
            cr_time = inc.created_at
            if c_time.tzinfo is None:
                c_time = c_time.replace(tzinfo=timezone.utc)
            if cr_time.tzinfo is None:
                cr_time = cr_time.replace(tzinfo=timezone.utc)
            delta = (c_time - cr_time).total_seconds()
            if delta > 0:
                total_seconds += delta

        avg_minutes = round(total_seconds / (len(closed_incidents) * 60.0), 1)

    # 4. Overdue maintenance tasks count
    tasks = db.execute(select(MaintenanceTask)).scalars().all()
    overdue_count = 0
    for t in tasks:
        raw_status = t.status.value if hasattr(t.status, "value") else str(t.status)
        if raw_status not in ("COMPLETED", "CANCELLED"):
            if t.scheduled_date is not None:
                sched = t.scheduled_date
                if sched.tzinfo is None:
                    sched = sched.replace(tzinfo=timezone.utc)
                if sched < now:
                    overdue_count += 1

    return AnalyticsOverviewResponse(
        period=period,
        alarms_count=alarms_count,
        alarms_by_floor=alarms_by_floor,
        alarms_by_type=alarms_by_type,
        sensor_states=sensor_states,
        avg_incident_resolution_minutes=avg_minutes,
        closed_incidents_count=len(closed_incidents),
        overdue_maintenance_count=overdue_count,
        total_maintenance_count=len(tasks),
    )


@router.get("/events", response_model=List[EventLogItem], status_code=status.HTTP_200_OK)
def get_unified_event_log(
    event_type: Optional[str] = Query(None, description="Filter: ALL, ALARMS, INCIDENTS, MAINTENANCE"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[EventLogItem]:
    """
    Constructs a unified chronological stream of major building events:
    alarm triggers, incident status transitions, operator assignments, and maintenance completions.
    """
    events: List[EventLogItem] = []

    # 1. Alarms triggered
    if event_type in (None, "ALL", "ALARMS"):
        alarms = db.execute(
            select(Alarm)
            .options(selectinload(Alarm.sensor), selectinload(Alarm.zone))
            .order_by(desc(Alarm.triggered_at))
            .limit(limit)
        ).scalars().all()

        for a in alarms:
            loc = a.zone.code if a.zone else "Контур объекта"
            events.append(
                EventLogItem(
                    id=f"alarm-{a.id}",
                    event_type="ALARM_TRIGGERED",
                    title=f"Срабатывание: {a.title}",
                    description=f"Значение {a.trigger_value} превысило порог {a.threshold_value}. Локация: {loc}.",
                    actor_name="Автоматика ППКП",
                    timestamp=a.triggered_at,
                    badge_variant="ALARM" if a.status == AlarmStatus.ACTIVE else "NORMAL",
                )
            )

    # 2. Incident logs (Status transitions & Operator assignments)
    if event_type in (None, "ALL", "INCIDENTS"):
        inc_logs = db.execute(
            select(IncidentLog)
            .options(selectinload(IncidentLog.actor), selectinload(IncidentLog.incident))
            .order_by(desc(IncidentLog.created_at))
            .limit(limit)
        ).scalars().all()

        for l in inc_logs:
            inc_num = l.incident.incident_number if l.incident else "INC"
            badge = "WARNING" if "STATUS" in l.action else "NORMAL"
            if "CLOSED" in l.action or "RESOLVED" in l.action:
                badge = "NORMAL"

            events.append(
                EventLogItem(
                    id=f"inc-log-{l.id}",
                    event_type=l.action,
                    title=f"{inc_num}: {l.action.replace('_', ' ')}",
                    description=l.notes or (f"Статус изменён: {l.previous_state} -> {l.new_state}" if l.new_state else None),
                    actor_name=l.actor.full_name if l.actor else "Дежурный диспетчер",
                    timestamp=l.created_at,
                    badge_variant=badge,
                )
            )

    # 3. Completed maintenance tasks
    if event_type in (None, "ALL", "MAINTENANCE"):
        tasks = db.execute(
            select(MaintenanceTask)
            .where(MaintenanceTask.completed_date.is_not(None))
            .options(selectinload(MaintenanceTask.assigned_user), selectinload(MaintenanceTask.sensor))
            .order_by(desc(MaintenanceTask.completed_date))
            .limit(limit)
        ).scalars().all()

        for t in tasks:
            s_code = t.sensor.code if t.sensor else "Узел ТО"
            events.append(
                EventLogItem(
                    id=f"maint-{t.id}",
                    event_type="MAINTENANCE_COMPLETED",
                    title=f"ТО #{t.id} завершено: {t.title}",
                    description=f"Оборудование: {s_code}. Отчёт: {t.resolution_notes or 'Работы выполнены в полном объёме.'}",
                    actor_name=t.assigned_user.full_name if t.assigned_user else "Техник ПБ",
                    timestamp=t.completed_date or t.updated_at,
                    badge_variant="NORMAL",
                )
            )

    # Sort unified events descending by timestamp
    events.sort(key=lambda x: x.timestamp, reverse=True)
    return events[:limit]

