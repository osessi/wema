import { buildProgressReport } from "@wema/learner-model";
import { describe, expect, it } from "vitest";
import { reportCsv, reportPeriod } from "./routes/reports";

describe("reportPeriod", () => {
  const now = new Date("2026-11-10T15:00:00Z");

  it("par défaut : les 3 derniers mois, jours entiers", () => {
    const p = reportPeriod({}, now);
    expect(p?.from.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(p?.to.toISOString()).toBe("2026-11-10T23:59:59.999Z");
  });

  it("refuse une période à l'envers ou trop longue", () => {
    expect(reportPeriod({ from: "2026-05-01", to: "2026-04-01" }, now)).toBe(
      null,
    );
    expect(reportPeriod({ from: "2020-01-01", to: "2026-04-01" }, now)).toBe(
      null,
    );
    expect(
      reportPeriod({ from: "2026-04-01", to: "2026-04-01" }, now),
    ).not.toBe(null);
  });
});

describe("reportCsv", () => {
  it("échappe les cellules et garde les valeurs réelles", () => {
    const r = buildProgressReport({
      learners: [],
      notions: [],
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-03-31T23:59:59Z"),
    });
    const csv = reportCsv({ className: 'Classe "A"; 4e', program: null }, r);
    expect(csv).toContain('Classe;"Classe ""A""; 4e"');
    expect(csv).toContain("Élèves inscrits;0;0");
    expect(csv).toContain("Maîtrise moyenne des notions travaillées (%);;");
  });
});
