/**
 * Bandeau d'engagements, sur le modèle de `wa/components/v2/trust-strip.tsx` :
 * une rangée de sceaux entre deux filets, chacun avec sa phrase d'explication.
 */

type Glyph = "no-answer" | "check" | "flag" | "lock" | "no-ad";

function SealGlyph({ glyph }: { glyph: Glyph }) {
  const stroke = {
    fill: "none",
    stroke: "#ffc529",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (glyph) {
    case "no-answer":
      // Un point d'interrogation : il questionne.
      return (
        <path
          {...stroke}
          d="M35.5 18.5a4.6 4.6 0 1 1 6.6 4.2c-1.4.7-2.1 1.6-2.1 3.1v.9M40 30.4v.2"
        />
      );
    case "check":
      return <path {...stroke} d="M33.5 23.6l4.2 4.2 8.8-9" />;
    case "flag":
      return <path {...stroke} d="M35 31V16.5h9.5l-1.8 3.4 1.8 3.4H35" />;
    case "lock":
      return (
        <>
          <rect {...stroke} x="34" y="21.5" width="12" height="9.5" rx="1.6" />
          <path {...stroke} d="M36.6 21.5v-2.4a3.4 3.4 0 0 1 6.8 0v2.4" />
        </>
      );
    case "no-ad":
      return (
        <>
          <circle {...stroke} cx="40" cy="23.6" r="7.2" />
          <path {...stroke} d="M35 18.6l10 10" />
        </>
      );
  }
}

function WemaSeal({
  label,
  top,
  bottom,
  glyph,
}: {
  label: string;
  top: string;
  bottom: string;
  glyph: Glyph;
}) {
  return (
    <svg
      viewBox="0 0 80 80"
      className="size-[72px] shrink-0"
      role="img"
      aria-label={label}
    >
      <circle cx="40" cy="40" r="39" fill="#0D0E0B" />
      <circle
        cx="40"
        cy="40"
        r="33"
        fill="none"
        stroke="#ffc529"
        strokeWidth="1.2"
      />
      <SealGlyph glyph={glyph} />
      {[top, bottom].map((line, i) => (
        <text
          key={line}
          x="40"
          y={46 + i * 11}
          textAnchor="middle"
          fontSize="8.6"
          fontWeight="800"
          fill="#FFFFFF"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          letterSpacing="0.4"
        >
          {line}
        </text>
      ))}
    </svg>
  );
}

const ITEMS: readonly {
  glyph: Glyph;
  top: string;
  bottom: string;
  title: string;
  line: string;
}[] = [
  {
    glyph: "no-answer",
    top: "JAMAIS",
    bottom: "LA RÉPONSE",
    title: "Jamais la réponse",
    line: "Il questionne et donne des indices, l'élève trouve.",
  },
  {
    glyph: "check",
    top: "CALCULS",
    bottom: "VÉRIFIÉS",
    title: "Calculs vérifiés",
    line: "Chaque calcul passe par un moteur de calcul, pas par l'IA.",
  },
  {
    glyph: "flag",
    top: "FRANCE",
    bottom: "BÉNIN",
    title: "Programmes officiels",
    line: "Le programme de la classe, en France et au Bénin.",
  },
  {
    glyph: "lock",
    top: "DONNÉES",
    bottom: "PROTÉGÉES",
    title: "Données protégées",
    line: "Export et suppression à tout moment, depuis l'espace parent.",
  },
  {
    glyph: "no-ad",
    top: "SANS",
    bottom: "PUBLICITÉ",
    title: "Sans publicité",
    line: "Aucune annonce, aucune donnée revendue.",
  },
];

export function Commitments() {
  return (
    <section
      aria-label="Nos engagements"
      className="px-5 pb-20 sm:px-8 sm:pb-28"
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <ul className="grid grid-cols-1 border-y border-[var(--tk-line)] min-[480px]:grid-cols-2 lg:grid-cols-5">
          {ITEMS.map((item, i) => (
            <li
              key={item.title}
              className={[
                "flex items-center gap-4 border-[var(--tk-line)] px-4 py-6 lg:flex-col lg:items-center lg:px-5 lg:text-center",
                i > 0 ? "border-t min-[480px]:border-t-0" : "",
                i >= 2 ? "min-[480px]:border-t lg:border-t-0" : "",
                i % 2 === 0 && i < ITEMS.length - 1
                  ? "min-[480px]:border-r"
                  : "",
                i === ITEMS.length - 1
                  ? "min-[480px]:col-span-2 lg:col-span-1"
                  : "",
                i < ITEMS.length - 1 ? "lg:border-r" : "",
              ].join(" ")}
            >
              <WemaSeal
                label={item.title}
                top={item.top}
                bottom={item.bottom}
                glyph={item.glyph}
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                  {item.title}
                </span>
                <span className="mt-1 block text-[13.5px] leading-snug text-foreground/65">
                  {item.line}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
