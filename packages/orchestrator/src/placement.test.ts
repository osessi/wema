import { asNotionId, type NotionId } from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  nextPlacementNotion,
  PLACEMENT_COOLDOWN_DAYS,
  PLACEMENT_MAX_QUESTIONS,
  PLACEMENT_MIN_QUESTIONS,
  type PlacementAnswer,
  type PlacementNotion,
  placementAvailableAt,
  placementEstimates,
  placementIntents,
  placementProgress,
  placementScope,
} from "./placement";

const id = (s: string) => asNotionId(s);
const notion = (name: string, ...prereqs: string[]): PlacementNotion => ({
  id: id(name),
  prerequisites: prereqs.map(id),
});
// Chaîne A ← B ← C ← D ← E (chaque notion a la précédente pour prérequis).
const chain = [
  notion("a"),
  notion("b", "a"),
  notion("c", "b"),
  notion("d", "c"),
  notion("e", "d"),
];
const all = (scope: readonly PlacementNotion[]) =>
  new Set(scope.map((n) => n.id));
const ans = (name: string, correct: boolean): PlacementAnswer => ({
  notionId: id(name),
  correct,
});
const levels = (
  scope: readonly PlacementNotion[],
  answers: PlacementAnswer[],
) =>
  Object.fromEntries(
    placementEstimates(scope, answers).map((e) => [e.notionId, e.level]),
  );

describe("placementScope", () => {
  it("ajoute les prérequis connus hors du programme, avant lui", () => {
    const outside = notion("x0");
    const mid = notion("x1", "x0");
    const program = [notion("p1", "x1"), notion("p2", "p1")];
    const known = new Map<string, PlacementNotion>(
      [outside, mid, ...program].map((n) => [n.id, n]),
    );
    expect(placementScope(program, known).map((n) => n.id)).toEqual([
      "x0",
      "x1",
      "p1",
      "p2",
    ]);
  });

  it("ignore un prérequis inconnu", () => {
    const program = [notion("p1", "ghost")];
    expect(placementScope(program, new Map()).map((n) => n.id)).toEqual(["p1"]);
  });
});

describe("placementEstimates", () => {
  it("sans réponse, tout est non évalué", () => {
    expect(new Set(Object.values(levels(chain, [])))).toEqual(
      new Set(["not_assessed"]),
    );
  });

  it("une réussite rend ses prérequis acquis (supposés), avec la preuve", () => {
    const estimates = placementEstimates(chain, [ans("c", true)]);
    const b = estimates.find((e) => e.notionId === "b");
    expect(b).toMatchObject({
      level: "acquired",
      source: "inferred",
      evidence: ["c"],
    });
    expect(levels(chain, [ans("c", true)])).toMatchObject({
      a: "acquired",
      c: "acquired",
      d: "not_assessed",
    });
  });

  it("une erreur rend à reprendre ce qui en dépend", () => {
    expect(levels(chain, [ans("c", false)])).toMatchObject({
      a: "not_assessed",
      c: "to_review",
      d: "to_review",
      e: "to_review",
    });
  });

  it("des preuves contraires donnent « à consolider »", () => {
    // B manquée mais D réussie : C est entre les deux, B et D se contredisent.
    expect(levels(chain, [ans("d", true), ans("b", false)])).toMatchObject({
      b: "to_consolidate",
      c: "to_consolidate",
      d: "to_consolidate",
      a: "acquired",
      e: "to_review",
    });
  });
});

