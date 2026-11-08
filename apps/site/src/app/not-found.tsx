import type { Metadata } from "next";
import {
  BannerEyebrow,
  GradientBanner,
} from "../components/banner/gradient-banner";
import { NotFoundLinks } from "../components/not-found/not-found-links";
import { TsfCta } from "../wa/components/v2/tsf/tsf-cta";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <GradientBanner gradient="w20" className="lg:pt-[170px] lg:pb-16">
        <div className="flex max-w-[760px] flex-col items-start gap-6">
          <BannerEyebrow dark>Erreur 404 · Page introuvable</BannerEyebrow>
          <h1 className="text-balance text-[40px] leading-[1.04] font-light tracking-[-0.045em] sm:text-[60px] lg:text-[72px]">
            Cette page n’existe pas.{" "}
            <span className="text-[#ffe08a]">Le reste du site, si.</span>
          </h1>
          <p className="max-w-[540px] text-[17px] leading-relaxed font-medium text-pretty text-white/90 sm:text-[19px]">
            Le lien est peut-être ancien, ou l’adresse a été mal saisie.
            Repartez de l’accueil ou choisissez une page ci-dessous.
          </p>
          <TsfCta href="/" tone="accent" className="h-14 px-7">
            Revenir à l’accueil
          </TsfCta>
        </div>
      </GradientBanner>
      <NotFoundLinks />
    </>
  );
}
