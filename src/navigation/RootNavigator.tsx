import React, { useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, NavigationState, Theme } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useApp } from '../context/AppContext';
import { colors, isDarkTheme } from '../theme';
import { t } from '../i18n';
import { feedback } from '../services/feedback';
import { isFirebaseConfigured } from '../services/firebase';
import { LogoMark } from '../components/Logo';
import SetupScreen from '../screens/auth/SetupScreen';

import LoginScreen from '../screens/auth/LoginScreen';
import ClientTabs from './ClientTabs';
import ProviderTabs from './ProviderTabs';
import ProviderDetailsScreen from '../screens/client/ProviderDetailsScreen';
import ScheduleScreen from '../screens/client/ScheduleScreen';
import CheckoutScreen from '../screens/client/CheckoutScreen';
import BookingSuccessScreen from '../screens/client/BookingSuccessScreen';
import ReviewScreen from '../screens/client/ReviewScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Última tela aberta. Trocar idioma ou tema remonta a navegação; com isso a pessoa continua
 * na mesma tela. Só vale para a mesma conta e o mesmo modo (cliente/prestador).
 */
let lastNav: { key: string; state: NavigationState } | null = null;

function navTheme(): Theme {
  const base = isDarkTheme() ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.card, text: colors.text, border: colors.border, primary: colors.primary },
  };
}

function stackOptions(): NativeStackNavigationOptions {
  return {
    animation: 'slide_from_right',
    animationDuration: 280,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.bg },
    headerTitleStyle: { fontWeight: '800', color: colors.text },
    headerTintColor: colors.text,
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: colors.bg },
  };
}

export default function RootNavigator() {
  const { session, initializing } = useApp();
  const lastDepth = useRef(0);

  if (!isFirebaseConfigured) return <SetupScreen />;
  if (initializing) {
    // enquanto o Firebase confere se há login salvo
    return (
      <View style={{ flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
        <LogoMark size={96} />
        <ActivityIndicator color={colors.secondary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  const navKey = session ? `${session.uid}:${session.role}` : 'guest';

  const handleStateChange = (state: NavigationState | undefined) => {
    if (!state) return;
    lastNav = { key: navKey, state };
    // Toca o "whoosh" sempre que a pilha de telas avança ou volta
    const depth = state.routes.length;
    if (depth !== lastDepth.current) {
      if (lastDepth.current !== 0) feedback.transition();
      lastDepth.current = depth;
    }
  };

  return (
    <NavigationContainer
      theme={navTheme()}
      initialState={lastNav?.key === navKey ? lastNav.state : undefined}
      onStateChange={handleStateChange}
    >
      <Stack.Navigator screenOptions={stackOptions()}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false, animation: 'fade' }} />
        ) : session.role === 'client' ? (
          <>
            <Stack.Screen name="ClientTabs" component={ClientTabs} options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="ProviderDetails" component={ProviderDetailsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ title: t('nav.schedule') }} />
            <Stack.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{ title: t('nav.checkout'), animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="BookingSuccess"
              component={BookingSuccessScreen}
              options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
            />
            <Stack.Screen
              name="Review"
              component={ReviewScreen}
              options={{ title: t('nav.review'), presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ title: t('nav.editProfile'), animation: 'slide_from_bottom' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="ProviderTabs" component={ProviderTabs} options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ title: t('nav.editProfile'), animation: 'slide_from_bottom' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
