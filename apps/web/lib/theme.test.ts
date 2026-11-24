import { afterEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, applyTheme, readPreference, resolveTheme } from './theme';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
});

describe('theme', () => {
  it('resolves "system" from the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('applies the theme to <html> and remembers explicit choices', () => {
    expect(applyTheme('dark')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readPreference()).toBe('dark');
  });

  it('forgets the stored choice when going back to system', () => {
    applyTheme('dark');
    applyTheme('system');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });

  it('ignores garbage in storage', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, '<script>');
    expect(readPreference()).toBe('system');
  });
});
