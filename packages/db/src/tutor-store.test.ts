import { PGlite } from "@electric-sql/pglite";
import { asLearnerId } from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  createAccountStore,
  createCurriculumStore,
  createTutorStore,
  fromPglite,
  migrate,
} from "./index";

function must<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

describe("séances avec le prof IA", () => {
  it("garde les messages dans l'ordre, ne monte que le niveau d'indice, et termine une fois", async () => {
    const db = fromPglite(new PGlite());
    await migrate(db);
    const cur = createCurriculumStore(db);
    const country = must(
      await cur.createCountry({
        code: "FR",
        name: "France",
        unitLabel: { singular: "C", plural: "C" },
      }),
    );
    const subject = must(
      await cur.createSubject({ code: "maths", name: "Maths" }),
    );
    const grade = must(
      await cur.createGrade({ countryId: country.id, name: "4e", position: 0 }),
    );
    const program = must(
      await cur.createProgram({ gradeId: grade.id, subjectId: subject.id }),
    );
    const unit = must(
      await cur.createUnit({
        programId: program.id,
        name: "U",
        description: "",
        position: 0,
      }),
    );
    const notion = must(
      await cur.createNotion({
        unitId: unit.id,
        code: "n",
        name: "N",
        description: "N",
        position: 0,
      }),
    );
    const user = await createAccountStore(db).createUser({
      displayName: "Élève",
      createdBy: null,
    });

    const store = createTutorStore(db);
    const session = await store.createSession({
      learnerId: asLearnerId(user.id),
      notionId: notion,
      variantId: null,
      mode: "teach_back",
    });
    await store.addMessage({
      sessionId: session.id,
      role: "learner",
      content: "Bonjour",
      guarded: false,
    });
    await store.addMessage({
      sessionId: session.id,
      role: "tutor",
      content: "C'est quoi une équation ?",
      guarded: false,
    });
    expect((await store.listMessages(session.id)).map((m) => m.role)).toEqual([
      "learner",
      "tutor",
    ]);

    await store.raiseHintLevel(session.id, 2);
    await store.raiseHintLevel(session.id, 1);
    expect((await store.getSession(session.id))?.hintLevel).toBe(2);
    expect(await store.finishSession(session.id)).toBe(true);
    expect(await store.finishSession(session.id)).toBe(false);
    await expect(db.exec("DELETE FROM tutor_messages")).rejects.toThrow(
      /ajout seul/,
    );

    expect(
      await store.setTutorInstructions(subject.id, "Utilise des schémas."),
    ).toBe(true);
    expect(await store.getTutorInstructions(subject.id)).toBe(
      "Utilise des schémas.",
    );
  });
});
