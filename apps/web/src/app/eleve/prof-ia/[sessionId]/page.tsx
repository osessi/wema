import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TutorChat } from "../../../../components/learner/tutor-chat";
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
  const [{ session, messages }, { classes }] = await Promise.all([
    load(Promise.resolve(res)),
    load(api.learner.path.$get()),
  ]);
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
