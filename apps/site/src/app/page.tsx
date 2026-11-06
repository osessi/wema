import Link from "next/link";
import { ClosingCta, PrimaryCta } from "../components/cta";
import { EvidenceCard } from "../components/evidence-card";
import { Notebook } from "../components/notebook";
import { priceLine } from "../lib/site";

const steps = [
  {
    title: "Faire connaissance",
    text: "Le prof IA mène un premier entretien avec l'élève. Le parent et le prof le complètent. Il en ressort un profil : ses bases, son rythme, les formats qui l'aident.",
  },
  {
    title: "Travailler à sa façon",
    text: "Chaque exercice est décliné pour lui : même notion évaluée, mais la difficulté, les indices, le contexte et la forme changent. Les calculs sont vérifiés par un moteur de calcul avant de lui être proposés.",
  },
  {
    title: "Ne pas lâcher",
    text: "Le prof IA demande si l'exercice est fait, revient sur les notions quelques jours plus tard et relance quand il le faut. Chaque réponse met à jour le profil.",
  },
];

const differences = [
  {
    title: "Il ne donne jamais la réponse",
    text: "Il pose des questions et propose des indices de plus en plus précis. Avec le mode « explique-moi », c'est l'élève qui enseigne la notion à un élève naïf joué par l'IA.",
  },
  {
    title: "Des exercices justes",
    text: "En mathématiques, chaque variante d'exercice est vérifiée par un moteur de calcul avant d'être proposée à l'élève. On ne fait pas confiance au calcul de l'IA.",
  },
  {
    title: "La forme qui lui convient",
    text: "Bande dessinée, lecture facile, schémas, audio ou manipulables : Wema retient les formats avec lesquels l'élève réussit le mieux.",
  },
  {
    title: "La copie relue",
    text: "L'élève photographie sa copie corrigée. Le prof IA repère les erreurs et fait retravailler les notions concernées.",
  },
  {
    title: "Des besoins respectés, jamais diagnostiqués",
    text: "Un besoin de type dys ou TDAH est déclaré par le parent ou le prof, avec le consentement du parent. L'IA adapte sa façon d'enseigner ; elle ne pose aucun diagnostic.",
  },
];

const audiences = [
  {
    href: "/familles",
    title: "Familles",
    text: "Un prof IA dans chaque matière où votre enfant en a besoin, et un espace parent pour suivre ses progrès.",
  },
  {
    href: "/profs-et-ecoles",
    title: "Profs particuliers",
    text: "Vos élèves continuent de progresser entre deux séances. Vous gardez la main sur les exercices.",
  },
  {
    href: "/profs-et-ecoles",
    title: "Écoles",
    text: "Des exercices différenciés pour chaque élève, choisis par l'enseignant, et un suivi par classe.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-16 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div>
          <h1 className="max-w-xl text-[2.5rem] leading-[1.05] font-bold sm:text-6xl">
            Un prof particulier IA pour chaque matière. Il fait trouver, il ne
            donne pas la réponse.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Wema apprend à connaître chaque élève et adapte chaque exercice à sa
            façon d'apprendre. Parents et profs voient ce qu'il a compris, et
            pourquoi Wema le pense.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <PrimaryCta />
            <a
              href="#comment-ca-marche"
              className="font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Comment ça marche
            </a>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Essai gratuit, sans moyen de paiement. {priceLine()}
          </p>
        </div>
        <Notebook />
      </section>

      <section
        id="comment-ca-marche"
        className="scroll-mt-20 border-y border-line bg-surface"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">
            Comment ça marche
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, index) => (
              <li key={step.title} className="border-t-2 border-ink pt-5">
                <span className="font-display text-5xl font-bold text-line-strong">
                  {index + 1}
                </span>
                <h3 className="mt-3 text-xl font-bold">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">
          Ce qui rend Wema différent
        </h2>
        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <dl className="space-y-8">
            {differences.map((item) => (
              <div key={item.title}>
                <dt className="font-display text-xl font-bold">{item.title}</dt>
                <dd className="mt-2 max-w-prose leading-relaxed text-muted-foreground">
                  {item.text}
                </dd>
              </div>
            ))}
          </dl>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h3 className="font-display text-xl font-bold">
              Un profil qui se justifie
            </h3>
            <p className="mt-2 mb-6 max-w-prose leading-relaxed text-muted-foreground">
              Chaque affirmation sur l'élève vient avec sa confiance et ses
              preuves. Rien n'est affirmé sans trace.
            </p>
            <EvidenceCard />
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">Pour qui</h2>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {audiences.map((item) => (
              <li key={item.title} className="bg-ground">
                <Link
                  href={item.href}
                  className="flex h-full flex-col p-6 transition-colors hover:bg-surface sm:p-8"
                >
                  <h3 className="text-2xl font-bold">{item.title}</h3>
                  <p className="mt-3 flex-1 leading-relaxed text-muted-foreground">
                    {item.text}
                  </p>
                  <span className="mt-6 font-medium underline decoration-line-strong underline-offset-4">
                    En savoir plus
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ClosingCta
        title="Essayez Wema dans la matière qui pose problème."
        text={`L'essai est gratuit et ne demande aucun moyen de paiement. ${priceLine()}`}
      />
    </>
  );
}
