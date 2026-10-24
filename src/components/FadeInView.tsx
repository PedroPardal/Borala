import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

interface Props {
  delay?: number;
  /** deslocamento vertical inicial */
  from?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** Entrada suave (fade + slide + leve escala). Use `delay` para efeito em cascata. */
export default function FadeInView({ delay = 0, from = 16, style, children }: Props) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay, useNativeDriver: true, speed: 14, bounciness: 6 }).start();
  }, [delay, v]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
