import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { asaas, ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, AsaasError } from './asaas.js';
import { db, onlyDigits, REGION, todayBR } from './admin.js';
import { cents, PaymentMethod, priceFor } from './pricing.js';

export type PaymentStatus = 'aguardando' | 'pago' | 'estornado' | 'cancelado';

/** O que o app recebe para mostrar o pagamento. */
export interface PaymentView {
  billingType: 'PIX' | 'CREDIT_CARD';
  value: number;
  invoiceUrl: string;
  pixPayload?: string;
  pixImage?: string;
  pixExpiresAt?: string;
}

const asView = (p: FirebaseFirestore.DocumentData): PaymentView => ({
  billingType: p.billingType,
  value: p.value,
  invoiceUrl: p.invoiceUrl,
  pixPayload: p.pixPayload,
  pixImage: p.pixImage,
  pixExpiresAt: p.pixExpiresAt,
});

function asHttpsError(e: unknown): never {
  if (e instanceof HttpsError) throw e;
  if (e instanceof AsaasError) {
    logger.error('Erro do Asaas', { status: e.status, body: e.body });
    throw new HttpsError('failed-precondition', `Pagamento recusado pelo Asaas: ${e.message}`);
  }
  logger.error(e);
  throw new HttpsError('internal', 'Não foi possível criar o pagamento. Tente de novo.');
}

/** Cliente do Asaas para o usuário (criado uma vez e guardado em asaasCustomers/{uid}). */
async function customerFor(uid: string, email: string | undefined) {
  const ref = db.doc(`asaasCustomers/${uid}`);
  const saved = await ref.get();
  if (saved.exists) return saved.get('customerId') as string;
  const user = (await db.doc(`users/${uid}`).get()).data();
  const cpfCnpj = onlyDigits(user?.cpf);
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    throw new HttpsError('failed-precondition', 'Informe seu CPF para pagar pelo app.');
  }
  const c = await asaas.createCustomer({ name: user?.name ?? 'Cliente', cpfCnpj, email, externalReference: uid });
  await ref.set({ customerId: c.id, createdAt: Date.now() });
  return c.id;
}

/**
 * Cria (ou devolve, se já existir) a cobrança Pix ou cartão de um pedido.
 * O valor é recalculado aqui a partir da tabela de preços do prestador.
 */
export const createPayment = onCall({ region: REGION, secrets: [ASAAS_API_KEY] }, async (req): Promise<PaymentView> => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const bookingId = req.data?.bookingId;
  if (typeof bookingId !== 'string' || !bookingId) throw new HttpsError('invalid-argument', 'Pedido inválido.');

  try {
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const booking = (await bookingRef.get()).data();
    if (!booking || booking.clientId !== uid) throw new HttpsError('not-found', 'Pedido não encontrado.');
    const method = booking.payment as PaymentMethod;
    if (method === 'dinheiro') throw new HttpsError('failed-precondition', 'Este pedido é pago em dinheiro.');
    if (booking.status !== 'pendente') throw new HttpsError('failed-precondition', 'Este pedido não aceita mais pagamento.');
    if (booking.paymentStatus === 'pago') throw new HttpsError('already-exists', 'Este pedido já foi pago.');

    const paymentRef = db.doc(`payments/${bookingId}`);
    const existing = (await paymentRef.get()).data();
    if (existing?.asaasPaymentId && existing.status === 'aguardando') return asView(existing);

    const provider = (await db.doc(`providers/${booking.providerId}`).get()).data();
    if (!provider?.acceptsOnlinePayment) {
      throw new HttpsError('failed-precondition', 'Este prestador ainda não recebe por Pix ou cartão.');
    }
    const service = (provider.priceTable ?? []).find((s: { id: string }) => s.id === booking.serviceId);
    if (!service || cents(service.price) !== cents(booking.servicePrice)) {
      throw new HttpsError('failed-precondition', 'O prestador mudou o preço deste serviço. Faça o pedido de novo.');
    }
    const price = priceFor(service.price, method);
    if (Math.abs(price.total - booking.price) > 0.01 || Math.abs(price.fee - booking.platformFee) > 0.01) {
      throw new HttpsError('failed-precondition', 'O valor do pedido não confere. Faça o pedido de novo.');
    }

    const customer = await customerFor(uid, req.auth?.token.email);
    const billingType = method === 'pix' ? 'PIX' : 'CREDIT_CARD';
    const created = await asaas.createPayment({
      customer,
      billingType,
      value: price.total,
      dueDate: todayBR(),
      description: `BoraLá: ${booking.serviceTitle} com ${booking.providerName}`,
      externalReference: bookingId,
    });

    const doc: FirebaseFirestore.DocumentData = {
      clientId: uid,
      providerId: booking.providerId,
      asaasPaymentId: created.id,
      billingType,
      value: price.total,
      invoiceUrl: created.invoiceUrl,
      status: 'aguardando' satisfies PaymentStatus,
      createdAt: Date.now(),
    };
    if (billingType === 'PIX') {
      const qr = await asaas.pixQrCode(created.id);
      doc.pixPayload = qr.payload;
      doc.pixImage = qr.encodedImage;
      doc.pixExpiresAt = qr.expirationDate;
    }
    await paymentRef.set(doc);
    await bookingRef.update({ paymentStatus: 'aguardando' satisfies PaymentStatus });
    return asView(doc);
  } catch (e) {
    asHttpsError(e);
  }
});

