/**
 * Regras do saldo do prestador, sem Firebase, para dar para testar.
 *
 * - Serviço pago em DINHEIRO: o prestador recebe tudo do cliente em mãos, então a comissão da
 *   plataforma vira um débito no saldo dele.
 * - Serviço pago por PIX ou CARTÃO: o dinheiro entra na conta da plataforma. No repasse, o débito
 *   acumulado é descontado do valor do serviço (até o valor inteiro do serviço; o que sobrar fica
 *   para o próximo).
 * - Débito acima de DEBT_LIMIT bloqueia pedidos em dinheiro para o prestador até ele baixar.
 */

export const DEBT_LIMIT = 50;

export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro';

export interface CompletedBooking {
  payment: PaymentMethod;
  servicePrice: number;
  platformFee: number;
}

export interface CompletionResult {
  /** novo débito do prestador */
  debt: number;
  /** variação do débito (positivo aumenta, negativo diminui); 0 quando não muda */
  debtDelta: number;
  /** só para pedidos pagos no app */
  payout?: { amount: number; debtDeducted: number };
  blocked: boolean;
}

const cents = (v: number) => Math.round(v * 100) / 100;

export function applyCompletion(currentDebt: number, b: CompletedBooking): CompletionResult {
  const debt = cents(Math.max(0, currentDebt));
  if (b.payment === 'dinheiro') {
    const next = cents(debt + b.platformFee);
    return { debt: next, debtDelta: cents(b.platformFee), blocked: next > DEBT_LIMIT };
  }
  const deducted = cents(Math.min(debt, b.servicePrice));
  const next = cents(debt - deducted);
  return {
    debt: next,
    debtDelta: deducted === 0 ? 0 : -deducted,
    payout: { amount: cents(b.servicePrice - deducted), debtDeducted: deducted },
    blocked: next > DEBT_LIMIT,
  };
}
