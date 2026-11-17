import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import DuoButton from './DuoButton';
import { cardStyle } from './Card';
import { Booking, BookingStatus } from '../types';
import { colors, spacing, makeStyles } from '../theme';
import { t, TKey } from '../i18n';
import { formatBRL, formatDateLong } from '../utils/format';

// função (e não constante) para o cinza do "cancelado" acompanhar o tema claro/escuro
const statusColor = (s: BookingStatus): string =>
  ({
    pendente: colors.primary,
    aceito: colors.blue,
    recusado: colors.danger,
    concluido: colors.success,
    cancelado: colors.textMuted,
  })[s];

const paymentLabel = (p: Booking['payment']) => t(`pay.${p}` as TKey);

interface Props {
  booking: Booking;
  /** Nome/foto exibidos (cliente para o prestador, prestador para o cliente) */
  title: string;
  avatar: string;
  onAccept?: () => void;
  onDecline?: () => void;
  footer?: React.ReactNode;
  /** mostra quanto o prestador recebe e o desconto de comissões */
  forProvider?: boolean;
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const color = statusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <Text style={[styles.badgeText, { color }]}>{t(`status.${status}` as TKey)}</Text>
    </View>
  );
}

export default function RequestCard({ booking, title, avatar, onAccept, onDecline, footer, forProvider }: Props) {
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
        <Meta icon="wallet" text={`${paymentLabel(booking.payment)} • ${formatBRL(booking.price)}`} />
        {booking.payment !== 'dinheiro' && (
          <Meta
            icon={booking.paymentStatus === 'pago' ? 'checkmark-circle' : 'time'}
            text={t(`paystatus.${booking.paymentStatus ?? 'aguardando'}` as TKey)}
          />
        )}
        {booking.disputed && <Meta icon="alert-circle" text={t('req.disputed')} />}
        {forProvider && <ProviderMoney booking={booking} />}
        {booking.notes ? <Meta icon="chatbubble-ellipses" text={`"${booking.notes}"`} /> : null}
      </View>

      {booking.status === 'pendente' && onAccept && onDecline && booking.payment !== 'dinheiro' && booking.paymentStatus !== 'pago' && (
        <Text style={styles.waiting}>{t('req.waitingPayment')}</Text>
      )}
      {booking.status === 'pendente' && onAccept && onDecline && (booking.payment === 'dinheiro' || booking.paymentStatus === 'pago') && (
        <View style={styles.actions}>
          <DuoButton title={t('req.decline')} variant="outline" small style={{ flex: 1 }} onPress={() => leave(onDecline, -1)} sound="none" />
          <View style={{ width: spacing.md }} />
          <DuoButton title={t('req.accept')} icon="checkmark" small style={{ flex: 1 }} onPress={() => leave(onAccept)} sound="none" />
        </View>
      )}
      {footer}
    </Animated.View>
  );
}

/** O que o prestador recebe: em dinheiro, a comissão vira débito; no app, o repasse já vem com o desconto. */
function ProviderMoney({ booking }: { booking: Booking }) {
  if (booking.servicePrice === undefined || booking.platformFee === undefined) return null;
  if (booking.payment === 'dinheiro') {
    return (
      <Meta
        icon="receipt"
        text={t('req.cashCommission', { total: formatBRL(booking.price), fee: formatBRL(booking.platformFee) })}
      />
    );
  }
  if (booking.payout) {
    const { amount, debtDeducted, status } = booking.payout;
    const line = t(status === 'pago' ? 'req.payoutDone' : 'req.payoutPending', { amount: formatBRL(amount) });
    const debt = debtDeducted > 0 ? ` ${t('req.payoutDeducted', { debt: formatBRL(debtDeducted) })}` : '';
    return <Meta icon="cash" text={line + debt} />;
  }
  return <Meta icon="cash" text={t('req.youGetUpTo', { amount: formatBRL(booking.servicePrice) })} />;
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

const styles = makeStyles(() => ({
  waiting: { marginTop: spacing.md, fontSize: 13, fontWeight: '700', color: colors.textMuted },
  card: { ...cardStyle(), marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  service: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  meta: { marginTop: spacing.md, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { marginLeft: 8, fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },
  actions: { flexDirection: 'row', marginTop: spacing.lg },
}));
