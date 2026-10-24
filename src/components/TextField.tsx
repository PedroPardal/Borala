import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

type Props = TextInputProps & { icon: keyof typeof Ionicons.glyphMap };

export default function TextField({ icon, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, focused && { borderColor: colors.blue, backgroundColor: colors.blueLight }]}>
      <Ionicons name={icon} size={20} color={focused ? colors.blue : colors.textMuted} />
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '600', color: colors.text },
});
