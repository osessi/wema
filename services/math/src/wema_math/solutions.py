"""Découpage d'une liste de solutions écrite par un élève."""

import re

from .parsing import InvalidInputError, split_equation

_SEPARATORS = re.compile(r";|\bou\b|\bet\b|\bor\b|,(?=\s)|,(?=-)|,$")
_SET_PREFIX = re.compile(r"^\s*[Ss]\s*=\s*")


def split_values(source: str, variable: str) -> list[str]:
    """« x = 3 ou x = −3 », « 3; -3 », « S = {3 ; -3} » donnent ["3", "-3"]."""
    text = _SET_PREFIX.sub("", source).replace("{", "").replace("}", "")
    parts = [p.strip() for p in _SEPARATORS.split(text) if p.strip()]
    if not parts:
        raise InvalidInputError("aucune valeur")
    values = []
    for part in parts:
        sides = split_equation(part)
        if sides is None:
            values.append(part)
            continue
        left, right = (s.strip() for s in sides)
        if left != variable:
            raise InvalidInputError("égalité qui ne porte pas sur la variable")
        values.append(right)
    return values
