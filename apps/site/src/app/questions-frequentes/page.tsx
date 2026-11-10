import type { Metadata } from "next";
import {
  BannerEyebrow,
  GradientBanner,
} from "../../components/banner/gradient-banner";
import { FaqThemes, faqGroups } from "../../components/faq/faq-themes";
import { faq } from "../../lib/faq";
import { pageMetadata } from "../../lib/metadata";
import { ClosingSection } from "../../wa/components/v2/closing-section";
import { TsfTitle } from "../../wa/components/v2/tsf/tsf-title";

export const metadata: Metadata = pageMetadata({
  title: "Questions fréquentes",
  description:
    "Prix par matière, essai gratuit, matières et pays, réponses aux devoirs, besoins dys ou TDAH, données des enfants : les réponses à vos questions sur Wema.",
  path: "/questions-frequentes",
});

export default function FaqPage() {
  return (
    <>
      <GradientBanner gradient="w58">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-14">
          <div className="flex max-w-[720px] flex-col gap-5">
            <BannerEyebrow>
              Questions fréquentes · {faq.length} réponses
            </BannerEyebrow>
            <TsfTitle
              as="h1"
              lines={[
                "Ce qu’on nous demande",
                <span key="accent" className="text-[#8a6500]">
                  avant de commencer.
                </span>,
              ]}
              className="text-balance text-[38px] leading-[1.04] font-light tracking-[-0.045em] sm:text-[56px] lg:text-[68px]"
            />
            <p className="max-w-[560px] text-[17px] leading-relaxed font-medium text-pretty text-[#0D0E0B]/85 sm:text-[19px]">
              L’essai et le prix, le rôle du prof IA, les besoins particuliers,
              les données des enfants, la place des profs et des écoles : les
              réponses, sans détour.
            </p>
          </div>
          <nav aria-label="Aller à un thème" className="lg:max-w-[360px]">
            <ul className="flex flex-wrap gap-2">
              {faqGroups.map((group) => (
                <li key={group.id}>
                  <a
                    href={`#${group.id}`}
                    className="inline-flex min-h-10 items-center gap-2 border border-[#0D0E0B]/15 bg-white/55 px-3.5 text-[14.5px] font-medium text-[#0D0E0B] backdrop-blur-md transition-colors hover:border-[#0D0E0B]/40 hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0E0B]"
                  >
                    {group.label}
                    <span className="font-mono text-[11.5px] text-[#0D0E0B]/55 tabular-nums">
                      {String(group.items.length).padStart(2, "0")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </GradientBanner>
      <FaqThemes />
      <ClosingSection />
    </>
  );
}
