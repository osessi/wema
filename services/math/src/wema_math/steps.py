"""Vérification d'une suite d'étapes de calcul."""

from typing import Literal

from sympy import Symbol

from .compare import equivalent, proportional, solution_set
from .parsing import (
    InvalidInputError,
    TooComplexError,
    normalize_student,
    parse_equation,
    parse_expression,
    split_equation,
)

StepVerdict = Literal["ok", "bad", "unreadable"]


def readable(text: str, variable: str | None) -> bool:
    """L'étape s'analyse-t-elle (égalité avec sa variable, ou expression) ?"""
    text = normalize_student(text)
    try:
        if split_equation(text) is not None:
            if variable is None:
                return False
            parse_equation(text)
        else:
            parse_expression(text)
    except (InvalidInputError, TooComplexError, TypeError, ValueError):
        return False
    return True


def compare_step(previous: str, current: str, variable: str | None) -> StepVerdict:
    """Compare une étape à la précédente lisible : même ensemble de solutions pour des
    équations (et, sans solution réelle, des équations proportionnelles), même valeur
    pour des expressions. Exécuté sous délai par l'appelant."""
    try:
        before, after = normalize_student(previous), normalize_student(current)
        is_equation = split_equation(after) is not None
        if is_equation != (split_equation(before) is not None):
            return "bad"
        if not is_equation:
            return "ok" if equivalent(parse_expression(before), parse_expression(after)) else "bad"
        if variable is None:
            return "unreadable"
        x = Symbol(variable)
        left1, right1 = parse_equation(before)
        left2, right2 = parse_equation(after)
        first, second = solution_set(left1, right1, x), solution_set(left2, right2, x)
        if first != second:
            return "bad"
        if first.is_empty:
            # Deux équations sans solution réelle ne sont pas pour autant équivalentes.
            return "ok" if proportional(left1 - right1, left2 - right2) else "bad"
        return "ok"
    except InvalidInputError:
        return "unreadable"
    except (TypeError, ValueError, NotImplementedError, AttributeError, ArithmeticError):
        return "bad"
