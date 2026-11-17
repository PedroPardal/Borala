import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../components/Avatar';
import Card from '../../components/Card';
import DuoButton from '../../components/DuoButton';
import PressableScale from '../../components/PressableScale';
import FadeInView from '../../components/FadeInView';
import AddressForm from '../../components/AddressForm';
import EmptyState from '../../components/EmptyState';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, PriceItem, Provider } from '../../types';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { formatBRL, formatDateLong } from '../../utils/format';
import { MIN_PLATFORM_FEE, priceFor } from '../../utils/pricing';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';

const PIX_COLOR = '#32BCAD';

const METHODS: { id: PaymentMethod; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: 'pix', label: 'Pix', desc: 'Instantâneo, sem acréscimo', icon: 'flash', color: PIX_COLOR },
  { id: 'cartao', label: 'Cartão', desc: 'Crédito ou débito', icon: 'card', color: colors.blue },
  { id: 'dinheiro', label: 'Dinheiro', desc: 'Pague ao prestador', icon: 'cash', color: colors.primary },
];

export default function CheckoutScreen(props: RootScreenProps<'Checkout'>) {
  const { getProvider } = useApp();
  const provider = getProvider(props.route.params.providerId);
  const service = provider?.priceTable.find((s) => s.id === props.route.params.serviceId);
  if (!provider || !service) {
    return <EmptyState icon="alert-circle-outline" title="Serviço indisponível" subtitle="O prestador alterou ou removeu esse serviço." />;
  }
  return <Checkout {...props} provider={provider} service={service} />;
}

