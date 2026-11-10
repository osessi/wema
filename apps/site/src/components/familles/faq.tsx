import { faq } from "../../lib/faq";
import { GlowIcon } from "../../wa/components/v2/glow-icon";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import { TsfLink } from "../../wa/components/v2/tsf/tsf-cta";
import { contactHref } from "../../wa/config/site";
import { ChatsCircleIcon } from "../../wa/ui/icons";
import { cn } from "../../wa/ui/lib/utils";

/** Les questions de `lib/faq.ts` qui concernent les parents, dans l'ordre d'un parent. */
const PARENT_QUESTIONS = [
  "Le prof IA fait-il les devoirs à la place de mon enfant ?",
  "Mon enfant a un trouble dys ou un TDAH. Wema peut-il en tenir compte ?",
  "Combien coûte Wema ?",
  "L'essai gratuit m'engage-t-il ?",
  "Comment résilier ?",
  "Quelles matières sont proposées ?",
  "Dans quels pays Wema fonctionne-t-il ?",
  "Qui peut voir les données de mon enfant ?",
  "Peut-on suivre des séances en visio ?",
] as const;

const items = PARENT_QUESTIONS.flatMap((q) => {
  const found = faq.find((item) => item.q === q);
  return found === undefined ? [] : [found];
});

const faqStyles = `
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item { interpolate-size: allow-keywords; }
.faq-item::details-content {
  height: 0;
  overflow: clip;
  transition: height 0.45s var(--tk-ease, ease), content-visibility 0.45s allow-discrete;
}
.faq-item[open]::details-content { height: auto; }
.faq-answer { opacity: 0; transform: translateY(-6px); transition: opacity 0.4s ease 0.05s, transform 0.45s var(--tk-ease, ease); }
.faq-item[open] .faq-answer { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .faq-item::details-content, .faq-answer { transition: none; }
}
`;

function ContactCard({ className }: { readonly className: string }) {
  return (
    <Frame className={cn("max-w-[440px]", className)}>
      <div className="flex flex-col gap-5 p-6 sm:p-7">
        <div className="flex items-center gap-4">
          <GlowIcon
            tone="ember"
            icon={ChatsCircleIcon}
            size={48}
            idle="breathe"
          />
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
              Une autre question ?
            </span>
            <span className="text-[19px] leading-tight font-semibold tracking-[-0.015em] text-foreground">
              Écrivez-nous.
            </span>
          </div>
        </div>
        <p className="text-[16px] leading-relaxed text-foreground/75">
          La situation de votre enfant est particulière ? Décrivez-la, nous vous
          répondons personnellement.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <TsfLink href={contactHref} className="text-[16px] font-medium">
            Nous contacter
          </TsfLink>
          <TsfLink
            href="/questions-frequentes"
            className="text-[16px] font-medium"
          >
            Toutes les questions
          </TsfLink>
        </div>
      </div>
    </Frame>
  );
}

export function FamilyFaq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="relative scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32"
    >
      <style>{faqStyles}</style>
      <div className="mx-auto grid w-full max-w-[1160px] gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="flex flex-col gap-10 lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            id="faq-title"
            eyebrow="Questions de parents"
            title={[
              "Ce que les parents",
              <span key="l2" className="text-brand-active dark:text-brand">
                nous demandent.
              </span>,
            ]}
            sub="Triche, besoins particuliers, prix, données : les réponses avant de lancer l'essai."
            align="left"
          />
          <ContactCard className="hidden lg:block" />
        </div>

        <Frame>
          <div className="flex items-center justify-between gap-4 border-b border-foreground/10 px-5 py-4 sm:px-8">
            <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
              Questions
            </span>
            <span className="font-mono text-[12px] font-medium text-foreground/60 tabular-nums">
              {String(items.length).padStart(2, "0")}
            </span>
          </div>
          {items.map((item, index) => (
            <details
              key={item.q}
              name="faq-familles"
              className="faq-item group border-b border-foreground/10 last:border-b-0"
            >
              <summary className="grid cursor-pointer list-none grid-cols-[28px_1fr_auto] items-start gap-3 px-5 py-6 text-left outline-none focus-visible:bg-foreground/[0.04] focus-visible:shadow-[inset_0_0_0_2px_var(--brand)] sm:grid-cols-[36px_1fr_auto] sm:gap-4 sm:px-8">
                <span className="pt-[5px] font-mono text-[12px] font-medium text-foreground/45 tabular-nums transition-colors group-open:text-brand-active sm:pt-[6px] dark:group-open:text-brand">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[18px] leading-snug font-semibold tracking-[-0.015em] text-foreground sm:text-[20px]">
                  {item.q}
                </span>
                <span
                  aria-hidden="true"
                  className="relative flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-foreground/15 text-foreground transition-colors duration-300 group-hover:border-foreground/40 group-open:border-brand group-open:bg-brand group-open:text-[var(--on-brand)]"
                >
                  <span className="absolute h-[2px] w-3 rounded-full bg-current" />
                  <span className="absolute h-3 w-[2px] rounded-full bg-current transition-[transform,opacity] duration-300 group-open:rotate-90 group-open:opacity-0" />
                </span>
              </summary>
              <div className="faq-answer pr-5 pb-7 pl-[60px] sm:pr-20 sm:pl-[84px]">
                <p className="max-w-[600px] text-[17px] leading-relaxed text-foreground/80">
                  {item.a}
                </p>
              </div>
            </details>
          ))}
        </Frame>
        <ContactCard className="lg:hidden" />
      </div>
    </section>
  );
}
