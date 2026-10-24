import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import Avatar from './Avatar';
import RatingStars from './RatingStars';
import { cardStyle } from './Card';
import { Provider } from '../types';
import { categories } from '../data/categories';
import { colors, spacing } from '../theme';
import { formatBRL } from '../utils/format';

export default function ProviderCard({ provider, onPress }: { provider: Provider; onPress: () => void }) {
  const cats = categories.filter((c) => provider.categories.includes(c.id));
  return (
    <PressableScale onPress={onPress} style={styles.card} scaleTo={0.97}>
      <Avatar uri={provider.avatar} size={60} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {provider.name}
        </Text>
        {provider.reviewsCount > 0 ? (
          <RatingStars rating={provider.rating} showValue count={provider.reviewsCount} size={13} />
        ) : (
          <Text style={styles.newBadge}>Novo ✨</Text>
        )}
        <View style={styles.tags}>
          {cats.map((c) => (
            <View key={c.id} style={[styles.tag, { backgroundColor: `${c.color}1A` }]}>
              <Text style={[styles.tagText, { color: c.color }]}>{c.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <View style={styles.row}>
            <Ionicons name="location" size={14} color={colors.textMuted} />
            <Text style={styles.muted} numberOfLines={1}>
              {provider.distanceKm !== undefined ? `${provider.distanceKm.toFixed(1)} km` : provider.area ?? 'Sem localização'}
            </Text>
          </View>
          <Text style={styles.price}>
            <Text style={styles.muted}>a partir de </Text>
            {formatBRL(provider.basePrice)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { ...cardStyle, flexDirection: 'row', marginBottom: spacing.md },
  info: { flex: 1, marginLeft: spacing.md },
  name: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 6, marginBottom: 4 },
  tagText: { fontSize: 11, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: spacing.sm },
  newBadge: { fontSize: 12, fontWeight: '800', color: colors.primaryDark },
  muted: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginLeft: 2 },
  price: { fontSize: 15, fontWeight: '800', color: colors.primaryDark },
});
