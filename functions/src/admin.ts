import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp();
export const db = getFirestore();
export const REGION = 'southamerica-east1';

/** Data de hoje (yyyy-mm-dd) no horário de Brasília. */
export function todayBR(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export const onlyDigits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '');
