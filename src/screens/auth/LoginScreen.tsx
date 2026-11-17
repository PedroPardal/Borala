import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DuoButton from '../../components/DuoButton';
import TextField from '../../components/TextField';
import FadeInView from '../../components/FadeInView';
import Melo from '../../components/Melo';
import { Wordmark } from '../../components/Logo';
import { useApp } from '../../context/AppContext';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';
import { markOnboardingSeen } from '../../services/onboarding';

/** Entrar numa conta existente. Contas novas são criadas no cadastro com o Mélo (OnboardingScreen). */
export default function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const { signIn, resetPassword } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!email.includes('@')) return fail('Digite um e-mail válido.');
    if (password.length < 6) return fail('A senha precisa ter pelo menos 6 caracteres.');
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
    if (!email.includes('@')) return fail('Digite seu e-mail acima para receber o link.');
    try {
      await resetPassword(email);
      feedback.success();
      Alert.alert('Confira seu e-mail', `Enviamos um link para redefinir a senha para ${email.trim()}.`);
    } catch (e) {
      fail(firebaseErrorMessage(e));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <FadeInView style={styles.hero}>
            <Melo pose="acenando" size={130} />
            <Wordmark size={36} style={{ marginTop: 10 }} />
            <Text style={styles.slogan}>AGORA VAI!</Text>
            <Text style={styles.tagline}>Que bom te ver de volta!</Text>
          </FadeInView>

          <FadeInView delay={160}>
            <Animated.View style={{ transform: [{ translateX: shake }] }}>
              <TextField
                icon="mail"
                placeholder="E-mail"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              <TextField
                icon="lock-closed"
                placeholder="Senha"
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

            <DuoButton
              title="Entrar"
              onPress={submit}
              loading={loading}
              sound="none"
              style={{ marginTop: spacing.sm }}
            />
            <Pressable onPress={forgot} hitSlop={10}>
              <Text style={styles.link}>Esqueci minha senha</Text>
            </Pressable>
            <View style={styles.signup}>
              <Text style={styles.signupText}>Ainda não tem conta?</Text>
              <DuoButton title="Criar conta com o Mélo" variant="outline" icon="paw" onPress={() => navigation.navigate('Onboarding')} />
            </View>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  slogan: { fontSize: 14, fontWeight: '900', color: colors.secondary, letterSpacing: 2, marginTop: 6 },
  tagline: { fontSize: 14, fontWeight: '600', color: colors.borderDark, marginTop: 4, textAlign: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  errorText: { flex: 1, color: colors.danger, fontWeight: '700', fontSize: 13 },
  link: { textAlign: 'center', color: colors.blue, fontSize: 14, fontWeight: '800', marginTop: spacing.lg },
  signup: { marginTop: spacing.xxl, gap: spacing.sm },
  signupText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, fontWeight: '700' },
});
