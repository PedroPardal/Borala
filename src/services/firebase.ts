import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Firestore, initializeFirestore } from 'firebase/firestore';
import { t, TKey } from '../i18n';

// Preenchido pelo .env (veja .env.example). O Expo só embute variáveis com prefixo EXPO_PUBLIC_.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(config).every((v) => typeof v === 'string' && v.length > 0);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (isFirebaseConfigured) {
  const isFirstInit = getApps().length === 0;
  app = isFirstInit ? initializeApp(config) : getApp();
  // o login fica salvo no aparelho; no reload do Fast Refresh a instância já existe
  auth = isFirstInit ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }) : getAuth(app);
  // long polling evita travamentos do canal de streaming do Firestore no React Native
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true });
}

/** Só chamar depois de checar `isFirebaseConfigured` (o app mostra a tela de configuração antes). */
export const fb = {
  get auth() {
    if (!auth) throw new Error('Firebase não configurado');
    return auth;
  },
  get db() {
    if (!db) throw new Error('Firebase não configurado');
    return db;
  },
};

// códigos que têm a mesma mensagem de outro
const ALIASES: Record<string, string> = {
  'auth/wrong-password': 'auth/invalid-credential',
};

/** Mensagem de erro do Firebase (ou das fotos) no idioma do app, para mostrar ao usuário. */
export function firebaseErrorMessage(e: unknown): string {
  const raw = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
  const code = ALIASES[raw] ?? raw;
  const key = `err.${code}` as TKey;
  const msg = code ? t(key) : '';
  if (msg && msg !== key) return msg;
  // mostra o código para facilitar descobrir o problema
  return raw ? t('err.withCode', { code: raw }) : t('err.generic');
}
