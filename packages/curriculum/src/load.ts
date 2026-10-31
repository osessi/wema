import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Result } from "@wema/domain";
import { err } from "@wema/domain";
import { parse } from "yaml";
import {
  buildCurriculum,
  type Curriculum,
  type CurriculumError,
} from "./build";

type Read = { ok: true; data: unknown } | { ok: false; error: CurriculumError };

async function readYaml(root: string, file: string): Promise<Read> {
  try {
    return { ok: true, data: parse(await readFile(join(root, file), "utf8")) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: { kind: "parse", file, message } };
  }
}

/**
 * Charge content/curriculum : countries.yaml, subjects.yaml et une notion
 * par fichier dans <matière>/*.yaml.
 */
export async function loadCurriculum(
  rootDir: string,
): Promise<Result<Curriculum, CurriculumError[]>> {
  const notionFiles: string[] = [];
  for (const entry of await readdir(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    for (const file of await readdir(join(rootDir, entry.name))) {
      // Les fichiers cachés (._x.yaml créés par macOS, etc.) ne sont pas du contenu.
      if (!file.startsWith(".") && /\.ya?ml$/.test(file)) {
        notionFiles.push(`${entry.name}/${file}`);
      }
    }
  }
  notionFiles.sort();

  const [countries, subjects, ...notions] = await Promise.all(
    ["countries.yaml", "subjects.yaml", ...notionFiles].map((f) =>
      readYaml(rootDir, f),
    ),
  );

  const readErrors = [countries, subjects, ...notions].flatMap((r) =>
    r && !r.ok ? [r.error] : [],
  );
  if (readErrors.length > 0 || !countries?.ok || !subjects?.ok) {
    return err(readErrors);
  }
  return buildCurriculum({
    countries: countries.data,
    subjects: subjects.data,
    notions: notions.map((n) => (n.ok ? n.data : undefined)),
    files: notionFiles,
  });
}
