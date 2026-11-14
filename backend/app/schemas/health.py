from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class DatabaseStatus(BaseModel):
    connected: bool = Field(..., description="Whether database connection is alive")
    dialect: Optional[str] = Field(None, description="Active database engine dialect (sqlite/postgresql)")
    message: str = Field(..., description="Diagnostic status message")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional pool/connection details")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall application status (healthy/degraded)")
    app_name: str = Field(..., description="Application name")
    version: str = Field(..., description="Application version")
    environment: str = Field(..., description="Active runtime environment")
    demo_mode: bool = Field(..., description="Whether system is operating in DEMO simulation mode")
    timestamp: datetime = Field(..., description="Current server UTC timestamp")
    database: DatabaseStatus = Field(..., description="Database connectivity status")

