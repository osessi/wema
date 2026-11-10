import { describe, expect, it } from "vitest";
import { groupEventsByDay } from "./activity-timeline";
import { sanitizeOtp } from "./otp-input";
import { scrollPercent } from "./scroll-progress";
import { tokenizeStream } from "./streaming-text";

describe("sanitizeOtp", () => {
  it("ne garde que les chiffres en mode numérique, coupé à la longueur", () => {
    expect(sanitizeOtp("12 3-45a678", "numeric", 6)).toBe("123456");
  });
  it("met en minuscules et retire les symboles en mode alphanumérique", () => {
    expect(sanitizeOtp("Ab-3 x9", "alphanumeric", 8)).toBe("ab3x9");
  });
});

describe("groupEventsByDay", () => {
  const event = (id: string, at: string) => ({ id, at, icon: null, title: id });
  it("groupe par jour du fuseau, du plus récent au plus ancien", () => {
    const now = new Date("2026-11-10T10:00:00Z");
    const days = groupEventsByDay(
      [
        event("a", "2026-11-09T08:00:00Z"),
        event("b", "2026-11-10T09:00:00Z"),
        event("c", "2026-11-03T12:00:00Z"),
        // 23 h 30 à Paris le 9 : déjà le 10 à Tokyo.
        event("d", "2026-11-09T22:30:00Z"),
      ],
      { timeZone: "Europe/Paris", now },
    );
    expect(days.map((d) => d.label)).toEqual([
      "Aujourd'hui",
      "Hier",
      "mardi 3 novembre",
    ]);
    expect(days[1]?.events.map((e) => e.id)).toEqual(["d", "a"]);
  });
});

describe("scrollPercent", () => {
  it("vaut 0 quand rien ne défile et reste borné", () => {
    expect(scrollPercent(10, 500, 500)).toBe(0);
    expect(scrollPercent(250, 1000, 500)).toBe(50);
    expect(scrollPercent(900, 1000, 500)).toBe(100);
  });
});

describe("tokenizeStream", () => {
  it("garde les retours à la ligne comme jetons", () => {
    expect(tokenizeStream("Bonjour  toi\n\nOn y va")).toEqual([
      { type: "word", value: "Bonjour" },
      { type: "word", value: "toi" },
      { type: "break", value: "\n\n" },
      { type: "word", value: "On" },
      { type: "word", value: "y" },
      { type: "word", value: "va" },
    ]);
  });
});
