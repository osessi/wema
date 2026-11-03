import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSpaces, SPACE_HREF } from "../lib/spaces";

export default async function Home() {
  const { keys, mine } = await getSpaces();
  // Une direction qui n'enseigne dans aucune classe arrive sur son école,
  // pas sur un espace prof vide.
  const first =
    keys.includes("school") && mine.teaching.length === 0 ? "school" : keys[0];
  if (first) redirect(SPACE_HREF[first]);
  const t = await getTranslations("shell.noSpace");
  return (
    <main className="grid min-h-svh place-items-center p-4">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
      </div>
    </main>
  );
}
