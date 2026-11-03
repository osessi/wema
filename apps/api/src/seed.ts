// Importe le jeu d'exemple de content/curriculum dans la base (idempotent).
import { fileURLToPath } from "node:url";
import { loadCurriculumSeed } from "@wema/curriculum";
import { createCurriculumStore, migrate } from "@wema/db";
import { createHttpMathVerifier, loadExerciseSeed } from "@wema/exercises";
import { loadConfig } from "./config";
import { openDatabase } from "./database";
import { importExampleExercises } from "./seed-exercises";

const config = loadConfig(process.env);
if (!config.ok) {
  console.error(config.error.message);
  process.exit(1);
}
const db = await openDatabase(config.value);
await migrate(db);
const seed = await loadCurriculumSeed(
  fileURLToPath(new URL("../../../content/curriculum", import.meta.url)),
);
if (!seed.ok) {
  console.error(JSON.stringify(seed.error, null, 2));
  process.exit(1);
}
const store = createCurriculumStore(db);
for (const country of seed.value) {
  await store.importCountry(country);
  console.info(`${country.country.name} : ${country.notions.length} notions`);
}

const exercises = await loadExerciseSeed(
  fileURLToPath(new URL("../../../content/exercises", import.meta.url)),
);
if (!exercises.ok) {
  console.error(JSON.stringify(exercises.error, null, 2));
  process.exit(1);
}
const report = await importExampleExercises(
  db,
  exercises.value,
  createHttpMathVerifier(config.value.WEMA_MATH_URL),
);
console.info(
  `Exercices : ${report.created} créés, ${report.skipped} déjà présents, ${report.validated} validés par services/math.`,
);
for (const p of report.problems)
  console.warn(`  ${p.country} · ${p.notionCode} : ${p.error}`);
if (report.problems.some((p) => p.error === "unavailable")) {
  console.warn(
    "services/math ne répond pas : relancez le seed une fois démarré pour valider les exercices.",
  );
}
process.exit(0);
