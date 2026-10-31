// Vérifie que chaque paquet du cœur ne dépend que des briques autorisées
// (docs/architecture.md §5). Les apps ne sont pas contrôlées.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ALLOWED: Record<string, readonly string[]> = {
  domain: [],
  ui: [],
  curriculum: ["domain"],
  "learner-model": ["domain", "curriculum"],
  "ai-gateway": ["domain"],
  db: ["domain"],
  exercises: ["domain", "curriculum", "learner-model", "ai-gateway"],
  tutor: ["domain", "curriculum", "learner-model", "exercises", "ai-gateway"],
  orchestrator: ["domain", "curriculum", "learner-model", "exercises", "tutor"],
};

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const packagesDir = join(import.meta.dirname, "..", "packages");
const violations: string[] = [];

// Seuls les dossiers sont des paquets (le Finder crée des .DS_Store, etc.).
const packageNames = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
  .map((entry) => entry.name);

for (const name of packageNames) {
  const manifest: Manifest = JSON.parse(
    readFileSync(join(packagesDir, name, "package.json"), "utf8"),
  );
  const allowed = ALLOWED[name];
  const internal = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })
    .filter((dep) => dep.startsWith("@wema/"))
    .map((dep) => dep.slice("@wema/".length));

  if (allowed === undefined) {
    violations.push(
      `✗ @wema/${name} n'est pas déclaré dans la table des dépendances autorisées`,
    );
    continue;
  }
  for (const dep of internal) {
    if (!allowed.includes(dep)) {
      violations.push(`✗ @wema/${name} ne peut pas dépendre de @wema/${dep}`);
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) console.error(v);
  process.exit(1);
}
console.log("✓ dépendances conformes");
