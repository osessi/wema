import { describe, expect, it } from "vitest";
import { asCountryCode, asNotionId } from "./index";

describe("identifiants", () => {
  it("met les UUID en minuscules", () => {
    expect(asNotionId("8F1D2C3A-4B5E-4F60-8A7B-9C0D1E2F3A4B")).toBe(
      "8f1d2c3a-4b5e-4f60-8a7b-9c0d1e2f3a4b",
    );
  });

  it("met les codes pays en majuscules", () => {
    expect(asCountryCode("bj")).toBe("BJ");
  });
});
