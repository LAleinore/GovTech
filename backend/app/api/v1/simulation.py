from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.simulation import apply_simulation_scenario, ws_manager

router = APIRouter(prefix="/simulation", tags=["Demo Simulation Scenarios"])


class ScenarioRequest(BaseModel):
    scenario: str = Field(
        ...,
        description="Scenario code: NORMAL, SMOKE, TEMP_WARNING, FIRE_ALARM, DEVICE_OFFLINE",
        examples=["FIRE_ALARM"],
    )


class SimulationStatusResponse(BaseModel):
    demo_mode: bool = True
    certified_system: bool = False
    disclaimer: str = "Платформа работает в режиме демонстрационной симуляции для хакатона. Не является сертифицированным прибором пожарной безопасности (ППКП)."
    available_scenarios: List[str] = [
        "NORMAL",
        "SMOKE",
        "TEMP_WARNING",
        "FIRE_ALARM",
        "DEVICE_OFFLINE",
    ]


@router.get("/status", response_model=SimulationStatusResponse, status_code=status.HTTP_200_OK)
def get_simulation_status():
    """Retrieve current simulation environment status and available hazard scenarios."""
    return SimulationStatusResponse()


@router.post("/scenario", status_code=status.HTTP_200_OK)
async def trigger_scenario(
    request: ScenarioRequest,
    db: Session = Depends(get_db),
):
    """
    Trigger a server-side simulation scenario.
    Updates sensor telemetry in database, creates alarms when applicable,
    and broadcasts updates to all active WebSocket clients.
    """
    try:
        result = apply_simulation_scenario(db=db, scenario=request.scenario)
        # Broadcast real-time update to all connected WebSocket clients
        await ws_manager.broadcast(result)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation execution failure: {str(e)}",
        )

