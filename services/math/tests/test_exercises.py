"""Vérification d'exercices paramétrés (POST /exercises/check)."""

from fastapi.testclient import TestClient


def check(client: TestClient, **body: object) -> dict:
    response = client.post("/exercises/check", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_equation_premier_degre(client: TestClient) -> None:
    result = check(
        client,
        task={"kind": "solve", "equation": "a*x + b = c", "variable": "x"},
        parameters={"a": 3, "b": -2, "c": 13},
        constraints=["Ne(a, 0)", "Eq(Mod(c - b, a), 0)"],
    )
    assert result["ok"] is True
    assert result["answer"] == {"kind": "solutions", "variable": "x", "values": ["5"]}
    assert result["rendered"]["equation"]["text"] == "3x − 2 = 13"
    assert result["rendered"]["equation"]["latex"] == "3 x - 2 = 13"


def test_contrainte_non_satisfaite(client: TestClient) -> None:
    result = check(
        client,
        task={"kind": "solve", "equation": "a*x + b = c", "variable": "x"},
        parameters={"a": 3, "b": 2, "c": 12},
        constraints=["Eq(Mod(c - b, a), 0)"],
    )
    assert result == {"ok": False, "reason": "constraint_failed"}


def test_pas_de_solution(client: TestClient) -> None:
    result = check(
        client,
        task={"kind": "solve", "equation": "a*x + b = a*x + c", "variable": "x"},
        parameters={"a": 2, "b": 1, "c": 5},
    )
    assert result == {"ok": False, "reason": "no_solution"}


def test_infinite_de_solutions_non_prise_en_charge(client: TestClient) -> None:
    result = check(client, task={"kind": "solve", "equation": "x + 1 = x + 1", "variable": "x"})
    assert result == {"ok": False, "reason": "unsupported"}


def test_reponse_attendue_qui_ne_correspond_pas(client: TestClient) -> None:
    task = {"kind": "solve", "equation": "a*x = b", "variable": "x"}
    assert check(client, task=task, parameters={"a": 2, "b": 8}, expected="b/a")["ok"] is True
    result = check(client, task=task, parameters={"a": 2, "b": 8}, expected="b - a")
    assert result == {"ok": False, "reason": "mismatch"}


def test_developpement(client: TestClient) -> None:
    result = check(
        client, task={"kind": "expand", "expression": "k*(x + a)"}, parameters={"k": -3, "a": 2}
    )
    assert result["answer"] == {"kind": "expression", "value": "-3*x - 6", "form": "expanded"}
    assert result["rendered"]["expression"]["text"] == "−3(x + 2)"


def test_factorisation(client: TestClient) -> None:
    result = check(client, task={"kind": "factor", "expression": "x**2 - a"}, parameters={"a": 9})
    assert result["answer"]["form"] == "factored"
    assert result["answer"]["value"] == "(x - 3)*(x + 3)"


def test_pythagore_avec_arrondi(client: TestClient) -> None:
    result = check(
        client,
        task={"kind": "evaluate", "expression": "sqrt(a**2 + b**2)", "round": 1},
        parameters={"a": 4, "b": 6},
        expected="7,2",
    )
    assert result["ok"] is True
    assert result["answer"] == {"kind": "number", "value": "2*sqrt(13)", "decimals": 1}


def test_carre_et_racine(client: TestClient) -> None:
    result = check(client, task={"kind": "evaluate", "expression": "sqrt(a)"}, parameters={"a": 49})
    assert result["answer"]["value"] == "7"


def test_nom_de_parametre_en_plusieurs_lettres(client: TestClient) -> None:
    result = check(
        client,
        task={"kind": "evaluate", "expression": "sqrt(hyp**2 - cote**2)"},
        parameters={"hyp": 10, "cote": 6},
    )
    assert result["answer"]["value"] == "8"


def test_parametre_au_nom_reserve(client: TestClient) -> None:
    result = check(client, task={"kind": "evaluate", "expression": "pi"}, parameters={"pi": 3})
    assert result == {"ok": False, "reason": "invalid_input"}


def test_modele_d_exercice_malveillant(client: TestClient) -> None:
    bad = [
        {"task": {"kind": "evaluate", "expression": "__import__('os').getcwd()"}},
        {"task": {"kind": "evaluate", "expression": "9**(9**9)"}},
        {"task": {"kind": "evaluate", "expression": "x"}, "constraints": ["().__class__"]},
        {"task": {"kind": "solve", "equation": "x = getattr", "variable": "x"}},
        {"task": {"kind": "solve", "equation": "a*x = 1", "variable": "a"}, "parameters": {"a": 2}},
    ]
    for body in bad:
        assert check(client, **body) == {"ok": False, "reason": "invalid_input"}, body
