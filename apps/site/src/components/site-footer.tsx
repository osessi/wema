import Link from "next/link";
import { appLinks, pages } from "../lib/site";
import { Logo } from "./logo";

const legal = [
  { href: appLinks.legalNotice, label: "Mentions légales" },
  { href: appLinks.privacy, label: "Confidentialité" },
  { href: appLinks.terms, label: "Conditions d'utilisation" },
  { href: appLinks.cookies, label: "Cookies" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Un prof particulier IA par matière. Wema vient du fon wěmà, « livre,
            lettre ».
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Le site</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {pages.map((page) => (
              <li key={page.href}>
                <Link href={page.href} className="hover:text-ink">
                  {page.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={appLinks.login} className="hover:text-ink">
                Se connecter
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Informations légales</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {legal.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-ink">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-sm text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} Wema
      </p>
    </footer>
  );
}
