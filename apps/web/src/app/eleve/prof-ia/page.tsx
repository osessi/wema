import {
  ChatsCircle,
  Check,
  CircleNotch,
  Sparkle,
} from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { SubjectClosed } from "../../../components/learner/subject-closed";
import { TutorNewSession } from "../../../components/learner/tutor-new-session";
import { MODE_VISUALS } from "../../../components/learner/visuals";
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
  const exerciseLabels = new Map<string, string>();
  const exercises = variants.map((v) => ({
    id: v.id,
    label:
      titles.get(v.id) ??
      (v.statement.length > 70 ? `${v.statement.slice(0, 70)}…` : v.statement),
  }));
  for (const e of exercises) exerciseLabels.set(e.id, e.label);
  // Notion ou exercice demandé dans une matière non ouverte : dit dès l'ouverture.
  const askedNotion = first(query.notion);
  // Notion proposée hors du parcours de la classe (un devoir sur une notion
  // d'un autre niveau, par exemple) : on l'ajoute à la liste, sinon le
  // formulaire resterait vide et « Commencer » grisé.
  if (askedNotion && !notions.some((n) => n.id === askedNotion)) {
    const profile = await load(api.learner.profile.$get());
    const known = profile.notions.find((n) => n.notionId === askedNotion);
    if (known?.name)
      notions.push({
        id: known.notionId,
        label: known.subject ? `${known.name} · ${known.subject}` : known.name,
      });
  }
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

  // Historique regroupé par jour, le plus récent en haut.
  const dayKey = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "full" });
  const todayKey = dayKey(new Date().toISOString());
  const yesterdayKey = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  const days: { key: string; items: typeof sorted }[] = [];
  for (const s of sorted) {
    const key = dayKey(s.createdAt);
    const group = days.at(-1);
    if (group?.key === key) group.items.push(s);
    else days.push({ key, items: [s] });
  }
  const dayLabel = (key: string) =>
    key === todayKey
      ? t("tutor.today")
      : key === yesterdayKey
        ? t("tutor.yesterday")
        : key;

  return (
    <>
      <PageHeader
        title={t("tutor.title")}
        description={t("tutor.description")}
      />
      {closed && <SubjectClosed />}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card tone="rose">
          <CardHeader>
            <div className="flex items-center gap-3">
              <GlowTile tone="rose" size={36} idle="breathe">
                <Sparkle weight="fill" />
              </GlowTile>
              <CardTitle className="text-lg">{t("tutor.newSession")}</CardTitle>
            </div>
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
        <section className="min-w-0 space-y-4">
          <h2 className="flex items-center justify-between font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {t("tutor.sessions")}
            <span className="tabular-nums">{sorted.length}</span>
          </h2>
          {sorted.length === 0 ? (
            <EmptyState
              icon={<ChatsCircle weight="fill" />}
              tone="rose"
              title={t("tutor.noSessions")}
              description={t("tutor.noSessionsHint")}
            />
          ) : (
            <Card className="gap-5">
              <CardContent className="space-y-5">
                {days.map((day) => (
                  <div key={day.key} className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground first-letter:uppercase">
                      {dayLabel(day.key)}
                    </h3>
                    <ul className="divide-y overflow-hidden rounded-card border">
                      {day.items.map((s) => {
                        const { icon: Glyph, tone } = MODE_VISUALS[s.mode];
                        const subject =
                          (s.variantId
                            ? exerciseLabels.get(s.variantId)
                            : null) ??
                          (s.notionId ? notionNames.get(s.notionId) : null);
                        return (
                          <li key={s.id}>
                            <Link
                              href={`/eleve/prof-ia/${s.id}`}
                              className="group flex items-center gap-3 p-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                            >
                              <GlowTile tone={tone} size={36}>
                                <Glyph weight="fill" />
                              </GlowTile>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {t(`tutor.modes.${s.mode}`)}
                                </span>
                                <span className="block truncate text-sm text-muted-foreground">
                                  {subject ? `${subject} · ` : ""}
                                  <span className="tabular-nums">
                                    {format.dateTime(new Date(s.createdAt), {
                                      timeStyle: "short",
                                    })}
                                  </span>
                                </span>
                              </span>
                              <Badge
                                variant={
                                  s.status === "open" ? "info" : "neutral"
                                }
                              >
                                {s.status === "open" ? (
                                  <CircleNotch aria-hidden weight="bold" />
                                ) : (
                                  <Check aria-hidden weight="bold" />
                                )}
                                {s.status === "open"
                                  ? t("tutor.ongoing")
                                  : t("tutor.finished")}
                              </Badge>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
