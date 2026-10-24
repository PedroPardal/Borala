import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark, Wordmark } from '../../components/Logo';
import { colors, radius, spacing } from '../../theme';

const STEPS = [
  'Copie o arquivo .env.example para .env na pasta do projeto.',
  'Cole os valores do firebaseConfig do app Web do seu projeto.',
  'Reinicie o servidor com "npx expo start --clear".',
];

/** Aparece só quando o .env não tem a configuração do Firebase. */
export default function SetupScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <LogoMark size={72} />
          <Wordmark size={30} style={{ marginTop: 10 }} />
        </View>
        <Text style={styles.title}>Falta conectar o Firebase</Text>
        <Text style={styles.text}>O app não encontrou a configuração do projeto. Para continuar:</Text>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.step}>
            <View style={styles.num}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
        <Text style={styles.small}>O passo a passo completo está no README, na seção "Firebase".</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl },
  hero: { alignItems: 'center', backgroundColor: colors.navy, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.xl },
  title: { fontSize: 24, fontWeight: '900', color: colors.text, marginBottom: spacing.sm },
  text: { fontSize: 15, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.lg },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  num: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  numText: { color: colors.white, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 21 },
  small: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: spacing.md },
});
