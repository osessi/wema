"""Comparaisons mathématiques communes aux exercices, réponses et étapes."""

import cmath

from sympy import (
    Basic,
    EmptySet,
    Expr,
    FiniteSet,
    I,
    Number,
    Rational,
    S,
    cancel,
    expand,
    nan,
    oo,
    simplify,
    solveset,
    zoo,
)
from sympy.polys.rootoftools import ComplexRootOf
from sympy.sets.sets import Set

# Points d'essai pour une comparaison numérique rapide : des rationnels peu
# ordinaires, pour qu'une égalité fortuite soit improbable.
_PROBES = (Rational(7, 3), Rational(-11, 5), Rational(13, 4), Rational(-5, 7))
_PRECISION = 30


def _numeric(expr: Expr, point: dict[Basic, Basic]) -> complex | None:
    value = expr.evalf(_PRECISION, subs=point)
    if not isinstance(value, Number) and not value.is_number:
        return None
    try:
        result = complex(value)
    except (TypeError, ValueError):
        return None
    if cmath.isnan(result) or cmath.isinf(result):
        return None
    return result


def numerically_different(a: Expr, b: Expr) -> bool:
    """Vrai si une évaluation en quelques points montre que `a` et `b` diffèrent.

    Rapide même sur des écritures très longues à développer : on n'appelle
    `simplify` que si cette épreuve n'a rien trouvé.
    """
    symbols = sorted((a - b).free_symbols, key=str)
    for shift in range(len(_PROBES)):
        point = {s: _PROBES[(i + shift) % len(_PROBES)] for i, s in enumerate(symbols)}
        va, vb = _numeric(a, point), _numeric(b, point)
        if va is None or vb is None:
            continue
        if abs(va - vb) > 1e-12 * max(1.0, abs(va), abs(vb)):
            return True
        if not symbols:
            break
    return False


def equivalent(a: Expr, b: Expr) -> bool:
    """Égalité mathématique de deux expressions (pas seulement d'écriture)."""
    difference = a - b
    if difference == 0:
        return True
    if numerically_different(a, b):
        return False
    return expand(difference) == 0 or simplify(difference) == 0


def is_real_finite(value: Expr) -> bool:
    """Valeur réelle et finie, exprimable simplement (ni complexe, ni racine implicite)."""
    if value.has(zoo, nan, oo, -oo, I, ComplexRootOf):
        return False
    return value.is_real is True and value.is_finite is True


def proportional(a: Expr, b: Expr) -> bool:
    """`a = k × b` avec k constant non nul (deux équations `a = 0` et `b = 0` équivalentes)."""
    if b == 0:
        return a == 0
    ratio = cancel(a / b)
    return not ratio.free_symbols and ratio != 0 and is_real_finite(ratio)


def solution_set(left: Expr, right: Expr, variable: Basic) -> Set:
    """Solutions réelles d'une équation."""
    return solveset(left - right, variable, domain=S.Reals)


def same_values(a: list[Expr], b: list[Expr]) -> bool:
    """Deux ensembles finis de valeurs égaux (ordre et doublons indifférents)."""
    remaining = list(dict.fromkeys(b))
    for value in dict.fromkeys(a):
        match = next((r for r in remaining if equivalent(value, r)), None)
        if match is None:
            return False
        remaining.remove(match)
    return not remaining


def finite_values(solutions: Set) -> list[Expr] | None:
    """Valeurs d'un ensemble fini de solutions, sinon `None`."""
    if solutions is EmptySet or solutions == S.EmptySet:
        return []
    if isinstance(solutions, FiniteSet):
        return list(solutions)
    return None
