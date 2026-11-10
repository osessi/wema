import { useColorScheme } from "react-native";

/**
 * Charte Wema « le cahier et le crayon » (packages/ui/src/globals.css) :
 * thème clair « Crayon » et sombre « Nuit ». 90 % de neutres, le jaune est
 * rare (moments forts), une mauvaise réponse n'est jamais en rouge.
 */
const light = {
  ground: "#F7F4EC",
  surface: "#FFFFFF",
  surfaceSunk: "#EFEADB",
  ink: "#161512",
  inkMuted: "#6A675E",
  line: "#E6E1D3",
  lineStrong: "#CFC8B4",
  brand: "#FFC529",
  brandSoft: "#FFF1C2",
  inkOnBrand: "#161512",
  action: "#161512",
  onAction: "#FFFFFF",
  danger: "#C2362B",
  mint: "#BFEFD9",
  mintInk: "#145238",
  butter: "#FFE89A",
  butterInk: "#6B5200",
  peach: "#FFC9B5",
  peachInk: "#7A3418",
  rose: "#F7C6D9",
  roseInk: "#7A2348",
  lime: "#DDF59A",
  limeInk: "#3F5208",
  sand: "#EAD9BF",
  sandInk: "#5E4524",
};

export type Palette = typeof light;

const dark: Palette = {
  ground: "#0E0E0C",
  surface: "#1A1A17",
  surfaceSunk: "#24241F",
  ink: "#F4F4EE",
  inkMuted: "#A3A398",
  line: "#2C2C27",
  lineStrong: "#3D3D36",
  brand: "#FFC529",
  brandSoft: "#3A3115",
  inkOnBrand: "#161512",
  action: "#FFC529",
  onAction: "#161512",
  danger: "#FF8A7E",
  mint: "#163A2C",
  mintInk: "#9FE3C4",
  butter: "#3A3115",
  butterInk: "#FFE08A",
  peach: "#3D2219",
  peachInk: "#FFB9A0",
  rose: "#3A1E2A",
  roseInk: "#F7B7CF",
  lime: "#2C3514",
  limeInk: "#D3EF8A",
  sand: "#332B20",
  sandInk: "#E6CFAE",
};

/** Polices chargées au démarrage (app/_layout.tsx). Urbanist pour les titres ≥ 20 px. */
export const fonts = {
  display: "Urbanist_700Bold",
  displaySemi: "Urbanist_600SemiBold",
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
} as const;

export const radius = { sm: 8, md: 10, lg: 12, xl: 16, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export function useTheme(): { colors: Palette; dark: boolean } {
  const scheme = useColorScheme();
  return scheme === "dark"
    ? { colors: dark, dark: true }
    : { colors: light, dark: false };
}

export const palettes = { light, dark };
