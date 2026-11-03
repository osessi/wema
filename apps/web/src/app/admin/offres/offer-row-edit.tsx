"use client";

import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AdminOffer } from "../../../lib/billing-types";
import { OfferForm } from "./offer-form";

export function OfferEdit({ offer }: { offer: AdminOffer }) {
  const t = useTranslations("billing.admin");
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        {open ? t("close") : t("edit")}
      </Button>
      {open ? (
        <div className="rounded-md border p-4 text-left">
          <OfferForm offer={offer} countries={[]} subjects={[]} />
        </div>
      ) : null}
    </div>
  );
}
