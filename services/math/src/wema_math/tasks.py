"""Vérification d'un exercice paramétré : contraintes, calcul de la réponse, rendu."""

from sympy import Basic, Expr, Integer, Symbol, expand, factor, simplify
from sympy.logic.boolalg import BooleanFalse, BooleanTrue

from .compare import equivalent, finite_values, is_real_finite, same_values, solution_set
from .parsing import (
    MAX_TASK_LENGTH,
    InvalidInputError,
    TooComplexError,
    is_reserved_name,
    normalize_student,
    parse_equation,
    parse_expression,
    parse_math,
)
from .rendering import render
from .schemas import (
    CheckExerciseFailure,
    CheckExerciseRequest,
    CheckExerciseSuccess,
    EvaluateTask,
    ExpandTask,
    ExpressionAnswer,
    FactorTask,
    NumberAnswer,
    Rendered,
    SolutionsAnswer,
    SolveTask,
)
from .solutions import split_values


class _UnsupportedError(Exception):
    """Réponse impossible à servir : non réelle, infinie, ou implicite."""


def _parameters(values: dict[str, int]) -> dict[str, Basic]:
    names: dict[str, Basic] = {}
    for name, value in values.items():
        if is_reserved_name(name):
            raise InvalidInputError(f"nom de paramètre réservé : {name}")
        names[name] = Integer(value)
    return names


def _constraints_hold(constraints: list[str], params: dict[str, Basic]) -> bool:
    for source in constraints:
        result = parse_math(
            source, local=params, max_length=MAX_TASK_LENGTH, implicit_letters=False
        )
        if isinstance(result, BooleanTrue):
            continue
        if isinstance(result, BooleanFalse):
            return False
        # Une contrainte qui reste symbolique porte sur un nom inconnu.
        raise InvalidInputError("contrainte non décidable")
    return True


def _expected_values(source: str, params: dict[str, Basic], variable: Symbol) -> list[Expr]:
    values = []
    for part in split_values(normalize_student(source), variable.name):
        values.append(parse_expression(part, local=params, max_length=MAX_TASK_LENGTH))
    return values


def _canonical_text(value: Expr) -> str:
    """Écriture d'une réponse canonique, qui doit se relire avec les mêmes garde-fous."""
    text = str(value)
    if len(text) > MAX_TASK_LENGTH:
        raise TooComplexError("réponse trop longue")
    try:
        reread = parse_expression(text, max_length=MAX_TASK_LENGTH)
    except InvalidInputError as error:
        raise _UnsupportedError from error
    if not equivalent(reread, value):
        raise _UnsupportedError
    return text


def check_exercise(request: CheckExerciseRequest) -> CheckExerciseSuccess | CheckExerciseFailure:
    """Essaie les jeux de paramètres dans l'ordre : le premier qui satisfait les
    contraintes est résolu, et sa réponse confirmée. Toute erreur autre qu'une
    contrainte non satisfaite arrête l'essai."""
    try:
        for index, values in enumerate(request.candidate_sets()):
            params = _parameters(values)
            if not _constraints_hold(request.constraints, params):
                continue
            result = _solve(request, params)
            if isinstance(result, CheckExerciseSuccess):
                result.index = index
            return result
        return CheckExerciseFailure(reason="constraint_failed")
    except InvalidInputError:
        return CheckExerciseFailure(reason="invalid_input")
    except TooComplexError:
        return CheckExerciseFailure(reason="too_complex")
    except _UnsupportedError:
        return CheckExerciseFailure(reason="unsupported")
    except (TypeError, ValueError, NotImplementedError, AttributeError, ArithmeticError):
        # Cas que SymPy ne sait pas traiter : jamais une erreur 500.
        return CheckExerciseFailure(reason="unsupported")


def _solve(
    request: CheckExerciseRequest, params: dict[str, Basic]
) -> CheckExerciseSuccess | CheckExerciseFailure:
    task = request.task
    if isinstance(task, SolveTask):
        return _solve_equation(task, request.expected, params)
    return _compute_expression(task, request.expected, params)


