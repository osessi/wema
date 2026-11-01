"""Correction des réponses d'élèves (POST /answers/check)."""

import pytest
from fastapi.testclient import TestClient

SOLUTION_5 = {"kind": "solutions", "variable": "x", "values": ["5"]}
SOLUTIONS_3 = {"kind": "solutions", "variable": "x", "values": ["-3", "3"]}


def correct(client: TestClient, expected: dict, answer: str) -> dict:
    response = client.post("/answers/check", json={"expected": expected, "answer": answer})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("answer", ["5", "x = 5", "x=5", " 10/2 ", "5,0", "S = {5}"])
def test_solution_juste_sous_plusieurs_ecritures(client: TestClient, answer: str) -> None:
    assert correct(client, SOLUTION_5, answer) == {"correct": True, "reason": None}


def test_solution_fausse(client: TestClient) -> None:
    assert correct(client, SOLUTION_5, "x = 4") == {"correct": False, "reason": "not_equivalent"}


@pytest.mark.parametrize("answer", ["x=3 ou x=-3", "3; -3", "-3, 3", "x = −3 ou x = 3"])
def test_ensemble_de_solutions(client: TestClient, answer: str) -> None:
    assert correct(client, SOLUTIONS_3, answer)["correct"] is True


def test_ensemble_incomplet(client: TestClient) -> None:
    assert correct(client, SOLUTIONS_3, "x = 3")["correct"] is False


def test_forme_developpee_exigee(client: TestClient) -> None:
    expected = {"kind": "expression", "value": "3*x + 6", "form": "expanded"}
    assert correct(client, expected, "3x + 6")["correct"] is True
    assert correct(client, expected, "6 + 3×x")["correct"] is True
    assert correct(client, expected, "3(x + 2)") == {"correct": False, "reason": "wrong_form"}
    assert correct(client, expected, "3x + 2") == {"correct": False, "reason": "not_equivalent"}


def test_forme_factorisee_exigee(client: TestClient) -> None:
    expected = {"kind": "expression", "value": "(x - 3)*(x + 3)", "form": "factored"}
    assert correct(client, expected, "(x+3)(x-3)")["correct"] is True
    assert correct(client, expected, "x² - 9") == {"correct": False, "reason": "wrong_form"}


def test_nombre_exact_ou_arrondi(client: TestClient) -> None:
    expected = {"kind": "number", "value": "2*sqrt(13)", "decimals": 1}
    assert correct(client, expected, "7,2")["correct"] is True
    assert correct(client, expected, "√52")["correct"] is True
    assert correct(client, expected, "2√13")["correct"] is True
    assert correct(client, expected, "7,21")["correct"] is True
    assert correct(client, expected, "7,3")["correct"] is False


def test_nombre_sans_arrondi_autorise(client: TestClient) -> None:
    expected = {"kind": "number", "value": "2*sqrt(13)", "decimals": None}
    assert correct(client, expected, "7,2")["correct"] is False


@pytest.mark.parametrize(
    "answer",
    [
        "__import__('os').system('ls')",
        "().__class__.__bases__",
        "9**9**9**9",
        "10^10^10",
        "x" * 201,
        "eval(1)",
        "lambda: 1",
        "1" * 30,
        "a.b",
        "",
    ],
)
def test_injections_refusees(client: TestClient, answer: str) -> None:
    assert correct(client, SOLUTION_5, answer) == {"correct": False, "reason": "invalid_input"}
