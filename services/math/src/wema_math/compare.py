"""Comparaisons mathématiques communes aux exercices, réponses et étapes."""

from sympy import Basic, EmptySet, Expr, FiniteSet, S, expand, simplify, solveset
from sympy.sets.sets import Set


def equivalent(a: Expr, b: Expr) -> bool:
    """Égalité mathématique de deux expressions (pas seulement d'écriture)."""
    difference = expand(a - b)
    return difference == 0 or simplify(difference) == 0


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
