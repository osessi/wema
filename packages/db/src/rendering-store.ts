import type { ExerciseVariantId } from "@wema/domain";
import type { SqlExecutor } from "./executor";

/** Format reformulé par l'IA et mis en cache par variante (migration 0020). */
export type CachedFormat = "comics" | "easy_reading";

export interface VariantRendering {
  format: CachedFormat;
  status: "ok" | "rejected";
  /** Contenu brut : relu et validé par le schéma du cœur à chaque lecture. */
  content: unknown;
  model: string | null;
  createdAt: Date;
}

interface Row {
  format: CachedFormat;
  status: "ok" | "rejected";
  content: unknown;
  model: string | null;
  created_at: Date;
}

const toRendering = (r: Row): VariantRendering => ({
  format: r.format,
  status: r.status,
  content: r.content,
  model: r.model,
  createdAt: r.created_at,
});

export function createRenderingStore(db: SqlExecutor) {
  return {
    async list(variantId: ExerciseVariantId): Promise<VariantRendering[]> {
      const { rows } = await db.query<Row>(
        "SELECT format, status, content, model, created_at FROM variant_renderings WHERE variant_id = $1",
        [variantId],
      );
      return rows.map(toRendering);
    },

    /** Garde la première reformulation enregistrée (deux demandes simultanées : la seconde est ignorée). */
    async save(input: {
      variantId: ExerciseVariantId;
      format: CachedFormat;
      status: "ok" | "rejected";
      content: unknown;
      model: string | null;
    }): Promise<void> {
      await db.query(
        `INSERT INTO variant_renderings (variant_id, format, status, content, model)
         VALUES ($1, $2, $3, $4::jsonb, $5) ON CONFLICT (variant_id, format) DO NOTHING`,
        [
          input.variantId,
          input.format,
          input.status,
          input.status === "ok" ? JSON.stringify(input.content) : null,
          input.model,
        ],
      );
    },
  };
}

export type RenderingStore = ReturnType<typeof createRenderingStore>;
