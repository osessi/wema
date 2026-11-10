import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsClockwise,
  Barbell,
  ChalkboardTeacher,
  ChatsCircle,
  CheckCircle,
  ClipboardText,
  Clock,
  Compass,
  HandWaving,
  Lightbulb,
  Microphone,
  PencilSimpleLine,
  Question,
  Smiley,
  Stack,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import type { GlowTone } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import type {
  AssignmentStatus,
  NextAction,
  TutorMode,
} from "../../lib/learner-types";

type ActionKind = NextAction["kind"];

/** Icône et ton de chaque type de prochaine action (accueil, « Ensuite »). */
export const ACTION_VISUALS: Record<
  ActionKind,
  { icon: Icon; tone: GlowTone }
> = {
  assignment_due: { icon: ClipboardText, tone: "amber" },
  finish_exercise: { icon: PencilSimpleLine, tone: "yellow" },
  start_notion: { icon: Compass, tone: "sky" },
  easy_win: { icon: Smiley, tone: "mint" },
  prerequisite_first: { icon: Stack, tone: "rose" },
  misconception_focus: { icon: Warning, tone: "rose" },
  practice: { icon: Barbell, tone: "mint" },
  spaced_review: { icon: ArrowsClockwise, tone: "sky" },
  intake: { icon: HandWaving, tone: "yellow" },
};

/** Icône et ton de chaque mode du prof IA. */
export const MODE_VISUALS: Record<TutorMode, { icon: Icon; tone: GlowTone }> = {
  course_question: { icon: Question, tone: "sky" },
  exercise_help: { icon: Lightbulb, tone: "yellow" },
  teach_back: { icon: ChalkboardTeacher, tone: "mint" },
  oral_check: { icon: Microphone, tone: "rose" },
  intake: { icon: HandWaving, tone: "amber" },
};

const ASSIGNMENT_BADGES: Record<
  AssignmentStatus,
  {
    variant: "success" | "warning" | "danger" | "info" | "neutral";
    icon: Icon;
  }
> = {
  todo: { variant: "warning", icon: Clock },
  late: { variant: "danger", icon: WarningCircle },
  done: { variant: "success", icon: CheckCircle },
  attempted: { variant: "info", icon: ChatsCircle },
  unavailable: { variant: "neutral", icon: Clock },
};

/** Pastille colorée du statut d'un devoir (À faire, En retard, Réussi…). */
export function AssignmentBadge({
  status,
  label,
}: {
  status: AssignmentStatus;
  label: string;
}) {
  const entry = ASSIGNMENT_BADGES[status];
  if (!entry) return <Badge variant="neutral">{label}</Badge>;
  const { variant, icon: Glyph } = entry;
  return (
    <Badge variant={variant}>
      <Glyph aria-hidden weight="bold" />
      {label}
    </Badge>
  );
}
