"use client";

import {
  At,
  Books,
  ChalkboardTeacher,
  Eye,
  GraduationCap,
  IdentificationCard,
  MagnifyingGlass,
  Microphone,
  PencilSimpleLine,
  Robot,
  SlidersHorizontal,
  SpeakerHigh,
  TreeStructure,
} from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { OtpInput } from "@wema/ui/components/patterns/index";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSection,
  FieldSet,
} from "@wema/ui/components/ui/field";
import { Input } from "@wema/ui/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@wema/ui/components/ui/input-group";
import { Label } from "@wema/ui/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@wema/ui/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@wema/ui/components/ui/select";
import { toast } from "@wema/ui/components/ui/sonner";
import { Switch } from "@wema/ui/components/ui/switch";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { PhotoDropzone } from "@wema/ui/components/wema/photo-dropzone";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import { useState } from "react";
import { MathInput } from "../../../components/learner/math";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

function Otp() {
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <OtpInput
        label="Code reçu par e-mail"
        value={code}
        onValueChange={(v) => {
          setCode(v);
          setDone(false);
        }}
        onComplete={() => setDone(true)}
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {done
          ? "Code complet : la vérification partirait maintenant."
          : "Six chiffres, collage accepté."}
      </p>
    </div>
  );
}

function MathAnswer() {
  const [answer, setAnswer] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="demo-math">Votre réponse</Label>
      <MathInput id="demo-math" onChange={setAnswer} />
      <p className="font-mono text-[11px] text-muted-foreground">
        Envoyé à services/math : {answer || "…"}
      </p>
    </div>
  );
}

const SUBJECTS = [
  {
    value: "maths",
    title: "Mathématiques",
    icon: "math",
    d: "Nombres, géométrie, fonctions",
  },
  {
    value: "fr",
    title: "Français",
    icon: "french",
    d: "Lecture, grammaire, rédaction",
  },
  {
    value: "pc",
    title: "Physique-chimie",
    icon: "physics",
    d: "Expériences et modèles",
  },
  { value: "svt", title: "SVT", icon: "biology", d: "Le vivant et la Terre" },
] as const;

function Choices() {
  const [subject, setSubject] = useState("maths");
  const [mode, setMode] = useState("ia");
  const [formats, setFormats] = useState<string[]>(["schema"]);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p id="demo-subject" className="text-sm font-medium">
          Matière
        </p>
        <ChoiceCards
          aria-labelledby="demo-subject"
          name="subject"
          value={subject}
          onValueChange={setSubject}
          columns={2}
          options={SUBJECTS.map((x) => ({
            value: x.value,
            title: x.title,
            description: x.d,
            media: <SubjectIcon icon={x.icon} size={40} />,
          }))}
        />
      </div>
      <div className="flex flex-col gap-3">
        <p id="demo-mode" className="text-sm font-medium">
          Mode de travail
        </p>
        <ChoiceCards
          aria-labelledby="demo-mode"
          name="mode"
          value={mode}
          onValueChange={setMode}
          columns={3}
          options={[
            {
              value: "ia",
              title: "Avec le prof IA",
              description: "Questions et indices, à son rythme",
              icon: <Robot weight="fill" />,
              tone: "yellow",
            },
            {
              value: "prof",
              title: "Avec un prof",
              description: "Séance en direct, en visio",
              icon: <ChalkboardTeacher weight="fill" />,
              tone: "mint",
            },
            {
              value: "seul",
              title: "En autonomie",
              description: "Exercices et révisions",
              icon: <Books weight="fill" />,
              tone: "sky",
            },
          ]}
        />
      </div>
      <div className="flex flex-col gap-3">
        <p id="demo-formats" className="text-sm font-medium">
          Formats préférés{" "}
          <span className="font-normal text-muted-foreground">
            (plusieurs choix)
          </span>
        </p>
        <ChoiceCards
          type="multiple"
          aria-labelledby="demo-formats"
          name="formats"
          value={formats}
          onValueChange={setFormats}
          columns={4}
          size="compact"
          options={[
            {
              value: "schema",
              title: "Schéma",
              icon: <TreeStructure weight="fill" />,
              tone: "sky",
            },
            {
              value: "oral",
              title: "À l'oral",
              icon: <SpeakerHigh weight="fill" />,
              tone: "rose",
            },
            {
              value: "ecrit",
              title: "Par écrit",
              icon: <PencilSimpleLine weight="fill" />,
              tone: "amber",
            },
            {
              value: "exemple",
              title: "Exemple résolu",
              icon: <GraduationCap weight="fill" />,
              tone: "mint",
            },
          ]}
        />
      </div>
    </div>
  );
}

