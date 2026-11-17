import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { colors, makeStyles } from '../theme';

/** Progresso do cadastro em segmentos: os já feitos ficam laranja e o atual se enche com animação. */
export default function StepProgress({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: current + 1 }}>
      {Array.from({ length: total }, (_, i) => (
        <Segment key={i} done={i < current} active={i === current} />
      ))}
    </View>
  );
}

function Segment({ done, active }: { done: boolean; active: boolean }) {
  const fill = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: done || active ? 1 : 0, duration: 350, useNativeDriver: false }).start();
  }, [done, active, fill]);
  return (
    <View style={styles.track}>
      <Animated.View
        style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
      />
    </View>
  );
}

const styles = makeStyles(() => ({
  row: { flex: 1, flexDirection: 'row', gap: 6, marginHorizontal: 16 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
}));
