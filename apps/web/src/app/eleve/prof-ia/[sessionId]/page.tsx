import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MathText } from "../../../../components/learner/math";
import { SubjectClosed } from "../../../../components/learner/subject-closed";
import { TutorChat } from "../../../../components/learner/tutor-chat";
import { MODE_VISUALS } from "../../../../components/learner/visuals";
import { ListenButton } from "../../../../components/learner/voice/listen-button";
import { PageHeader } from "../../../../components/page-header";
import { load, serverApi } from "../../../../lib/api-server";

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const t = await getTranslations("learner");
  const api = await serverApi();
  const res = await api.learner.tutor.sessions[":id"].$get({
    param: { id: sessionId },
  });
  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
      <Link href="/eleve/prof-ia">
        <ArrowLeft />
        {t("common.back")}
      </Link>
    </Button>
  );
  if (res.status === 404 || res.status === 400)
    return (
      <>
        {back}
        <EmptyState
          icon={<MagnifyingGlass weight="bold" />}
          title={t("errors.not_found")}
          titleAs="h2"
          action={
            <Button asChild>
              <Link href="/eleve/prof-ia">{t("tutor.chat.newSession")}</Link>
            </Button>
          }
        />
      </>
    );
  const [{ session, messages }, { classes }, { variants }] = await Promise.all([
    load(Promise.resolve(res)),
    load(api.learner.path.$get()),
    load(api.learner.variants.$get()),
  ]);
  // Aide sur un exercice, vérification orale : l'énoncé reste sous les yeux (et peut être écouté).
  const variant = session.variantId
    ? variants.find((v) => v.id === session.variantId)
    : undefined;
  const notionName = classes
    .flatMap((k) => k.notions)
    .find((n) => n.notionId === session.notionId)?.name;
  // Matière non ouverte : dit dès l'ouverture, pas au premier message.
  const closed =
    variant?.open === false ||
    classes.some(
      (k) => !k.open && k.notions.some((n) => n.notionId === session.notionId),
    );

  const ModeIcon = MODE_VISUALS[session.mode].icon;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {back}
      <PageHeader
        title={t(`tutor.modes.${session.mode}`)}
        description={notionName}
        actions={
          <GlowTile
            tone={MODE_VISUALS[session.mode].tone}
            size={48}
            idle={session.status === "open" ? "breathe" : "none"}
            className="hidden sm:inline-grid"
          >
            <ModeIcon weight="fill" />
          </GlowTile>
        }
      />
      {closed && session.mode !== "intake" && <SubjectClosed />}
      {variant && (
        <section className="space-y-2 rounded-card border bg-surface p-4 shadow-xs">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {t("tutor.statement")}
            </h2>
            <ListenButton
              text={variant.statement}
              label={t("voice.listenStatement")}
            />
          </div>
          <p className="text-lg leading-relaxed">
            <MathText text={variant.statement} rendered={variant.rendered} />
          </p>
        </section>
      )}
      <TutorChat
        sessionId={session.id}
        mode={session.mode}
        open={session.status === "open"}
        hintLevel={session.hintLevel}
        variantId={session.variantId}
        initialMessages={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          guarded: m.guarded,
          createdAt: m.createdAt,
        }))}
      />
    </div>
  );
}
