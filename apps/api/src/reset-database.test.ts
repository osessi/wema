import { describe, expect, it } from "vitest";
import { resetTarget } from "./reset-database";

describe("resetTarget (remise à zéro de la base des tests e2e)", () => {
  it("accepte une base qui finit par _e2e et vise la base de maintenance", () => {
    expect(
      resetTarget(
        "postgres://wema:wema@localhost:5432/wema_e2e",
        "development",
      ),
    ).toEqual({
      ok: true,
      database: "wema_e2e",
      maintenanceUrl: "postgres://wema:wema@localhost:5432/postgres",
    });
  });

  it("refuse la base de développement", () => {
    expect(
      resetTarget("postgres://wema:wema@localhost:5432/wema", "development").ok,
    ).toBe(false);
  });

  it("refuse en production, même sur une base _e2e", () => {
    expect(
      resetTarget("postgres://wema:wema@localhost:5432/wema_e2e", "production")
        .ok,
    ).toBe(false);
  });

  it("refuse un nom qui pourrait injecter du SQL", () => {
    expect(
      resetTarget(
        "postgres://wema:wema@localhost:5432/x%3B%20DROP%20DATABASE%20wema%3B_e2e",
        "test",
      ).ok,
    ).toBe(false);
  });

  it("refuse une adresse absente ou qui n'est pas postgres", () => {
    expect(resetTarget(undefined, "test").ok).toBe(false);
    expect(resetTarget("mysql://localhost/wema_e2e", "test").ok).toBe(false);
  });
});
