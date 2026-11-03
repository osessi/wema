"use client";

import { NotePencil } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@wema/ui/components/ui/dialog";
import { Label } from "@wema/ui/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { useSend } from "./composer";
import type { Contact, TeachingClass, Tone } from "./types";

/** Lien qui permet d'écrire à ce contact, en clair (classe, enfant). */
function useLinkLabel() {
  const t = useTranslations("messages.relation");
  return (link: Contact["links"][number]) => {
    const values = {
      className: link.className,
      childName: link.childName ?? "",
    };
    if (link.relation === "teacher")
      return t(link.childName ? "teacherOfChild" : "teacher", values);
    return t(link.relation, values);
  };
}

/**
 * Nouveau message : on ne peut choisir que parmi les contacts permis (l'API
 * revérifie le lien), et un prof peut faire une annonce à toute sa classe.
 */
export function NewMessageDialog({
  tone,
  contacts,
  classes,
  onSent,
}: {
  tone: Tone;
  contacts: Contact[];
  classes: TeachingClass[];
  onSent: (threadId: string) => void;
}) {
  const t = useTranslations("messages");
  const label = useLinkLabel();
  const ids = { to: useId(), body: useId() };
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const { send, pending, error } = useSend();

  if (contacts.length === 0 && classes.length === 0) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    const [kind, id] = to.split(":");
    if (!text || !id) return;
    const threadId = await send("/messages/send", {
      to:
        kind === "class" ? { kind, classId: id } : { kind: "user", userId: id },
      body: text,
    });
    if (threadId) {
      setOpen(false);
      setTo("");
      setBody("");
      onSent(threadId);
    }
  }

  const people = contacts.map((c) => (
    <NativeSelectOption key={c.userId} value={`user:${c.userId}`}>
      {c.displayName} ({c.links.map(label).join(", ")})
    </NativeSelectOption>
  ));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <NotePencil aria-hidden />
          {t(`${tone}.new`)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t(`${tone}.newTitle`)}</DialogTitle>
            <DialogDescription>{t(`${tone}.newHint`)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={ids.to}>{t(`${tone}.to`)}</Label>
            <NativeSelect
              id={ids.to}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            >
              <NativeSelectOption value="" disabled>
                {t(`${tone}.choose`)}
              </NativeSelectOption>
              {classes.length > 0 ? (
                <>
                  <optgroup label={t("adult.people")}>{people}</optgroup>
                  <optgroup label={t("adult.classes")}>
                    {classes.map((k) => (
                      <NativeSelectOption key={k.id} value={`class:${k.id}`}>
                        {t("adult.classOption", { name: k.name })}
                      </NativeSelectOption>
                    ))}
                  </optgroup>
                </>
              ) : (
                people
              )}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.body} className="sr-only">
              {t(`${tone}.placeholder`)}
            </Label>
            <Textarea
              id={ids.body}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t(`${tone}.placeholder`)}
              maxLength={4000}
              rows={5}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t(`${tone}.cancel`)}
            </Button>
            <Button type="submit" disabled={pending || !to || !body.trim()}>
              {pending ? t(`${tone}.sending`) : t(`${tone}.send`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
