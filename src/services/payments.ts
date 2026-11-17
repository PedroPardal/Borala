import { httpsCallable } from 'firebase/functions';
import { PaymentView, PayoutAccountForm } from '../types';
import { fb } from './firebase';

/** Cria (ou recupera) a cobrança Pix ou cartão de um pedido. Veja functions/src/payments.ts. */
export async function createPayment(bookingId: string) {
  const fn = httpsCallable<{ bookingId: string }, PaymentView>(fb.functions, 'createPayment');
  return (await fn({ bookingId })).data;
}

/** Abre a conta de recebimento (subconta Asaas) do prestador. Veja functions/src/accounts.ts. */
export async function createPayoutAccount(form: PayoutAccountForm) {
  const fn = httpsCallable<PayoutAccountForm, { ok: boolean }>(fb.functions, 'createProviderAccount');
  return (await fn(form)).data;
}
