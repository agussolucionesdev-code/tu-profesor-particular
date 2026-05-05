/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";

const THEME_STORAGE_KEY = "theme";
const ACCESSIBILITY_STORAGE_KEY = "ui_accessibility_preferences";

const DEFAULT_PREFERENCES = {
  themePreference: "light",
  fontScale: "default",
  contrast: "default",
  fontFamily: "brand",
  motion: "default",
  accentBalance: "balanced",
  calmUi: false,
};

const UISettingsContext = createContext(null);

const canUseDom = () => typeof window !== "undefined";

const getSystemTheme = () => {
  if (!canUseDom()) return "light";

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
    ? "dark"
    : "light";
};

const getStoredThemePreference = () => {
  if (!canUseDom()) return DEFAULT_PREFERENCES.themePreference;

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return ["light", "dark", "system"].includes(storedTheme)
      ? storedTheme
      : DEFAULT_PREFERENCES.themePreference;
  } catch {
    return DEFAULT_PREFERENCES.themePreference;
  }
};

const getStoredPreferences = () => {
  if (!canUseDom()) return DEFAULT_PREFERENCES;

  try {
    const rawPreferences = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (!rawPreferences) {
      return {
        ...DEFAULT_PREFERENCES,
        themePreference: getStoredThemePreference(),
      };
    }

    const parsedPreferences = JSON.parse(rawPreferences);

    return {
      ...DEFAULT_PREFERENCES,
      ...parsedPreferences,
      themePreference:
        parsedPreferences?.themePreference || getStoredThemePreference(),
    };
  } catch {
    return {
      ...DEFAULT_PREFERENCES,
      themePreference: getStoredThemePreference(),
    };
  }
};

const getEffectiveTheme = (themePreference, systemTheme) =>
  themePreference === "system" ? systemTheme : themePreference;

const applyDocumentPreferences = (preferences, systemTheme) => {
  if (!canUseDom()) return;

  const root = window.document.documentElement;
  root.dataset.theme = getEffectiveTheme(preferences.themePreference, systemTheme);
  root.dataset.themePreference = preferences.themePreference;
  root.dataset.fontScale = preferences.fontScale;
  root.dataset.contrast = preferences.contrast;
  root.dataset.fontFamily = preferences.fontFamily;
  root.dataset.motion = preferences.motion;
  root.dataset.accentBalance = preferences.accentBalance;
  root.dataset.calmUi = preferences.calmUi ? "true" : "false";
};

export const UISettingsProvider = ({ children }) => {
  const [preferences, setPreferences] = useState(() => getStoredPreferences());
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());

  useEffect(() => {
    if (!canUseDom()) return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!canUseDom()) return;

    applyDocumentPreferences(preferences, systemTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preferences.themePreference);
      window.localStorage.setItem(
        ACCESSIBILITY_STORAGE_KEY,
        JSON.stringify(preferences),
      );
    } catch {
      // Ignore storage failures silently.
    }
  }, [preferences, systemTheme]);

  const setThemePreference = (themePreference) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      themePreference,
    }));
  };

  const updatePreference = (key, value) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      [key]: value,
    }));
  };

  const resetAccessibilityPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  const effectiveTheme = getEffectiveTheme(
    preferences.themePreference,
    systemTheme,
  );

  const toggleTheme = () => {
    setThemePreference(effectiveTheme === "dark" ? "light" : "dark");
  };

  return (
    <UISettingsContext.Provider
      value={{
        preferences,
        effectiveTheme,
        setThemePreference,
        updatePreference,
        resetAccessibilityPreferences,
        toggleTheme,
      }}
    >
      {children}
    </UISettingsContext.Provider>
  );
};

export const useUISettings = () => {
  const context = useContext(UISettingsContext);

  if (!context) {
    throw new Error("useUISettings must be used within UISettingsProvider");
  }

  return context;
};
