"use client";

import {
  ArrowRight,
  CalendarCheck,
  ChartLineUp,
  Clock,
  GraduationCap,
  Lightbulb,
  PencilSimpleLine,
  Sparkle,
  Student,
  Timer,
  WarningCircle,
} from "@phosphor-icons/react";
import { asLearnerId, asOrganizationId } from "@wema/domain";
import { TsfEyebrow, TsfFrame } from "@wema/ui/brand";
import {
  MetricCard,
  MetricCardSkeleton,
} from "@wema/ui/components/patterns/index";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  CARD_INNER_SHADOW,
  CARD_TONES,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardShell,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { Progress } from "@wema/ui/components/ui/progress";
import { ClassCard } from "@wema/ui/components/wema/class-card";
import { NotionStatus } from "@wema/ui/components/wema/notion-status";
import { ProgressRing } from "@wema/ui/components/wema/progress-ring";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import { cn } from "@wema/ui/lib/utils";
import { ChildCard } from "../../../components/guardian/child-card";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const CLASS_STUDENTS = [
  ["s1", "Awa Diallo"],
  ["s2", "Kofi Mensah"],
  ["s3", "Inès Sossou"],
  ["s4", "Yao Kouassi"],
  ["s5", "Fatou Ndiaye"],
  ["s6", "Malik Traoré"],
  ["s7", "Ama Owusu"],
].map(([id, name]) => ({ id: id ?? "", name: name ?? "" }));

