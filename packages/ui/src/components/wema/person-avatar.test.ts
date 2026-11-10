import { describe, expect, it } from "vitest";
import { initialsOf, PERSON_TONES, personTone } from "./person-avatar";

describe("personTone", () => {
  it("donne toujours le même ton pour la même graine", () => {
    expect(personTone("eleve-42")).toBe(personTone("eleve-42"));
  });
  it("répartit des graines différentes sur plusieurs tons", () => {
    const tones = new Set(
      Array.from({ length: 40 }, (_, i) => personTone(`user-${i}`)),
    );
    expect(tones.size).toBeGreaterThanOrEqual(6);
    for (const t of tones) expect(PERSON_TONES).toContain(t);
  });
});

describe("initialsOf", () => {
  it("prend la première lettre du premier et du dernier mot", () => {
    expect(initialsOf("Awa Koné Diallo")).toBe("AD");
    expect(initialsOf("jean-marc")).toBe("JM");
    expect(initialsOf("  élise ")).toBe("É");
    expect(initialsOf("")).toBe("?");
  });
});
