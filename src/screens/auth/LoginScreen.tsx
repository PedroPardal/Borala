import React, { useEffect, useRef, useState } from 'react';
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
import PressableScale from '../../components/PressableScale';
import FadeInView from '../../components/FadeInView';
import { LogoMark, Wordmark } from '../../components/Logo';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { colors, radius, spacing } from '../../theme';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';

type Mode = 'login' | 'signup';

const ROLES: { id: UserRole; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: 'client', title: 'Quero contratar', subtitle: 'De entregas a reparos, tem gente perto de você', icon: 'search', color: colors.blue },
  { id: 'provider', title: 'Quero trabalhar', subtitle: 'Faça seus bicos no seu tempo', icon: 'flash', color: colors.primary },
];

export default function LoginScreen() {
  const { signIn, signUp, resetPassword } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<UserRole>('client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // mascote "flutuando"
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
    if (!email.includes('@')) return fail('Digite um e-mail válido.');
    if (password.length < 6) return fail('A senha precisa ter pelo menos 6 caracteres.');
    if (mode === 'signup' && name.trim().length < 2) return fail('Digite seu nome.');
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') await signIn(email, password);
      else await signUp({ role, name: name.trim(), email, password });
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
            <Animated.View
              style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}
            >
              <LogoMark size={96} style={styles.logo} />
            </Animated.View>
            <Wordmark size={40} style={{ marginTop: 14 }} />
            <Text style={styles.slogan}>AGORA VAI!</Text>
            <Text style={styles.tagline}>Trabalhe e encontre serviços no seu tempo.</Text>
          </FadeInView>

          <FadeInView delay={100} style={styles.segment}>
            {(['login', 'signup'] as Mode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  feedback.select();
                  setMode(m);
                  setError(null);
                }}
                style={[styles.segmentItem, mode === m && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, mode === m && { color: colors.primary }]}>
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </Text>
              </Pressable>
            ))}
          </FadeInView>

          {mode === 'signup' && (
            <FadeInView delay={60}>
              <Text style={styles.label}>Como você quer usar o app?</Text>
              <View style={styles.roles}>
                {ROLES.map((r) => {
                  const active = role === r.id;
                  return (
                    <PressableScale
                      key={r.id}
                      sound="select"
                      onPress={() => setRole(r.id)}
                      style={[styles.roleCard, active && { borderColor: r.color, backgroundColor: `${r.color}14` }]}
                    >
                      <View style={[styles.roleIcon, { backgroundColor: active ? r.color : colors.border }]}>
                        <Ionicons name={r.icon} size={24} color={colors.white} />
                      </View>
                      <Text style={styles.roleTitle}>{r.title}</Text>
                      <Text style={styles.roleSubtitle}>{r.subtitle}</Text>
                      {active && (
                        <View style={[styles.check, { backgroundColor: r.color }]}>
                          <Ionicons name="checkmark" size={14} color={colors.white} />
                        </View>
                      )}
                    </PressableScale>
                  );
                })}
              </View>
            </FadeInView>
          )}

          <FadeInView delay={160}>
            <Animated.View style={{ transform: [{ translateX: shake }] }}>
              {mode === 'signup' && <TextField icon="person" placeholder="Seu nome" value={name} onChangeText={setName} />}
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
                placeholder={mode === 'signup' ? 'Crie uma senha (mín. 6 caracteres)' : 'Senha'}
                secureTextEntry
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
              title={mode === 'login' ? 'Entrar' : 'Criar conta'}
              onPress={submit}
              loading={loading}
              sound="none"
              variant={mode === 'signup' && role === 'client' ? 'blue' : 'primary'}
              style={{ marginTop: spacing.sm }}
            />
            {mode === 'login' && (
              <Pressable onPress={forgot} hitSlop={10}>
                <Text style={styles.link}>Esqueci minha senha</Text>
              </Pressable>
            )}
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
  logo: { borderWidth: 2, borderColor: colors.navyLight },
  slogan: { fontSize: 14, fontWeight: '900', color: colors.secondary, letterSpacing: 2, marginTop: 6 },
  tagline: { fontSize: 14, fontWeight: '600', color: colors.borderDark, marginTop: 4, textAlign: 'center' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.xl,
  },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { fontWeight: '800', color: colors.textMuted },
  label: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  roles: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 150,
  },
  roleIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  roleTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  roleSubtitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  check: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  errorText: { flex: 1, color: colors.danger, fontWeight: '700', fontSize: 13 },
  link: { textAlign: 'center', color: colors.blue, fontSize: 14, fontWeight: '800', marginTop: spacing.lg },
});
