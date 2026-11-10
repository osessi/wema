"use client";

import {
  CheckCircle,
  ClipboardText,
  Plus,
  Warning,
} from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Progress } from "@wema/ui/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { read } from "../../lib/mutate";
import type { AssignmentItem, AssignmentList } from "../../lib/teacher-types";
import { useMutation } from "../../lib/use-mutation";
import {
  type AssignableExercise,
  GiveAssignmentDialog,
  type GiveResult,
} from "./give-assignment";

function CompleteButton({
  classId,
  assignment,
  onResult,
}: {
  classId: string;
  assignment: AssignmentItem;
  onResult: (r: GiveResult) => void;
}) {
  const t = useTranslations("teacher.assignments");
  const { run, pending, error } = useMutation();
  async function complete() {
    const result = await run(
      "POST",
      `/admin/classes/${classId}/assignments/${assignment.id}/complete`,
    );
    if (!result.ok) return;
    const created = read(result.data, "created");
    const failed = read(result.data, "failed");
    onResult({
      created: typeof created === "number" ? created : 0,
      failed: Array.isArray(failed) ? failed.length : 0,
    });
  }
  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={complete}>
        {pending ? t("completing") : t("complete")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Devoirs d'une classe : taux de rendu, variantes manquantes, nouveau devoir. */
export function AssignmentsPanel({
  classId,
  learnerCount,
  assignments,
  exercises,
}: {
  classId: string;
  learnerCount: number;
  assignments: AssignmentList;
  exercises: AssignableExercise[];
}) {
  const t = useTranslations("teacher.assignments");
  const format = useFormatter();
  const now = useNow();
  const [result, setResult] = useState<GiveResult | null>(null);
  const objectives = new Map(exercises.map((x) => [x.id, x.objective]));
  const sorted = [...assignments].sort(
    (a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime(),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <GiveAssignmentDialog
          classes={[{ id: classId, name: "" }]}
          exercises={exercises}
          onDone={setResult}
          trigger={
            <Button>
              <Plus />
              {t("give")}
            </Button>
          }
        />
      </div>
      {result && (
        <Alert variant={result.failed > 0 ? "warning" : "success"}>
          <AlertDescription>
            {result.failed > 0
              ? t("resultPartial", {
                  created: result.created,
                  failed: result.failed,
                })
              : t("resultOk", { created: result.created })}
          </AlertDescription>
        </Alert>
      )}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<ClipboardText weight="fill" />}
          tone="mint"
          title={t("empty")}
          description={t("emptyHint")}
        />
      ) : (
        <div className="overflow-hidden rounded-card border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("title")}</TableHead>
                <TableHead>{t("due")}</TableHead>
                <TableHead className="min-w-40">{t("handedIn")}</TableHead>
                <TableHead className="text-right">{t("succeeded")}</TableHead>
                <TableHead>{t("variants")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((a) => {
                const due = new Date(a.dueAt);
                const left = due.getTime() - now.getTime();
                const past = left < 0;
                const soon = !past && left < 48 * 3600 * 1000;
                const rate = a.given > 0 ? (a.done / a.given) * 100 : 0;
                const missing = Math.max(0, learnerCount - a.given);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-normal">
                      <span className="font-medium">{a.title}</span>
                      {objectives.get(a.intentId) && (
                        <span className="block text-xs text-muted-foreground">
                          {objectives.get(a.intentId)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-mono text-xs tracking-wide uppercase tabular-nums">
                          {format.dateTime(due, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <Badge
                          variant={past ? "neutral" : soon ? "warning" : "info"}
                        >
                          {past ? t("closed") : soon ? t("dueSoon") : t("open")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="text-sm tabular-nums">
                          {t("handedInValue", {
                            done: a.done,
                            given: a.given,
                          })}
                        </span>
                        <Progress
                          value={rate}
                          tone="brand"
                          aria-label={t("handedIn")}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.correct}
                    </TableCell>
                    <TableCell>
                      {missing > 0 ? (
                        <div className="flex flex-col items-start gap-2">
                          <Badge variant="warning">
                            <Warning weight="bold" className="size-3" />
                            {t("missing", { count: missing })}
                          </Badge>
                          <CompleteButton
                            classId={classId}
                            assignment={a}
                            onResult={setResult}
                          />
                        </div>
                      ) : (
                        <Badge variant="success">
                          <CheckCircle weight="bold" className="size-3" />
                          {t("allReady")}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
