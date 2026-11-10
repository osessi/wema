"use client";

import { Badge } from "@wema/ui/components/ui/badge";
import { CardShell } from "@wema/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import {
  PERSON_TONES,
  PersonAvatar,
  PersonChip,
  PersonStack,
} from "@wema/ui/components/wema/person-avatar";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const PEOPLE = [
  { id: "u-awa", name: "Awa Diallo", role: "Élève · 4e B", status: "Active" },
  { id: "u-kofi", name: "Kofi Mensah", role: "Élève · 4e B", status: "Bloqué" },
  { id: "u-ines", name: "Inès Sossou", role: "Élève · 3e A", status: "Active" },
  {
    id: "u-agossou",
    name: "Mme Agossou",
    role: "Prof de maths",
    status: "Active",
  },
  { id: "u-yao", name: "Yao Kouassi", role: "Parent", status: "Invité" },
  { id: "u-fatou", name: "Fatou Ndiaye", role: "Direction", status: "Active" },
];

export function People({ id, index, title }: SectionProps) {
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Une couleur par personne, toujours la même : elle dérive de l'identifiant, jamais du rang dans la liste. PersonAvatar seul, PersonChip dans les tableaux et les listes, PersonStack pour un groupe."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen
          label="Avatars · PersonAvatar"
          note="8 tons, lisibles dans les deux thèmes"
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end gap-3">
              {(["xs", "sm", "default", "lg", "xl"] as const).map((size) => (
                <PersonAvatar
                  key={size}
                  name="Awa Diallo"
                  seed="u-awa"
                  size={size}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {PERSON_TONES.map((tone) => (
                <PersonAvatar key={tone} name={tone} tone={tone} size="lg" />
              ))}
            </div>
          </div>
        </Specimen>
        <Specimen label="Groupe · PersonStack">
          <div className="flex flex-col gap-5">
            <PersonStack people={PEOPLE} max={4} />
            <PersonStack people={PEOPLE.slice(0, 3)} size="default" />
            <div className="flex flex-col gap-3">
              {PEOPLE.slice(0, 3).map((p) => (
                <PersonChip
                  key={p.id}
                  name={p.name}
                  seed={p.id}
                  meta={p.role}
                />
              ))}
            </div>
          </div>
        </Specimen>
      </div>

      <Specimen label="Dans un tableau · PersonChip" bare>
        <CardShell>
          <div className="overflow-x-auto rounded-card border bg-card">
            <Table aria-label="Membres (démo)">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Personne</TableHead>
                  <TableHead className="hidden sm:table-cell">Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PEOPLE.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[14rem]">
                      <PersonChip name={p.name} seed={p.id} size="sm" />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {p.role}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "Bloqué"
                            ? "danger"
                            : p.status === "Invité"
                              ? "neutral"
                              : "success"
                        }
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardShell>
      </Specimen>
    </Section>
  );
}
