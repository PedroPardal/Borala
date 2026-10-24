import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { formatBRL } from '../utils/format';

interface Bar {
  label: string;
  value: number;
}

/** Gráfico de barras simples com animação de crescimento em cascata. */
export default function BarChart({ data, height = 140 }: { data: Bar[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  // Obs.: se a quantidade de barras mudar, passe uma `key` diferente para remontar o gráfico.
  const anims = useRef(data.map(() => new Animated.Value(0))).current;

  const key = data.map((d) => d.value).join(',');
  useEffect(() => {
    anims.forEach((a) => a.setValue(0));
    Animated.stagger(
      50,
      anims.map((a) => Animated.spring(a, { toValue: 1, useNativeDriver: false, speed: 10, bounciness: 8 })),
    ).start();
  }, [key, anims]);

  const best = data.reduce((iMax, d, i, arr) => (d.value > arr[iMax].value ? i : iMax), 0);

  return (
    <View>
      <View style={[styles.row, { height }]}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 24);
          return (
            <View key={`${d.label}-${i}`} style={styles.col}>
              {i === best && d.value > 0 && <Text style={styles.top}>{formatBRL(d.value).replace(',00', '')}</Text>}
              <Animated.View
                style={[
                  styles.bar,
                  {
                    height: anims[i]?.interpolate({ inputRange: [0, 1], outputRange: [4, Math.max(4, h)] }) ?? 4,
                    backgroundColor: i === best ? colors.navy : d.value ? colors.primary : colors.border,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text key={`${d.label}-l-${i}`} style={styles.label}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '60%', borderRadius: 8 },
  top: { fontSize: 10, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  labels: { flexDirection: 'row', marginTop: 6 },
  label: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textMuted },
});
