import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

type IconBase = 'compass' | 'receipt' | 'chatbubbles' | 'person' | 'stats-chart' | 'notifications';

/**
 * Ícone da tab bar que "pula" quando fica ativo.
 * `focused` deve vir de `navigation.isFocused()`: a tab bar desenha o ícone duas
 * vezes (camada ativa e inativa), então o `focused` dela nunca muda dentro de cada camada.
 */
export default function TabIcon({ name, focused, badge }: { name: IconBase; focused: boolean; badge?: number }) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: 14 }).start();
  }, [focused, scale]);

  const s = scale.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const ty = scale.interpolate({ inputRange: [0, 1], outputRange: [0, -1] });

  return (
    <Animated.View
      style={{
        width: 56,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.primaryLight : 'transparent',
        transform: [{ scale: s }, { translateY: ty }],
      }}
    >
      <Ionicons
        name={focused ? name : (`${name}-outline` as const)}
        size={22}
        color={focused ? colors.primary : colors.textMuted}
      />
      {!!badge && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: 8,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: colors.white,
            backgroundColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 10, fontWeight: '800' }}>{badge}</Text>
        </View>
      )}
    </Animated.View>
  );
}
