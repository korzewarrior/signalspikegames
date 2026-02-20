import { TOTAL_PLAYERS, PLAYER_PIECE_COLORS } from "./constants.js";

export const VISUAL_THEME_KEY = "vexel-visual-theme-v1";
export const VISUAL_THEME_DARK = "dark";
export const VISUAL_THEME_LIGHT = "light";

const THEME_PLAYER_COLORS = {
  [VISUAL_THEME_DARK]: ["#D55B74", "#4FB0D8", "#9BC367", "#9A7FD6"],
  [VISUAL_THEME_LIGHT]: ["#E4687C", "#4FB7DF", "#A7CE68", "#A98DE2"],
};

const THEME_PLAYER_PATTERNS = ["diag-forward", "horizontal", "dots", "crosshatch"];

function normalizePlayerIndex(idx){
  if (!Number.isFinite(idx)) return 0;
  return ((Math.trunc(idx) % TOTAL_PLAYERS) + TOTAL_PLAYERS) % TOTAL_PLAYERS;
}

export function normalizeVisualTheme(raw){
  return raw === VISUAL_THEME_DARK || raw === "classic"
    ? VISUAL_THEME_DARK
    : VISUAL_THEME_LIGHT;
}

export function isLightTheme(theme){
  return normalizeVisualTheme(theme) === VISUAL_THEME_LIGHT;
}

export function getThemeColorByIndex(theme, idx){
  const palette = isLightTheme(theme)
    ? THEME_PLAYER_COLORS[VISUAL_THEME_LIGHT]
    : THEME_PLAYER_COLORS[VISUAL_THEME_DARK];
  return palette[normalizePlayerIndex(idx)] || palette[0];
}

export function getThemePatternByIndex(idx){
  return THEME_PLAYER_PATTERNS[normalizePlayerIndex(idx)] || THEME_PLAYER_PATTERNS[0];
}

export function resolveThemeColorFromBase(theme, baseColor){
  const normalized = String(baseColor || "").toUpperCase();
  if (normalized){
    const palettes = [
      PLAYER_PIECE_COLORS,
      THEME_PLAYER_COLORS[VISUAL_THEME_LIGHT],
      THEME_PLAYER_COLORS[VISUAL_THEME_DARK],
    ];
    for (const palette of palettes){
      const idx = palette.findIndex((candidate) => String(candidate).toUpperCase() === normalized);
      if (idx >= 0){
        return getThemeColorByIndex(theme, idx);
      }
    }
  }
  return getThemeColorByIndex(theme, 0);
}
