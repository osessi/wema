import { TsfEyebrow, TsfTitle } from "@wema/ui/brand";
import type { ReactNode } from "react";
import { ShellEyebrow } from "./shell/shell-context";

/**
 * En-tête de page, dans le style du site : sur-titre mono (par défaut le nom
 * de l'espace), titre `h1` en Geist léger révélé par `TsfTitle` (un seul `h1`,
 * dont le nom accessible reste le texte), sous-titre et actions à droite.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Sur-titre mono. Par défaut : le nom de l'espace courant. */
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-3xl space-y-2">
        {eyebrow ? (
          <TsfEyebrow phrases={[eyebrow]} dots={false} rule={false} />
        ) : (
          <ShellEyebrow />
        )}
        <TsfTitle
          as="h1"
          lines={title}
          className="text-[28px] leading-[1.1] text-foreground sm:text-[34px]"
        />
        {description && (
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
