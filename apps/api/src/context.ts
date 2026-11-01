import type { CodeSender } from "@wema/access";
import type { AiGateway } from "@wema/ai-gateway";
import type { SqlExecutor, User } from "@wema/db";
import type { Membership } from "@wema/domain";
import type { MathVerifier } from "@wema/exercises";
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
  /** Adresse publique du web, pour les retours de Google et d'Apple. */
  publicUrl: string;
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
