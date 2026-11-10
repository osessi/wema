import { priceLine } from "./site";

/** Les thèmes de la page des questions fréquentes, dans l’ordre d’affichage. */
export const faqThemes = [
  { id: "essai-et-prix", label: "Essai et prix" },
  { id: "prof-ia", label: "Le prof IA et l'élève" },
  { id: "besoins-et-donnees", label: "Besoins particuliers et données" },
  { id: "profs-et-ecoles", label: "Profs et écoles" },
] as const;

export type FaqThemeId = (typeof faqThemes)[number]["id"];

/**
 * Questions fréquentes, partagées par l'accueil et la page dédiée. L'accueil
 * en choisit certaines par leur position : n'en changez pas l'ordre.
 */
export const faq: readonly { q: string; a: string; theme: FaqThemeId }[] = [
  {
    q: "Le prof IA fait-il les devoirs à la place de mon enfant ?",
    a: "Non. Il ne donne jamais la réponse d'un exercice ou d'un devoir. Il pose des questions, propose des indices de plus en plus précis et demande à l'élève d'expliquer son raisonnement. C'est l'élève qui trouve.",
    theme: "prof-ia",
  },
  {
    q: "Combien coûte Wema ?",
    a: `L'abonnement se prend par matière : vous ne payez que pour les matières où votre enfant a besoin d'aide. ${priceLine()} Le prix de votre pays est affiché dans l'application avant tout paiement.`,
    theme: "essai-et-prix",
  },
  {
    q: "L'essai gratuit m'engage-t-il ?",
    a: "Non. Il ne demande aucun moyen de paiement. Il y a un essai gratuit par élève et par matière, et le premier entretien avec le prof IA est toujours offert.",
    theme: "essai-et-prix",
  },
  {
    q: "Quelles matières sont proposées ?",
    a: "Chaque matière a son propre prof IA. Les mathématiques ouvrent en premier ; les autres matières s'ajoutent au fur et à mesure, et l'application indique celles qui sont disponibles pour la classe de votre enfant.",
    theme: "prof-ia",
  },
  {
    q: "Dans quels pays Wema fonctionne-t-il ?",
    a: "Wema suit le programme officiel du pays et de la classe de l'élève, que ce soit en France, au Bénin, en Belgique, en Suisse ou ailleurs. Les programmes sont ajoutés pays par pays et classe par classe ; l'application indique ceux qui sont ouverts.",
    theme: "essai-et-prix",
  },
  {
    q: "Comment Wema adapte-t-il les exercices ?",
    a: "Chaque exercice est décliné pour chaque élève : la notion évaluée reste la même, mais la difficulté, les indices, le contexte et la forme changent selon son profil. En mathématiques, chaque variante est vérifiée par un moteur de calcul avant d'être proposée.",
    theme: "prof-ia",
  },
  {
    q: "Qu'est-ce que le profil explicable ?",
    a: "C'est ce que Wema a compris de l'élève : ses acquis, ses erreurs récurrentes, les formats qui l'aident. Chaque affirmation est accompagnée de sa source, de son niveau de confiance et des preuves sur lesquelles elle repose. Les parents et les profs le consultent.",
    theme: "prof-ia",
  },
  {
    q: "Mon enfant a un trouble dys ou un TDAH. Wema peut-il en tenir compte ?",
    a: "Oui, si vous le déclarez, ou si son prof le fait avec votre consentement. Le prof IA adapte alors sa façon d'enseigner, par exemple avec la lecture facile. L'IA ne pose jamais de diagnostic et ne cherche pas à repérer un trouble.",
    theme: "besoins-et-donnees",
  },
  {
    q: "Qui peut voir les données de mon enfant ?",
    a: "Vous, et les profs ou l'école qui le suivent sur Wema, chacun selon son rôle. Les besoins de santé déclarés sont chiffrés et ne sont visibles par une autre structure que si vous les partagez ; l'équipe Wema peut y accéder, et chacune de ses lectures est tracée. Vous pouvez exporter ses données ou demander leur suppression.",
    theme: "besoins-et-donnees",
  },
  {
    q: "Je suis prof. Est-ce que Wema me remplace ?",
    a: "Non. Wema vous propose chaque semaine des exercices ; c'est vous qui choisissez, ou qui déposez les vôtres. Le prof IA prolonge votre travail entre les séances et vous montre où en est chaque élève.",
    theme: "profs-et-ecoles",
  },
  {
    q: "Peut-on suivre des séances en visio ?",
    a: "Oui, avec un prof qui suit votre enfant sur Wema : les séances sont planifiées dans l'agenda et se tiennent en visio depuis l'application.",
    theme: "profs-et-ecoles",
  },
  {
    q: "Comment résilier ?",
    a: "Depuis votre espace parent, matière par matière. L'accès reste ouvert jusqu'à la fin de la période déjà payée.",
    theme: "essai-et-prix",
  },
];
