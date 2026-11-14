import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { useApp } from '../context/AppContext';
import { firebaseErrorMessage } from '../services/firebase';
import { feedback } from '../services/feedback';
import { UserRole } from '../types';
import { colors, radius, spacing } from '../theme';

const COPY: Record<UserRole, { title: string; subtitle: string; confirm: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  provider: {
    title: 'Quero divulgar meu serviço',
    subtitle: 'Ofereça seus bicos no BoraLá e receba pedidos de clientes perto de você.',
    confirm: 'Sua conta vai para o modo prestador. Cadastre suas especialidades e seus serviços para aparecer nas buscas. Você pode voltar a contratar quando quiser.',
    icon: 'megaphone',
    color: colors.primary,
  },
  client: {
    title: 'Quero contratar serviços',
    subtitle: 'Volte para o modo cliente. Seu perfil de prestador continua publicado.',
    confirm: 'Sua conta vai para o modo cliente. Seu perfil de prestador continua aparecendo nas buscas, e você pode voltar a ele quando quiser.',
    icon: 'search',
    color: colors.blue,
  },
};

/** Alterna a conta entre contratar (cliente) e divulgar serviços (prestador). */
export default function SwitchRoleCard({ to }: { to: UserRole }) {
  const { switchRole } = useApp();
  const [busy, setBusy] = useState(false);
  const c = COPY[to];

  const run = async () => {
    setBusy(true);
    try {
      await switchRole(to);
      feedback.success();
      // a navegação troca sozinha quando o perfil atualizar
    } catch (e) {
      setBusy(false);
      feedback.error();
      Alert.alert('Não foi possível trocar', firebaseErrorMessage(e));
    }
  };

  const ask = () =>
    Alert.alert(c.title, c.confirm, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Continuar', onPress: run },
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

const styles = StyleSheet.create({
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
});
