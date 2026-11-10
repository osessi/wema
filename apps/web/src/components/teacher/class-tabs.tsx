"use client";

import { ChalkboardTeacher, ClipboardText, Graph } from "@phosphor-icons/react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wema/ui/components/ui/tabs";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** Onglets d'une classe : carte, élèves, devoirs (contrôle segmenté). */
export function ClassTabs({
  initial,
  map,
  learners,
  assignments,
}: {
  initial: "map" | "learners" | "assignments";
  map: ReactNode;
  learners: ReactNode;
  assignments: ReactNode;
}) {
  const t = useTranslations("teacher.class.tabs");
  return (
    <Tabs defaultValue={initial} className="min-w-0 gap-6">
      <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1">
        <TabsList>
          <TabsTrigger value="map">
            <Graph />
            {t("map")}
          </TabsTrigger>
          <TabsTrigger value="learners">
            <ChalkboardTeacher />
            {t("learners")}
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <ClipboardText />
            {t("assignments")}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="map" className="min-w-0 space-y-10">
        {map}
      </TabsContent>
      <TabsContent value="learners" className="min-w-0">
        {learners}
      </TabsContent>
      <TabsContent value="assignments" className="min-w-0">
        {assignments}
      </TabsContent>
    </Tabs>
  );
}
