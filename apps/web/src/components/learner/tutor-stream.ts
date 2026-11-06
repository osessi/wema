// Envoi d'un message au prof IA avec la réponse en flux (SSE) : le texte
// arrive par morceaux (`onDelta`), puis le message final enregistré fait foi.
// Quand une solution est à protéger, l'API contrôle la réponse avant de
// l'envoyer : elle arrive alors en un seul morceau.

import { read } from "../../lib/mutate";

export type StreamOutcome =
  | { ok: true; id: string; content: string; guarded: boolean }
  | { ok: false; code: string };

/** Lit les événements d'un flux SSE (événement + données, lignes `data:` jointes). */
async function* events(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (line === "") {
        if (data.length > 0) yield { event, data: data.join("\n") };
        event = "message";
        data = [];
      } else if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        // Un seul espace après les deux-points appartient à la syntaxe SSE.
        const value = line.slice(5);
        data.push(value.startsWith(" ") ? value.slice(1) : value);
      }
    }
    if (done) {
      if (data.length > 0) yield { event, data: data.join("\n") };
      return;
    }
  }
}

export async function streamTutorMessage(
  sessionId: string,
  content: string,
  onDelta: (delta: string) => void,
): Promise<StreamOutcome> {
  let res: Response;
  try {
    res = await fetch(`/api/learner/tutor/sessions/${sessionId}/messages`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify({ content }),
    });
  } catch {
    return { ok: false, code: "network" };
  }
  // Refus avant tout flux (séance terminée, trop de messages…) : réponse JSON.
  if (!res.headers.get("content-type")?.includes("text/event-stream")) {
    const data: unknown = await res.json().catch(() => null);
    const code = read(read(data, "error"), "code");
    return { ok: false, code: typeof code === "string" ? code : "generic" };
  }
  if (!res.body) return { ok: false, code: "generic" };
  try {
    for await (const { event, data } of events(res.body)) {
      if (event === "delta") onDelta(data);
      else if (event === "error") return { ok: false, code: data || "generic" };
      else if (event === "done") {
        const parsed: unknown = JSON.parse(data);
        const id = read(parsed, "messageId");
        const text = read(parsed, "content");
        return {
          ok: true,
          id: typeof id === "string" ? id : `local-${Date.now()}`,
          content: typeof text === "string" ? text : "",
          guarded: read(parsed, "guarded") === true,
        };
      }
    }
  } catch {
    return { ok: false, code: "network" };
  }
  // Flux fermé sans fin annoncée : la réponse n'a pas été enregistrée.
  return { ok: false, code: "ai_unavailable" };
}
