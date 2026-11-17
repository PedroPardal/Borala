import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, ImageSourcePropType, Pressable, StyleProp, ViewStyle } from 'react-native';
import { feedback } from '../services/feedback';

/** Poses do Mélo, o mascote do BoraLá (recortadas de assets/melo). `ratio` = largura / altura da imagem. */
const POSES = {
  acenando: { src: require('../../assets/melo/acenando.png'), ratio: 509 / 695 },
  trabalhando: { src: require('../../assets/melo/trabalhando.png'), ratio: 537 / 640 },
  andando: { src: require('../../assets/melo/andando.png'), ratio: 537 / 688 },
  comemorando: { src: require('../../assets/melo/comemorando.png'), ratio: 578 / 619 },
  atendendo: { src: require('../../assets/melo/atendendo.png'), ratio: 399 / 523 },
  pensando: { src: require('../../assets/melo/pensando.png'), ratio: 448 / 592 },
  dormindo: { src: require('../../assets/melo/dormindo.png'), ratio: 550 / 413 },
  feliz: { src: require('../../assets/melo/rosto-feliz.png'), ratio: 1 },
  focado: { src: require('../../assets/melo/rosto-focado.png'), ratio: 1 },
  curioso: { src: require('../../assets/melo/rosto-curioso.png'), ratio: 1 },
} satisfies Record<string, { src: ImageSourcePropType; ratio: number }>;

export type MeloPose = keyof typeof POSES;

interface Props {
  pose: MeloPose;
  /** altura em pontos; a largura segue a proporção da imagem */
  size: number;
  /** toque no Mélo: ele pula e chama o callback (ex.: dizer uma frase) */
  onPress?: () => void;
  /** flutua de leve enquanto está parado (padrão: sim) */
  float?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * O Mélo animado: entra com um "pop", flutua de leve, dá uma "amassadinha" quando muda de pose
 * e pula quando tocado. Tudo com Animated (roda no Expo Go).
 */
export default function Melo({ pose, size, onPress, float = true, style }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(1)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 14 }).start();
  }, [enter]);

  useEffect(() => {
    if (!float) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, float]);

  // muda de pose: amassa e volta com mola
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    squash.setValue(0.82);
    Animated.spring(squash, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 16 }).start();
  }, [pose, squash]);

  const hop = () => {
    feedback.select();
    jump.setValue(0);
    tilt.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(jump, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(jump, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 12 }),
      ]),
      Animated.sequence(
        [1, -1, 0.6, -0.6, 0].map((v) => Animated.timing(tilt, { toValue: v, duration: 70, useNativeDriver: true })),
      ),
    ]).start();
    onPress?.();
  };

  const { src, ratio } = POSES[pose];
  const w = size * ratio;

  return (
    <Pressable onPress={hop} disabled={!onPress} hitSlop={8} style={style} accessibilityRole="imagebutton" accessibilityLabel="Mélo">
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.04] }) },
            { translateY: jump.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.18] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            { scaleY: squash },
            { scaleX: squash.interpolate({ inputRange: [0.8, 1], outputRange: [1.1, 1] }) },
            { rotate: tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) },
          ],
        }}
      >
        <Image source={src} style={{ width: w, height: size }} resizeMode="contain" />
      </Animated.View>
    </Pressable>
  );
}
