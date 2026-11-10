"use client";

import {
  ArrowSquareOut,
  Eye,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { GlowTile, type GlowTone } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card } from "@wema/ui/components/ui/card";
import { Input } from "@wema/ui/components/ui/input";
import { NativeSelect } from "@wema/ui/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@wema/ui/components/ui/sheet";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Code, DefinitionList } from "../_ui/kit";

export interface AuditEntry {
  id: string;
  at: string;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
}

type Kind = "create" | "update" | "delete" | "read";

const KIND_LOOK: Record<Kind, { tone: GlowTone; icon: ReactNode }> = {
  create: { tone: "mint", icon: <Plus weight="bold" /> },
  update: { tone: "sky", icon: <PencilSimple weight="bold" /> },
  delete: { tone: "rose", icon: <Trash weight="bold" /> },
  read: { tone: "yellow", icon: <Eye weight="bold" /> },
};

/** Nature de l'action, déduite de son suffixe (création, modification…). */
function kindOf(action: string): Kind {
  const verb = action.split(".").pop() ?? "";
  if (
    /^(create|add|member_add|role_add|declare|consent|share|propose|proposed|selected|import|trial|validate|comics|contextualize|simplify)$/.test(
      verb,
    )
  )
    return "create";
  if (
    /^(delete|remove|member_remove|role_remove|archive|unshare|cancel|deletion_request|purge|rejected)$/.test(
      verb,
    )
  )
    return "delete";
  if (/^(read|export)$/.test(verb)) return "read";
  return "update";
}

