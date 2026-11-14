import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AppProvider } from './src/context/AppContext';
import { SettingsProvider } from './src/context/SettingsContext';
import RootNavigator from './src/navigation/RootNavigator';
import { Sound } from './src/services/feedback';
import { initAds } from './src/services/ads';
import { isDarkTheme } from './src/theme';

/** Fica dentro do SettingsProvider: é remontada quando o tema muda e lê o tema atual. */
function ThemedStatusBar() {
  return <StatusBar style={isDarkTheme() ? 'light' : 'dark'} />;
}

export default function App() {
  useEffect(() => {
    Sound.init();
    initAds();
    return () => Sound.release();
  }, []);

  return (
    <SafeAreaProvider>
      {/* o Android em tela cheia (edge-to-edge) não redimensiona a tela com o teclado;
          o KeyboardProvider mede o teclado para os campos subirem e não ficarem escondidos */}
      <KeyboardProvider>
        <AppProvider>
          {/* idioma e tema escolhidos pela pessoa; ao trocar, as telas são redesenhadas */}
          <SettingsProvider>
            <ThemedStatusBar />
            <RootNavigator />
          </SettingsProvider>
        </AppProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
