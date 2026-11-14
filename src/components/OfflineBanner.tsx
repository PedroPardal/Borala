import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../theme';

function formatSync(ms: number) {
  const d = new Date(ms);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Aviso de "sem internet": os dados mostrados são a última cópia salva no aparelho. */
export default function OfflineBanner() {
  const { online, lastSync } = useApp();
  if (online) return null;
  return (
    <View style={styles.box}>
      <Ionicons name="cloud-offline" size={20} color={colors.onSecondary} />
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={styles.title}>Você está offline</Text>
        <Text style={styles.sub}>
          {lastSync ? `Mostrando dados salvos em ${formatSync(lastSync)}.` : 'Mostrando os dados salvos no aparelho.'} Para aceitar pedidos ou
          conversar, conecte-se à internet.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
