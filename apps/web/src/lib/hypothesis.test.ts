import { describe, expect, it } from "vitest";
import { shownStatus } from "./hypothesis";

describe("shownStatus", () => {
  it("affiche « à vérifier » sous 50 % de confiance", () => {
    expect(shownStatus({ status: "supported", confidence: 0.35 })).toBe(
      "uncertain",
    );
    expect(shownStatus({ status: "contradicted", confidence: 0.2 })).toBe(
      "uncertain",
    );
  });
  it("garde le statut au-delà", () => {
    expect(shownStatus({ status: "supported", confidence: 0.7 })).toBe(
      "supported",
    );
  });
});
