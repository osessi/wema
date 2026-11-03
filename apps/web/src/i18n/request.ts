import { getRequestConfig } from "next-intl/server";
import backOffice from "../../messages/fr/back-office.json";
import guardian from "../../messages/fr/guardian.json";
import learner from "../../messages/fr/learner.json";
import messages from "../../messages/fr/messages.json";
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
  },
  timeZone: "Europe/Paris",
}));
