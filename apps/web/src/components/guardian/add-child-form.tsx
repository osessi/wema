"use client";

import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { Checkbox } from "@wema/ui/components/ui/checkbox";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@wema/ui/components/ui/tabs";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import type { CatalogProgram } from "../../lib/family-types";
import { read } from "../../lib/mutate";
import { useMutation } from "../../lib/use-mutation";
import { LoginCode } from "../school/login-code";
import { type ProgramChoice, ProgramPicker } from "./program-picker";

const EMPTY: ProgramChoice = { countryId: "", gradeId: "", programIds: [] };

/**
 * Ajout d'un enfant par son parent (fiche 0010) : prénom, connexion
 * (identifiant + code montré une fois, ou e-mail), programme. Le parent est
 * l'auteur du lien : son consentement est enregistré avec le compte.
 */
export function AddChildForm({
  familyId,
  catalog,
  onCreated,
}: {
  familyId: string;
  catalog: readonly CatalogProgram[];
  /** Appelé après la création (parcours guidé) : l'appelant montre alors l'accès. */
  onCreated?: (child: {
    learnerId: string;
    name: string;
    username: string | null;
    code: string | null;
  }) => void;
}) {
  const t = useTranslations("family.child");
  const id = useId();
  const { run, pending, error } = useMutation();
  const [kind, setKind] = useState<"username" | "email">("username");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [program, setProgram] = useState<ProgramChoice>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [created, setCreated] = useState<{
    name: string;
    username: string;
    code: string;
  } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setCreated(null);
    setDone(null);
    const login =
      kind === "username" ? { kind, username } : { kind, email, password };
    const result = await run("POST", `/family/${familyId}/children`, {
      displayName,
      login,
      programIds: program.programIds,
    });
    if (!result.ok) return;
    const code = read(result.data, "loginCode");
    const learnerId = read(result.data, "userId");
    if (onCreated && typeof learnerId === "string")
      onCreated({
        learnerId,
        name: displayName,
        username: kind === "username" ? username : null,
        code: typeof code === "string" ? code : null,
      });
    else if (typeof code === "string")
      setCreated({ name: displayName, username, code });
    else setDone(displayName);
    setDisplayName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setProgram(EMPTY);
    setConsent(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-name`}>{t("firstName")}</Label>
          <Input
            id={`${id}-name`}
            required
            maxLength={120}
            autoComplete="off"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">{t("loginKind")}</span>
          <Tabs
            value={kind}
            onValueChange={(v) => {
              if (v === "username" || v === "email") setKind(v);
            }}
          >
            <TabsList>
              <TabsTrigger value="username">{t("kinds.username")}</TabsTrigger>
              <TabsTrigger value="email">{t("kinds.email")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {kind === "username" ? (
          <div className="space-y-2">
            <Label htmlFor={`${id}-username`}>{t("username")}</Label>
            <Input
              id={`${id}-username`}
              required
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("usernameHint")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor={`${id}-email`}>{t("email")}</Label>
              <Input
                id={`${id}-email`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-password`}>{t("password")}</Label>
              <Input
                id={`${id}-password`}
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        )}
      </div>
      <ProgramPicker catalog={catalog} value={program} onChange={setProgram} />
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-consent`}
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
        />
        <Label htmlFor={`${id}-consent`} className="font-normal leading-snug">
          {t("consent")}
        </Label>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {created && (
        <LoginCode
          name={created.name}
          username={created.username}
          code={created.code}
        />
      )}
      {done && (
        <p className="text-sm text-success-text" role="status">
          {t("added", { name: done })}
        </p>
      )}
      <Button
        type="submit"
        variant="brand"
        className="self-start"
        disabled={pending || !consent || program.programIds.length === 0}
      >
        {t("submit")}
      </Button>
    </form>
  );
}
