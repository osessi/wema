import type { CSSProperties, ReactNode } from "react";
import { GradientField } from "../../wa/components/v2/hero/gradient-field";
import { cn } from "../../wa/ui/lib/utils";

/**
 * Bandeau d'accroche des pages intérieures : le cadre biseauté de l'accueil,
 * posé sur un des dégradés libres d'usage (gradientshub.com).
 *  - « w20 » : jaune et orange en haut, bleu nuit en bas (texte clair) ;
 *  - « w58 » : jaune et bleu doux (texte sombre).
 */
export function GradientBanner({
  gradient,
  children,
  className,
}: {
  readonly gradient: "w20" | "w58";
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const g = `/gradients/${gradient}`;
  const dark = gradient === "w20";
  return (
    <section className="relative px-2 pt-[88px] pb-2 sm:px-3 sm:pt-[96px] sm:pb-3 lg:pt-3">
      <div
        className="tk-frame"
        style={
          {
            "--c": "22px",
            "--tk-edge": dark
              ? "rgb(255 255 255 / 0.14)"
              : "rgb(13 14 11 / 0.12)",
          } as CSSProperties
        }
      >
        <div
          className={cn(
            "tk-frame-cut relative isolate overflow-hidden rounded-[20px]",
            dark ? "text-white" : "text-[#0D0E0B]",
          )}
        >
          <GradientField
            src={`${g}-2400.webp`}
            srcSet={`${g}-1200.webp 1200w, ${g}-2400.webp 2400w`}
            softSrc={`${g}-600.webp`}
            {...(dark
              ? { headVeil: "dark" as const, footVeil: "dark" as const }
              : {})}
          />
          {dark ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(12_9_2/0.12)_0%,rgb(12_9_2/0.4)_60%,rgb(12_9_2/0.6)_100%)]"
            />
          ) : (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.28)_0%,rgb(255_255_255/0.08)_55%,rgb(255_255_255/0.32)_100%)]"
            />
          )}
          <div
            className={cn(
              "relative px-5 pt-10 pb-8 sm:px-10 sm:pt-14 sm:pb-12 lg:px-14 lg:pt-[150px] lg:pb-14",
              className,
            )}
          >
            {children}
          </div>
          <span aria-hidden="true" className="tk-frame-rim" />
        </div>
      </div>
    </section>
  );
}

/** Étiquette mono du bandeau, avec le losange jaune de la pastille d'accueil. */
export function BannerEyebrow({
  children,
  dark = false,
}: {
  readonly children: ReactNode;
  readonly dark?: boolean;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2.5 font-mono text-[12px] font-medium tracking-[0.08em] uppercase",
        dark ? "text-white/80" : "text-[#0D0E0B]/70",
      )}
    >
      <span
        aria-hidden="true"
        className="size-2 rotate-45 bg-[#ffc529] shadow-[0_0_8px_#ffc529]"
      />
      {children}
    </p>
  );
}
