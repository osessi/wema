import { GlowIcon } from "../../wa/components/v2/glow-icon";
import { Frame } from "../../wa/components/v2/primitives";
import { TsfArrow } from "../../wa/components/v2/tsf/tsf-cta";
import {
  BooksIcon,
  EnvelopeIcon,
  HouseIcon,
  UsersThreeIcon,
} from "../../wa/ui/icons";

const LINKS = [
  {
    href: "/",
    label: "Accueil",
    text: "Wema en bref : un prof particulier IA par matière, qui ne donne jamais la réponse.",
    icon: HouseIcon,
    tone: "gold",
  },
  {
    href: "/familles",
    label: "Familles",
    text: "Ce que Wema fait pour votre enfant, et ce que vous voyez de ses progrès.",
    icon: UsersThreeIcon,
    tone: "ember",
  },
  {
    href: "/profs-particuliers",
    label: "Profs particuliers",
    text: "Une banque d’exercices chaque semaine, déclinée pour chaque élève.",
    icon: BooksIcon,
    tone: "indigo",
  },
  {
    href: "/contact",
    label: "Contact",
    text: "Vous cherchiez quelque chose de précis ? Écrivez à l’équipe.",
    icon: EnvelopeIcon,
    tone: "emerald",
  },
] as const;

export function NotFoundLinks() {
  return (
    <nav aria-label="Pages du site" className="px-5 py-16 sm:px-8 sm:py-24">
      <ul className="mx-auto grid w-full max-w-[1160px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="group block h-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              <Frame className="h-full">
                <div className="flex h-full flex-col gap-4 p-6">
                  <GlowIcon tone={link.tone} icon={link.icon} size={44} />
                  <span className="flex items-center gap-2 text-[19px] leading-tight font-semibold tracking-[-0.015em] text-foreground">
                    {link.label}
                    <span className="inline-block size-3.5 text-brand-active transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none dark:text-brand [&>svg]:size-full">
                      <TsfArrow />
                    </span>
                  </span>
                  <span className="text-[15.5px] leading-relaxed text-foreground/70">
                    {link.text}
                  </span>
                </div>
              </Frame>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
