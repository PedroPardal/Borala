import { useEffect, useState } from 'react';
import { collection, limitToLast, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { ChatMessage, Review } from '../types';
import { fb } from '../services/firebase';

/** Mensagens de uma conversa em tempo real (as 300 mais recentes). */
export function useMessages(conversationId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (!conversationId) return;
    const q = query(collection(fb.db, 'conversations', conversationId, 'messages'), orderBy('createdAt'), limitToLast(300));
    return onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ ...(d.data() as Omit<ChatMessage, 'id'>), id: d.id }))),
      (e) => console.warn('[chat]', e),
    );
  }, [conversationId]);
  return messages;
}

/** Avaliações de um prestador, mais recentes primeiro. */
export function useProviderReviews(providerId: string | undefined) {
  const [reviews, setReviews] = useState<Review[]>([]);
  useEffect(() => {
    if (!providerId) return;
    const q = query(collection(fb.db, 'reviews'), where('providerId', '==', providerId));
    return onSnapshot(
      q,
      (snap) =>
        setReviews(
          snap.docs.map((d) => ({ ...(d.data() as Omit<Review, 'id'>), id: d.id })).sort((a, b) => b.date.localeCompare(a.date)),
        ),
      (e) => console.warn('[reviews]', e),
    );
  }, [providerId]);
  return reviews;
}

/** Horários já reservados de um prestador em um dia (sem expor os pedidos de outros clientes). */
export function useBusySlots(providerId: string, date: string) {
  const [taken, setTaken] = useState<string[]>([]);
  useEffect(() => {
    const q = query(collection(fb.db, 'busySlots'), where('providerId', '==', providerId), where('date', '==', date));
    return onSnapshot(
      q,
      (snap) => setTaken(snap.docs.map((d) => d.data().time as string)),
      (e) => console.warn('[busySlots]', e),
    );
  }, [providerId, date]);
  return taken;
}
