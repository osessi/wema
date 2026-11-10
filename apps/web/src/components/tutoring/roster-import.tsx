"use client";

import { CheckCircle, FileCsv, UserPlus, Users } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wema/ui/components/ui/tabs";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { browserApi } from "../../lib/insights-client";
import { read } from "../../lib/mutate";
import { CodeSheet, type SheetLearner } from "./code-sheet";

/** Bornes affichées ; la validation qui compte est celle de l'API. */
const MAX_ROWS = 100;
const MAX_FILE_BYTES = 64 * 1024;
const NONE = "none";

const ERROR_CODES = [
  "roster_empty",
  "roster_too_large",
  "roster_too_many_rows",
  "roster_invalid",
  "roster_conflict",
  "identifier_taken",
  "invalid_email",
  "too_many_attempts",
  "server_busy",
  "forbidden",
] as const;
type ErrorCode = (typeof ERROR_CODES)[number] | "generic";

const ROW_ERRORS = [
  "first_name_missing",
  "last_name_missing",
  "field_too_long",
  "invalid_characters",
  "invalid_parent_email",
  "duplicate_learner",
  "class_not_found",
  "already_member",
] as const;
type RowError = (typeof ROW_ERRORS)[number];
const isRowError = (v: string): v is RowError =>
  ROW_ERRORS.some((e) => e === v);

async function errorCode(res: Response): Promise<ErrorCode> {
  const json: unknown = await res.json().catch(() => null);
  const code = read(read(json, "error"), "code");
  return ERROR_CODES.find((c) => c === code) ?? "generic";
}

interface PreviewRow {
  line: number;
  firstName: string;
  lastName: string;
  className: string | null;
  parentEmail: string | null;
  username: string;
  errors: string[];
  duplicateOf: number | null;
}

/**
 * Inscription d'élèves (école, prof particulier) : un par un, ou une liste
 * collée ou un fichier CSV, avec aperçu ligne par ligne et confirmation ; puis
 * la fiche des codes à imprimer.
 */
