/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHidratado } from "../../hooks/useHidratado";

const THEME_STORAGE_KEY = "theme";
const ACCESSIBILITY_STORAGE_KEY = "ui_accessibility_preferences";

/* Sube cuando cambia el significado de lo guardado. La 2 es la primera que
   distingue un «claro» elegido de uno puesto por el sistema: ver la migración
   en getStoredPreferences y en public/tema.js, que decide lo mismo antes de
   que cargue React. */
const PREFERENCES_VERSION = 2;

/* «Sistema» y no «claro»: el tema sigue al teléfono o la computadora. Antes
   arrancaba siempre en claro, aunque la opción «Sistema» existía. */
const DEFAULT_PREFERENCES = {
  themePreference: "system",
  fontScale: "default",
  contrast: "default",
  fontFamily: "brand",
  motion: "default",
  accentBalance: "balanced",
  calmUi: false,
};

/* Todas las preferencias son valores simples: alcanza con comparar campo por campo. */
const mismasPreferencias = (a, b) => Object.keys(DEFAULT_PREFERENCES).every((clave) => a[clave] === b[clave]);

const UISettingsContext = createContext(null);

const canUseDom = () => typeof window !== "undefined";

const getSystemTheme = () => {
  if (!canUseDom()) return "light";

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
    ? "dark"
    : "light";
};

/* LA MIGRACIÓN. Hasta la versión 2, el código escribía las preferencias en CADA
   visita, con «claro» por defecto: todo el que entró alguna vez tiene «claro»
   guardado sin haberlo elegido. Un «claro» sin marca de versión se lee como
   «Sistema». Un «oscuro» se respeta: nunca fue el valor por defecto, así que si
   está, alguien lo eligió. */
const migrarTema = (tema, version) =>
  tema === "light" && version !== PREFERENCES_VERSION ? "system" : tema;

const getStoredThemePreference = () => {
  if (!canUseDom()) return DEFAULT_PREFERENCES.themePreference;

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return ["light", "dark", "system"].includes(storedTheme)
      ? migrarTema(storedTheme, undefined)
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
    const tema = parsedPreferences?.themePreference;

    return {
      ...DEFAULT_PREFERENCES,
      ...parsedPreferences,
      themePreference: ["light", "dark", "system"].includes(tema)
        ? migrarTema(tema, parsedPreferences.version)
        : getStoredThemePreference(),
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
        JSON.stringify({ ...preferences, version: PREFERENCES_VERSION }),
      );
    } catch {
      // Ignore storage failures silently.
    }
  }, [preferences, systemTheme]);

  const setThemePreference = useCallback((themePreference) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      themePreference,
    }));
  }, []);

  const updatePreference = useCallback((key, value) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      [key]: value,
    }));
  }, []);

  const resetAccessibilityPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  /* Lo que VEN los componentes: hasta terminar de hidratar, lo mismo que dibujó
     el prerender, que no tiene localStorage ni matchMedia (ver useHidratado).
     El documento, en cambio, recibe siempre lo real: el efecto de arriba usa
     `preferences`, y tema.js ya había fijado data-theme antes de pintar.

     Si lo guardado es igual a lo de fábrica —la mayoría de las visitas— se
     sigue usando el MISMO objeto, y el valor del contexto está memorizado: al
     terminar de hidratar nada cambia y nadie se redibuja. Antes el contexto
     era un objeto nuevo en cada dibujo y la barra y el panel de accesibilidad
     se redibujaban enteros, en una tarea sincrónica, justo después de
     hidratar. */
  const hidratado = useHidratado();
  const visibles =
    hidratado && !mismasPreferencias(preferences, DEFAULT_PREFERENCES)
      ? preferences
      : DEFAULT_PREFERENCES;
  const effectiveTheme = getEffectiveTheme(
    visibles.themePreference,
    hidratado ? systemTheme : "light",
  );

  const toggleTheme = useCallback(() => {
    setThemePreference(effectiveTheme === "dark" ? "light" : "dark");
  }, [effectiveTheme, setThemePreference]);

  const valor = useMemo(
    () => ({
      preferences: visibles,
      effectiveTheme,
      setThemePreference,
      updatePreference,
      resetAccessibilityPreferences,
      toggleTheme,
    }),
    [visibles, effectiveTheme, setThemePreference, updatePreference, resetAccessibilityPreferences, toggleTheme],
  );

  return (
    <UISettingsContext.Provider value={valor}>
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
