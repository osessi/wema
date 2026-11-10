import { appLinks } from "../../lib/site";
import { IconStack } from "../../wa/components/spaceui/icon-stack";
import { Frame } from "../../wa/components/v2/primitives";
import { TsfCta, TsfLink } from "../../wa/components/v2/tsf/tsf-cta";
import { TsfEyebrow } from "../../wa/components/v2/tsf/tsf-eyebrow";
import { TsfTitle } from "../../wa/components/v2/tsf/tsf-title";
import { contactHref } from "../../wa/config/site";

const STAGES = [
  "La banque",
  "Votre choix",
  "Une variante par élève",
  "Le suivi",
  "La séance",
] as const;
const STEP_SECONDS = 1.4;

const COPY = {
  profs: {
    phrases: ["Profs particuliers", "Vos groupes", "Vos élèves"],
    lines: ["Composez votre première", "banque de la semaine."],
    text: "Créez votre espace prof, inscrivez vos élèves, retenez vos premiers exercices et donnez-les à vos groupes.",
    cta: { href: appLinks.signupTeacher, label: "Créer mon espace prof" },
    link: { href: contactHref, label: "Parler à l'équipe" },
  },
  ecoles: {
    phrases: ["Écoles", "Réseaux de profs"],
    lines: ["Parlons de vos classes", "et de votre contrat."],
    text: "Décrivez votre établissement ou votre réseau : nombre de classes, programmes, matières. L'équipe prépare avec vous le contrat.",
    cta: { href: contactHref, label: "Parler à l'équipe" },
    link: {
      href: "/profs-particuliers",
      label: "Vous êtes prof particulier ?",
    },
  },
} as const;

export function ProfsClosing({
  audience,
}: {
  readonly audience: "profs" | "ecoles";
}) {
  const copy = COPY[audience];
  return (
    <section
      aria-labelledby="profs-closing-title"
      className="relative px-5 py-24 sm:px-8 sm:py-32"
    >
      <style>{`
        @keyframes profs-closing-lit {
          0%, 2% { color: rgb(245 246 240 / 0.45); border-color: rgb(245 246 240 / 0.12); background: transparent; }
          5%, 16% { color: #1a1403; border-color: #ffc529; background: #ffc529; }
          20%, 100% { color: rgb(245 246 240 / 0.45); border-color: rgb(245 246 240 / 0.12); background: transparent; }
        }
        .profs-closing-stage { animation: profs-closing-lit ${STAGES.length * STEP_SECONDS}s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .profs-closing-stage { animation: none; } }
      `}</style>
      <div className="mx-auto w-full max-w-[1280px]">
        <Frame tone="graphite" innerClassName="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_115%,rgb(255_197_41/0.38),transparent_70%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:radial-gradient(rgb(245_246_240/0.16)_1px,transparent_1px)] [background-size:22px_22px]"
          />
          <div className="relative flex flex-col items-center gap-9 px-6 py-20 text-center sm:px-12 sm:py-28 lg:py-32">
            <IconStack className="h-24 w-22 text-[#F5F6F0] **:data-[slot=icon-stack-layer]:fill-[#1B1C16]">
              <svg
                viewBox="0 0 30 30"
                width={22}
                height={22}
                aria-hidden="true"
              >
                <rect width="30" height="30" rx="8" fill="#FFC529" />
                <path
                  d="M7.2 8.5h2.9l2.3 9.1 2.4-9.1h2.4l2.4 9.1 2.3-9.1h2.9l-3.8 13h-2.7l-2.3-8.6-2.3 8.6h-2.7z"
                  fill="#1A1403"
                />
              </svg>
            </IconStack>
            <TsfEyebrow phrases={[...copy.phrases]} />
            <TsfTitle
              id="profs-closing-title"
              lines={[
                copy.lines[0],
                <span key="out" className="text-[#ffc529]">
                  {copy.lines[1]}
                </span>,
              ]}
              className="max-w-[980px] text-[44px] leading-[1.02] text-[#F5F6F0] sm:text-[72px] lg:text-[88px]"
            />
            <p className="max-w-[580px] text-[18px] leading-relaxed text-[#F5F6F0]/80 sm:text-[20px]">
              {copy.text}
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
              <TsfCta href={copy.cta.href} tone="accent" className="h-14 px-7">
                {copy.cta.label}
              </TsfCta>
              <TsfLink
                href={copy.link.href}
                className="text-[16px] font-medium !text-[#F5F6F0]"
              >
                {copy.link.label}
              </TsfLink>
            </div>
            <ol
              aria-label="La semaine d'un prof avec Wema"
              className="mt-4 flex flex-wrap items-center justify-center gap-2"
            >
              {STAGES.map((stage, index) => (
                <li
                  key={stage}
                  className="profs-closing-stage border border-white/12 px-3 py-1.5 font-mono text-[13px] font-medium text-[#F5F6F0]/45"
                  style={{ animationDelay: `${index * STEP_SECONDS}s` }}
                >
                  {stage}
                </li>
              ))}
            </ol>
          </div>
        </Frame>
      </div>
    </section>
  );
}
