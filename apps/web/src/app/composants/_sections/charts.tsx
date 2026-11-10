"use client";

import {
  AreaChart,
  BarChart,
  DonutChart,
  chartExamples as ex,
  LineChart,
  RadarChart,
  RadialChart,
  Sparkline,
} from "@wema/ui/components/charts/index";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const percent = (v: number) => `${v} %`;

export function Charts({ id, index, title }: SectionProps) {
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Une forme par question : une ligne pour une tendance, des aires pour une quantité dans le temps, des barres pour comparer, un anneau pour les parts d'un tout, un radar pour un profil. Chaque graphique a un nom accessible et un résumé lu par les lecteurs d'écran."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Ligne · une tendance">
          <LineChart
            label="Maîtrise moyenne de la classe de 4e B"
            summary="La maîtrise passe de 41 % à 68 % en 8 semaines, juste sous l'objectif."
            data={ex.classProgress}
            x="semaine"
            series={ex.classProgressSeries}
            valueFormatter={percent}
            domain={[0, 100]}
          />
        </Specimen>
        <Specimen label="Aires empilées · une quantité dans le temps">
          <AreaChart
            label="Séances par semaine, avec ou sans le prof IA"
            data={ex.weeklySessions}
            x="semaine"
            series={ex.weeklySessionsSeries}
            stacked
            integer
          />
        </Specimen>
        <Specimen label="Barres · comparer des catégories">
          <BarChart
            label="Temps passé par matière ce mois-ci"
            data={ex.timeBySubject}
            x="matiere"
            series={ex.timeBySubjectSeries}
            layout="horizontal"
            valueFormatter={ex.formatMinutes}
          />
        </Specimen>
        <Specimen label="Barres empilées · coûts d'IA (admin)">
          <BarChart
            label="Coûts d'IA par jour"
            data={ex.aiCostsByDay}
            x="jour"
            series={ex.aiCostsSeries}
            stacked
            valueFormatter={ex.formatUsd}
          />
        </Specimen>
        <Specimen label="Anneau · les parts d'un tout">
          <DonutChart
            label="Notions du programme par statut"
            data={ex.notionsByStatus}
            centerValue="122"
            centerLabel="notions"
          />
        </Specimen>
        <Specimen label="Radial · contre un même maximum">
          <RadialChart
            label="Avancement par chapitre"
            data={ex.chapterProgress}
            max={100}
            valueFormatter={percent}
          />
        </Specimen>
        <Specimen label="Radar · un profil">
          <RadarChart
            label="Profil de l'élève comparé à sa classe"
            data={ex.studentProfile}
            axis="axe"
            series={ex.studentProfileSeries}
            max={100}
          />
        </Specimen>
        <Specimen label="Demi-anneau et mini-courbes">
          <div className="flex flex-col gap-6">
            <div>
              <DonutChart
                label="Notions du programme par statut, en demi-anneau"
                data={ex.notionsByStatus}
                shape="half"
                legend={false}
                centerValue="46 %"
                centerLabel="validées"
              />
            </div>
            <div className="flex flex-wrap items-center gap-8">
              <div className="flex items-center gap-3 text-sm">
                <Sparkline
                  values={ex.sparkMastery}
                  label="Maîtrise sur 8 semaines"
                  tone="mint"
                  area
                />
                Maîtrise
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Sparkline
                  values={ex.sparkSessions}
                  label="Séances sur 8 semaines"
                />
                Séances
              </div>
            </div>
          </div>
        </Specimen>
      </div>
    </Section>
  );
}
