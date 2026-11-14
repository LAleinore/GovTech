from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, desc
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.models.enums import MaintenanceType, MaintenanceStatus, UserRole
from app.models.maintenance import MaintenanceTask
from app.models.sensor import Sensor
from app.models.building import Zone, Floor, Building
from app.models.user import User

router = APIRouter(prefix="/maintenance", tags=["Technical Maintenance & Calibration Orders"])


class MaintenanceTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    task_type: MaintenanceType
    status: str
    scheduled_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    # Equipment & location metadata
    sensor_id: Optional[int] = None
    sensor_code: Optional[str] = None
    sensor_name: Optional[str] = None
    building_name: Optional[str] = None
    floor_number: Optional[int] = None
    zone_code: Optional[str] = None
    zone_name: Optional[str] = None

    # Assigned personnel
    assigned_user_id: Optional[int] = None
    assigned_user_name: Optional[str] = None


class MaintenanceTaskCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    sensor_id: Optional[int] = Field(None, description="Target sensor equipment ID")
    assigned_user_name: Optional[str] = Field(None, description="Responsible technician name")
    task_type: MaintenanceType = Field(default=MaintenanceType.INSPECTION)
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None


class MaintenanceTaskUpdate(BaseModel):
    title: Optional[str] = None
    sensor_id: Optional[int] = None
    assigned_user_name: Optional[str] = None
    task_type: Optional[MaintenanceType] = None
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    status: Optional[MaintenanceStatus] = None


class MaintenanceTaskComplete(BaseModel):
    resolution_notes: str = Field(..., min_length=2, description="Result or technical report of maintenance work")


def _compute_task_status(task: MaintenanceTask) -> str:
    """Computes dynamic task status factoring in current time vs scheduled_date deadline."""
    raw_status = task.status.value if hasattr(task.status, "value") else str(task.status)

    if raw_status in ("COMPLETED", "CANCELLED"):
        return raw_status

    now = datetime.now(timezone.utc)
    # Check overdue condition: deadline passed and task is not completed
    if task.scheduled_date is not None:
        # Normalize timezone if necessary
        sched = task.scheduled_date
        if sched.tzinfo is None:
            sched = sched.replace(tzinfo=timezone.utc)
        if sched < now:
            return "OVERDUE"

    if raw_status in ("SCHEDULED", "PENDING"):
        return "PENDING"

    return raw_status


def _enrich_task_dto(task: MaintenanceTask) -> MaintenanceTaskRead:
    dto = MaintenanceTaskRead.model_validate(task)
    dto.status = _compute_task_status(task)

    if task.sensor:
        dto.sensor_code = task.sensor.code
        dto.sensor_name = task.sensor.name
        if task.sensor.zone:
            dto.zone_code = task.sensor.zone.code
            dto.zone_name = task.sensor.zone.name
            if task.sensor.zone.floor:
                dto.floor_number = task.sensor.zone.floor.floor_number
                if task.sensor.zone.floor.building:
                    dto.building_name = task.sensor.zone.floor.building.name

    if task.assigned_user:
        dto.assigned_user_name = task.assigned_user.full_name

    return dto


def _seed_initial_maintenance_tasks_if_empty(db: Session):
    """Generates initial realistic calibration and battery replacement orders if table is empty."""
    count = db.execute(select(MaintenanceTask.id)).scalars().first()
    if count is not None:
        return

    sensors = db.execute(select(Sensor).order_by(Sensor.id)).scalars().all()
    if not sensors:
        return

    now = datetime.now(timezone.utc)
    # Find or seed a technician
    tech = db.execute(
        select(User).where(User.role == UserRole.TECHNICIAN, User.is_active == True)
    ).scalar_one_or_none()

    if not tech:
        tech = User(
            email="tech_lead@fireguard.local",
            hashed_password="mock-hash",
            full_name="Смирнов И. П. (Старший техник)",
            role=UserRole.TECHNICIAN,
            is_active=True,
            is_demo=True,
        )
        db.add(tech)
        db.flush()

    s1 = sensors[0]
    s2 = sensors[1] if len(sensors) > 1 else sensors[0]
    s3 = sensors[2] if len(sensors) > 2 else sensors[-1]

    # Task 1: Overdue inspection
    t1 = MaintenanceTask(
        sensor_id=s1.id,
        assigned_user_id=tech.id,
        title="Ежеквартальная поверка оптической камеры",
        description="Проверка чувствительности фотоэлектрического сенсора дыма и продувка камеры от промышленной пыли.",
        task_type=MaintenanceType.INSPECTION,
        status=MaintenanceStatus.PENDING,
        scheduled_date=now - timedelta(days=2), # Overdue by 2 days
        is_demo=True,
    )

    # Task 2: In-progress battery replacement
    t2 = MaintenanceTask(
        sensor_id=s2.id,
        assigned_user_id=tech.id,
        title="Плановая замена литиевого элемента питания",
        description="Замена батареи CR123A в узле теплового контроля центральной серверной.",
        task_type=MaintenanceType.BATTERY_REPLACEMENT,
        status=MaintenanceStatus.IN_PROGRESS,
        scheduled_date=now + timedelta(days=1),
        is_demo=True,
    )

    # Task 3: Completed recalibration history
    t3 = MaintenanceTask(
        sensor_id=s3.id,
        assigned_user_id=tech.id,
        title="Калибровка сенсора угарного газа CO",
        description="Метрологическая калибровка газоанализатора электрощитовой с контрольным баллоном CO 50 ppm.",
        task_type=MaintenanceType.RECALIBRATION,
        status=MaintenanceStatus.COMPLETED,
        scheduled_date=now - timedelta(days=7),
        completed_date=now - timedelta(days=6),
        resolution_notes="Калибровка успешно завершена. Погрешность сенсора в пределах ГОСТ (+-1.2 ppm).",
        is_demo=True,
    )

    db.add(t1)
    db.add(t2)
    db.add(t3)
    db.commit()


