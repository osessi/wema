import {
  Buildings,
  ChalkboardTeacher,
  CheckSquare,
  Square,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { appLinks } from "../../lib/site";
import { cx, Frame, GlowTile, Mono, SectionHead } from "../kit";
import { Figure } from "./figures";

const BANK = [
  {
    title: "Résoudre une équation du 1er degré",
    level: "Facile",
    picked: true,
  },
  { title: "Mettre un problème en équation", level: "Moyen", picked: true },
  { title: "Équation avec parenthèses", level: "Moyen", picked: false },
  { title: "Problème de partage", level: "Difficile", picked: true },
] as const;

const LEARNERS = [
  { name: "Élève A", how: "Lecture facile" },
  { name: "Élève B", how: "Indices renforcés" },
  { name: "Élève C", how: "Niveau +1" },
  { name: "Élève D", how: "Schéma" },
] as const;

export function Teachers() {
  return (
    <section id="profs" className="relative px-4 py-24 sm:py-32">
      <SectionHead
        eyebrow="Profs et écoles"
        lead="Vous choisissez les exercices,"
        follow="Wema les adapte à chacun."
        text="Chaque semaine, Wema vous propose une banque d'exercices sur le programme de la classe. Vous sélectionnez, ou vous déposez les vôtres. Le prof IA les décline pour chaque élève et vous montre où il en est."
      />

      <div className="mx-auto mt-14 grid max-w-6xl gap-4 lg:grid-cols-[1.25fr_1fr] [&>*]:min-w-0">
        <Frame cut={18} className="bg-surface p-4 sm:p-6">
          <Figure
            label="Fig. 06 · Banque de la semaine · 4e A"
            status="3 choisis"
          >
            <ul className="space-y-2">
              {BANK.map((ex) => (
                <li
                  key={ex.title}
                  className={cx(
                    "flex items-center gap-3 border px-3 py-2.5 text-[14px]",
                    ex.picked
                      ? "border-ink bg-surface"
                      : "border-line bg-paper text-ink-muted",
                  )}
                >
                  {ex.picked ? (
                    <CheckSquare size={18} weight="fill" aria-label="Choisi" />
                  ) : (
                    <Square size={18} aria-label="Non choisi" />
                  )}
                  <span className="flex-1">{ex.title}</span>
                  <Mono className="text-ink-muted uppercase">{ex.level}</Mono>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-dashed border-line-strong pt-4">
              <Mono className="text-ink-muted uppercase">
                Adapté pour chaque élève
              </Mono>
              <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LEARNERS.map((l) => (
                  <li
                    key={l.name}
                    className="border border-line bg-surface px-2.5 py-2"
                  >
                    <span className="block text-[13px] font-semibold">
                      {l.name}
                    </span>
                    <Mono className="text-brand-ink">{l.how}</Mono>
                  </li>
                ))}
              </ul>
            </div>
          </Figure>
        </Frame>

        <ul className="grid gap-4">
          {[
            {
              icon: ChalkboardTeacher,
              tone: "#ffc529",
              title: "Profs particuliers",
              text: "Vos élèves continuent de progresser entre deux séances. Vous planifiez vos visios dans l'agenda et vous gardez la main sur les exercices.",
            },
            {
              icon: UsersThree,
              tone: "#bfefd9",
              title: "Enseignants",
              text: "Un devoir, autant de versions que d'élèves. Le suivi de la classe montre qui a compris, qui bloque et sur quelle notion.",
            },
            {
              icon: Buildings,
              tone: "#f7c6d9",
              title: "Écoles et réseaux",
              text: "Classes, profs, rôles et droits gérés depuis un seul espace. Facturation sur contrat.",
            },
          ].map((item) => {
            const ItemIcon = item.icon;
            return (
              <li key={item.title}>
                <Frame cut={14} className="h-full bg-surface p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <GlowTile
                      tone={item.tone}
                      size={40}
                      className="rounded-[10px]"
                    >
                      <ItemIcon size={20} weight="bold" />
                    </GlowTile>
                    <div>
                      <h3 className="text-[17px] font-semibold">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-muted">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </Frame>
              </li>
            );
          })}
          <li className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
            <a href={appLinks.signup} className="notch-btn">
              Ouvrir mon espace prof
            </a>
            <Link
              href="/profs-et-ecoles"
              className="text-[15px] font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Tout sur l'offre profs et écoles
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
