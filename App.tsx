import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AppProvider } from './src/context/AppContext';
import RootNavigator from './src/navigation/RootNavigator';
import { Sound } from './src/services/feedback';
import { initAds } from './src/services/ads';

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
          <StatusBar style="dark" />
          <RootNavigator />
        </AppProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
