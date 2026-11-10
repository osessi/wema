import { afterEach, describe, expect, it, vi } from "vitest";
import { streamTutorMessage } from "./tutor-stream";

function sse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("réponse du prof IA en flux", () => {
  it("transmet les morceaux (espaces et retours à la ligne compris), puis le message enregistré", async () => {
    vi.stubGlobal("fetch", async () =>
      sse([
        "event: delta\ndata: Bon\n\nevent: delta\ndata:  début.\ndata: Et\n\n",
        'event: done\ndata: {"messageId":"m1","content":"Bon début.\\nEt ?","guarded":false}\n\n',
      ]),
    );
    const parts: string[] = [];
    const result = await streamTutorMessage("s", "Bonjour", (d) =>
      parts.push(d),
    );
    expect(parts).toEqual(["Bon", " début.\nEt"]);
    expect(result).toEqual({
      ok: true,
      id: "m1",
      content: "Bon début.\nEt ?",
      guarded: false,
    });
  });

  it("rend le code d'erreur, dans le flux ou avant lui", async () => {
    vi.stubGlobal("fetch", async () =>
      sse(["event: error\ndata: ai_busy\n\n"]),
    );
    expect(await streamTutorMessage("s", "x", () => {})).toEqual({
      ok: false,
      code: "ai_busy",
    });
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: { code: "session_finished" } }), {
          status: 409,
          headers: { "content-type": "application/json" },
        }),
    );
    expect(await streamTutorMessage("s", "x", () => {})).toEqual({
      ok: false,
      code: "session_finished",
    });
  });

  it("un flux coupé avant la fin n'est pas un succès", async () => {
    vi.stubGlobal("fetch", async () => sse(["event: delta\ndata: Bon\n\n"]));
    expect(await streamTutorMessage("s", "x", () => {})).toEqual({
      ok: false,
      code: "ai_unavailable",
    });
  });
});
