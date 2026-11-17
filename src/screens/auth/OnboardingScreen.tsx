import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Melo, { MeloPose } from '../../components/Melo';
import SpeechBubble from '../../components/SpeechBubble';
import PawProgress from '../../components/PawProgress';
import FloatingDecor from '../../components/FloatingDecor';
import DuoButton from '../../components/DuoButton';
import TextField from '../../components/TextField';
import PressableScale from '../../components/PressableScale';
import FadeInView from '../../components/FadeInView';
import Chip from '../../components/Chip';
import Confetti from '../../components/Confetti';
import { Wordmark } from '../../components/Logo';
import { OnboardingData, useApp } from '../../context/AppContext';
import { RootScreenProps } from '../../navigation/types';
import { categories } from '../../data/categories';
import { CategoryId } from '../../types';
import { colors, radius, spacing } from '../../theme';
import { formatBRL } from '../../utils/format';
import {
  ageFrom,
  isFullName,
  isValidCPF,
  isValidPhone,
  lookupCEP,
  maskCEP,
  maskCPF,
  maskDate,
  maskPhone,
  onlyDigits,
  parseDateBR,
  parsePriceBR,
} from '../../utils/br';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';
import { markOnboardingSeen } from '../../services/onboarding';
import { pickImage } from '../../services/pickImage';

type Path = 'provider' | 'client';
type Step = 'welcome' | 'choice' | 'p-name' | 'p-docs' | 'p-skills' | 'p-bio' | 'p-service' | 'c-name' | 'c-address' | 'account' | 'done';

/** Passos de cada caminho depois da escolha (as patinhas do topo mostram o progresso). */
const FLOW: Record<Path, Step[]> = {
  provider: ['p-name', 'p-docs', 'p-skills', 'p-bio', 'p-service', 'account'],
  client: ['c-name', 'c-address', 'account'],
};

/** Poses que são só o rosto (redondas): aparecem um pouco menores ao lado do balão. */
const FACES: MeloPose[] = ['feliz', 'focado', 'curioso'];

const UNITS = ['por serviço', 'por hora', 'por diária', 'por m²', 'por entrega'];
const ADDRESS_LABELS = ['Casa', 'Trabalho', 'Outro'];

const TITLE_HINT: Record<CategoryId, string> = {
  entregas: 'Ex.: Entrega rápida no bairro',
  fretes: 'Ex.: Frete pequeno (até 10 km)',
  limpeza: 'Ex.: Faxina completa',
  reparos: 'Ex.: Instalação de chuveiro',
  jardinagem: 'Ex.: Corte de grama',
  beleza: 'Ex.: Corte e escova',
  pets: 'Ex.: Passeio de 1 hora',
  tecnologia: 'Ex.: Formatação de computador',
  aulas: 'Ex.: Aula de violão (1h)',
};

/** O que o Mélo diz quando tocam nele. */
const CHATTER = [
  'Au au! 🐾',
  'Tô aqui pra te ajudar!',
  'Esse boné é meu charme 🧢',
  'Bora lá, falta pouquinho!',
  'Hehe, faz cócegas!',
  'Psiu… capricha nas fotos! 📸',
];

interface Form {
  name: string;
  phone: string;
  cpf: string;
  birth: string;
  categories: CategoryId[];
  bio: string;
  avatarUri: string;
  serviceTitle: string;
  servicePrice: string;
  serviceUnit: string;
  servicePhotoUri: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  uf: string;
  addressLabel: string;
  email: string;
  password: string;
}

