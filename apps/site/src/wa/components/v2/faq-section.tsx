import { ChatsCircleIcon } from '../../ui/icons';
import { cn } from '../../ui/lib/utils';
import { Fragment } from 'react';
import { contactHref } from '../../config/site';
import { faqLanding } from '../../content/faq-landing';
import { GlowIcon } from './glow-icon';
import { Frame, SectionHeading } from './primitives';
import { TsfLink } from './tsf/tsf-cta';

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
    <Frame className={cn('max-w-[440px]', className)}>
      <div className="flex flex-col gap-5 p-6 sm:p-7">
        <div className="flex items-center gap-4">
          <GlowIcon tone="ember" icon={ChatsCircleIcon} size={48} idle="breathe" />
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
          Votre situation est particulière ? Décrivez-la, nous vous répondons personnellement.
        </p>
        <TsfLink href={contactHref} className="self-start text-[16px] font-medium">
          Nous contacter
        </TsfLink>
      </div>
    </Frame>
  );
}

export function FaqSection() {
  return (
    <section
      id="faq"
      data-section="faq"
      aria-labelledby="faq-title"
      className="relative scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32"
    >
      <style>{faqStyles}</style>
      <div className="mx-auto grid w-full max-w-[1160px] gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="flex flex-col gap-10 lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            id="faq-title"
            eyebrow="Questions fréquentes"
            title={[
              <Fragment key="l1">
                Ce qu’on nous demande{' '}
                <span className="text-brand-active dark:text-brand">avant de commencer.</span>
              </Fragment>,
            ]}
            sub="Les réponses aux questions des parents, des élèves et des profs avant l’essai."
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
              {String(faqLanding.length).padStart(2, '0')}
            </span>
          </div>
          {faqLanding.map((item, index) => (
            <details
              key={item.question}
              name="faq"
              className="faq-item group border-b border-foreground/10 last:border-b-0"
            >
              <summary className="grid cursor-pointer list-none grid-cols-[28px_1fr_auto] items-start gap-3 px-5 py-6 text-left sm:grid-cols-[36px_1fr_auto] sm:gap-4 sm:px-8">
                <span className="pt-[5px] font-mono text-[12px] font-medium text-foreground/45 tabular-nums transition-colors group-open:text-brand-active sm:pt-[6px] dark:group-open:text-brand">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-[18px] leading-snug font-semibold tracking-[-0.015em] text-foreground sm:text-[20px]">
                  {item.question}
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
                  {item.answer}
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
