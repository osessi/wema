"use client";

import type { AppType } from "@wema/api";
import { hc } from "hono/client";

/** Client typé côté navigateur (même origine : /api est redirigé vers le serveur). */
export function browserApi() {
  return hc<AppType>(window.location.origin).api;
}
