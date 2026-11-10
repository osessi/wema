"use client";

import {
  Confetti,
  HandsClapping,
  Plant,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/illustration";
import {
  CardSkeleton,
  ChartSkeleton,
  ListSkeleton,
  Nudge,
  SkeletonGroup,
  WaveLoader,
} from "@wema/ui/components/patterns/index";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { Spinner } from "@wema/ui/components/ui/spinner";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { SuccessBurst } from "@wema/ui/components/wema/success-burst";
import { useState } from "react";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Nudges() {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-3">
      <Nudge
        tone="encourage"
        icon={<Plant weight="fill" />}
        title="Tu as travaillé trois jours de suite cette semaine."
        description="La régularité compte plus que la durée. Continue comme ça !"
        open={open}
        onDismiss={() => setOpen(false)}
      />
      {!open ? (
        <Button
          size="xs"
          variant="outline"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          Réafficher
        </Button>
      ) : null}
      <Nudge
        tone="success"
        icon={<HandsClapping weight="fill" />}
        title="Tu as réussi sans indice cette fois."
      />
      <Nudge
        tone="info"
        title="Votre conseiller vous attend jeudi à 17 h."
        description="15 minutes pour compléter le profil de votre enfant."
      />
      <Nudge
        tone="announce"
        icon={<Confetti weight="fill" />}
        title="Nouveau : la lecture à voix haute."
      />
    </div>
  );
}

export function Feedback({ id, index, title }: SectionProps) {
  const [burst, setBurst] = useState(0);
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Dire à chaque instant ce qui se passe : un toast pour une action faite, ConfirmDialog avant toute action sensible, un squelette pendant un chargement, un état vide qui dit quoi faire, et des encouragements bienveillants, jamais de points ni de séries."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Toasts · toast">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => toast.success("Devoir envoyé à la classe.")}
            >
              Succès
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.error("L'envoi a échoué.", {
                  description: "Vérifiez la connexion puis réessayez.",
                })
              }
            >
              Erreur
            </Button>
            <Button
              variant="outline"
              onClick={() => toast("Brouillon enregistré.")}
            >
              Information
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.promise(wait(1500), {
                  loading: "Génération des exercices…",
                  success: "12 exercices prêts à relire.",
                  error: "Échec",
                })
              }
            >
              En cours
            </Button>
          </div>
        </Specimen>

        <Specimen label="Confirmation · ConfirmDialog">
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              trigger={<Button variant="outline">Publier le devoir</Button>}
              title="Publier le devoir pour la 4e B ?"
              description="Les 28 élèves le verront tout de suite dans leur espace."
              confirmLabel="Publier"
              pendingLabel="Publication…"
              onConfirm={async () => {
                await wait(900);
                toast.success("Devoir publié.");
              }}
            />
            <ConfirmDialog
              trigger={
                <Button variant="destructive">
                  <Trash weight="bold" />
                  Supprimer le compte
                </Button>
              }
              variant="destructive"
              icon={
                <GlowTile tone="rose" size={44}>
                  <WarningCircle weight="fill" />
                </GlowTile>
              }
              title="Supprimer le compte de démonstration ?"
              description="Le profil et l'historique seront effacés. Cette action est définitive."
              acknowledge="J'ai compris que cette suppression est définitive."
              confirmLabel="Supprimer"
              onConfirm={async () => {
                await wait(700);
                toast("Rien n'a été supprimé : c'est une démo.");
              }}
            />
          </div>
        </Specimen>

        <Specimen
          label="Réussite · SuccessBurst"
          note={
            <Button
              size="xs"
              variant="outline"
              onClick={() => setBurst((n) => n + 1)}
            >
              Rejouer
            </Button>
          }
        >
          <SuccessBurst
            playKey={burst}
            confetti
            title="Notion validée !"
            description="Théorème de Pythagore : trois exercices réussis d'affilée."
            action={<Button variant="brand">Notion suivante</Button>}
          />
        </Specimen>

        <Specimen label="Encouragements · Nudge">
          <Nudges />
        </Specimen>
      </div>

      <Specimen
        label="États vides · EmptyState avec illustration"
        note="Survolez les figures"
        bare
      >
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            illustration={ILLUSTRATION_FOR.emptyHomework}
            title="Aucun devoir pour l'instant"
            description="Votre prof n'a rien donné cette semaine. Profitez-en pour revoir une notion."
            action={<Button variant="outline">Revoir une notion</Button>}
          />
          <EmptyState
            illustration={ILLUSTRATION_FOR.emptyMessages}
            title="Aucun message"
            description="Écrivez au prof de votre enfant ou à l'équipe Wema."
            action={<Button>Nouveau message</Button>}
          />
          <EmptyState
            illustration={ILLUSTRATION_FOR.emptyClasses}
            title="Aucune classe"
            description="Créez une classe puis inscrivez vos élèves, un par un ou en masse."
            action={<Button variant="brand">Créer une classe</Button>}
          />
          <EmptyState
            illustration={ILLUSTRATION_FOR.emptyExercises}
            title="Aucun exercice dans la banque"
            description="Générez une première série : vous la relirez avant de la donner."
            action={<Button variant="outline">Générer des exercices</Button>}
          />
        </div>
      </Specimen>

      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Squelettes · SkeletonGroup">
          <SkeletonGroup
            label="Chargement du tableau de bord"
            className="flex flex-col gap-4"
          >
            <CardSkeleton media />
            <ListSkeleton rows={3} />
            <ChartSkeleton height={120} />
          </SkeletonGroup>
        </Specimen>
        <div className="flex flex-col gap-8">
          <Specimen label="Chargement · WaveLoader, Spinner">
            <div className="flex flex-wrap items-center gap-8">
              <WaveLoader label="Le prof IA prépare la séance" />
              <WaveLoader size="sm" />
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> Enregistrement…
              </span>
            </div>
          </Specimen>
          <Specimen label="Alertes · Alert">
            <div className="flex flex-col gap-3">
              <Alert variant="success">
                <AlertTitle>Profil mis à jour</AlertTitle>
                <AlertDescription>
                  Les conclusions du conseiller sont enregistrées.
                </AlertDescription>
              </Alert>
              <Alert variant="warning">
                <AlertTitle>Consentement en attente</AlertTitle>
                <AlertDescription>
                  Le besoin déclaré reste masqué tant que le parent n'a pas
                  accepté.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTitle>Import impossible</AlertTitle>
                <AlertDescription>
                  La ligne 14 n'a pas d'adresse e-mail.
                </AlertDescription>
              </Alert>
            </div>
          </Specimen>
        </div>
      </div>
    </Section>
  );
}
