import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// "null" significa que o sistema ainda não sabe; nesse caso consideramos online
const isOnlineState = (s: NetInfoState) => s.isConnected !== false && s.isInternetReachable !== false;

let current = true;
const listeners = new Set<(online: boolean) => void>();

NetInfo.addEventListener((s) => {
  const next = isOnlineState(s);
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l(next));
});

/** Estado da conexão agora (para checar antes de gravar no Firestore). */
export const isOnline = () => current;

/** Re-renderiza quando a internet cai ou volta. */
export function useOnline() {
  const [online, setOnline] = useState(current);
  useEffect(() => {
    listeners.add(setOnline);
    setOnline(current);
    return () => {
      listeners.delete(setOnline);
    };
  }, []);
  return online;
}

/** Erro com o mesmo formato dos erros do Firebase, traduzido em firebaseErrorMessage. */
export function requireOnline() {
  if (!current) throw Object.assign(new Error('Sem internet'), { code: 'app/offline' });
}
