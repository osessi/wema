import { getRequestConfig } from "next-intl/server";
import messages from "../../messages/fr.json";

// Une seule langue pour l'instant ; tous les textes passent déjà par les
// traductions, ajouter une langue ne demandera que ses fichiers de messages.
export default getRequestConfig(async () => ({
  locale: "fr",
  messages,
  timeZone: "Europe/Paris",
}));
