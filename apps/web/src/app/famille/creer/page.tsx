import { redirect } from "next/navigation";

/** Ancienne adresse de la création de famille : le parcours guidé la reprend. */
export default function CreateFamilyPage() {
  redirect("/famille/demarrer?etape=famille");
}
