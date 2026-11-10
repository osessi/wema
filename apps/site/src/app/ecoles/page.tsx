import type { Metadata } from "next";
import { Audiences } from "../../components/profs/audiences";
import { ProfsClosing } from "../../components/profs/closing";
import { ProfsFaq } from "../../components/profs/faq";
import { ProfsHero } from "../../components/profs/hero";
import { Limits } from "../../components/profs/limits";
import { SchoolSection } from "../../components/profs/school-section";
import { TeacherWeek } from "../../components/profs/teacher-week";
import { pageMetadata } from "../../lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Écoles et réseaux",
  description:
    "Classes, élèves inscrits par import d'un fichier, rôles et suivi par classe pour la direction. Chaque devoir est décliné pour chaque élève, et l'établissement est facturé sur contrat.",
  path: "/ecoles",
});

export default function SchoolsPage() {
  return (
    <>
      <ProfsHero audience="ecoles" />
      <SchoolSection />
      <TeacherWeek audience="ecoles" />
      <Limits />
      <Audiences current="ecoles" />
      <ProfsFaq audience="ecoles" />
      <ProfsClosing audience="ecoles" />
    </>
  );
}
