import "./auth.css";
import { cn } from "@wema/ui/lib/utils";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LegalLinks } from "../../components/legal/legal-links";

// Fond du panneau : « 19 Colorful Fractal Backgrounds » (gradientshub.com,
// libre d'usage), le même que l'accroche du site public. Les fichiers de
// public/ ne sont pas préfixés par Next : on ajoute le chemin de base.
const GRADIENT = `${process.env.WEMA_BASE_PATH ?? ""}/gradients/w19`;

const PROMISES = ["noAnswer", "checked", "progress"] as const;

/**
 * Cadre commun de la connexion, de l'inscription et de la création de famille,
 * dans le style du site public : panneau sur dégradé à gauche (bande en haut
 * sur mobile), formulaire dans un cadre biseauté sur fond papier à droite.
 * Geist et Geist Mono ne sont chargées que pour ces pages.
 */
export async function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations("app");
  const tShell = await getTranslations("auth.shell");
  return (
    <div className={cn("auth-shell", GeistSans.variable, GeistMono.variable)}>
      <span aria-hidden="true" className="auth-grain" />
      <aside className="auth-panel">
        <div className="auth-panel-cut">
          {/* biome-ignore lint/performance/noImgElement: image décorative de public/, servie telle quelle (pas d'optimiseur). */}
          <img
            className="auth-panel-img"
            src={`${GRADIENT}-1200.webp`}
            srcSet={`${GRADIENT}-600.webp 600w, ${GRADIENT}-1200.webp 1200w, ${GRADIENT}-2400.webp 2400w`}
            sizes="(min-width: 1024px) 50vw, 100vw"
            alt=""
            fetchPriority="high"
          />
          <div className="auth-panel-body">
            <div className="auth-logo">
              <span aria-hidden="true" className="auth-logo-mark">
                W
              </span>
              <span>{t("name")}</span>
            </div>
            <p className="auth-headline">
              <span>{tShell("headline")}</span>
              <span className="auth-headline-accent">
                {tShell("headlineAccent")}
              </span>
            </p>
            <ul className="auth-promises" aria-label={tShell("promisesLabel")}>
              {PROMISES.map((key, i) => (
                <li key={key}>
                  <span aria-hidden="true" className="auth-promise-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{tShell(`promises.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-column">
          <div className="auth-frame">
            <div className="auth-frame-cut">
              <p className="auth-eyebrow">
                <span aria-hidden="true" className="auth-diamond" />
                {tShell("label")}
              </p>
              {/* Titre de la page : le seul h1 (lecteurs d'écran, plan de page). */}
              <h1 className="auth-title">{title}</h1>
              <p className="auth-description">{description}</p>
              <div className="auth-content">{children}</div>
              {footer ? <div className="auth-footer">{footer}</div> : null}
              <span aria-hidden="true" className="auth-frame-rim" />
            </div>
            <span aria-hidden="true" className="auth-frame-mark" data-at="tr">
              <span className="auth-diamond" data-outline="" />
            </span>
            <span aria-hidden="true" className="auth-frame-mark" data-at="bl">
              <span className="auth-diamond" data-outline="" />
            </span>
          </div>
          <LegalLinks className="auth-legal" />
        </div>
      </main>
    </div>
  );
}
