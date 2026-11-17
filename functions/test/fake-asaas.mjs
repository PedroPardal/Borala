// Asaas falso para os testes: guarda as chamadas e responde como a API v3.
import http from 'node:http';
export const calls = [];
let n = 0;
export const fail = { transfer: false };
export function startFakeAsaas(port = 7777) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = body ? JSON.parse(body) : undefined;
      calls.push({ method: req.method, url: req.url, body: json, key: req.headers['access_token'] });
      const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
      const u = req.url.replace(/^\/v3/, '');
      if (req.method === 'POST' && u === '/customers') return send(200, { id: `cus_${++n}` });
      if (req.method === 'POST' && u === '/payments') return send(200, { id: `pay_${++n}`, status: 'PENDING', value: json.value, billingType: json.billingType, invoiceUrl: `https://sandbox.asaas.com/i/${n}`, externalReference: json.externalReference });
      if (req.method === 'GET' && /\/payments\/[^/]+\/pixQrCode/.test(u)) return send(200, { encodedImage: 'iVBORw0KGgo=', payload: '00020126PIXCOPIAECOLA', expirationDate: '2026-11-18 23:59:59' });
      if (req.method === 'POST' && /\/payments\/[^/]+\/refund/.test(u)) return send(200, { id: u.split('/')[2], status: 'REFUNDED' });
      if (req.method === 'DELETE' && /\/payments\//.test(u)) return send(200, { deleted: true });
      if (req.method === 'POST' && u === '/accounts') {
        if (!json.cpfCnpj || !json.incomeValue) return send(400, { errors: [{ description: 'Dados incompletos' }] });
        return send(200, { id: `acc_${++n}`, walletId: `wallet_${n}` });
      }
      if (req.method === 'POST' && u === '/transfers') {
        if (fail.transfer) return send(400, { errors: [{ description: 'Saldo insuficiente' }] });
        return send(200, { id: `tra_${++n}`, status: 'PENDING' });
      }
      send(404, { errors: [{ description: 'rota desconhecida ' + u }] });
    });
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}
