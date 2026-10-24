import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../components/Avatar';
import PressableScale from '../../components/PressableScale';
import { useApp } from '../../context/AppContext';
import { useMessages } from '../../context/hooks';
import { ChatMessage } from '../../types';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { feedback } from '../../services/feedback';
import { formatChatTime } from '../../utils/format';

const QUICK_REPLIES = ['Qual o valor final?', 'Precisa de algum material?', 'Tenho cachorro em casa 🐶', 'Combinado! 👍'];

/** Bolha de mensagem que entra com um "pop" de mola. */
function Bubble({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }).start();
  }, [v]);
  return (
    <Animated.View
      style={[
        styles.bubble,
        mine ? styles.mine : styles.theirs,
        {
          opacity: v,
          transform: [
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.bubbleText, mine && { color: colors.white }]}>{msg.text}</Text>
      <Text style={[styles.bubbleTime, mine && { color: 'rgba(255,255,255,0.8)' }]}>{formatChatTime(msg.createdAt)}</Text>
    </Animated.View>
  );
}

export default function ChatScreen({ route, navigation }: RootScreenProps<'Chat'>) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { session, conversations, sendMessage } = useApp();
  const conv = conversations.find((c) => c.id === route.params.conversationId);
  const messages = useMessages(conv?.id);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const isClient = session?.role === 'client';
  const otherName = isClient ? conv?.providerName : conv?.clientName;
  const otherAvatar = isClient ? conv?.providerAvatar : conv?.clientAvatar;

  // toca o som quando chega mensagem nova do outro lado (não na carga inicial)
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (seen.current !== null && messages.length > seen.current && messages[messages.length - 1].senderId !== session?.uid) {
      feedback.message();
    }
    seen.current = messages.length;
  }, [messages, session?.uid]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar uri={otherAvatar} size={30} />
          <View style={{ marginLeft: 8 }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>{otherName ?? 'Conversa'}</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>{isClient ? 'Prestador' : 'Cliente'}</Text>
          </View>
        </View>
      ),
    });
  }, [navigation, otherName, otherAvatar, isClient]);

  if (!conv) {
    return (
      <View style={[styles.flex, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const send = (value: string) => {
    const t = value.trim();
    if (!t) return;
    setText('');
    feedback.message();
    sendMessage(conv, t).catch(() => {
      feedback.error();
      setText(t); // devolve o texto para tentar de novo
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View style={styles.notice}>
            <Ionicons name="shield-checkmark" size={16} color={colors.primaryDark} />
            <Text style={styles.noticeText}>Combine os detalhes por aqui. Nunca pague fora do app.</Text>
          </View>
        }
        renderItem={({ item }) => <Bubble msg={item} mine={item.senderId === session?.uid} />}
      />

      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
        <FlatList
          horizontal
          data={QUICK_REPLIES}
          keyExtractor={(q) => q}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 8 }}
          renderItem={({ item }) => (
            <PressableScale style={styles.quick} onPress={() => send(item)} sound="none">
              <Text style={styles.quickText}>{item}</Text>
            </PressableScale>
          )}
        />
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escreva uma mensagem…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            onSubmitEditing={() => send(text)}
            returnKeyType="send"
          />
          <PressableScale
            sound="none"
            onPress={() => send(text)}
            style={[styles.sendBtn, !text.trim() && { backgroundColor: colors.border, borderBottomColor: colors.borderDark }]}
          >
            <Ionicons name="send" size={20} color={colors.white} />
          </PressableScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  noticeText: { marginLeft: 8, fontSize: 12, fontWeight: '700', color: colors.primaryDark, flex: 1 },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.blue, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, fontWeight: '600', color: colors.text },
  bubbleTime: { fontSize: 10, fontWeight: '600', color: colors.textMuted, alignSelf: 'flex-end', marginTop: 4 },
  composer: { backgroundColor: colors.white, borderTopWidth: 2, borderTopColor: colors.border, paddingTop: 10 },
  quick: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.blue,
    marginRight: 8,
    backgroundColor: colors.blueLight,
  },
  quickText: { fontWeight: '700', color: colors.blueDark, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.blue,
    borderBottomWidth: 4,
    borderBottomColor: colors.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
