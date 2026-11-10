/**
 * Une page de cahier : un vrai échange entre un élève et son prof IA de maths.
 * Dans la marge, ce que fait le prof IA à chaque tour. Il ne donne pas la
 * réponse : c'est l'élève qui la trouve, et qui la surligne.
 */
type Turn = {
  who: "eleve" | "prof";
  text: string;
  margin?: string;
  found?: boolean;
};

const turns: Turn[] = [
  { who: "eleve", text: "Je n'arrive pas à trouver BC dans mon exercice." },
  {
    who: "prof",
    text: "On le cherche ensemble. Où se trouve l'angle droit sur ta figure ?",
    margin: "Question",
  },
  { who: "eleve", text: "En A, je crois." },
  {
    who: "prof",
    text: "Oui. Et quel côté est en face de cet angle droit ?",
    margin: "Indice 1",
  },
  {
    who: "eleve",
    text: "BC ! Donc c'est l'hypoténuse, j'utilise Pythagore.",
    found: true,
  },
  {
    who: "prof",
    text: "Explique-moi en trente secondes comment tu l'as trouvé.",
    margin: "Vérification orale",
  },
];

export function Notebook() {
  return (
    <figure className="relative rounded-2xl border border-line bg-surface shadow-[0_1px_0_var(--line),0_24px_48px_-32px_rgb(22_21_18/0.35)]">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line-strong px-5 py-3 text-sm">
        <span className="font-medium">Prof de maths de Yanis</span>
        <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-medium text-mint-ink">
          Mathématiques, 4e
        </span>
      </figcaption>
      <ol className="grid grid-cols-[6rem_1fr] px-0 pb-4 text-[15px] leading-8 sm:grid-cols-[9rem_1fr]">
        {turns.map((turn) => (
          <li key={turn.text} className="contents">
            <span className="notebook-row border-r border-r-peach px-3 pt-px text-right text-xs leading-8 text-muted-foreground">
              {turn.margin ?? ""}
            </span>
            <p
              className={`notebook-row px-4 ${
                turn.who === "prof" ? "font-medium" : "text-muted-foreground"
              }`}
            >
              <span className="sr-only">
                {turn.who === "prof" ? "Prof IA : " : "Élève : "}
              </span>
              {turn.found ? (
                <span className="crayon-mark text-ink">{turn.text}</span>
              ) : (
                turn.text
              )}
            </p>
          </li>
        ))}
      </ol>
    </figure>
  );
}
