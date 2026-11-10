"use client";

import { Button } from "@wema/ui/components/ui/button";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { mutate } from "../../lib/mutate";
import type { ProgramOption } from "../../lib/school-types";
import { useMutation } from "../../lib/use-mutation";
import { CreateClassForm } from "../school/create-class-form";

/** Enregistre un choix du prof (étape faite ou passée), puis va à `next`. */
export function StepButton({
  organizationId,
  step,
  status,
  next,
  variant = "brand",
  children,
}: {
  organizationId: string;
  step: "welcome" | "parents" | "checklist";
  status: "done" | "skipped";
  next: string | null;
  variant?: "brand" | "outline" | "ghost" | "bevel";
  children: ReactNode;
}) {
  const router = useRouter();
  const { run, pending, error } = useMutation();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        onClick={async () => {
          const result = await run(
            "PUT",
            `/tutoring/${organizationId}/onboarding/${step}`,
            { status },
            { refresh: next === null },
          );
          if (result.ok && next) router.push(next);
        }}
      >
        {children}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Création du premier groupe : le prof en devient le prof, puis étape suivante. */
export function GroupForm({
  organizationId,
  programs,
  userId,
  next,
}: {
  organizationId: string;
  programs: ProgramOption[];
  userId: string;
  next: string;
}) {
  const router = useRouter();
  return (
    <CreateClassForm
      organizationId={organizationId}
      programs={programs}
      onCreated={async (classId) => {
        await mutate("POST", `/admin/classes/${classId}/members`, {
          userId,
          role: "teacher",
        });
        router.push(next);
        router.refresh();
      }}
    />
  );
}
