import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Admin = ReturnType<typeof hc<AppType>>["api"]["admin"];

/** Apprentissage collectif anonymisé (back-office). */
export type CollectiveData = Ok<Admin["collective"]["$get"]>;
export type CollectiveInsight = CollectiveData["insights"][number];
/** « Ce qui marche ailleurs » pour les notions d'une classe. */
export type NotionInsights = Ok<Admin["collective"]["notions"]["$get"]>;
export type NotionInsightRow = NotionInsights["insights"][number];
/** Tableau de bord des coûts de l'IA. */
export type CostsData = Ok<Admin["costs"]["$get"]>;
/** Aperçu d'un import du référentiel. */
export type ImportPreview = Ok<
  Admin["curriculum-io"]["countries"][":id"]["import"]["preview"]["$post"]
>;
export type ExercisePreview = Ok<
  Admin["curriculum-io"]["countries"][":id"]["exercises"]["preview"]["$post"]
>;
