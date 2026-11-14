from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, desc
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.models.alarm import Alarm
from app.models.building import Zone, Floor, Building
from app.models.enums import IncidentPriority, IncidentStatus
from app.models.incident import Incident, IncidentLog
from app.models.sensor import Sensor
from app.models.user import User

router = APIRouter(prefix="/incidents", tags=["Incidents & Dispatch Workflow"])


class IncidentLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    notes: Optional[str] = None
    actor_name: Optional[str] = None
    created_at: datetime


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_number: str
    alarm_id: Optional[int] = None
    zone_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    priority: IncidentPriority
    status: IncidentStatus
    assigned_user_id: Optional[int] = None
    assigned_user_name: Optional[str] = None
    resolution_notes: Optional[str] = None
    closed_at: Optional[datetime] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    # Linked context
    zone_code: Optional[str] = None
    zone_name: Optional[str] = None
    floor_number: Optional[int] = None
    building_name: Optional[str] = None
    sensor_code: Optional[str] = None


class IncidentDetailRead(IncidentRead):
    logs: List[IncidentLogRead] = []


class StatusUpdateRequest(BaseModel):
    new_status: IncidentStatus = Field(..., description="Target status: NEW, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED")
    notes: Optional[str] = Field(None, description="Action comment or audit note")
    resolution_notes: Optional[str] = Field(None, description="Required when status is CLOSED")
    actor_name: Optional[str] = Field("Диспетчер смены", description="Operator / actor name")


class AssignUserRequest(BaseModel):
    user_name: str = Field(..., description="Full name or callsign of assigned personnel")
    notes: Optional[str] = Field(None, description="Assignment assignment reason or dispatch directive")


class AddCommentRequest(BaseModel):
    notes: str = Field(..., min_length=1, description="Comment or operational note content")
    actor_name: Optional[str] = Field("Дежурный диспетчер", description="Author callsign")


# Allowed status transitions validation table
ALLOWED_TRANSITIONS = {
    IncidentStatus.NEW: {IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED, IncidentStatus.CLOSED},
    IncidentStatus.ACKNOWLEDGED: {IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED, IncidentStatus.CLOSED},
    IncidentStatus.IN_PROGRESS: {IncidentStatus.RESOLVED, IncidentStatus.CLOSED},
    IncidentStatus.ON_SITE: {IncidentStatus.RESOLVED, IncidentStatus.CLOSED},
    IncidentStatus.RESOLVED: {IncidentStatus.CLOSED, IncidentStatus.IN_PROGRESS},
    IncidentStatus.CLOSED: set(), # Terminal state: cannot transition from CLOSED
}


def _enrich_incident_dto(inc: Incident, detail: bool = False) -> IncidentRead:
    data = inc.__dict__.copy()
    data.pop("_sa_instance_state", None)

    # Linked zone and floor info
    if inc.zone:
        data["zone_code"] = inc.zone.code
        data["zone_name"] = inc.zone.name
        if inc.zone.floor:
            data["floor_number"] = inc.zone.floor.floor_number
            if inc.zone.floor.building:
                data["building_name"] = inc.zone.floor.building.name

    if inc.alarm and inc.alarm.sensor:
        data["sensor_code"] = inc.alarm.sensor.code

    if inc.assigned_user:
        data["assigned_user_name"] = inc.assigned_user.full_name

    if detail:
        logs_dtos = []
        for l in inc.logs:
            ld = IncidentLogRead(
                id=l.id,
                action=l.action,
                previous_state=l.previous_state,
                new_state=l.new_state,
                notes=l.notes,
                actor_name=l.actor.full_name if l.actor else "Оператор дежурной смены",
                created_at=l.created_at,
            )
            logs_dtos.append(ld)
        data["logs"] = logs_dtos
        return IncidentDetailRead(**data)

    return IncidentRead(**data)


