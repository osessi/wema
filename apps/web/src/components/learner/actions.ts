import type { NextAction } from "../../lib/learner-types";

/** Où mène une prochaine action : l'exercice concerné, ou une séance avec le prof IA. */
export function actionTarget(action: NextAction): {
  href: string;
  label: "exercise" | "tutor" | "intake";
} {
  if ("variantId" in action)
    return { href: `/eleve/exercices/${action.variantId}`, label: "exercise" };
  if (action.kind === "intake")
    return { href: "/eleve/prof-ia?mode=intake", label: "intake" };
  const mode =
    action.kind === "spaced_review" ? "teach_back" : "course_question";
  return {
    href: `/eleve/prof-ia?mode=${mode}&notion=${action.notionId}`,
    label: "tutor",
  };
}
