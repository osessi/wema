"""Rendu lisible des expressions : texte pour l'élève et LaTeX."""

import re

from sympy import Basic, Mul, Number, S, latex
from sympy.printing.str import StrPrinter


class _TextPrinter(StrPrinter):
    """Impression en texte, avant les retouches typographiques."""

    def _print_Pow(self, expr, rational=False):  # noqa: N802 (nom imposé par SymPy)
        base, exponent = expr.args
        if exponent == 1 / 2 or str(exponent) == "1/2":
            inner = self._print(base)
            simple = re.fullmatch(r"[0-9A-Za-z.]+", inner) is not None
            return f"√{inner}" if simple else f"√({inner})"
        return super()._print_Pow(expr, rational)


_PRINTER = _TextPrinter({"order": "none"})


def to_text(expr: Basic) -> str:
    """`3*x - 2` devient `3x − 2`, `x**2` devient `x^2`, `sqrt(52)` devient `√52`."""
    text = _PRINTER.doprint(expr)
    text = text.replace("sqrt(", "√(")
    text = text.replace("**", "^")
    # Multiplication implicite : nombre ou parenthèse fermante devant une lettre,
    # une parenthèse ouvrante ou une racine.
    text = re.sub(r"(?<=[0-9)])\*(?=[A-Za-z(√])", "", text)
    text = re.sub(r"(?<=[A-Za-z])\*(?=[A-Za-z(√])", "", text)
    text = text.replace("*", " × ")
    return re.sub(r"(?<=\s)-(?=\s)|^-|(?<=\()-", "−", text)


def tidy(expr: Basic) -> Basic:
    """Retouches d'écriture qui ne calculent rien de l'exercice :
    - le signe d'un nombre (`-1 × 9` devient `-9`, `-1 × -3` devient `3`) ;
    - un facteur 1 disparaît (`1x^2` devient `x^2`) ;
    - le nombre passe devant (`x × 3` devient `3x`).
    Les produits de nombres ne sont jamais calculés : `7 × 8` reste `7 × 8`."""
    if not expr.args:
        return expr
    args = [tidy(a) for a in expr.args]
    if not isinstance(expr, Mul):
        return expr.func(*args, evaluate=False)
    if len(args) == 2 and S.NegativeOne in args:
        other = args[1] if args[0] == S.NegativeOne else args[0]
        if isinstance(other, Number):
            return -other
    args = [a for a in args if a != S.One] or [S.One]
    numbers = [a for a in args if isinstance(a, Number)]
    if len(numbers) == 1 and len(args) > 1:
        args = numbers + [a for a in args if not isinstance(a, Number)]
    return args[0] if len(args) == 1 else Mul(*args, evaluate=False)


def render(left: Basic, right: Basic | None = None, *, fold: bool = True) -> dict[str, str]:
    """Texte et LaTeX d'une expression ou d'une égalité. Sans `fold`, l'écriture
    est laissée telle quelle (énoncé d'un calcul à faire)."""
    if fold:
        left = tidy(left)
        right = None if right is None else tidy(right)
    if right is None:
        return {"text": to_text(left), "latex": latex(left)}
    return {
        "text": f"{to_text(left)} = {to_text(right)}",
        "latex": f"{latex(left)} = {latex(right)}",
    }
