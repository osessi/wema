import pytest
from fastapi.testclient import TestClient

from wema_math.app import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