/** Lien vers la cible, quand une page du back-office la montre. */
function targetHref(type: string, id: string | null): string | null {
  if (!id) return null;
  if (type === "organization") return `/admin/organisations/${id}`;
  if (type === "country") return `/admin/referentiel/${id}`;
  return null;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

/** Lignes affichées d'un coup ; « Afficher plus » en ajoute autant. */
const PAGE = 25;

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Journal filtrable : recherche, type de cible, nature de l'action. */
export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  const t = useTranslations("audit");
  const format = useFormatter();
  const searchId = useId();
  const typeId = useId();
  const kindId = useId();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [kind, setKind] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const actionName = (a: string) =>
    t.has(`actions.${a}`) ? t(`actions.${a}`) : a;
  const targetName = (ty: string) =>
    t.has(`targets.${ty}`) ? t(`targets.${ty}`) : ty;

  const types = useMemo(
    () => [...new Set(entries.map((e) => e.targetType))].sort(),
    [entries],
  );
  const shown = entries.filter((e) => {
    if (type && e.targetType !== type) return false;
    if (kind && kindOf(e.action) !== kind) return false;
    if (!query) return true;
    const hay = fold(
      `${actionName(e.action)} ${e.action} ${e.actorName ?? t("system")} ${targetName(e.targetType)} ${e.targetId ?? ""}`,
    );
    return hay.includes(fold(query));
  });
  const open = entries.find((e) => e.id === openId) ?? null;

  const show = (v: unknown): ReactNode => {
    if (typeof v === "boolean") return v ? t("yes") : t("no");
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (v === null || v === undefined) return "—";
    if (Array.isArray(v) && v.every((x) => typeof x === "string"))
      return (
        <span className="flex flex-wrap gap-1">
          {v.map((x) => (
            <Code key={x}>{x}</Code>
          ))}
        </span>
      );
    return (
      <pre className="overflow-x-auto rounded-lg bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap">
        {JSON.stringify(v, null, 2)}
      </pre>
    );
  };

  return (
    <>
      <div className="sticky top-2 z-20 flex flex-wrap items-end gap-3 rounded-card border bg-card/95 p-3 shadow-sm backdrop-blur">
        <div className="grid min-w-[min(100%,16rem)] flex-1 gap-1.5">
          <label htmlFor={searchId} className="text-xs font-medium">
            {t("search")}
          </label>
          <div className="relative">
            <MagnifyingGlass
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={searchId}
              type="search"
              value={query}
              placeholder={t("searchPlaceholder")}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="grid min-w-[10rem] gap-1.5">
          <label htmlFor={kindId} className="text-xs font-medium">
            {t("kindFilter")}
          </label>
          <NativeSelect
            id={kindId}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">{t("all")}</option>
            {(["create", "update", "delete", "read"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid min-w-[10rem] gap-1.5">
          <label htmlFor={typeId} className="text-xs font-medium">
            {t("target")}
          </label>
          <NativeSelect
            id={typeId}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">{t("all")}</option>
            {types.map((ty) => (
              <option key={ty} value={ty}>
                {targetName(ty)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <p
          className="w-full text-xs text-muted-foreground tabular-nums sm:w-auto sm:pb-2.5"
          role="status"
        >
          {t("count", { shown: shown.length, total: entries.length })}
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<MagnifyingGlass weight="bold" />}
          title={t("noMatch")}
          titleAs="h2"
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setType("");
                setKind("");
              }}
            >
              {t("reset")}
            </Button>
          }
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ol className="divide-y">
            {shown.slice(0, limit).map((e) => {
              const look = KIND_LOOK[kindOf(e.action)];
              const actor = e.actorName ?? t("system");
              const href = targetHref(e.targetType, e.targetId);
              const hasDetails = Object.keys(e.details).length > 0;
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6"
                >
                  <GlowTile tone={look.tone} size={28} glyph="56%">
                    {look.icon}
                  </GlowTile>
                  <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-auto">
                    <p
                      className="truncate text-sm font-medium"
                      title={e.action}
                    >
                      {actionName(e.action)}
                    </p>
                    <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <span>{targetName(e.targetType)}</span>
                      {e.targetId ? (
                        href ? (
                          <Link
                            href={href}
                            className="inline-flex items-center gap-0.5 font-mono underline-offset-4 hover:text-foreground hover:underline"
                          >
                            {e.targetId.slice(0, 8)}
                            <ArrowSquareOut aria-hidden className="size-3" />
                          </Link>
                        ) : (
                          <span className="font-mono" title={e.targetId}>
                            {e.targetId.slice(0, 8)}
                          </span>
                        )
                      ) : null}
                    </p>
                  </div>
                  <span className="flex min-w-0 items-center gap-2 sm:w-44">
                    <span
                      aria-hidden
                      className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-[10px] font-medium text-muted-foreground uppercase"
                    >
                      {e.actorName ? initials(e.actorName) : "·"}
                    </span>
                    <span className="truncate text-sm">{actor}</span>
                  </span>
                  <time
                    dateTime={e.at}
                    title={format.dateTime(new Date(e.at), {
                      dateStyle: "full",
                      timeStyle: "medium",
                    })}
                    className="text-xs text-muted-foreground tabular-nums sm:w-32 sm:text-right"
                  >
                    {format.dateTime(new Date(e.at), {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                  <span className="ml-auto sm:ml-0 sm:w-20 sm:text-right">
                    {hasDetails ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setOpenId(e.id)}
                      >
                        {t("details")}
                        <span className="sr-only">
                          {" "}
                          · {actionName(e.action)}
                        </span>
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
          {shown.length > limit ? (
            <div className="flex justify-center border-t p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLimit((n) => n + PAGE)}
              >
                {t("more", { count: Math.min(PAGE, shown.length - limit) })}
              </Button>
            </div>
          ) : null}
        </Card>
      )}

      <Sheet
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open ? (
            <>
              <SheetHeader>
                <SheetTitle>{actionName(open.action)}</SheetTitle>
                <SheetDescription>
                  {format.dateTime(new Date(open.at), {
                    dateStyle: "long",
                    timeStyle: "medium",
                  })}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-5 px-4 pb-6">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="neutral">{targetName(open.targetType)}</Badge>
                  <Badge variant="info">
                    {t(`kinds.${kindOf(open.action)}`)}
                  </Badge>
                </div>
                <DefinitionList
                  className="grid-cols-[minmax(0,8rem)_minmax(0,1fr)]"
                  items={[
                    {
                      key: "who",
                      label: t("who"),
                      value: open.actorName ?? t("system"),
                    },
                    {
                      key: "code",
                      label: t("action"),
                      value: <Code>{open.action}</Code>,
                    },
                    ...(open.targetId
                      ? [
                          {
                            key: "target",
                            label: t("target"),
                            value: (
                              <Code className="break-all">{open.targetId}</Code>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
                <section className="space-y-2">
                  <h3 className="font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                    {t("details")}
                  </h3>
                  <DefinitionList
                    className="grid-cols-[minmax(0,8rem)_minmax(0,1fr)] rounded-card border p-3"
                    items={Object.entries(open.details).map(([k, v]) => ({
                      key: k,
                      label: t.has(`detailKeys.${k}`) ? (
                        t(`detailKeys.${k}`)
                      ) : (
                        <span className="font-mono text-xs">{k}</span>
                      ),
                      value: show(v),
                    }))}
                  />
                </section>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
