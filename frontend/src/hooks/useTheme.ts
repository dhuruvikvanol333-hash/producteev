import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setTheme, toggleTheme, applyTheme, resolveTheme, type Theme } from '../store/slices/themeSlice';

export function useTheme() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.theme);
  const userId = useAppSelector((state) => state.user.currentUser?.id);
  const resolved = resolveTheme(theme);

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS preference changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return {
    theme,
    resolved,
    isDark: resolved === 'dark',
    setTheme: (t: Theme) => dispatch(setTheme({ theme: t, userId })),
    toggle: () => dispatch(toggleTheme(userId)),
  };
}