export function Forms({ id, index, title }: SectionProps) {
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Chaque champ a un libellé visible, une aide si besoin et une erreur dite en texte. Un sélecteur natif sur mobile pour les longues listes, un interrupteur pour un réglage qui s'applique tout de suite, une case pour un choix à valider."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen
          label="Section de formulaire · FieldSection, Input, Textarea"
          bare
        >
          <FieldSection
            title="L'élève"
            description="Ce que le prof IA et le prof humain verront."
            icon={
              <GlowTile tone="sky" size={36}>
                <IdentificationCard weight="fill" />
              </GlowTile>
            }
          >
            <Field>
              <FieldLabel htmlFor="demo-name">Prénom de l'élève</FieldLabel>
              <Input id="demo-name" placeholder="Awa" />
              <FieldDescription>
                Tel qu'il sera affiché au prof.
              </FieldDescription>
            </Field>
            <Field data-invalid>
              <FieldLabel htmlFor="demo-mail">Adresse e-mail</FieldLabel>
              <Input
                id="demo-mail"
                type="email"
                defaultValue="parent@exemple"
                aria-invalid
                aria-describedby="demo-mail-error"
              />
              <FieldError id="demo-mail-error">
                Il manque la fin de l'adresse (par exemple « .com »).
              </FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="demo-note">Note sur l'élève</FieldLabel>
              <Textarea
                id="demo-note"
                placeholder="Ce que le prof IA doit savoir…"
                rows={3}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="demo-search">Groupe de saisie</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <MagnifyingGlass />
                </InputGroupAddon>
                <InputGroupInput
                  id="demo-search"
                  placeholder="Chercher une notion"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" aria-label="Dicter">
                    <Microphone />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="demo-disabled">Champ désactivé</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <At />
                </InputGroupAddon>
                <InputGroupInput
                  id="demo-disabled"
                  disabled
                  value="direction@exemple.org"
                  readOnly
                />
              </InputGroup>
            </Field>
          </FieldSection>
        </Specimen>

        <Specimen label="Sélecteurs, cases, interrupteurs" bare>
          <FieldSection
            tone="brand"
            title="Réglages"
            description="Listes, cases et interrupteurs en relief."
            icon={
              <GlowTile tone="yellow" size={36}>
                <SlidersHorizontal weight="fill" />
              </GlowTile>
            }
          >
            <Field>
              <FieldLabel htmlFor="demo-level">Classe</FieldLabel>
              <Select defaultValue="4e">
                <SelectTrigger id="demo-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Collège</SelectLabel>
                    {["6e", "5e", "4e", "3e"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="demo-native">Sélecteur natif</FieldLabel>
              <NativeSelect id="demo-native" defaultValue="maths">
                <NativeSelectOption value="maths">
                  Mathématiques
                </NativeSelectOption>
                <NativeSelectOption value="fr">Français</NativeSelectOption>
                <NativeSelectOption value="pc">
                  Physique-chimie
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Format préféré</FieldLegend>
              <RadioGroup defaultValue="schema">
                {(
                  [
                    ["schema", "Avec un schéma"],
                    ["oral", "À l'oral"],
                    ["texte", "Par écrit"],
                  ] as const
                ).map(([v, l]) => (
                  <Field key={v} orientation="horizontal">
                    <RadioGroupItem value={v} id={`demo-r-${v}`} />
                    <FieldLabel htmlFor={`demo-r-${v}`} className="font-normal">
                      {l}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            </FieldSet>
            <Field orientation="horizontal">
              <Checkbox id="demo-share" defaultChecked />
              <FieldLabel htmlFor="demo-share" className="font-normal">
                Partager la progression avec l'établissement
              </FieldLabel>
            </Field>
            <Field orientation="horizontal" className="justify-between">
              <FieldLabel htmlFor="demo-easy" className="font-normal">
                Lecture facile (police Lexend, interligne aéré)
              </FieldLabel>
              <Switch id="demo-easy" />
            </Field>
            <Field orientation="horizontal" className="justify-between">
              <FieldLabel htmlFor="demo-voice" className="font-normal">
                Lire les messages à voix haute
              </FieldLabel>
              <Switch id="demo-voice" defaultChecked />
            </Field>
          </FieldSection>
        </Specimen>
      </div>

      <Specimen
        label="Choix en cartes · ChoiceCards"
        note="Moins de 7 options : des cartes plutôt qu'une liste. Flèches, Espace, Tab."
      >
        <Choices />
      </Specimen>

      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Code à usage unique · OtpInput">
          <Otp />
        </Specimen>

        <Specimen label="Champ mathématique · MathInput (MathLive)">
          <MathAnswer />
        </Specimen>
      </div>

      <Specimen
        label="Photo d'une copie · PhotoDropzone"
        note="Glisser-déposer, appareil photo ou galerie"
      >
        <PhotoDropzone
          onSubmit={() =>
            toast.success("Photo prête (démo : rien n'est envoyé).")
          }
          note={
            <span className="inline-flex items-center gap-1.5">
              <Eye weight="bold" /> Seuls votre prof et le prof IA verront cette
              photo.
            </span>
          }
        />
      </Specimen>
    </Section>
  );
}
