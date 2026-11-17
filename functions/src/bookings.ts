import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { applyCompletion } from './balance.js';
import { asaas, ASAAS_API_KEY } from './asaas.js';
import { db, REGION, todayBR } from './admin.js';
import { PaymentMethod } from './pricing.js';
import { refundBooking } from './payments.js';

/** Dias depois da data do serviço para ele ser concluído automaticamente (se o cliente não reclamar). */
export const AUTO_CONCLUDE_DAYS = 3;
/** Minutos para o cliente pagar um pedido por Pix ou cartão antes de ele ser cancelado. */
export const PAYMENT_TIMEOUT_MIN = 30;

/**
 * Reage às mudanças de status de um pedido:
 * - concluído: comissão em dinheiro vira débito; pago no app, desconta o débito e transfere o repasse;
 * - recusado ou cancelado: devolve o pagamento (ou cancela a cobrança ainda não paga).
 */
export const onBookingUpdated = onDocumentUpdated(
  { document: 'bookings/{bookingId}', region: REGION, secrets: [ASAAS_API_KEY] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;
    const bookingId = event.params.bookingId;

    if (after.status === 'concluido') {
      const needsTransfer = await settleCompletion(bookingId);
      if (needsTransfer) await payoutBooking(bookingId);
    } else if ((after.status === 'recusado' || after.status === 'cancelado') && after.payment !== 'dinheiro') {
      await refundBooking(bookingId);
    }
  },
);

/** Saldo e repasse de um pedido concluído. Devolve true se há valor a transferir ao prestador. */
async function settleCompletion(bookingId: string) {
  const bookingRef = db.doc(`bookings/${bookingId}`);
  let needsTransfer = false;

  await db.runTransaction(async (tx) => {
    const booking = (await tx.get(bookingRef)).data();
    if (!booking) return;
    const { providerId, payment, servicePrice, platformFee, serviceTitle, paymentStatus } = booking as {
      providerId: string;
      payment: PaymentMethod;
      servicePrice?: number;
      platformFee?: number;
      serviceTitle: string;
      paymentStatus?: string;
    };
    const balanceRef = db.doc(`providerBalances/${providerId}`);
    const entryRef = balanceRef.collection('entries').doc(bookingId);
    const providerRef = db.doc(`providers/${providerId}`);
    const [balanceSnap, entrySnap] = await Promise.all([tx.get(balanceRef), tx.get(entryRef)]);
    if (entrySnap.exists) return; // evento repetido

    tx.update(providerRef, { completedJobs: FieldValue.increment(1) });
    // pedidos antigos, ou pagos no app mas sem pagamento confirmado, não mexem no saldo
    if (typeof servicePrice !== 'number' || typeof platformFee !== 'number') return;
    if (payment !== 'dinheiro' && paymentStatus !== 'pago') {
      logger.warn('Pedido concluído sem pagamento confirmado', { bookingId });
      return;
    }

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
      needsTransfer = result.payout.amount > 0;
      tx.update(bookingRef, {
        payout: { ...result.payout, status: needsTransfer ? 'pendente' : 'pago', attempts: 0, createdAt: now },
      });
    }
  });
  return needsTransfer;
}

/**
 * Transfere o repasse para a subconta Asaas do prestador. Marca 'processando' antes de chamar o
 * Asaas para que duas execuções não transfiram duas vezes.
 * Se falhar (ex.: dinheiro de cartão ainda não liberado), fica 'erro' e retryPayouts tenta de novo.
 */
export async function payoutBooking(bookingId: string) {
  const bookingRef = db.doc(`bookings/${bookingId}`);
  const claimed = await db.runTransaction(async (tx) => {
    const b = (await tx.get(bookingRef)).data();
    const status = b?.payout?.status;
    if (!b || (status !== 'pendente' && status !== 'erro')) return null;
    tx.update(bookingRef, { 'payout.status': 'processando', 'payout.attempts': FieldValue.increment(1) });
    return b;
  });
  if (!claimed) return;

  try {
    const account = (await db.doc(`providerAccounts/${claimed.providerId}`).get()).data();
    if (!account?.walletId) throw new Error('Prestador sem conta de recebimento');
    const transfer = await asaas.transferToWallet(
      account.walletId,
      claimed.payout.amount,
      `BoraLá: ${claimed.serviceTitle} (${bookingId})`,
    );
    await bookingRef.update({ 'payout.status': 'pago', 'payout.transferId': transfer.id, 'payout.paidAt': Date.now() });
  } catch (e) {
    logger.warn('Repasse falhou, será tentado de novo', { bookingId, error: String(e) });
    await bookingRef.update({ 'payout.status': 'erro', 'payout.error': String(e).slice(0, 300) });
  }
}

/** A cada 6 horas, tenta de novo os repasses que falharam. */
export const retryPayouts = onSchedule(
  { schedule: 'every 6 hours', region: REGION, timeZone: 'America/Sao_Paulo', secrets: [ASAAS_API_KEY] },
  async () => {
    const snap = await db.collection('bookings').where('payout.status', '==', 'erro').limit(100).get();
    for (const d of snap.docs) await payoutBooking(d.id);
  },
);

/**
 * Todo dia, conclui os serviços aceitos cuja data passou há AUTO_CONCLUDE_DAYS dias e que o cliente
 * não reportou problema. Assim a comissão em dinheiro não depende de o prestador marcar como concluído.
 */
export const autoConcludeBookings = onSchedule(
  { schedule: 'every day 03:00', region: REGION, timeZone: 'America/Sao_Paulo' },
  async () => {
    const limit = todayBR(-AUTO_CONCLUDE_DAYS);
    const snap = await db.collection('bookings').where('status', '==', 'aceito').get();
    const due = snap.docs.filter((d) => d.get('date') <= limit && d.get('disputed') !== true);
    for (const d of due) await d.ref.update({ status: 'concluido', concludedBy: 'automatico' });
    logger.info(`Concluídos automaticamente: ${due.length}`);
  },
);

/** A cada 15 minutos, cancela pedidos por Pix ou cartão que não foram pagos a tempo e libera o horário. */
export const expireUnpaidBookings = onSchedule(
  { schedule: 'every 15 minutes', region: REGION, timeZone: 'America/Sao_Paulo' },
  async () => {
    const cutoff = Date.now() - PAYMENT_TIMEOUT_MIN * 60_000;
    const snap = await db.collection('bookings').where('status', '==', 'pendente').get();
    const expired = snap.docs.filter(
      (d) => d.get('payment') !== 'dinheiro' && d.get('paymentStatus') !== 'pago' && d.get('createdAt') < cutoff,
    );
    for (const d of expired) {
      const b = d.data();
      const batch = db.batch();
      batch.update(d.ref, { status: 'cancelado', cancelledBy: 'sem_pagamento' });
      batch.delete(db.doc(`busySlots/${b.providerId}_${b.date}_${b.time}`));
      await batch.commit(); // onBookingUpdated cancela a cobrança no Asaas
    }
    logger.info(`Pedidos sem pagamento cancelados: ${expired.length}`);
  },
);
