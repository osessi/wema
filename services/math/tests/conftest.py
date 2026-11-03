import os

# Délai court pour les tests de robustesse ; lu à l'import du bac à sable.
os.environ.setdefault("WEMA_MATH_TIMEOUT", "2")

import pytest
from fastapi.testclient import TestClient

from wema_math.app import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
