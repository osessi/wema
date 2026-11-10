import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createCurriculumStore,
  fromPglite,
  migrate,
  type SqlExecutor,
} from "./index";

let db: SqlExecutor;
beforeEach(async () => {
  db = fromPglite(new PGlite());
  await migrate(db);
});

describe("migration 0035 : icône des matières", () => {
  it("renseigne l'icône des matières existantes selon leur code, sans toucher aux autres", async () => {
    // Retour à l'état d'avant la migration, avec des matières déjà en base.
    await db.exec(`ALTER TABLE subjects DROP COLUMN icon;
      DELETE FROM schema_migrations WHERE name = '0035_subject_icon.sql';
      INSERT INTO subjects (id, code, name) VALUES
        ('00000000-0000-4000-8000-000000000001', 'maths', 'Mathématiques'),
        ('00000000-0000-4000-8000-000000000002', 'francais', 'Français'),
        ('00000000-0000-4000-8000-000000000003', 'svt', 'SVT'),
        ('00000000-0000-4000-8000-000000000004', 'astronomie', 'Astronomie');`);

    await migrate(db);

    const { rows } = await db.query<{ code: string; icon: string | null }>(
      "SELECT code, icon FROM subjects ORDER BY code",
    );
    expect(rows).toEqual([
      { code: "astronomie", icon: null },
      { code: "francais", icon: "french" },
      { code: "maths", icon: "math" },
      { code: "svt", icon: "biology" },
    ]);
  });

  it("le référentiel lit, écrit et retire l'icône ; une valeur inconnue en base vaut aucune", async () => {
    const store = createCurriculumStore(db);
    const created = await store.createSubject({
      code: "histoire",
      name: "Histoire",
      icon: "history",
    });
    if (!created.ok) throw new Error("création refusée");
    expect(created.value.icon).toBe("history");

    // Sans icône dans la modification, elle ne change pas.
    const renamed = await store.updateSubject(created.value.id, {
      name: "Histoire-géo",
    });
    expect(renamed.ok && renamed.value.icon).toBe("history");

    const cleared = await store.updateSubject(created.value.id, {
      name: "Histoire-géo",
      icon: null,
    });
    expect(cleared.ok && cleared.value.icon).toBeNull();

    await db.query("UPDATE subjects SET icon = 'licorne' WHERE id = $1", [
      created.value.id,
    ]);
    const [listed] = await store.listSubjects();
    expect(listed?.icon).toBeNull();
  });
});
