import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import SettingsRow from './SettingsRow';
import { useSettings } from '../context/SettingsContext';
import { colors, makeStyles, radius, spacing, ThemePref } from '../theme';
import { LANGS, t } from '../i18n';
import { feedback, Sound } from '../services/feedback';

interface Option<T extends string> {
  id: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** Botões lado a lado em que só um fica marcado. */
export function Segmented<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              feedback.select();
              onChange(o.id);
            }}
            style={[styles.segItem, active && styles.segActive]}
          >
            {o.icon && <Ionicons name={o.icon} size={14} color={active ? colors.primary : colors.textMuted} />}
            <Text style={[styles.segText, active && { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Seletor de idioma com as bandeiras (também usado na tela de login). */
export function LanguagePicker() {
  const { lang, setLang } = useSettings();
  return <Segmented options={LANGS.map((l) => ({ id: l.id, label: `${l.flag} ${l.label}` }))} value={lang} onChange={setLang} />;
}

/** Preferências do aparelho: sons, idioma e tema. `children` entra no fim do cartão. */
export default function PreferencesCard({ children }: { children?: React.ReactNode }) {
  const { themePref, setThemePref } = useSettings();
  const [soundOn, setSoundOn] = useState(Sound.isEnabled());

  const themes: Option<ThemePref>[] = [
    { id: 'system', label: t('prefs.themeSystem'), icon: 'phone-portrait-outline' },
    { id: 'light', label: t('prefs.themeLight'), icon: 'sunny' },
    { id: 'dark', label: t('prefs.themeDark'), icon: 'moon' },
  ];

  return (
    <Card>
      <SettingsRow
        icon="volume-high"
        label={t('prefs.sound')}
        toggle={{
          value: soundOn,
          onChange: (v) => {
            Sound.setEnabled(v);
            setSoundOn(v);
          },
        }}
      />
      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Ionicons name="language" size={20} color={colors.text} />
          <Text style={styles.label}>{t('prefs.language')}</Text>
        </View>
        <LanguagePicker />
      </View>
      <View style={[styles.block, !children && { borderBottomWidth: 0 }]}>
        <View style={styles.blockHead}>
          <Ionicons name="contrast" size={20} color={colors.text} />
          <Text style={styles.label}>{t('prefs.theme')}</Text>
        </View>
        <Segmented options={themes} value={themePref} onChange={setThemePref} />
      </View>
      {children}
    </Card>
  );
}

const styles = makeStyles(() => ({
  block: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  segment: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 4 },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
  segActive: { backgroundColor: colors.card },
  segText: { fontWeight: '800', fontSize: 12, color: colors.textMuted, flexShrink: 1 },
}));
