"use client";

import {
  ChalkboardTeacher,
  DotsThree,
  Student,
  UserMinus,
  UserPlus,
} from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wema/ui/components/ui/dropdown-menu";
import { Label } from "@wema/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import { toast } from "@wema/ui/components/ui/sonner";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { ClassMembers, SchoolMembers } from "../../lib/school-types";
import { useMutation } from "../../lib/use-mutation";
import { MemberAvatar } from "./member-avatar";

const ROLES = ["learner", "teacher"] as const;
type Role = (typeof ROLES)[number];
const isRole = (v: string): v is Role => ROLES.some((r) => r === v);

function MemberRow({
  classId,
  member,
}: {
  classId: string;
  member: ClassMembers[number];
}) {
  const t = useTranslations("school.classDetail");
  const { run, pending } = useMutation();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
      <span className="flex min-w-0 items-center gap-3">
        <MemberAvatar name={member.displayName} size="sm" />
        <span className="truncate font-medium">{member.displayName}</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            aria-label={t("memberActions", { name: member.displayName })}
          >
            <DotsThree weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirm(true)}
          >
            <UserMinus aria-hidden />
            {t("remove", { name: member.displayName })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        variant="destructive"
        title={t("removeConfirm", { name: member.displayName })}
        description={t("removeHint")}
        confirmLabel={t("removeAction")}
        cancelLabel={t("cancel")}
        onConfirm={async () => {
          const result = await run(
            "DELETE",
            `/admin/classes/${classId}/members/${member.userId}`,
          );
          if (result.ok)
            toast.success(t("removed", { name: member.displayName }));
          else toast.error(t("removeFailed"));
          return result.ok;
        }}
      />
    </li>
  );
}

function MemberList({
  classId,
  title,
  members,
  empty,
  teacher,
}: {
  classId: string;
  title: string;
  members: ClassMembers;
  empty: string;
  teacher: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-card border bg-background/60 p-3 sm:p-4">
      <h3 className="flex items-center justify-between gap-2 px-1 text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          {teacher ? (
            <ChalkboardTeacher aria-hidden className="size-4 text-info-text" />
          ) : (
            <Student aria-hidden className="size-4 text-success-text" />
          )}
          {title}
        </span>
        <Badge variant={teacher ? "info" : "success"} className="tabular-nums">
          {members.length}
        </Badge>
      </h3>
      {members.length === 0 ? (
        <EmptyState
          variant="inline"
          titleAs="p"
          icon={
            teacher ? (
              <ChalkboardTeacher weight="fill" />
            ) : (
              <Student weight="fill" />
            )
          }
          tone={teacher ? "sky" : "mint"}
          title={empty}
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {members.map((m) => (
            <MemberRow key={m.userId} classId={classId} member={m} />
          ))}
        </ul>
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
    if (result.ok) {
      const who = available.find((m) => m.userId === userId);
      toast.success(t("enrolled", { name: who?.displayName ?? "" }));
      setUserId("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <MemberList
          classId={classId}
          title={t("teachers")}
          members={members.filter((m) => m.role === "teacher")}
          empty={t("noTeacher")}
          teacher
        />
        <MemberList
          classId={classId}
          title={t("learners")}
          members={members.filter((m) => m.role === "learner")}
          empty={t("noLearner")}
          teacher={false}
        />
      </div>
      {candidates && (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-card border border-dashed bg-background/60 p-4"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus aria-hidden className="size-4 text-muted-foreground" />
            {t("enroll")}
          </h3>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCandidate")}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full min-w-0 flex-1 space-y-2 sm:min-w-56">
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
              <div className="w-full space-y-2 sm:w-40">
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
              <Button type="submit" disabled={pending || !userId}>
                <UserPlus aria-hidden />
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
