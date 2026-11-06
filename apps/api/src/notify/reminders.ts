import type { SqlExecutor } from "@wema/db";
import {
  type AgendaReminderSender,
  runAgendaReminders,
} from "../routes/agenda";
import { nextAllowedAt, sessionReminderNotification } from "./rules";
import { createNotificationStore } from "./store";

/**
 * Rappels de séance (agenda) remis au module d'envoi : une notification
 * `session_reminder` par destinataire (prof, élèves, parents), par le canal
 * choisi pour les messages (`message_channel` : un seul réglage « messages et
 * rappels », voir docs/architecture.md).
 *
 * Heures calmes : le rappel 24 h les respecte (il part à la fin des heures
 * calmes) ; le rappel 1 h passe outre, sinon il arriverait après le début
 * d'une séance du matin. La séance est revérifiée à l'envoi (dispatch.ts).
 */
export function createSessionReminderSender(
  db: SqlExecutor,
  now: Date,
): AgendaReminderSender {
  const store = createNotificationStore(db);
  return {
    async send(reminder) {
      for (const r of reminder.recipients) {
        const prefs = await store.preferences(r.userId);
        if (prefs.messageChannel === "off") continue;
        const n = sessionReminderNotification({
          role: r.role,
          reminder: reminder.kind,
          startsAt: reminder.startsAt,
          timeZone: prefs.timeZone,
          teacherName: reminder.teacherName,
          title: reminder.title,
          groupName: reminder.groupName,
        });
        await store.enqueue({
          userId: r.userId,
          kind: "session_reminder",
          channel: prefs.messageChannel,
          sessionId: reminder.sessionId,
          reminder: reminder.kind,
          linkPath: r.path,
          subject: n.subject,
          body: n.text,
          notBefore:
            reminder.kind === "1h"
              ? now
              : nextAllowedAt(now, {
                  timeZone: prefs.timeZone,
                  start: prefs.quietStart,
                  end: prefs.quietEnd,
                }),
          delivered: false,
          now,
        });
      }
    },
  };
}

/** Réserve les rappels dus et les met au journal des envois. */
export function enqueueSessionReminders(
  deps: { db: SqlExecutor },
  now: Date,
): Promise<{ sent: number; failed: number }> {
  return runAgendaReminders(
    deps.db,
    createSessionReminderSender(deps.db, now),
    now,
  );
}
