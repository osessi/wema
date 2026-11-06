"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wema/ui/components/ui/tabs";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** Onglets d'une classe : carte, élèves, devoirs. */
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
    <Tabs defaultValue={initial} className="gap-4">
      <TabsList>
        <TabsTrigger value="map">{t("map")}</TabsTrigger>
        <TabsTrigger value="learners">{t("learners")}</TabsTrigger>
        <TabsTrigger value="assignments">{t("assignments")}</TabsTrigger>
      </TabsList>
      <TabsContent value="map" className="space-y-6">
        {map}
      </TabsContent>
      <TabsContent value="learners">{learners}</TabsContent>
      <TabsContent value="assignments">{assignments}</TabsContent>
    </Tabs>
  );
}
