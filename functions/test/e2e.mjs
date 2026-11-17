import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { startFakeAsaas, calls, fail } from './fake-asaas.mjs';

const server = await startFakeAsaas();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = await initializeTestEnvironment({ projectId: 'demo-borala', firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } });
const admin = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));

function appFor(name) {
  const app = initializeApp({ projectId: 'demo-borala', apiKey: 'fake' }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const fns = getFunctions(app, 'southamerica-east1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  return { auth, db, fns };
}
const cli = appFor('cli'), prov = appFor('prov');
const cliUid = (await createUserWithEmailAndPassword(cli.auth, 'cli@test.com', 'senha123')).user.uid;
const provUid = (await createUserWithEmailAndPassword(prov.auth, 'prov@test.com', 'senha123')).user.uid;

let ok = 0, bad = 0;
const check = (name, cond, extra = '') => { cond ? ok++ : bad++; console.log(cond ? '✔' : '✘', name, cond ? '' : extra); };
const attempt = async (name, p, shouldPass) => { try { await p; check(name, shouldPass, '(passou)'); } catch (e) { check(name, !shouldPass, e.message); } };
const webhook = (event, paymentId, bookingId, token = 'tok-teste') =>
  fetch('http://127.0.0.1:5001/demo-borala/southamerica-east1/asaasWebhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'asaas-access-token': token },
    body: JSON.stringify({ event, payment: { id: paymentId, externalReference: bookingId } }),
  });

const service = { id: 's1', title: 'Faxina', price: 100, unit: 'por serviço' };
await admin(async (db) => {
  await setDoc(doc(db, `users/${cliUid}`), { role: 'client', name: 'Cliente', email: 'cli@test.com', cpf: '12345678909' });
  await setDoc(doc(db, `users/${provUid}`), { role: 'provider', name: 'Prestador', email: 'prov@test.com' });
  await setDoc(doc(db, `providers/${provUid}`), { name: 'Prestador', rating: 0, reviewsCount: 0, completedJobs: 0, priceTable: [service] });
});
const booking = (payment, extra = {}) => {
  const fee = 8, total = payment === 'cartao' ? 111.84 : 108;
  return { providerId: provUid, providerName: 'Prestador', clientId: cliUid, serviceId: 's1', serviceTitle: 'Faxina', date: '2026-12-01', time: '09:00',
    status: 'pendente', reviewed: false, address: 'Rua 1', payment, servicePrice: 100, platformFee: fee, price: total, createdAt: Date.now(), ...extra };
};

// 1. sem conta de recebimento, Pix é recusado
await attempt('Pix recusado sem conta de recebimento', setDoc(doc(cli.db, 'bookings/x0'), booking('pix')), false);

// 2. prestador abre a conta
const createAccount = httpsCallable(prov.fns, 'createProviderAccount');
await attempt('dados inválidos na conta são recusados', createAccount({ cpfCnpj: '123' }), false);
await createAccount({ cpfCnpj: '529.982.247-25', birthDate: '1990-12-31', mobilePhone: '(11) 98888-7777', incomeValue: 3000, postalCode: '01001-000', address: 'Praça da Sé', addressNumber: '1', province: 'Sé' });
const pDoc = (await getDoc(doc(prov.db, `providers/${provUid}`))).data();
check('prestador passa a aceitar Pix/cartão', pDoc.acceptsOnlinePayment === true);
check('Asaas recebeu a subconta com CPF limpo', calls.some((c) => c.url === '/v3/accounts' && c.body.cpfCnpj === '52998224725' && c.key === 'chave-teste'));
await attempt('prestador não lê a própria subconta (walletId é interno)', getDoc(doc(prov.db, `providerAccounts/${provUid}`)), false);
await attempt('prestador não se marca como aceitando pagamento', updateDoc(doc(prov.db, `providers/${provUid}`), { acceptsOnlinePayment: false }), false);

// 3. pedido Pix e cobrança
await setDoc(doc(cli.db, 'bookings/b1'), booking('pix'));
await attempt('cliente não grava paymentStatus', updateDoc(doc(cli.db, 'bookings/b1'), { paymentStatus: 'pago' }), false);
await attempt('prestador não aceita antes de pagar', updateDoc(doc(prov.db, 'bookings/b1'), { status: 'aceito' }), false);
const createPayment = httpsCallable(cli.fns, 'createPayment');
const pv = (await createPayment({ bookingId: 'b1' })).data;
check('cobrança Pix com QR Code', pv.billingType === 'PIX' && pv.pixPayload === '00020126PIXCOPIAECOLA' && pv.value === 108, JSON.stringify(pv));
const pv2 = (await createPayment({ bookingId: 'b1' })).data;
check('chamar de novo devolve a mesma cobrança', calls.filter((c) => c.url === '/v3/payments').length === 1 && pv2.pixPayload === pv.pixPayload);
const payDoc = (await getDoc(doc(cli.db, 'payments/b1'))).data();
await attempt('outro usuário não lê a cobrança', getDoc(doc(prov.db, 'payments/b1')), false);
await attempt('provedor de outra pessoa não paga o pedido', httpsCallable(prov.fns, 'createPayment')({ bookingId: 'b1' }), false);

// 4. webhook
check('webhook com token errado é recusado', (await webhook('PAYMENT_RECEIVED', payDoc.asaasPaymentId, 'b1', 'errado')).status === 401);
check('webhook responde 200', (await webhook('PAYMENT_RECEIVED', payDoc.asaasPaymentId, 'b1')).status === 200);
check('pedido marcado como pago', (await getDoc(doc(cli.db, 'bookings/b1'))).data().paymentStatus === 'pago');

// 5. aceitar e concluir pelo cliente → repasse
await attempt('prestador aceita depois do pagamento', updateDoc(doc(prov.db, 'bookings/b1'), { status: 'aceito' }), true);
await attempt('cliente confirma que o serviço foi feito', updateDoc(doc(cli.db, 'bookings/b1'), { status: 'concluido' }), true);
await sleep(4000);
let b1 = (await getDoc(doc(prov.db, 'bookings/b1'))).data();
check('repasse de R$ 100 transferido para a subconta', b1.payout?.status === 'pago' && b1.payout.amount === 100 && calls.some((c) => c.url === '/v3/transfers' && c.body.walletId?.startsWith('wallet_') && c.body.value === 100), JSON.stringify(b1.payout));
check('serviços concluídos sobem 1 (pelo servidor)', (await getDoc(doc(prov.db, `providers/${provUid}`))).data().completedJobs === 1);

// 6. dinheiro gera débito, próximo Pix desconta; transferência falha e fica para tentar de novo
await setDoc(doc(cli.db, 'bookings/c1'), booking('dinheiro', { time: '10:00' }));
await updateDoc(doc(prov.db, 'bookings/c1'), { status: 'aceito' });
await updateDoc(doc(prov.db, 'bookings/c1'), { status: 'concluido' });
await sleep(3000);
check('débito de R$ 8 do serviço em dinheiro', (await getDoc(doc(prov.db, `providerBalances/${provUid}`))).data().cashDebt === 8);
fail.transfer = true;
await setDoc(doc(cli.db, 'bookings/b2'), booking('pix', { time: '11:00' }));
await createPayment({ bookingId: 'b2' });
await webhook('PAYMENT_RECEIVED', (await getDoc(doc(cli.db, 'payments/b2'))).data().asaasPaymentId, 'b2');
await updateDoc(doc(prov.db, 'bookings/b2'), { status: 'aceito' });
await updateDoc(doc(prov.db, 'bookings/b2'), { status: 'concluido' });
await sleep(4000);
const b2 = (await getDoc(doc(prov.db, 'bookings/b2'))).data();
check('repasse com débito descontado (92) fica como erro para nova tentativa', b2.payout?.amount === 92 && b2.payout.debtDeducted === 8 && b2.payout.status === 'erro', JSON.stringify(b2.payout));

// 7. recusa com pagamento → estorno; cancelamento sem pagamento → cobrança removida
await setDoc(doc(cli.db, 'bookings/b3'), booking('cartao', { time: '12:00' }));
const pv3 = (await createPayment({ bookingId: 'b3' })).data;
check('cobrança no cartão com link de pagamento', pv3.billingType === 'CREDIT_CARD' && pv3.invoiceUrl?.startsWith('https://') && pv3.value === 111.84, JSON.stringify(pv3));
await webhook('PAYMENT_CONFIRMED', (await getDoc(doc(cli.db, 'payments/b3'))).data().asaasPaymentId, 'b3');
const b3batch = writeBatch(prov.db);
b3batch.update(doc(prov.db, 'bookings/b3'), { status: 'recusado' });
await b3batch.commit();
await sleep(3000);
check('recusa de pedido pago gera estorno', calls.some((c) => /\/payments\/pay_\d+\/refund/.test(c.url)) && (await getDoc(doc(cli.db, 'bookings/b3'))).data().paymentStatus === 'estornado');

await setDoc(doc(cli.db, 'bookings/b4'), booking('pix', { time: '13:00' }));
await createPayment({ bookingId: 'b4' });
await attempt('cliente cancela pedido pendente', updateDoc(doc(cli.db, 'bookings/b4'), { status: 'cancelado' }), true);
await sleep(3000);
check('cobrança não paga é removida no Asaas', calls.some((c) => c.method === 'DELETE') && (await getDoc(doc(cli.db, 'bookings/b4'))).data().paymentStatus === 'cancelado');

// 8. problema reportado trava a conclusão
await setDoc(doc(cli.db, 'bookings/c2'), booking('dinheiro', { time: '14:00' }));
await updateDoc(doc(prov.db, 'bookings/c2'), { status: 'aceito' });
await attempt('cliente reporta problema', updateDoc(doc(cli.db, 'bookings/c2'), { disputed: true }), true);
await attempt('prestador não conclui pedido com problema', updateDoc(doc(prov.db, 'bookings/c2'), { status: 'concluido' }), false);
await attempt('cliente não desfaz a reclamação', updateDoc(doc(cli.db, 'bookings/c2'), { disputed: false }), false);

// 9. preço adulterado
await setDoc(doc(cli.db, 'bookings/b5'), booking('pix', { time: '15:00', servicePrice: 70, platformFee: 5.6, price: 75.6 }));
await attempt('cobrança recusada se o preço não bate com a tabela do prestador', createPayment({ bookingId: 'b5' }), false);

console.log(`\n${ok} ok, ${bad} falhas`);
server.close(); await env.cleanup();
process.exit(bad ? 1 : 0);
