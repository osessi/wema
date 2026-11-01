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
            value = part
        else:
            left, right = (s.strip() for s in sides)
            # « X = 3 » pour la variable x : la majuscule n'est pas une faute de maths.
            if left.lower() != variable.lower():
                raise InvalidInputError("égalité qui ne porte pas sur la variable")
            value = right
        # « ±√2 » désigne deux valeurs.
        if value.startswith("±"):
            values.extend([value[1:], f"-({value[1:]})"])
        else:
            values.append(value)
    return values
