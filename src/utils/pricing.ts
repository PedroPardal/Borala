import { PaymentMethod } from '../types';

/** Comissão da plataforma: 8% do serviço, com mínimo de R$ 5. */
export const PLATFORM_FEE_RATE = 0.08;
export const MIN_PLATFORM_FEE = 5;

/**
 * Comissões de serviços pagos em dinheiro viram débito do prestador, descontado do próximo serviço
 * pago no app. Acima deste valor o prestador só recebe pedidos por Pix ou cartão. Mantenha igual a functions/src/balance.ts.
 */
export const DEBT_LIMIT = 50;

/**
 * Tarifa do Asaas no cartão à vista (2,99% + R$ 0,49). O acréscimo do cartão repassa essa tarifa ao
 * cliente, para que a comissão seja a mesma em qualquer forma de pagamento. O Pix fica sem acréscimo,
 * o que o torna a opção mais barata. Diferenciar o preço pela forma de pagamento é permitido pela
 * Lei 13.455/2017, desde que o cliente veja o valor antes de pagar.
 * Revise estes valores se a tabela do Asaas mudar.
 */
const CARD_RATE = 0.0299;
const CARD_FIXED = 0.49;

const cents = (v: number) => Math.round(v * 100) / 100;
const ceilCents = (v: number) => Math.ceil(v * 100 - 1e-6) / 100;

export function platformFee(servicePrice: number) {
  return cents(Math.max(servicePrice * PLATFORM_FEE_RATE, MIN_PLATFORM_FEE));
}

/** Acréscimo que cobre a tarifa do cartão sobre o valor total (serviço + comissão + acréscimo). */
export function cardSurcharge(subtotal: number) {
  return ceilCents((subtotal * CARD_RATE + CARD_FIXED) / (1 - CARD_RATE));
}

export interface PriceBreakdown {
  service: number;
  fee: number;
  /** true quando a comissão mínima de R$ 5 foi aplicada */
  minFeeApplied: boolean;
  surcharge: number;
  total: number;
}

/**
 * Calcula o valor cobrado do cliente. Quando a cobrança passar a ser criada numa Cloud Function,
 * o servidor deve usar este mesmo cálculo e não confiar no total enviado pelo app.
 */
export function priceFor(servicePrice: number, method: PaymentMethod): PriceBreakdown {
  const fee = platformFee(servicePrice);
  const subtotal = cents(servicePrice + fee);
  const surcharge = method === 'cartao' ? cardSurcharge(subtotal) : 0;
  return {
    service: servicePrice,
    fee,
    minFeeApplied: servicePrice * PLATFORM_FEE_RATE < MIN_PLATFORM_FEE,
    surcharge,
    total: cents(subtotal + surcharge),
  };
}
