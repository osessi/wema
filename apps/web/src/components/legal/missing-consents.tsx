import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wema/ui/components/ui/alert";
import { getTranslations } from "next-intl/server";
import { serverApi } from "../../lib/api-server";

const SHOWN = 8;

/**
 * Espace école : comptes élèves créés par l'école sans consentement parental
 * enregistré (fiche 0008). Rien si tout est en ordre.
 */
export async function MissingConsents({
  organizationId,
}: {
  organizationId: string;
}) {
  const api = await serverApi();
  const res = await api.admin.privacy.organizations[":id"][
    "missing-consents"
  ].$get({ param: { id: organizationId } });
  if (!res.ok) return null;
  const body = await res.json();
  if (!("learners" in body) || body.learners.length === 0) return null;
  const { learners } = body;
  const t = await getTranslations("legal.school");
  const names = learners.slice(0, SHOWN).map((l) => l.displayName);
  return (
    <Alert>
      <AlertTitle>{t("missingTitle")}</AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{t("missingText", { count: learners.length })}</p>
        <p className="font-medium text-foreground">
          {names.join(", ")}
          {learners.length > SHOWN
            ? ` ${t("missingMore", { count: learners.length - SHOWN })}`
            : null}
        </p>
      </AlertDescription>
    </Alert>
  );
}
