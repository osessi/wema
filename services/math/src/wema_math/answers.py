"""Correction de la réponse d'un élève à partir de la réponse canonique."""

import re
from decimal import ROUND_HALF_UP, Decimal
from math import gcd

from sympy import Add, Basic, Expr, Float, Integer, Mul, Number, Pow, Rational, S

from .compare import equivalent, is_real_finite, same_values
from .parsing import (
    MAX_TASK_LENGTH,
    InvalidInputError,
    TooComplexError,
    normalize_student,
    parse_expression,
)
from .schemas import (
    CanonicalAnswer,
    CheckAnswerResponse,
    ExpressionAnswer,
    NumberAnswer,
    SolutionsAnswer,
)
from .solutions import split_values

_DECIMAL_LITERAL = re.compile(r"^-?\d+(\.\d+)?$")


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


def _is_trivial_factor(expr: Basic) -> bool:
    """Facteur qui ne change rien : 1, −1, ou une division par 1 ou −1."""
    if expr in (S.One, S.NegativeOne):
        return True
    return isinstance(expr, Pow) and expr.base in (S.One, S.NegativeOne)


def _strip_trivial(expr: Basic) -> Basic:
    """Retire les facteurs ±1 et les divisions par 1 : `1*(2x+6)` devient `2x+6`."""
    if not isinstance(expr, Mul):
        return expr
    kept = [_strip_trivial(a) for a in expr.args if not _is_trivial_factor(a)]
    if not kept:
        return S.One
    return kept[0] if len(kept) == 1 else Mul(*kept, evaluate=False)


def _factor_count(expr: Basic) -> int:
    """Nombre de facteurs non constants d'une écriture, avec multiplicité."""
    expr = _strip_trivial(expr)
    if isinstance(expr, Mul):
        return sum(_factor_count(a) for a in expr.args)
    if isinstance(expr, Pow) and isinstance(expr.exp, Integer) and expr.exp > 0:
        return _factor_count(expr.base) * int(expr.exp)
    return 1 if expr.free_symbols else 0


def is_factored_like(written: Basic, reference: Expr) -> bool:
    """Forme factorisée : un produit (pas une somme déguisée par ×1 ou ÷1) qui compte
    au moins autant de facteurs non constants que la factorisation de référence."""
    stripped = _strip_trivial(written)
    if isinstance(stripped, Add):
        return False
    return _factor_count(stripped) >= _factor_count(reference)


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
    except TooComplexError:
        return CheckAnswerResponse(correct=False, reason="too_complex")
    except (TypeError, ValueError, NotImplementedError, AttributeError, ArithmeticError):
        # Écriture que SymPy ne sait pas comparer : jamais une erreur 500.
        return CheckAnswerResponse(correct=False, reason="invalid_input")


def _check_solutions(expected: SolutionsAnswer, text: str) -> CheckAnswerResponse:
    given = [parse_expression(v) for v in split_values(text, expected.variable)]
    if any(v.free_symbols or not is_real_finite(v) for v in given):
        return CheckAnswerResponse(correct=False, reason="not_equivalent")
    reference = [_canonical(v) for v in expected.values]
    if same_values(given, reference):
        return CheckAnswerResponse(correct=True)
    return CheckAnswerResponse(correct=False, reason="not_equivalent")


def _check_expression(expected: ExpressionAnswer, text: str) -> CheckAnswerResponse:
    written = parse_expression(text, evaluate=False)
    given = parse_expression(text)
    reference = _canonical(expected.value)
    if not equivalent(given, reference):
        return CheckAnswerResponse(correct=False, reason="not_equivalent")
    if expected.form == "expanded" and not is_expanded_form(written):
        return CheckAnswerResponse(correct=False, reason="wrong_form")
    if expected.form == "factored":
        # Lue sans évaluation : SymPy distribuerait 2*(x + 3) en 2*x + 6.
        shape = parse_expression(expected.value, max_length=MAX_TASK_LENGTH, evaluate=False)
        if isinstance(shape, Mul | Pow) and not is_factored_like(written, shape):
            return CheckAnswerResponse(correct=False, reason="wrong_form")
    return CheckAnswerResponse(correct=True)


def _is_square_root(expr: Basic) -> bool:
    return (
        isinstance(expr, Pow)
        and expr.exp == Rational(1, 2)
        and isinstance(expr.base, Integer)
        and expr.base > 1
    )


def _is_simple_term(expr: Basic) -> bool:
    """Nombre écrit sans opération en attente : 7, 7.2, −3, 7/2 (irréductible), √52, 2√13."""
    if isinstance(expr, Number):
        return True
    if _is_square_root(expr):
        return True
    if not isinstance(expr, Mul):
        return False
    args = list(expr.args)
    if len(args) == 2 and S.NegativeOne in args:
        other = args[1] if args[0] == S.NegativeOne else args[0]
        return _is_simple_term(other)
    numbers = [a for a in args if isinstance(a, Integer | Float)]
    roots = [a for a in args if _is_square_root(a)]
    denominators = [
        a for a in args if isinstance(a, Pow) and a.exp == -1 and isinstance(a.base, Integer)
    ]
    if len(numbers) + len(roots) + len(denominators) != len(args):
        return False
    if len(numbers) > 1 or len(roots) > 1 or len(denominators) > 1:
        return False
    if denominators:
        q = int(denominators[0].base)
        p = int(numbers[0]) if numbers and isinstance(numbers[0], Integer) else 1
        if q <= 1 or (numbers and not isinstance(numbers[0], Integer)) or gcd(p, q) != 1:
            return False
    return True


def is_simplified_number(written: Basic, reference: Expr) -> bool:
    """Valeur donnée sous forme simplifiée. Une somme n'est admise que si la
    valeur exacte attendue en est une (ex. 1 + √2)."""
    if isinstance(written, Add):
        return isinstance(reference, Add) and all(_is_simple_term(a) for a in written.args)
    return _is_simple_term(written)


def _check_number(expected: NumberAnswer, text: str) -> CheckAnswerResponse:
    written = parse_expression(text, evaluate=False)
    given = parse_expression(text)
    if given.free_symbols or not is_real_finite(given):
        return CheckAnswerResponse(correct=False, reason="not_equivalent")
    reference = _canonical(expected.value)
    literal = _DECIMAL_LITERAL.fullmatch(text.strip()) is not None
    if expected.decimals is not None and literal:
        # Valeur arrondie : exactement au nombre de décimales demandé.
        step = Decimal(1).scaleb(-expected.decimals)
        rounded = Decimal(str(reference.evalf(30))).quantize(step, rounding=ROUND_HALF_UP)
        typed = Decimal(text.strip())
        if typed == rounded:
            return CheckAnswerResponse(correct=True)
        if (
            -typed.as_tuple().exponent > expected.decimals
            and typed.quantize(step, rounding=ROUND_HALF_UP) == rounded
        ):
            return CheckAnswerResponse(correct=False, reason="wrong_form")
        if not equivalent(given, reference):
            return CheckAnswerResponse(correct=False, reason="not_equivalent")
    if not equivalent(given, reference):
        return CheckAnswerResponse(correct=False, reason="not_equivalent")
    if not is_simplified_number(written, reference):
        return CheckAnswerResponse(correct=False, reason="wrong_form")
    return CheckAnswerResponse(correct=True)
