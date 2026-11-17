import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { useApp } from '../context/AppContext';
import { firebaseErrorMessage } from '../services/firebase';
import { feedback } from '../services/feedback';
import { UserRole } from '../types';
import { colors, radius, spacing, makeStyles } from '../theme';
import { t } from '../i18n';

const copy = (): Record<UserRole, { title: string; subtitle: string; confirm: string; icon: keyof typeof Ionicons.glyphMap; color: string }> => ({
  provider: {
    title: t('role.toProvider'),
    subtitle: t('role.toProviderSub'),
    confirm: t('role.toProviderConfirm'),
    icon: 'megaphone',
    color: colors.primary,
  },
  client: {
    title: t('role.toClient'),
    subtitle: t('role.toClientSub'),
    confirm: t('role.toClientConfirm'),
    icon: 'search',
    color: colors.blue,
  },
});

/** Alterna a conta entre contratar (cliente) e divulgar serviços (prestador). */
export default function SwitchRoleCard({ to }: { to: UserRole }) {
  const { switchRole } = useApp();
  const [busy, setBusy] = useState(false);
  const c = copy()[to];

  const run = async () => {
    setBusy(true);
    try {
      await switchRole(to);
      feedback.success();
      // a navegação troca sozinha quando o perfil atualizar
    } catch (e) {
      setBusy(false);
      feedback.error();
      Alert.alert(t('role.failed'), firebaseErrorMessage(e));
    }
  };

  const ask = () =>
    Alert.alert(c.title, c.confirm, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.continue'), onPress: run },
    ]);

  return (
    <PressableScale onPress={ask} disabled={busy} style={[styles.card, { borderColor: c.color, backgroundColor: `${c.color}14` }]}>
      <View style={[styles.icon, { backgroundColor: c.color }]}>
        <Ionicons name={c.icon} size={24} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{c.title}</Text>
        <Text style={styles.subtitle}>{c.subtitle}</Text>
      </View>
      {busy ? <ActivityIndicator color={c.color} /> : <Ionicons name="chevron-forward" size={22} color={c.color} />}
    </PressableScale>
  );
}

const styles = makeStyles(() => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
  },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2, lineHeight: 18 },
}));
