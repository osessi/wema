import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MathText } from "../../../../components/learner/math";
import { TutorChat } from "../../../../components/learner/tutor-chat";
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
    <Button asChild variant="ghost" size="sm" className="w-fit">
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
        <p className="text-muted-foreground">{t("errors.not_found")}</p>
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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {back}
      <PageHeader
        title={t(`tutor.modes.${session.mode}`)}
        description={notionName}
      />
      {variant && (
        <section className="space-y-1 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("tutor.statement")}
          </h2>
          <p className="leading-relaxed">
            <MathText text={variant.statement} rendered={variant.rendered} />
          </p>
          <div className="-ml-2">
            <ListenButton
              text={variant.statement}
              label={t("voice.listenStatement")}
            />
          </div>
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
        }))}
      />
    </div>
  );
}
