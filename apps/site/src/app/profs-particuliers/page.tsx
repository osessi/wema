import type { Metadata } from "next";
import { Audiences } from "../../components/profs/audiences";
import { ProfsClosing } from "../../components/profs/closing";
import { ProfsFaq } from "../../components/profs/faq";
import { ProfsHero } from "../../components/profs/hero";
import { Limits } from "../../components/profs/limits";
import { TeacherSetup } from "../../components/profs/teacher-setup";
import { TeacherWeek } from "../../components/profs/teacher-week";
import { pageMetadata } from "../../lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Profs particuliers",
  description:
    "Vous créez votre espace prof, vos groupes et inscrivez vos élèves. Chaque semaine, vous choisissez des exercices dans la banque ; l'IA les décline pour chaque élève et assure le suivi entre les séances.",
  path: "/profs-particuliers",
});

export default function PrivateTeachersPage() {
  return (
    <>
      <ProfsHero audience="profs" />
      <TeacherSetup />
      <TeacherWeek audience="profs" />
      <Limits />
      <Audiences current="profs" />
      <ProfsFaq audience="profs" />
      <ProfsClosing audience="profs" />
    </>
  );
}
