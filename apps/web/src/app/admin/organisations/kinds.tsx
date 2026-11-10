import type { Icon } from "@phosphor-icons/react";
import {
  ChalkboardTeacher,
  GraduationCap,
  HouseLine,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import type { GlowTone } from "@wema/ui/brand";

export type OrganizationKind = "platform" | "school" | "tutoring" | "family";

/** Pastille et badge de chaque type d'organisation. */
export const KIND_LOOK: Record<
  OrganizationKind,
  {
    tone: GlowTone;
    Icon: Icon;
    badge: "brand" | "info" | "success" | "neutral";
  }
> = {
  platform: { tone: "yellow", Icon: Sparkle, badge: "brand" },
  school: { tone: "sky", Icon: GraduationCap, badge: "info" },
  tutoring: { tone: "mint", Icon: ChalkboardTeacher, badge: "success" },
  family: { tone: "rose", Icon: HouseLine, badge: "neutral" },
};