function NotionCard() {
  return (
    <CardShell tone="mint" className="h-full">
      <article
        className={cn(
          "flex flex-1 flex-col gap-4 rounded-card border bg-card p-5",
          CARD_INNER_SHADOW,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
              Géométrie · 4e
            </p>
            <h4 className="mt-1 font-semibold tracking-tight">
              Théorème de Pythagore
            </h4>
          </div>
          <NotionStatus status="in_progress" size="sm" />
        </div>
        <div className="flex items-center gap-4">
          <ProgressRing
            value={62}
            label="Maîtrise de la notion"
            size={64}
            thickness={6}
          />
          <p className="text-sm text-muted-foreground">
            Vous savez repérer l'hypoténuse. Il reste à calculer un côté de
            l'angle droit.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-control bg-warning-soft px-3 py-2 text-sm text-warning-text">
          <Lightbulb weight="bold" className="size-4 shrink-0" />
          Idée fausse repérée : additionner les côtés au lieu de leurs carrés.
        </div>
        <Button variant="brand" size="sm" className="mt-auto self-start">
          S'entraîner
        </Button>
      </article>
    </CardShell>
  );
}

function ExerciseCard() {
  return (
    <CardShell tone="brand" className="h-full">
      <article
        className={cn(
          "flex flex-1 flex-col gap-4 rounded-card border bg-card p-5",
          CARD_INNER_SHADOW,
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand">
            <Sparkle weight="fill" />
            Proposé par l'IA
          </Badge>
          <Badge variant="neutral">Niveau 2</Badge>
          <Badge variant="info">
            <Timer weight="bold" />
            10 min
          </Badge>
        </div>
        <div>
          <h4 className="font-semibold tracking-tight">
            Calculer une longueur
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Dans le triangle ABC rectangle en A, on donne{" "}
            <span className="font-math italic">AB = 6</span> et{" "}
            <span className="font-math italic">AC = 8</span>. Calculer{" "}
            <span className="font-math italic">BC</span>.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Réussite de la classe</span>
            <span className="tabular-nums">18 / 26</span>
          </div>
          <Progress value={69} aria-label="Réussite de la classe" />
        </div>
        <div className="mt-auto flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm">
            Aperçu
          </Button>
          <Button variant="outline" size="sm">
            <PencilSimpleLine />
            Donner en devoir
          </Button>
        </div>
      </article>
    </CardShell>
  );
}

export function Cards({ id, index, title }: SectionProps) {
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Une carte regroupe ce qui concerne un même objet (une classe, un enfant, une notion). Le cadre biseauté TsfFrame est réservé aux temps forts : la carte héro d'un espace ou une réussite."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Carte simple · Card" bare>
          <Card>
            <CardHeader>
              <CardTitle>Prochaine séance</CardTitle>
              <CardDescription>Avec Mme Agossou, en visio</CardDescription>
              <CardAction>
                <Badge variant="success">Confirmée</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex items-center gap-3 text-sm">
              <CalendarCheck
                weight="bold"
                className="size-5 text-muted-foreground"
              />
              Jeudi 14 novembre, 17 h 30 – 18 h 15
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="ghost" size="sm">
                Déplacer
              </Button>
              <Button size="sm">Rejoindre</Button>
            </CardFooter>
          </Card>
        </Specimen>
        <Specimen label="Carte atténuée · Card muted" bare>
          <Card variant="muted">
            <CardHeader>
              <CardTitle>Le saviez-vous ?</CardTitle>
              <CardDescription>
                Le prof IA ne donne jamais la réponse : il pose des questions et
                propose des indices, du plus léger au plus précis.
              </CardDescription>
            </CardHeader>
          </Card>
        </Specimen>
      </div>

      <Specimen
        label="Teintes de coque · Card tone"
        note={'neutral par défaut ; variant="flat" retire la coque'}
        bare
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CARD_TONES.map((t) => (
            <Card key={t} tone={t} className="gap-3 py-5">
              <CardHeader className="px-5">
                <CardTitle className="font-mono text-xs tracking-wide">
                  tone=&quot;{t}&quot;
                </CardTitle>
                <CardDescription>
                  {t === "neutral"
                    ? "Papier : la coque par défaut."
                    : "Coque teintée, carte intérieure inchangée."}
                </CardDescription>
              </CardHeader>
              {t === "brand" ? (
                <CardContent className="px-5">
                  <Card variant="flat" className="gap-1 px-4 py-3 text-sm">
                    Carte dans une carte : variant=&quot;flat&quot;
                  </Card>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      </Specimen>

      <Specimen label="Carte héro biseautée · TsfFrame" bare>
        <TsfFrame innerClassName="flex flex-col gap-6 p-6 sm:p-8">
          <TsfEyebrow phrases={["Cette semaine"]} rule={false} dots={false} />
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="text-3xl font-light tracking-tight sm:text-4xl">
                Trois notions validées, une de plus que la semaine dernière.
              </p>
              <p className="mt-2 text-muted-foreground">
                Continuez sur les équations : c'est la prochaine marche.
              </p>
            </div>
            <Button variant="bevel">Reprendre</Button>
          </div>
        </TsfFrame>
      </Specimen>

      <Specimen label="Chiffres clés · StatTile" bare>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Élèves suivis"
            value={84}
            icon={<Student weight="fill" />}
            tone="sky"
            hint="Dans 3 classes"
          />
          <StatTile
            label="Notions validées"
            value={0.46}
            format={{ style: "percent" }}
            delta={{
              value: 0.06,
              format: { style: "percent" },
              label: "en 1 semaine",
            }}
            icon={<ChartLineUp weight="fill" />}
            tone="mint"
            trend={[31, 33, 36, 35, 39, 42, 46]}
          />
          <StatTile
            label="Devoirs en retard"
            value={5}
            delta={{ value: 2, goodWhen: "down", label: "depuis lundi" }}
            icon={<WarningCircle weight="fill" />}
            tone="rose"
          />
          <StatTile
            label="Temps moyen"
            value="24 min"
            icon={<Clock weight="fill" />}
            tone="amber"
            hint="Par séance avec le prof IA"
          />
        </div>
      </Specimen>

      <Specimen
        label="Indicateur détaillé · MetricCard"
        note="Comparaison, action, état sans données et chargement"
        bare
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Progression du pilote"
            value={0.27}
            format={{ style: "percent" }}
            delta={{ value: 0.08, format: { style: "percent" } }}
            comparison="par rapport au début du pilote"
            icon={<ChartLineUp weight="fill" />}
            tone="mint"
            size="lg"
          />
          <MetricCard
            label="Copies à relire"
            value={7}
            icon={<PencilSimpleLine weight="fill" />}
            tone="yellow"
            action={
              <Button size="xs" variant="outline">
                Relire
              </Button>
            }
          />
          <MetricCard
            label="Temps d'écran moyen"
            value={null}
            icon={<Clock weight="fill" />}
            tone="slate"
          />
          <MetricCardSkeleton />
        </div>
      </Specimen>

      <Specimen label="Carte d'enfant · espace parent" bare>
        <ChildCard
          organizationName="Collège des Manguiers"
          child={{
            learnerId: asLearnerId("demo-awa"),
            displayName: "Awa Diallo",
            organizationId: asOrganizationId("demo-org"),
            notions: { mastered: 12, inProgress: 7, needsWork: 3 },
            assignments: { pending: 2, late: 1, done: 9 },
            nextActions: [
              { kind: "assignment_due", reason: "" },
              { kind: "misconception_focus", reason: "" },
              { kind: "spaced_review", reason: "" },
            ],
            subjects: ["Mathématiques"],
            lastActivityAt: "2026-11-10T14:00:00.000Z",
            nextSteps: ["Équations du premier degré", "Théorème de Pythagore"],
            week: {
              days: [4, 5, 6, 7, 8, 9, 10].map((d, i) => ({
                date: `2026-11-${String(d).padStart(2, "0")}`,
                answers: [3, 0, 5, 2, 0, 6, 4][i] ?? 0,
              })),
              answers: 20,
              correct: 15,
              activeDays: 5,
              validated: ["Fractions : additionner"],
              reworked: ["Nombres relatifs"],
            },
          }}
        />
      </Specimen>

      <div className="grid gap-6 lg:grid-cols-3">
        <Specimen label="Carte de classe · prof" bare>
          <ClassCard
            title="4e B · Mathématiques"
            subtitle="Collège des Manguiers"
            icon={<GraduationCap weight="fill" />}
            tone="sky"
            progress={46}
            progressLabel="Notions validées par la classe"
            stats={[
              { label: "Élèves", value: 28 },
              { label: "Validées", value: "46 %" },
              { label: "Bloqués", value: 3, tone: "alert" },
            ]}
            students={CLASS_STUDENTS}
            studentsLabel="28 élèves"
            flagged={CLASS_STUDENTS.slice(0, 3)}
            flaggedLabel="À aider cette semaine"
            titleAs="h4"
            action={
              <Button variant="outline" size="sm">
                Ouvrir la classe
                <ArrowRight />
              </Button>
            }
          />
        </Specimen>
        <Specimen label="Carte de notion · élève" bare>
          <NotionCard />
        </Specimen>
        <Specimen label="Carte d'exercice · banque" bare>
          <ExerciseCard />
        </Specimen>
      </div>
    </Section>
  );
}
