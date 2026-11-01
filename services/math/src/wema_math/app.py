"""Service de vérification mathématique de Wema (FastAPI).

Appelé par le cœur TypeScript : aucune variante d'exercice n'est servie à un
élève sans être passée par ici (AGENTS.md, règle 2).
"""

from fastapi import FastAPI

from .answers import check_answer
from .schemas import (
    CheckAnswerRequest,
    CheckAnswerResponse,
    CheckExerciseFailure,
    CheckExerciseRequest,
    CheckExerciseSuccess,
    CheckStepsRequest,
    CheckStepsResponse,
)
from .steps import check_steps
from .tasks import check_exercise

app = FastAPI(title="Wema · vérification mathématique", version="0.1.0")


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/exercises/check")
def exercises_check(request: CheckExerciseRequest) -> CheckExerciseSuccess | CheckExerciseFailure:
    return check_exercise(request)


@app.post("/answers/check")
def answers_check(request: CheckAnswerRequest) -> CheckAnswerResponse:
    return check_answer(request.expected, request.answer)


@app.post("/steps/check")
def steps_check(request: CheckStepsRequest) -> CheckStepsResponse:
    return check_steps(request)
