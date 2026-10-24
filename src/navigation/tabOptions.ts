import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

/** Altura útil da barra (sem a área segura do sistema). */
const BAR_HEIGHT = 64;

export function useTabScreenOptions(): BottomTabNavigationOptions {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    animation: 'shift', // transição suave entre abas
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelStyle: { fontWeight: '800', fontSize: 11, marginTop: 2 },
    // a caixa padrão do ícone tem 31x28; o TabIcon precisa de espaço para a "pílula"
    tabBarIconStyle: { width: 60, height: 34 },
    tabBarStyle: {
      height: BAR_HEIGHT + insets.bottom,
      paddingTop: 6,
      paddingBottom: insets.bottom + 6,
      borderTopWidth: 2,
      borderTopColor: colors.border,
      backgroundColor: colors.white,
    },
  };
}
