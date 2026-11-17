import React, { useState } from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, makeStyles } from '../theme';
import { t } from '../i18n';

type Props = TextInputProps & { icon: keyof typeof Ionicons.glyphMap };

/** Campo com ícone. Com `secureTextEntry`, mostra o "olhinho" para ver/esconder a senha. */
export default function TextField({ icon, style, secureTextEntry, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={[styles.wrap, focused && { borderColor: colors.blue, backgroundColor: colors.blueLight }]}>
      <Ionicons name={icon} size={20} color={focused ? colors.blue : colors.textMuted} />
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        secureTextEntry={secureTextEntry && !visible}
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
      {secureTextEntry && (
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={visible ? t('field.hidePassword') : t('field.showPassword')}
          style={styles.eye}
        >
          <Ionicons name={visible ? 'eye-off' : 'eye'} size={22} color={focused ? colors.blue : colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '600', color: colors.text },
  eye: { paddingLeft: 10 },
}));
