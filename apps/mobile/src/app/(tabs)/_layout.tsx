import { Tabs } from "expo-router";
import { Icon, type IconName } from "../../components/ui";
import { m } from "../../i18n/fr";
import { fonts, useTheme } from "../../theme";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: m.tabs.home, icon: "home-outline" },
  { name: "devoirs", title: m.tabs.assignments, icon: "book-outline" },
  { name: "prof-ia", title: m.tabs.tutor, icon: "chatbubbles-outline" },
  { name: "messages", title: m.tabs.messages, icon: "mail-outline" },
  { name: "moi", title: m.tabs.me, icon: "person-circle-outline" },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.ground },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.displaySemi },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium },
        sceneStyle: { backgroundColor: colors.ground },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Icon
                name={tab.icon}
                color={typeof color === "string" ? color : colors.inkMuted}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
