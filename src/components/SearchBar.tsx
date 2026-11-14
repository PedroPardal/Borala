import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, makeStyles } from '../theme';
import { t } from '../i18n';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, placeholder = t('search.placeholder') }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={20} color={colors.borderDark} />
        </Pressable>
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '600', color: colors.text },
}));
