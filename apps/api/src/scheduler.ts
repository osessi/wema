import type { PgBoss } from "pg-boss";

/**
 * Une tâche périodique du serveur (suivi actif, banque hebdomadaire…).
 * `run` attrape elle-même ses erreurs : le planificateur ne fait que l'appeler.
 */
export type ScheduledTask = {
  /** Nom de la file pg-boss (lettres, chiffres, tirets). */
  name: string;
  /** Rythme avec pg-boss (expression cron, en UTC). */
  cron: string;
  /** Premier passage, en secondes après le démarrage. */
  firstRunAfterSeconds: number;
  /** Rythme du planificateur interne, en secondes. */
  everySeconds: number;
  run: () => Promise<void>;
};

export type Scheduler = {
  kind: "pg-boss" | "interne";
  stop: () => Promise<void>;
};

/** Ne lance pas un passage tant que le précédent n'est pas fini. */
function oneAtATime(run: () => Promise<void>) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await run();
    } finally {
      running = false;
    }
  };
}

/**
 * Planificateur interne (développement sans Postgres) : minuteries du
 * processus, valable pour un seul serveur.
 */
export function startTimerScheduler(tasks: ScheduledTask[]): Scheduler {
  const handles: NodeJS.Timeout[] = [];
  for (const task of tasks) {
    const run = oneAtATime(task.run);
    handles.push(setTimeout(run, task.firstRunAfterSeconds * 1000).unref());
    handles.push(setInterval(run, task.everySeconds * 1000).unref());
  }
  return {
    kind: "interne",
    async stop() {
      for (const h of handles) clearTimeout(h);
    },
  };
}

/**
 * Planificateur pg-boss (production, Postgres) : les rythmes et les tâches
 * sont dans la base, donc partagés par tous les serveurs. Chaque file est
 * « exclusive » (un seul passage en attente ou en cours, tous serveurs
 * confondus) ; un passage qui échoue n'est pas rejoué, le suivant le rattrape.
 */
export async function startPgBossScheduler(
  boss: PgBoss,
  tasks: ScheduledTask[],
): Promise<Scheduler> {
  // Sans écouteur, une erreur de pg-boss arrêterait le processus. Seulement
  // le type d'erreur : jamais de valeur (donnée personnelle) dans les logs.
  boss.on("error", (e) => console.error(`pg-boss : ${e.name}`));
  await boss.start();
  for (const task of tasks) {
    await boss.createQueue(task.name, {
      policy: "exclusive",
      retryLimit: 0,
      expireInSeconds: 60 * 60,
    });
    await boss.schedule(task.name, task.cron, null, { tz: "UTC" });
    await boss.work(task.name, async () => {
      await task.run();
    });
    await boss.send(task.name, null, {
      startAfter: task.firstRunAfterSeconds,
    });
  }
  return {
    kind: "pg-boss",
    async stop() {
      await boss.stop({ graceful: true, timeout: 30_000 });
    },
  };
}
