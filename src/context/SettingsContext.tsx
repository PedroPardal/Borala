import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { detectLang, Lang, LANGS, setLang as applyLang } from '../i18n';
import { applyTheme, ThemeMode, ThemePref } from '../theme';

const KEY = 'borala:settings:v1';
const THEMES: ThemePref[] = ['system', 'light', 'dark'];

interface Saved {
  lang: Lang;
  theme: ThemePref;
}

interface SettingsValue {
  lang: Lang;
  themePref: ThemePref;
  /** tema em uso de fato (resolve o "system") */
  mode: ThemeMode;
  setLang: (lang: Lang) => void;
  setThemePref: (pref: ThemePref) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/**
 * Idioma e tema escolhidos (ficam salvos no aparelho). Ao trocar, as telas abaixo são remontadas
 * para lerem os textos e as cores novas; a navegação volta para a mesma tela (ver RootNavigator).
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Saved>(() => ({ lang: detectLang(), theme: 'system' }));
  const [loaded, setLoaded] = useState(false);
  const [system, setSystem] = useState<ColorSchemeName | null>(() => Appearance.getColorScheme());

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw) as Partial<Saved>;
        setSaved((s) => ({
          lang: LANGS.some((l) => l.id === p.lang) ? (p.lang as Lang) : s.lang,
          theme: THEMES.includes(p.theme as ThemePref) ? (p.theme as ThemePref) : s.theme,
        }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme));
    return () => sub.remove();
  }, []);

  const mode: ThemeMode = saved.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : saved.theme;
  // aplica antes de desenhar as telas (as duas chamadas não fazem nada se o valor não mudou)
  applyTheme(mode);
  applyLang(saved.lang);

  const update = useCallback((patch: Partial<Saved>) => {
    setSaved((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SettingsValue>(
    () => ({
      lang: saved.lang,
      themePref: saved.theme,
      mode,
      setLang: (lang) => update({ lang }),
      setThemePref: (theme) => update({ theme }),
    }),
    [saved, mode, update],
  );

  // enquanto lê as preferências salvas (alguns milissegundos), mostra a cor do splash
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#101B31' }} />;

  return (
    <SettingsContext.Provider value={value}>
      <React.Fragment key={`${mode}-${saved.lang}`}>{children}</React.Fragment>
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings deve ser usado dentro de <SettingsProvider>');
  return ctx;
}
