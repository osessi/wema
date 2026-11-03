import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";

/**
 * Confirmation après un clic sur « Ne plus recevoir » : la désinscription est
 * déjà faite par l'API (lien signé). Page ouverte sans session.
 */
export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const t = await getTranslations("notifications.unsubscribed");
  const kind =
    query.sorte === "nudge" || query.sorte === "message" ? query.sorte : null;
  return (
    <>
      <PageHeader
        title={kind ? t("title") : t("errorTitle")}
        description={kind ? t(kind) : t("error")}
      />
      <div>
        <Button asChild>
          <Link href="/compte/notifications">{t("manage")}</Link>
        </Button>
      </div>
    </>
  );
}
