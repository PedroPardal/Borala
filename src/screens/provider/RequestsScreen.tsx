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
import { Booking, BookingStatus } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';

const TABS: { id: BookingStatus; label: string }[] = [
  { id: 'pendente', label: 'Pendentes' },
  { id: 'aceito', label: 'Aceitos' },
  { id: 'recusado', label: 'Recusados' },
];

export default function RequestsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookings, setBookingStatus, getOrCreateConversation } = useApp();
  const [tab, setTab] = useState<BookingStatus>('pendente');

  const list = bookings.filter((b) => b.status === tab).sort((a, b) => a.date.localeCompare(b.date));
  const count = (s: BookingStatus) => bookings.filter((b) => b.status === s).length;

  const openChat = async (b: Booking) => {
    try {
      const conversationId = await getOrCreateConversation(b);
      navigation.navigate('Chat', { conversationId });
    } catch {
      feedback.error();
    }
  };

  // o card some com animação; se a gravação falhar, avisa
  const changeStatus = (b: Booking, status: BookingStatus) =>
    setBookingStatus(b, status).catch((e) => {
      feedback.error();
      Alert.alert('Não foi possível atualizar', firebaseErrorMessage(e));
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Solicitações</Text>
        <View style={styles.segment}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => {
                feedback.select();
                setTab(t.id);
              }}
              style={[styles.segItem, tab === t.id && styles.segActive]}
            >
              <Text style={[styles.segText, tab === t.id && { color: colors.primary }]}>
                {t.label} {count(t.id) > 0 ? `(${count(t.id)})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        key={tab}
        data={list}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyState
            icon={tab === 'pendente' ? 'checkmark-done-circle-outline' : 'file-tray-outline'}
            title={tab === 'pendente' ? 'Tudo em dia! 🎉' : 'Nada por aqui'}
            subtitle={tab === 'pendente' ? 'Você respondeu todas as solicitações.' : undefined}
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={index * 80}>
            <RequestCard
              booking={item}
              title={item.clientName}
              avatar={item.clientAvatar}
              onAccept={() => {
                feedback.success();
                changeStatus(item, 'aceito');
              }}
              onDecline={() => {
                feedback.tap();
                changeStatus(item, 'recusado');
              }}
              footer={
                item.status === 'aceito' ? (
                  <View style={styles.actions}>
                    <DuoButton
                      small
                      variant="outline"
                      icon="chatbubble-ellipses"
                      title="Chat"
                      style={{ flex: 1 }}
                      onPress={() => openChat(item)}
                    />
                    <View style={{ width: spacing.md }} />
                    <DuoButton
                      small
                      icon="checkmark-done"
                      title="Concluir"
                      style={{ flex: 1 }}
                      sound="none"
                      onPress={() => {
                        feedback.celebrate();
                        changeStatus(item, 'concluido');
                      }}
                    />
                  </View>
                ) : null
              }
            />
          </FadeInView>
        )}
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
  segText: { fontWeight: '800', color: colors.textMuted, fontSize: 13 },
  actions: { flexDirection: 'row', marginTop: spacing.lg },
});
