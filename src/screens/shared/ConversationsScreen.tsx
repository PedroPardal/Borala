import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from '../../components/Avatar';
import PressableScale from '../../components/PressableScale';
import FadeInView from '../../components/FadeInView';
import EmptyState from '../../components/EmptyState';
import { useApp } from '../../context/AppContext';
import { RootStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { formatChatTime } from '../../utils/format';

export default function ConversationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, conversations } = useApp();
  const isClient = session?.role === 'client';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Mensagens</Text>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="Nenhuma conversa"
            subtitle={isClient ? 'Inicie um chat pelo perfil de um prestador.' : 'Os clientes podem te chamar pelo seu perfil.'}
          />
        }
        renderItem={({ item, index }) => {
          const name = isClient ? item.providerName : item.clientName;
          const avatar = isClient ? item.providerAvatar : item.clientAvatar;
          const last = item.lastMessage;
          // sem confirmação de leitura: destaca quando a última mensagem é do outro lado
          const fromOther = !!last && last.senderId !== session?.uid;
          return (
            <FadeInView delay={index * 60}>
              <PressableScale style={styles.row} onPress={() => navigation.navigate('Chat', { conversationId: item.id })}>
                <Avatar uri={avatar} size={50} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={[styles.preview, fromOther && { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
                    {last ? last.text : 'Diga olá 👋'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.time}>{last ? formatChatTime(last.createdAt) : ''}</Text>
                  {fromOther && <View style={styles.dot} />}
                </View>
              </PressableScale>
            </FadeInView>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  preview: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: 2 },
  time: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue, marginTop: 6 },
});
