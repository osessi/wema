import type { Metadata } from "next";
import { ClosingCta, PrimaryCta } from "../../components/cta";
import { EvidenceCard } from "../../components/evidence-card";
import { FeatureList, PageIntro, Section } from "../../components/page-intro";
import { pageMetadata } from "../../lib/metadata";
import { appLinks, priceLine } from "../../lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Familles",
  description:
    "Un prof particulier IA dans chaque matière où votre enfant en a besoin, et un espace parent pour suivre ce qu'il a compris, preuves à l'appui.",
  path: "/familles",
});

const forChild = [
  {
    title: "Un prof IA par matière",
    text: "Chaque matière a son prof. Il questionne, propose des indices progressifs et vérifie à l'oral que votre enfant a compris. Il ne donne jamais la réponse d'un exercice ni d'un devoir.",
  },
  {
    title: "Des exercices faits pour lui",
    text: "Chaque exercice est décliné pour votre enfant : la notion travaillée reste la même, la difficulté, les indices et le contexte s'adaptent. En mathématiques, chaque calcul est vérifié par un moteur de calcul.",
  },
  {
    title: "Le format qui l'aide",
    text: "Bande dessinée, lecture facile, schémas, audio, manipulables : Wema observe avec quels formats il réussit et les lui propose davantage.",
  },
  {
    title: "Sa copie relue",
    text: "Il photographie un devoir corrigé : le prof IA relève les erreurs et lui fait retravailler les notions concernées.",
  },
  {
    title: "Un suivi qui relance",
    text: "« Tu as fait l'exercice ? » Le prof IA relance quand il le faut et revient sur les notions quelques jours plus tard pour s'assurer qu'elles sont acquises.",
  },
  {
    title: "Ses profs au même endroit",
    text: "S'il est aussi suivi par un prof particulier ou par son école sur Wema, ses séances en visio, son agenda et ses messages sont réunis dans l'application.",
  },
];

const forParent = [
  {
    title: "Votre espace parent",
    text: "Vous voyez les notions acquises, celles qui restent à travailler et l'activité de la semaine, matière par matière.",
  },
  {
    title: "Des affirmations avec leurs preuves",
    text: "Quand Wema dit que votre enfant bloque sur une notion, vous voyez sur quels exercices et quelles réponses il s'appuie, et avec quelle confiance.",
  },
  {
    title: "Une messagerie avec ses profs",
    text: "Vous échangez avec les profs qui suivent votre enfant sur Wema, sans changer d'outil.",
  },
  {
    title: "Ses besoins, déclarés par vous",
    text: "Si votre enfant a un besoin de type dys ou TDAH, vous pouvez le déclarer. L'IA adapte sa façon d'enseigner, sans jamais poser de diagnostic, et rien n'est enregistré sans votre consentement.",
  },
];

const pricing = [
  {
    title: "Essai gratuit",
    text: "Un essai gratuit par matière, sans moyen de paiement. Le premier entretien avec le prof IA est toujours offert.",
  },
  {
    title: "Abonnement par matière",
    text: "Vous abonnez votre enfant aux seules matières où il a besoin d'aide. Le prix de votre pays est affiché dans l'application avant tout paiement.",
  },
  {
    title: "Paiement",
    text: "Par carte ou par Mobile Money, selon les moyens proposés dans votre pays.",
  },
  {
    title: "Résiliation",
    text: "Vous résiliez depuis votre espace parent. L'accès reste ouvert jusqu'à la fin de la période déjà payée.",
  },
];

const privacy = [
  {
    title: "Votre consentement d'abord",
    text: "Le compte de votre enfant est rattaché au vôtre et les choix qui le concernent passent par vous.",
  },
  {
    title: "Des données de santé protégées",
    text: "Les besoins déclarés sont stockés à part, chiffrés, accessibles aux seules personnes autorisées, et partagés avec une autre structure seulement si vous le décidez.",
  },
  {
    title: "Vos droits, en pratique",
    text: "Vous pouvez exporter les données de votre enfant ou demander leur suppression depuis l'application.",
  },
];

export default function FamiliesPage() {
  return (
    <>
      <PageIntro
        title="Un prof IA dans chaque matière où votre enfant en a besoin."
        lead="Wema apprend à connaître votre enfant, lui propose des exercices à sa mesure et le fait réfléchir plutôt que de lui donner les réponses. Vous suivez ses progrès, preuves à l'appui."
      >
        <PrimaryCta />
      </PageIntro>

      <Section title="Pour votre enfant" tone="surface">
        <FeatureList items={forChild} />
      </Section>

      <Section
        title="Pour vous"
        lead="Vous savez où il en est, sans avoir à le lui demander."
      >
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <dl className="space-y-8">
            {forParent.map((item) => (
              <div key={item.title}>
                <dt className="font-display text-xl font-bold">{item.title}</dt>
                <dd className="mt-2 max-w-prose leading-relaxed text-muted-foreground">
                  {item.text}
                </dd>
              </div>
            ))}
          </dl>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <EvidenceCard />
          </div>
        </div>
      </Section>

      <Section title="Le prix" lead={priceLine()} tone="surface">
        <FeatureList items={pricing} />
      </Section>

      <Section title="Les données de votre enfant">
        <FeatureList items={privacy} />
        <p className="mt-10 max-w-prose text-muted-foreground">
          Le détail est dans notre{" "}
          <a
            href={appLinks.privacy}
            className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            politique de confidentialité
          </a>
          .
        </p>
      </Section>

      <ClosingCta
        title="Commencez par la matière qui lui pose le plus de difficultés."
        text="Créez votre compte parent, ajoutez votre enfant et lancez son essai gratuit."
      />
    </>
  );
}
