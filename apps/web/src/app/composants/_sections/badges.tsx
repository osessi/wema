import {
  CheckCircle,
  Clock,
  Robot,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import {
  NOTION_STATUSES,
  NotionStatus,
  NotionStatusLegend,
} from "@wema/ui/components/wema/notion-status";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "success",
  "warning",
  "danger",
  "info",
  "neutral",
  "brand",
] as const;

type Variant = (typeof VARIANTS)[number];

/** Statuts réels de Wema, chacun avec la couleur de son sens. */
const CASES: {
  domain: string;
  items: [Variant, string, "ok" | "late" | "wait" | "ai" | null][];
}[] = [
  {
    domain: "Devoir",
    items: [
      ["warning", "À rendre jeudi", "wait"],
      ["danger", "En retard", "late"],
      ["info", "Rendu", null],
      ["success", "Corrigé", "ok"],
    ],
  },
  {
    domain: "Séance",
    items: [
      ["neutral", "Demandée", "wait"],
      ["brand", "Proposée", null],
      ["success", "Confirmée", "ok"],
      ["danger", "Annulée", null],
    ],
  },
  {
    domain: "Exercice",
    items: [
      ["neutral", "Brouillon", null],
      ["success", "Validé", "ok"],
      ["brand", "Proposé par l'IA", "ai"],
      ["outline", "Archivé", null],
    ],
  },
  {
    domain: "Hypothèse du profil",
    items: [
      ["info", "Confiance moyenne", null],
      ["success", "Confirmée par le prof", "ok"],
      ["warning", "À vérifier", "wait"],
    ],
  },
];

const ICON = {
  ok: <CheckCircle weight="bold" />,
  late: <WarningCircle weight="bold" />,
  wait: <Clock weight="bold" />,
  ai: <Robot weight="bold" />,
};

export function Badges({ id, index, title }: SectionProps) {
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Un badge dit un état, en un ou deux mots. Sa couleur suit le sens (vert réussi, ambre en attente, rouge en retard) et le texte le dit aussi : la couleur n'est jamais seule."
    >
      <Specimen label="Variantes">
        <ul className="flex flex-wrap gap-3">
          {VARIANTS.map((v) => (
            <li key={v} className="flex flex-col items-start gap-1.5">
              <Badge variant={v}>
                {v === "brand" ? <Sparkle weight="fill" /> : null}
                {v}
              </Badge>
            </li>
          ))}
        </ul>
      </Specimen>

      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Statuts Wema">
          <dl className="flex flex-col gap-4">
            {CASES.map((c) => (
              <div
                key={c.domain}
                className="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center"
              >
                <dt className="text-sm text-muted-foreground">{c.domain}</dt>
                <dd className="flex flex-wrap gap-2">
                  {c.items.map(([variant, label, icon]) => (
                    <Badge key={label} variant={variant}>
                      {icon ? ICON[icon] : null}
                      {label}
                    </Badge>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Specimen>

        <Specimen
          label="Statut d'une notion · NotionStatus"
          note="« Validé » est menthe dans les deux thèmes"
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              {NOTION_STATUSES.map((s) => (
                <NotionStatus key={s} status={s} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {NOTION_STATUSES.map((s) => (
                <NotionStatus key={s} status={s} size="sm" />
              ))}
            </div>
            <ul className="flex flex-col divide-y rounded-control border text-sm">
              {(
                [
                  ["Fractions : additionner", "mastered"],
                  ["Théorème de Pythagore", "in_progress"],
                  ["Équations du premier degré", "needs_work"],
                  ["Proportionnalité", "not_seen"],
                ] as const
              ).map(([notion, status]) => (
                <li
                  key={notion}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 truncate">{notion}</span>
                  <NotionStatus status={status} size="sm" />
                </li>
              ))}
            </ul>
            <NotionStatusLegend />
          </div>
        </Specimen>
      </div>
    </Section>
  );
}
