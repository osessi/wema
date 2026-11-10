import { ArrowLeft, VideoCamera } from "@phosphor-icons/react/ssr";
import { PREFERENCES } from "@wema/domain";
import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LocalDateTime } from "../../../../components/agenda/local-time";
import { PageHeader } from "../../../../components/page-header";
import { tryLoad } from "../../../../components/school/try-load";
import { serverApi } from "../../../../lib/api-server";
import { hasPermission } from "../../../../lib/session";
import { DiagnosticSheetForm } from "./sheet-form";

/** Fiche de diagnostic d'un rendez-vous, remplie par le conseiller. */
export default async function DiagnosticSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await hasPermission("diagnostic.conduct"))) notFound();
  const { id } = await params;
  const t = await getTranslations("diagnostic.sheet");
  const api = await serverApi();
  const sheet = await tryLoad(
    api.diagnostic.advisor[":id"].$get({ param: { id } }),
  );
  if (!sheet) notFound();
  // Préférences du catalogue (hors centres d'intérêt, saisis à part).
  const preferences = Object.entries(PREFERENCES)
    .filter(([key]) => key !== "interest")
    .map(([key, statement]) => ({ key, statement }));
  return (
    <>
      <PageHeader
        title={t("title", { name: sheet.learnerName })}
        description={
          <span className="flex flex-wrap gap-x-2">
            <span>{t("subtitle")}</span>
            <LocalDateTime start={sheet.startsAt} end={sheet.endsAt} long />
            {sheet.guardianName ? (
              <span>· {t("guardian", { name: sheet.guardianName })}</span>
            ) : null}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {sheet.visioUrl ? (
              <Button asChild variant="outline">
                <a href={sheet.visioUrl} target="_blank" rel="noreferrer">
                  <VideoCamera aria-hidden />
                  {t("join")}
                </a>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href="/admin/diagnostic">
                <ArrowLeft aria-hidden />
                {t("back")}
              </Link>
            </Button>
          </div>
        }
      />
      <DiagnosticSheetForm sheet={sheet} preferences={preferences} />
    </>
  );
}
