import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface AppPreferences {
  emailNotifications: boolean;
  automaticOdooRefresh: boolean;
  compactView: boolean;
}
export const defaultPreferences: AppPreferences = {
  emailNotifications: true,
  automaticOdooRefresh: true,
  compactView: false,
};

const STORAGE_KEY = 'cdt-jamaica.preferences.v1';

function isPreferences(value: unknown): value is Partial<AppPreferences> {
  return typeof value === 'object' && value !== null;
}

export function getStoredPreferences(): AppPreferences {
  if (typeof window === 'undefined') return defaultPreferences;

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) return defaultPreferences;
    const parsedValue: unknown = JSON.parse(storedValue);
    if (!isPreferences(parsedValue)) return defaultPreferences;
    return { ...defaultPreferences, ...parsedValue };
  } catch {
    return defaultPreferences;
  }
}

interface PreferencesContextValue {
  preferences: AppPreferences;
  savePreferences: (preferences: AppPreferences) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(getStoredPreferences);

  useEffect(() => {
    document.documentElement.classList.toggle('compact-view', preferences.compactView);
  }, [preferences.compactView]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setPreferences(getStoredPreferences());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo<PreferencesContextValue>(() => ({
    preferences,
    savePreferences: (nextPreferences) => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPreferences));
      setPreferences(nextPreferences);
    },
  }), [preferences]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider.');
  return context;
}
