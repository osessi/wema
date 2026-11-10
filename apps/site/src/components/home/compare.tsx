import { Minus } from "@phosphor-icons/react/ssr";
import { SectionHeading } from "../../wa/components/v2/primitives";
import { TsfFrame } from "../../wa/components/v2/tsf/tsf-frame";
import { VerifiedBadge } from "../ui/verified-badge";

/**
 * « Ce qui le distingue d'un chatbot » : une grille à filets, dans l'esprit de
 * `ai-companies.tsx` du site Winner (cellules séparées par un trait d'un pixel).
 */

const ROWS: readonly { topic: string; chatbot: string; wema: string }[] = [
  {
    topic: "La réponse",
    chatbot: "Donne souvent la solution complète dès la première question.",
    wema: "Ne donne jamais la réponse : il questionne, puis donne des indices progressifs.",
  },
  {
    topic: "Les calculs",
    chatbot: "Produit des calculs plausibles, sans vérification systématique.",
    wema: "Chaque calcul passe par un moteur de calcul avant d'être montré.",
  },
  {
    topic: "Le programme",
    chatbot: "Répond hors programme, au niveau qu'il devine.",
    wema: "Suit le programme officiel de la classe, celui de son pays.",
  },
  {
    topic: "La mémoire de l'élève",
    chatbot: "Repart presque de zéro à chaque conversation.",
    wema: "Tient un profil : acquis, erreurs, formats qui aident, avec preuves.",
  },
  {
    topic: "Les exercices",
    chatbot: "Les mêmes pour tout le monde, à demander soi-même.",
    wema: "Choisis par le prof, déclinés pour chaque élève, proposés au bon moment.",
  },
  {
    topic: "Les copies",
    chatbot: "Commente ce qu'on lui colle, sans suite.",
    wema: "Relit la copie photographiée et fait retravailler les notions en cause.",
  },
  {
    topic: "Les adultes",
    chatbot: "Ni parent, ni prof dans la boucle.",
    wema: "Espace parent, console du prof, besoins dys ou TDAH déclarés et respectés.",
  },
];

export function Compare() {
  return (
    <section
      aria-labelledby="compare-title"
      className="relative px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <SectionHeading
          id="compare-title"
          eyebrow="La différence"
          title={[
            "Pas un chatbot de plus.",
            <span key="l2" className="text-brand-active dark:text-brand">
              Un prof qui fait apprendre.
            </span>,
          ]}
          sub="Un assistant généraliste répond à la question posée. Un prof particulier fait progresser l'élève. Voici ce qui change, point par point."
        />

        <TsfFrame className="mt-14 sm:mt-16">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Comparaison entre un assistant généraliste et Wema
            </caption>
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-[var(--tk-line)]">
                <th
                  scope="col"
                  className="w-[22%] px-6 py-4 font-mono text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
                >
                  Sur quoi
                </th>
                <th
                  scope="col"
                  className="w-[36%] border-l border-[var(--tk-line)] px-6 py-4 font-mono text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
                >
                  Un assistant généraliste
                </th>
                <th
                  scope="col"
                  className="border-l border-[var(--tk-line)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] px-6 py-4 font-mono text-[12px] font-semibold tracking-[0.08em] text-foreground uppercase"
                >
                  Wema
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.topic}
                  className="grid border-b border-[var(--tk-line)] last:border-b-0 md:table-row"
                >
                  <th
                    scope="row"
                    className="px-5 pt-5 pb-2 align-top md:px-6 md:py-5"
                  >
                    <span className="flex items-baseline gap-2.5">
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                        {row.topic}
                      </span>
                    </span>
                  </th>
                  <td className="px-5 py-2 align-top md:border-l md:border-[var(--tk-line)] md:px-6 md:py-5">
                    <span className="flex items-start gap-2.5 text-[15px] leading-snug text-foreground/60">
                      <Minus
                        size={16}
                        weight="bold"
                        className="mt-0.5 shrink-0 text-foreground/35"
                        aria-hidden="true"
                      />
                      <span>
                        <span className="sr-only md:hidden">
                          Assistant généraliste :{" "}
                        </span>
                        {row.chatbot}
                      </span>
                    </span>
                  </td>
                  <td className="mx-3 mb-4 rounded-[10px] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] px-3 py-3 align-top md:mx-0 md:mb-0 md:rounded-none md:border-l md:border-[var(--tk-line)] md:px-6 md:py-5">
                    <span className="flex items-start gap-2.5 text-[15px] leading-snug font-medium text-foreground">
                      <VerifiedBadge size={20} className="shrink-0" />
                      <span>
                        <span className="sr-only md:hidden">Wema : </span>
                        {row.wema}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TsfFrame>
      </div>
    </section>
  );
}
