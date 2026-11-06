import { getRequestConfig } from "next-intl/server";
import agenda from "../../messages/fr/agenda.json";
import backOffice from "../../messages/fr/back-office.json";
import billing from "../../messages/fr/billing.json";
import family from "../../messages/fr/family.json";
import formats from "../../messages/fr/formats.json";
import guardian from "../../messages/fr/guardian.json";
import insights from "../../messages/fr/insights.json";
import learner from "../../messages/fr/learner.json";
import legal from "../../messages/fr/legal.json";
import messages from "../../messages/fr/messages.json";
import notifications from "../../messages/fr/notifications.json";
import school from "../../messages/fr/school.json";
import shell from "../../messages/fr/shell.json";
import teacher from "../../messages/fr/teacher.json";

// Une seule langue pour l'instant. Chaque espace a son fichier de messages
// (clé de premier niveau propre à l'espace) ; ajouter une langue ne demandera
// que ses fichiers.
export default getRequestConfig(async () => ({
  locale: "fr",
  messages: {
    ...backOffice,
    ...shell,
    ...learner,
    ...teacher,
    ...guardian,
    ...school,
    ...messages,
    ...formats,
    ...billing,
    ...legal,
    ...notifications,
    ...agenda,
    ...insights,
    ...family,
  },
  timeZone: "Europe/Paris",
}));
