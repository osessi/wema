import type { Metadata } from "next";
import { Care } from "../../components/familles/care";
import { FamilyClosing } from "../../components/familles/closing";
import { Concerns } from "../../components/familles/concerns";
import { FamilyFaq } from "../../components/familles/faq";
import { FamilyHero } from "../../components/familles/hero";
import { FamilyOffer } from "../../components/familles/offer";
import { ParentSpace } from "../../components/familles/parent-space";
import { Steps } from "../../components/familles/steps";
import { pageMetadata } from "../../lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Familles",
  description:
    "Un prof particulier IA dans chaque matière où votre enfant en a besoin, et un espace parent pour suivre ce qu'il a compris, preuves à l'appui.",
  path: "/familles",
});

export default function FamiliesPage() {
  return (
    <>
      <FamilyHero />
      <Concerns />
      <Steps />
      <ParentSpace />
      <Care />
      <FamilyOffer />
      <FamilyFaq />
      <FamilyClosing />
    </>
  );
}
