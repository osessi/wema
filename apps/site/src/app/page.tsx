import {
  Calculator,
  Globe,
  LockKey,
  Question,
} from "@phosphor-icons/react/ssr";
import { Closing, Questions } from "../components/home/closing";
import { Hero } from "../components/home/hero";
import { Method } from "../components/home/method";
import { Offer } from "../components/home/offer";
import { Parents } from "../components/home/parents";
import { SectionRail } from "../components/home/section-rail";
import { Subjects } from "../components/home/subjects";
import { Teachers } from "../components/home/teachers";

/** Ce qui ne change pas d'un élève à l'autre : quatre engagements. */
const PROMISES = [
  {
    icon: Question,
    title: "Jamais la réponse",
    text: "Il questionne et donne des indices",
  },
  {
    icon: Calculator,
    title: "Calculs vérifiés",
    text: "Par un moteur de calcul, pas par l'IA",
  },
  {
    icon: Globe,
    title: "Programmes officiels",
    text: "France et Bénin, d'autres pays suivent",
  },
  {
    icon: LockKey,
    title: "Données protégées",
    text: "Exportables et supprimables à tout moment",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <SectionRail />
      <Hero />
      <ul className="mx-auto grid max-w-6xl grid-cols-2 border-x border-b border-line lg:grid-cols-4">
        {PROMISES.map((p, i) => {
          const PromiseIcon = p.icon;
          return (
            <li
              key={p.title}
              className={`flex items-start gap-3 border-line px-4 py-5 sm:px-6 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
            >
              <PromiseIcon
                size={20}
                weight="duotone"
                className="mt-0.5 shrink-0 text-brand-ink"
                aria-hidden="true"
              />
              <span>
                <span className="block text-[14.5px] font-semibold">
                  {p.title}
                </span>
                <span className="block text-[13.5px] leading-snug text-ink-muted">
                  {p.text}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <Subjects />
      <Method />
      <Parents />
      <Teachers />
      <Offer />
      <Questions />
      <Closing />
    </>
  );
}
