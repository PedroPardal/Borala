import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import DuoButton from './DuoButton';
import PressableScale from './PressableScale';
import { PortfolioItem } from '../types';
import { colors, radius, spacing } from '../theme';
import { feedback } from '../services/feedback';
import { pickImage } from '../services/pickImage';
import { firebaseErrorMessage } from '../services/firebase';

const MAX_ITEMS = 6;

interface Props {
  items: PortfolioItem[];
  /** envia a foto local e devolve a URL salva */
  upload: (name: string, localUri: string) => Promise<string>;
  onChange: (items: PortfolioItem[]) => Promise<void>;
}

function PhotoSlot({ label, uri, onPick }: { label: string; uri: string | null; onPick: () => void }) {
  return (
    <PressableScale style={styles.slot} onPress={onPick}>
      {uri ? (
        <Image source={{ uri }} style={styles.slotImg} />
      ) : (
        <View style={styles.slotEmpty}>
          <Ionicons name="image-outline" size={26} color={colors.textMuted} />
        </View>
      )}
      <Text style={styles.slotLabel}>{label}</Text>
    </PressableScale>
  );
}

/** Fotos de "antes e depois" do prestador, salvas no Firebase Storage. */
export default function PortfolioEditor({ items, upload, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setAdding(false);
    setTitle('');
    setBefore(null);
    setAfter(null);
  };

  const save = async () => {
    if (title.trim().length < 2 || !before || !after) return feedback.error();
    setSaving(true);
    try {
      const id = `pf${Date.now()}`;
      const [beforeUrl, afterUrl] = await Promise.all([upload(`${id}-antes`, before), upload(`${id}-depois`, after)]);
      await onChange([...items, { id, title: title.trim(), before: beforeUrl, after: afterUrl }]);
      feedback.success();
      reset();
    } catch (e) {
      feedback.error();
      Alert.alert('Não foi possível salvar', firebaseErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string) => {
    Alert.alert('Remover trabalho?', 'As fotos saem do seu perfil.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => onChange(items.filter((i) => i.id !== id)).catch(() => feedback.error()),
      },
    ]);
  };

  return (
    <Card>
      {items.length === 0 && !adding && (
        <Text style={styles.hint}>Mostre fotos de antes e depois dos seus trabalhos. Clientes confiam mais em quem tem portfólio.</Text>
      )}
      {items.map((i) => (
        <View key={i.id} style={styles.item}>
          <Image source={{ uri: i.before }} style={styles.thumb} />
          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
          <Image source={{ uri: i.after }} style={styles.thumb} />
          <Text style={styles.itemTitle} numberOfLines={2}>
            {i.title}
          </Text>
          <PressableScale sound="none" onPress={() => remove(i.id)} style={styles.trash}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </PressableScale>
        </View>
      ))}

      {adding ? (
        <View style={{ marginTop: spacing.md }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Título (ex: Quintal limpo)"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <View style={styles.slots}>
            <PhotoSlot label="Antes" uri={before} onPick={async () => setBefore((await pickImage('gallery', [4, 3])) ?? before)} />
            <PhotoSlot label="Depois" uri={after} onPick={async () => setAfter((await pickImage('gallery', [4, 3])) ?? after)} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <DuoButton title="Cancelar" variant="outline" small style={{ flex: 1 }} onPress={reset} disabled={saving} />
            <DuoButton title="Salvar" icon="cloud-upload" small style={{ flex: 1 }} onPress={save} loading={saving} sound="none" />
          </View>
        </View>
      ) : (
        items.length < MAX_ITEMS && (
          <PressableScale style={styles.add} onPress={() => setAdding(true)} sound="none">
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={styles.addText}>Adicionar trabalho</Text>
          </PressableScale>
        )
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 14, fontWeight: '600', color: colors.textMuted, lineHeight: 20 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumb: { width: 52, height: 40, borderRadius: 8, backgroundColor: colors.border },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.text },
  trash: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: '#FFF1F3', alignItems: 'center', justifyContent: 'center' },
  input: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  slots: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.md },
  slot: { flex: 1, alignItems: 'center' },
  slotImg: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md },
  slotEmpty: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: { marginTop: 6, fontSize: 13, fontWeight: '800', color: colors.textMuted },
  add: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  addText: { fontSize: 15, fontWeight: '800', color: colors.primary },
});
