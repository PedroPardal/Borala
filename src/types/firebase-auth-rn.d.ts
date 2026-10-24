// O build React Native do Firebase Auth (que o Metro usa) exporta getReactNativePersistence,
// mas os tipos públicos de "firebase/auth" não incluem essa função.
import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
