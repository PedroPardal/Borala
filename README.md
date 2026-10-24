# ⚡ BoraLá — Marketplace de serviços freelance (Expo + TypeScript)

**Agora vai! Trabalhe e encontre no seu tempo.**

App que conecta quem precisa de um serviço a freelancers da região: motoboy e entregas, fretes, limpeza, reparos, jardinagem, beleza, pets, tecnologia e aulas particulares. Usa o **Firebase** (Authentication, Firestore e Storage) para contas, pedidos, avaliações, chat em tempo real e fotos.

### 🎨 Identidade visual

| Cor | Hex | Uso |
|---|---|---|
| Laranja Enérgico | `#FF5722` | cor principal, botões e destaques |
| Amarelo Elétrico | `#E7FC00` | slogan, alertas e botão secundário (sempre com texto azul-noturno) |
| Azul Noturno | `#0F172A` | textos e fundo da marca |
| Azul Conecta | `#2563EB` | ações do cliente, links e foco |
| Off-white | `#F8FAFC` | fundo das telas |

Ícone e logo ficam em `assets/` (`icon.png`, `adaptive-icon.png`, `splash-icon.png`, `logo.png`).

## 🚀 Como rodar no Expo Go

**Pré-requisitos:** Node.js 20 ou mais recente e o app **Expo Go** no celular (Play Store / App Store).

```bash
# 1. Entre na pasta do projeto
cd jardimja

# 2. Instale as dependências
npm install

# 3. Configure o Firebase (veja a seção abaixo) e crie o arquivo .env

# 4. Inicie o servidor
npx expo start
```

5. Escaneie o QR Code: no **Android** pelo próprio Expo Go, no **iPhone** pela câmera.
6. Se o celular e o PC estiverem em redes diferentes, use `npx expo start --tunnel`.

> O projeto usa o Expo SDK 58. Se o seu Expo Go pedir uma versão mais nova, rode `npx expo install expo@latest` e depois `npx expo install --fix`.

## 🔥 Firebase

O app usa o SDK JavaScript do Firebase, que funciona no Expo Go (não precisa gerar app nativo).

### 1. No Console do Firebase (console.firebase.google.com)
1. **Authentication → Método de login →** ative **E-mail/senha**.
2. **Firestore Database → Criar banco de dados →** escolha `southamerica-east1` (São Paulo) e comece no **modo de produção**.
3. **Storage → Começar** (exige o plano **Blaze**; tem cota gratuita e você só paga se passar dela).
4. **Configurações do projeto → Seus apps → Web (`</>`) →** registre um app e copie o `firebaseConfig`.

### 2. No projeto
1. Copie `.env.example` para `.env` e preencha com os valores do `firebaseConfig`.
2. Publique as regras de segurança. Sem elas o app não consegue ler nem gravar nada.
   - Pelo console: cole `firestore.rules` em **Firestore → Regras** e `storage.rules` em **Storage → Regras**.
   - Ou pelo terminal: `npx firebase-tools login` e depois `npx firebase-tools deploy --only firestore,storage --project SEU_PROJECT_ID`.
3. Reinicie com `npx expo start --clear` (o `.env` só é lido quando o servidor inicia).

### Como os dados ficam organizados

| Coleção | O que guarda | Quem lê |
|---|---|---|
| `users/{uid}` | papel (cliente/prestador), nome, telefone, endereços | só o dono |
| `providers/{uid}` | perfil público: bio, especialidades, preços, agenda, portfólio, nota, localização | qualquer usuário logado |
| `bookings/{id}` | pedidos | o cliente e o prestador do pedido |
| `busySlots/{prestador_data_hora}` | horários ocupados (o id único impede duas reservas no mesmo horário) | qualquer usuário logado |
| `reviews/{bookingId}` | uma avaliação por pedido concluído | qualquer usuário logado |
| `conversations/{cliente_prestador}/messages` | chat em tempo real | só os dois participantes |
| Storage `users/{uid}/` | foto de perfil e fotos de antes/depois | qualquer usuário logado |

Um prestador só aparece nas buscas quando está **online**, tem **pelo menos uma especialidade e um serviço** e, se as duas localizações forem conhecidas, quando o cliente está dentro do **raio de atendimento**. O Painel do prestador mostra o que falta.

