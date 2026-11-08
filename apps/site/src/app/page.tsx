import { Commitments } from "../components/home/commitments";
import { Compare } from "../components/home/compare";
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

/** Fond de l'accroche : « 19 Colorful Fractal Backgrounds » (gradientshub.com, libre d'usage). */
const G = "/gradients/w19";

export default function HomePage() {
  return (
    <>
      <SectionRail />
      <Hero
        field={
          <GradientField
            src={`${G}-2400.webp`}
            srcSet={`${G}-1200.webp 1200w, ${G}-2400.webp 2400w`}
            softSrc={`${G}-600.webp`}
            headVeil="none"
            footVeil="none"
          />
        }
        headInk="dark"
        footInk="dark"
        aside={<HeroChat />}
      />
      <FilmSection />
      <Commitments />
      <Subjects />
      <Method />
      <Compare />
      <Parents />
      <Teachers />
      <Offer />
      <FaqSection />
      <ClosingSection />
    </>
  );
}
