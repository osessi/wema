"use client";

import {
  CalendarBlank,
  ChartBar,
  ListBullets,
  SquaresFour,
} from "@phosphor-icons/react";
import {
  Segmented,
  Stepper,
  ViewSwitcher,
} from "@wema/ui/components/patterns/index";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@wema/ui/components/ui/breadcrumb";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wema/ui/components/ui/tabs";
import { StepTrail } from "@wema/ui/components/wema/step-trail";
import { useState } from "react";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const ONBOARDING = [
  { id: "compte", label: "Compte" },
  { id: "enfant", label: "Votre enfant" },
  { id: "test", label: "Test de niveau" },
  { id: "entretien", label: "Entretien" },
];

function StepperDemo() {
  const [step, setStep] = useState(1);
  const last = step === ONBOARDING.length - 1;
  return (
    <Stepper
      steps={ONBOARDING}
      current={step}
      eyebrow="Inscription"
      title={
        [
          "Créer le compte",
          "Présentez-nous votre enfant",
          "Le test de niveau",
          "L'entretien avec le prof IA",
        ][step]
      }
      description="Quelques minutes suffisent. Vous pourrez tout modifier ensuite."
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      onNext={() => setStep(last ? 0 : step + 1)}
      finishLabel="Recommencer la démo"
    >
      <p className="rounded-control border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Contenu de l'étape {step + 1}
      </p>
    </Stepper>
  );
}

function ViewDemo() {
  const [view, setView] = useState<"grid" | "list">("grid");
  return (
    <ViewSwitcher
      label="Affichage des élèves"
      value={view}
      onValueChange={setView}
      views={[
        { value: "grid", label: "Grille", icon: <SquaresFour /> },
        { value: "list", label: "Liste", icon: <ListBullets /> },
      ]}
    >
      <div
        className={
          view === "grid" ? "grid grid-cols-3 gap-2" : "flex flex-col gap-2"
        }
      >
        {["Awa", "Kofi", "Inès"].map((n) => (
          <div
            key={n}
            className="rounded-control border bg-muted px-3 py-2 text-sm"
          >
            {n}
          </div>
        ))}
      </div>
    </ViewSwitcher>
  );
}

export function Navigation({ id, index, title }: SectionProps) {
  const [period, setPeriod] = useState<"week" | "month" | "term">("week");
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Des onglets pour changer de vue dans une page, Segmented pour un choix court et exclusif, le Stepper pour un parcours guidé pas à pas, StepTrail pour montrer où l'on en est, le fil d'Ariane pour remonter."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Onglets · Tabs">
          <div className="flex flex-col gap-6">
            <Tabs defaultValue="progress">
              <TabsList>
                <TabsTrigger value="progress">Progression</TabsTrigger>
                <TabsTrigger value="homework">Devoirs</TabsTrigger>
                <TabsTrigger value="profile">Profil</TabsTrigger>
              </TabsList>
              <TabsContent
                value="progress"
                className="pt-3 text-sm text-muted-foreground"
              >
                12 notions validées sur 31.
              </TabsContent>
              <TabsContent
                value="homework"
                className="pt-3 text-sm text-muted-foreground"
              >
                2 devoirs à rendre cette semaine.
              </TabsContent>
              <TabsContent
                value="profile"
                className="pt-3 text-sm text-muted-foreground"
              >
                Préfère les schémas aux longs textes.
              </TabsContent>
            </Tabs>
            <Tabs defaultValue="map">
              <TabsList variant="line">
                <TabsTrigger value="map">Carte de la classe</TabsTrigger>
                <TabsTrigger value="learners">Élèves</TabsTrigger>
                <TabsTrigger value="homework">Devoirs</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Specimen>

        <Specimen label="Choix court · Segmented">
          <div className="flex flex-col gap-6">
            <Segmented
              name="demo-period"
              legend="Période"
              value={period}
              onValueChange={setPeriod}
              options={[
                { value: "week", label: "Semaine" },
                { value: "month", label: "Mois" },
                { value: "term", label: "Trimestre" },
              ]}
            />
            <Segmented
              name="demo-chart"
              legend="Vue"
              hideLegend
              size="sm"
              value="calendar"
              onValueChange={() => undefined}
              options={[
                { value: "calendar", label: "Agenda", icon: <CalendarBlank /> },
                { value: "chart", label: "Graphique", icon: <ChartBar /> },
              ]}
            />
          </div>
        </Specimen>
      </div>

      <Specimen
        label="Parcours guidé · Stepper"
        note="Interactif : Suivant, Précédent"
      >
        <StepperDemo />
      </Specimen>

      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Où en est-on · StepTrail">
          <StepTrail
            label="Étapes du diagnostic"
            steps={[
              {
                id: "a",
                label: "Test de niveau",
                description: "Terminé",
                state: "done",
              },
              {
                id: "b",
                label: "Entretien IA",
                description: "En cours",
                state: "current",
              },
              {
                id: "c",
                label: "Rendez-vous conseiller",
                description: "15 minutes",
                state: "upcoming",
              },
            ]}
          />
        </Specimen>
        <Specimen label="Fil d'Ariane · Breadcrumb">
          <div className="flex flex-col gap-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#navigation">Classes</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="#navigation">4e B</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Awa Diallo</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <ViewDemo />
          </div>
        </Specimen>
      </div>
    </Section>
  );
}
