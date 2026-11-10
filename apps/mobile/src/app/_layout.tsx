import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Urbanist_600SemiBold } from "@expo-google-fonts/urbanist/600SemiBold";
import { Urbanist_700Bold } from "@expo-google-fonts/urbanist/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { m } from "../i18n/fr";
import { configureForegroundNotifications, registerForPush } from "../lib/push";
import { SessionProvider, useSession } from "../lib/session";
import { fonts, useTheme } from "../theme";

void SplashScreen.preventAutoHideAsync();
configureForegroundNotifications();

function Navigation() {
  const { state } = useSession();
  const { colors, dark } = useTheme();
  const signedIn = state.status === "signedIn";
  // Conditions à accepter (nouvelle version) : seul l'écran d'acceptation est ouvert.
  const mustAccept = state.status === "signedIn" && state.me.mustAcceptTerms;
  const ready = signedIn && !mustAccept;

  useEffect(() => {
    if (state.status !== "loading") void SplashScreen.hideAsync();
    // Jeton push déjà autorisé : on le (ré)enregistre sans rien demander.
    if (signedIn) void registerForPush(false);
  }, [state.status, signedIn]);

  if (state.status === "loading") return null;

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.ground },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fonts.displaySemi },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.ground },
        }}
      >
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="exercice/[id]"
            options={{ title: m.exercises.title }}
          />
          <Stack.Screen name="seance/[id]" options={{ title: m.tutor.title }} />
          <Stack.Screen
            name="progression"
            options={{ title: m.progress.title }}
          />
          <Stack.Screen
            name="conversation/[id]"
            options={{ title: m.messages.title }}
          />
          <Stack.Screen
            name="nouveau-message"
            options={{ title: m.messages.new, presentation: "modal" }}
          />
        </Stack.Protected>
        <Stack.Protected guard={mustAccept}>
          <Stack.Screen name="conditions" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="connexion" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    Urbanist_700Bold,
    Urbanist_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  // Sans les polices (échec de chargement), l'appli reste utilisable avec celles du système.
  if (!loaded && !failed) return null;
  return (
    <SessionProvider>
      <Navigation />
    </SessionProvider>
  );
}
