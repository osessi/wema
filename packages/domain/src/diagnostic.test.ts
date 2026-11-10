import { describe, expect, it } from "vitest";
import { diagnosticEligibility } from "./diagnostic";
import { parseLearningEvent } from "./events";

const now = new Date("2026-11-10T10:00:00Z");
const later = new Date("2026-12-10T10:00:00Z");
const before = new Date("2026-11-01T10:00:00Z");

describe("diagnosticEligibility", () => {
  it("ouvert avec une période payée en cours", () => {
    expect(
      diagnosticEligibility({
        subscriptions: [{ status: "active", currentPeriodEnd: later }],
        appointments: [],
        now,
      }),
    ).toEqual({ eligible: true });
  });

  it("un essai ne suffit pas : le diagnostic vient après le paiement", () => {
    expect(
      diagnosticEligibility({
        subscriptions: [{ status: "trialing", currentPeriodEnd: null }],
        appointments: [],
        now,
      }),
    ).toEqual({ eligible: false, reason: "no_paid_subscription" });
  });

  it("une période payée échue ne compte plus", () => {
    expect(
      diagnosticEligibility({
        subscriptions: [{ status: "active", currentPeriodEnd: before }],
        appointments: [],
        now,
      }).eligible,
    ).toBe(false);
  });

  it("résilié mais payé jusqu'à la fin de la période : encore ouvert", () => {
    expect(
      diagnosticEligibility({
        subscriptions: [{ status: "canceled", currentPeriodEnd: later }],
        appointments: [],
        now,
      }),
    ).toEqual({ eligible: true });
  });

  it("un seul rendez-vous : prévu ou fait, on n'en reprend pas", () => {
    const subscriptions = [{ status: "active", currentPeriodEnd: later }];
    expect(
      diagnosticEligibility({
        subscriptions,
        appointments: [{ status: "booked" }],
        now,
      }),
    ).toEqual({ eligible: false, reason: "already_booked" });
    expect(
      diagnosticEligibility({
        subscriptions,
        appointments: [{ status: "cancelled" }, { status: "done" }],
        now,
      }),
    ).toEqual({ eligible: false, reason: "already_done" });
  });

  it("après une annulation, on peut réserver de nouveau", () => {
    expect(
      diagnosticEligibility({
        subscriptions: [{ status: "active", currentPeriodEnd: later }],
        appointments: [{ status: "cancelled" }],
        now,
      }),
    ).toEqual({ eligible: true });
  });
});

describe("événement diagnostic.reported", () => {
  const base = {
    id: "00000000-0000-4000-8000-000000000001",
    learnerId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    occurredAt: now,
    source: "advisor",
  };
  const sheet = {
    since: "Depuis la rentrée",
    where: "Les fractions",
    blockers: "",
    motivation: "Aime le football",
    learningStyle: "Préfère les exemples",
    needs: "",
  };

  it("accepte une fiche et des hypothèses avec leur confiance", () => {
    const parsed = parseLearningEvent({
      ...base,
      payload: {
        type: "diagnostic.reported",
        appointmentId: "rdv-1",
        sheet,
        hypotheses: [
          {
            key: "format.examples",
            label: null,
            value: true,
            confidence: 0.5,
          },
        ],
      },
    });
    expect(parsed.ok).toBe(true);
  });

  it("refuse une fiche qui évoque la santé (aucun diagnostic médical)", () => {
    const parsed = parseLearningEvent({
      ...base,
      payload: {
        type: "diagnostic.reported",
        appointmentId: "rdv-1",
        sheet: { ...sheet, needs: "Sans doute une dyslexie" },
        hypotheses: [],
      },
    });
    expect(parsed.ok).toBe(false);
  });
});
