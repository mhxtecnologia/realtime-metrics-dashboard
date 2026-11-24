import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Roda no <head>, antes da primeira pintura, para não piscar o tema errado.
 * Precisa ser autocontido: não pode importar nada.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');if(p!=='light'&&p!=='dark')p='system';var d=p==='dark'||(p==='system'&&window.matchMedia('${DARK_QUERY}').matches);var e=document.documentElement;e.dataset.theme=d?'dark':'light';e.dataset.themePreference=p;}catch(_){}})();`;

export function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/** Aplica o tema no <html> e grava a escolha; "system" apaga a gravação. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference, window.matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Armazenamento bloqueado (modo privado): o tema vale só nesta visita.
  }
  return resolved;
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference(preference: ThemePreference): void;
  /** Lê a preferência gravada e reaplica; chamado na montagem e quando o sistema muda. */
  sync(): void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  preference: 'system',
  resolved: 'light',
  setPreference(preference) {
    set({ preference, resolved: applyTheme(preference) });
  },
  sync() {
    get().setPreference(readPreference());
  },
}));
