import type { Icon } from "@phosphor-icons/react";
import {
  BookOpenText,
  Books,
  Buildings,
  ChartLineUp,
  CurrencyDollar,
  EnvelopeSimple,
  ListChecks,
  Robot,
  SlidersHorizontal,
  Tag,
} from "@phosphor-icons/react/dist/ssr";
import type { GlowTone } from "@wema/ui/brand";
import type { SECTIONS } from "../../../lib/nav";

export type SectionKey = (typeof SECTIONS)[number]["key"];

/** Pastille de chaque section du back-office : ton et glyphe Phosphor. */
export const SECTION_LOOK: Record<SectionKey, { tone: GlowTone; Icon: Icon }> =
  {
    curriculum: { tone: "sky", Icon: BookOpenText },
    subjects: { tone: "sky", Icon: Books },
    organizations: { tone: "mint", Icon: Buildings },
    settings: { tone: "slate", Icon: SlidersHorizontal },
    ai: { tone: "yellow", Icon: Robot },
    audit: { tone: "slate", Icon: ListChecks },
    billing: { tone: "amber", Icon: Tag },
    collective: { tone: "mint", Icon: ChartLineUp },
    costs: { tone: "rose", Icon: CurrencyDollar },
    contacts: { tone: "rose", Icon: EnvelopeSimple },
  };
