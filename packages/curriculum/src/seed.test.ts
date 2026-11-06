import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCurriculumSeed, seedId } from "./index";

const contentDir = fileURLToPath(
  new URL("../../../content/curriculum", import.meta.url),
);

describe("loadCurriculumSeed", () => {
  it("charge le jeu d'exemple du dépôt : France et Bénin, notions propres à chaque pays", async () => {
    const result = await loadCurriculumSeed(contentDir);
    if (!result.ok) throw new Error(JSON.stringify(result.error, null, 2));
    expect(result.value.map((c) => c.country.code)).toEqual(["BJ", "FR"]);
    const [bj, fr] = result.value;
    expect(bj?.country.unitLabel.singular).toBe("Situation d'apprentissage");
    expect(fr?.notions).toHaveLength(28);
    expect(bj?.notions).toHaveLength(26);
    // Au moins 10 notions par programme de 4e et de 3e, dans chaque pays.
    for (const country of [bj, fr]) {
      for (const grade of ["4e", "3e"]) {
        const gradeId = country?.grades.find((g) => g.name === grade)?.id;
        const program = country?.programs.find((p) => p.gradeId === gradeId);
        const unitIds = new Set(
          country?.units
            .filter((u) => u.programId === program?.id)
            .map((u) => u.id),
        );
        expect(
          country?.notions.filter((n) => unitIds.has(n.unitId)).length,
        ).toBeGreaterThanOrEqual(10);
      }
    }
    const frPythagore = fr?.notions.find((n) => n.code === "pythagore");
    const bjPythagore = bj?.notions.find((n) => n.code === "pythagore");
    expect(frPythagore?.prerequisites).toHaveLength(2);
    expect(frPythagore?.misconceptions).toHaveLength(3);
    expect(frPythagore?.id).not.toBe(bjPythagore?.id);
  });

  it("redonne les mêmes identifiants à chaque import", async () => {
    const a = await loadCurriculumSeed(contentDir);
    const b = await loadCurriculumSeed(contentDir);
    expect(
      a.ok && b.ok && a.value[0]?.notions[0]?.id === b.value[0]?.notions[0]?.id,
    ).toBe(true);
    expect(seedId("x")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("nomme le fichier fautif et ignore les fichiers cachés de macOS", async () => {
    const dir = await mkdtemp(join(tmpdir(), "wema-seed-"));
    await writeFile(
      join(dir, "subjects.yaml"),
      "- { code: maths, name: Maths }\n",
    );
    await mkdir(join(dir, "fr"));
    await writeFile(
      join(dir, "fr", "country.yaml"),
      "code: FR\nname: France\nunitLabel: { singular: Chapitre, plural: Chapitres }\ngrades: [4e]\n",
    );
    await writeFile(
      join(dir, "fr", "maths.yaml"),
      "grade: 9e\nsubject: maths\nunits: []\n",
    );
    await writeFile(join(dir, "fr", "._maths.yaml"), "\u0000\u0005binaire");
    const result = await loadCurriculumSeed(dir);
    if (result.ok) throw new Error("une erreur était attendue");
    expect(result.error).toEqual([
      { kind: "parse", file: "fr/maths.yaml", message: "classe inconnue : 9e" },
    ]);
  });
});
