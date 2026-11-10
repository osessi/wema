import type { Metadata } from "next";
import { ContactAside } from "../../components/contact/contact-aside";
import { ContactForm } from "../../components/contact/contact-form";
import { pageMetadata } from "../../lib/metadata";
import { Frame } from "../../wa/components/v2/primitives";
import { TsfEyebrow } from "../../wa/components/v2/tsf/tsf-eyebrow";
import { TsfTitle } from "../../wa/components/v2/tsf/tsf-title";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Une question sur Wema, l'essai, les matières, les besoins de votre enfant, ou un projet pour vos élèves ou votre école ? Écrivez à l'équipe : une personne vous répond.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <section
      aria-labelledby="contact-title"
      className="relative px-5 pt-32 pb-24 sm:px-8 sm:pt-40 sm:pb-32"
    >
      <div className="mx-auto grid w-full max-w-[1200px] items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,580px)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10">
        <div className="flex flex-col items-start gap-5 lg:col-start-1 lg:row-start-1">
          <TsfEyebrow phrases={["Contact"]} />
          <TsfTitle
            as="h1"
            id="contact-title"
            lines={[
              "Une question ?",
              <span key="accent" className="text-brand-active dark:text-brand">
                Écrivez à l’équipe.
              </span>,
            ]}
            className="max-w-[640px] text-balance text-[40px] leading-[1.04] text-foreground sm:text-[56px] lg:text-[64px]"
          />
          <p className="max-w-[520px] text-pretty text-[17px] leading-relaxed font-medium text-foreground/75 sm:text-[19px]">
            Parent, élève, prof ou école : dites-nous où vous en êtes et ce que
            vous cherchez. Une personne de l’équipe lit votre message et vous
            répond.
          </p>
        </div>

        <Frame className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-col gap-1.5 border-b border-foreground/10 px-6 py-6 sm:px-8">
            <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
              Formulaire de contact
            </span>
            <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.015em] text-foreground">
              Votre message
            </h2>
          </div>
          <div className="px-6 py-7 sm:px-8 sm:py-8">
            <ContactForm />
          </div>
        </Frame>

        <div className="lg:col-start-1 lg:row-start-2">
          <ContactAside />
        </div>
      </div>
    </section>
  );
}
