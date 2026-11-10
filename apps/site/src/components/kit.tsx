import type { CSSProperties, ReactNode } from "react";

/** Style avec variables CSS (« --c », « --tone »…). */
export type StyleVars = CSSProperties & {
  [key: `--${string}`]: string | number;
};

/** Assemble des classes en ignorant les valeurs vides. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Cadre biseauté : coins haut gauche et bas droit coupés, liseré inclus. */
export function Frame({
  cut = 16,
  edge,
  className,
  children,
  as: Tag = "div",
  id,
}: {
  cut?: number;
  edge?: string;
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "article" | "li";
  id?: string;
}) {
  const style: StyleVars = { "--c": `${cut}px` };
  if (edge) style["--edge"] = edge;
  return (
    <Tag id={id} className={cx("frame", className)} style={style}>
      {children}
      <span aria-hidden="true" className="frame-rim" />
    </Tag>
  );
}

/** Étiquette de section : losange, texte, pointillés. */
export function Eyebrow({ children }: { children: string }) {
  return (
    <p className="eyebrow">
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M6 1 11 6 6 11 1 6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
      {children}
      <span className="dots" aria-hidden="true" />
    </p>
  );
}

/**
 * Titre de section en deux temps : la phrase, puis sa suite en jaune.
 * `tone` choisit l'encre de la suite selon le fond.
 */
export function SectionTitle({
  lead,
  follow,
  tone = "light",
  as: Tag = "h2",
  className,
}: {
  lead: string;
  follow: string;
  tone?: "light" | "dark";
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <Tag
      className={cx(
        "font-display text-[clamp(2.1rem,4.6vw,3.6rem)] leading-[1.04] font-light tracking-[-0.035em] text-balance",
        className,
      )}
    >
      <span className="block">{lead}</span>
      <span
        className={cx(
          "block",
          tone === "dark" ? "text-brand" : "text-brand-ink",
        )}
      >
        {follow}
      </span>
    </Tag>
  );
}

/** En-tête de section centré : étiquette, titre, chapeau. */
export function SectionHead({
  eyebrow,
  lead,
  follow,
  text,
  tone = "light",
}: {
  eyebrow: string;
  lead: string;
  follow: string;
  text?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionTitle lead={lead} follow={follow} tone={tone} className="mt-6" />
      {text ? (
        <p
          className={cx(
            "mt-5 max-w-[58ch] text-[17px] leading-relaxed text-pretty",
            tone === "dark" ? "text-graphite-muted" : "text-ink-muted",
          )}
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}

const SEAM =
  "M0 0H5.63C13.438 0 19.166 7.337 17.272 14.91L11.182 39.269A11.527 11.527 0 0 1 0 48V0Z";
const TILE =
  "M6.728 9.09A12 12 0 0 1 18.369 0H39C45.627 0 51 5.373 51 12V36C51 42.627 45.627 48 39 48H12.37C4.561 48 -1.167 40.663 0.727 33.09L6.728 9.09Z";
const ARROW =
  "M7.703 5.8H.398V4.6h7.305l-3.36-3.36.855-.84 4.8 4.8-4.8 4.8-.855-.84 3.36-3.36Z";

/** L'action principale : languette jaune et tuile inclinée. */
export function SlantButton({
  href,
  children,
  className,
}: {
  href: string;
  children: string;
  className?: string;
}) {
  return (
    <a href={href} className={cx("slant", className)}>
      <span className="slant-label">
        {children}
        <svg viewBox="0 0 18 48" aria-hidden="true">
          <path d={SEAM} />
        </svg>
      </span>
      <span className="slant-tile" aria-hidden="true">
        <svg viewBox="0 0 51 48" aria-hidden="true">
          <path d={TILE} />
        </svg>
        <svg viewBox="0 0 10 10" className="slant-arrow" aria-hidden="true">
          <path d={ARROW} />
        </svg>
      </span>
    </a>
  );
}

function tileStyle(tone: string, size: number): StyleVars {
  return { "--tone": tone, width: size, height: size };
}

/** Pastille d'icône lumineuse, teintée par `tone`. */
export function GlowTile({
  tone,
  size = 44,
  children,
  className,
}: {
  tone: string;
  size?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx("glow-tile shrink-0", className)}
      style={tileStyle(tone, size)}
    >
      {children}
    </span>
  );
}

/** Petite étiquette en chasse fixe, pour les figures. */
export function Mono({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("font-mono text-[11px] tracking-wide", className)}>
      {children}
    </span>
  );
}

/** Pastille arrondie, pour les réglages que l'on choisit. */
export function Chip({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "mint" | "rose" | "peach";
}) {
  const tones = {
    brand: "bg-brand text-ink",
    mint: "bg-mint text-mint-ink",
    rose: "bg-rose text-rose-ink",
    peach: "bg-peach text-peach-ink",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
