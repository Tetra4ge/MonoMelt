import { useLayoutEffect } from 'react';
import { useThemeStore } from '../../stores/themeStore';

/** Writes the active theme to <html data-theme>. Every page follows it; dark is the default. */
export default function ThemeSync() {
  const theme = useThemeStore((state) => state.theme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}
