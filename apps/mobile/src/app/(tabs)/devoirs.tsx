import { router } from "expo-router";
import {
  Badge,
  Loading,
  Notice,
  Row,
  Screen,
  Section,
  Text,
} from "../../components/ui";
import { m } from "../../i18n/fr";
import { api, call } from "../../lib/api";
import type { AssignmentStatus } from "../../lib/types";
import { all, useLoad } from "../../lib/use-load";

const ORDER: AssignmentStatus[] = [
  "late",
  "todo",
  "attempted",
  "done",
  "unavailable",
];

const preview = (s: string) => (s.length > 80 ? `${s.slice(0, 80)}…` : s);

const open = (id: string) =>
  router.push({ pathname: "/exercice/[id]", params: { id } });

export default function AssignmentsScreen() {
  const { data, error, refreshing, refresh, reload } = useLoad(() =>
    all([
      call(api.learner.assignments.$get()),
      call(api.learner.variants.$get()),
    ] as const),
  );
  if (!data)
    return (
      <Screen>
        {error ? <Notice code={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );
  const [{ assignments }, { variants }] = data;
  const fromAssignments = new Set(assignments.map((a) => a.variantId));
  const others = variants.filter((v) => !fromAssignments.has(v.id));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text variant="muted">{m.assignments.description}</Text>
      {assignments.length === 0 && (
        <Text variant="muted">{m.assignments.empty}</Text>
      )}
      {ORDER.map((status) => {
        const list = assignments
          .filter((a) => a.status === status)
          .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
        if (list.length === 0) return null;
        return (
          <Section key={status} title={m.assignments.groups[status]}>
            {list.map((a) => (
              <Row
                key={a.id}
                title={a.title}
                subtitle={
                  status === "unavailable"
                    ? m.assignments.unavailableHint
                    : m.common.dueOn(a.dueAt, true)
                }
                right={
                  <Badge
                    label={m.assignmentStatus[status]}
                    tone={status === "done" ? "solid" : "outline"}
                  />
                }
                {...(a.variantId
                  ? { onPress: () => open(a.variantId ?? "") }
                  : {})}
              />
            ))}
          </Section>
        );
      })}
      {others.length > 0 && (
        <Section title={m.assignments.otherExercises}>
          {others.map((v) => (
            <Row
              key={v.id}
              title={preview(v.statement)}
              subtitle={m.exercises.level(v.level)}
              onPress={() => open(v.id)}
            />
          ))}
        </Section>
      )}
    </Screen>
  );
}
