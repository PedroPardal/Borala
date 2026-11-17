import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Card from '../../components/Card';
import DuoButton from '../../components/DuoButton';
import EmptyState from '../../components/EmptyState';
import FadeInView from '../../components/FadeInView';
import { useApp } from '../../context/AppContext';
import { RootScreenProps } from '../../navigation/types';
import { PaymentView } from '../../types';
import { colors, radius, spacing } from '../../theme';
import { formatBRL, formatDateLong } from '../../utils/format';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';
import { createPayment } from '../../services/payments';

/**
 * Pagamento de um pedido por Pix ou cartão. A cobrança é criada pela Cloud Function createPayment;
 * a confirmação chega pelo webhook do Asaas, que muda booking.paymentStatus para 'pago'.
 */
export default function PaymentScreen({ route, navigation }: RootScreenProps<'Payment'>) {
  const insets = useSafeAreaInsets();
  const { bookings, setBookingStatus } = useApp();
  const booking = bookings.find((b) => b.id === route.params.bookingId);
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setError(null);
    createPayment(route.params.bookingId)
      .then(setPayment)
      .catch((e) => {
        feedback.error();
        setError(firebaseErrorMessage(e));
      });
  }, [route.params.bookingId]);

  useEffect(load, [load]);

  // pagamento confirmado: vai para a tela de sucesso
  const paid = booking?.paymentStatus === 'pago';
  useEffect(() => {
    if (!paid || !booking) return;
    navigation.reset({
      index: 1,
      routes: [
        { name: 'ClientTabs', params: { screen: 'Orders' } },
        { name: 'BookingSuccess', params: { bookingId: booking.id, payment: booking.payment } },
      ],
    });
  }, [paid, booking, navigation]);

  if (!booking) return <EmptyState icon="alert-circle-outline" title="Pedido não encontrado" />;

  if (booking.status === 'cancelado' || booking.status === 'recusado') {
    return (
      <EmptyState
        icon="close-circle-outline"
        title="Pedido cancelado"
        subtitle={booking.cancelledBy === 'sem_pagamento' ? 'O prazo de 30 minutos para pagar terminou. Faça um novo pedido.' : undefined}
      />
    );
  }

  const copy = async () => {
    if (!payment?.pixPayload) return;
    await Clipboard.setStringAsync(payment.pixPayload);
    feedback.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const cancel = () =>
    Alert.alert('Cancelar pedido?', 'O horário fica livre para outra pessoa.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: () =>
          setBookingStatus(booking, 'cancelado')
            .then(() => navigation.goBack())
            .catch((e) => Alert.alert('Não foi possível cancelar', firebaseErrorMessage(e))),
      },
    ]);

  const isPix = booking.payment === 'pix';

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        <FadeInView>
          <Card>
            <Text style={styles.bold}>{booking.serviceTitle}</Text>
            <Text style={styles.muted}>
              com {booking.providerName} • {formatDateLong(booking.date)} às {booking.time}
            </Text>
            <Text style={styles.total}>{formatBRL(payment?.value ?? booking.price)}</Text>
          </Card>
        </FadeInView>

        {error ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.errorText}>{error}</Text>
            <DuoButton title="Tentar de novo" icon="refresh" small style={{ marginTop: spacing.md }} onPress={load} />
          </Card>
        ) : !payment ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>Gerando a cobrança…</Text>
          </View>
        ) : isPix ? (
          <FadeInView delay={80}>
            <Card style={[styles.center, { marginTop: spacing.lg }]}>
              <Text style={styles.h}>Pague com Pix</Text>
              <Text style={[styles.muted, styles.centerText]}>Abra o app do seu banco, escolha Pix e leia o QR Code ou cole o código.</Text>
              {payment.pixImage ? (
                <Image source={{ uri: `data:image/png;base64,${payment.pixImage}` }} style={styles.qr} resizeMode="contain" />
              ) : null}
              <Text style={styles.payload} numberOfLines={3} selectable>
                {payment.pixPayload}
              </Text>
              <DuoButton
                title={copied ? 'Código copiado!' : 'Copiar código Pix'}
                icon={copied ? 'checkmark' : 'copy'}
                style={{ alignSelf: 'stretch', marginTop: spacing.md }}
                onPress={copy}
                sound="none"
              />
            </Card>
          </FadeInView>
        ) : (
          <FadeInView delay={80}>
            <Card style={[styles.center, { marginTop: spacing.lg }]}>
              <Ionicons name="card" size={40} color={colors.blue} />
              <Text style={styles.h}>Pague com cartão</Text>
              <Text style={[styles.muted, styles.centerText]}>
                O pagamento é feito na página segura do Asaas. Depois de pagar, volte para o app.
              </Text>
              <DuoButton
                title="Abrir página de pagamento"
                icon="open"
                style={{ alignSelf: 'stretch', marginTop: spacing.md }}
                onPress={() => Linking.openURL(payment.invoiceUrl)}
              />
            </Card>
          </FadeInView>
        )}

        {payment && !error && (
          <View style={styles.waiting}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.muted}>Aguardando a confirmação do pagamento…</Text>
          </View>
        )}
        <Text style={[styles.muted, styles.centerText, { marginTop: spacing.md }]}>
          Se o pagamento não for feito em 30 minutos, o pedido é cancelado. Se o prestador recusar, o valor é devolvido.
        </Text>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <DuoButton title="Cancelar pedido" variant="outline" onPress={cancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  bold: { fontSize: 16, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  total: { fontSize: 28, fontWeight: '900', color: colors.primaryDark, marginTop: spacing.sm },
  h: { fontSize: 18, fontWeight: '800', color: colors.text, marginVertical: spacing.sm },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  qr: { width: 220, height: 220, marginVertical: spacing.md },
  payload: {
    alignSelf: 'stretch',
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  loading: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
  errorText: { fontSize: 14, fontWeight: '700', color: colors.danger },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
});