@router.get("", response_model=List[MaintenanceTaskRead], status_code=status.HTTP_200_OK)
def list_maintenance_tasks(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: PENDING, IN_PROGRESS, COMPLETED, OVERDUE"),
    sensor_id: Optional[int] = Query(None, description="Filter by target sensor ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> List[MaintenanceTaskRead]:
    """Retrieve list of maintenance and calibration orders with dynamic overdue computation."""
    _seed_initial_maintenance_tasks_if_empty(db)

    stmt = (
        select(MaintenanceTask)
        .options(
            selectinload(MaintenanceTask.sensor)
            .selectinload(Sensor.zone)
            .selectinload(Zone.floor)
            .selectinload(Floor.building),
            selectinload(MaintenanceTask.assigned_user),
        )
        .order_by(desc(MaintenanceTask.id))
    )

    if sensor_id is not None:
        stmt = stmt.where(MaintenanceTask.sensor_id == sensor_id)

    tasks = db.execute(stmt.offset(skip).limit(limit)).scalars().all()
    dtos = [_enrich_task_dto(t) for t in tasks]

    if status_filter is not None and status_filter.upper() != "ALL":
        target = status_filter.upper()
        dtos = [d for d in dtos if d.status == target]

    return dtos


@router.get("/{task_id}", response_model=MaintenanceTaskRead, status_code=status.HTTP_200_OK)
def get_maintenance_task(
    task_id: int,
    db: Session = Depends(get_db),
) -> MaintenanceTaskRead:
    """Retrieve detailed maintenance task."""
    stmt = (
        select(MaintenanceTask)
        .where(MaintenanceTask.id == task_id)
        .options(
            selectinload(MaintenanceTask.sensor)
            .selectinload(Sensor.zone)
            .selectinload(Zone.floor)
            .selectinload(Floor.building),
            selectinload(MaintenanceTask.assigned_user),
        )
    )
    task = db.execute(stmt).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task id={task_id} not found")

    return _enrich_task_dto(task)


@router.post("", response_model=MaintenanceTaskRead, status_code=status.HTTP_201_CREATED)
def create_maintenance_task(
    request: MaintenanceTaskCreate,
    db: Session = Depends(get_db),
) -> MaintenanceTaskRead:
    """Create a new maintenance or inspection order for fire safety equipment."""
    assigned_user_id = None
    if request.assigned_user_name:
        user = db.execute(
            select(User).where(User.full_name == request.assigned_user_name.strip())
        ).scalars().first()
        if not user:
            user = User(
                email=f"tech_{datetime.now(timezone.utc).timestamp()}@fireguard.local",
                hashed_password="mock",
                full_name=request.assigned_user_name.strip(),
                role=UserRole.TECHNICIAN,
                is_active=True,
                is_demo=True,
            )
            db.add(user)
            db.flush()
        assigned_user_id = user.id

    task = MaintenanceTask(
        title=request.title.strip(),
        description=request.description.strip() if request.description else None,
        task_type=request.task_type,
        status=MaintenanceStatus.PENDING,
        sensor_id=request.sensor_id,
        assigned_user_id=assigned_user_id,
        scheduled_date=request.scheduled_date or (datetime.now(timezone.utc) + timedelta(days=3)),
        is_demo=True,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return get_maintenance_task(task_id=task.id, db=db)


@router.patch("/{task_id}", response_model=MaintenanceTaskRead, status_code=status.HTTP_200_OK)
def update_maintenance_task(
    task_id: int,
    request: MaintenanceTaskUpdate,
    db: Session = Depends(get_db),
) -> MaintenanceTaskRead:
    """Update maintenance task details, scheduled date, or technician assignment."""
    task = db.get(MaintenanceTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task id={task_id} not found")

    if request.title is not None:
        task.title = request.title.strip()
    if request.description is not None:
        task.description = request.description.strip()
    if request.task_type is not None:
        task.task_type = request.task_type
    if request.sensor_id is not None:
        task.sensor_id = request.sensor_id
    if request.scheduled_date is not None:
        task.scheduled_date = request.scheduled_date
    if request.status is not None:
        task.status = request.status

    if request.assigned_user_name is not None:
        user = db.execute(
            select(User).where(User.full_name == request.assigned_user_name.strip())
        ).scalars().first()
        if not user:
            user = User(
                email=f"tech_{datetime.now(timezone.utc).timestamp()}@fireguard.local",
                hashed_password="mock",
                full_name=request.assigned_user_name.strip(),
                role=UserRole.TECHNICIAN,
                is_active=True,
                is_demo=True,
            )
            db.add(user)
            db.flush()
        task.assigned_user_id = user.id

    db.commit()
    return get_maintenance_task(task_id=task.id, db=db)


@router.post("/{task_id}/complete", response_model=MaintenanceTaskRead, status_code=status.HTTP_200_OK)
def complete_maintenance_task(
    task_id: int,
    request: MaintenanceTaskComplete,
    db: Session = Depends(get_db),
) -> MaintenanceTaskRead:
    """
    Finish a maintenance order, recording mandatory technical resolution report
    and completion timestamp in database history.
    """
    task = db.get(MaintenanceTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task id={task_id} not found")

    task.status = MaintenanceStatus.COMPLETED
    task.completed_date = datetime.now(timezone.utc)
    task.resolution_notes = request.resolution_notes.strip()

    db.commit()
    return get_maintenance_task(task_id=task.id, db=db)

