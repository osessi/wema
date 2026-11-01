"""Vérification d'une suite d'étapes de calcul."""

from sympy import Expr, Symbol

from .compare import equivalent, solution_set
from .parsing import (
    InvalidInputError,
    normalize_student,
    parse_equation,
    parse_expression,
    split_equation,
)
from .schemas import CheckStepsRequest, CheckStepsResponse


def check_steps(request: CheckStepsRequest) -> CheckStepsResponse:
    """Chaque étape doit être équivalente à la première : même ensemble de solutions
    pour des équations, même valeur pour des expressions."""
    texts = [normalize_student(s) for s in request.steps]
    equations = [split_equation(t) is not None for t in texts]
    valid: list[bool] = []
    reference = None
    for index, text in enumerate(texts):
        try:
            if equations[index] != equations[0]:
                raise InvalidInputError("étapes de natures différentes")
            if equations[0]:
                if request.variable is None:
                    raise InvalidInputError("variable manquante")
                current = solution_set(*parse_equation(text), Symbol(request.variable))
                ok = reference is None or current == reference
            else:
                expression: Expr = parse_expression(text)
                current = expression
                ok = reference is None or equivalent(expression, reference)
        except InvalidInputError:
            valid.append(False)
            continue
        if reference is None:
            reference = current
        valid.append(ok)
    first_invalid = next((i for i, v in enumerate(valid) if not v), None)
    return CheckStepsResponse(valid=valid, firstInvalid=first_invalid)
