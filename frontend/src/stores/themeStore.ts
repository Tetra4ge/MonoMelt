import { create } from 'zustand';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'monomelt-theme';

// Pages that always stay dark and never show the toggle.
const DARK_ONLY_PATHS = ['/', '/login', '/auth/callback'];

export const isDarkOnlyPath = (pathname: string) => DARK_ONLY_PATHS.includes(pathname);

const readStoredTheme = (): Theme => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage can be unavailable; the choice then lasts for the session only */
    }
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));
