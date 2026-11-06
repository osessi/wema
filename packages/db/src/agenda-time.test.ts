import { describe, expect, it } from "vitest";
import {
  type AvailabilityRule,
  expandRule,
  fitsInside,
  freeSlots,
  isIsoDate,
  isValidTimeZone,
  overlaps,
  parseClock,
  zonedDate,
  zonedTimeToUtc,
} from "./agenda-time";

const at = (iso: string) => new Date(iso);
const rule = (r: Partial<AvailabilityRule>): AvailabilityRule => ({
  weekdays: [2],
  startMinute: 17 * 60,
  endMinute: 19 * 60,
  timeZone: "UTC",
  validFrom: "2026-11-02",
  validUntil: null,
  everyNWeeks: 1,
  ...r,
});

describe("fuseaux horaires", () => {
  it("convertit une heure locale en instant, été comme hiver", () => {
    // Paris : UTC+2 en été, UTC+1 en hiver.
    expect(
      zonedTimeToUtc("2026-07-01", 17 * 60, "Europe/Paris").toISOString(),
    ).toBe("2026-07-01T15:00:00.000Z");
    expect(
      zonedTimeToUtc("2026-12-01", 17 * 60, "Europe/Paris").toISOString(),
    ).toBe("2026-12-01T16:00:00.000Z");
    // Porto-Novo : UTC+1 toute l'année.
    expect(
      zonedTimeToUtc("2026-07-01", 17 * 60, "Africa/Porto-Novo").toISOString(),
    ).toBe("2026-07-01T16:00:00.000Z");
    // Fuseau à demi-heure.
    expect(
      zonedTimeToUtc("2026-07-01", 9 * 60, "Asia/Kolkata").toISOString(),
    ).toBe("2026-07-01T03:30:00.000Z");
  });

  it("gère les heures inexistantes et doublées des changements d'heure", () => {
    // 29 mars 2026 à Paris : 2 h n'existe pas (on passe de 2 h à 3 h).
    expect(
      zonedTimeToUtc("2026-03-29", 2 * 60 + 30, "Europe/Paris").toISOString(),
    ).toBe("2026-03-29T01:30:00.000Z");
    // 25 octobre 2026 : 2 h 30 existe deux fois, on garde la première.
    expect(
      zonedTimeToUtc("2026-10-25", 2 * 60 + 30, "Europe/Paris").toISOString(),
    ).toBe("2026-10-25T00:30:00.000Z");
  });

  it("donne la date locale d'un instant", () => {
    expect(zonedDate(at("2026-11-03T23:30:00Z"), "Europe/Paris")).toBe(
      "2026-11-04",
    );
    expect(zonedDate(at("2026-11-03T23:30:00Z"), "America/Montreal")).toBe(
      "2026-11-03",
    );
  });

  it("valide fuseaux, dates et heures", () => {
    expect(isValidTimeZone("Africa/Porto-Novo")).toBe(true);
    expect(isValidTimeZone("Pas/Un_Fuseau")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(parseClock("17:30")).toBe(17 * 60 + 30);
    expect(parseClock("24:00")).toBe(24 * 60);
    expect(parseClock("25:00")).toBeNull();
  });
});

describe("récurrence", () => {
  it("développe chaque mardi, bornes de validité comprises", () => {
    const windows = expandRule(
      rule({ validUntil: "2026-11-17" }),
      at("2026-11-01T00:00:00Z"),
      at("2026-12-31T00:00:00Z"),
    );
    expect(windows.map((w) => w.start.toISOString())).toEqual([
      "2026-11-03T17:00:00.000Z",
      "2026-11-10T17:00:00.000Z",
      "2026-11-17T17:00:00.000Z",
    ]);
  });

  it("respecte « une semaine sur deux » à partir de la semaine de départ", () => {
    const windows = expandRule(
      rule({ weekdays: [1, 3], everyNWeeks: 2, validFrom: "2026-11-04" }),
      at("2026-11-01T00:00:00Z"),
      at("2026-12-01T00:00:00Z"),
    );
    expect(windows.map((w) => w.start.toISOString().slice(0, 10))).toEqual([
      "2026-11-04",
      "2026-11-16",
      "2026-11-18",
      "2026-11-30",
    ]);
  });

  it("garde l'heure locale du prof de part et d'autre du changement d'heure", () => {
    const windows = expandRule(
      rule({
        weekdays: [6],
        timeZone: "Europe/Paris",
        validFrom: "2026-10-01",
      }),
      at("2026-10-15T00:00:00Z"),
      at("2026-11-02T00:00:00Z"),
    );
    expect(windows.map((w) => w.start.toISOString())).toEqual([
      "2026-10-17T15:00:00.000Z",
      "2026-10-24T15:00:00.000Z",
      "2026-10-31T16:00:00.000Z",
    ]);
  });

  it("ne garde que les plages qui touchent la période", () => {
    const windows = expandRule(
      rule({}),
      at("2026-11-03T18:00:00Z"),
      at("2026-11-04T00:00:00Z"),
    );
    expect(windows).toHaveLength(1);
    expect(
      expandRule(
        rule({ endMinute: 17 * 60 }),
        at("2026-11-01Z"),
        at("2026-12-01Z"),
      ),
    ).toEqual([]);
  });
});

describe("conflits de créneaux", () => {
  const w = {
    start: at("2026-11-03T17:00:00Z"),
    end: at("2026-11-03T19:00:00Z"),
  };

  it("le contact bord à bord n'est pas un chevauchement", () => {
    expect(
      overlaps(w, {
        start: at("2026-11-03T19:00:00Z"),
        end: at("2026-11-03T20:00:00Z"),
      }),
    ).toBe(false);
    expect(
      overlaps(w, {
        start: at("2026-11-03T18:59:00Z"),
        end: at("2026-11-03T20:00:00Z"),
      }),
    ).toBe(true);
  });

  it("un créneau doit tenir entièrement dans une plage", () => {
    expect(
      fitsInside(
        { start: at("2026-11-03T18:00:00Z"), end: at("2026-11-03T19:00:00Z") },
        [w],
      ),
    ).toBe(true);
    expect(
      fitsInside(
        { start: at("2026-11-03T18:30:00Z"), end: at("2026-11-03T19:30:00Z") },
        [w],
      ),
    ).toBe(false);
  });

  it("découpe les plages et retire les créneaux pris ou passés", () => {
    const busy = [
      { start: at("2026-11-03T17:30:00Z"), end: at("2026-11-03T18:00:00Z") },
    ];
    const slots = freeSlots([w], busy, 30, at("2026-11-03T17:10:00Z"));
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      "2026-11-03T18:00:00.000Z",
      "2026-11-03T18:30:00.000Z",
    ]);
    // Deux règles qui se recouvrent ne donnent pas deux fois le même créneau.
    expect(freeSlots([w, w], [], 60, at("2026-11-01Z"))).toHaveLength(2);
  });
});
