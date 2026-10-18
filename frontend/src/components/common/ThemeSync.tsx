import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isDarkOnlyPath, useThemeStore } from '../../stores/themeStore';

/**
 * Writes the active theme to <html data-theme>. The landing and login pages are always dark,
 * whatever the user picked elsewhere.
 */
export default function ThemeSync() {
  const { pathname } = useLocation();
  const theme = useThemeStore((state) => state.theme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = isDarkOnlyPath(pathname) ? 'dark' : theme;
  }, [pathname, theme]);

  return null;
}
