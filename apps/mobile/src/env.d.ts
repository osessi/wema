/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    /** Adresse du serveur API Wema (sans /api), lue au moment de la compilation. */
    readonly EXPO_PUBLIC_WEMA_API_URL?: string;
  }
}
