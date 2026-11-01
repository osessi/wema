"""Rendu lisible des expressions : texte pour l'élève et LaTeX."""

import re

from sympy import Basic, Mul, Number, latex
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


def fold_signs(expr: Basic) -> Basic:
    """Calcule les produits de nombres seuls (`-1 × 9` devient `-9`), sans toucher
    au reste : l'énoncé garde sa forme (`3(x + 2)` n'est pas développé)."""
    if not expr.args:
        return expr
    if isinstance(expr, Mul) and all(isinstance(a, Number) for a in expr.args):
        return Mul(*expr.args)
    return expr.func(*(fold_signs(a) for a in expr.args), evaluate=False)


def render(left: Basic, right: Basic | None = None) -> dict[str, str]:
    """Texte et LaTeX d'une expression ou d'une égalité."""
    left = fold_signs(left)
    right = None if right is None else fold_signs(right)
    if right is None:
        return {"text": to_text(left), "latex": latex(left)}
    return {
        "text": f"{to_text(left)} = {to_text(right)}",
        "latex": f"{latex(left)} = {latex(right)}",
    }
