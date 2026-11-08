import { Plus } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { faq } from "../../lib/faq";
import { appLinks } from "../../lib/site";
import { Frame, SectionHead, SlantButton } from "../kit";

/** Les questions qui décident d'un essai ; le reste est sur la page dédiée. */
const PICKED = [0, 1, 2, 3, 7, 8, 9];

export function Questions() {
  const items = PICKED.flatMap((i) => (faq[i] ? [faq[i]] : []));
  return (
    <section id="questions" className="relative px-4 py-24 sm:py-32">
      <SectionHead
        eyebrow="Questions"
        lead="Ce qu'on nous demande"
        follow="avant de commencer."
      />
      <ul className="mx-auto mt-12 max-w-3xl space-y-2">
        {items.map((item) => (
          <li key={item.q}>
            <Frame cut={12} className="bg-surface">
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-6 px-5 py-4 text-[16.5px] font-semibold sm:px-6 sm:py-5">
                  <h3>{item.q}</h3>
                  <span className="grid size-7 shrink-0 place-items-center border border-line bg-paper transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none">
                    <Plus size={14} weight="bold" aria-hidden="true" />
                  </span>
                </summary>
                <p className="max-w-[64ch] px-5 pb-6 text-[15.5px] leading-relaxed text-ink-muted sm:px-6">
                  {item.a}
                </p>
              </details>
            </Frame>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center">
        <Link
          href="/questions-frequentes"
          className="text-[15px] font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          Toutes les questions
        </Link>
      </p>
    </section>
  );
}

export function Closing() {
  return (
    <section className="on-dark relative px-2 pb-2 sm:px-3">
      <Frame
        cut={22}
        edge="rgb(255 255 255 / 0.12)"
        className="hero-field isolate overflow-hidden rounded-[20px] text-white"
      >
        <div aria-hidden="true" className="hero-grid absolute inset-0" />
        <div className="relative flex flex-col items-center px-5 py-24 text-center sm:py-32">
          <SectionHead
            tone="dark"
            eyebrow="Commencer"
            lead="Essayez Wema dans la matière"
            follow="qui pose problème."
            text="Le premier entretien est offert. L'essai ne demande aucun moyen de paiement."
          />
          <div className="mt-10 flex flex-col items-center gap-5">
            <SlantButton href={appLinks.signup}>
              Commencer l'essai gratuit
            </SlantButton>
            <a
              href={appLinks.login}
              className="font-mono text-[12px] text-white/70 uppercase underline decoration-white/30 underline-offset-4 hover:text-white"
            >
              J'ai déjà un compte
            </a>
          </div>
        </div>
      </Frame>
    </section>
  );
}
