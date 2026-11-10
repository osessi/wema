import { faq, faqThemes } from "../../lib/faq";
import { GlowIcon } from "../../wa/components/v2/glow-icon";
import { Frame } from "../../wa/components/v2/primitives";
import { TsfLink } from "../../wa/components/v2/tsf/tsf-cta";
import { ChatsCircleIcon } from "../../wa/ui/icons";
import { cn } from "../../wa/ui/lib/utils";

/** Accordéon repris de `wa/components/v2/faq-section.tsx`. */
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
.faq-item summary:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) {
  .faq-item::details-content, .faq-answer { transition: none; }
}
`;

const pad = (n: number) => String(n).padStart(2, "0");

export const faqGroups = faqThemes.map((theme) => ({
  ...theme,
  items: faq.filter((item) => item.theme === theme.id),
}));

export function ContactCard({ className }: { readonly className?: string }) {
  return (
    <Frame className={cn("w-full max-w-[440px]", className)}>
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
          Votre situation ne rentre dans aucune case ? Décrivez-la : une
          personne de l’équipe vous répond.
        </p>
        <TsfLink href="/contact" className="self-start text-[16px] font-medium">
          Nous contacter
        </TsfLink>
      </div>
    </Frame>
  );
}

/** Navigation par thème : de simples ancres vers les groupes de questions. */
function ThemeIndex() {
  return (
    <nav aria-label="Thèmes des questions" className="w-full">
      <p className="mb-3 font-mono text-[12px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
        Par thème
      </p>
      <ol className="grid border-t border-foreground/10">
        {faqGroups.map((group, index) => (
          <li key={group.id} className="border-b border-foreground/10">
            <a
              href={`#${group.id}`}
              className="group flex items-center gap-4 py-3.5 text-[16px] font-medium text-foreground/85 transition-colors hover:text-foreground focus-visible:text-foreground"
            >
              <span className="font-mono text-[12px] text-foreground/45 tabular-nums transition-colors group-hover:text-brand-active dark:group-hover:text-brand">
                {pad(index + 1)}
              </span>
              <span className="flex-1">{group.label}</span>
              <span className="font-mono text-[12px] text-foreground/45 tabular-nums">
                {pad(group.items.length)}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function FaqThemes() {
  return (
    <section
      aria-label="Toutes les questions"
      className="relative px-5 pt-14 pb-20 sm:px-8 sm:pt-20 sm:pb-28"
    >
      <style>{faqStyles}</style>
      <div className="mx-auto grid w-full max-w-[1160px] gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
        <div className="hidden flex-col gap-10 lg:sticky lg:top-28 lg:flex lg:self-start">
          <ThemeIndex />
          <ContactCard />
        </div>

        <div className="flex flex-col gap-10">
          {faqGroups.map((group, groupIndex) => (
            <section
              key={group.id}
              id={group.id}
              aria-labelledby={`${group.id}-title`}
              className="scroll-mt-28"
            >
              <Frame>
                <div className="flex items-center justify-between gap-4 border-b border-foreground/10 px-5 py-4 sm:px-8">
                  <h2
                    id={`${group.id}-title`}
                    className="flex items-baseline gap-3 text-[15px] font-semibold tracking-[-0.01em] text-foreground sm:text-[16px]"
                  >
                    <span className="font-mono text-[12px] font-medium text-brand-active tabular-nums dark:text-brand">
                      {pad(groupIndex + 1)}
                    </span>
                    {group.label}
                  </h2>
                  <span className="font-mono text-[12px] font-medium text-foreground/60 tabular-nums">
                    {pad(group.items.length)}{" "}
                    <span className="sr-only">questions</span>
                  </span>
                </div>
                {group.items.map((item, index) => (
                  <details
                    key={item.q}
                    name={`faq-${group.id}`}
                    className="faq-item group border-b border-foreground/10 last:border-b-0"
                  >
                    <summary className="grid cursor-pointer list-none grid-cols-[28px_1fr_auto] items-start gap-3 px-5 py-6 text-left sm:grid-cols-[36px_1fr_auto] sm:gap-4 sm:px-8">
                      <span className="pt-[5px] font-mono text-[12px] font-medium text-foreground/45 tabular-nums transition-colors group-open:text-brand-active sm:pt-[6px] dark:group-open:text-brand">
                        {pad(index + 1)}
                      </span>
                      <h3 className="text-[18px] leading-snug font-semibold tracking-[-0.015em] text-foreground sm:text-[20px]">
                        {item.q}
                      </h3>
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
            </section>
          ))}
          <ContactCard className="lg:hidden" />
        </div>
      </div>
    </section>
  );
}
