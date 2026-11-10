"use client";

import {
  type TutorAvatar as AvatarId,
  isSafeTutorName,
  TUTOR_AVATARS,
  TUTOR_NAME_MAX,
} from "@wema/domain";
import { Button } from "@wema/ui/components/ui/button";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { toast } from "@wema/ui/components/ui/sonner";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { TutorAvatar } from "./tutor-avatar";
import { useLearnerMutation } from "./use-learner-mutation";

export interface PersonaValue {
  subjectId: string | null;
  name: string;
  avatar: AvatarId;
}

/**
 * Choix du prénom et de l'avatar du prof IA (profil, première séance).
 * Le prénom est vérifié ici pour aider l'élève, puis par l'API qui fait foi.
 */
export function TutorPersonaPicker({
  initial,
  subjects,
  personas = [],
  onSaved,
  actions,
}: {
  initial: PersonaValue | null;
  /** Matières : si fourni, l'élève peut régler un prof IA par matière. */
  subjects?: readonly { id: string; name: string; icon: string | null }[];
  /** Réglages existants : changer de matière reprend celui de la matière. */
  personas?: readonly PersonaValue[];
  onSaved?: (persona: PersonaValue) => void;
  /** Boutons en plus, à côté d'« Enregistrer » (« Plus tard »…). */
  actions?: ReactNode;
}) {
  const t = useTranslations("learner.persona");
  const id = useId();
  const { run, pending, error } = useLearnerMutation();
  const [name, setName] = useState(initial?.name ?? "");
  const [avatar, setAvatar] = useState<AvatarId>(initial?.avatar ?? "sun");
  const [subjectId, setSubjectId] = useState<string | null>(
    initial?.subjectId ?? null,
  );
  const typed = name.trim();
  const invalid = typed !== "" && !isSafeTutorName(typed);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (typed === "" || invalid) return;
    const persona = { subjectId, name: typed, avatar };
    const result = await run("PUT", "/learner/tutor-persona", persona);
    if (result.ok) {
      toast.success(t("saved", { name: typed }));
      onSaved?.(persona);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <p id={`${id}-avatar`} className="text-sm font-medium">
          {t("avatar")}
        </p>
        <ChoiceCards
          aria-labelledby={`${id}-avatar`}
          size="compact"
          columns={3}
          className="grid-cols-2"
          value={avatar}
          onValueChange={(v) => {
            const next = TUTOR_AVATARS.find((a) => a === v);
            if (next) setAvatar(next);
          }}
          options={TUTOR_AVATARS.map((a) => ({
            value: a,
            title: t(`avatars.${a}`),
            media: <TutorAvatar avatar={a} name={typed || "?"} size={32} />,
          }))}
        />
      </div>

      <div className="max-w-sm space-y-1.5">
        <Label htmlFor={`${id}-name`}>{t("name")}</Label>
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={TUTOR_NAME_MAX}
          placeholder={t("namePlaceholder")}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={`${id}-help`}
          onChange={(e) => setName(e.target.value)}
        />
        <p
          id={`${id}-help`}
          className={cn(
            "text-xs",
            invalid ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {invalid ? t("nameInvalid") : t("nameHelp")}
        </p>
      </div>

      {subjects && subjects.length > 1 && (
        <div className="space-y-1.5">
          <p id={`${id}-subject`} className="text-sm font-medium">
            {t("subject")}
          </p>
          <ChoiceCards
            aria-labelledby={`${id}-subject`}
            size="compact"
            value={subjectId ?? ""}
            onValueChange={(v) => {
              const next = v || null;
              setSubjectId(next);
              const saved = personas.find((p) => p.subjectId === next);
              if (saved) {
                setName(saved.name);
                setAvatar(saved.avatar);
              }
            }}
            options={[
              { id: "", name: t("allSubjects"), icon: null },
              ...subjects,
            ].map((s) => ({
              value: s.id,
              title: s.name,
              media: <SubjectIcon icon={s.icon} size={32} />,
            }))}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          variant="brand"
          disabled={pending || typed === "" || invalid}
        >
          {t("save")}
        </Button>
        {actions}
      </div>
    </form>
  );
}
