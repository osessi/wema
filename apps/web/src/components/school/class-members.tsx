"use client";

import {
  ChalkboardTeacher,
  DotsThree,
  Student,
  UserMinus,
  UserPlus,
} from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card } from "@wema/ui/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wema/ui/components/ui/dropdown-menu";
import { FieldSection } from "@wema/ui/components/ui/field";
import { Label } from "@wema/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import { toast } from "@wema/ui/components/ui/sonner";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import {
  PersonAvatar,
  PersonChip,
} from "@wema/ui/components/wema/person-avatar";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { ClassMembers, SchoolMembers } from "../../lib/school-types";
import { useMutation } from "../../lib/use-mutation";

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
      <PersonChip name={member.displayName} seed={member.userId} />
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
    <Card
      tone={teacher ? "sky" : "mint"}
      className="h-full gap-3 px-3 py-3 sm:px-4 sm:py-4"
    >
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
        <ul className="divide-y rounded-lg border bg-background/60">
          {members.map((m) => (
            <MemberRow key={m.userId} classId={classId} member={m} />
          ))}
        </ul>
      )}
    </Card>
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
        <FieldSection
          title={<h3 className="text-base font-semibold">{t("enroll")}</h3>}
          icon={
            <GlowTile tone="yellow" size={36}>
              <UserPlus weight="fill" />
            </GlowTile>
          }
        >
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCandidate")}</p>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="enroll-member">{t("member")}</Label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger id="enroll-member" className="w-full">
                      <SelectValue placeholder={t("memberPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          <PersonAvatar
                            name={m.displayName}
                            seed={m.userId}
                            size="xs"
                            decorative
                          />
                          {m.displayName}
                          {m.roles.length > 0 &&
                            ` · ${m.roles.map((r) => r.name).join(", ")}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <p id="enroll-role" className="text-sm font-medium">
                    {t("as")}
                  </p>
                  <ChoiceCards
                    aria-labelledby="enroll-role"
                    name="role"
                    size="compact"
                    value={role}
                    onValueChange={(v) => {
                      if (isRole(v)) setRole(v);
                    }}
                    options={ROLES.map((r) => ({
                      value: r,
                      title: t(`roles.${r}`),
                      tone: r === "teacher" ? "sky" : "mint",
                      icon:
                        r === "teacher" ? (
                          <ChalkboardTeacher weight="fill" />
                        ) : (
                          <Student weight="fill" />
                        ),
                    }))}
                  />
                </div>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                variant="brand"
                disabled={pending || !userId}
              >
                <UserPlus aria-hidden />
                {t("enrollSubmit")}
              </Button>
            </form>
          )}
        </FieldSection>
      )}
    </div>
  );
}
