import { beforeEach, describe, expect, it } from "vitest";
import { currentTheme, resolveTheme, setTheme, THEME_STORAGE_KEY, toggleTheme } from "./theme";

describe("app theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setTheme("light", false);
  });

  it("prefers a stored choice over the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme(null, true)).toBe("dark");
  });

  it("toggles, applies, and persists the explicit theme", () => {
    toggleTheme();

    expect(currentTheme.value).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
