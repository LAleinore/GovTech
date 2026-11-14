from app.main import app, root
from app.api.v1.health import get_health_status


def test_root_endpoint():
    data = root()
    assert data["app"] == "FireGuard 360"
    assert data["status"] == "operational"


def test_health_endpoint():
    response = get_health_status()
    assert response.status == "healthy"
    assert response.database.connected is True
    assert response.app_name == "FireGuard 360"


def test_routes_registered():
    paths = [route.path for route in app.routes]
    assert "/" in paths
    assert "/api/health" in paths
    assert "/api/v1/health" in paths
