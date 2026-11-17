#!/usr/bin/env bash
# Teste de ponta a ponta: regras + Cloud Functions no emulador do Firebase, com um Asaas falso.
# Uso (na pasta functions): npm run test:e2e   (precisa de Java para o emulador do Firestore)
set -euo pipefail
cd "$(dirname "$0")/.."
printf 'ASAAS_API_KEY=chave-teste\nASAAS_WEBHOOK_TOKEN=tok-teste\n' > .secret.local
printf 'ASAAS_BASE_URL=http://127.0.0.1:7777/v3\n' > .env.local
trap 'rm -f .secret.local .env.local' EXIT
npm run build
cd ..
npx firebase-tools emulators:exec --only auth,firestore,functions --project demo-borala "node functions/test/e2e.mjs"
