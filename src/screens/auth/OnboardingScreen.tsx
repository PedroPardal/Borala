import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
import { colors, radius, spacing, makeStyles } from '../../theme';
import { t, TKey, tList } from '../../i18n';
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

/** Unidades e apelidos de endereço no idioma do app (são salvos no perfil como texto). */
const units = () => tList('onb.units');
const addressLabels = () => tList('onb.addressLabels');
const titleHint = (c?: CategoryId) => t(`onb.hint.${c ?? 'reparos'}` as TKey);

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
  serviceUnit: '',
  servicePhotoUri: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  uf: '',
  addressLabel: '',
  email: '',
  password: '',
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** Pose e fala do Mélo em cada passo. */
function meloFor(step: Step, path: Path | null, f: Form): { pose: MeloPose; text: string } {
  const name = firstName(f.name);
  switch (step) {
    case 'welcome':
      return { pose: 'acenando', text: t('onb.say.welcome') };
    case 'choice':
      return { pose: 'pensando', text: t('onb.say.choice') };
    case 'p-name':
      return { pose: 'feliz', text: t('onb.say.pName') };
    case 'p-docs':
      return { pose: 'focado', text: t('onb.say.pDocs', { name }) };
    case 'p-skills':
      return { pose: 'pensando', text: t('onb.say.pSkills') };
    case 'p-bio':
      return { pose: 'feliz', text: t('onb.say.pBio') };
    case 'p-service':
      return { pose: 'trabalhando', text: t('onb.say.pService') };
    case 'c-name':
      return { pose: 'andando', text: t('onb.say.cName') };
    case 'c-address':
      return { pose: 'feliz', text: t('onb.say.cAddress', { name }) };
    case 'account':
      return { pose: 'atendendo', text: t('onb.say.account') };
    case 'done':
      return { pose: 'comemorando', text: t(path === 'provider' ? 'onb.say.doneProvider' : 'onb.say.doneClient', { name }) };
  }
}

/** Confere os campos do passo; devolve o que o Mélo deve dizer se algo estiver errado. */
function validate(step: Step, f: Form): string | null {
  switch (step) {
    case 'p-name':
      return isFullName(f.name) ? null : t('onb.err.fullName');
    case 'c-name':
      if (!isFullName(f.name)) return t('onb.err.fullName');
      return isValidPhone(f.phone) ? null : t('onb.err.phone');
    case 'p-docs': {
      if (!isValidCPF(f.cpf)) return t('onb.err.cpf');
      const iso = parseDateBR(f.birth);
      if (!iso || ageFrom(iso) > 110) return t('onb.err.birth');
      if (ageFrom(iso) < 18) return t('onb.err.underage');
      return isValidPhone(f.phone) ? null : t('onb.err.phone');
    }
    case 'p-skills':
      return f.categories.length > 0 ? null : t('onb.err.categories');
    case 'p-bio': {
      const missing = 20 - f.bio.trim().length;
      return missing > 0 ? t('onb.err.bioShort', { n: missing }) : null;
    }
    case 'p-service': {
      if (f.serviceTitle.trim().length < 3) return t('onb.err.serviceTitle');
      const price = parsePriceBR(f.servicePrice);
      if (!(price >= 5)) return t('onb.err.priceMin');
      if (price > 50000) return t('onb.err.priceMax');
      return f.servicePhotoUri ? null : t('onb.err.servicePhoto');
    }
    case 'c-address':
      if (f.cep && onlyDigits(f.cep).length !== 8) return t('onb.err.cep');
      if (f.street.trim().length < 3) return t('onb.err.street');
      if (!f.number.trim()) return t('onb.err.number');
      return f.city.trim().length >= 2 ? null : t('onb.err.city');
    case 'account':
      if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return t('onb.err.email');
      return f.password.length >= 6 ? null : t('onb.err.password');
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
      address: { id: `a${Date.now()}`, label: f.addressLabel || addressLabels()[0], street, city: f.uf ? `${f.city.trim()} - ${f.uf}` : f.city.trim() },
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
        unit: f.serviceUnit || units()[0],
        photoUri: f.servicePhotoUri,
      },
    },
  };
}

