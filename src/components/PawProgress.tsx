import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/** Progresso em "patinhas": as já percorridas ficam laranja e a nova dá um pulinho. */
export default function PawProgress({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <Paw key={i} done={i <= current} active={i === current} />
      ))}
    </View>
  );
}

function Paw({ done, active }: { done: boolean; active: boolean }) {
  const s = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(s, { toValue: done ? 1 : 0, useNativeDriver: true, speed: 14, bounciness: 18 }).start();
  }, [done, s]);
  return (
    <Animated.View
      style={{
        transform: [
          { scale: s.interpolate({ inputRange: [0, 1], outputRange: [0.8, active ? 1.25 : 1] }) },
          { rotate: s.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '0deg'] }) },
        ],
      }}
    >
      <Ionicons name="paw" size={18} color={done ? colors.primary : colors.border} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
