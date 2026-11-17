import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

const ICONS: { name: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { name: 'construct', color: colors.primary },
  { name: 'star', color: colors.star },
  { name: 'flash', color: colors.blue },
  { name: 'location', color: colors.primary },
  { name: 'calendar', color: colors.blue },
  { name: 'chatbubble', color: colors.blue },
  { name: 'sparkles', color: colors.star },
  { name: 'briefcase', color: colors.primary },
];

/** Ícones de serviços (ferramentas, agenda, localização, avaliação) flutuando bem de leve no fundo. */
export default function FloatingDecor() {
  const items = useMemo(
    () =>
      ICONS.map((icon, i) => ({
        ...icon,
        // espalha pelas bordas da tela, longe do centro onde fica o conteúdo
        x: (i % 2 === 0 ? 0.04 + Math.random() * 0.18 : 0.74 + Math.random() * 0.18) * width,
        y: (0.06 + (i / ICONS.length) * 0.82) * height,
        size: 18 + Math.random() * 16,
        duration: 2600 + Math.random() * 2200,
        rotate: (Math.random() - 0.5) * 50,
      })),
    [],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((it, i) => (
        <Floater key={i} {...it} />
      ))}
    </View>
  );
}

function Floater({ name, color, x, y, size, duration, rotate }: (typeof ICONS)[number] & {
  x: number;
  y: number;
  size: number;
  duration: number;
  rotate: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: 0.12,
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${rotate}deg`, `${rotate + 18}deg`] }) },
        ],
      }}
    >
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}
