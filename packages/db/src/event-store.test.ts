import { PGlite } from "@electric-sql/pglite";
import {
  asEventId,
  asLearnerId,
  asNotionId,
  type LearningEvent,
  parseLearningEvent,
} from "@wema/domain";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createEventStore,
  fromPglite,
  migrate,
  type SqlExecutor,
} from "./index";

const learner = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");

function event(id: string, at: string, correct = true): LearningEvent {
  return {
    id: asEventId(id),
    learnerId: learner,
    occurredAt: new Date(at),
    source: "app",
    payload: {
      type: "answer.submitted",
      notionId: asNotionId("maths.pythagore"),
      correct,
      hintsUsed: 0,
      misconceptionId: null,
      exerciseRef: null,
      response: null,
      scaffolded: null,
      misconceptionSource: null,
      misconceptionConfidence: null,
    },
  };
}

const first = event(
  "00000000-0000-4000-8000-000000000001",
  "2026-10-01T18:00:00Z",
);
const second = event(
  "00000000-0000-4000-8000-000000000002",
  "2026-10-02T18:00:00Z",
);

let db: SqlExecutor;

beforeEach(async () => {
  db = fromPglite(new PGlite());
  await migrate(db);
});

describe("EventStore", () => {
  it("rend un événement ajouté à l'identique", async () => {
    const store = createEventStore(db);
    expect(await store.append(first)).toEqual({
      ok: true,
      value: { inserted: true },
    });
    const events = await store.listByLearner(learner);
    expect(events).toEqual([first]);
    expect(events[0]?.occurredAt).toBeInstanceOf(Date);
  });

  it("rend les événements triés par date, même insérés dans le désordre", async () => {
    const store = createEventStore(db);
    await store.append(second);
    await store.append(first);
    expect(await store.listByLearner(learner)).toEqual([first, second]);
  });

  it("ignore un doublon identique (renvoi réseau)", async () => {
    const store = createEventStore(db);
    await store.append(first);
    expect(await store.append(first)).toEqual({
      ok: true,
      value: { inserted: false },
    });
    expect(await store.listByLearner(learner)).toHaveLength(1);
  });

  it("refuse le même identifiant avec un contenu différent", async () => {
    const store = createEventStore(db);
    await store.append(first);
    const tampered = {
      ...first,
      payload: { ...first.payload, correct: false },
    };
    const result = await store.append(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("id_conflict");
  });

  it("interdit toute modification et toute suppression", async () => {
    const store = createEventStore(db);
    await store.append(first);
    await expect(
      db.exec("UPDATE learning_events SET source = 'web'"),
    ).rejects.toThrow(/ajout seul/);
    await expect(db.exec("DELETE FROM learning_events")).rejects.toThrow(
      /ajout seul/,
    );
    await expect(db.exec("TRUNCATE learning_events")).rejects.toThrow(
      /ajout seul/,
    );
  });

  it("applique chaque migration une seule fois", async () => {
    const before = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM schema_migrations",
    );
    await migrate(db);
    const after = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM schema_migrations",
    );
    expect(before.rows[0]?.n).toBeGreaterThanOrEqual(2);
    expect(after.rows[0]?.n).toBe(before.rows[0]?.n);
  });
});

describe("identifiants en majuscules (ex. UUID générés sous iOS)", () => {
  it("relit un événement à identifiant en majuscules sous sa forme normalisée", async () => {
    const store = createEventStore(db);
    const upper = parseLearningEvent({
      ...first,
      id: first.id.toUpperCase(),
      learnerId: first.learnerId.toUpperCase(),
    });
    if (!upper.ok) throw new Error(upper.error);
    await store.append(upper.value);
    expect(await store.listByLearner(upper.value.learnerId)).toEqual([
      upper.value,
    ]);
  });
});
