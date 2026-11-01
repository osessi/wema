import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import {
  Apple,
  decodeIdToken,
  Google,
  generateCodeVerifier,
  generateState,
} from "arctic";
import { z } from "zod";

export type OAuthProviderName = "google" | "apple";

/** Ce que Wema retient d'une connexion Google ou Apple. */
export interface OAuthProfile {
  /** Identifiant stable du compte chez le fournisseur (`sub`). */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface OAuthProvider {
  /** URL vers laquelle rediriger le navigateur, et ce qu'il faut garder en cookie. */
  start(): { url: URL; state: string; codeVerifier: string | null };
  finish(
    code: string,
    codeVerifier: string | null,
  ): Promise<Result<OAuthProfile, { kind: "oauth_failed" }>>;
}

export type OAuthProviders = Partial<Record<OAuthProviderName, OAuthProvider>>;

const claimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  // Apple envoie parfois "true" sous forme de chaîne.
  email_verified: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  name: z.string().optional(),
});

// Le jeton d'identité vient directement du fournisseur, par TLS, en échange du
// code : la spécification OpenID Connect permet de le lire sans revérifier sa
// signature dans ce cas.
function profileFromIdToken(
  idToken: string,
): Result<OAuthProfile, { kind: "oauth_failed" }> {
  const claims = claimsSchema.safeParse(decodeIdToken(idToken));
  if (!claims.success) return err({ kind: "oauth_failed" });
  const c = claims.data;
  return ok({
    subject: c.sub,
    email: c.email?.toLowerCase() ?? null,
    emailVerified: c.email_verified === true || c.email_verified === "true",
    name: c.name ?? null,
  });
}

export function googleProvider(config: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): OAuthProvider {
  const google = new Google(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
  return {
    start() {
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      return {
        url: google.createAuthorizationURL(state, codeVerifier, [
          "openid",
          "email",
          "profile",
        ]),
        state,
        codeVerifier,
      };
    },
    async finish(code, codeVerifier) {
      if (!codeVerifier) return err({ kind: "oauth_failed" });
      try {
        const tokens = await google.validateAuthorizationCode(
          code,
          codeVerifier,
        );
        return profileFromIdToken(tokens.idToken());
      } catch {
        return err({ kind: "oauth_failed" });
      }
    },
  };
}

export function appleProvider(config: {
  clientId: string;
  teamId: string;
  keyId: string;
  /** Clé privée PKCS#8 au format PEM. */
  privateKey: string;
  redirectUri: string;
}): OAuthProvider {
  const pem = config.privateKey
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s/g, "");
  const apple = new Apple(
    config.clientId,
    config.teamId,
    config.keyId,
    Buffer.from(pem, "base64"),
    config.redirectUri,
  );
  return {
    start() {
      const state = generateState();
      const url = apple.createAuthorizationURL(state, ["name", "email"]);
      // Apple exige un retour en POST quand on demande le nom ou l'e-mail.
      url.searchParams.set("response_mode", "form_post");
      return { url, state, codeVerifier: null };
    },
    async finish(code) {
      try {
        const tokens = await apple.validateAuthorizationCode(code);
        return profileFromIdToken(tokens.idToken());
      } catch {
        return err({ kind: "oauth_failed" });
      }
    },
  };
}
