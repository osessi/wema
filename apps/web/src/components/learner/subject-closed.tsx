import { LockSimple } from "@phosphor-icons/react/ssr";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wema/ui/components/ui/alert";
import { getTranslations } from "next-intl/server";

/** Matière non ouverte (ni abonnement, ni essai, ni contrat) : dit dès l'ouverture de la page. */
export async function SubjectClosed() {
  const t = await getTranslations("learner.subjectClosed");
  return (
    <Alert>
      <LockSimple aria-hidden />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>{t("body")}</AlertDescription>
    </Alert>
  );
}
