"use client";

import { At, Eye, MagnifyingGlass, Microphone } from "@phosphor-icons/react";
import { OtpInput } from "@wema/ui/components/patterns/index";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
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
import { PhotoDropzone } from "@wema/ui/components/wema/photo-dropzone";
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

export function Forms({ id, index, title }: SectionProps) {
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="Chaque champ a un libellé visible, une aide si besoin et une erreur dite en texte. Un sélecteur natif sur mobile pour les longues listes, un interrupteur pour un réglage qui s'applique tout de suite, une case pour un choix à valider."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Champs · Field, Input, Textarea">
          <FieldGroup>
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
          </FieldGroup>
        </Specimen>

        <Specimen label="Sélecteurs, cases, interrupteurs">
          <FieldGroup>
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
          </FieldGroup>
        </Specimen>

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
