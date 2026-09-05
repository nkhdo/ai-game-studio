import { ref } from "vue";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "spritesheetstudio-theme";

function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

export function resolveTheme(
  stored: string | null,
  prefersDark: boolean,
  prepared?: string,
): Theme {
  if (isTheme(stored)) return stored;
  if (isTheme(prepared)) return prepared;
  return prefersDark ? "dark" : "light";
}

function readStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

const preference = window.matchMedia?.("(prefers-color-scheme: dark)");
const storedTheme = readStoredTheme();
const initialTheme = resolveTheme(
  storedTheme,
  preference?.matches ?? false,
  document.documentElement.dataset.theme,
);

export const currentTheme = ref<Theme>(initialTheme);
let hasExplicitTheme = isTheme(storedTheme);

export function setTheme(theme: Theme, persist = true): void {
  currentTheme.value = theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (!persist) return;
  hasExplicitTheme = true;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selected theme still applies when storage is unavailable.
  }
}

export function toggleTheme(): void {
  setTheme(currentTheme.value === "dark" ? "light" : "dark");
}

setTheme(initialTheme, false);
preference?.addEventListener("change", (event) => {
  if (!hasExplicitTheme) setTheme(event.matches ? "dark" : "light", false);
});
