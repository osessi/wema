import { PGlite } from "@electric-sql/pglite";
import { fromPglite, PgBoss } from "pg-boss";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ScheduledTask,
  startPgBossScheduler,
  startTimerScheduler,
} from "./scheduler";

const task = (run: () => Promise<void>): ScheduledTask => ({
  name: "essai-suivi",
  cron: "0 * * * *",
  firstRunAfterSeconds: 60,
  everySeconds: 3600,
  run,
});

describe("planificateur interne", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("premier passage après le délai, puis au rythme demandé", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    const scheduler = startTimerScheduler([task(run)]);
    expect(scheduler.kind).toBe("interne");
    await vi.advanceTimersByTimeAsync(59_000);
    expect(run).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3600_000);
    expect(run).toHaveBeenCalledTimes(2);
    await scheduler.stop();
    await vi.advanceTimersByTimeAsync(3 * 3600_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("ne lance pas un passage tant que le précédent n'est pas fini", async () => {
    vi.useFakeTimers();
    let release = () => {};
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const scheduler = startTimerScheduler([
      { ...task(run), firstRunAfterSeconds: 1, everySeconds: 1 },
    ]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
    await scheduler.stop();
  });
});

describe("planificateur pg-boss", () => {
  it("crée la file, le rythme cron, et exécute le premier passage", async () => {
    const pg = new PGlite();
    const boss = new PgBoss({ db: fromPglite(pg), backend: "pglite" });
    let done = () => {};
    const ran = new Promise<void>((resolve) => {
      done = resolve;
    });
    const run = vi.fn(async () => done());
    const scheduler = await startPgBossScheduler(boss, [
      { ...task(run), firstRunAfterSeconds: 0 },
    ]);
    expect(scheduler.kind).toBe("pg-boss");
    const schedules = await boss.getSchedules();
    expect(schedules.map((s) => [s.name, s.cron])).toEqual([
      ["essai-suivi", "0 * * * *"],
    ]);
    const queue = await boss.getQueue("essai-suivi");
    expect(queue?.policy).toBe("exclusive");
    await ran;
    expect(run).toHaveBeenCalledTimes(1);
    await scheduler.stop();
    await pg.close();
  }, 30_000);
});
