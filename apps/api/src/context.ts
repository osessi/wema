import type { CodeSender } from "@wema/access";
import type { AiGateway } from "@wema/ai-gateway";
import type { SqlExecutor, User } from "@wema/db";
import type { Membership } from "@wema/domain";
import type { MathVerifier } from "@wema/exercises";
import type { BillingDeps } from "./billing/types";
import type { EmailSender } from "./notify/channels";
import type { OAuthProviders } from "./oauth";

/** Ce dont le serveur a besoin, injecté au démarrage (et remplacé dans les tests). */
export interface Deps {
  db: SqlExecutor;
  codeSender: CodeSender;
  /** services/math : toute variante est vérifiée avant d'être servie. */
  math: MathVerifier;
  /** Porte unique vers les modèles d'IA (AGENTS.md, règle 5). */
  ai: AiGateway;
  /** Vrai si un fournisseur d'IA est configuré (clé présente). La clé elle-même reste dans la passerelle. */
  aiConfigured: boolean;
  oauth: OAuthProviders;
  /** Clé de chiffrement des données de santé (32 octets, fiche de décision 0006). */
  healthKey: Buffer;
  /** Secret du serveur qui signe les codes à usage unique. */
  codeSecret: string;
  /** Cookies `Secure` (HTTPS) : vrai en production. */
  secureCookies: boolean;
  /** Origines autorisées à envoyer des requêtes d'écriture (le web). */
  allowedOrigins: readonly string[];
  /** Origine publique (sans chemin) : adresses de l'API (/api/…), retours de Google et d'Apple. */
  publicUrl: string;
  /** Adresse des pages de l'application (origine + /app) : redirections vers le web. */
  appUrl: string;
  /** Canaux d'envoi configurés (e-mail, SMS, WhatsApp) ; absent : tous. */
  notifyChannels?: readonly ("email" | "sms" | "whatsapp")[];
  /** Paiement : fournisseurs, secrets des webhooks et droits d'accès aux matières (fiche 0009). */
  billing: BillingDeps;
  /**
   * Formulaire de contact du site public : e-mail de l'équipe à prévenir
   * (WEMA_CONTACT_EMAIL) et envoyeur. Absent : la demande est seulement enregistrée.
   */
  contactNotify?: { sender: EmailSender; to: string } | null;
  now: () => Date;
}

/** Variables de requête posées par le contrôle de session. */
export interface Env {
  Variables: {
    user: User;
    memberships: Membership[];
    sessionTokenHash: string;
  };
}
