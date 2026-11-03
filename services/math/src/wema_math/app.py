"""Service de vérification mathématique de Wema (FastAPI).

Appelé par le cœur TypeScript : aucune variante d'exercice n'est servie à un
élève sans être passée par ici (AGENTS.md, règle 2). Chaque calcul SymPy
s'exécute sous délai dans un processus séparé (`sandbox`) : une entrée
pathologique donne `too_complex`, jamais un service gelé ni une erreur 500.
"""

from time import monotonic

from fastapi import FastAPI

from .answers import check_answer
from .parsing import TooComplexError
from .sandbox import TIMEOUT_SECONDS, run_limited
from .schemas import (
    CheckAnswerRequest,
    CheckAnswerResponse,
    CheckExerciseFailure,
    CheckExerciseRequest,
    CheckExerciseSuccess,
    CheckStepsRequest,
    CheckStepsResponse,
)
from .steps import compare_step, readable
from .tasks import check_exercise

app = FastAPI(title="Wema · vérification mathématique", version="0.2.0")

# Budget total d'une vérification d'étapes, toutes étapes confondues.
STEPS_BUDGET_SECONDS = 2 * TIMEOUT_SECONDS


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/exercises/check")
def exercises_check(request: CheckExerciseRequest) -> CheckExerciseSuccess | CheckExerciseFailure:
    try:
        return run_limited(check_exercise, request)
    except TooComplexError:
        return CheckExerciseFailure(reason="too_complex")
    except Exception:  # cas imprévu : une raison typée plutôt qu'une erreur 500
        return CheckExerciseFailure(reason="unsupported")


@app.post("/answers/check")
def answers_check(request: CheckAnswerRequest) -> CheckAnswerResponse:
    try:
        return run_limited(check_answer, request.expected, request.answer)
    except TooComplexError:
        return CheckAnswerResponse(correct=False, reason="too_complex")
    except Exception:  # cas imprévu : une raison typée plutôt qu'une erreur 500
        return CheckAnswerResponse(correct=False, reason="invalid_input")


@app.post("/steps/check")
def steps_check(request: CheckStepsRequest) -> CheckStepsResponse:
    """Chaque étape est comparée à la précédente étape lisible, chacune sous délai.
    Une étape trop coûteuse, ou au-delà du budget total, est invalide."""
    deadline = monotonic() + STEPS_BUDGET_SECONDS
    valid: list[bool] = []
    previous: str | None = None
    for text in request.steps:
        remaining = deadline - monotonic()
        if remaining <= 0:
            valid.append(False)
            continue
        if previous is None:
            ok = readable(text, request.variable)
            valid.append(ok)
            previous = text if ok else None
            continue
        try:
            verdict = run_limited(
                compare_step,
                previous,
                text,
                request.variable,
                timeout=min(TIMEOUT_SECONDS, remaining),
            )
        except TooComplexError:
            verdict = "bad"
        except Exception:  # cas imprévu : étape invalide plutôt qu'une erreur 500
            verdict = "bad"
        valid.append(verdict == "ok")
        if verdict != "unreadable":
            previous = text
    first_invalid = next((i for i, v in enumerate(valid) if not v), None)
    return CheckStepsResponse(valid=valid, firstInvalid=first_invalid)
