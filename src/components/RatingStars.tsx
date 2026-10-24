import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { feedback } from '../services/feedback';

interface Props {
  rating: number;
  size?: number;
  showValue?: boolean;
  count?: number;
  /** Se informado, as estrelas ficam interativas */
  onChange?: (value: number) => void;
}

function Star({ filled, half, size, onPress, index }: { filled: boolean; half: boolean; size: number; onPress?: (i: number) => void; index: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const icon = filled ? 'star' : half ? 'star-half' : 'star-outline';

  const handlePress = () => {
    scale.setValue(0.6);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 18 }).start();
    onPress?.(index + 1);
  };

  const content = (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={icon} size={size} color={filled || half ? colors.star : colors.borderDark} />
    </Animated.View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={handlePress} hitSlop={6} style={{ marginHorizontal: 4 }}>
      {content}
    </Pressable>
  );
}

export default function RatingStars({ rating, size = 14, showValue, count, onChange }: Props) {
  return (
    <View style={styles.row}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          index={i}
          size={size}
          filled={rating >= i + 1}
          half={!onChange && rating > i && rating < i + 1}
          onPress={
            onChange
              ? (v) => {
                  feedback.select();
                  onChange(v);
                }
              : undefined
          }
        />
      ))}
      {showValue && (
        <Text style={[styles.value, { fontSize: size }]}>
          {rating.toFixed(1)}
          {count !== undefined && <Text style={styles.count}> ({count})</Text>}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: { marginLeft: 6, fontWeight: '800', color: colors.text },
  count: { fontWeight: '500', color: colors.textMuted },
});
