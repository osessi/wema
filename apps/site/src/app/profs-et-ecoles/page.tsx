import type { Metadata } from "next";
import { ClosingCta, PrimaryCta } from "../../components/cta";
import { FeatureList, PageIntro, Section } from "../../components/page-intro";
import { pageMetadata } from "../../lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Profs et écoles",
  description:
    "Chaque semaine, Wema vous propose une banque d'exercices par notion. Vous choisissez, l'IA décline chaque exercice pour chaque élève et assure le suivi entre les séances.",
  path: "/profs-et-ecoles",
});

const weekly = [
  {
    title: "Wema propose",
    text: "Chaque semaine, une banque d'exercices par notion, préparée à partir du programme et des profils de vos élèves.",
  },
  {
    title: "Vous choisissez",
    text: "Vous retenez les exercices qui vous conviennent, ou vous déposez les vôtres. Rien n'est envoyé aux élèves sans votre choix.",
  },
  {
    title: "Chaque élève reçoit sa variante",
    text: "Ce qui est évalué reste identique pour tous ; la forme, la difficulté, les indices et le contexte changent d'un élève à l'autre. En mathématiques, chaque variante est vérifiée par un moteur de calcul.",
  },
  {
    title: "Le suivi continue sans vous",
    text: "Entre deux cours, le prof IA de la matière accompagne l'élève sans lui donner les réponses, le relance et revient sur les notions fragiles.",
  },
];

const tools = [
  {
    title: "Un profil explicable par élève",
    text: "Pour chaque élève, ce qu'il maîtrise, ses erreurs récurrentes et les formats qui l'aident, avec les preuves derrière chaque affirmation.",
  },
  {
    title: "Le suivi de vos élèves",
    text: "Résultats par notion et par élève, pour savoir qui a besoin de vous et sur quoi.",
  },
  {
    title: "Agenda et séances en visio",
    text: "Vous planifiez vos séances et les menez en visio depuis Wema, puis vous en gardez le compte rendu.",
  },
  {
    title: "Messagerie",
    text: "Vous échangez avec vos élèves et leurs parents au même endroit.",
  },
  {
    title: "Des besoins pris en compte",
    text: "Quand un parent a déclaré un besoin de type dys ou TDAH et l'a partagé avec vous, les exercices et le prof IA s'y adaptent. Wema ne pose jamais de diagnostic.",
  },
  {
    title: "Des données protégées",
    text: "Chaque personne n'accède qu'à ce que son rôle autorise, et les données de santé ne sont visibles que si la famille les partage.",
  },
];

export default function TeachersPage() {
  return (
    <>
      <PageIntro
        title="Vous choisissez les exercices. Wema les adapte à chaque élève."
        lead="Que vous soyez prof particulier ou enseignant dans une école, Wema prolonge votre travail entre les séances : un prof IA par matière suit chacun de vos élèves, et vous gardez la main sur ce qui leur est proposé."
      >
        <PrimaryCta label="Créer mon compte" />
      </PageIntro>

      <Section
        title="Votre semaine avec Wema"
        lead="Quatre temps, dans cet ordre, chaque semaine."
        tone="surface"
      >
        <ol className="grid gap-10 md:grid-cols-2 md:gap-x-12">
          {weekly.map((step, index) => (
            <li key={step.title} className="flex gap-5">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink font-display font-bold"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p className="mt-2 max-w-prose leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Ce que vous avez sous la main">
        <FeatureList items={tools} />
      </Section>

      <Section title="Profs particuliers ou écoles" tone="surface">
        <div className="grid gap-10 md:grid-cols-2 md:gap-12">
          <div className="rounded-2xl border border-line bg-ground p-6 sm:p-8">
            <h3 className="text-2xl font-bold">Profs particuliers</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Vos élèves progressent aussi entre vos séances, et vous arrivez à
              chaque cours en sachant où ils en sont.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-ground p-6 sm:p-8">
            <h3 className="text-2xl font-bold">Écoles</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Vos enseignants proposent des exercices différenciés à chaque
              élève et suivent leurs classes notion par notion. Pour un
              établissement, l'équipe Wema établit avec vous un contrat sur
              mesure.
            </p>
          </div>
        </div>
      </Section>

      <ClosingCta
        title="Essayez Wema avec vos élèves."
        text="Créez votre compte, puis composez la première banque d'exercices de la semaine."
      />
    </>
  );
}
