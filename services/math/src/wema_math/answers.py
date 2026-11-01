"""Correction de la réponse d'un élève à partir de la réponse canonique."""

from sympy import Add, Basic, Expr, Integer, Mul, Pow

from .compare import equivalent, same_values
from .parsing import MAX_TASK_LENGTH, InvalidInputError, normalize_student, parse_expression
from .schemas import (
    CanonicalAnswer,
    CheckAnswerResponse,
    ExpressionAnswer,
    NumberAnswer,
    SolutionsAnswer,
)
from .solutions import split_values


def _canonical(source: str) -> Expr:
    """Valeur canonique produite par ce service (relue avec les mêmes garde-fous)."""
    return parse_expression(source, max_length=MAX_TASK_LENGTH)


def is_expanded_form(expr: Basic) -> bool:
    """Forme développée : aucun produit ne contient une somme, aucune somme n'est élevée
    à une puissance entière supérieure à 1. S'évalue sur l'écriture de l'élève."""
    if isinstance(expr, Mul) and any(isinstance(a, Add) for a in expr.args):
        return False
    if (
        isinstance(expr, Pow)
        and isinstance(expr.base, Add)
        and isinstance(expr.exp, Integer)
        and expr.exp > 1
    ):
        return False
    return all(is_expanded_form(a) for a in expr.args)


def is_factored_form(expr: Basic) -> bool:
    """Forme factorisée : un produit (ou une puissance), pas une somme."""
    return not isinstance(expr, Add)


def check_answer(expected: CanonicalAnswer, answer: str) -> CheckAnswerResponse:
    try:
        text = normalize_student(answer)
        if isinstance(expected, SolutionsAnswer):
            return _check_solutions(expected, text)
        if isinstance(expected, ExpressionAnswer):
            return _check_expression(expected, text)
        return _check_number(expected, text)
    except InvalidInputError:
        return CheckAnswerResponse(correct=False, reason="invalid_input")


def _check_solutions(expected: SolutionsAnswer, text: str) -> CheckAnswerResponse:
    given = [parse_expression(v) for v in split_values(text, expected.variable)]
    if any(v.free_symbols for v in given):
        return CheckAnswerResponse(correct=False, reason="not_equivalent")
    reference = [_canonical(v) for v in expected.values]
    if same_values(given, reference):
        return CheckAnswerResponse(correct=True)
    return CheckAnswerResponse(correct=False, reason="not_equivalent")


def _check_expression(expected: ExpressionAnswer, text: str) -> CheckAnswerResponse:
    given = parse_expression(text)
    written = parse_expression(text, evaluate=False)
    reference = _canonical(expected.value)
    if not equivalent(given, reference):
        return CheckAnswerResponse(correct=False, reason="not_equivalent")
    if expected.form == "expanded" and not is_expanded_form(written):
        return CheckAnswerResponse(correct=False, reason="wrong_form")
    if (
        expected.form == "factored"
        and isinstance(reference, Mul | Pow)
        and not is_factored_form(written)
    ):
        return CheckAnswerResponse(correct=False, reason="wrong_form")
    return CheckAnswerResponse(correct=True)


def _check_number(expected: NumberAnswer, text: str) -> CheckAnswerResponse:
    given = parse_expression(text)
    if given.free_symbols:
        return CheckAnswerResponse(correct=False, reason="not_equivalent")
    reference = _canonical(expected.value)
    if equivalent(given, reference):
        return CheckAnswerResponse(correct=True)
    if expected.decimals is not None:
        tolerance = 0.5 * 10 ** (-expected.decimals) + 1e-12
        if abs(float(given) - float(reference)) <= tolerance:
            return CheckAnswerResponse(correct=True)
    return CheckAnswerResponse(correct=False, reason="not_equivalent")
