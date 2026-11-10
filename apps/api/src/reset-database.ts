// Recrée une base Postgres vide pour les tests de bout en bout (e2e/).
// Usage : DATABASE_URL=postgres://…/wema_e2e pnpm --filter @wema/api db:reset
// Garde-fou : jamais en production, et seulement une base dont le nom finit
// par « _e2e » ou « _test » (la base de développement « wema » est intouchable).
import { pathToFileURL } from "node:url";
import pg from "pg";

export type ResetTarget =
  | { ok: true; database: string; maintenanceUrl: string }
  | { ok: false; reason: string };

/** Vérifie qu'on a le droit d'effacer la base visée par `url`. */
export function resetTarget(
  url: string | undefined,
  nodeEnv: string | undefined,
): ResetTarget {
  if (nodeEnv === "production")
    return { ok: false, reason: "interdit en production" };
  if (!url) return { ok: false, reason: "DATABASE_URL manquant" };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "DATABASE_URL illisible" };
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol))
    return {
      ok: false,
      reason: "DATABASE_URL doit être une adresse postgres://",
    };
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/^[a-z0-9_]+_(e2e|test)$/.test(database))
    return {
      ok: false,
      reason: `la base « ${database} » ne finit pas par _e2e ou _test`,
    };
  parsed.pathname = "/postgres";
  return { ok: true, database, maintenanceUrl: parsed.toString() };
}

async function main() {
  const target = resetTarget(process.env.DATABASE_URL, process.env.NODE_ENV);
  if (!target.ok) {
    console.error(`Remise à zéro refusée : ${target.reason}.`);
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: target.maintenanceUrl });
  await client.connect();
  // Le nom est vérifié par l'expression ci-dessus (lettres, chiffres, _).
  await client.query(`DROP DATABASE IF EXISTS ${target.database} WITH (FORCE)`);
  await client.query(`CREATE DATABASE ${target.database}`);
  await client.end();
  console.info(`Base ${target.database} recréée, vide.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
