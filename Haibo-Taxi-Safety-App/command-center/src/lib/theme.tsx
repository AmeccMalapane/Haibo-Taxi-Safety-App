import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Theme context for the Command Center.
 *
 * The bootstrap script in index.html has already set `<html class="dark">`
 * and `<html data-theme="…">` before React mounts — this provider is just
 * responsible for keeping that state in sync with user interactions and
 * with the OS preference if the user never manually picks one.
 *
 * Persistence lives in localStorage under `haibo_cc_theme`. Three values:
 *   - "light"  — user explicitly picked light
 *   - "dark"   — user explicitly picked dark
 *   - absent   — follow the OS preference (prefers-color-scheme)
 *
 * We expose the RESOLVED theme (either "light" or "dark") as `theme` so
 * components don't have to understand the "system" case. A separate
 * `preference` field tells settings UIs whether the user chose it.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: ResolvedTheme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
}

const THEME_STORAGE_KEY = "haibo_cc_theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // SSR or Safari private mode — fall through.
  }
  return "system";
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.dataset.theme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readStoredPreference(),
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(preference),
  );

  // Keep the `<html>` class in sync with the resolved theme whenever it
  // changes. The bootstrap script already set the initial class so this
  // effect is a no-op on first render but matters for toggles.
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // When the user's preference is "system", follow the OS live so a
  // system-wide dark mode flip (e.g. nightshift) reflows the CC too.
  useEffect(() => {
    if (preference !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(mq.matches ? "dark" : "light");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === "system") {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      }
    } catch {
      // ignore storage errors
    }
    setResolved(resolveTheme(next));
  }, []);

  const toggle = useCallback(() => {
    // Simple two-state toggle — flips whichever direction is opposite of
    // the currently-resolved theme, promoting "system" to an explicit
    // pick in the process so the UI state is predictable.
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: resolved, preference, setPreference, toggle }),
    [resolved, preference, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
