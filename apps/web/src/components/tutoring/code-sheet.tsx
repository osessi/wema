"use client";

import { Printer } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface SheetLearner {
  userId: string;
  displayName: string;
  className: string | null;
  username: string;
  code: string;
  parent: { login: string; kind: "email" | "username"; code: string } | null;
  /** Parent déjà inscrit : rattaché (`linked`) ou non créé (`not_created`). */
  parentNotice?: "linked" | "not_created" | null;
}

/**
 * Fiche des codes à imprimer : un coupon par élève (et par parent créé). Les
 * codes ne sont connus que du navigateur, juste après l'import ; à
 * l'impression, seule la copie placée sous <body> sort (le reste est masqué),
 * sur autant de pages qu'il faut.
 */
export function CodeSheet({ learners }: { learners: SheetLearner[] }) {
  const t = useTranslations("tutoring.sheet");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setBody(document.body);
    setUrl(
      `${window.location.origin}${process.env.WEMA_BASE_PATH ?? ""}/connexion`,
    );
  }, []);
  const date = new Date().toLocaleDateString("fr-FR");
  // Un parent de plusieurs enfants n'a qu'un coupon.
  const parents = new Map<
    string,
    { names: string[]; login: string; code: string }
  >();
  for (const l of learners)
    if (l.parent) {
      const p = parents.get(l.parent.login);
      if (p) p.names.push(l.displayName);
      else
        parents.set(l.parent.login, {
          names: [l.displayName],
          login: l.parent.login,
          code: l.parent.code,
        });
    }

  const coupons = (
    <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 print:grid-cols-2">
      {learners.map((l) => (
        <li
          key={l.userId}
          className="space-y-2 rounded-card border border-dashed bg-card p-4 text-sm print:rounded-none print:border-black"
        >
          <p className="font-semibold">{l.displayName}</p>
          {l.className ? (
            <p className="text-muted-foreground print:text-black">
              {t("class")} : {l.className}
            </p>
          ) : null}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground print:text-black">
              {t("username")}
            </dt>
            <dd className="font-mono font-medium">{l.username}</dd>
            <dt className="text-muted-foreground print:text-black">
              {t("code")}
            </dt>
            <dd className="font-mono text-base font-semibold tracking-widest">
              {l.code}
            </dd>
          </dl>
          {url ? (
            <p className="text-xs text-muted-foreground print:text-black">
              {t("where", { url })}
            </p>
          ) : null}
          {l.parentNotice ? (
            <p className="text-xs text-muted-foreground print:hidden">
              {t(
                l.parentNotice === "linked"
                  ? "parentLinked"
                  : "parentNotCreated",
              )}
            </p>
          ) : null}
        </li>
      ))}
      {[...parents.values()].map((p) => (
        <li
          key={p.login}
          className="space-y-2 rounded-card border border-dashed bg-muted/40 p-4 text-sm print:rounded-none print:border-black"
        >
          <p className="font-semibold">
            {t("parentOf", { name: p.names.join(", ") })}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground print:text-black">
              {t("login")}
            </dt>
            <dd className="font-mono font-medium break-all">{p.login}</dd>
            <dt className="text-muted-foreground print:text-black">
              {t("code")}
            </dt>
            <dd className="font-mono text-base font-semibold tracking-widest">
              {p.code}
            </dd>
          </dl>
          {url ? (
            <p className="text-xs text-muted-foreground print:text-black">
              {t("whereParent", { url })}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );

  return (
    <section className="space-y-4" aria-labelledby="code-sheet-title">
      <style>{`#code-sheet-print { display: none; }
      @media print {
        body > :not(#code-sheet-print) { display: none !important; }
        #code-sheet-print { display: block !important; background: #fff; color: #000; padding: 0; }
        #code-sheet-print li { break-inside: avoid; }
      }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="code-sheet-title" className="text-base font-semibold">
          {t("title")} · {t("count", { count: learners.length })}
        </h3>
        <Button type="button" variant="brand" onClick={() => window.print()}>
          <Printer aria-hidden />
          {t("print")}
        </Button>
      </div>
      <Alert variant="warning">
        <AlertDescription>{t("body")}</AlertDescription>
      </Alert>
      {body
        ? createPortal(
            <div id="code-sheet-print" className="space-y-3">
              <p className="text-sm">{t("heading", { date })}</p>
              {coupons}
            </div>,
            body,
          )
        : null}
      <div id="code-sheet">{coupons}</div>
    </section>
  );
}
