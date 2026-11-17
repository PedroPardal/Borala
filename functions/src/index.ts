import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { applyCompletion, PaymentMethod } from './balance.js';

initializeApp();
const db = getFirestore();

/**
 * Quando o prestador conclui um pedido:
 * - em dinheiro: soma a comissão ao débito do prestador;
 * - por Pix ou cartão: desconta o débito do repasse e grava `payout` no pedido.
 *
 * O histórico fica em providerBalances/{prestador}/entries/{pedido}. Esse id torna a função
 * idempotente: se o Firebase rodar o mesmo evento de novo, nada é contado duas vezes.
 */
export const onBookingCompleted = onDocumentUpdated(
  { document: 'bookings/{bookingId}', region: 'southamerica-east1' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status || after.status !== 'concluido') return;

    const bookingId = event.params.bookingId;
    const { providerId, payment, servicePrice, platformFee, serviceTitle } = after as {
      providerId: string;
      payment: PaymentMethod;
      servicePrice?: number;
      platformFee?: number;
      serviceTitle: string;
    };
    if (typeof servicePrice !== 'number' || typeof platformFee !== 'number') {
      logger.info('Pedido antigo sem servicePrice/platformFee, saldo não alterado', { bookingId });
      return;
    }

    const balanceRef = db.doc(`providerBalances/${providerId}`);
    const entryRef = balanceRef.collection('entries').doc(bookingId);
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const providerRef = db.doc(`providers/${providerId}`);

    await db.runTransaction(async (tx) => {
      const [balanceSnap, entrySnap] = await Promise.all([tx.get(balanceRef), tx.get(entryRef)]);
      if (entrySnap.exists) return; // evento repetido

      const now = Date.now();
      const result = applyCompletion(balanceSnap.get('cashDebt') ?? 0, { payment, servicePrice, platformFee });

      tx.set(balanceRef, { cashDebt: result.debt, updatedAt: now }, { merge: true });
      tx.set(entryRef, {
        type: payment === 'dinheiro' ? 'comissao_dinheiro' : 'desconto_repasse',
        amount: result.debtDelta,
        bookingId,
        serviceTitle,
        createdAt: now,
      });
      tx.update(providerRef, { blockedForDebt: result.blocked });
      if (result.payout) {
        // TODO (integração Asaas): transferir payout.amount para a subconta do prestador e marcar 'pago'.
        tx.update(bookingRef, { payout: { ...result.payout, status: 'pendente', createdAt: now } });
      }
    });
  },
);