### Testando
Crie duas contas pelo app (uma como **Quero trabalhar**, outra como **Quero contratar**). Dá para usar dois celulares, ou sair de uma conta e entrar na outra. No prestador, complete o perfil (especialidade, um serviço e a localização). No cliente, ele vai aparecer em **Explorar**: agende, converse pelo chat, aceite e conclua pelo prestador e avalie pelo cliente.

> O pagamento ainda é combinado direto com o prestador. A taxa exibida no checkout é só informativa.

## 📂 Estrutura

```
jardimja/
├── App.tsx                    # Providers + inicialização dos sons
├── index.ts
├── app.json / package.json / tsconfig.json
├── assets/sounds/             # Efeitos sonoros (.wav sintetizados, livres de direitos)
│   ├── tap · select · success · error · celebrate · whoosh · message
└── src/
    ├── components/            # UI reutilizável
    │   ├── DuoButton.tsx        # Botão 3D que "afunda" (estilo Duolingo)
    │   ├── PressableScale.tsx   # Qualquer tocável com mola + som
    │   ├── FadeInView.tsx       # Entrada em cascata (fade + slide)
    │   ├── Confetti.tsx         # Chuva de confetes
    │   ├── RatingStars.tsx      # Estrelas (exibição e interativas)
    │   ├── Logo.tsx             # Ícone do app + logotipo "bora lá."
    │   ├── ProviderCard · RequestCard · StatCard · BarChart
    │   └── Chip · Card · Avatar · SearchBar · TextField · SettingsRow · EmptyState
    ├── context/
    │   ├── AppContext.tsx       # Login + dados em tempo real do Firestore (perfil, prestadores, pedidos, chat)
    │   └── hooks.ts             # Mensagens, avaliações e horários ocupados sob demanda
    ├── data/categories.ts      # Categorias de serviço e agenda padrão do prestador
    ├── navigation/
    │   ├── RootNavigator.tsx    # Stack + animações de transição + som "whoosh"
    │   ├── ClientTabs.tsx / ProviderTabs.tsx
    │   ├── TabIcon.tsx          # Ícone que "pula" ao ser selecionado
    │   └── types.ts             # Tipagem das rotas
    ├── screens/
    │   ├── auth/LoginScreen.tsx
    │   ├── client/   Home · ProviderDetails · Schedule · Checkout · BookingSuccess · Orders · Review · ClientProfile
    │   ├── provider/ Dashboard · Requests · ProviderSettings
    │   └── shared/   Conversations · Chat
    ├── services/feedback.ts    # Sons (expo-audio) + vibração (expo-haptics)
    ├── services/firebase.ts    # Inicialização do Firebase a partir do .env
    ├── services/uploads.ts · pickImage.ts · geo.ts  # Fotos no Storage, seletor de imagem, distância
    ├── theme/index.ts          # Cores, espaçamentos, raios
    ├── types/index.ts          # Modelos de domínio
    └── utils/format.ts         # Moeda (R$), datas
```

## ✨ Feedback "estilo Duolingo"

| Momento | Som | Animação |
|---|---|---|
| Qualquer toque | `tap` + vibração leve | botão afunda e volta com mola |
| Selecionar chip, aba ou estrela | `select` | ícone/estrela "pula" |
| Avançar ou voltar de tela | `whoosh` | slide nativo / sheet de baixo / fade |
| Login, aceitar pedido | `success` | card desliza para fora |
| Pedido confirmado, avaliação enviada, serviço concluído | `celebrate` | confetes + selo girando |
| Erro de validação | `error` | campo "treme" |
| Mensagem enviada ou recebida | `message` | bolha entra com "pop" e indicador de "digitando…" |

Os sons podem ser desligados em **Perfil → Efeitos sonoros**. Para trocar por outros, basta substituir os `.wav` em `assets/sounds/` mantendo os mesmos nomes.

## 🔜 Próximos passos sugeridos
- Notificações push (expo-notifications + Cloud Functions) para novos pedidos e mensagens
- Gateway de pagamento (Pix via Mercado Pago, Stripe etc.)
- Mapa (`react-native-maps`) para ver os prestadores e o raio de atendimento
- Login com Google/Apple (exige um development build, não roda no Expo Go)
