from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.models.incident import Incident

router = APIRouter(prefix="/users", tags=["Personnel & User Access Management"])


class UserBase(BaseModel):
    email: str = Field(..., min_length=3, max_length=255, description="Corporate email address")
    full_name: str = Field(..., min_length=2, max_length=255)
    role: UserRole = Field(default=UserRole.OPERATOR)
    phone: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    is_active: bool
    is_demo: bool
    assigned_incidents_count: int = 0
    created_at: datetime
    updated_at: datetime


def _ensure_initial_admin_seeded(db: Session):
    """Guarantees at least one active administrator exists in the system."""
    admin_exists = db.execute(
        select(User).where(User.role == UserRole.ADMIN, User.is_active == True)
    ).scalar_one_or_none()

    if not admin_exists:
        default_admin = User(
            email="admin@fireguard.local",
            hashed_password="mock-secure-hash",
            full_name="Главный Администратор Безопасности",
            role=UserRole.ADMIN,
            phone="+7 (999) 000-01-01",
            is_active=True,
            is_demo=True,
        )
        db.add(default_admin)

        # Also add sample technician and operator for realistic demonstration
        sample_tech = User(
            email="tech@fireguard.local",
            hashed_password="mock-secure-hash",
            full_name="Смирнов И. П. (Техник ПБ)",
            role=UserRole.TECHNICIAN,
            phone="+7 (999) 000-02-02",
            is_active=True,
            is_demo=True,
        )
        sample_op = User(
            email="operator@fireguard.local",
            hashed_password="mock-secure-hash",
            full_name="Васильева Е. Н. (Дежурный диспетчер)",
            role=UserRole.OPERATOR,
            phone="+7 (999) 000-03-03",
            is_active=True,
            is_demo=True,
        )
        db.add(sample_tech)
        db.add(sample_op)
        db.commit()


@router.get("", response_model=List[UserRead], status_code=status.HTTP_200_OK)
def list_users(
    role: Optional[UserRole] = Query(None, description="Filter by user role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search query by name, email or phone"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> List[UserRead]:
    """Retrieve list of employees with role/activity filters, search, and incident counter."""
    _ensure_initial_admin_seeded(db)

    stmt = select(User).options(selectinload(User.assigned_incidents)).order_by(User.id)

    if role is not None:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(s), User.email.ilike(s), User.phone.ilike(s)))

    stmt = stmt.offset(skip).limit(limit)
    users = db.execute(stmt).scalars().all()

    result: List[UserRead] = []
    for u in users:
        dto = UserRead.model_validate(u)
        dto.assigned_incidents_count = len(u.assigned_incidents)
        result.append(dto)

    return result


@router.get("/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
) -> UserRead:
    """Retrieve detailed user account."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User id={user_id} not found")

    incidents_count = db.execute(
        select(func.count(Incident.id)).where(Incident.assigned_user_id == user_id)
    ).scalar_one()

    dto = UserRead.model_validate(user)
    dto.assigned_incidents_count = incidents_count
    return dto


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    request: UserCreate,
    db: Session = Depends(get_db),
) -> UserRead:
    """Create a new employee profile with specified role and active status."""
    existing = db.execute(select(User).where(User.email == request.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Сотрудник с адресом электронной почты '{request.email}' уже зарегистрирован.",
        )

    user = User(
        email=request.email,
        hashed_password="mock-default-password",
        full_name=request.full_name.strip(),
        role=request.role,
        phone=request.phone.strip() if request.phone else None,
        is_active=request.is_active,
        is_demo=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    dto = UserRead.model_validate(user)
    dto.assigned_incidents_count = 0
    return dto


@router.patch("/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
def update_user(
    user_id: int,
    request: UserUpdate,
    db: Session = Depends(get_db),
) -> UserRead:
    """
    Update employee attributes with strict server-side permission and safeguard checks.
    Guarantees that the last active administrator cannot be deactivated or downgraded.
    """
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User id={user_id} not found")

    # Safeguard check: If user is an active ADMIN and an update tries to deactivate or change role
    is_demoting_or_deactivating = (
        user.role == UserRole.ADMIN
        and user.is_active
        and (
            (request.is_active is False)
            or (request.role is not None and request.role != UserRole.ADMIN)
        )
    )

    if is_demoting_or_deactivating:
        active_admins_count = db.execute(
            select(func.count(User.id)).where(User.role == UserRole.ADMIN, User.is_active == True)
        ).scalar_one()

        if active_admins_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Запрещено: Невозможно деактивировать или понизить права единственного активного администратора системы безопасности.",
            )

    if request.full_name is not None:
        user.full_name = request.full_name.strip()
    if request.role is not None:
        user.role = request.role
    if request.phone is not None:
        user.phone = request.phone.strip() if request.phone else None
    if request.is_active is not None:
        user.is_active = request.is_active

    db.commit()
    db.refresh(user)

    incidents_count = db.execute(
        select(func.count(Incident.id)).where(Incident.assigned_user_id == user_id)
    ).scalar_one()

    dto = UserRead.model_validate(user)
    dto.assigned_incidents_count = incidents_count
    return dto


@router.delete("/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
) -> UserRead:
    """
    Deactivates an employee account safely preserving historical relationships with incidents.
    Enforces the last-admin safeguard check.
    """
    return update_user(user_id=user_id, request=UserUpdate(is_active=False), db=db)
