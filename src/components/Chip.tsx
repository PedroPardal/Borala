import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { colors, radius } from '../theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
}

/** Chip selecionável (categorias, horários, métodos de pagamento...) */
export default function Chip({ label, selected, onPress, icon, color = colors.primary }: Props) {
  return (
    <PressableScale
      sound="select"
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: color, borderColor: color, borderBottomColor: 'rgba(0,0,0,0.25)' }
          : { backgroundColor: colors.white },
      ]}
    >
      {icon && <Ionicons name={icon} size={16} color={selected ? colors.white : color} style={{ marginRight: 6 }} />}
      <Text style={[styles.text, { color: selected ? colors.white : colors.text }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  text: { fontWeight: '700', fontSize: 14 },
});
