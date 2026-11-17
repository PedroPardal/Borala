import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DuoButton from '../../components/DuoButton';
import TextField from '../../components/TextField';
import FadeInView from '../../components/FadeInView';
import { LogoMark, Wordmark } from '../../components/Logo';
import { useApp } from '../../context/AppContext';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing, makeStyles } from '../../theme';
import { t } from '../../i18n';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';
import { markOnboardingSeen } from '../../services/onboarding';
import { LanguagePicker } from '../../components/PreferencesCard';

/** Entrar numa conta existente. Contas novas são criadas no cadastro guiado (OnboardingScreen). */
export default function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const { signIn, resetPassword } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // logo "flutuando"
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    ).start();
  }, [float]);

  // "tremida" ao errar
  const shake = useRef(new Animated.Value(0)).current;
  const fail = (message: string) => {
    setError(message);
    feedback.error();
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 50, useNativeDriver: true })),
    ).start();
  };

  const submit = async () => {
    if (!email.includes('@')) return fail(t('login.invalidEmail'));
    if (password.length < 6) return fail(t('login.shortPassword'));
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      markOnboardingSeen();
      feedback.success();
      // a navegação troca sozinha quando o perfil carregar
    } catch (e) {
      setLoading(false);
      fail(firebaseErrorMessage(e));
    }
  };

  const forgot = async () => {
    if (!email.includes('@')) return fail(t('login.forgotNeedsEmail'));
    try {
      await resetPassword(email);
      feedback.success();
      Alert.alert(t('login.resetSentTitle'), t('login.resetSentBody', { email: email.trim() }));
    } catch (e) {
      fail(firebaseErrorMessage(e));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" bottomOffset={90}>
        <FadeInView style={styles.hero}>
          <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}>
            <LogoMark size={96} style={styles.logo} />
          </Animated.View>
          <Wordmark size={40} style={{ marginTop: 14 }} />
          <Text style={styles.slogan}>{t('login.slogan')}</Text>
          <Text style={styles.tagline}>{t('login.tagline')}</Text>
        </FadeInView>

        <FadeInView delay={160}>
          <Animated.View style={{ transform: [{ translateX: shake }] }}>
            <TextField
              icon="mail"
              placeholder={t('login.email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              icon="lock-closed"
              placeholder={t('login.password')}
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
            />
          </Animated.View>

          {error && (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <DuoButton title={t('login.signIn')} onPress={submit} loading={loading} sound="none" style={{ marginTop: spacing.sm }} />
          <Pressable onPress={forgot} hitSlop={10}>
            <Text style={styles.link}>{t('login.forgot')}</Text>
          </Pressable>
          <View style={styles.signup}>
            <Text style={styles.signupText}>{t('login.noAccount')}</Text>
            <DuoButton title={t('login.signUp')} variant="outline" icon="person-add" onPress={() => navigation.navigate('Onboarding')} />
          </View>
        </FadeInView>

        <FadeInView delay={220} style={styles.lang}>
          <LanguagePicker />
        </FadeInView>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingBottom: 48 },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    borderBottomWidth: 6,
    borderBottomColor: colors.primary,
  },
  logo: { borderWidth: 2, borderColor: colors.navyLight },
  slogan: { fontSize: 14, fontWeight: '900', color: colors.secondary, letterSpacing: 2, marginTop: 6 },
  tagline: { fontSize: 14, fontWeight: '600', color: '#CBD5E1', marginTop: 4, textAlign: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  errorText: { flex: 1, color: colors.danger, fontWeight: '700', fontSize: 13 },
  link: { textAlign: 'center', color: colors.blue, fontSize: 14, fontWeight: '800', marginTop: spacing.lg },
  lang: { marginTop: spacing.xl },
  signup: { marginTop: spacing.xxl, gap: spacing.sm },
  signupText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, fontWeight: '700' },
}));
