import { Badge } from "@wema/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { SubjectClosed } from "../../../components/learner/subject-closed";
import { TutorNewSession } from "../../../components/learner/tutor-new-session";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? null;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const t = await getTranslations("learner");
  const format = await getFormatter();
  const api = await serverApi();
  const [{ sessions }, { classes }, { variants }, { assignments }] =
    await Promise.all([
      load(api.learner.tutor.sessions.$get()),
      load(api.learner.path.$get()),
      load(api.learner.variants.$get()),
      load(api.learner.assignments.$get()),
    ]);

  const notionNames = new Map(
    classes.flatMap((k) => k.notions.map((n) => [n.notionId, n.name])),
  );
  const notions = classes.flatMap((k) =>
    k.notions.map((n) => ({ id: n.notionId, label: `${n.name} · ${k.name}` })),
  );
  const titles = new Map(
    assignments.flatMap((a) => (a.variantId ? [[a.variantId, a.title]] : [])),
  );
  const exercises = variants.map((v) => ({
    id: v.id,
    label:
      titles.get(v.id) ??
      (v.statement.length > 70 ? `${v.statement.slice(0, 70)}…` : v.statement),
  }));
  // Notion ou exercice demandé dans une matière non ouverte : dit dès l'ouverture.
  const askedNotion = first(query.notion);
  const askedVariant = first(query.variant);
  const closed =
    (askedVariant !== null &&
      variants.find((v) => v.id === askedVariant)?.open === false) ||
    (askedNotion !== null &&
      classes.some(
        (k) => !k.open && k.notions.some((n) => n.notionId === askedNotion),
      ));
  const sorted = [...sessions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <>
      <PageHeader
        title={t("tutor.title")}
        description={t("tutor.description")}
      />
      {closed && <SubjectClosed />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">
              {t("tutor.newSession")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TutorNewSession
              notions={notions}
              exercises={exercises}
              initialMode={first(query.mode)}
              initialNotion={first(query.notion)}
              initialVariant={first(query.variant)}
            />
          </CardContent>
        </Card>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">
            {t("tutor.sessions")}
          </h2>
          {sorted.length === 0 ? (
            <p className="text-muted-foreground">{t("tutor.noSessions")}</p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/eleve/prof-ia/${s.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 hover:bg-muted"
                  >
                    <span className="space-y-0.5">
                      <span className="block font-medium">
                        {t(`tutor.modes.${s.mode}`)}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {s.notionId && notionNames.get(s.notionId)
                          ? `${notionNames.get(s.notionId)} · `
                          : ""}
                        {t("tutor.startedOn", {
                          date: format.dateTime(new Date(s.createdAt), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }),
                        })}
                      </span>
                    </span>
                    <Badge
                      variant={s.status === "open" ? "outline" : "secondary"}
                    >
                      {s.status === "open"
                        ? t("tutor.ongoing")
                        : t("tutor.finished")}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
