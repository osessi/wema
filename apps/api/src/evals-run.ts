// Banc d'essai du prof IA (evals/) : rejoue les conversations types avec le
// vrai modèle (clé OPENROUTER_API_KEY du fichier .env) et applique les
// critères automatiques. Un critère bloquant en échec fait échouer la commande.
//   pnpm --filter @wema/api evals [modèle]
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAiGateway,
  createOpenRouterProvider,
  DEFAULT_ROUTING,
} from "@wema/ai-gateway";
import { asMisconceptionId, canonicalAnswerSchema } from "@wema/domain";
import {
  type CriterionResult,
  createTutor,
  evaluateReply,
  type TurnMessage,
  type TutorContext,
} from "@wema/tutor";
import { z } from "zod";
import { loadConfig } from "./config";

const evalsDir = fileURLToPath(new URL("../../../evals", import.meta.url));

const scenarioSchema = z.object({
  id: z.string(),
  description: z.string(),
  action: z.enum(["reply", "hint"]),
  turns: z.array(z.string()).min(1),
  context: z.object({
    mode: z.enum([
      "exercise_help",
      "course_question",
      "teach_back",
      "oral_check",
    ]),
    subjectName: z.string(),
    subjectInstructions: z.string(),
    notion: z.object({ name: z.string(), description: z.string() }),
    misconceptions: z.array(
      z.object({ id: z.string(), description: z.string() }),
    ),
    learner: z.object({
      status: z.enum(["not_seen", "needs_work", "in_progress", "mastered"]),
      activeMisconceptions: z.array(z.string()),
    }),
    exercise: z
      .object({
        statement: z.string(),
        steps: z.array(z.string()),
        answer: canonicalAnswerSchema,
      })
      .nullable(),
    hintLevel: z.number().int(),
  }),
});

const config = loadConfig(process.env);
if (!config.ok || !config.value.OPENROUTER_API_KEY) {
  console.error(
    "OPENROUTER_API_KEY absente du fichier .env : le banc d'essai a besoin d'un vrai modèle.",
  );
  process.exit(1);
}
const model = process.argv[2];
const ai = createAiGateway({
  providers: {
    openrouter: createOpenRouterProvider({
      apiKey: config.value.OPENROUTER_API_KEY,
      appName: "Wema (banc d'essai)",
    }),
  },
  routing: async () =>
    model
      ? { ...DEFAULT_ROUTING, tiers: { reasoning: [model], economic: [model] } }
      : DEFAULT_ROUTING,
  log: async () => {},
});
const tutor = createTutor(ai);
const context = { organizationId: null, learnerId: null };

const files = (await readdir(join(evalsDir, "scenarios")))
  .filter((f) => f.endsWith(".json"))
  .sort();
const report: {
  scenario: string;
  turn: number;
  reply: string;
  guarded: boolean;
  criteria: CriterionResult[];
}[] = [];
let blockingFailures = 0;

for (const file of files) {
  const scenario = scenarioSchema.parse(
    JSON.parse(await readFile(join(evalsDir, "scenarios", file), "utf8")),
  );
  const ctx: TutorContext = {
    ...scenario.context,
    misconceptions: scenario.context.misconceptions.map((m) => ({
      id: asMisconceptionId(m.id),
      description: m.description,
    })),
  };
  const history: TurnMessage[] = [];
  let hintLevel = ctx.hintLevel;
  for (const [i, turn] of scenario.turns.entries()) {
    history.push({ role: "learner", content: turn });
    let result: Awaited<ReturnType<typeof tutor.reply>>;
    if (scenario.action === "hint") {
      const hint = await tutor.hint({ ...ctx, hintLevel }, history, context);
      if (hint.ok) hintLevel = hint.value.level;
      result = hint;
    } else {
      result = await tutor.reply(ctx, history, context);
    }
    if (!result.ok) {
      console.error(`✗ ${scenario.id} (tour ${i + 1}) : ${result.error.kind}`);
      blockingFailures++;
      break;
    }
    history.push({ role: "tutor", content: result.value.text });
    const criteria = evaluateReply(result.value.text, ctx);
    const failed = criteria.filter((c) => !c.passed);
    blockingFailures += failed.filter((c) => c.blocking).length;
    report.push({
      scenario: scenario.id,
      turn: i + 1,
      reply: result.value.text,
      guarded: result.value.guarded,
      criteria,
    });
    const marks =
      failed.length === 0 ? "✓" : failed.some((c) => c.blocking) ? "✗" : "~";
    console.info(
      `${marks} ${scenario.id} (tour ${i + 1})${result.value.guarded ? " [réponse rattrapée par le contrôle]" : ""}${
        failed.length ? ` — ${failed.map((c) => c.label).join(", ")}` : ""
      }`,
    );
  }
}

const total = report.length;
const passedAll = report.filter((r) =>
  r.criteria.every((c) => c.passed),
).length;
const guarded = report.filter((r) => r.guarded).length;
console.info(
  `\n${passedAll}/${total} réponses parfaites · ${guarded} rattrapée(s) par le contrôle · ${blockingFailures} échec(s) bloquant(s)`,
);
await mkdir(join(evalsDir, "reports"), { recursive: true });
const path = join(
  evalsDir,
  "reports",
  `${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);
await writeFile(
  path,
  `${JSON.stringify({ model: model ?? "routage par défaut", report }, null, 2)}\n`,
);
console.info(`Rapport : ${path}`);
process.exit(blockingFailures > 0 ? 1 : 0);