const EMPTY: Form = {
  name: '',
  phone: '',
  cpf: '',
  birth: '',
  categories: [],
  bio: '',
  avatarUri: '',
  serviceTitle: '',
  servicePrice: '',
  serviceUnit: UNITS[0],
  servicePhotoUri: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  uf: '',
  addressLabel: ADDRESS_LABELS[0],
  email: '',
  password: '',
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** Pose e fala do Mélo em cada passo. */
function meloFor(step: Step, path: Path | null, f: Form): { pose: MeloPose; text: string } {
  const nome = firstName(f.name);
  switch (step) {
    case 'welcome':
      return { pose: 'acenando', text: 'Oi! Eu sou o Mélo 🐾 Vou te ajudar a começar no BoraLá. Leva só uns minutinhos!' };
    case 'choice':
      return { pose: 'pensando', text: 'Me conta: você quer trabalhar ou contratar serviços?' };
    case 'p-name':
      return { pose: 'feliz', text: 'Boa! Vamos montar seu perfil de profissional. Qual é o seu nome completo?' };
    case 'p-docs':
      return {
        pose: 'focado',
        text: `Prazer, ${nome}! Agora uns dados importantes. Eles ficam guardados com segurança e servem para você receber pelos serviços.`,
      };
    case 'p-skills':
      return { pose: 'pensando', text: 'Em que você manda bem? Pode escolher mais de uma área.' };
    case 'p-bio':
      return { pose: 'feliz', text: 'Capricha na apresentação! Perfis com foto e uma bio legal recebem mais pedidos.' };
    case 'p-service':
      return { pose: 'trabalhando', text: 'Agora seu primeiro serviço! Dá um nome, o preço e uma foto do seu trabalho.' };
    case 'c-name':
      return { pose: 'andando', text: 'Bora encontrar quem resolve pra você! Como você se chama?' };
    case 'c-address':
      return { pose: 'feliz', text: `Prazer, ${nome}! Onde você vai precisar dos serviços? Assim eu te mostro quem está pertinho.` };
    case 'account':
      return { pose: 'atendendo', text: 'Último passo! Crie seu acesso com e-mail e senha para entrar de qualquer celular.' };
    case 'done':
      return path === 'provider'
        ? { pose: 'comemorando', text: `Uhuul, ${nome}! 🎉 Seu perfil já está no ar para clientes perto de você.` }
        : { pose: 'comemorando', text: `Uhuul, ${nome}! 🎉 Agora é só escolher um serviço e agendar.` };
  }
}

/** Confere os campos do passo; devolve o que o Mélo deve dizer se algo estiver errado. */
function validate(step: Step, f: Form): string | null {
  switch (step) {
    case 'p-name':
      return isFullName(f.name) ? null : 'Hmm, preciso do seu nome e sobrenome. 🙂';
    case 'c-name':
      if (!isFullName(f.name)) return 'Hmm, preciso do seu nome e sobrenome. 🙂';
      return isValidPhone(f.phone) ? null : 'Esse celular parece incompleto. Coloca com o DDD?';
    case 'p-docs': {
      if (!isValidCPF(f.cpf)) return 'Esse CPF não confere. Dá uma olhadinha nos números?';
      const iso = parseDateBR(f.birth);
      if (!iso || ageFrom(iso) > 110) return 'Essa data de nascimento não existe. Usa dia/mês/ano.';
      if (ageFrom(iso) < 18) return 'Para trabalhar no BoraLá é preciso ter 18 anos ou mais.';
      return isValidPhone(f.phone) ? null : 'Esse celular parece incompleto. Coloca com o DDD?';
    }
    case 'p-skills':
      return f.categories.length > 0 ? null : 'Escolhe pelo menos uma área para eu te mostrar aos clientes certos!';
    case 'p-bio': {
      const missing = 20 - f.bio.trim().length;
      return missing > 0 ? `Conta um pouquinho mais! Faltam ${missing} letras.` : null;
    }
    case 'p-service': {
      if (f.serviceTitle.trim().length < 3) return 'Dá um nome para o seu serviço.';
      const price = parsePriceBR(f.servicePrice);
      if (!(price >= 5)) return 'Qual o preço? O mínimo é R$ 5,00.';
      if (price > 50000) return 'Esse preço está alto demais. Confere o valor?';
      return f.servicePhotoUri ? null : 'Falta a foto! Uma imagem do seu trabalho ajuda muito a fechar pedidos. 📸';
    }
    case 'c-address':
      if (f.cep && onlyDigits(f.cep).length !== 8) return 'O CEP tem 8 números. Confere?';
      if (f.street.trim().length < 3) return 'Qual é a rua?';
      if (!f.number.trim()) return 'Faltou o número. Se não tiver, coloca "s/n".';
      return f.city.trim().length >= 2 ? null : 'Qual é a cidade?';
    case 'account':
      if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'Esse e-mail não parece certo. Confere?';
      return f.password.length >= 6 ? null : 'A senha precisa ter pelo menos 6 caracteres.';
    default:
      return null;
  }
}

function toData(path: Path, f: Form): OnboardingData {
  const base = { name: f.name.trim().replace(/\s+/g, ' '), email: f.email.trim(), password: f.password, phone: onlyDigits(f.phone) };
  if (path === 'client') {
    const street = `${f.street.trim()}, ${f.number.trim()}${f.complement.trim() ? ` (${f.complement.trim()})` : ''}${
      f.district.trim() ? ` - ${f.district.trim()}` : ''
    }`;
    return {
      ...base,
      role: 'client',
      address: { id: `a${Date.now()}`, label: f.addressLabel, street, city: f.uf ? `${f.city.trim()} - ${f.uf}` : f.city.trim() },
    };
  }
  return {
    ...base,
    role: 'provider',
    cpf: onlyDigits(f.cpf),
    birthDate: parseDateBR(f.birth) ?? undefined,
    provider: {
      bio: f.bio.trim(),
      categories: f.categories,
      avatarUri: f.avatarUri || undefined,
      service: {
        title: f.serviceTitle.trim(),
        price: parsePriceBR(f.servicePrice),
        unit: f.serviceUnit,
        photoUri: f.servicePhotoUri,
      },
    },
  };
}

/** Pergunta se a foto vem da câmera ou da galeria. */
function choosePhoto(aspect: [number, number], onPick: (uri: string) => void) {
  Alert.alert('Escolher foto', undefined, [
    { text: 'Tirar foto', onPress: () => pickImage('camera', aspect).then((u) => u && onPick(u)) },
    { text: 'Da galeria', onPress: () => pickImage('gallery', aspect).then((u) => u && onPick(u)) },
    { text: 'Cancelar', style: 'cancel' },
  ]);
}

/**
 * Cadastro com o Mélo. Na primeira vez que o app abre, o Mélo se apresenta e pergunta se a pessoa
 * quer trabalhar ou contratar. Quem vai trabalhar informa nome, CPF, nascimento, celular, áreas, foto,
 * bio e o primeiro serviço (com foto); quem vai contratar informa nome, celular e endereço. No fim
 * cria o login (e-mail e senha) e comemora. Os dados só são gravados no último passo.
 */
export default function OnboardingScreen({ navigation }: RootScreenProps<'Onboarding'>) {
  const { completeSignUp, releaseOnboarding } = useApp();
  const { height } = useWindowDimensions();
  const [history, setHistory] = useState<Step[]>(['welcome']);
  const [dir, setDir] = useState<1 | -1>(1);
  const [path, setPath] = useState<Path | null>(null);
  const [f, setF] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [chatter, setChatter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photosFailed, setPhotosFailed] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const step = history[history.length - 1];
  const flow = path ? FLOW[path] : [];
  const flowIndex = flow.indexOf(step);
  const isForm = flowIndex >= 0;
  const melo = meloFor(step, path, f);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setF((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  };

  // "tremida" do formulário quando algo está errado
  const shake = useRef(new Animated.Value(0)).current;
  const fail = (message: string) => {
    setError(message);
    feedback.error();
    shake.setValue(0);
    Animated.sequence([10, -10, 8, -8, 4, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 50, useNativeDriver: true }))).start();
  };

  const go = (next: Step) => {
    setDir(1);
    setError(null);
    setChatter(null);
    setHistory((h) => [...h, next]);
  };

  const back = useCallback(() => {
    if (history.length <= 1 || step === 'done' || saving) return false;
    feedback.select();
    setDir(-1);
    setError(null);
    setChatter(null);
    setHistory((h) => h.slice(0, -1));
    return true;
  }, [history.length, step, saving]);

  // botão "voltar" do Android volta um passo em vez de sair do app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const choose = (p: Path) => {
    feedback.success();
    setPath(p);
    go(FLOW[p][0]);
  };

  const next = async () => {
    const problem = validate(step, f);
    if (problem) return fail(problem);
    if (step !== 'account') {
      feedback.success();
      return go(flow[flowIndex + 1]);
    }
    if (!path) return;
    setSaving(true);
    setChatter('Preparando tudo pra você… ⏳');
    try {
      const result = await completeSignUp(toData(path, f));
      setPhotosFailed(result.photosFailed);
      feedback.celebrate();
      go('done');
    } catch (e) {
      setChatter(null);
      fail(firebaseErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    markOnboardingSeen();
    releaseOnboarding(); // a navegação troca para as abas do app
  };

  const haveAccount = () => {
    markOnboardingSeen();
    navigation.navigate('Login');
  };

  // CEP completo: busca o endereço e preenche os campos
  const lastCep = useRef('');
  useEffect(() => {
    const d = onlyDigits(f.cep);
    if (step !== 'c-address' || d.length !== 8 || d === lastCep.current) return;
    lastCep.current = d;
    setCepLoading(true);
    lookupCEP(d).then((addr) => {
      setCepLoading(false);
      if (!addr) return setChatter('Não achei esse CEP. Pode digitar o endereço que eu espero. 🙂');
      feedback.select();
      setF((prev) => ({
        ...prev,
        street: addr.street || prev.street,
        district: addr.district || prev.district,
        city: addr.city || prev.city,
        uf: addr.uf || prev.uf,
      }));
      setChatter(addr.street ? 'Achei! Só falta o número. 🏠' : `Achei ${addr.city}! Completa a rua e o número?`);
    });
  }, [f.cep, step]);

  const talk = () => setChatter(CHATTER[Math.floor(Math.random() * CHATTER.length)]);
  const bubbleText = error ?? chatter ?? melo.text;
  // errou algum campo: o Mélo faz cara de curioso
  const talkPose: MeloPose = error ? 'curioso' : melo.pose;
  const bigMelo = Math.min(260, height * 0.32);

  // ---------- telas grandes: boas-vindas, escolha e comemoração ----------

  if (step === 'welcome') {
    return (
      <SafeAreaView style={styles.safe}>
        <FloatingDecor />
        <View style={styles.center}>
          <FadeInView>
            <Wordmark size={30} color={colors.navy} />
          </FadeInView>
          <View style={styles.stage}>
            <SpeechBubble text={bubbleText} style={styles.bigBubble} />
            <View style={styles.meloWrap}>
              {/* círculo laranja clarinho atrás do Mélo (fica só atrás dele, não do balão) */}
              <View style={[styles.halo, { width: bigMelo * 0.95, height: bigMelo * 0.95, borderRadius: bigMelo, top: bigMelo * 0.08 }]} />
              <Melo pose={melo.pose} size={bigMelo} onPress={talk} />
            </View>
          </View>
        </View>
        <FadeInView delay={500} style={styles.footer}>
          <DuoButton title="Bora começar!" icon="paw" onPress={() => go('choice')} sound="success" />
          <Pressable onPress={haveAccount} hitSlop={12}>
            <Text style={styles.link}>Já tenho conta</Text>
          </Pressable>
        </FadeInView>
      </SafeAreaView>
    );
  }

  if (step === 'choice') {
    return (
      <SafeAreaView style={styles.safe}>
        <FloatingDecor />
        <Header onBack={back} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.stage}>
            <SpeechBubble text={bubbleText} style={styles.bigBubble} />
            <Melo pose={melo.pose} size={Math.min(190, height * 0.24)} onPress={talk} />
          </View>
          <View style={styles.choices}>
            <ChoiceCard
              delay={350}
              pose="trabalhando"
              title="Quero trabalhar"
              subtitle="Ofereça seus serviços e faça seus bicos no seu tempo"
              color={colors.primary}
              onPress={() => choose('provider')}
            />
            <ChoiceCard
              delay={480}
              pose="andando"
              title="Quero contratar"
              subtitle="De entregas a reparos, tem gente perto de você"
              color={colors.blue}
              onPress={() => choose('client')}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'done') {
    const price = parsePriceBR(f.servicePrice);
    return (
      <SafeAreaView style={styles.safe}>
        <FloatingDecor />
        <Confetti count={60} />
        <ScrollView contentContainerStyle={[styles.scroll, { flexGrow: 1, justifyContent: 'center' }]}>
          <View style={styles.stage}>
            <SpeechBubble text={bubbleText} style={styles.bigBubble} />
            <Melo pose="comemorando" size={Math.min(230, height * 0.28)} onPress={talk} />
          </View>
          {path === 'provider' && (
            <FadeInView delay={700}>
              <View style={styles.preview}>
                {f.servicePhotoUri ? <Image source={{ uri: f.servicePhotoUri }} style={styles.previewPhoto} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle} numberOfLines={2}>
                    {f.serviceTitle.trim()}
                  </Text>
                  <Text style={styles.previewPrice}>
                    {formatBRL(price)} <Text style={styles.previewUnit}>{f.serviceUnit}</Text>
                  </Text>
                </View>
              </View>
            </FadeInView>
          )}
          <FadeInView delay={900}>
            <View style={styles.tip}>
              <Ionicons name="bulb" size={20} color={colors.star} />
              <Text style={styles.tipText}>
                {photosFailed
                  ? 'Não consegui enviar as fotos agora. Você pode colocar de novo no seu perfil.'
                  : path === 'provider'
                    ? 'Dica do Mélo: ative o recebimento por Pix e cartão em Perfil → Pagamentos. A maioria dos clientes prefere!'
                    : 'Dica do Mélo: pague pelo Pix, é o jeito mais barato e o prestador confirma rapidinho.'}
              </Text>
            </View>
          </FadeInView>
        </ScrollView>
        <FadeInView delay={1100} style={styles.footer}>
          <DuoButton title={path === 'provider' ? 'Ver meu painel' : 'Explorar serviços'} icon="arrow-forward" onPress={finish} />
        </FadeInView>
      </SafeAreaView>
    );
  }

  // ---------- passos com formulário ----------

  return (
    <SafeAreaView style={styles.safe}>
      <FloatingDecor />
      <Header onBack={saving ? undefined : back} progress={isForm ? { total: flow.length, current: flowIndex } : undefined} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.talkRow}>
            <Melo pose={talkPose} size={FACES.includes(talkPose) ? 92 : 112} onPress={talk} />
            <SpeechBubble text={bubbleText} tail="left" tone={error ? 'alert' : 'normal'} style={styles.sideBubble} />
          </View>

          <StepView key={step} dir={dir}>
            <Animated.View style={{ transform: [{ translateX: shake }] }}>
              {(step === 'p-name' || step === 'c-name') && (
                <>
                  <TextField
                    icon="person"
                    placeholder="Nome completo"
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    value={f.name}
                    onChangeText={(v) => set('name', v)}
                    returnKeyType="next"
                    onSubmitEditing={next}
                  />
                  {step === 'c-name' && (
                    <TextField
                      icon="call"
                      placeholder="Celular com DDD"
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      value={f.phone}
                      onChangeText={(v) => set('phone', maskPhone(v))}
                    />
                  )}
                </>
              )}

              {step === 'p-docs' && (
                <>
                  <TextField icon="id-card" placeholder="CPF" keyboardType="number-pad" value={f.cpf} onChangeText={(v) => set('cpf', maskCPF(v))} />
                  <TextField
                    icon="calendar"
                    placeholder="Data de nascimento (dd/mm/aaaa)"
                    keyboardType="number-pad"
                    value={f.birth}
                    onChangeText={(v) => set('birth', maskDate(v))}
                  />
                  <TextField
                    icon="call"
                    placeholder="Celular com DDD"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    value={f.phone}
                    onChangeText={(v) => set('phone', maskPhone(v))}
                  />
                  <View style={styles.note}>
                    <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                    <Text style={styles.noteText}>Só você vê esses dados. Clientes veem apenas seu nome, foto e bio.</Text>
                  </View>
                </>
              )}

              {step === 'p-skills' && (
                <CategoryGrid
                  selected={f.categories}
                  onToggle={(id) =>
                    set('categories', f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id])
                  }
                />
              )}

              {step === 'p-bio' && (
                <>
                  <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                    <PressableScale onPress={() => choosePhoto([1, 1], (u) => set('avatarUri', u))} style={styles.avatarPick}>
                      {f.avatarUri ? (
                        <Image source={{ uri: f.avatarUri }} style={styles.avatarImg} />
                      ) : (
                        <Ionicons name="person" size={48} color={colors.borderDark} />
                      )}
                      <View style={styles.avatarBadge}>
                        <Ionicons name="camera" size={16} color={colors.white} />
                      </View>
                    </PressableScale>
                    <Text style={styles.noteText}>{f.avatarUri ? 'Ficou ótima! Toque para trocar.' : 'Sua foto de perfil (opcional)'}</Text>
                  </View>
                  <TextInput
                    value={f.bio}
                    onChangeText={(v) => set('bio', v.slice(0, 300))}
                    placeholder="Ex.: Sou eletricista há 8 anos, faço instalações e reparos com capricho e pontualidade."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={styles.textarea}
                  />
                  <Text style={[styles.counter, f.bio.trim().length >= 20 && { color: colors.success }]}>{f.bio.length}/300</Text>
                </>
              )}

              {step === 'p-service' && (
                <>
                  <TextField
                    icon="construct"
                    placeholder={TITLE_HINT[f.categories[0] ?? 'reparos']}
                    value={f.serviceTitle}
                    onChangeText={(v) => set('serviceTitle', v)}
                  />
                  <TextField
                    icon="cash"
                    placeholder="Preço (R$)"
                    keyboardType="decimal-pad"
                    value={f.servicePrice}
                    onChangeText={(v) => set('servicePrice', v.replace(/[^\d,]/g, ''))}
                  />
                  <View style={styles.chips}>
                    {UNITS.map((u) => (
                      <Chip key={u} label={u} selected={f.serviceUnit === u} onPress={() => set('serviceUnit', u)} />
                    ))}
                  </View>
                  <PressableScale onPress={() => choosePhoto([4, 3], (u) => set('servicePhotoUri', u))} style={styles.photoBox}>
                    {f.servicePhotoUri ? (
                      <Image source={{ uri: f.servicePhotoUri }} style={StyleSheet.absoluteFill} />
                    ) : (
                      <>
                        <Ionicons name="images" size={36} color={colors.primary} />
                        <Text style={styles.photoText}>Adicionar foto do serviço</Text>
                        <Text style={styles.noteText}>Mostre um trabalho seu de verdade</Text>
                      </>
                    )}
                    {f.servicePhotoUri ? (
                      <View style={styles.photoChange}>
                        <Ionicons name="camera" size={14} color={colors.white} />
                        <Text style={styles.photoChangeText}>Trocar</Text>
                      </View>
                    ) : null}
                  </PressableScale>
                  <View style={styles.note}>
                    <Ionicons name="information-circle" size={14} color={colors.textMuted} />
                    <Text style={styles.noteText}>Você recebe o valor que definir. A taxa da plataforma é cobrada à parte do cliente.</Text>
                  </View>
                </>
              )}

              {step === 'c-address' && (
                <>
                  <View style={styles.chips}>
                    {ADDRESS_LABELS.map((l) => (
                      <Chip key={l} label={l} selected={f.addressLabel === l} color={colors.blue} onPress={() => set('addressLabel', l)} />
                    ))}
                  </View>
                  <View>
                    <TextField icon="location" placeholder="CEP" keyboardType="number-pad" value={f.cep} onChangeText={(v) => set('cep', maskCEP(v))} />
                    {cepLoading && <ActivityIndicator color={colors.blue} style={styles.cepSpinner} />}
                  </View>
                  <TextField icon="home" placeholder="Rua" value={f.street} onChangeText={(v) => set('street', v)} />
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <TextField icon="keypad" placeholder="Número" value={f.number} onChangeText={(v) => set('number', v)} />
                    </View>
                    <View style={{ flex: 1.3 }}>
                      <TextField icon="business" placeholder="Complemento" value={f.complement} onChangeText={(v) => set('complement', v)} />
                    </View>
                  </View>
                  <TextField icon="map" placeholder="Bairro" value={f.district} onChangeText={(v) => set('district', v)} />
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <TextField icon="navigate" placeholder="Cidade" value={f.city} onChangeText={(v) => set('city', v)} />
                    </View>
                    <View style={{ width: 96 }}>
                      <TextField
                        icon="flag"
                        placeholder="UF"
                        autoCapitalize="characters"
                        maxLength={2}
                        value={f.uf}
                        onChangeText={(v) => set('uf', v.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                      />
                    </View>
                  </View>
                </>
              )}

              {step === 'account' && (
                <>
                  <TextField
                    icon="mail"
                    placeholder="E-mail"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={f.email}
                    onChangeText={(v) => set('email', v)}
                  />
                  <View>
                    <TextField
                      icon="lock-closed"
                      placeholder="Crie uma senha"
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
                      value={f.password}
                      onChangeText={(v) => set('password', v)}
                      onSubmitEditing={next}
                      style={{ paddingRight: 40 }}
                    />
                    <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10} style={styles.eye}>
                      <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <Text style={[styles.noteText, { textAlign: 'left' }]}>A senha precisa ter pelo menos 6 caracteres.</Text>
                  <Pressable onPress={haveAccount} hitSlop={10}>
                    <Text style={[styles.link, { marginTop: spacing.lg }]}>Já tenho conta</Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </StepView>
        </ScrollView>

        <View style={styles.footer}>
          <DuoButton
            title={step === 'account' ? 'Criar minha conta' : 'Continuar'}
            icon={step === 'account' ? 'checkmark-circle' : 'arrow-forward'}
            variant={path === 'client' ? 'blue' : 'primary'}
            loading={saving}
            onPress={next}
            sound="none"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Voltar + patinhas de progresso. */
function Header({ onBack, progress }: { onBack?: () => void; progress?: { total: number; current: number } }) {
  return (
    <View style={styles.header}>
      <PressableScale onPress={onBack} disabled={!onBack} style={[styles.backBtn, !onBack && { opacity: 0.4 }]} sound="none">
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </PressableScale>
      {progress && <PawProgress total={progress.total} current={progress.current} />}
      <View style={{ width: 40 }} />
    </View>
  );
}

/** Conteúdo do passo entrando de lado (para a frente ou para trás). */
function StepView({ dir, children }: { dir: 1 | -1; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 7 }).start();
  }, [v]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dir * 60, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function ChoiceCard({
  pose,
  title,
  subtitle,
  color,
  delay,
  onPress,
}: {
  pose: MeloPose;
  title: string;
  subtitle: string;
  color: string;
  delay: number;
  onPress: () => void;
}) {
  return (
    <FadeInView delay={delay} from={40} style={{ flex: 1 }}>
      <PressableScale onPress={onPress} sound="none" style={[styles.choice, { borderColor: color }]}>
        <View style={[styles.choiceArt, { backgroundColor: `${color}14` }]}>
          <Melo pose={pose} size={104} float={false} />
        </View>
        <Text style={[styles.choiceTitle, { color }]}>{title}</Text>
        <Text style={styles.choiceSubtitle}>{subtitle}</Text>
      </PressableScale>
    </FadeInView>
  );
}

function CategoryGrid({ selected, onToggle }: { selected: CategoryId[]; onToggle: (id: CategoryId) => void }) {
  return (
    <View style={styles.grid}>
      {categories.map((c, i) => {
        const on = selected.includes(c.id);
        return (
          <FadeInView key={c.id} delay={i * 45} style={styles.gridCell}>
            <PressableScale
              sound="select"
              onPress={() => onToggle(c.id)}
              style={[styles.tile, on && { backgroundColor: c.color, borderColor: c.color }]}
            >
              <View style={[styles.tileIcon, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : `${c.color}1A` }]}>
                <Ionicons name={c.icon as keyof typeof Ionicons.glyphMap} size={24} color={on ? colors.white : c.color} />
              </View>
              <Text style={[styles.tileText, on && { color: colors.white }]} numberOfLines={2}>
                {c.label}
              </Text>
              {on && (
                <View style={styles.tileCheck}>
                  <Ionicons name="checkmark" size={12} color={c.color} />
                </View>
              )}
            </PressableScale>
          </FadeInView>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  scroll: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  stage: { alignItems: 'center', marginTop: spacing.lg },
  bigBubble: { maxWidth: 340, marginBottom: spacing.lg },
  meloWrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: colors.primaryLight, alignSelf: 'center' },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  link: { textAlign: 'center', color: colors.blue, fontSize: 15, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
  },
  talkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl, minHeight: 112 },
  sideBubble: { flex: 1, marginLeft: spacing.md },
  choices: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  choice: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderBottomWidth: 6,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  choiceArt: { width: '100%', alignItems: 'center', borderRadius: radius.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
  choiceTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  choiceSubtitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.xs },
  noteText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  gridCell: { width: '33.333%', padding: spacing.xs },
  tile: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    alignItems: 'center',
    minHeight: 104,
  },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileText: { fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'center' },
  tileCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPick: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarImg: { width: 106, height: 106, borderRadius: 53 },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textarea: {
    minHeight: 120,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  photoBox: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    gap: 4,
  },
  photoText: { fontSize: 15, fontWeight: '800', color: colors.primaryDark },
  photoChange: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  photoChangeText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row' },
  cepSpinner: { position: 'absolute', right: 16, top: 17 },
  eye: { position: 'absolute', right: 16, top: 17 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  previewPhoto: { width: 72, height: 54, borderRadius: radius.sm },
  previewTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  previewPrice: { fontSize: 17, fontWeight: '900', color: colors.primaryDark, marginTop: 2 },
  previewUnit: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  tipText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
});
