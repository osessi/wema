import { z } from "zod";
import type { SqlExecutor } from "./executor";
import { createSettingsStore } from "./settings-store";

/** Clé des réglages de confidentialité dans la table `settings`. */
export const PRIVACY_SETTINGS_KEY = "privacy";

const days = z.number().int().min(1).max(36500);

/**
 * Réglages RGPD, modifiables dans le back-office (fiche de décision 0008).
 * Les valeurs par défaut sont des propositions à faire valider par un juriste.
 */
export const privacySettingsSchema = z.object({
  /** Délai entre la demande de suppression d'un compte et sa purge. */
  deletionGraceDays: days,
  /** Un compte sans connexion depuis ce délai est programmé pour suppression. */
  inactiveAccountDays: days,
  /** Codes à usage unique conservés après leur expiration. */
  oneTimeCodeDays: days,
  /** Journal des appels d'IA (coûts, jetons, sans contenu). */
  aiCallDays: days,
  /** Journaux d'envoi (notifications, e-mails, SMS), quand ils existent. */
  deliveryLogDays: days,
  /** Conversations avec le prof IA ; `null` : conservées tant que le compte existe. */
  tutorConversationDays: days.nullable(),
  /**
   * Âge en dessous duquel un élève ne peut pas s'inscrire seul : son parent
   * crée son compte et donne son consentement. Dépend du pays (15 ans en
   * France) : à régler selon les marchés ouverts.
   */
  digitalConsentAge: z.number().int().min(10).max(21),
  /** Version en vigueur des conditions d'utilisation. */
  termsVersion: z.string().trim().min(1).max(40),
  /** Version en vigueur de la politique de confidentialité. */
  privacyVersion: z.string().trim().min(1).max(40),
});

export type PrivacySettings = z.infer<typeof privacySettingsSchema>;

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  deletionGraceDays: 30,
  inactiveAccountDays: 730,
  oneTimeCodeDays: 1,
  aiCallDays: 365,
  deliveryLogDays: 90,
  tutorConversationDays: null,
  digitalConsentAge: 15,
  termsVersion: "2026-11-03",
  privacyVersion: "2026-11-03",
};

export function parsePrivacySettings(value: unknown) {
  return privacySettingsSchema.safeParse(value);
}

/** Réglages en vigueur : ceux de la base, complétés par les valeurs par défaut. */
export async function loadPrivacySettings(
  db: SqlExecutor,
): Promise<PrivacySettings> {
  const stored = await createSettingsStore(db).get(PRIVACY_SETTINGS_KEY);
  const merged =
    typeof stored === "object" && stored !== null
      ? { ...DEFAULT_PRIVACY_SETTINGS, ...stored }
      : DEFAULT_PRIVACY_SETTINGS;
  const parsed = parsePrivacySettings(merged);
  return parsed.success ? parsed.data : DEFAULT_PRIVACY_SETTINGS;
}
