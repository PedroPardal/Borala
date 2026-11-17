import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RequestCard from '../../components/RequestCard';
import DuoButton from '../../components/DuoButton';
import FadeInView from '../../components/FadeInView';
import EmptyState from '../../components/EmptyState';
import { useApp } from '../../context/AppContext';
import { Booking } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';

type Tab = 'upcoming' | 'history';

export default function OrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookings, getOrCreateConversation, setBookingStatus, reportProblem } = useApp();
  const [tab, setTab] = useState<Tab>('upcoming');

  const list = bookings
    .filter((b) => (tab === 'upcoming' ? b.status === 'pendente' || b.status === 'aceito' : !['pendente', 'aceito'].includes(b.status)))
    .sort((a, b) => (tab === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  const openChat = async (b: Booking) => {
    try {
      const conversationId = await getOrCreateConversation(b);
      navigation.navigate('Chat', { conversationId });
    } catch {
      feedback.error();
    }
  };

  const run = (p: Promise<void>) =>
    p.then(() => feedback.success()).catch((e) => {
      feedback.error();
      Alert.alert('Não foi possível atualizar', firebaseErrorMessage(e));
    });

  const cancel = (b: Booking) =>
    Alert.alert(
      'Cancelar pedido?',
      b.paymentStatus === 'pago' ? 'O valor pago é devolvido para você.' : 'O horário fica livre para outra pessoa.',
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Cancelar pedido', style: 'destructive', onPress: () => run(setBookingStatus(b, 'cancelado')) },
      ],
    );

  const confirmDone = (b: Booking) =>
    Alert.alert('O serviço foi feito?', 'Ao confirmar, o pagamento é liberado para o prestador.', [
      { text: 'Ainda não', style: 'cancel' },
      { text: 'Sim, foi feito', onPress: () => run(setBookingStatus(b, 'concluido')) },
    ]);

  const report = (b: Booking) =>
    Alert.alert(
      'Reportar problema',
      'O pedido fica em análise e o pagamento ao prestador é segurado até resolvermos. Conte o que aconteceu pelo chat com o prestador.',
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Reportar', style: 'destructive', onPress: () => run(reportProblem(b)) },
      ],
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Meus pedidos</Text>
        <View style={styles.segment}>
          {(['upcoming', 'history'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                feedback.select();
                setTab(t);
              }}
              style={[styles.segItem, tab === t && styles.segActive]}
            >
              <Text style={[styles.segText, tab === t && { color: colors.primary }]}>{t === 'upcoming' ? 'Próximos' : 'Histórico'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        key={tab}
        data={list}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        ListEmptyComponent={
          <EmptyState
            icon={tab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
            title={tab === 'upcoming' ? 'Nenhum serviço agendado' : 'Sem histórico ainda'}
            subtitle="Explore os prestadores perto de você e agende o primeiro!"
          />
        }
        renderItem={({ item, index }) => {
          const canReview = item.status === 'concluido' && !item.reviewed;
          const needsPayment = item.status === 'pendente' && item.payment !== 'dinheiro' && item.paymentStatus !== 'pago';
          const isAccepted = item.status === 'aceito' && !item.disputed;
          return (
            <FadeInView delay={index * 70}>
              <RequestCard
                booking={item}
                title={item.providerName}
                avatar={item.providerAvatar}
                footer={
                  <>
                  {(needsPayment || item.status === 'pendente' || isAccepted) && (
                    <View style={styles.actions}>
                      {needsPayment && (
                        <DuoButton
                          small
                          icon="flash"
                          title="Pagar agora"
                          style={{ flex: 1, marginRight: spacing.md }}
                          onPress={() => navigation.navigate('Payment', { bookingId: item.id })}
                        />
                      )}
                      {item.status === 'pendente' && (
                        <DuoButton small variant="outline" icon="close" title="Cancelar" style={{ flex: 1 }} onPress={() => cancel(item)} />
                      )}
                      {isAccepted && (
                        <>
                          <DuoButton
                            small
                            icon="checkmark-done"
                            title="Serviço feito"
                            style={{ flex: 1, marginRight: spacing.md }}
                            onPress={() => confirmDone(item)}
                          />
                          <DuoButton small variant="outline" icon="alert-circle" title="Problema" style={{ flex: 1 }} onPress={() => report(item)} />
                        </>
                      )}
                    </View>
                  )}
                  <View style={styles.actions}>
                    <DuoButton
                      small
                      variant="outline"
                      icon="chatbubble-ellipses"
                      title="Mensagem"
                      style={{ flex: 1 }}
                      onPress={() => openChat(item)}
                    />
                    {canReview && (
                      <>
                        <View style={{ width: spacing.md }} />
                        <DuoButton
                          small
                          variant="secondary"
                          icon="star"
                          title="Avaliar"
                          style={{ flex: 1 }}
                          onPress={() => navigation.navigate('Review', { bookingId: item.id })}
                        />
                      </>
                    )}
                  </View>
                  </>
                }
              />
            </FadeInView>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: spacing.md },
  segment: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segActive: { backgroundColor: colors.white },
  segText: { fontWeight: '800', color: colors.textMuted },
  actions: { flexDirection: 'row', marginTop: spacing.lg },
});
