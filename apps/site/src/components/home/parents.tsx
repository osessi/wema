import { SectionHeading } from "../../wa/components/v2/primitives";
import { TsfLink } from "../../wa/components/v2/tsf/tsf-cta";
import { ParentsPanel } from "./parents-panel";

export function Parents() {
  return (
    <section
      id="parents"
      aria-labelledby="parents-title"
      className="relative scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-14 sm:gap-16">
        <SectionHeading
          id="parents-title"
          eyebrow="Pour les parents"
          title={[
            "Vous voyez ses progrès,",
            <span key="l2" className="text-brand-active dark:text-brand">
              pas seulement ses notes.
            </span>,
          ]}
          sub="Chaque semaine, vous savez ce qu'il a travaillé, ce qu'il a compris et ce qui coince encore. Avec les preuves, pas des impressions."
        />
        <ParentsPanel />
        <p className="text-center text-[16px] font-medium text-foreground/70">
          Tout ce que voit le parent, et comment il le règle :{" "}
          <TsfLink href="/familles" className="font-medium">
            la page familles
          </TsfLink>
        </p>
      </div>
    </section>
  );
}
