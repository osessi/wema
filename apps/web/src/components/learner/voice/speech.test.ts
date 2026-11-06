import { describe, expect, it } from "vitest";
import { pickVoice, speakable } from "./speech";

const words = {
  sqrt: "racine carrée de",
  squared: "au carré",
  cubed: "au cube",
  times: "fois",
  approx: "environ",
};

const voice = (lang: string, localService = false): SpeechSynthesisVoice => ({
  default: false,
  lang,
  localService,
  name: lang,
  voiceURI: lang,
});

describe("voix du navigateur", () => {
  it("lit les symboles mathématiques avec des mots", () => {
    expect(speakable("BC² = 5^2 + 7² donc BC ≈ √74 et 2 × 3", words)).toBe(
      "BC au carré = 5 au carré + 7 au carré donc BC environ racine carrée de 74 et 2 fois 3",
    );
    expect(speakable("**Bien** : √(5^2 + 7^2)", words)).toBe(
      "Bien : racine carrée de (5 au carré + 7 au carré)",
    );
  });

  it("choisit une voix de la langue, la variante exacte d'abord", () => {
    const voices = [voice("en-US"), voice("fr-CA", true), voice("fr-FR")];
    expect(pickVoice(voices, "fr-FR")?.lang).toBe("fr-FR");
    expect(pickVoice(voices, "fr")?.lang).toBe("fr-CA");
    expect(pickVoice([voice("en-US")], "fr")).toBeNull();
  });
});