export function RosterImport({
  organizationId,
  classes,
  defaultClassId,
  canEnroll = true,
  onImported,
}: {
  organizationId: string;
  classes: { id: string; name: string }[];
  defaultClassId?: string | null;
  /** L'utilisateur peut inscrire dans une classe (classes.manage). */
  canEnroll?: boolean;
  onImported?: (created: SheetLearner[]) => void;
}) {
  const t = useTranslations("tutoring.roster");
  const id = useId();
  const router = useRouter();
  const [classId, setClassId] = useState(
    canEnroll && defaultClassId ? defaultClassId : NONE,
  );
  const [text, setText] = useState("");
  const [one, setOne] = useState({ firstName: "", lastName: "", email: "" });
  const [createParents, setCreateParents] = useState(true);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [created, setCreated] = useState<
    (SheetLearner & { parentNotice?: "linked" | "not_created" | null })[] | null
  >(null);
  const [error, setError] = useState<{ code: ErrorCode } | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const api = () => browserApi().admin.organizations[":id"].roster;
  const target = classId === NONE ? null : classId;

  const errorText = (code: ErrorCode) => t(`errors.${code}`, { max: MAX_ROWS });

  async function preview(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await api().preview.$post({
        param: { id: organizationId },
        json: { text, classId: target },
      });
      const json = res.ok ? await res.json() : null;
      if (json && "rows" in json) setRows(json.rows);
      else {
        setRows(null);
        setError({ code: await errorCode(res) });
      }
    } catch {
      setError({ code: "generic" });
    } finally {
      setPending(false);
    }
  }

  async function importText(body: string, parents: boolean): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const res = await api().import.$post({
        param: { id: organizationId },
        json: { text: body, classId: target, createParents: parents },
      });
      const json = res.ok ? await res.json() : null;
      if (!json || !("created" in json)) {
        setError({ code: await errorCode(res) });
        return false;
      }
      const list = json.created;
      setCreated(list);
      setRows(null);
      setText("");
      setOne({ firstName: "", lastName: "", email: "" });
      onImported?.(list);
      router.refresh();
      return true;
    } catch {
      setError({ code: "generic" });
      return false;
    } finally {
      setPending(false);
    }
  }

  async function addOne(e: FormEvent) {
    e.preventDefault();
    // Une ligne de la même liste : mêmes règles que l'import en masse.
    const cells = [one.firstName, one.lastName, "", one.email].map((v) =>
      v.replaceAll(";", " ").trim(),
    );
    await importText(cells.join(";"), one.email.trim() !== "");
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError({ code: "roster_too_large" });
      return;
    }
    setText(await file.text());
    setRows(null);
  }

  const okRows = rows?.filter((r) => r.errors.length === 0).length ?? 0;
  const badRows = (rows?.length ?? 0) - okRows;
  const anyParent = rows?.some((r) => r.parentEmail) ?? false;

  if (created)
    return (
      <div className="space-y-4">
        <CodeSheet learners={created} />
        {created.some((k) => k.parentNotice === "not_created") ? (
          // Message générique : il ne dit pas si un compte existe pour cet e-mail.
          <Alert variant="warning">
            <AlertDescription>
              <p>{t("errors.parent_not_created")}</p>
              <p className="font-medium">
                {created
                  .filter((k) => k.parentNotice === "not_created")
                  .map((k) => k.displayName)
                  .join(", ")}
              </p>
            </AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => setCreated(null)}
        >
          <UserPlus aria-hidden />
          {t("title")}
        </Button>
      </div>
    );

  return (
    <div className="space-y-5">
      {canEnroll && classes.length > 0 ? (
        <div className="max-w-sm space-y-2">
          <Label htmlFor={`${id}-class`}>{t("class")}</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger id={`${id}-class`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("noClass")}</SelectItem>
              {classes.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("classHint")}</p>
        </div>
      ) : null}

      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">
            <UserPlus aria-hidden />
            {t("tabs.one")}
          </TabsTrigger>
          <TabsTrigger value="list">
            <Users aria-hidden />
            {t("tabs.list")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="one" className="pt-4">
          <form onSubmit={addOne} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`${id}-first`}>{t("firstName")}</Label>
                <Input
                  id={`${id}-first`}
                  required
                  maxLength={60}
                  autoComplete="off"
                  value={one.firstName}
                  onChange={(e) =>
                    setOne({ ...one, firstName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-last`}>{t("lastName")}</Label>
                <Input
                  id={`${id}-last`}
                  required
                  maxLength={60}
                  autoComplete="off"
                  value={one.lastName}
                  onChange={(e) => setOne({ ...one, lastName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-email`}>{t("parentEmail")}</Label>
                <Input
                  id={`${id}-email`}
                  type="email"
                  maxLength={254}
                  autoComplete="off"
                  value={one.email}
                  onChange={(e) => setOne({ ...one, email: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" variant="brand" disabled={pending}>
              {t("addOne")}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="list" className="pt-4">
          <form onSubmit={preview} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-paste`}>{t("paste")}</Label>
              <Textarea
                id={`${id}-paste`}
                rows={6}
                className="font-mono text-sm"
                placeholder={"Awa\tDossou\nKofi\tMensah"}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setRows(null);
                }}
                aria-describedby={`${id}-paste-hint`}
              />
              <p
                id={`${id}-paste-hint`}
                className="text-xs text-muted-foreground"
              >
                {t("pasteHint", { max: MAX_ROWS })}
              </p>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor={`${id}-file`}
                className="inline-flex items-center gap-2"
              >
                <FileCsv aria-hidden className="size-4" />
                {t("file")}
              </Label>
              <Input
                id={`${id}-file`}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="max-w-sm"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={pending || text.trim() === ""}
            >
              {t("check")}
            </Button>
          </form>

          {rows ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{t("previewTitle")}</h3>
                <Badge variant={badRows > 0 ? "danger" : "success"}>
                  {t("previewSummary", { ok: okRows, errors: badRows })}
                </Badge>
              </div>
              <div className="overflow-x-auto rounded-card border">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">{t("previewTitle")}</caption>
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("line")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("learner")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("class")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("username")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => (
                      <tr
                        key={r.line}
                        className={
                          r.errors.length > 0 ? "bg-danger-soft/40" : ""
                        }
                      >
                        <td className="px-3 py-2 font-mono tabular-nums">
                          {r.line}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium">
                            {r.firstName} {r.lastName}
                          </span>
                          {r.parentEmail ? (
                            <span className="block text-xs text-muted-foreground">
                              {r.parentEmail}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{r.className ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.username}
                        </td>
                        <td className="px-3 py-2">
                          {r.errors.length === 0 ? (
                            <Badge variant="success">
                              <CheckCircle aria-hidden />
                              {t("ready")}
                            </Badge>
                          ) : (
                            <ul className="flex flex-wrap gap-1">
                              {r.errors.map((e) => (
                                <li key={e}>
                                  <Badge variant="danger">
                                    {isRowError(e)
                                      ? t(`rowErrors.${e}`, {
                                          line: r.duplicateOf ?? 0,
                                        })
                                      : e}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {badRows > 0 ? (
                <Alert variant="warning">
                  <AlertDescription>{t("fixFirst")}</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {anyParent ? (
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`${id}-parents`}
                        checked={createParents}
                        onCheckedChange={(v) => setCreateParents(v === true)}
                      />
                      <Label
                        htmlFor={`${id}-parents`}
                        className="font-normal leading-snug"
                      >
                        {t("createParents")}
                      </Label>
                    </div>
                  ) : null}
                  <ConfirmDialog
                    open={confirmOpen}
                    onOpenChange={setConfirmOpen}
                    trigger={
                      <Button type="button" variant="brand">
                        {t("confirm", { count: okRows })}
                      </Button>
                    }
                    title={t("confirmTitle")}
                    description={t("confirmBody", { count: okRows })}
                    confirmLabel={t("confirm", { count: okRows })}
                    pendingLabel={t("pending")}
                    error={error ? errorText(error.code) : undefined}
                    onConfirm={() =>
                      importText(text, anyParent && createParents)
                    }
                  />
                </div>
              )}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      {error && !confirmOpen ? (
        <Alert variant="destructive">
          <AlertDescription>{errorText(error.code)}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
