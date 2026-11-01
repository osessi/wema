"""Analyse sûre des expressions mathématiques.

Les réponses des élèves et les modèles d'exercices sont des entrées non
fiables : on ne les confie à SymPy qu'après filtrage (caractères, noms,
longueur), avec un dictionnaire global restreint, et on borne la taille des
nombres avant toute évaluation (pas de `9**9**9`).
"""

import re
from math import log10

from sympy import (
    Abs,
    Add,
    Basic,
    Eq,
    Expr,
    Float,
    Function,
    Ge,
    Gt,
    Integer,
    Le,
    Lt,
    Mod,
    Mul,
    Ne,
    Number,
    Pow,
    Rational,
    Symbol,
    pi,
    sqrt,
)
from sympy.core.relational import Relational
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication,
    parse_expr,
    standard_transformations,
)

MAX_ANSWER_LENGTH = 200
MAX_TASK_LENGTH = 500

# Fonctions qu'une expression peut appeler. Tout autre nom de plus d'une
# lettre est refusé.
FUNCTIONS: dict[str, object] = {
    "sqrt": sqrt,
    "Abs": Abs,
    "abs": Abs,
    "Mod": Mod,
    "Ne": Ne,
    "Eq": Eq,
    "Lt": Lt,
    "Le": Le,
    "Gt": Gt,
    "Ge": Ge,
    "pi": pi,
    "Rational": Rational,
}

# Noms dont le code généré par parse_expr a besoin. Les `__builtins__` vides
# empêchent l'accès aux fonctions de Python.
_GLOBALS: dict[str, object] = {
    "__builtins__": {},
    "Integer": Integer,
    "Float": Float,
    "Rational": Rational,
    "Symbol": Symbol,
    "Add": Add,
    "Mul": Mul,
    "Pow": Pow,
    **FUNCTIONS,
}

_TRANSFORMATIONS = (*standard_transformations, implicit_multiplication, convert_xor)

_ALLOWED_CHARS = re.compile(r"^[0-9A-Za-z+\-*/^()., <>!=]*$")
_DECIMAL = re.compile(r"\d+\.\d+")
_NAME = re.compile(r"[A-Za-z]+")
_DIGITS = re.compile(r"\d+")

# Bornes : nombre de chiffres d'un littéral, ordre de grandeur estimé d'un
# résultat, nombre de nœuds de l'arbre.
MAX_LITERAL_DIGITS = 15
MAX_MAGNITUDE_DIGITS = 1000
MAX_NODES = 300
# Ordre de grandeur supposé d'une variable libre (paramètre déjà remplacé
# par sa valeur, sinon inconnue).
_SYMBOL_MAGNITUDE = 6.0


class InvalidInputError(ValueError):
    """Entrée refusée : caractère, nom ou taille interdits, ou syntaxe illisible."""


def _check_source(source: str, max_length: int, names: set[str]) -> None:
    if len(source) > max_length:
        raise InvalidInputError("entrée trop longue")
    if not _ALLOWED_CHARS.match(source):
        raise InvalidInputError("caractère interdit")
    if "." in _DECIMAL.sub("", source):
        raise InvalidInputError("point hors d'un nombre décimal")
    for name in _NAME.findall(source):
        if len(name) > 1 and name not in FUNCTIONS and name not in names:
            raise InvalidInputError(f"nom inconnu : {name}")
    for digits in _DIGITS.findall(source):
        if len(digits) > MAX_LITERAL_DIGITS:
            raise InvalidInputError("nombre trop long")


def _magnitude(expr: Basic) -> float:
    """Majorant grossier du nombre de chiffres d'une valeur, sans l'évaluer."""
    if isinstance(expr, Number):
        if expr.is_zero:
            return 0.0
        if expr.is_Rational:
            p, q = abs(int(expr.p)), abs(int(expr.q))
            return max(log10(p) if p else 0.0, log10(q) if q else 0.0)
        return log10(abs(float(expr))) if abs(float(expr)) > 1 else 0.0
    if isinstance(expr, Symbol):
        return _SYMBOL_MAGNITUDE
    if isinstance(expr, Pow):
        base, exponent = expr.args
        if not (isinstance(exponent, Number) and exponent.is_Rational):
            raise InvalidInputError("exposant non numérique")
        return max(_magnitude(base), 1.0) * abs(float(exponent))
    if isinstance(expr, Mul):
        return sum(_magnitude(a) for a in expr.args)
    if isinstance(expr, Add):
        return max((_magnitude(a) for a in expr.args), default=0.0) + 1.0
    return max((_magnitude(a) for a in expr.args), default=0.0)