def _solve_equation(
    task: SolveTask, expected: str | None, params: dict[str, Basic]
) -> CheckExerciseSuccess | CheckExerciseFailure:
    if task.variable in params:
        raise InvalidInputError("la variable est aussi un paramètre")
    variable = Symbol(task.variable)
    left, right = parse_equation(
        task.equation, local=params, max_length=MAX_TASK_LENGTH, implicit_letters=False
    )
    values = finite_values(solution_set(left, right, variable))
    if values is None:
        return CheckExerciseFailure(reason="unsupported")
    if not values:
        return CheckExerciseFailure(reason="no_solution")
    if any(v.free_symbols for v in values):
        raise InvalidInputError("solution qui dépend d'un nom inconnu")
    if not all(is_real_finite(v) for v in values):
        raise _UnsupportedError
    if expected is not None and not same_values(
        values, _expected_values(expected, params, variable)
    ):
        return CheckExerciseFailure(reason="mismatch")
    shown = parse_equation(
        task.equation,
        local=params,
        max_length=MAX_TASK_LENGTH,
        evaluate=False,
        implicit_letters=False,
    )
    return CheckExerciseSuccess(
        answer=SolutionsAnswer(
            kind="solutions",
            variable=task.variable,
            values=[_canonical_text(v) for v in sorted(values, key=float)],
        ),
        rendered={"equation": Rendered(**render(*shown))},
    )


def _compute_expression(
    task: ExpandTask | FactorTask | EvaluateTask,
    expected_text: str | None,
    params: dict[str, Basic],
) -> CheckExerciseSuccess | CheckExerciseFailure:
    expression = parse_expression(
        task.expression, local=params, max_length=MAX_TASK_LENGTH, implicit_letters=False
    )
    shown = parse_expression(
        task.expression,
        local=params,
        max_length=MAX_TASK_LENGTH,
        evaluate=False,
        implicit_letters=False,
    )
    # Pour « évaluer », l'énoncé ne calcule rien : il donnerait la réponse.
    rendered = {"expression": Rendered(**render(shown, fold=not isinstance(task, EvaluateTask)))}
    expected = (
        None
        if expected_text is None
        else parse_expression(
            normalize_student(expected_text), local=params, max_length=MAX_TASK_LENGTH
        )
    )

    if isinstance(task, ExpandTask | FactorTask):
        result = expand(expression) if isinstance(task, ExpandTask) else factor(expression)
        if any(not is_real_finite(n) for n in result.atoms() if n.is_number):
            raise _UnsupportedError
        if expected is not None and not equivalent(result, expected):
            return CheckExerciseFailure(reason="mismatch")
        form = "expanded" if isinstance(task, ExpandTask) else "factored"
        return CheckExerciseSuccess(
            answer=ExpressionAnswer(kind="expression", value=_canonical_text(result), form=form),
            rendered=rendered,
        )

    if isinstance(task, EvaluateTask):
        if expression.free_symbols:
            raise InvalidInputError("expression à évaluer non numérique")
        value = simplify(expression)
        if not is_real_finite(value):
            raise _UnsupportedError
        if expected is not None and not _close_enough(value, expected, task.round):
            return CheckExerciseFailure(reason="mismatch")
        return CheckExerciseSuccess(
            answer=NumberAnswer(kind="number", value=_canonical_text(value), decimals=task.round),
            rendered=rendered,
        )

    return CheckExerciseFailure(reason="unsupported")


def _close_enough(value: Expr, candidate: Expr, decimals: int | None) -> bool:
    """La valeur exacte, ou (avec `decimals`) une valeur arrondie à ce nombre de décimales."""
    if candidate.free_symbols or not is_real_finite(candidate):
        return False
    if equivalent(value, candidate):
        return True
    if decimals is None:
        return False
    return abs(float(value) - float(candidate)) <= 0.5 * 10 ** (-decimals) + 1e-12
