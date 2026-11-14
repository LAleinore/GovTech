from fastapi import APIRouter
from app.api.v1 import health, buildings, sensors, simulation, alarms, incidents, users, maintenance, analytics

api_v1_router = APIRouter()

# Mount routes
api_v1_router.include_router(health.router)
api_v1_router.include_router(buildings.router)
api_v1_router.include_router(sensors.router)
api_v1_router.include_router(simulation.router)
api_v1_router.include_router(alarms.router)
api_v1_router.include_router(incidents.router)
api_v1_router.include_router(users.router)
api_v1_router.include_router(maintenance.router)
api_v1_router.include_router(analytics.router)
