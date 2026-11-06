import type {
  CountryId,
  Grade,
  Misconception,
  Notion,
  NotionId,
  Program,
  Unit,
} from "@wema/domain";
import type { SqlExecutor } from "./executor";

/** Écritures d'un import (même forme que `CurriculumChanges` de @wema/curriculum). */
export interface CurriculumImportChanges {
  grades: readonly Grade[];
  programs: readonly Program[];
  units: readonly Unit[];
  notions: readonly Omit<Notion, "prerequisites" | "misconceptions">[];
  notionUpdates: readonly {
    id: NotionId;
    unitId: Notion["unitId"];
    name: string;
    description: string;
    position: number;
    verified: boolean;
  }[];
  prerequisites: readonly {
    notionId: NotionId;
    prerequisites: readonly NotionId[];
  }[];
  misconceptions: readonly Misconception[];
}

/**
 * Applique un import validé, en une seule transaction : tout ou rien. Rien
 * n'est supprimé, sauf les liens de prérequis remplacés d'une notion.
 */
export async function applyCurriculumImport(
  db: SqlExecutor,
  countryId: CountryId,
  changes: CurriculumImportChanges,
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const g of changes.grades) {
      await tx.query(
        "INSERT INTO grades (id, country_id, name, position) VALUES ($1, $2, $3, $4)",
        [g.id, countryId, g.name, g.position],
      );
    }
    for (const p of changes.programs) {
      await tx.query(
        "INSERT INTO programs (id, country_id, grade_id, subject_id) VALUES ($1, $2, $3, $4)",
        [p.id, countryId, p.gradeId, p.subjectId],
      );
    }
    for (const u of changes.units) {
      await tx.query(
        `INSERT INTO units (id, country_id, program_id, name, description, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [u.id, countryId, u.programId, u.name, u.description, u.position],
      );
    }
    for (const n of changes.notions) {
      await tx.query(
        `INSERT INTO notions (id, country_id, unit_id, code, name, description, position, verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
        [n.id, countryId, n.unitId, n.code, n.name, n.description, n.position],
      );
    }
    for (const n of changes.notionUpdates) {
      await tx.query(
        `UPDATE notions SET unit_id = $2, name = $3, description = $4, position = $5, verified = $6
         WHERE id = $1 AND country_id = $7`,
        [
          n.id,
          n.unitId,
          n.name,
          n.description,
          n.position,
          n.verified,
          countryId,
        ],
      );
    }
    for (const m of changes.misconceptions) {
      await tx.query(
        "INSERT INTO misconceptions (id, notion_id, description) VALUES ($1, $2, $3)",
        [m.id, m.notionId, m.description],
      );
    }
    for (const p of changes.prerequisites) {
      // Lien de graphe (pas un historique) : la liste de la notion est remplacée.
      await tx.query("DELETE FROM notion_prerequisites WHERE notion_id = $1", [
        p.notionId,
      ]);
      for (const prerequisite of p.prerequisites) {
        await tx.query(
          `INSERT INTO notion_prerequisites (notion_id, prerequisite_id, country_id)
           VALUES ($1, $2, $3)`,
          [p.notionId, prerequisite, countryId],
        );
      }
    }
  });
}
