import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { asCountryCode, asNotionId } from "@wema/domain";
import { describe, expect, it } from "vitest";
import { loadCurriculum } from "./index";

const contentDir = fileURLToPath(
  new URL("../../../content/curriculum", import.meta.url),
);

describe("loadCurriculum", () => {
  it("charge le référentiel réel du dépôt", async () => {
    const result = await loadCurriculum(contentDir);
    if (!result.ok) throw new Error(JSON.stringify(result.error, null, 2));
    const curriculum = result.value;
    expect(curriculum.notions).toHaveLength(4);
    const pythagore = curriculum.getNotion(asNotionId("maths.pythagore"));
    expect(pythagore?.prerequisites).toHaveLength(2);
    expect(pythagore?.misconceptions).toHaveLength(3);
    for (const n of curriculum.notions) {
      expect(n.mappings[asCountryCode("fr")]).toBeDefined();
      expect(n.mappings[asCountryCode("bj")]).toBeDefined();
    }
  });

  it("signale un fichier YAML illisible en nommant le fichier", async () => {
    const dir = await mkdtemp(join(tmpdir(), "wema-curriculum-"));
    await writeFile(
      join(dir, "countries.yaml"),
      "- { code: fr, name: France }\n",
    );
    await writeFile(
      join(dir, "subjects.yaml"),
      "- { id: maths, name: Maths }\n",
    );
    await mkdir(join(dir, "maths"));
    await writeFile(join(dir, "maths", "x.yaml"), "id: [\n");
    const result = await loadCurriculum(dir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({ kind: "parse", file: "maths/x.yaml" }),
      );
    }
  });

  it("charge les fichiers .yml et ignore les fichiers cachés (._x.yaml de macOS)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "wema-curriculum-"));
    await writeFile(
      join(dir, "countries.yaml"),
      "- { code: fr, name: France }\n",
    );
    await writeFile(
      join(dir, "subjects.yaml"),
      "- { id: maths, name: Maths }\n",
    );
    await mkdir(join(dir, "maths"));
    await writeFile(
      join(dir, "maths", "a.yml"),
      "id: maths.a\nsubject: maths\nname: A\ndescription: Notion A\nmappings: { fr: { grade: 4e, chapter: null, verified: false } }\n",
    );
    await writeFile(join(dir, "maths", "._a.yml"), "\u0000\u0005binaire");
    await writeFile(join(dir, ".DS_Store"), "\u0000");
    const result = await loadCurriculum(dir);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.notions.map((n) => n.id)).toEqual(["maths.a"]);
  });
});
