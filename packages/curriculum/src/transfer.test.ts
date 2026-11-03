import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type CurriculumRows,
  exportCurriculumYaml,
  exportNotionsCsv,
  loadCurriculumSeed,
  parseCsv,
  parseCurriculumImport,
  planCurriculumImport,
} from "./index";

const contentDir = fileURLToPath(
  new URL("../../../content/curriculum", import.meta.url),
);

async function france(): Promise<CurriculumRows> {
  const seed = await loadCurriculumSeed(contentDir);
  if (!seed.ok) throw new Error(JSON.stringify(seed.error));
  const fr = seed.value.find((c) => c.country.code === "FR");
  if (!fr) throw new Error("FR absent");
  return fr;
}

let counter = 0;
const newId = () =>
  `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

function must<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

describe("export puis import du référentiel", () => {
  it("un export YAML réimporté ne change rien", async () => {
    const fr = await france();
    const yaml = exportCurriculumYaml(fr);
    expect(yaml).toContain("code: FR");
    const parsed = must(parseCurriculumImport("yaml", yaml));
    expect(parsed.country?.code).toBe("FR");
    const plan = must(planCurriculumImport(fr, parsed, newId));
    expect(plan.empty).toBe(true);
    expect(plan.summary.untouched).toBe(0);
  });

  it("un export CSV réimporté ne change rien", async () => {
    const fr = await france();
    const csv = exportNotionsCsv(fr);
    expect(csv.split("\n")[0]).toBe(
      "classe,matiere,unite,code,nom,description,prerequis,idees_fausses",
    );
    const plan = must(
      planCurriculumImport(fr, must(parseCurriculumImport("csv", csv)), newId),
    );
    expect(plan.empty).toBe(true);
  });

  it("CSV : guillemets, point-virgule et retours à la ligne", () => {
    expect(parseCsv('a;b\n"x; y";"dit ""oui"""\r\n')).toEqual([
      ["a", "b"],
      ["x; y", 'dit "oui"'],
    ]);
  });
});

describe("plan d'import", () => {
  it("crée ce qui manque, modifie une notion par son code, n'archive rien", async () => {
    const fr = await france();
    const csv = [
      "classe;matiere;unite;code;nom;description;prerequis;idees_fausses",
      "Seconde;maths;Vecteurs;vecteurs;Vecteurs;Translation et vecteurs.;pythagore;Confond vecteur et segment",
      "4e;maths;Carrés, racines et Pythagore;pythagore;Théorème de Pythagore (révisé);Nouvelle description.;carres-racines | calcul-litteral;Prend un côté de l'angle droit pour l'hypoténuse. | Oublie le carré",
    ].join("\n");
    const plan = must(
      planCurriculumImport(fr, must(parseCurriculumImport("csv", csv)), newId),
    );
    expect(plan.summary.grades).toEqual(["Seconde"]);
    expect(plan.summary.programs).toEqual(["Seconde · Mathématiques"]);
    expect(plan.summary.newNotions).toEqual(["vecteurs"]);
    expect(plan.summary.updatedNotions).toEqual([
      { code: "pythagore", fields: ["name", "description"] },
    ]);
    // L'idée fausse déjà connue n'est pas recréée.
    expect(plan.summary.misconceptions).toEqual([
      { code: "vecteurs", description: "Confond vecteur et segment" },
      { code: "pythagore", description: "Oublie le carré" },
    ]);
    expect(plan.changes.notionUpdates[0]?.verified).toBe(false);
    expect(plan.summary.untouched).toBe(fr.notions.length - 1);
  });

  it("refuse un cycle de prérequis, un prérequis inconnu, une matière inconnue, un autre pays", async () => {
    const fr = await france();
    const program = (prereq: string, subject = "maths") =>
      [
        "grade: 5e",
        `subject: ${subject}`,
        "units:",
        "  - name: Calcul littéral",
        "    notions:",
        "      - code: calcul-litteral",
        "        name: Calcul littéral",
        "        description: Réduire et développer.",
        `        prerequisites: [${prereq}]`,
      ].join("\n");
    const cycle = planCurriculumImport(
      fr,
      must(parseCurriculumImport("yaml", program("pythagore"))),
      newId,
    );
    expect(!cycle.ok && cycle.error.map((e) => e.kind)).toEqual([
      "prerequisite_cycle",
    ]);
    const unknown = planCurriculumImport(
      fr,
      must(parseCurriculumImport("yaml", program("inexistante"))),
      newId,
    );
    expect(!unknown.ok && unknown.error[0]?.kind).toBe("unknown_prerequisite");
    const subject = planCurriculumImport(
      fr,
      must(parseCurriculumImport("yaml", program("", "astronomie"))),
      newId,
    );
    expect(!subject.ok && subject.error[0]).toEqual({
      kind: "unknown_subject",
      subject: "astronomie",
    });
    const other = planCurriculumImport(
      fr,
      must(
        parseCurriculumImport(
          "yaml",
          "code: BJ\nname: Bénin\nunitLabel: { singular: SA, plural: SA }\ngrades: [3e]\n",
        ),
      ),
      newId,
    );
    expect(!other.ok && other.error[0]?.kind).toBe("country_mismatch");
  });

  it("refuse un fichier vide ou illisible", () => {
    expect(parseCurriculumImport("yaml", "  ").ok).toBe(false);
    expect(parseCurriculumImport("yaml", "grade: [").ok).toBe(false);
    const csv = parseCurriculumImport("csv", "classe,code\n4e,x\n");
    expect(!csv.ok && csv.error[0]?.kind).toBe("csv");
  });
});
