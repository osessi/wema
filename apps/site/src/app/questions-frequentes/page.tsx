import { CaretDown } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { ClosingCta } from "../../components/cta";
import { PageIntro } from "../../components/page-intro";
import { pageMetadata } from "../../lib/metadata";
import { priceLine } from "../../lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Questions fréquentes",
  description:
    "Prix par matière, essai gratuit, matières et pays, réponses aux devoirs, besoins dys ou TDAH, données des enfants : les réponses à vos questions sur Wema.",
  path: "/questions-frequentes",
});

const faq: { q: string; a: string }[] = [
  {
    q: "Le prof IA fait-il les devoirs à la place de mon enfant ?",
    a: "Non. Il ne donne jamais la réponse d'un exercice ou d'un devoir. Il pose des questions, propose des indices de plus en plus précis et demande à l'élève d'expliquer son raisonnement. C'est l'élève qui trouve.",
  },
  {
    q: "Combien coûte Wema ?",
    a: `L'abonnement se prend par matière : vous ne payez que pour les matières où votre enfant a besoin d'aide. ${priceLine()} Le prix de votre pays est affiché dans l'application avant tout paiement.`,
  },
  {
    q: "L'essai gratuit m'engage-t-il ?",
    a: "Non. Il ne demande aucun moyen de paiement. Il y a un essai gratuit par élève et par matière, et le premier entretien avec le prof IA est toujours offert.",
  },
  {
    q: "Quelles matières sont proposées ?",
    a: "Chaque matière a son propre prof IA. Les mathématiques ouvrent en premier ; les autres matières s'ajoutent au fur et à mesure, et l'application indique celles qui sont disponibles pour la classe de votre enfant.",
  },
  {
    q: "Dans quels pays Wema fonctionne-t-il ?",
    a: "Wema suit le programme officiel du pays et de la classe de l'élève, que ce soit en France, au Bénin, en Belgique, en Suisse ou ailleurs. Les programmes sont ajoutés pays par pays et classe par classe ; l'application indique ceux qui sont ouverts.",
  },
  {
    q: "Comment Wema adapte-t-il les exercices ?",
    a: "Chaque exercice est décliné pour chaque élève : la notion évaluée reste la même, mais la difficulté, les indices, le contexte et la forme changent selon son profil. En mathématiques, chaque variante est vérifiée par un moteur de calcul avant d'être proposée.",
  },
  {
    q: "Qu'est-ce que le profil explicable ?",
    a: "C'est ce que Wema a compris de l'élève : ses acquis, ses erreurs récurrentes, les formats qui l'aident. Chaque affirmation est accompagnée de sa source, de son niveau de confiance et des preuves sur lesquelles elle repose. Les parents et les profs le consultent.",
  },
  {
    q: "Mon enfant a un trouble dys ou un TDAH. Wema peut-il en tenir compte ?",
    a: "Oui, si vous le déclarez, ou si son prof le fait avec votre consentement. Le prof IA adapte alors sa façon d'enseigner, par exemple avec la lecture facile. L'IA ne pose jamais de diagnostic et ne cherche pas à repérer un trouble.",
  },
  {
    q: "Qui peut voir les données de mon enfant ?",
    a: "Vous, et les profs ou l'école qui le suivent sur Wema, chacun selon son rôle. Les besoins de santé déclarés sont chiffrés et ne sont visibles par une autre structure que si vous les partagez ; l'équipe Wema peut y accéder, et chacune de ses lectures est tracée. Vous pouvez exporter ses données ou demander leur suppression.",
  },
  {
    q: "Je suis prof. Est-ce que Wema me remplace ?",
    a: "Non. Wema vous propose chaque semaine des exercices ; c'est vous qui choisissez, ou qui déposez les vôtres. Le prof IA prolonge votre travail entre les séances et vous montre où en est chaque élève.",
  },
  {
    q: "Peut-on suivre des séances en visio ?",
    a: "Oui, avec un prof qui suit votre enfant sur Wema : les séances sont planifiées dans l'agenda et se tiennent en visio depuis l'application.",
  },
  {
    q: "Comment résilier ?",
    a: "Depuis votre espace parent, matière par matière. L'accès reste ouvert jusqu'à la fin de la période déjà payée.",
  },
];

export default function FaqPage() {
  return (
    <>
      <PageIntro
        title="Questions fréquentes"
        lead="Ce que les familles, les profs et les écoles nous demandent le plus souvent."
      />
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <ul className="border-t border-line-strong">
          {faq.map((item) => (
            <li key={item.q} className="border-b border-line-strong">
              <details className="group">
                <summary className="flex cursor-pointer items-start justify-between gap-6 py-5 font-display text-lg font-semibold sm:text-xl">
                  <h2>{item.q}</h2>
                  <CaretDown
                    size={20}
                    aria-hidden="true"
                    className="mt-1 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <p className="max-w-prose pb-6 leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </section>
      <ClosingCta
        title="La meilleure réponse, c'est d'essayer."
        text="L'essai est gratuit, matière par matière, sans moyen de paiement."
      />
    </>
  );
}
