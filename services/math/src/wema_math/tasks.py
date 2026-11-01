"""Vérification d'un exercice paramétré : contraintes, calcul de la réponse, rendu."""

from sympy import Basic, Expr, Integer, Symbol, expand, factor, simplify
from sympy.logic.boolalg import BooleanFalse, BooleanTrue

from .compare import equivalent, finite_values, same_values, solution_set
from .parsing import (
    FUNCTIONS,
    MAX_TASK_LENGTH,
    InvalidInputError,
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


def _parameters(request: CheckExerciseRequest) -> dict[str, Basic]:
    names: dict[str, Basic] = {}
    for name, value in request.parameters.items():
        if name in FUNCTIONS:
            raise InvalidInputError(f"nom de paramètre réservé : {name}")
        names[name] = Integer(value)
    return names


def _constraints_hold(request: CheckExerciseRequest, params: dict[str, Basic]) -> bool:
    for source in request.constraints:
        result = parse_math(source, local=params, max_length=MAX_TASK_LENGTH)
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


def check_exercise(request: CheckExerciseRequest) -> CheckExerciseSuccess | CheckExerciseFailure:
    """Résout la tâche avec les paramètres donnés et confirme la réponse attendue."""
    try:
        params = _parameters(request)
        if not _constraints_hold(request, params):
            return CheckExerciseFailure(reason="constraint_failed")
        return _solve(request, params)
    except InvalidInputError:
        return CheckExerciseFailure(reason="invalid_input")


def _solve(
    request: CheckExerciseRequest, params: dict[str, Basic]
) -> CheckExerciseSuccess | CheckExerciseFailure:
    task = request.task
    if isinstance(task, SolveTask):
        if task.variable in params:
            raise InvalidInputError("la variable est aussi un paramètre")
        variable = Symbol(task.variable)
        left, right = parse_equation(task.equation, local=params, max_length=MAX_TASK_LENGTH)
        values = finite_values(solution_set(left, right, variable))
        if values is None:
            return CheckExerciseFailure(reason="unsupported")
        if not values:
            return CheckExerciseFailure(reason="no_solution")
        if any(v.free_symbols for v in values):
            raise InvalidInputError("solution qui dépend d'un nom inconnu")
        if request.expected is not None and not same_values(
            values, _expected_values(request.expected, params, variable)
        ):
            return CheckExerciseFailure(reason="mismatch")
        shown = parse_equation(
            task.equation, local=params, max_length=MAX_TASK_LENGTH, evaluate=False
        )
        return CheckExerciseSuccess(
            answer=SolutionsAnswer(
                kind="solutions",
                variable=task.variable,
                values=[str(v) for v in sorted(values, key=float)],
            ),
            rendered={"equation": Rendered(**render(*shown))},
        )

    expression = parse_expression(task.expression, local=params, max_length=MAX_TASK_LENGTH)
    shown = parse_expression(
        task.expression, local=params, max_length=MAX_TASK_LENGTH, evaluate=False
    )
    rendered = {"expression": Rendered(**render(shown))}
    expected = (
        None
        if request.expected is None
        else parse_expression(
            normalize_student(request.expected), local=params, max_length=MAX_TASK_LENGTH
        )
    )

    if isinstance(task, ExpandTask | FactorTask):
        result = expand(expression) if isinstance(task, ExpandTask) else factor(expression)
        if expected is not None and not equivalent(result, expected):
            return CheckExerciseFailure(reason="mismatch")
        form = "expanded" if isinstance(task, ExpandTask) else "factored"
        return CheckExerciseSuccess(
            answer=ExpressionAnswer(kind="expression", value=str(result), form=form),
            rendered=rendered,
        )

    if isinstance(task, EvaluateTask):
        if expression.free_symbols:
            raise InvalidInputError("expression à évaluer non numérique")
        value = simplify(expression)
        if expected is not None and not _close_enough(value, expected, task.round):
            return CheckExerciseFailure(reason="mismatch")
        return CheckExerciseSuccess(
            answer=NumberAnswer(kind="number", value=str(value), decimals=task.round),
            rendered=rendered,
        )

    return CheckExerciseFailure(reason="unsupported")


def _close_enough(value: Expr, candidate: Expr, decimals: int | None) -> bool:
    """La valeur exacte, ou (avec `decimals`) une valeur arrondie à ce nombre de décimales."""
    if candidate.free_symbols:
        return False
    if equivalent(value, candidate):
        return True
    if decimals is None:
        return False
    return abs(float(value) - float(candidate)) <= 0.5 * 10 ** (-decimals) + 1e-12
