"use client";

import {
  ArrowRight,
  DownloadSimple,
  PaperPlaneTilt,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { TsfCta } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { ButtonGroup } from "@wema/ui/components/ui/button-group";
import { Spinner } from "@wema/ui/components/ui/spinner";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const VARIANTS = [
  ["default", "Action courante"],
  ["brand", "Action phare, une par zone"],
  ["outline", "Action secondaire"],
  ["secondary", "Action discrète"],
  ["ghost", "Dans une barre d'outils"],
  ["destructive", "Supprimer, retirer"],
  ["link", "Lien dans le texte"],
] as const;

const SIZES = ["xs", "sm", "default", "lg"] as const;

export function Buttons({ id, index, title }: SectionProps) {
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Un bouton déclenche une action. Le jaune est rare : une seule action phare par zone ; le biseauté est réservé à l'action principale d'un écran."
    >
      <Specimen label="Variantes">
        <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
          {VARIANTS.map(([variant, use]) => (
            <li key={variant} className="flex flex-col items-start gap-2">
              <Button variant={variant}>
                {variant === "destructive" ? <Trash weight="bold" /> : null}
                {variant === "brand" ? "Commencer" : "Enregistrer"}
              </Button>
              <span className="font-mono text-[11px] text-muted-foreground">
                {variant}
              </span>
              <span className="text-xs text-muted-foreground">{use}</span>
            </li>
          ))}
          <li className="flex flex-col items-start gap-2">
            <Button variant="bevel">Lancer le test</Button>
            <span className="font-mono text-[11px] text-muted-foreground">
              bevel
            </span>
            <span className="text-xs text-muted-foreground">
              Action phare d'un écran, 44 px
            </span>
          </li>
        </ul>
      </Specimen>

      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Tailles">
          <div className="flex flex-col gap-4">
            {(["default", "brand"] as const).map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-3">
                {SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    {size}
                  </Button>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button size="icon-xs" variant="outline" aria-label="Ajouter">
                <Plus weight="bold" />
              </Button>
              <Button size="icon-sm" variant="outline" aria-label="Ajouter">
                <Plus weight="bold" />
              </Button>
              <Button size="icon" variant="outline" aria-label="Ajouter">
                <Plus weight="bold" />
              </Button>
              <Button size="icon-lg" variant="brand" aria-label="Envoyer">
                <PaperPlaneTilt weight="bold" />
              </Button>
            </div>
          </div>
        </Specimen>

        <Specimen label="États et compositions">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled>Indisponible</Button>
              <Button variant="brand" disabled>
                <Spinner />
                Envoi…
              </Button>
              <Button variant="outline">
                Continuer
                <ArrowRight weight="bold" />
              </Button>
            </div>
            <ButtonGroup aria-label="Export">
              <Button variant="outline">
                <DownloadSimple weight="bold" />
                PDF
              </Button>
              <Button variant="outline">CSV</Button>
              <Button variant="outline">Imprimer</Button>
            </ButtonGroup>
          </div>
        </Specimen>
      </div>

      <Specimen
        label="Bouton biseauté du site · TsfCta"
        note="Coin coupé, balayage au survol, flèche révélée"
      >
        <div className="flex flex-wrap items-center gap-4">
          <TsfCta tone="brand">Découvrir mon niveau</TsfCta>
          <TsfCta>Voir la progression</TsfCta>
          <TsfCta tone="brand" size="sm">
            Inscrire ma classe
          </TsfCta>
          <TsfCta size="sm">Plus tard</TsfCta>
        </div>
      </Specimen>
    </Section>
  );
}
