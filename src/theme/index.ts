// Paleta BoraLá: Laranja Enérgico, Amarelo Elétrico, Azul Noturno, Azul Conecta e Off-white
export const colors = {
  primary: '#FF5722',
  primaryDark: '#D8431A',
  primaryLight: '#FFEDE6',
  // amarelo é claro demais para texto branco: use `onSecondary` por cima dele
  secondary: '#E7FC00',
  secondaryDark: '#B5C600',
  secondaryLight: '#FAFFD6',
  onSecondary: '#0F172A',
  navy: '#0F172A',
  navyLight: '#1E293B',
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  blueLight: '#EFF4FF',
  success: '#16A34A',
  danger: '#E11D48',
  dangerDark: '#BE123C',
  star: '#FFB800',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  borderDark: '#CBD5E1',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  white: '#FFFFFF',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: '800' as const, color: colors.text },
  h3: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '500' as const, color: colors.text },
  small: { fontSize: 13, fontWeight: '500' as const, color: colors.textMuted },
};
