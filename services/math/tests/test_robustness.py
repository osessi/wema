"""Correctifs de la relecture du lot 3 : déni de service, réponses impossibles,
erreurs 500, formes exigées, énoncé qui donnerait la réponse, lots de paramètres."""

from time import monotonic

import pytest
from fastapi.testclient import TestClient

EXPANDED = {"kind": "expression", "value": "3*x + 6", "form": "expanded"}
NUMBER_49 = {"kind": "number", "value": "49", "decimals": None}
PYTHAGORE = {"kind": "number", "value": "2*sqrt(13)", "decimals": 1}


def answer(client: TestClient, expected: dict, text: str) -> dict:
    response = client.post("/answers/check", json={"expected": expected, "answer": text})
    assert response.status_code == 200, response.text
    return response.json()


def exercise(client: TestClient, **body: object) -> dict:
    response = client.post("/exercises/check", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def steps(client: TestClient, body: dict) -> dict:
    response = client.post("/steps/check", json=body)
    assert response.status_code == 200, response.text
    return response.json()


# --- B1 : une entrée pathologique ne gèle pas le service ---------------------


@pytest.mark.parametrize(
    ("expected", "text"),
    [
        (EXPANDED, "(a+b+c+d)^30"),
        (EXPANDED, "(a+b+c+d+e+f+g+h+i+j+k+l)^140"),
        (PYTHAGORE, "(sqrt(2)+sqrt(3)+sqrt(5)+sqrt(7)+sqrt(11)+sqrt(13))^100"),
    ],
)
def test_reponse_trop_couteuse(client: TestClient, expected: dict, text: str) -> None:
    start = monotonic()
    assert answer(client, expected, text) == {"correct": False, "reason": "too_complex"}
    assert monotonic() - start < 5


def test_exercice_trop_couteux(client: TestClient) -> None:
    start = monotonic()
    result = exercise(
        client,
        task={"kind": "evaluate", "expression": "(sqrt(2)+sqrt(3)+sqrt(5)+sqrt(7)+sqrt(11))**60"},
    )
    assert result == {"ok": False, "reason": "too_complex"}
    assert monotonic() - start < 5


def test_calcul_interrompu_puis_service_reactif(client: TestClient) -> None:
    # Bornes peu coûteuses franchies, mais résolution interminable : le délai coupe.
    start = monotonic()
    result = steps(client, {"steps": ["x = 1", "x^140 + x^7 - 3*x + 1 = 0"], "variable": "x"})
    assert result == {"valid": [True, False], "firstInvalid": 1}
    assert monotonic() - start < 5
    start = monotonic()
    assert answer(client, EXPANDED, "3x + 6") == {"correct": True, "reason": None}
    assert client.get("/health").json() == {"ok": True}
    assert monotonic() - start < 2


# --- Lot de paramètres -------------------------------------------------------

EQUATION = {"kind": "solve", "equation": "a*x + b = c", "variable": "x"}


def test_premier_jeu_qui_satisfait_les_contraintes(client: TestClient) -> None:
    result = exercise(
        client,
        task=EQUATION,
        parameterSets=[
            {"a": 3, "b": 2, "c": 12},
            {"a": 4, "b": 1, "c": 2},
            {"a": 3, "b": 2, "c": 11},
        ],
        constraints=["Eq(Mod(c - b, a), 0)"],
    )
    assert result["ok"] is True
    assert result["index"] == 2
    assert result["answer"]["values"] == ["3"]


def test_aucun_jeu_ne_convient(client: TestClient) -> None:
    result = exercise(
        client,
        task=EQUATION,
        parameterSets=[{"a": 3, "b": 2, "c": 12}, {"a": 4, "b": 1, "c": 2}],
        constraints=["Eq(Mod(c - b, a), 0)"],
    )
    assert result == {"ok": False, "reason": "constraint_failed"}


def test_une_autre_erreur_arrete_l_essai(client: TestClient) -> None:
    result = exercise(
        client,
        task={"kind": "solve", "equation": "a*x = b", "variable": "x"},
        parameterSets=[{"a": 2, "b": 8}, {"a": 1, "b": 1}],
        expected="b - a",
    )
    assert result == {"ok": False, "reason": "mismatch"}


def test_un_seul_jeu_a_l_index_zero(client: TestClient) -> None:
    result = exercise(client, task=EQUATION, parameters={"a": 3, "b": -2, "c": 13})
    assert result["index"] == 0


def test_parameters_et_parameter_sets_ensemble_refuses(client: TestClient) -> None:
    body = {"task": EQUATION, "parameters": {"a": 1}, "parameterSets": [{"a": 1}]}
    assert client.post("/exercises/check", json=body).status_code == 422


# --- I3 : réponses canoniques impossibles à servir ---------------------------


@pytest.mark.parametrize(
    "body",
    [
        {"task": {"kind": "evaluate", "expression": "1/a"}, "parameters": {"a": 0}},
        {"task": {"kind": "evaluate", "expression": "sqrt(a)"}, "parameters": {"a": -4}},
        {"task": {"kind": "solve", "equation": "x**5 - x + 1 = 0", "variable": "x"}},
    ],
)
def test_reponse_non_reelle_ou_implicite(client: TestClient, body: dict) -> None:
    assert exercise(client, **body) == {"ok": False, "reason": "unsupported"}


def test_equation_sans_solution_reelle(client: TestClient) -> None:
    result = exercise(client, task={"kind": "solve", "equation": "x**2 + 1 = 0", "variable": "x"})
    assert result == {"ok": False, "reason": "no_solution"}


def test_reponse_canonique_trop_longue(client: TestClient) -> None:
    result = exercise(client, task={"kind": "factor", "expression": "x**140 - 1"})
    assert result == {"ok": False, "reason": "too_complex"}


# --- I4 : jamais d'erreur 500 ------------------------------------------------


@pytest.mark.parametrize("text", ["sqrt(-2)", "1/0"])
def test_nombre_complexe_ou_infini(client: TestClient, text: str) -> None:
    assert answer(client, PYTHAGORE, text)["correct"] is False


@pytest.mark.parametrize("text", ["(1, 2)", "(x, 2)"])
def test_tuple_refuse(client: TestClient, text: str) -> None:
    assert answer(client, EXPANDED, text) == {"correct": False, "reason": "invalid_input"}


def test_contrainte_tuple_refusee(client: TestClient) -> None:
    result = exercise(
        client, task=EQUATION, parameters={"a": 1, "b": 0, "c": 1}, constraints=["(a, 1)"]
    )
    assert result == {"ok": False, "reason": "invalid_input"}


def test_etapes_que_sympy_ne_sait_pas_resoudre(client: TestClient) -> None:
    body = {
        "steps": ["x = 1", "sqrt(x) + sqrt(x + 1) + sqrt(x + 2) + sqrt(x + 3) = 7"],
        "variable": "x",
    }
    assert steps(client, body)["valid"][1] is False


# --- I5 : formes exigées -----------------------------------------------------


@pytest.mark.parametrize("text", ["7^2", "7*7", "7 × 7", "98/2"])
def test_calcul_recopie_refuse(client: TestClient, text: str) -> None:
    assert answer(client, NUMBER_49, text) == {"correct": False, "reason": "wrong_form"}


def test_nombre_simplifie_accepte(client: TestClient) -> None:
    assert answer(client, NUMBER_49, "49")["correct"] is True
    assert answer(client, PYTHAGORE, "√52")["correct"] is True
    assert answer(client, PYTHAGORE, "2√13")["correct"] is True
    assert answer(client, PYTHAGORE, "sqrt(4^2+6^2)") == {"correct": False, "reason": "wrong_form"}
    assert answer(client, {"kind": "number", "value": "7/2", "decimals": None}, "7/2")["correct"]


@pytest.mark.parametrize(
    ("value", "text"),
    [
        ("2*(x + 3)", "1*(2x+6)"),
        ("2*(x + 3)", "-(-2x-6)"),
        ("(x - 1)*(x + 1)", "(x^2-1)/1"),
        ("2*(x - 3)*(x + 3)", "2(x^2 - 9)"),
    ],
)
def test_factorisation_deguisee(client: TestClient, value: str, text: str) -> None:
    expected = {"kind": "expression", "value": value, "form": "factored"}
    assert answer(client, expected, text) == {"correct": False, "reason": "wrong_form"}


def test_factorisations_justes(client: TestClient) -> None:
    common = {"kind": "expression", "value": "2*(x + 3)", "form": "factored"}
    assert answer(client, common, "2(x+3)")["correct"] is True
    full = {"kind": "expression", "value": "2*(x - 3)*(x + 3)", "form": "factored"}
    assert answer(client, full, "2(x+3)(x-3)")["correct"] is True


def test_produit_implicite_de_lettres(client: TestClient) -> None:
    expected = {"kind": "expression", "value": "x**2 + 2*x*y + y**2", "form": "expanded"}
    assert answer(client, expected, "x^2+2xy+y^2")["correct"] is True


@pytest.mark.parametrize("text", ["X = 5", "x = 5.", "x = 5"])
def test_ecritures_d_eleve_tolerees(client: TestClient, text: str) -> None:
    expected = {"kind": "solutions", "variable": "x", "values": ["5"]}
    assert answer(client, expected, text)["correct"] is True


def test_plus_ou_moins(client: TestClient) -> None:
    expected = {"kind": "solutions", "variable": "x", "values": ["-sqrt(2)", "sqrt(2)"]}
    assert answer(client, expected, "x = ±√2")["correct"] is True


# --- I6 et rendu : l'énoncé ne donne jamais la réponse -----------------------


def test_enonce_evaluer_ne_calcule_rien(client: TestClient) -> None:
    result = exercise(
        client, task={"kind": "evaluate", "expression": "a*b"}, parameters={"a": 7, "b": 8}
    )
    assert "56" not in result["rendered"]["expression"]["text"]
    assert "56" not in result["rendered"]["expression"]["latex"]
    assert result["answer"]["value"] == "56"


def test_rendu_lisible(client: TestClient) -> None:
    expand = exercise(client, task={"kind": "expand", "expression": "x*a"}, parameters={"a": 3})
    assert expand["rendered"]["expression"]["text"] == "3x"
    one = exercise(client, task={"kind": "expand", "expression": "a*x**2"}, parameters={"a": 1})
    assert one["rendered"]["expression"]["text"] == "x^2"
    sign = exercise(client, task={"kind": "expand", "expression": "x - b"}, parameters={"b": -3})
    assert sign["rendered"]["expression"]["text"] == "x + 3"


# --- Mineurs : étapes, noms réservés -----------------------------------------


def test_equations_sans_solution_non_equivalentes(client: TestClient) -> None:
    body = {"steps": ["x^2 + 1 = 0", "x^2 = -5"], "variable": "x"}
    assert steps(client, body) == {"valid": [True, False], "firstInvalid": 1}
    body = {"steps": ["x^2 + 1 = 0", "2x^2 + 2 = 0"], "variable": "x"}
    assert steps(client, body) == {"valid": [True, True], "firstInvalid": None}


def test_premiere_etape_illisible(client: TestClient) -> None:
    body = {"steps": ["2x +", "2x + 3 = 11", "2x = 8"], "variable": "x"}
    assert steps(client, body) == {"valid": [False, True, True], "firstInvalid": 0}


@pytest.mark.parametrize("name", ["if", "lambda", "sqrt", "pi"])
def test_noms_de_parametres_reserves(client: TestClient, name: str) -> None:
    result = exercise(client, task={"kind": "evaluate", "expression": "2"}, parameters={name: 1})
    assert result == {"ok": False, "reason": "invalid_input"}


def test_variable_de_resolution_d_une_seule_lettre(client: TestClient) -> None:
    body = {"task": {"kind": "solve", "equation": "xy = 1", "variable": "xy"}}
    assert client.post("/exercises/check", json=body).status_code == 422
