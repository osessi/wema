"use client";

import { ArrowRight, ListChecks } from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { FieldSection } from "@wema/ui/components/ui/field";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

export interface PlacementSubject {
  subjectId: string;
  subjectIcon: string | null;
  programName: string;
  state: "not_started" | "in_progress" | "done";
  /** Date du test, déjà mise en forme. */
  doneOn: string | null;
  hasQuestions: boolean;
}

const STATE_BADGE = {
  not_started: "brand",
  in_progress: "info",
  done: "success",
} as const;

/**
 * Choix de la matière du test de niveau, en cartes avec l'icône de chaque
 * matière, puis l'action qui lui correspond (commencer, reprendre, bilan).
 */
export function PlacementSubjects({
  subjects,
}: {
  subjects: readonly PlacementSubject[];
}) {
  const t = useTranslations("learner.placement");
  const [selected, setSelected] = useState(
    () =>
      (
        subjects.find((s) => s.state !== "done" && s.hasQuestions) ??
        subjects[0]
      )?.subjectId ?? "",
  );
  const current = subjects.find((s) => s.subjectId === selected);
  const href = current ? `/eleve/positionnement/${current.subjectId}` : "";

  return (
    <FieldSection
      title={t("subjects")}
      description={t("chooseSubject")}
      icon={
        <GlowTile tone="yellow" size={36}>
          <ListChecks weight="bold" />
        </GlowTile>
      }
    >
      <ChoiceCards
        aria-label={t("subjects")}
        columns={subjects.length > 1 ? 2 : 1}
        value={selected}
        onValueChange={setSelected}
        options={subjects.map((s) => ({
          value: s.subjectId,
          media: <SubjectIcon icon={s.subjectIcon} size={40} />,
          title: s.programName,
          description: (
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={STATE_BADGE[s.state]}>
                {t(`state.${s.state}`)}
              </Badge>
              {s.doneOn
                ? t("doneOn", { date: s.doneOn })
                : !s.hasQuestions && s.state === "not_started"
                  ? t("noQuestions")
                  : null}
            </span>
          ),
        }))}
      />
      {current &&
        (current.state === "done" ? (
          <Button asChild variant="outline" className="w-full sm:w-fit">
            <Link href={href}>
              {t("seeResult")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : current.hasQuestions ? (
          <Button asChild variant="brand" size="lg" className="w-full sm:w-fit">
            <Link href={href}>
              {current.state === "in_progress" ? t("resume") : t("start")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null)}
    </FieldSection>
  );
}
