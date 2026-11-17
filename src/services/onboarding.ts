import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lembra se a pessoa já passou pela apresentação do Mélo neste aparelho. Na primeira vez o app
 * abre no cadastro animado; depois, abre direto no login.
 */
const KEY = 'borala:onboarding-visto';
let cached: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

export function useOnboardingSeen() {
  const [seen, setSeen] = useState<boolean | null>(cached);
  useEffect(() => {
    listeners.add(setSeen);
    if (cached === null) {
      AsyncStorage.getItem(KEY)
        .then((v) => {
          cached = v === '1';
          listeners.forEach((l) => l(cached as boolean));
        })
        .catch(() => setSeen(false));
    }
    return () => {
      listeners.delete(setSeen);
    };
  }, []);
  return seen;
}

export function markOnboardingSeen() {
  cached = true;
  listeners.forEach((l) => l(true));
  AsyncStorage.setItem(KEY, '1').catch(() => {});
}
