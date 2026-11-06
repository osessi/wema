import { describe, expect, it, vi } from "vitest";

vi.mock("expo-speech", () => ({ speak: vi.fn(), stop: vi.fn() }));

const { speakable } = await import("./speech");

describe("lecture à voix haute", () => {
  it("lit les symboles avec des mots", () => {
    expect(speakable("Calcule √(16) + 3² × 2")).toBe(
      "Calcule racine carrée de (16) + 3 au carré fois 2",
    );
    expect(speakable("**Résous** x^2 = 9")).toBe("Résous x au carré = 9");
  });
});
