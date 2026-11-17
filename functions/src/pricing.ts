/**
 * Cópia do cálculo de src/utils/pricing.ts do app. O servidor recalcula o valor cobrado para não
 * confiar no que o app envia. Mantenha os dois arquivos iguais.
 */
export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro';

export const PLATFORM_FEE_RATE = 0.08;
export const MIN_PLATFORM_FEE = 5;
const CARD_RATE = 0.0299;
const CARD_FIXED = 0.49;

export const cents = (v: number) => Math.round(v * 100) / 100;
const ceilCents = (v: number) => Math.ceil(v * 100 - 1e-6) / 100;

export function platformFee(servicePrice: number) {
  return cents(Math.max(servicePrice * PLATFORM_FEE_RATE, MIN_PLATFORM_FEE));
}

export function priceFor(servicePrice: number, method: PaymentMethod) {
  const fee = platformFee(servicePrice);
  const subtotal = cents(servicePrice + fee);
  const surcharge = method === 'cartao' ? ceilCents((subtotal * CARD_RATE + CARD_FIXED) / (1 - CARD_RATE)) : 0;
  return { service: servicePrice, fee, surcharge, total: cents(subtotal + surcharge) };
}
