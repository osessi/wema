// Importe le jeu d'exemple de content/curriculum dans la base (idempotent).
import { fileURLToPath } from "node:url";
import { loadCurriculumSeed } from "@wema/curriculum";
import { createCurriculumStore, migrate } from "@wema/db";
import { loadConfig } from "./config";
import { openDatabase } from "./database";

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
process.exit(0);
