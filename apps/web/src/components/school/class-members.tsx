"use client";

import { X } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Label } from "@wema/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { ClassMembers, SchoolMembers } from "../../lib/school-types";
import { useMutation } from "../../lib/use-mutation";

const ROLES = ["learner", "teacher"] as const;
type Role = (typeof ROLES)[number];
const isRole = (v: string): v is Role => ROLES.some((r) => r === v);

function MemberList({
  classId,
  title,
  members,
  empty,
}: {
  classId: string;
  title: string;
  members: ClassMembers;
  empty: string;
}) {
  const t = useTranslations("school.classDetail");
  const { run, pending, error } = useMutation();
  return (
    <div className="space-y-2">
      <h3 className="font-medium">
        {title}{" "}
        <span className="text-muted-foreground tabular-nums">
          ({members.length})
        </span>
      </h3>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span>{m.displayName}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                aria-label={t("remove", { name: m.displayName })}
                title={t("remove", { name: m.displayName })}
                onClick={() =>
                  run("DELETE", `/admin/classes/${classId}/members/${m.userId}`)
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/** Profs et élèves de la classe ; inscription d'un membre de l'organisation. */
export function ClassMembersPanel({
  classId,
  members,
  candidates,
}: {
  classId: string;
  members: ClassMembers;
  /** Membres de l'organisation, ou null si on ne peut pas les lister. */
  candidates: SchoolMembers | null;
}) {
  const t = useTranslations("school.classDetail");
  const { run, pending, error } = useMutation();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("learner");
  const enrolled = new Set(members.map((m) => m.userId));
  const available = (candidates ?? []).filter(
    (m) => !enrolled.has(m.userId) && !m.disabled,
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const result = await run("POST", `/admin/classes/${classId}/members`, {
      userId,
      role,
    });
    if (result.ok) setUserId("");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <MemberList
          classId={classId}
          title={t("teachers")}
          members={members.filter((m) => m.role === "teacher")}
          empty={t("noTeacher")}
        />
        <MemberList
          classId={classId}
          title={t("learners")}
          members={members.filter((m) => m.role === "learner")}
          empty={t("noLearner")}
        />
      </div>
      {candidates && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">{t("enroll")}</h3>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCandidate")}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="enroll-member">{t("member")}</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger id="enroll-member" className="w-full">
                    <SelectValue placeholder={t("memberPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.displayName}
                        {m.roles.length > 0 &&
                          ` · ${m.roles.map((r) => r.name).join(", ")}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40 space-y-2">
                <Label htmlFor="enroll-role">{t("as")}</Label>
                <Select
                  value={role}
                  onValueChange={(v) => {
                    if (isRole(v)) setRole(v);
                  }}
                >
                  <SelectTrigger id="enroll-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`roles.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={pending || !userId}
              >
                {t("enrollSubmit")}
              </Button>
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      )}
    </div>
  );
}