@router.get("", response_model=List[IncidentRead], status_code=status.HTTP_200_OK)
def list_incidents(
    incident_status: Optional[IncidentStatus] = Query(None, alias="status"),
    priority: Optional[IncidentPriority] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[IncidentRead]:
    """Retrieve list of all operational incidents with rich location and status attributes."""
    stmt = (
        select(Incident)
        .options(
            selectinload(Incident.zone).selectinload(Zone.floor).selectinload(Floor.building),
            selectinload(Incident.alarm).selectinload(Alarm.sensor),
            selectinload(Incident.assigned_user),
        )
        .order_by(desc(Incident.created_at), desc(Incident.id))
    )

    if incident_status is not None:
        stmt = stmt.where(Incident.status == incident_status)
    if priority is not None:
        stmt = stmt.where(Incident.priority == priority)

    stmt = stmt.offset(skip).limit(limit)
    incidents = db.execute(stmt).scalars().all()
    return [_enrich_incident_dto(inc) for inc in incidents]


@router.get("/{incident_id}", response_model=IncidentDetailRead, status_code=status.HTTP_200_OK)
def get_incident_detail(
    incident_id: int,
    db: Session = Depends(get_db),
) -> IncidentDetailRead:
    """Retrieve complete incident specification including chronological audit logs."""
    stmt = (
        select(Incident)
        .where(Incident.id == incident_id)
        .options(
            selectinload(Incident.zone).selectinload(Zone.floor).selectinload(Floor.building),
            selectinload(Incident.alarm).selectinload(Alarm.sensor),
            selectinload(Incident.assigned_user),
            selectinload(Incident.logs).selectinload(IncidentLog.actor),
        )
    )
    incident = db.execute(stmt).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident id={incident_id} not found")

    return _enrich_incident_dto(incident, detail=True)  # type: ignore


@router.patch("/{incident_id}/status", response_model=IncidentDetailRead, status_code=status.HTTP_200_OK)
def update_incident_status(
    incident_id: int,
    request: StatusUpdateRequest,
    db: Session = Depends(get_db),
) -> IncidentDetailRead:
    """
    Transition incident lifecycle status with server-side validation.
    Enforces mandatory resolution notes for CLOSED status and logs audit entry.
    """
    stmt = (
        select(Incident)
        .where(Incident.id == incident_id)
        .options(
            selectinload(Incident.zone).selectinload(Zone.floor).selectinload(Floor.building),
            selectinload(Incident.alarm).selectinload(Alarm.sensor),
            selectinload(Incident.assigned_user),
            selectinload(Incident.logs).selectinload(IncidentLog.actor),
        )
    )
    incident = db.execute(stmt).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident id={incident_id} not found")

    # 1. Terminal state check
    if incident.status == IncidentStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Инцидент уже закрыт (CLOSED) и не подлежит повторному изменению статуса.",
        )

    # 2. Transition validation
    allowed = ALLOWED_TRANSITIONS.get(incident.status, set())
    if request.new_status not in allowed and request.new_status != incident.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый переход статуса: {incident.status.value} -> {request.new_status.value}. Разрешены: {[s.value for s in allowed]}",
        )

    # 3. Mandatory resolution notes for closing
    if request.new_status == IncidentStatus.CLOSED:
        if not request.resolution_notes or not request.resolution_notes.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Для закрытия инцидента (CLOSED) обязательно указать результат обработки (resolution_notes).",
            )
        incident.resolution_notes = request.resolution_notes.strip()
        incident.closed_at = datetime.now(timezone.utc)

    now = datetime.now(timezone.utc)
    prev_status = incident.status.value
    incident.status = request.new_status

    # 4. Audit Log entry
    action_name = f"STATUS_CHANGED_TO_{request.new_status.value}"
    log = IncidentLog(
        incident_id=incident.id,
        action=action_name,
        previous_state=prev_status,
        new_state=request.new_status.value,
        notes=request.notes or (f"Результат: {incident.resolution_notes}" if incident.resolution_notes else "Статус обновлен диспетчером"),
        created_at=now,
    )
    db.add(log)
    db.commit()

    return get_incident_detail(incident_id=incident.id, db=db)


@router.patch("/{incident_id}/assign", response_model=IncidentDetailRead, status_code=status.HTTP_200_OK)
def assign_incident_operator(
    incident_id: int,
    request: AssignUserRequest,
    db: Session = Depends(get_db),
) -> IncidentDetailRead:
    """Assign responsible security or engineering personnel to incident."""
    stmt = select(Incident).where(Incident.id == incident_id)
    incident = db.execute(stmt).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident id={incident_id} not found")

    # Find or create a user profile for this callsign
    user = db.execute(select(User).where(User.full_name == request.user_name.strip())).scalars().first()
    if not user:
        clean_email = f"user_{datetime.now(timezone.utc).timestamp()}@fireguard.local"
        user = User(
            email=clean_email,
            hashed_password="mock-dev-password",
            full_name=request.user_name.strip(),
            is_active=True,
            is_demo=True,
        )
        db.add(user)
        db.flush()

    incident.assigned_user_id = user.id
    if incident.status == IncidentStatus.NEW:
        incident.status = IncidentStatus.IN_PROGRESS

    now = datetime.now(timezone.utc)
    log = IncidentLog(
        incident_id=incident.id,
        actor_id=user.id,
        action="OPERATOR_ASSIGNED",
        previous_state=incident.status.value,
        new_state=incident.status.value,
        notes=f"Ответственный назначен: {user.full_name}. {request.notes or ''}".strip(),
        created_at=now,
    )
    db.add(log)
    db.commit()

    return get_incident_detail(incident_id=incident.id, db=db)


@router.post("/{incident_id}/comments", response_model=IncidentDetailRead, status_code=status.HTTP_201_CREATED)
def add_incident_comment(
    incident_id: int,
    request: AddCommentRequest,
    db: Session = Depends(get_db),
) -> IncidentDetailRead:
    """Record an operational dispatch comment in the incident immutable audit timeline."""
    stmt = select(Incident).where(Incident.id == incident_id)
    incident = db.execute(stmt).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident id={incident_id} not found")

    now = datetime.now(timezone.utc)
    log = IncidentLog(
        incident_id=incident.id,
        action="COMMENT_ADDED",
        previous_state=incident.status.value,
        new_state=incident.status.value,
        notes=f"[{request.actor_name}]: {request.notes.strip()}",
        created_at=now,
    )
    db.add(log)
    db.commit()

    return get_incident_detail(incident_id=incident.id, db=db)

