"""Étapes de calcul (POST /steps/check) et santé du service."""

from fastapi.testclient import TestClient


def steps(client: TestClient, body: dict) -> dict:
    response = client.post("/steps/check", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_etapes_valides(client: TestClient) -> None:
    body = {"steps": ["2*x + 3 = 11", "2x = 8", "x = 4"], "variable": "x"}
    assert steps(client, body) == {"valid": [True, True, True], "firstInvalid": None}


def test_etape_fausse(client: TestClient) -> None:
    # Chaque étape est comparée à la précédente : l'erreur est à l'étape 2 seulement.
    body = {"steps": ["2x + 3 = 11", "2x = 14", "x = 7"], "variable": "x"}
    assert steps(client, body) == {"valid": [True, False, True], "firstInvalid": 1}


def test_expressions_equivalentes(client: TestClient) -> None:
    body = {"steps": ["3(x + 2)", "3x + 6", "3x + 5"]}
    assert steps(client, body) == {"valid": [True, True, False], "firstInvalid": 2}


def test_etape_illisible(client: TestClient) -> None:
    body = {"steps": ["x + 1 = 2", "__import__('os')"], "variable": "x"}
    assert steps(client, body)["firstInvalid"] == 1


def test_sante(client: TestClient) -> None:
    assert client.get("/health").json() == {"ok": True}
