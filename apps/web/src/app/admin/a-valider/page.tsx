import { BookOpenText, Exam, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card, CardShell } from "@wema/ui/components/ui/card";
import { Label } from "@wema/ui/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { Panel } from "../_ui/kit";
import { ValidateButton } from "./review-actions";

type Kind = "all" | "notions" | "exercises";
const KINDS: readonly Kind[] = ["all", "notions", "exercises"];

/** Écran unique « À valider » : notions et exercices en attente, tous pays confondus. */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ pays?: string; type?: string }>;
}) {
  if (!(await hasPermission("curriculum.write"))) notFound();
  const params = await searchParams;
  const kind: Kind = KINDS.find((k) => k === params.type) ?? "all";
  const countryId =
    params.pays && /^[0-9a-f-]{36}$/.test(params.pays)
      ? params.pays
      : undefined;
  const t = await getTranslations("reviewQueue");
  const api = await serverApi();
  const data = await load(
    api.admin.review.$get({ query: countryId ? { countryId } : {} }),
  );
  const showNotions = kind !== "exercises";
  const showExercises = kind !== "notions";
  const total =
    (showNotions ? data.total.notions : 0) +
    (showExercises ? data.total.exercises : 0);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Badge
            variant={total > 0 ? "warning" : "success"}
            className="tabular-nums"
            data-testid="review-count"
          >
            {t("count", { count: total })}
          </Badge>
        }
      />

      {/* Filtres : un simple formulaire GET, utilisable sans JavaScript. */}
      <CardShell>
        <form
          method="get"
          aria-label={t("filters")}
          className="flex flex-wrap items-end gap-3 rounded-card border bg-card p-4 shadow-xs"
        >
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="filtre-pays">{t("country")}</Label>
            <NativeSelect
              id="filtre-pays"
              name="pays"
              defaultValue={countryId ?? ""}
            >
              <NativeSelectOption value="">
                {t("allCountries")}
              </NativeSelectOption>
              {data.countries.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="filtre-type">{t("kind")}</Label>
            <NativeSelect id="filtre-type" name="type" defaultValue={kind}>
              <NativeSelectOption value="all">
                {t("allKinds")}
              </NativeSelectOption>
              <NativeSelectOption value="notions">
                {t("notions")}
              </NativeSelectOption>
              <NativeSelectOption value="exercises">
                {t("exercises")}
              </NativeSelectOption>
            </NativeSelect>
          </div>
          <Button type="submit" variant="outline">
            {t("filters")}
          </Button>
        </form>
      </CardShell>

      {total === 0 ? (
        <EmptyState
          icon={<SealCheck weight="fill" />}
          illustration="terrain"
          tone="mint"
          titleAs="h2"
          title={t("emptyTitle")}
          description={t("emptyText")}
        />
      ) : null}

      {showNotions && data.notions.length > 0 && (
        <Panel
          icon={<BookOpenText weight="fill" />}
          tone="sky"
          title={
            <span className="flex items-center gap-2">
              {t("notions")}
              <Badge variant="neutral" className="tabular-nums">
                {data.total.notions}
              </Badge>
            </span>
          }
          description={
            data.notions.length < data.total.notions
              ? `${t("notionsHint")} ${t("shown", { shown: data.notions.length, total: data.total.notions })}`
              : t("notionsHint")
          }
        >
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.notions.map((n) => (
              <li key={n.id} className="min-w-0">
                <Card variant="flat" className="h-full gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <SubjectIcon icon={n.subjectIcon} size={36} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium leading-snug">{n.name}</p>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {n.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-col gap-3">
                    <p className="flex min-w-0 flex-wrap gap-1.5">
                      <Badge variant="info">{n.countryName}</Badge>
                      <Badge variant="neutral">
                        {n.subjectName} · {n.gradeName}
                      </Badge>
                      <Badge variant="neutral">{n.unitName}</Badge>
                    </p>
                    <div className="flex justify-end gap-2 border-t pt-3">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/referentiel/${n.countryId}`}>
                          {t("open")}
                        </Link>
                      </Button>
                      <ValidateButton
                        label={`${t("verify")} : ${n.name}`}
                        target={{
                          kind: "notion",
                          id: n.id,
                          unitId: n.unitId,
                          code: n.code,
                          name: n.name,
                          description: n.description,
                          position: n.position,
                        }}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {showExercises && data.exercises.length > 0 && (
        <Panel
          icon={<Exam weight="fill" />}
          tone="amber"
          title={
            <span className="flex items-center gap-2">
              {t("exercises")}
              <Badge variant="neutral" className="tabular-nums">
                {data.total.exercises}
              </Badge>
            </span>
          }
          description={t("exercisesHint")}
        >
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.exercises.map((e) => (
              <li key={e.id} className="min-w-0">
                <Card variant="flat" className="h-full gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <SubjectIcon icon={e.subjectIcon} size={36} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium leading-snug">{e.objective}</p>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {e.statement}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-col gap-3">
                    <p className="flex min-w-0 flex-wrap gap-1.5">
                      <Badge variant="info">{e.countryName}</Badge>
                      <Badge variant="neutral">
                        {e.subjectName} · {e.notionName}
                      </Badge>
                      <Badge
                        variant={e.source === "ai" ? "warning" : "neutral"}
                      >
                        {t.has(`source.${e.source}`)
                          ? t(`source.${e.source}`)
                          : e.source}
                      </Badge>
                    </p>
                    <div className="flex justify-end border-t pt-3">
                      <ValidateButton
                        label={`${t("validate")} : ${e.objective}`}
                        target={{ kind: "exercise", id: e.id }}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
