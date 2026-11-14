import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * O AdMob é um módulo nativo: não existe dentro do Expo Go. Lá os anúncios ficam desligados e o
 * resto do app funciona normal; no APK (development build ou preview) eles aparecem.
 */
export const adsAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && Platform.OS !== 'web';

type AdsModule = typeof import('react-native-google-mobile-ads');

let mod: AdsModule | null = null;
export function getAdsModule(): AdsModule | null {
  if (!adsAvailable) return null;
  if (!mod) {
    try {
      // require tardio: importar no topo quebraria o app no Expo Go
      mod = require('react-native-google-mobile-ads') as AdsModule;
    } catch (e) {
      console.warn('[ads] módulo indisponível', e);
      return null;
    }
  }
  return mod;
}

/**
 * ID do bloco de anúncio do banner. Enquanto não houver um ID real no .env (ou em builds de
 * desenvolvimento), usa o ID de teste do Google: anúncios de teste não geram receita, mas também
 * não arriscam a conta por cliques inválidos.
 */
export function bannerUnitId(): string | null {
  const ads = getAdsModule();
  if (!ads) return null;
  const real = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS : process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
  return __DEV__ || !real ? ads.TestIds.ADAPTIVE_BANNER : real;
}

let started = false;
export function initAds() {
  const ads = getAdsModule();
  if (!ads || started) return;
  started = true;
  ads
    .default()
    .initialize()
    .catch((e) => console.warn('[ads] falha ao iniciar', e));
}
