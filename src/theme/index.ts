import { StyleSheet } from 'react-native';

export type ThemeMode = 'light' | 'dark';
/** o que a pessoa escolheu nas preferências; "system" segue o tema do celular */
export type ThemePref = 'system' | ThemeMode;

// Paleta BoraLá: Laranja Enérgico, Amarelo Elétrico, Azul Noturno, Azul Conecta e Off-white.
// As cores da marca são as mesmas nos dois temas; mudam só fundos, textos, bordas e tons claros.
const brand = {
  primary: '#FF5722',
  /** "sombra" sólida dos botões laranja */
  primaryDark: '#D8431A',
  // amarelo é claro demais para texto branco: use `onSecondary` por cima dele
  secondary: '#E7FC00',
  secondaryDark: '#B5C600',
  onSecondary: '#0F172A',
  navy: '#0F172A',
  navyLight: '#1E293B',
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  success: '#16A34A',
  danger: '#E11D48',
  dangerDark: '#BE123C',
  star: '#FFB800',
  /** branco de verdade (texto e ícones sobre cores fortes); para fundo de cartão use `card` */
  white: '#FFFFFF',
};

const light = {
  ...brand,
  primaryLight: '#FFEDE6',
  /** laranja para textos (preços, destaques) */
  primaryText: '#D8431A',
  secondaryLight: '#FAFFD6',
  blueLight: '#EFF4FF',
  blueText: '#1D4ED8',
  dangerLight: '#FFF1F3',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  borderDark: '#CBD5E1',
  bg: '#F8FAFC',
  card: '#FFFFFF',
};

export type Palette = typeof light;

const dark: Palette = {
  ...brand,
  primaryLight: '#3A2018',
  primaryText: '#FF8A65',
  secondaryLight: '#262A0B',
  blueLight: '#16213D',
  blueText: '#93B4FF',
  dangerLight: '#3A1520',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  border: '#243045',
  borderDark: '#3A475E',
  bg: '#0B1220',
  card: '#141D2F',
};

/**
 * Cores do tema atual. O objeto é o mesmo o app inteiro; `applyTheme` troca os valores e o
 * SettingsProvider remonta as telas, então quem lê `colors.x` na hora de desenhar já vê o tema novo.
 */
export const colors: Palette = { ...light };

let mode: ThemeMode = 'light';
let version = 0;

export function applyTheme(next: ThemeMode) {
  if (next === mode) return;
  mode = next;
  Object.assign(colors, next === 'dark' ? dark : light);
  version++;
}

export const isDarkTheme = () => mode === 'dark';

/**
 * Igual ao `StyleSheet.create`, mas recalcula os estilos quando o tema muda.
 * Use sempre uma função: `makeStyles(() => ({ ... }))`.
 */
type StyleInput = Parameters<typeof StyleSheet.create>[0];

export function makeStyles<T extends StyleInput>(factory: () => T & StyleInput): Readonly<T> {
  let cache: Readonly<T> | null = null;
  let builtFor = -1;
  return new Proxy({} as Readonly<T>, {
    get(_target, key) {
      if (builtFor !== version || !cache) {
        cache = StyleSheet.create(factory());
        builtFor = version;
      }
      return (cache as Record<string | symbol, unknown>)[key];
    },
  });
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