describe("nextPlacementNotion", () => {
  it("commence par la notion clé, au milieu du graphe", () => {
    expect(
      nextPlacementNotion({ scope: chain, askable: all(chain), answers: [] }),
    ).toBe("c");
  });

  it("monte après une réussite, juste au-dessus", () => {
    expect(
      nextPlacementNotion({
        scope: chain,
        askable: all(chain),
        answers: [ans("c", true)],
      }),
    ).toBe("d");
  });

  it("descend vers les prérequis après une erreur, au plus proche", () => {
    expect(
      nextPlacementNotion({
        scope: chain,
        askable: all(chain),
        answers: [ans("c", false)],
      }),
    ).toBe("b");
  });

  it("ne choisit que des notions qui ont une question, ni déjà vues ni écartées", () => {
    const askable = new Set([id("a"), id("c"), id("e")]);
    expect(
      nextPlacementNotion({
        scope: chain,
        askable,
        answers: [ans("c", true)],
        skipped: new Set([id("e")]),
      }),
    ).toBe("a");
  });

  it("confirme les suppositions tant que le minimum n'est pas atteint, puis s'arrête", () => {
    const answers = [ans("c", true), ans("d", true), ans("e", true)];
    // Tout est estimé, mais A et B ne sont que supposées : on les confirme.
    expect(
      nextPlacementNotion({ scope: chain, askable: all(chain), answers }),
    ).toBe("b");
    const done = [...answers, ans("b", true), ans("a", true)];
    expect(
      nextPlacementNotion({ scope: chain, askable: all(chain), answers: done }),
    ).toBeNull();
  });

  it("s'arrête quand il n'y a plus rien d'incertain et assez de réponses", () => {
    const scope = Array.from({ length: 20 }, (_, i) =>
      notion(`n${i}`, ...(i > 0 ? [`n${i - 1}`] : [])),
    );
    const answers = Array.from({ length: PLACEMENT_MIN_QUESTIONS }, (_, i) =>
      ans(`n${i}`, true),
    );
    answers.push(ans("n19", true));
    expect(
      nextPlacementNotion({ scope, askable: all(scope), answers }),
    ).toBeNull();
  });

  it("ne dépasse jamais le maximum de questions", () => {
    const scope = Array.from({ length: 30 }, (_, i) => notion(`n${i}`));
    const answers = Array.from({ length: PLACEMENT_MAX_QUESTIONS }, (_, i) =>
      ans(`n${i}`, i % 2 === 0),
    );
    expect(
      nextPlacementNotion({ scope, askable: all(scope), answers }),
    ).toBeNull();
  });

  it("sans graphe, suit l'ordre du programme", () => {
    const scope = [notion("x"), notion("y"), notion("z")];
    expect(
      nextPlacementNotion({ scope, askable: all(scope), answers: [] }),
    ).toBe("x");
  });

  it("aucune question disponible : fini tout de suite", () => {
    expect(
      nextPlacementNotion({ scope: chain, askable: new Set(), answers: [] }),
    ).toBeNull();
  });

  it("un test entier se termine en au plus le maximum de questions", () => {
    const scope = Array.from({ length: 40 }, (_, i) =>
      notion(`n${i}`, ...(i > 1 ? [`n${i - 2}`] : [])),
    );
    const answers: PlacementAnswer[] = [];
    let next: NotionId | null = null;
    do {
      next = nextPlacementNotion({ scope, askable: all(scope), answers });
      if (next) answers.push({ notionId: next, correct: next < "n2" });
    } while (next);
    expect(answers.length).toBeGreaterThanOrEqual(PLACEMENT_MIN_QUESTIONS);
    expect(answers.length).toBeLessThanOrEqual(PLACEMENT_MAX_QUESTIONS);
  });
});

describe("placementProgress", () => {
  it("prévoit au plus le maximum, et jamais moins que les réponses", () => {
    expect(
      placementProgress({ scope: chain, askable: all(chain), answered: 0 }),
    ).toEqual({ answered: 0, total: 5 });
    const big = Array.from({ length: 30 }, (_, i) => notion(`n${i}`));
    expect(
      placementProgress({ scope: big, askable: all(big), answered: 3 }).total,
    ).toBe(PLACEMENT_MAX_QUESTIONS);
  });
});

describe("placementAvailableAt", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("jamais passé : tout de suite", () => {
    expect(placementAvailableAt(null, now)).toBeNull();
  });
  it("passé récemment : après la période", () => {
    const done = new Date("2026-11-01T12:00:00Z");
    expect(placementAvailableAt(done, now)?.toISOString()).toBe(
      new Date(
        done.getTime() + PLACEMENT_COOLDOWN_DAYS * 86_400_000,
      ).toISOString(),
    );
  });
  it("passé il y a plus longtemps : de nouveau permis", () => {
    expect(
      placementAvailableAt(new Date("2026-09-01T00:00:00Z"), now),
    ).toBeNull();
  });
});

describe("placementIntents", () => {
  it("garde la notion, les exercices généraux d'abord, puis par identifiant", () => {
    const intents = [
      { id: "3", notionId: id("a"), misconceptionId: null },
      { id: "1", notionId: id("a"), misconceptionId: "m" },
      { id: "2", notionId: id("a"), misconceptionId: null },
      { id: "0", notionId: id("b"), misconceptionId: null },
    ];
    expect(placementIntents(intents, id("a")).map((i) => i.id)).toEqual([
      "2",
      "3",
      "1",
    ]);
  });
});