function Checkout({ route, navigation, provider, service }: RootScreenProps<'Checkout'> & { provider: Provider; service: PriceItem }) {
  const insets = useSafeAreaInsets();
  const { createBooking, profile, updateProfile } = useApp();
  const { date, time } = route.params;
  const addresses = profile?.addresses ?? [];

  // Pix e cartão só com prestador que tem conta de recebimento; dinheiro some quando ele passou do
  // limite de comissões (as regras do Firestore recusariam o pedido nos dois casos)
  const methods = useMemo(
    () => METHODS.filter((m) => (m.id === 'dinheiro' ? !provider.blockedForDebt : !!provider.acceptsOnlinePayment)),
    [provider.blockedForDebt, provider.acceptsOnlinePayment],
  );
  const [payment, setPayment] = useState<PaymentMethod>(methods[0]?.id ?? 'pix');
  useEffect(() => {
    if (methods.length > 0 && !methods.some((m) => m.id === payment)) setPayment(methods[0].id);
  }, [methods, payment]);
  const online = payment !== 'dinheiro';
  const [cpf, setCpf] = useState(profile?.cpf ?? '');
  const cpfDigits = cpf.replace(/\D/g, '');
  const cpfOk = !online || cpfDigits.length === 11 || cpfDigits.length === 14;
  const [addressId, setAddressId] = useState(addresses[0]?.id);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const price = priceFor(service.price, payment);
  const total = price.total;
  // quanto o cliente economiza escolhendo Pix em vez de cartão
  const pixSavings = priceFor(service.price, 'cartao').total - priceFor(service.price, 'pix').total;
  const address = addresses.find((a) => a.id === addressId) ?? addresses[0];

  const canConfirm = !!address && methods.length > 0 && cpfOk;

  const confirm = async () => {
    if (!canConfirm) return feedback.error();
    setLoading(true);
    try {
      // o Asaas exige CPF/CNPJ de quem paga; fica salvo no perfil privado
      if (online && cpfDigits !== profile?.cpf) await updateProfile({ cpf: cpfDigits });
      const bookingId = await createBooking({
        provider,
        service,
        date,
        time,
        address: `${address.street} - ${address.city}`,
        payment,
        price: total,
        platformFee: price.fee,
        notes: notes.trim() || undefined,
      });
      // substitui a pilha de agendamento pela tela de pagamento (Pix/cartão) ou de sucesso (dinheiro)
      navigation.reset({
        index: 1,
        routes: [
          { name: 'ClientTabs', params: { screen: 'Orders' } },
          online ? { name: 'Payment', params: { bookingId } } : { name: 'BookingSuccess', params: { bookingId, payment } },
        ],
      });
    } catch (e) {
      setLoading(false);
      feedback.error();
      const code = (e as { code?: string }).code;
      // o id do horário já existe: alguém reservou primeiro
      Alert.alert(
        code === 'permission-denied' ? 'Horário indisponível' : 'Não foi possível agendar',
        code === 'permission-denied' ? 'Esse horário acabou de ser reservado. Escolha outro.' : firebaseErrorMessage(e),
      );
      if (code === 'permission-denied') navigation.goBack();
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
        <FadeInView>
          <Card style={styles.providerRow}>
            <Avatar uri={provider.avatar} size={48} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.bold}>{service.title}</Text>
              <Text style={styles.muted}>com {provider.name}</Text>
              <View style={styles.when}>
                <Ionicons name="calendar" size={14} color={colors.primary} />
                <Text style={styles.whenText}>
                  {formatDateLong(date)} às {time}
                </Text>
              </View>
            </View>
          </Card>
        </FadeInView>

        <FadeInView delay={60}>
          <Text style={styles.h}>Endereço</Text>
          {addresses.length === 0 && (
            <Card>
              <Text style={[styles.muted, { marginBottom: spacing.md }]}>Onde o serviço vai ser feito?</Text>
              <AddressForm
                onSave={async (a) => {
                  await updateProfile({ addresses: [a] });
                  setAddressId(a.id);
                }}
              />
            </Card>
          )}
          {addresses.map((a) => {
            const active = a.id === addressId;
            return (
              <PressableScale key={a.id} sound="select" onPress={() => setAddressId(a.id)} style={[styles.option, active && styles.optionActive]}>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? colors.primary : colors.borderDark} />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={styles.bold}>{a.label}</Text>
                  <Text style={styles.muted}>
                    {a.street} • {a.city}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </FadeInView>

        <FadeInView delay={120}>
          <Text style={styles.h}>Pagamento</Text>
          <View style={styles.methods}>
            {methods.map((m) => {
              const active = m.id === payment;
              return (
                <PressableScale
                  key={m.id}
                  sound="select"
                  onPress={() => setPayment(m.id)}
                  style={[styles.method, active && { borderColor: m.color, backgroundColor: `${m.color}14` }]}
                >
                  {m.id === 'pix' && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Mais barato</Text>
                    </View>
                  )}
                  <View style={[styles.methodIcon, { backgroundColor: active ? m.color : colors.border }]}>
                    <Ionicons name={m.icon} size={22} color={colors.white} />
                  </View>
                  <Text style={styles.bold}>{m.label}</Text>
                  <Text style={[styles.muted, { textAlign: 'center', fontSize: 11 }]}>{m.desc}</Text>
                </PressableScale>
              );
            })}
          </View>
          {methods.length === 0 && (
            <Text style={styles.muted}>Este prestador não está recebendo pedidos no momento. Tente outro prestador.</Text>
          )}
          {!provider.acceptsOnlinePayment && methods.length > 0 && (
            <Text style={[styles.muted, { marginTop: spacing.sm }]}>Este prestador ainda não recebe por Pix ou cartão.</Text>
          )}
          {online && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[styles.muted, { marginBottom: 6 }]}>CPF ou CNPJ de quem paga (exigido para Pix e cartão)</Text>
              <TextInput
                value={cpf}
                onChangeText={(v) => setCpf(v.replace(/[^\d./-]/g, ''))}
                placeholder="000.000.000-00"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={18}
                style={[styles.cpf, !cpfOk && cpf.length > 0 && { borderColor: colors.danger }]}
              />
            </View>
          )}
          {payment === 'cartao' && pixSavings > 0 && (
            <PressableScale sound="select" onPress={() => setPayment('pix')} style={styles.pixTip}>
              <Ionicons name="flash" size={18} color={PIX_COLOR} />
              <Text style={styles.pixTipText}>
                Pague com Pix e economize {formatBRL(pixSavings)}. <Text style={styles.pixTipLink}>Usar Pix</Text>
              </Text>
            </PressableScale>
          )}
        </FadeInView>

        <FadeInView delay={180}>
          <Text style={styles.h}>Observações</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex.: portão azul, tem cachorro, levar escada…"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.notes}
          />
        </FadeInView>

        <FadeInView delay={240}>
          <Card style={{ marginTop: spacing.xl }}>
            <Row label={service.title} value={formatBRL(service.price)} />
            <Row label={price.minFeeApplied ? `Taxa da plataforma (mínimo ${formatBRL(MIN_PLATFORM_FEE)})` : 'Taxa da plataforma'} value={formatBRL(price.fee)} />
            {price.surcharge > 0 && <Row label="Acréscimo do cartão" value={formatBRL(price.surcharge)} />}
            <View style={styles.divider} />
            <Row label="Total estimado" value={formatBRL(total)} strong />
          </Card>
        </FadeInView>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <DuoButton
          title={!address ? 'Adicione um endereço' : !cpfOk ? 'Informe o CPF' : online ? `Ir para o pagamento • ${formatBRL(total)}` : `Confirmar • ${formatBRL(total)}`}
          icon="checkmark-circle"
          disabled={!canConfirm}
          loading={loading}
          onPress={confirm}
          sound="none"
        />
      </View>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={strong ? styles.totalLabel : styles.muted}>{label}</Text>
      <Text style={strong ? styles.totalValue : styles.bold}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  providerRow: { flexDirection: 'row', alignItems: 'center' },
  bold: { fontSize: 15, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  when: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  whenText: { marginLeft: 6, fontWeight: '700', color: colors.primaryDark, fontSize: 13 },
  h: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  methods: { flexDirection: 'row', gap: spacing.sm, paddingTop: 10 },
  method: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
  },
  badge: {
    position: 'absolute',
    top: -10,
    backgroundColor: PIX_COLOR,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '900', color: colors.white },
  pixTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: PIX_COLOR,
    backgroundColor: `${PIX_COLOR}14`,
  },
  pixTipText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  pixTipLink: { color: PIX_COLOR, fontWeight: '900' },
  methodIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  cpf: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  notes: {
    minHeight: 90,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  divider: { height: 2, backgroundColor: colors.border, marginVertical: spacing.sm },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '900', color: colors.primaryDark },
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
