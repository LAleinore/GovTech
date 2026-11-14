from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.models.building import Building, Floor, Zone
from app.models.enums import ZoneType
from app.schemas.building import (
    BuildingRead,
    BuildingDetailRead,
    FloorRead,
    ZoneRead,
)

router = APIRouter(prefix="/buildings", tags=["Buildings, Floors & Zones"])


@router.get("", response_model=List[BuildingRead], status_code=status.HTTP_200_OK)
def list_buildings(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of records to return"),
    db: Session = Depends(get_db),
) -> List[BuildingRead]:
    """Retrieve list of all registered buildings."""
    stmt = select(Building).order_by(Building.id).offset(skip).limit(limit)
    buildings = db.execute(stmt).scalars().all()
    return [BuildingRead.model_validate(b) for b in buildings]


@router.get("/{building_id}", response_model=BuildingDetailRead, status_code=status.HTTP_200_OK)
def get_building(
    building_id: int = Path(..., gt=0, description="Unique ID of the building"),
    db: Session = Depends(get_db),
) -> BuildingDetailRead:
    """Retrieve detailed information about a specific building, including its floors and zones."""
    stmt = (
        select(Building)
        .where(Building.id == building_id)
        .options(selectinload(Building.floors).selectinload(Floor.zones))
    )
    building = db.execute(stmt).scalar_one_or_none()
    if building is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Building with id={building_id} not found",
        )
    return BuildingDetailRead.model_validate(building)


@router.get("/{building_id}/floors", response_model=List[FloorRead], status_code=status.HTTP_200_OK)
def get_building_floors(
    building_id: int = Path(..., gt=0, description="Unique ID of the building"),
    db: Session = Depends(get_db),
) -> List[FloorRead]:
    """Retrieve all floors and their zones for a specific building."""
    building_exists = db.execute(
        select(Building.id).where(Building.id == building_id)
    ).scalar_one_or_none()
    if building_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Building with id={building_id} not found",
        )

    stmt = (
        select(Floor)
        .where(Floor.building_id == building_id)
        .options(selectinload(Floor.zones))
        .order_by(Floor.floor_number)
    )
    floors = db.execute(stmt).scalars().all()
    return [FloorRead.model_validate(f) for f in floors]


@router.get("/{building_id}/zones", response_model=List[ZoneRead], status_code=status.HTTP_200_OK)
def get_building_zones(
    building_id: int = Path(..., gt=0, description="Unique ID of the building"),
    floor_id: Optional[int] = Query(None, gt=0, description="Filter zones by floor ID"),
    zone_type: Optional[ZoneType] = Query(None, description="Filter zones by functional type"),
    db: Session = Depends(get_db),
) -> List[ZoneRead]:
    """Retrieve all zones belonging to a specific building, with optional floor and type filters."""
    building_exists = db.execute(
        select(Building.id).where(Building.id == building_id)
    ).scalar_one_or_none()
    if building_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Building with id={building_id} not found",
        )

    stmt = (
        select(Zone)
        .join(Floor, Zone.floor_id == Floor.id)
        .where(Floor.building_id == building_id)
    )
    if floor_id is not None:
        stmt = stmt.where(Zone.floor_id == floor_id)
    if zone_type is not None:
        stmt = stmt.where(Zone.zone_type == zone_type)

    stmt = stmt.order_by(Floor.floor_number, Zone.code)
    zones = db.execute(stmt).scalars().all()
    return [ZoneRead.model_validate(z) for z in zones]

