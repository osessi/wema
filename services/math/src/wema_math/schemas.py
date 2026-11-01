"""Formats d'échange avec le cœur TypeScript (voir docs/plan/lot-03-exercices.md)."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

_TASK_TEXT = Annotated[str, Field(min_length=1, max_length=500)]
_NAME = Annotated[str, Field(pattern=r"^[a-z]+$|^[A-Za-z]$", max_length=12)]


class SolveTask(BaseModel):
    kind: Literal["solve"]
    equation: _TASK_TEXT
    variable: Annotated[str, Field(pattern=r"^[A-Za-z]$")]


class ExpandTask(BaseModel):
    kind: Literal["expand"]
    expression: _TASK_TEXT


class FactorTask(BaseModel):
    kind: Literal["factor"]
    expression: _TASK_TEXT


class EvaluateTask(BaseModel):
    kind: Literal["evaluate"]
    expression: _TASK_TEXT
    round: Annotated[int, Field(ge=0, le=6)] | None = None


Task = Annotated[SolveTask | ExpandTask | FactorTask | EvaluateTask, Field(discriminator="kind")]


class SolutionsAnswer(BaseModel):
    kind: Literal["solutions"]
    variable: Annotated[str, Field(pattern=r"^[A-Za-z]$")]
    values: Annotated[list[_TASK_TEXT], Field(max_length=20)]


class ExpressionAnswer(BaseModel):
    kind: Literal["expression"]
    value: _TASK_TEXT
    form: Literal["expanded", "factored", "any"] = "any"


class NumberAnswer(BaseModel):
    kind: Literal["number"]
    value: _TASK_TEXT
    decimals: Annotated[int, Field(ge=0, le=6)] | None = None


CanonicalAnswer = Annotated[
    SolutionsAnswer | ExpressionAnswer | NumberAnswer, Field(discriminator="kind")
]

ParameterValue = Annotated[int, Field(ge=-1_000_000_000, le=1_000_000_000)]


class CheckExerciseRequest(BaseModel):
    task: Task
    parameters: Annotated[dict[_NAME, ParameterValue], Field(max_length=20)] = {}
    constraints: Annotated[list[_TASK_TEXT], Field(max_length=20)] = []
    expected: _TASK_TEXT | None = None


class Rendered(BaseModel):
    text: str
    latex: str


class CheckExerciseSuccess(BaseModel):
    ok: Literal[True] = True
    answer: CanonicalAnswer
    rendered: dict[str, Rendered]


ExerciseFailure = Literal[
    "constraint_failed", "no_solution", "mismatch", "invalid_input", "unsupported"
]


class CheckExerciseFailure(BaseModel):
    ok: Literal[False] = False
    reason: ExerciseFailure


class CheckAnswerRequest(BaseModel):
    expected: CanonicalAnswer
    # La limite de 200 caractères est appliquée par l'analyse, qui répond
    # `invalid_input` ; ici, seulement un garde-fou contre les corps énormes.
    answer: Annotated[str, Field(max_length=2000)]


class CheckAnswerResponse(BaseModel):
    correct: bool
    reason: Literal["not_equivalent", "wrong_form", "invalid_input"] | None = None


class CheckStepsRequest(BaseModel):
    steps: Annotated[
        list[Annotated[str, Field(max_length=2000)]], Field(min_length=1, max_length=30)
    ]
    variable: Annotated[str, Field(pattern=r"^[A-Za-z]$")] | None = None


class CheckStepsResponse(BaseModel):
    valid: list[bool]
    firstInvalid: int | None  # noqa: N815 (nom du contrat JSON)
