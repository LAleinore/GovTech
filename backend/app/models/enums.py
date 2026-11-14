from enum import Enum


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    DISPATCHER = "DISPATCHER"
    TECHNICIAN = "TECHNICIAN"
    AUDITOR = "AUDITOR"


class ZoneType(str, Enum):
    OFFICE = "OFFICE"
    SERVER_ROOM = "SERVER_ROOM"
    CORRIDOR = "CORRIDOR"
    STAIRWELL = "STAIRWELL"
    WAREHOUSE = "WAREHOUSE"
    LOBBY = "LOBBY"
    ELECTRICAL_ROOM = "ELECTRICAL_ROOM"
    PARKING = "PARKING"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SensorType(str, Enum):
    SMOKE = "SMOKE"
    HEAT = "HEAT"
    FLAME = "FLAME"
    GAS = "GAS"
    SPRINKLER_FLOW = "SPRINKLER_FLOW"


class SensorStatus(str, Enum):
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    ALARM = "ALARM"
    FAULT = "FAULT"
    OFFLINE = "OFFLINE"


class AlarmSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlarmStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    FALSE_ALARM = "FALSE_ALARM"


class IncidentPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, Enum):
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    IN_PROGRESS = "IN_PROGRESS"
    ON_SITE = "ON_SITE"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class MaintenanceType(str, Enum):
    INSPECTION = "INSPECTION"
    BATTERY_REPLACEMENT = "BATTERY_REPLACEMENT"
    RECALIBRATION = "RECALIBRATION"
    REPAIR = "REPAIR"


class MaintenanceStatus(str, Enum):
    PENDING = "PENDING"
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    OVERDUE = "OVERDUE"
    CANCELLED = "CANCELLED"


class NotificationType(str, Enum):
    ALARM = "ALARM"
    INCIDENT = "INCIDENT"
    SYSTEM = "SYSTEM"
    MAINTENANCE = "MAINTENANCE"


class NotificationPriority(str, Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    URGENT = "URGENT"

