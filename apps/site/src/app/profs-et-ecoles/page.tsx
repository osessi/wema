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
  title: "Profs et écoles",
  description:
    "Chaque semaine, Wema vous propose une banque d'exercices par notion. Vous choisissez, l'IA décline chaque exercice pour chaque élève et assure le suivi entre les séances.",
  path: "/profs-et-ecoles",
});

export default function TeachersPage() {
  return (
    <>
      <ProfsHero />
      <Audiences />
      <TeacherWeek />
      <SchoolSection />
      <Limits />
      <ProfsFaq />
      <ProfsClosing />
    </>
  );
}