/** Pergunta se a foto vem da câmera ou da galeria (o pickImage já devolve a foto reduzida). */
function choosePhoto(aspect: [number, number], maxWidth: number, onPick: (uri: string) => void) {
  Alert.alert(t('onb.photoTitle'), undefined, [
    { text: t('onb.photoCamera'), onPress: () => pickImage('camera', aspect, maxWidth).then((u) => u && onPick(u)) },
    { text: t('onb.photoGallery'), onPress: () => pickImage('gallery', aspect, maxWidth).then((u) => u && onPick(u)) },
    { text: t('common.cancel'), style: 'cancel' },
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
    setChatter(t('onb.say.saving'));
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
      if (!addr) return setChatter(t('onb.say.cepNotFound'));
      feedback.select();
      setF((prev) => ({
        ...prev,
        street: addr.street || prev.street,
        district: addr.district || prev.district,
        city: addr.city || prev.city,
        uf: addr.uf || prev.uf,
      }));
      setChatter(addr.street ? t('onb.say.cepFound') : t('onb.say.cepCity', { city: addr.city }));
    });
  }, [f.cep, step]);

  const talk = () => {
    const lines = tList('onb.chatter');
    setChatter(lines[Math.floor(Math.random() * lines.length)]);
  };
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
            <Wordmark size={30} color={colors.text} />
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
          <DuoButton title={t('onb.start')} icon="paw" onPress={() => go('choice')} sound="success" />
          <Pressable onPress={haveAccount} hitSlop={12}>
            <Text style={styles.link}>{t('onb.haveAccount')}</Text>
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
              title={t('onb.work')}
              subtitle={t('onb.workSub')}
              color={colors.primary}
              onPress={() => choose('provider')}
            />
            <ChoiceCard
              delay={480}
              pose="andando"
              title={t('onb.hire')}
              subtitle={t('onb.hireSub')}
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
                {photosFailed ? t('onb.tipPhotosFailed') : path === 'provider' ? t('onb.tipProvider') : t('onb.tipClient')}
              </Text>
            </View>
          </FadeInView>
        </ScrollView>
        <FadeInView delay={1100} style={styles.footer}>
          <DuoButton title={path === 'provider' ? t('onb.goDashboard') : t('onb.goExplore')} icon="arrow-forward" onPress={finish} />
        </FadeInView>
      </SafeAreaView>
    );
  }

  // ---------- passos com formulário ----------

  return (
    <SafeAreaView style={styles.safe}>
      <FloatingDecor />
      <Header onBack={saving ? undefined : back} progress={isForm ? { total: flow.length, current: flowIndex } : undefined} />
      {/* mesmo padrão das outras telas: o rodapé sobe junto com o teclado e a lista rola até o campo
          selecionado, então o teclado não cobre o que está sendo digitado (no Android também) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <KeyboardAwareScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bottomOffset={24}>
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
                    placeholder={t('onb.fullName')}
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
                      placeholder={t('onb.phone')}
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
                  <TextField icon="id-card" placeholder={t('onb.cpf')} keyboardType="number-pad" value={f.cpf} onChangeText={(v) => set('cpf', maskCPF(v))} />
                  <TextField
                    icon="calendar"
                    placeholder={t('onb.birth')}
                    keyboardType="number-pad"
                    value={f.birth}
                    onChangeText={(v) => set('birth', maskDate(v))}
                  />
                  <TextField
                    icon="call"
                    placeholder={t('onb.phone')}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    value={f.phone}
                    onChangeText={(v) => set('phone', maskPhone(v))}
                  />
                  <View style={styles.note}>
                    <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                    <Text style={styles.noteText}>{t('onb.privacy')}</Text>
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
                    <PressableScale onPress={() => choosePhoto([1, 1], 512, (u) => set('avatarUri', u))} style={styles.avatarPick}>
                      {f.avatarUri ? (
                        <Image source={{ uri: f.avatarUri }} style={styles.avatarImg} />
                      ) : (
                        <Ionicons name="person" size={48} color={colors.borderDark} />
                      )}
                      <View style={styles.avatarBadge}>
                        <Ionicons name="camera" size={16} color={colors.white} />
                      </View>
                    </PressableScale>
                    <Text style={styles.noteText}>{f.avatarUri ? t('onb.avatarDone') : t('onb.avatarHint')}</Text>
                  </View>
                  <TextInput
                    value={f.bio}
                    onChangeText={(v) => set('bio', v.slice(0, 300))}
                    placeholder={t('onb.bioPh')}
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
                    placeholder={titleHint(f.categories[0])}
                    value={f.serviceTitle}
                    onChangeText={(v) => set('serviceTitle', v)}
                  />
                  <TextField
                    icon="cash"
                    placeholder={t('onb.price')}
                    keyboardType="decimal-pad"
                    value={f.servicePrice}
                    onChangeText={(v) => set('servicePrice', v.replace(/[^\d,]/g, ''))}
                  />
                  <View style={styles.chips}>
                    {units().map((u) => (
                      <Chip key={u} label={u} selected={(f.serviceUnit || units()[0]) === u} onPress={() => set('serviceUnit', u)} />
                    ))}
                  </View>
                  <PressableScale onPress={() => choosePhoto([4, 3], 960, (u) => set('servicePhotoUri', u))} style={styles.photoBox}>
                    {f.servicePhotoUri ? (
                      <Image source={{ uri: f.servicePhotoUri }} style={StyleSheet.absoluteFill} />
                    ) : (
                      <>
                        <Ionicons name="images" size={36} color={colors.primary} />
                        <Text style={styles.photoText}>{t('onb.addServicePhoto')}</Text>
                        <Text style={styles.noteText}>{t('onb.addServicePhotoSub')}</Text>
                      </>
                    )}
                    {f.servicePhotoUri ? (
                      <View style={styles.photoChange}>
                        <Ionicons name="camera" size={14} color={colors.white} />
                        <Text style={styles.photoChangeText}>{t('onb.change')}</Text>
                      </View>
                    ) : null}
                  </PressableScale>
                  <View style={styles.note}>
                    <Ionicons name="information-circle" size={14} color={colors.textMuted} />
                    <Text style={styles.noteText}>{t('onb.feeNote')}</Text>
                  </View>
                </>
              )}

              {step === 'c-address' && (
                <>
                  <View style={styles.chips}>
                    {addressLabels().map((l) => (
                      <Chip key={l} label={l} selected={(f.addressLabel || addressLabels()[0]) === l} color={colors.blue} onPress={() => set('addressLabel', l)} />
                    ))}
                  </View>
                  <View>
                    <TextField icon="location" placeholder={t('onb.cep')} keyboardType="number-pad" value={f.cep} onChangeText={(v) => set('cep', maskCEP(v))} />
                    {cepLoading && <ActivityIndicator color={colors.blue} style={styles.cepSpinner} />}
                  </View>
                  <TextField icon="home" placeholder={t('onb.street')} value={f.street} onChangeText={(v) => set('street', v)} />
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <TextField icon="keypad" placeholder={t('onb.number')} value={f.number} onChangeText={(v) => set('number', v)} />
                    </View>
                    <View style={{ flex: 1.3 }}>
                      <TextField icon="business" placeholder={t('onb.complement')} value={f.complement} onChangeText={(v) => set('complement', v)} />
                    </View>
                  </View>
                  <TextField icon="map" placeholder={t('onb.district')} value={f.district} onChangeText={(v) => set('district', v)} />
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <TextField icon="navigate" placeholder={t('onb.city')} value={f.city} onChangeText={(v) => set('city', v)} />
                    </View>
                    <View style={{ width: 96 }}>
                      <TextField
                        icon="flag"
                        placeholder={t('onb.uf')}
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
                    placeholder={t('onb.email')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={f.email}
                    onChangeText={(v) => set('email', v)}
                  />
                  <TextField
                    icon="lock-closed"
                    placeholder={t('onb.password')}
                    secureTextEntry
                    autoComplete="new-password"
                    value={f.password}
                    onChangeText={(v) => set('password', v)}
                    onSubmitEditing={next}
                  />
                  <Text style={[styles.noteText, { textAlign: 'left' }]}>{t('onb.passwordHint')}</Text>
                  <Pressable onPress={haveAccount} hitSlop={10}>
                    <Text style={[styles.link, { marginTop: spacing.lg }]}>{t('onb.haveAccount')}</Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </StepView>
        </KeyboardAwareScrollView>

        <View style={styles.footer}>
          <DuoButton
            title={step === 'account' ? t('onb.createAccount') : t('onb.continue')}
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

const styles = makeStyles(() => ({
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
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  talkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl, minHeight: 112 },
  sideBubble: { flex: 1, marginLeft: spacing.md },
  choices: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  choice: {
    flex: 1,
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPick: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
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
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
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
}));
