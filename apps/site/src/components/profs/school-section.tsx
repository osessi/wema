import { SectionHeading } from "../../wa/components/v2/primitives";
import { TsfCta, TsfLink } from "../../wa/components/v2/tsf/tsf-cta";
import { contactHref } from "../../wa/config/site";
import { SchoolPanel } from "./school-panel";

export function SchoolSection() {
  return (
    <section
      id="ecoles"
      data-section="control"
      aria-labelledby="ecoles-title"
      className="relative scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-14 sm:gap-16">
        <SectionHeading
          id="ecoles-title"
          eyebrow="Écoles et réseaux"
          title={[
            "Vos classes, vos profs, vos règles.",
            <span key="l2" className="text-brand-active dark:text-brand">
              Un seul contrat.
            </span>,
          ]}
          sub="Vous créez les classes, inscrivez vos profs, importez la liste de vos élèves depuis un fichier, et décidez qui voit quoi. Vos élèves ont accès à toutes les matières sans abonnement individuel : l'équipe Wema établit avec vous un contrat sur mesure."
        />
        <SchoolPanel />
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
          <TsfCta href={contactHref} tone="accent" className="h-14 px-7">
            Parler à l'équipe
          </TsfCta>
          <TsfLink href="#questions" className="text-[16px] font-medium">
            Lire les questions fréquentes
          </TsfLink>
        </div>
      </div>
    </section>
  );
}