def _check_tree(expr: Basic) -> None:
    nodes = sum(1 for _ in _preorder(expr))
    if nodes > MAX_NODES:
        raise InvalidInputError("expression trop grande")
    if _magnitude(expr) > MAX_MAGNITUDE_DIGITS:
        raise InvalidInputError("nombre trop grand")


def _preorder(expr: Basic):
    yield expr
    for arg in expr.args:
        yield from _preorder(arg)


def _parse(source: str, local: dict[str, Basic], evaluate: bool) -> Basic:
    try:
        return parse_expr(
            source,
            local_dict=dict(local),
            global_dict=dict(_GLOBALS),
            transformations=_TRANSFORMATIONS,
            evaluate=evaluate,
        )
    except InvalidInputError:
        raise
    except Exception as error:  # syntaxe illisible : TokenError, SyntaxError, TypeError…
        raise InvalidInputError("syntaxe illisible") from error


def parse_math(
    source: str,
    *,
    local: dict[str, Basic] | None = None,
    max_length: int = MAX_ANSWER_LENGTH,
    evaluate: bool = True,
) -> Basic:
    """Analyse une expression (ou une relation) filtrée, sans signe `=` simple."""
    text = source.strip()
    if not text:
        raise InvalidInputError("entrée vide")
    names = local or {}
    _check_source(text, max_length, set(names))
    # « x(x + 1) » est un produit, pas l'appel d'une fonction x.
    text = re.sub(
        r"(?<![A-Za-z])([A-Za-z]+)\s*\(",
        lambda m: m.group(0) if m.group(1) in FUNCTIONS else f"{m.group(1)}*(",
        text,
    )
    unevaluated = _parse(text, names, evaluate=False)
    for node in _preorder(unevaluated):
        if isinstance(node, Function) and type(node).__name__ not in FUNCTIONS:
            raise InvalidInputError("fonction inconnue")
    _check_tree(unevaluated)
    return unevaluated if not evaluate else _parse(text, names, evaluate=True)


def split_equation(source: str) -> tuple[str, str] | None:
    """Sépare `gauche = droite` ; `None` s'il n'y a pas de `=` simple."""
    parts = re.split(r"(?<![<>!=])=(?!=)", source)
    if len(parts) == 1:
        return None
    if len(parts) != 2:
        raise InvalidInputError("plusieurs signes égal")
    return parts[0], parts[1]


def parse_expression(
    source: str,
    *,
    local: dict[str, Basic] | None = None,
    max_length: int = MAX_ANSWER_LENGTH,
    evaluate: bool = True,
) -> Expr:
    """Analyse une expression (ni égalité ni relation)."""
    if split_equation(source) is not None:
        raise InvalidInputError("égalité inattendue")
    result = parse_math(source, local=local, max_length=max_length, evaluate=evaluate)
    if isinstance(result, Relational) or not isinstance(result, Expr):
        raise InvalidInputError("expression attendue")
    return result


def parse_equation(
    source: str,
    *,
    local: dict[str, Basic] | None = None,
    max_length: int = MAX_ANSWER_LENGTH,
    evaluate: bool = True,
) -> tuple[Expr, Expr]:
    """Analyse une égalité `gauche = droite`."""
    sides = split_equation(source)
    if sides is None:
        raise InvalidInputError("égalité attendue")
    left = parse_expression(sides[0], local=local, max_length=max_length, evaluate=evaluate)
    right = parse_expression(sides[1], local=local, max_length=max_length, evaluate=evaluate)
    return left, right


_SQRT = re.compile(r"√\s*(\d+(?:[.,]\d+)?|[A-Za-z]|\([^()]*\))")


def normalize_student(source: str) -> str:
    """Ramène l'écriture d'un élève à la syntaxe analysable.

    Virgule décimale, symboles ×, ÷, −, ², ³, √. Les virgules suivies d'un
    espace restent des séparateurs (« 3, -3 »).
    """
    text = source.strip()
    text = text.replace("−", "-").replace("–", "-").replace("×", "*").replace("·", "*")
    text = text.replace("÷", "/").replace("²", "^2").replace("³", "^3")
    text = _SQRT.sub(lambda m: f"sqrt({m.group(1).strip('()')})", text)
    return re.sub(r"(\d),(\d)", r"\1.\2", text)
