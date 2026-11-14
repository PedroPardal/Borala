import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing, makeStyles } from '../theme';
import { localeTag, t } from '../i18n';

function formatSync(ms: number) {
  const d = new Date(ms);
  return t('date.at', {
    date: d.toLocaleDateString(localeTag()),
    time: d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' }),
  });
}

/** Aviso de "sem internet": os dados mostrados são a última cópia salva no aparelho. */
export default function OfflineBanner() {
  const { online, lastSync } = useApp();
  if (online) return null;
  return (
    <View style={styles.box}>
      <Ionicons name="cloud-offline" size={20} color={colors.onSecondary} />
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={styles.title}>{t('offline.title')}</Text>
        <Text style={styles.sub}>
          {lastSync ? t('offline.savedAt', { when: formatSync(lastSync) }) : t('offline.saved')} {t('offline.connect')}
        </Text>
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondaryDark,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { fontSize: 14, fontWeight: '900', color: colors.text },
  sub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
}));