/** Eventos do Asaas que mudam o pagamento. Os outros são ignorados. */
const PAID = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const GONE = new Set(['PAYMENT_OVERDUE', 'PAYMENT_DELETED']);
const REFUNDED = new Set(['PAYMENT_REFUNDED']);

/**
 * Webhook do Asaas. Cadastre a URL desta função no painel do Asaas (Integrações > Webhooks) com o
 * mesmo token do segredo ASAAS_WEBHOOK_TOKEN. Sempre responde 200 para eventos válidos: se responder
 * erro várias vezes, o Asaas pausa a fila de webhooks.
 */
export const asaasWebhook = onRequest({ region: REGION, secrets: [ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  if (req.get('asaas-access-token') !== ASAAS_WEBHOOK_TOKEN.value()) {
    res.status(401).send('Unauthorized');
    return;
  }
  const event = req.body?.event as string | undefined;
  const payment = req.body?.payment as { id?: string; externalReference?: string } | undefined;
  const bookingId = payment?.externalReference;
  if (!event || !payment?.id || !bookingId) {
    res.status(200).send('ignorado');
    return;
  }

  try {
    await handlePaymentEvent(event, payment.id, bookingId);
    res.status(200).send('ok');
  } catch (e) {
    logger.error('Falha ao processar webhook', { event, bookingId, error: String(e) });
    res.status(500).send('erro');
  }
});

export async function handlePaymentEvent(event: string, asaasPaymentId: string, bookingId: string) {
  const paymentRef = db.doc(`payments/${bookingId}`);
  const bookingRef = db.doc(`bookings/${bookingId}`);

  let refundNow = false;
  await db.runTransaction(async (tx) => {
    const [pSnap, bSnap] = await Promise.all([tx.get(paymentRef), tx.get(bookingRef)]);
    const p = pSnap.data();
    const b = bSnap.data();
    // evento de outra cobrança (ex.: uma antiga do mesmo pedido)
    if (!p || !b || p.asaasPaymentId !== asaasPaymentId) return;

    if (PAID.has(event)) {
      if (p.status === 'pago' || p.status === 'estornado') return;
      tx.update(paymentRef, { status: 'pago', paidAt: Date.now() });
      tx.update(bookingRef, { paymentStatus: 'pago' });
      // pagou depois de o pedido ser cancelado ou recusado: devolve
      refundNow = b.status === 'cancelado' || b.status === 'recusado';
    } else if (REFUNDED.has(event)) {
      tx.update(paymentRef, { status: 'estornado' });
      tx.update(bookingRef, { paymentStatus: 'estornado' });
    } else if (GONE.has(event)) {
      if (p.status !== 'aguardando') return;
      tx.update(paymentRef, { status: 'cancelado' });
      tx.update(bookingRef, { paymentStatus: 'cancelado', ...(b.status === 'pendente' ? { status: 'cancelado' } : {}) });
      if (b.status === 'pendente') tx.delete(db.doc(`busySlots/${b.providerId}_${b.date}_${b.time}`));
    }
  });
  if (refundNow) await refundBooking(bookingId);
}

/** Devolve o pagamento de um pedido recusado ou cancelado; se ainda não foi pago, cancela a cobrança. */
export async function refundBooking(bookingId: string) {
  const paymentRef = db.doc(`payments/${bookingId}`);
  const p = (await paymentRef.get()).data();
  if (!p?.asaasPaymentId) return;
  if (p.status === 'pago') {
    await asaas.refundPayment(p.asaasPaymentId);
    // o webhook PAYMENT_REFUNDED confirma; marcamos já para o app mostrar
    await paymentRef.update({ status: 'estornado', refundedAt: Date.now() });
    await db.doc(`bookings/${bookingId}`).update({ paymentStatus: 'estornado' });
  } else if (p.status === 'aguardando') {
    try {
      await asaas.deletePayment(p.asaasPaymentId);
    } catch (e) {
      logger.warn('Não foi possível remover a cobrança no Asaas', { bookingId, error: String(e) });
    }
    await paymentRef.update({ status: 'cancelado' });
    await db.doc(`bookings/${bookingId}`).update({ paymentStatus: 'cancelado' });
  }
}
