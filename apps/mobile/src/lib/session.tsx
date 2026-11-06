import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, call, onSessionLost, setSessionToken } from "./api";
import { forgetPushToken } from "./push";
import { read } from "./read";
import type { Me } from "./types";

const TOKEN_KEY = "wema.session";

type State =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; me: Me };

interface SessionValue {
  state: State;
  /** Connexion par e-mail et mot de passe ; renvoie un code d'erreur ou null. */
  loginWithEmail(email: string, password: string): Promise<string | null>;
  /** Connexion d'un compte élève par identifiant et code. */
  loginWithCode(username: string, code: string): Promise<string | null>;
  logout(): Promise<void>;
  /** Relit l'utilisateur connecté (après l'acceptation des conditions). */
  refresh(): Promise<string | null>;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Session de l'appli : le jeton est gardé dans le coffre chiffré du téléphone
 * (expo-secure-store : Keychain sur iOS, Keystore sur Android), jamais en clair.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const signOutLocally = useCallback(async () => {
    setSessionToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    setState({ status: "signedOut" });
  }, []);

  const open = useCallback(
    async (token: string): Promise<string | null> => {
      setSessionToken(token);
      const me = await call(api.auth.me.$get());
      if (!me.ok) {
        if (me.code === "unauthenticated") await signOutLocally();
        return me.code;
      }
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      setState({ status: "signedIn", me: me.data });
      return null;
    },
    [signOutLocally],
  );

  useEffect(() => {
    onSessionLost(() => {
      void signOutLocally();
    });
    void (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (!token) return setState({ status: "signedOut" });
      const failed = await open(token);
      // Serveur injoignable : l'écran de connexion s'affiche ; le jeton reste
      // dans le coffre et sera réessayé au prochain démarrage.
      if (failed && failed !== "unauthenticated")
        setState({ status: "signedOut" });
    })();
  }, [open, signOutLocally]);

  const finishLogin = useCallback(
    async (
      result: { ok: true; data: unknown } | { ok: false; code: string },
    ) => {
      if (!result.ok) return result.code;
      const token = read(result.data, "token");
      if (typeof token !== "string") return "generic";
      return open(token);
    },
    [open],
  );

  const value = useMemo<SessionValue>(
    () => ({
      state,
      loginWithEmail: async (email, password) =>
        finishLogin(
          await call(api.auth.login.$post({ json: { email, password } })),
        ),
      loginWithCode: async (username, code) =>
        finishLogin(
          await call(api.auth.learner.$post({ json: { username, code } })),
        ),
      refresh: async () => {
        const me = await call(api.auth.me.$get());
        if (!me.ok) return me.code;
        setState({ status: "signedIn", me: me.data });
        return null;
      },
      logout: async () => {
        await forgetPushToken();
        await call(api.auth.logout.$post());
        await signOutLocally();
      },
    }),
    [state, finishLogin, signOutLocally],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession hors de SessionProvider");
  return value;
}

/** Utilisateur connecté (écrans protégés seulement). */
export function useMe(): Me {
  const { state } = useSession();
  if (state.status !== "signedIn")
    throw new Error("useMe sans session ouverte");
  return state.me;
}
