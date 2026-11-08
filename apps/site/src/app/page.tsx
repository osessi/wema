import { HeroChat } from "../components/home/hero-chat";
import { Method } from "../components/home/method";
import { Offer } from "../components/home/offer";
import { Parents } from "../components/home/parents";
import { Subjects } from "../components/home/subjects";
import { Teachers } from "../components/home/teachers";
import { ClosingSection } from "../wa/components/v2/closing-section";
import { FaqSection } from "../wa/components/v2/faq-section";
import { FilmSection } from "../wa/components/v2/film-section";
import { Hero } from "../wa/components/v2/hero";
import { GradientField } from "../wa/components/v2/hero/gradient-field";
import { SectionRail } from "../wa/components/v2/section-rail";

/** Fond de l'accroche : « 20 Colorful Smooth Gradient » (gradientshub.com, libre d'usage). */
const G = "/gradients/w20";

export default function HomePage() {
  return (
    <>
      <SectionRail />
      <Hero
        field={
          <>
            <GradientField
              src={`${G}-2400.webp`}
              srcSet={`${G}-1200.webp 1200w, ${G}-2400.webp 2400w`}
              softSrc={`${G}-600.webp`}
              headVeil="dark"
              footVeil="dark"
            />
            {/* Assombrit la bande claire du dégradé sous le texte et la conversation. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(12_9_2/0.1)_0%,rgb(12_9_2/0.38)_55%,rgb(12_9_2/0.55)_100%)]"
            />
          </>
        }
        aside={<HeroChat />}
      />
      <FilmSection />
      <Subjects />
      <Method />
      <Parents />
      <Teachers />
      <Offer />
      <FaqSection />
      <ClosingSection />
    </>
  );
}
