import AsyncStorage from '@react-native-async-storage/async-storage';
import { Booking, Conversation, Provider, UserProfile } from '../types';

/**
 * Cópia dos dados da conta no aparelho. O Firestore do SDK web não guarda nada em disco no
 * React Native, então sem isto o app abriria vazio (ou travado no carregamento) sem internet.
 */
export interface OfflineSnapshot {
  profile: UserProfile | null;
  providers: Provider[];
  bookings: Booking[];
  conversations: Conversation[];
  /** quando os pedidos vieram do servidor pela última vez (ms) */
  syncedAt: number | null;
}

const key = (uid: string) => `borala:offline:v1:${uid}`;

export async function loadOfflineSnapshot(uid: string): Promise<OfflineSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    return raw ? (JSON.parse(raw) as OfflineSnapshot) : null;
  } catch {
    return null;
  }
}

export async function saveOfflineSnapshot(uid: string, data: OfflineSnapshot) {
  try {
    await AsyncStorage.setItem(key(uid), JSON.stringify(data));
  } catch (e) {
    console.warn('[offline] não foi possível salvar', e);
  }
}

export async function clearOfflineSnapshot(uid: string) {
  try {
    await AsyncStorage.removeItem(key(uid));
  } catch {
    // nada a fazer
  }
}
