import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import DuoButton from './DuoButton';
import { cardStyle } from './Card';
import { Booking, BookingStatus } from '../types';
import { colors, spacing } from '../theme';
import { formatBRL, formatDateLong } from '../utils/format';

const STATUS: Record<BookingStatus, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: colors.primary },
  aceito: { label: 'Agendado', color: colors.blue },
  recusado: { label: 'Recusado', color: colors.danger },
  concluido: { label: 'Concluído', color: colors.success },
};

const PAYMENT = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' } as const;

interface Props {
  booking: Booking;
  /** Nome/foto exibidos (cliente para o prestador, prestador para o cliente) */
  title: string;
  avatar: string;
  onAccept?: () => void;
  onDecline?: () => void;
  footer?: React.ReactNode;
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const s = STATUS[status];
  return (
    <View style={[styles.badge, { backgroundColor: `${s.color}22` }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export default function RequestCard({ booking, title, avatar, onAccept, onDecline, footer }: Props) {
  // animação de saída ao aceitar/recusar
  const anim = useRef(new Animated.Value(1)).current;
  const dir = useRef(new Animated.Value(1)).current; // 1 = direita (aceitar), -1 = esquerda (recusar)

  const leave = (cb?: () => void, direction = 1) => {
    dir.setValue(direction);
    Animated.timing(anim, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => cb?.());
  };

  // se o card continuar visível após mudar de status, volta a aparecer
  useEffect(() => {
    anim.setValue(1);
  }, [booking.status, anim]);

  const translateX = Animated.multiply(anim.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }), dir);

  return (
    <Animated.View style={[styles.card, { opacity: anim, transform: [{ translateX }, { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
      <View style={styles.header}>
        <Avatar uri={avatar} size={44} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.service}>{booking.serviceTitle}</Text>
        </View>
        <StatusBadge status={booking.status} />
      </View>

      <View style={styles.meta}>
        <Meta icon="calendar" text={`${formatDateLong(booking.date)} • ${booking.time}`} />
        <Meta icon="location" text={booking.address} />
        <Meta icon="wallet" text={`${PAYMENT[booking.payment]} • ${formatBRL(booking.price)}`} />
        {booking.notes ? <Meta icon="chatbubble-ellipses" text={`"${booking.notes}"`} /> : null}
      </View>

      {booking.status === 'pendente' && onAccept && onDecline && (
        <View style={styles.actions}>
          <DuoButton title="Recusar" variant="outline" small style={{ flex: 1 }} onPress={() => leave(onDecline, -1)} sound="none" />
          <View style={{ width: spacing.md }} />
          <DuoButton title="Aceitar" icon="checkmark" small style={{ flex: 1 }} onPress={() => leave(onAccept)} sound="none" />
        </View>
      )}
      {footer}
    </Animated.View>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <Text style={styles.metaText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...cardStyle, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  service: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  meta: { marginTop: spacing.md, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { marginLeft: 8, fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },
  actions: { flexDirection: 'row', marginTop: spacing.lg },
});
