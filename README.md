# Wema

Un prof particulier IA par matière, qui connaît chaque élève en profondeur et adapte tout : les exercices, la forme, le rythme et le suivi.

_Wěmà_ signifie « livre, lettre » en fon.

## Démarrer

```sh
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm typecheck
```
Prérequis : Node 22, pnpm 10, Docker, Python 3.12+ avec uv (pour `services/math`).

## Organisation

| Dossier         | Rôle                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/`     | le cœur : domaine, référentiel, profil de l'élève, exercices, prof IA, orchestrateur, passerelle IA, base de données, interface partagée |
| `apps/`         | les façades : `web` (élève, prof, parent), `mobile` (élève), `api` (serveur)                                                             |
| `services/math` | vérification mathématique (Python)                                                                                                       |
| `content/`      | référentiel pédagogique versionné                                                                                                        |
| `evals/`        | banc d'essai du prof IA                                                                                                                  |
| `infra/`        | environnement local et déploiement                                                                                                       |
| `docs/`         | architecture, décisions, glossaire, documents de référence                                                                               |

À lire en premier : [`docs/architecture.md`](docs/architecture.md) et [`AGENTS.md`](AGENTS.md).
