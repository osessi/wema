import { CaretDown } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { ClosingCta } from "../../components/cta";
import { PageIntro } from "../../components/page-intro";
import { faq } from "../../lib/faq";
import { pageMetadata } from "../../lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Questions fréquentes",
  description:
    "Prix par matière, essai gratuit, matières et pays, réponses aux devoirs, besoins dys ou TDAH, données des enfants : les réponses à vos questions sur Wema.",
  path: "/questions-frequentes",
});

export default function FaqPage() {
  return (
    <>
      <PageIntro
        title="Questions fréquentes"
        lead="Ce que les familles, les profs et les écoles nous demandent le plus souvent."
      />
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <ul className="border-t border-line-strong">
          {faq.map((item) => (
            <li key={item.q} className="border-b border-line-strong">
              <details className="group">
                <summary className="flex cursor-pointer items-start justify-between gap-6 py-5 font-display text-lg font-semibold sm:text-xl">
                  <h2>{item.q}</h2>
                  <CaretDown
                    size={20}
                    aria-hidden="true"
                    className="mt-1 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <p className="max-w-prose pb-6 leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </section>
      <ClosingCta
        title="La meilleure réponse, c'est d'essayer."
        text="L'essai est gratuit, matière par matière, sans moyen de paiement."
      />
    </>
  );
}
