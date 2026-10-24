import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import DuoButton from './DuoButton';
import PressableScale from './PressableScale';
import { PriceItem } from '../types';
import { colors, radius, spacing } from '../theme';
import { feedback } from '../services/feedback';

/** Rascunho com o preço como texto, para o campo aceitar "45,50" enquanto digita. */
type Draft = { id: string; title: string; unit: string; price: string };

const toDraft = (items: PriceItem[]): Draft[] =>
  items.map((s) => ({ id: s.id, title: s.title, unit: s.unit, price: String(s.price).replace('.', ',') }));

const parsePrice = (v: string) => Number(v.replace(/\./g, '').replace(',', '.'));

/** Tabela de preços editável: muda nome, unidade e valor, adiciona e remove serviços. */
export default function PriceTableEditor({ items, onSave }: { items: PriceItem[]; onSave: (items: PriceItem[]) => void }) {
  const [draft, setDraft] = useState<Draft[]>(() => toDraft(items));
  useEffect(() => setDraft(toDraft(items)), [items]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(items));
  const patch = (id: string, p: Partial<Draft>) => setDraft((prev) => prev.map((d) => (d.id === id ? { ...d, ...p } : d)));

  const add = () => {
    feedback.select();
    setDraft((prev) => [...prev, { id: `s${Date.now()}`, title: '', unit: 'por serviço', price: '' }]);
  };

  const remove = (id: string) => {
    if (draft.length === 1) return feedback.error(); // precisa oferecer pelo menos 1 serviço
    feedback.tap();
    setDraft((prev) => prev.filter((d) => d.id !== id));
  };

  const save = () => {
    const invalid = draft.some((d) => d.title.trim().length < 2 || !(parsePrice(d.price) > 0));
    if (invalid) return feedback.error();
    onSave(draft.map((d) => ({ id: d.id, title: d.title.trim(), unit: d.unit.trim() || 'por serviço', price: parsePrice(d.price) })));
    feedback.success();
  };

  return (
    <Card>
      {draft.map((d) => {
        const priceOk = d.price === '' || parsePrice(d.price) > 0;
        return (
          <View key={d.id} style={styles.item}>
            <View style={{ flex: 1, gap: 6 }}>
              <TextInput
                value={d.title}
                onChangeText={(title) => patch(d.id, { title })}
                placeholder="Nome do serviço"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.title]}
              />
              <View style={styles.row}>
                <View style={[styles.input, styles.priceBox, !priceOk && { borderColor: colors.danger }]}>
                  <Text style={styles.currency}>R$</Text>
                  <TextInput
                    value={d.price}
                    onChangeText={(price) => patch(d.id, { price: price.replace(/[^\d,]/g, '') })}
                    placeholder="0,00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={styles.priceInput}
                  />
                </View>
                <TextInput
                  value={d.unit}
                  onChangeText={(unit) => patch(d.id, { unit })}
                  placeholder="por hora"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { flex: 1 }]}
                />
              </View>
            </View>
            <PressableScale sound="none" onPress={() => remove(d.id)} style={styles.trash}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </PressableScale>
          </View>
        );
      })}

      <PressableScale style={styles.add} onPress={add} sound="none">
        <Ionicons name="add-circle" size={20} color={colors.primary} />
        <Text style={styles.addText}>Adicionar serviço</Text>
      </PressableScale>

      {dirty && <DuoButton title="Salvar tabela" icon="checkmark" small onPress={save} sound="none" style={{ marginTop: spacing.md }} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', gap: 6 },
  input: {
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  title: { fontWeight: '800' },
  priceBox: { width: 110, flexDirection: 'row', alignItems: 'center' },
  currency: { fontWeight: '800', color: colors.textMuted, marginRight: 4 },
  priceInput: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.primaryDark, padding: 0 },
  trash: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: '#FFF1F3', alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  addText: { fontSize: 15, fontWeight: '800', color: colors.primary },
});
