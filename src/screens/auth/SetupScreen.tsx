import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark, Wordmark } from '../../components/Logo';
import { colors, radius, spacing, makeStyles } from '../../theme';
import { t } from '../../i18n';

/** Aparece só quando o .env não tem a configuração do Firebase. */
export default function SetupScreen() {
  const steps = [t('setup.step1'), t('setup.step2'), t('setup.step3')];
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <LogoMark size={72} />
          <Wordmark size={30} style={{ marginTop: 10 }} />
        </View>
        <Text style={styles.title}>{t('setup.title')}</Text>
        <Text style={styles.text}>{t('setup.text')}</Text>
        {steps.map((s, i) => (
          <View key={s} style={styles.step}>
            <View style={styles.num}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
        <Text style={styles.small}>{t('setup.small')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = makeStyles(() => ({
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
}));
