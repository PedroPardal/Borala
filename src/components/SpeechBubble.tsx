import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { colors, radius, makeStyles } from '../theme';

interface Props {
  text: string;
  /** de onde sai a "pontinha" do balão: de baixo (Mélo embaixo) ou da esquerda (Mélo ao lado) */
  tail?: 'bottom' | 'left';
  /** destaca o balão (ex.: Mélo avisando um erro) */
  tone?: 'normal' | 'alert';
  style?: StyleProp<ViewStyle>;
}

/**
 * Balão de fala do Mélo: aparece com um "pop" e escreve o texto letra por letra.
 * Tocar no balão mostra o texto inteiro na hora.
 */
export default function SpeechBubble({ text, tail = 'bottom', tone = 'normal', style }: Props) {
  const [shown, setShown] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setShown(0);
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 12 }).start();
    // velocidade da digitação: textos longos andam um pouco mais rápido
    const step = text.length > 90 ? 2 : 1;
    const id = setInterval(() => {
      setShown((n) => {
        if (n + step >= text.length) clearInterval(id);
        return Math.min(text.length, n + step);
      });
    }, 22);
    return () => clearInterval(id);
  }, [text, pop]);

  // contorno na cor do texto: escuro no tema claro, claro no tema escuro
  const border = tone === 'alert' ? colors.danger : colors.text;
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: pop,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        },
      ]}
    >
      <Pressable onPress={() => setShown(text.length)} style={[styles.bubble, { borderColor: border }]}>
        {/* o texto completo invisível reserva o espaço, para o balão não "pular" enquanto digita */}
        <Text style={[styles.text, styles.ghost]}>{text}</Text>
        <Text style={[styles.text, styles.typed, tone === 'alert' && { color: colors.danger }]}>{text.slice(0, shown)}</Text>
      </Pressable>
      <View
        style={[
          tail === 'bottom' ? styles.tailBottom : styles.tailLeft,
          { borderColor: border },
        ]}
      />
    </Animated.View>
  );
}

const styles = makeStyles(() => ({
  bubble: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.text },
  ghost: { opacity: 0 },
  typed: { position: 'absolute', left: 16, right: 16, top: 12 },
  // pontinha: um quadrado girado com duas bordas visíveis, por cima da borda do balão
  tailBottom: {
    position: 'absolute',
    bottom: -7,
    alignSelf: 'center',
    width: 16,
    height: 16,
    backgroundColor: colors.card,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    transform: [{ rotate: '45deg' }],
  },
  tailLeft: {
    position: 'absolute',
    left: -7,
    top: 22,
    width: 16,
    height: 16,
    backgroundColor: colors.card,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
}));
