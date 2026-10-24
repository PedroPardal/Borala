import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Firestore, initializeFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

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
let storage: FirebaseStorage | undefined;

if (isFirebaseConfigured) {
  const isFirstInit = getApps().length === 0;
  app = isFirstInit ? initializeApp(config) : getApp();
  // o login fica salvo no aparelho; no reload do Fast Refresh a instância já existe
  auth = isFirstInit ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }) : getAuth(app);
  // long polling evita travamentos do canal de streaming do Firestore no React Native
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true });
  storage = getStorage(app);
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
  get storage() {
    if (!storage) throw new Error('Firebase não configurado');
    return storage;
  },
};

/** Mensagens de erro do Firebase em português, para mostrar ao usuário. */
export function firebaseErrorMessage(e: unknown): string {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não existe conta com esse e-mail.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
    'auth/network-request-failed': 'Sem conexão com a internet.',
    // projeto sem o Authentication iniciado ou sem o login por e-mail ativado no console
    'auth/configuration-not-found': 'O login ainda não foi ativado no Firebase (Authentication > Começar).',
    'auth/operation-not-allowed': 'O login por e-mail/senha está desativado no Firebase.',
    'permission-denied': 'Você não tem permissão para fazer isso.',
    unavailable: 'Servidor indisponível. Verifique sua internet.',
    'storage/unauthorized': 'Sem permissão para enviar a foto.',
    'storage/retry-limit-exceeded': 'A conexão caiu durante o envio da foto.',
  };
  return map[code] ?? 'Algo deu errado. Tente de novo.';
}
