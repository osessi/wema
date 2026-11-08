import { appLinks } from "../../lib/site";
import { GlowIcon } from "../../wa/components/v2/glow-icon";
import { Frame } from "../../wa/components/v2/primitives";
import { TsfLink } from "../../wa/components/v2/tsf/tsf-cta";
import { ChatsCircleIcon, CursorClickIcon } from "../../wa/ui/icons";

const NEXT_STEPS = [
  {
    title: "Vous écrivez",
    text: "Votre question, la classe et la matière concernées, ou votre projet pour vos élèves.",
  },
  {
    title: "Une personne lit votre message",
    text: "Pas de réponse automatique : quelqu’un de l’équipe Wema le lit en entier.",
  },
  {
    title: "Elle vous répond par e-mail",
    text: "Une réponse écrite pour votre situation, à l’adresse que vous avez indiquée.",
  },
] as const;

export function ContactAside() {
  return (
    <div className="flex flex-col gap-10">
      <div className="border-t border-foreground/10 pt-8">
        <h2 className="mb-5 font-mono text-[12px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
          Ce qui se passe ensuite
        </h2>
        <ol className="grid gap-5">
          {NEXT_STEPS.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[32px_1fr] gap-3">
              <span className="pt-[3px] font-mono text-[12px] font-medium text-brand-active tabular-nums dark:text-brand">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-[17px] leading-snug font-semibold tracking-[-0.01em] text-foreground">
                  {step.title}
                </p>
                <p className="mt-1 text-[15.5px] leading-relaxed text-foreground/70">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Frame>
          <div className="flex h-full flex-col gap-4 p-6">
            <GlowIcon
              tone="indigo"
              icon={ChatsCircleIcon}
              size={44}
              idle="breathe"
            />
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[11.5px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
                Peut-être déjà répondu
              </span>
              <p className="text-[15.5px] leading-relaxed text-foreground/75">
                Prix, essai, matières, besoins dys ou TDAH, données des enfants.
              </p>
            </div>
            <TsfLink
              href="/questions-frequentes"
              className="mt-auto self-start text-[15.5px] font-medium"
            >
              Questions fréquentes
            </TsfLink>
          </div>
        </Frame>
        <Frame>
          <div className="flex h-full flex-col gap-4 p-6">
            <GlowIcon
              tone="gold"
              icon={CursorClickIcon}
              size={44}
              idle="breathe"
            />
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[11.5px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
                Parent pressé ?
              </span>
              <p className="text-[15.5px] leading-relaxed text-foreground/75">
                Lancez l’essai gratuit : sans moyen de paiement, premier
                entretien offert.
              </p>
            </div>
            <TsfLink
              href={appLinks.signup}
              className="mt-auto self-start text-[15.5px] font-medium"
            >
              Commencer l’essai gratuit
            </TsfLink>
          </div>
        </Frame>
      </div>
    </div>
  );
}
