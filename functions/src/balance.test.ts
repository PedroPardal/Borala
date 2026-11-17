import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCompletion, DEBT_LIMIT } from './balance.js';

test('serviço em dinheiro soma a comissão ao débito', () => {
  const r = applyCompletion(0, { payment: 'dinheiro', servicePrice: 30, platformFee: 5 });
  assert.equal(r.debt, 5);
  assert.equal(r.debtDelta, 5);
  assert.equal(r.payout, undefined);
  assert.equal(r.blocked, false);
});

test('serviço por Pix desconta o débito do repasse', () => {
  const r = applyCompletion(13, { payment: 'pix', servicePrice: 100, platformFee: 8 });
  assert.deepEqual(r.payout, { amount: 87, debtDeducted: 13 });
  assert.equal(r.debt, 0);
  assert.equal(r.debtDelta, -13);
});

test('débito maior que o serviço: desconta tudo e o resto fica para o próximo', () => {
  const r = applyCompletion(45, { payment: 'cartao', servicePrice: 30, platformFee: 5 });
  assert.deepEqual(r.payout, { amount: 0, debtDeducted: 30 });
  assert.equal(r.debt, 15);
});

test('sem débito, o repasse é o valor inteiro do serviço', () => {
  const r = applyCompletion(0, { payment: 'pix', servicePrice: 62.5, platformFee: 5 });
  assert.deepEqual(r.payout, { amount: 62.5, debtDeducted: 0 });
  assert.equal(r.debtDelta, 0);
});

test('passar do limite bloqueia; quitar desbloqueia', () => {
  const blocked = applyCompletion(DEBT_LIMIT - 2, { payment: 'dinheiro', servicePrice: 100, platformFee: 8 });
  assert.equal(blocked.blocked, true);
  const unblocked = applyCompletion(blocked.debt, { payment: 'pix', servicePrice: 100, platformFee: 8 });
  assert.equal(unblocked.blocked, false);
  assert.equal(unblocked.debt, 0);
});

test('centavos não acumulam erro de ponto flutuante', () => {
  let debt = 0;
  for (let i = 0; i < 10; i++) debt = applyCompletion(debt, { payment: 'dinheiro', servicePrice: 70, platformFee: 5.6 }).debt;
  assert.equal(debt, 56);
});
