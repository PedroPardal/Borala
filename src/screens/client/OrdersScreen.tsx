import React, { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
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
import { colors, radius, spacing, makeStyles } from '../../theme';
import { t } from '../../i18n';
import { feedback } from '../../services/feedback';

type Tab = 'upcoming' | 'history';

export default function OrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookings, getOrCreateConversation } = useApp();
  const [tab, setTab] = useState<Tab>('upcoming');

  const list = bookings
    .filter((b) => (tab === 'upcoming' ? b.status === 'pendente' || b.status === 'aceito' : b.status === 'concluido' || b.status === 'recusado'))
    .sort((a, b) => (tab === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  const openChat = async (b: Booking) => {
    try {
      const conversationId = await getOrCreateConversation(b);
      navigation.navigate('Chat', { conversationId });
    } catch {
      feedback.error();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('orders.title')}</Text>
        <View style={styles.segment}>
          {(['upcoming', 'history'] as Tab[]).map((id) => (
            <Pressable
              key={id}
              onPress={() => {
                feedback.select();
                setTab(id);
              }}
              style={[styles.segItem, tab === id && styles.segActive]}
            >
              <Text style={[styles.segText, tab === id && { color: colors.primary }]}>{id === 'upcoming' ? t('orders.upcoming') : t('orders.history')}</Text>
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
            title={tab === 'upcoming' ? t('orders.emptyUpcoming') : t('orders.emptyHistory')}
            subtitle={t('orders.emptySub')}
          />
        }
        renderItem={({ item, index }) => {
          const canReview = item.status === 'concluido' && !item.reviewed;
          return (
            <FadeInView delay={index * 70}>
              <RequestCard
                booking={item}
                title={item.providerName}
                avatar={item.providerAvatar}
                footer={
                  <View style={styles.actions}>
                    <DuoButton
                      small
                      variant="outline"
                      icon="chatbubble-ellipses"
                      title={t('common.message')}
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
                          title={t('orders.review')}
                          style={{ flex: 1 }}
                          onPress={() => navigation.navigate('Review', { bookingId: item.id })}
                        />
                      </>
                    )}
                  </View>
                }
              />
            </FadeInView>
          );
        }}
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
  segText: { fontWeight: '800', color: colors.textMuted },
  actions: { flexDirection: 'row', marginTop: spacing.lg },
}));
