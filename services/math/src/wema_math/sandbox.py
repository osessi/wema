"""Exécution bornée des calculs SymPy.

Certains calculs (développer une grande puissance, simplifier, résoudre)
peuvent prendre un temps démesuré, et une réponse d'élève ne doit jamais
pouvoir geler le service. Chaque calcul s'exécute donc dans un processus
séparé, tué au-delà d'un délai ; le nombre de calculs simultanés est borné.

Les processus naissent d'un serveur `forkserver` qui a déjà chargé SymPy :
un calcul démarre en quelques millisecondes, dans un processus sain.
"""

import multiprocessing
import os
import threading
from collections.abc import Callable
from multiprocessing.connection import Connection
from typing import Any

from .parsing import TooComplexError

TIMEOUT_SECONDS = float(os.environ.get("WEMA_MATH_TIMEOUT", "3"))
MAX_WORKERS = int(os.environ.get("WEMA_MATH_WORKERS", "4"))
# Mémoire maximale d'un calcul (octets), quand le système le permet.
MEMORY_LIMIT = int(os.environ.get("WEMA_MATH_MEMORY", str(1024 * 1024 * 1024)))

_CONTEXT = multiprocessing.get_context("forkserver")
_CONTEXT.set_forkserver_preload(["wema_math.tasks", "wema_math.answers", "wema_math.steps"])
_SLOTS = threading.BoundedSemaphore(MAX_WORKERS)


def _limit_memory() -> None:
    try:
        import resource  # noqa: PLC0415 (Unix seulement)

        resource.setrlimit(resource.RLIMIT_AS, (MEMORY_LIMIT, MEMORY_LIMIT))
    except (ImportError, ValueError, OSError):
        pass  # limite non prise en charge (macOS) : le délai reste la protection


def _worker(connection: Connection, fn: Callable[..., Any], args: tuple[Any, ...]) -> None:
    _limit_memory()
    try:
        outcome: tuple[str, Any] = ("ok", fn(*args))
    except MemoryError:
        outcome = ("error", TooComplexError("mémoire dépassée"))
    except Exception as error:  # renvoyé au parent, qui décide
        outcome = ("error", error)
    try:
        connection.send(outcome)
    except Exception:  # résultat impossible à transmettre
        connection.send(("error", RuntimeError("résultat illisible")))
    finally:
        connection.close()


def run_limited[T](fn: Callable[..., T], *args: Any, timeout: float | None = None) -> T:
    """Exécute `fn(*args)` dans un processus séparé.

    Lève `TooComplexError` si le calcul dépasse le délai (le processus est
    tué) ou meurt ; relance l'exception levée par `fn` sinon.
    """
    limit = TIMEOUT_SECONDS if timeout is None else timeout
    with _SLOTS:
        receiver, sender = _CONTEXT.Pipe(duplex=False)
        process = _CONTEXT.Process(target=_worker, args=(sender, fn, args), daemon=True)
        process.start()
        sender.close()
        try:
            if not receiver.poll(limit):
                raise TooComplexError("délai dépassé")
            try:
                status, value = receiver.recv()
            except EOFError as error:  # processus mort (mémoire, signal)
                raise TooComplexError("calcul interrompu") from error
        finally:
            receiver.close()
            if process.is_alive():
                process.kill()
            process.join(timeout=1)
    if status == "error":
        raise value
    return value
