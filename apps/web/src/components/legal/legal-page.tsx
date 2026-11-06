import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { serverApi } from "../../lib/api-server";
import { LegalLinks } from "./legal-links";

export type LegalPageKey = "mentions" | "privacy" | "terms" | "cookies";

interface Section {
  title: string;
  paragraphs: string[];
}

const isSections = (v: unknown): v is Section[] =>
  Array.isArray(v) &&
  v.every(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      "title" in s &&
      typeof s.title === "string" &&
      "paragraphs" in s &&
      Array.isArray(s.paragraphs) &&
      s.paragraphs.every((p: unknown) => typeof p === "string"),
  );

/** Versions et durées en vigueur, lues sans session (repli si l'API ne répond pas). */
export async function legalInfo() {
  try {
    const api = await serverApi();
    const res = await api.legal.versions.$get();
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Page légale publique : avertissement « à valider », sections, liens. */
export async function LegalPage({
  page,
  version,
  children,
}: {
  page: LegalPageKey;
  version?: string | null | undefined;
  children?: ReactNode;
}) {
  const t = await getTranslations("legal");
  const tApp = await getTranslations("app");
  const raw = t.raw(`pages.${page}.sections`);
  const sections = isSections(raw) ? raw : [];
  return (
    <main className="min-h-svh bg-background px-4 py-10">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand font-display text-base font-extrabold text-ink-on-brand">
              W
            </span>
            <span className="font-display text-xl font-bold">
              {tApp("name")}
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("back")}
          </Link>
        </header>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold">
            {t(`pages.${page}.title`)}
          </h1>
          {version ? (
            <p className="text-sm text-muted-foreground">
              {t("version", { version })}
            </p>
          ) : null}
          <p className="text-muted-foreground">{t(`pages.${page}.intro`)}</p>
        </div>
        <Alert>
          <AlertDescription>{t("draft")}</AlertDescription>
        </Alert>
        {sections.map((s) => (
          <section key={s.title} className="space-y-3">
            <h2 className="font-display text-xl font-bold">{s.title}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}
        {children}
        <footer className="border-t pt-6">
          <LegalLinks />
        </footer>
      </article>
    </main>
  );
}
