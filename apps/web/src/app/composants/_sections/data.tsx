"use client";

import {
  Camera,
  ChatCircleDots,
  CheckCircle,
  Envelope,
  GraduationCap,
  Lightbulb,
  Phone,
  Student,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  ActivityTimeline,
  FilterBar,
  Property,
  PropertyList,
  type TimelineEvent,
} from "@wema/ui/components/patterns/index";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { DataTable } from "@wema/ui/components/wema/data-table";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { NotionHeatmap } from "@wema/ui/components/wema/notion-heatmap";
import {
  NotionStatus,
  type NotionStatusKey,
} from "@wema/ui/components/wema/notion-status";
import { useMemo, useState } from "react";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

interface Learner {
  id: string;
  name: string;
  klass: string;
  mastered: number;
  status: NotionStatusKey;
  lastSeen: Date;
}

const DAY = 86_400_000;
const NOW = new Date("2026-11-10T15:00:00Z");

const learner = (
  i: number,
  name: string,
  klass: string,
  mastered: number,
  status: NotionStatusKey,
  days: number,
): Learner => ({
  id: `l${i}`,
  name,
  klass,
  mastered,
  status,
  lastSeen: new Date(NOW.getTime() - days * DAY),
});

const LEARNERS: Learner[] = [
  learner(0, "Awa Diallo", "4e B", 12, "in_progress", 0),
  learner(1, "Kofi Mensah", "4e B", 7, "needs_work", 2),
  learner(2, "Inès Sossou", "4e A", 18, "mastered", 1),
  learner(3, "Yao Kouassi", "4e A", 3, "needs_work", 6),
  learner(4, "Fatou Ndiaye", "4e B", 15, "in_progress", 0),
  learner(5, "Léo Martin", "4e A", 0, "not_seen", 12),
  learner(6, "Aminata Traoré", "4e B", 21, "mastered", 3),
  learner(7, "Jean Hounkpè", "4e A", 9, "in_progress", 1),
];

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

function Table() {
  const [query, setQuery] = useState("");
  const [klass, setKlass] = useState("all");
  const rows = useMemo(
    () =>
      LEARNERS.filter(
        (l) =>
          (klass === "all" || l.klass === klass) &&
          l.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, klass],
  );
  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        label="Filtrer les élèves"
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Chercher un élève"
        filters={[
          {
            id: "klass",
            label: "Classe",
            value: klass,
            onChange: setKlass,
            options: [
              { value: "all", label: "Toutes les classes" },
              { value: "4e A", label: "4e A" },
              { value: "4e B", label: "4e B" },
            ],
          },
        ]}
        count={rows.length}
        total={LEARNERS.length}
        onReset={
          query || klass !== "all"
            ? () => {
                setQuery("");
                setKlass("all");
              }
            : undefined
        }
      />
      <DataTable
        label="Élèves"
        rows={rows}
        getRowId={(r) => r.id}
        pageSize={5}
        initialSort={{ id: "mastered", desc: true }}
        searchable={false}
        empty={
          <EmptyState
            variant="inline"
            illustration="lockers"
            title="Aucun élève ne correspond"
            description="Essayez une autre classe ou effacez la recherche."
          />
        }
        columns={[
          {
            id: "name",
            header: "Élève",
            primary: true,
            cell: (r) => <span className="font-medium">{r.name}</span>,
            sortValue: (r) => r.name,
          },
          {
            id: "klass",
            header: "Classe",
            cell: (r) => r.klass,
            sortValue: (r) => r.klass,
          },
          {
            id: "mastered",
            header: "Notions validées",
            align: "end",
            cell: (r) => <span className="tabular-nums">{r.mastered}</span>,
            sortValue: (r) => r.mastered,
          },
          {
            id: "status",
            header: "Notion en cours",
            cell: (r) => <NotionStatus status={r.status} size="sm" />,
          },
          {
            id: "seen",
            header: "Dernière activité",
            align: "end",
            cell: (r) => dateFmt.format(r.lastSeen),
            sortValue: (r) => r.lastSeen,
            hideOnMobile: true,
          },
        ]}
      />
    </div>
  );
}

const at = (hoursAgo: number) =>
  new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();

const EVENTS: TimelineEvent[] = [
  {
    id: "e1",
    at: at(1),
    icon: <CheckCircle weight="bold" />,
    tone: "success",
    title: "Notion validée : Fractions, additionner",
    detail: "Après 3 exercices réussis d'affilée.",
  },
  {
    id: "e2",
    at: at(3),
    icon: <Lightbulb weight="bold" />,
    tone: "warning",
    title: "Idée fausse repérée",
    detail: "Additionne les dénominateurs entre eux.",
  },
  {
    id: "e3",
    at: at(5),
    icon: <ChatCircleDots weight="bold" />,
    tone: "brand",
    title: "Séance avec le prof IA · 18 min",
  },
  {
    id: "e4",
    at: at(27),
    icon: <Camera weight="bold" />,
    tone: "info",
    title: "Copie envoyée en photo",
  },
  {
    id: "e5",
    at: at(30),
    icon: <WarningCircle weight="bold" />,
    tone: "danger",
    title: "Devoir rendu en retard",
  },
];

export function DataSection({ id, index, title }: SectionProps) {
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="DataTable pour une liste qu'on trie et qu'on cherche (elle passe en cartes sur mobile), FilterBar au-dessus, ActivityTimeline pour ce qui s'est passé, NotionHeatmap pour toute une classe d'un coup d'œil, PropertyList pour la fiche d'une personne."
    >
      <Specimen label="Tableau filtré · FilterBar + DataTable">
        <Table />
      </Specimen>

      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Fil d'activité · ActivityTimeline">
          <ActivityTimeline
            label="Activité récente d'Awa"
            events={EVENTS}
            timeZone="Africa/Porto-Novo"
            now={NOW}
          />
        </Specimen>
        <Specimen label="Fiche · PropertyList">
          <PropertyList>
            <Property label="Élève" icon={<Student />}>
              Awa Diallo
            </Property>
            <Property label="Classe" icon={<GraduationCap />}>
              4e B · Collège des Manguiers
            </Property>
            <Property label="Responsable" icon={<Envelope />}>
              parent.demo@exemple.org
            </Property>
            <Property label="Téléphone" icon={<Phone />} />
            <Property label="Préférences">
              <span className="flex flex-wrap gap-1.5">
                <Badge variant="info">Schémas</Badge>
                <Badge variant="info">Lecture à voix haute</Badge>
              </span>
            </Property>
          </PropertyList>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm">
              Modifier
            </Button>
          </div>
        </Specimen>
      </div>

      <Specimen label="Carte de la classe · NotionHeatmap">
        <NotionHeatmap
          caption="Statut des notions pour la 4e B"
          legend
          notions={[
            { id: "n1", name: "Relatifs" },
            { id: "n2", name: "Fractions" },
            { id: "n3", name: "Puissances" },
            { id: "n4", name: "Calcul littéral" },
            { id: "n5", name: "Équations" },
            { id: "n6", name: "Pythagore" },
            { id: "n7", name: "Proportionnalité" },
            { id: "n8", name: "Statistiques" },
          ]}
          learners={LEARNERS.map((l, i) => ({
            id: l.id,
            name: l.name,
            href: "#donnees",
            statuses: Object.fromEntries(
              ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"].map((n, j) => [
                n,
                (
                  ["mastered", "in_progress", "needs_work", "not_seen"] as const
                )[(i * 3 + j * 2 + (i > j ? 0 : 1)) % 4],
              ]),
            ),
          }))}
        />
      </Specimen>
    </Section>
  );
}
