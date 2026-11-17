/**
 * Cliente mínimo da API v3 do Asaas. Todas as chamadas ao Asaas passam por aqui.
 *
 * Configuração (Cloud Functions):
 * - segredo ASAAS_API_KEY: chave da conta principal da plataforma (firebase functions:secrets:set ASAAS_API_KEY)
 * - parâmetro ASAAS_ENV: "sandbox" (padrão) ou "production"
 * - ASAAS_BASE_URL (opcional): sobrepõe a URL, usado nos testes com um Asaas falso
 *
 * Os nomes de campos seguem a documentação pública do Asaas (docs.asaas.com). Confira lá se algum
 * endpoint mudar.
 */
import { defineSecret, defineString } from 'firebase-functions/params';

export const ASAAS_API_KEY = defineSecret('ASAAS_API_KEY');
export const ASAAS_WEBHOOK_TOKEN = defineSecret('ASAAS_WEBHOOK_TOKEN');
export const ASAAS_ENV = defineString('ASAAS_ENV', { default: 'sandbox' });

function baseUrl() {
  if (process.env.ASAAS_BASE_URL) return process.env.ASAAS_BASE_URL;
  return ASAAS_ENV.value() === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
}

export class AsaasError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    const errors = (body as { errors?: { description?: string }[] })?.errors;
    super(errors?.map((e) => e.description).join('; ') || `Asaas respondeu ${status}`);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      access_token: ASAAS_API_KEY.value(),
      'Content-Type': 'application/json',
      'User-Agent': 'BoraLa',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new AsaasError(res.status, data);
  return data as T;
}

export type BillingType = 'PIX' | 'CREDIT_CARD';

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  invoiceUrl: string;
  billingType: string;
  externalReference?: string;
}

export const asaas = {
  createCustomer: (c: { name: string; cpfCnpj: string; email?: string; externalReference: string }) =>
    call<{ id: string }>('POST', '/customers', c),

  createPayment: (p: {
    customer: string;
    billingType: BillingType;
    value: number;
    dueDate: string;
    description: string;
    externalReference: string;
  }) => call<AsaasPayment>('POST', '/payments', p),

  pixQrCode: (paymentId: string) =>
    call<{ encodedImage: string; payload: string; expirationDate: string }>('GET', `/payments/${paymentId}/pixQrCode`),

  refundPayment: (paymentId: string) => call<AsaasPayment>('POST', `/payments/${paymentId}/refund`, {}),

  deletePayment: (paymentId: string) => call<{ deleted: boolean }>('DELETE', `/payments/${paymentId}`),

  /** Subconta do prestador. Ele recebe um e-mail do Asaas para acessar a conta e sacar. */
  createAccount: (a: {
    name: string;
    email: string;
    cpfCnpj: string;
    birthDate?: string;
    companyType?: string;
    mobilePhone: string;
    incomeValue: number;
    address: string;
    addressNumber: string;
    complement?: string;
    province: string;
    postalCode: string;
  }) => call<{ id: string; walletId: string }>('POST', '/accounts', a),

  /** Transferência entre contas Asaas pelo walletId do destino. */
  transferToWallet: (walletId: string, value: number, description: string) =>
    call<{ id: string; status: string }>('POST', '/transfers', { walletId, value, description }),
};
