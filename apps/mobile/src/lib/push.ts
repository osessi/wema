import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api, call } from "./api";

export type PushState = "granted" | "denied" | "undetermined" | "unavailable";

let registered: string | null = null;

const projectId = (): string | null => {
  const fromExtra: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExtra === "string") return fromExtra;
  return Constants.easConfig?.projectId ?? null;
};

/**
 * Les notifications push demandent un vrai téléphone et une appli liée à un
 * projet EAS (`eas init`). Dans Expo Go (Android) et sur simulateur, elles
 * ne sont pas disponibles : l'appli fonctionne sans.
 */
export function pushAvailable(): boolean {
  return (
    Platform.OS !== "web" &&
    Device.isDevice &&
    projectId() !== null &&
    Constants.executionEnvironment !== "storeClient"
  );
}

export async function pushPermission(): Promise<PushState> {
  if (!pushAvailable()) return "unavailable";
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted"
    ? "granted"
    : status === "denied"
      ? "denied"
      : "undetermined";
}

/**
 * Demande l'autorisation (si `ask`), puis enregistre le jeton Expo de
 * l'appareil auprès de l'API (POST /api/me/push-tokens).
 */
export async function registerForPush(ask: boolean): Promise<PushState> {
  const id = projectId();
  if (!pushAvailable() || !id) return "unavailable";
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Wema",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let state = await pushPermission();
  if (state !== "granted" && ask) {
    const { status } = await Notifications.requestPermissionsAsync();
    state = status === "granted" ? "granted" : "denied";
  }
  if (state !== "granted") return state;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: id,
    });
    const platform = Platform.OS === "ios" ? "ios" : "android";
    const saved = await call(
      api.me["push-tokens"].$post({ json: { token, platform } }),
    );
    if (saved.ok) registered = token;
  } catch {
    // Service push injoignable : on réessaiera au prochain démarrage.
  }
  return state;
}

/** Retire le jeton de cet appareil (à la déconnexion). */
export async function forgetPushToken(): Promise<void> {
  if (!registered) return;
  const token = registered;
  registered = null;
  await call(api.me["push-tokens"].$delete({ json: { token } }));
}

/** Affichage d'une notification reçue quand l'appli est ouverte. */
export function configureForegroundNotifications() {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
