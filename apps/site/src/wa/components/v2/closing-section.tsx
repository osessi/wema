import { loginHref, signupHref } from '../../config/site';
import { IconStack } from '../spaceui/icon-stack';
import { Frame } from './primitives';
import { TsfCta, TsfLink } from './tsf/tsf-cta';
import { TsfEyebrow } from './tsf/tsf-eyebrow';
import { TsfTitle } from './tsf/tsf-title';

const STAGES = ['Une question', 'Un indice', 'Un essai', 'Trouvé', 'Retenu'] as const;
const STEP_SECONDS = 1.4;

export function ClosingSection() {
  return (
    <section
      data-section="closing"
      aria-labelledby="closing-title"
      className="relative px-5 py-24 sm:px-8 sm:py-32"
    >
      <style>{`
        @keyframes closing-lit {
          0%, 2% { color: rgb(245 246 240 / 0.45); border-color: rgb(245 246 240 / 0.12); background: transparent; }
          5%, 16% { color: #1a1403; border-color: #ffc529; background: #ffc529; }
          20%, 100% { color: rgb(245 246 240 / 0.45); border-color: rgb(245 246 240 / 0.12); background: transparent; }
        }
        .closing-stage { animation: closing-lit ${STAGES.length * STEP_SECONDS}s linear infinite; }
        @keyframes icon-stack-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .icon-stack-float { animation: icon-stack-float 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .closing-stage, .icon-stack-float { animation: none; } }
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
              <svg viewBox="0 0 30 30" width={22} height={22} aria-hidden="true">
                <rect width="30" height="30" rx="8" fill="#FFC529" />
                <path d="M7.2 8.5h2.9l2.3 9.1 2.4-9.1h2.4l2.4 9.1 2.3-9.1h2.9l-3.8 13h-2.7l-2.3-8.6-2.3 8.6h-2.7z" fill="#1A1403" />
              </svg>
            </IconStack>
            <TsfEyebrow
              phrases={['Essai gratuit', 'Premier entretien offert', 'Sans moyen de paiement']}
            />
            <TsfTitle
              id="closing-title"
              lines={[
                'Essayez Wema dans la matière',
                <span key="out" className="text-[#ffc529]">
                  qui pose problème.
                </span>,
              ]}
              className="max-w-[980px] text-[44px] leading-[1.02] text-[#F5F6F0] sm:text-[72px] lg:text-[92px]"
            />
            <p className="max-w-[560px] text-[18px] leading-relaxed text-[#F5F6F0]/80 sm:text-[20px]">
              Le prof IA fait connaissance avec votre enfant, puis l’accompagne exercice après
              exercice. Vous voyez ce qu’il a compris, preuves à l’appui.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
              <TsfCta href={signupHref} tone="accent" className="h-14 px-7">
                Commencer l’essai gratuit
              </TsfCta>
              <TsfLink href={loginHref} className="text-[16px] font-medium text-[#F5F6F0]">
                J’ai déjà un compte
              </TsfLink>
            </div>
            <ol
              aria-label="Le chemin de l’élève vers la réponse"
              className="mt-4 flex flex-wrap items-center justify-center gap-2"
            >
              {STAGES.map((stage, index) => (
                <li
                  key={stage}
                  className="closing-stage border border-white/12 px-3 text-[#F5F6F0]/45 py-1.5 font-mono text-[13px] font-medium"
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
