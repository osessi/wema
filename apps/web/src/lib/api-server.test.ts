import { describe, expect, it, vi } from "vitest";

// Ce module ne tourne que côté serveur Next : on remplace ce qui en dépend.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => "" }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

const { load } = await import("./api-server");

const response = (status: number) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: async () => ({ status }),
  });

describe("load (lecture d'une réponse de l'API pour une page)", () => {
  it("renvoie le corps d'une réponse réussie", async () => {
    await expect(load(response(200))).resolves.toEqual({ status: 200 });
  });

  it("sans session : vers la connexion", async () => {
    await expect(load(response(401))).rejects.toThrow("redirect:/connexion");
  });

  it("élément introuvable (404) : page 404, pas une page d'erreur", async () => {
    await expect(load(response(404))).rejects.toThrow("notFound");
  });

  it("identifiant mal formé dans l'adresse (400) : page 404", async () => {
    await expect(load(response(400))).rejects.toThrow("notFound");
  });

  it("une panne reste une erreur", async () => {
    await expect(load(response(500))).rejects.toThrow("API : réponse 500");
  });
});
