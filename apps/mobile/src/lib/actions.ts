import type { Href } from "expo-router";
import type { NextAction } from "./types";

/** Où mène une prochaine action : l'exercice concerné, ou une séance avec le prof IA. */
export function actionTarget(action: NextAction): {
  href: Href;
  label: "exercise" | "tutor" | "intake";
} {
  if ("variantId" in action)
    return {
      href: { pathname: "/exercice/[id]", params: { id: action.variantId } },
      label: "exercise",
    };
  if (action.kind === "intake")
    return {
      href: { pathname: "/prof-ia", params: { mode: "intake" } },
      label: "intake",
    };
  const mode =
    action.kind === "spaced_review" ? "teach_back" : "course_question";
  return {
    href: { pathname: "/prof-ia", params: { mode, notion: action.notionId } },
    label: "tutor",
  };
}
