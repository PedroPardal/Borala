import React, { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
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
import { colors, radius, spacing, makeStyles } from '../../theme';
import { t, TKey } from '../../i18n';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';

const TABS: { id: BookingStatus; label: TKey }[] = [
  { id: 'pendente', label: 'req.pending' },
  { id: 'aceito', label: 'req.accepted' },
  { id: 'recusado', label: 'req.declined' },
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
      Alert.alert(t('req.updateFailed'), firebaseErrorMessage(e));
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('req.title')}</Text>
        <View style={styles.segment}>
          {TABS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                feedback.select();
                setTab(item.id);
              }}
              style={[styles.segItem, tab === item.id && styles.segActive]}
            >
              <Text style={[styles.segText, tab === item.id && { color: colors.primary }]}>
                {t(item.label)} {count(item.id) > 0 ? `(${count(item.id)})` : ''}
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
            title={tab === 'pendente' ? t('req.allDone') : t('req.empty')}
            subtitle={tab === 'pendente' ? t('req.allDoneSub') : undefined}
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
                      title={t('common.chat')}
                      style={{ flex: 1 }}
                      onPress={() => openChat(item)}
                    />
                    <View style={{ width: spacing.md }} />
                    <DuoButton
                      small
                      icon="checkmark-done"
                      title={t('req.complete')}
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

const styles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: spacing.md },
  segment: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segActive: { backgroundColor: colors.card },
  segText: { fontWeight: '800', color: colors.textMuted, fontSize: 13 },
  actions: { flexDirection: 'row', marginTop: spacing.lg },
}));
