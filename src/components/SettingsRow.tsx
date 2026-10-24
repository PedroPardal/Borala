import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { colors, spacing } from '../theme';
import { feedback } from '../services/feedback';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  color?: string;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
}

export default function SettingsRow({ icon, label, value, color = colors.text, onPress, toggle }: Props) {
  const content = (
    <>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
      {value && <Text style={styles.value}>{value}</Text>}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={(v) => {
            toggle.onChange(v);
            feedback.select();
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.white}
        />
      ) : (
        onPress && <Ionicons name="chevron-forward" size={18} color={colors.borderDark} />
      )}
    </>
  );
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={styles.row} scaleTo={0.98}>
        {content}
      </PressableScale>
    );
  }
  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  label: { flex: 1, fontSize: 15, fontWeight: '700' },
  value: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
});
