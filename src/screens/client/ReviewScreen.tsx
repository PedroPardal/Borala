import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import RatingStars from '../../components/RatingStars';
import Chip from '../../components/Chip';
import DuoButton from '../../components/DuoButton';
import Confetti from '../../components/Confetti';
import { useApp } from '../../context/AppContext';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';

const LABELS = ['', 'Poxa… 😕', 'Pode melhorar', 'Bom!', 'Muito bom! 😄', 'Incrível! 🤩'];
const TAGS = ['Pontual', 'Caprichoso', 'Educado', 'Preço justo', 'Cuidadoso', 'Rápido'];

export default function ReviewScreen({ route, navigation }: RootScreenProps<'Review'>) {
  const insets = useSafeAreaInsets();
  const { bookings, addReview } = useApp();
  const booking = bookings.find((b) => b.id === route.params.bookingId);

  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);

  // o rótulo "pula" a cada nova nota
  const labelScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!rating) return;
    labelScale.setValue(0.7);
    Animated.spring(labelScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 18 }).start();
  }, [rating, labelScale]);

  const [sending, setSending] = useState(false);

  if (!booking) return null;

  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = async () => {
    if (!rating) {
      feedback.error();
      return;
    }
    const text = [tags.join(' • '), comment.trim()].filter(Boolean).join('\n');
    setSending(true);
    try {
      await addReview(booking, rating, text || 'Sem comentários.');
      setDone(true);
      feedback.celebrate();
      setTimeout(() => navigation.goBack(), 1800);
    } catch (e) {
      feedback.error();
      Alert.alert('Não foi possível enviar', firebaseErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center' }}>
          <Avatar uri={booking.providerAvatar} size={84} />
          <Text style={styles.title}>Como foi o serviço com {booking.providerName.split(' ')[0]}?</Text>
          <Text style={styles.muted}>{booking.serviceTitle}</Text>

          <View style={{ marginVertical: spacing.xl }}>
            <RatingStars rating={rating} size={44} onChange={setRating} />
          </View>
          <Animated.Text style={[styles.label, { transform: [{ scale: labelScale }] }]}>
            {rating ? LABELS[rating] : 'Toque nas estrelas'}
          </Animated.Text>
        </View>

        {rating > 0 && (
          <>
            <Text style={styles.h}>O que se destacou?</Text>
            <View style={styles.tags}>
              {TAGS.map((t) => (
                <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => toggleTag(t)} color={colors.blue} />
              ))}
            </View>
            <Text style={styles.h}>Deixe um comentário (opcional)</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              multiline
              placeholder="Conte como foi sua experiência…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </>
        )}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <DuoButton
          title={done ? 'Obrigado!' : 'Enviar avaliação'}
          variant="secondary"
          icon={done ? 'heart' : 'send'}
          disabled={!rating || done}
          loading={sending}
          onPress={submit}
          sound="none"
        />
      </View>
      {done && <Confetti />}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center', marginTop: spacing.lg },
  muted: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  label: { fontSize: 20, fontWeight: '900', color: colors.primary },
  h: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  input: {
    minHeight: 100,
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
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
});
