import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { asaas, ASAAS_API_KEY, AsaasError } from './asaas.js';
import { db, onlyDigits, REGION } from './admin.js';

const COMPANY_TYPES = ['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'];

/**
 * Cria a subconta Asaas do prestador, onde ele recebe os repasses dos serviços pagos por Pix ou cartão.
 * O walletId fica em providerAccounts/{uid} (só o servidor lê) e o perfil público ganha
 * acceptsOnlinePayment = true.
 */
export const createProviderAccount = onCall({ region: REGION, secrets: [ASAAS_API_KEY] }, async (req) => {
  const uid = req.auth?.uid;
  const email = req.auth?.token.email;
  if (!uid || !email) throw new HttpsError('unauthenticated', 'Entre na sua conta.');

  const accountRef = db.doc(`providerAccounts/${uid}`);
  if ((await accountRef.get()).exists) return { ok: true };

  const [user, provider] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`providers/${uid}`).get()]);
  if (!provider.exists) throw new HttpsError('failed-precondition', 'Ative o modo prestador primeiro.');

  const d = (req.data ?? {}) as Record<string, unknown>;
  const cpfCnpj = onlyDigits(d.cpfCnpj);
  const mobilePhone = onlyDigits(d.mobilePhone);
  const postalCode = onlyDigits(d.postalCode);
  const incomeValue = Number(d.incomeValue);
  const str = (k: string, min = 1) => {
    const v = typeof d[k] === 'string' ? (d[k] as string).trim() : '';
    if (v.length < min) throw new HttpsError('invalid-argument', `Preencha o campo ${k}.`);
    return v;
  };

  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) throw new HttpsError('invalid-argument', 'CPF ou CNPJ inválido.');
  if (mobilePhone.length < 10 || mobilePhone.length > 11) throw new HttpsError('invalid-argument', 'Celular inválido.');
  if (postalCode.length !== 8) throw new HttpsError('invalid-argument', 'CEP inválido.');
  if (!(incomeValue > 0)) throw new HttpsError('invalid-argument', 'Informe sua renda mensal aproximada.');

  const isCompany = cpfCnpj.length === 14;
  const birthDate = isCompany ? undefined : str('birthDate', 10);
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new HttpsError('invalid-argument', 'Data de nascimento inválida.');
  const companyType = isCompany ? str('companyType') : undefined;
  if (companyType && !COMPANY_TYPES.includes(companyType)) throw new HttpsError('invalid-argument', 'Tipo de empresa inválido.');

  try {
    const account = await asaas.createAccount({
      name: (user.get('name') as string) || provider.get('name'),
      email,
      cpfCnpj,
      birthDate,
      companyType,
      mobilePhone,
      incomeValue,
      address: str('address', 3),
      addressNumber: str('addressNumber'),
      complement: typeof d.complement === 'string' && d.complement.trim() ? d.complement.trim() : undefined,
      province: str('province', 2),
      postalCode,
    });
    await accountRef.set({ asaasAccountId: account.id, walletId: account.walletId, createdAt: Date.now() });
    await provider.ref.update({ acceptsOnlinePayment: true });
    return { ok: true };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    if (e instanceof AsaasError) {
      logger.error('Erro do Asaas ao criar subconta', { status: e.status, body: e.body });
      throw new HttpsError('failed-precondition', e.message);
    }
    logger.error(e);
    throw new HttpsError('internal', 'Não foi possível criar sua conta de recebimento.');
  }
});
