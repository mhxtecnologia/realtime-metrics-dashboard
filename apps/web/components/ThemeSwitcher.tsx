'use client';

import { useEffect } from 'react';
import { DARK_QUERY, useThemeStore, type ThemePreference } from '@/lib/theme';

const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Grupo de rádios nativos: setas, Tab e Espaço funcionam sem nenhum código extra. */
export function ThemeSwitcher() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const sync = useThemeStore((state) => state.sync);

  useEffect(() => {
    sync();
    const media = window.matchMedia(DARK_QUERY);
    const onSystemChange = () => {
      if (useThemeStore.getState().preference === 'system') sync();
    };
    media.addEventListener('change', onSystemChange);
    return () => media.removeEventListener('change', onSystemChange);
  }, [sync]);

  return (
    <fieldset className="segmented">
      <legend className="segmented__legend">Theme</legend>
      {OPTIONS.map((option) => (
        <label key={option.value} className="segmented__option">
          <input
            type="radio"
            name="theme"
            value={option.value}
            checked={preference === option.value}
            onChange={() => setPreference(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
