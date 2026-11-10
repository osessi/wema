"use client";

import { PencilSimple, Plus } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@wema/ui/components/ui/dialog";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AdminOffer } from "../../../lib/billing-types";
import { OfferForm } from "./offer-form";

/** Modification d'une offre, dans un dialogue. */
export function OfferEdit({
  offer,
  available,
}: {
  offer: AdminOffer;
  available: readonly string[];
}) {
  const t = useTranslations("billing.admin");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <PencilSimple aria-hidden />
          {t("edit")}
          <span className="sr-only">
            {" "}
            · {offer.countryName} · {offer.subjectName}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {offer.subjectName} · {offer.countryName}
          </DialogTitle>
        </DialogHeader>
        <OfferForm
          offer={offer}
          countries={[]}
          subjects={[]}
          available={available}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Création d'une offre, dans un dialogue. */
export function NewOfferDialog({
  countries,
  subjects,
  available,
}: {
  countries: { id: string; name: string }[];
  subjects: { id: string; name: string; icon?: string | null }[];
  available: readonly string[];
}) {
  const t = useTranslations("billing.admin");
  const tx = useTranslations("billingAdmin");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden weight="bold" />
          {t("newOffer")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("newOffer")}</DialogTitle>
          <DialogDescription>{tx("newOfferHint")}</DialogDescription>
        </DialogHeader>
        <OfferForm
          countries={countries}
          subjects={subjects}
          available={available}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
