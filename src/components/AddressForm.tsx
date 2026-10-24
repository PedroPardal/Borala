import React, { useState } from 'react';
import { View } from 'react-native';
import DuoButton from './DuoButton';
import TextField from './TextField';
import { Address } from '../types';
import { spacing } from '../theme';
import { feedback } from '../services/feedback';

/** Campos de um novo endereço. `onCancel` é opcional (no checkout sem endereço não há o que cancelar). */
export default function AddressForm({
  onSave,
  onCancel,
}: {
  onSave: (a: Address) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [label, setLabel] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!label.trim() || street.trim().length < 3 || !city.trim()) return feedback.error();
    setSaving(true);
    try {
      await onSave({ id: `a${Date.now()}`, label: label.trim(), street: street.trim(), city: city.trim() });
      feedback.success();
      setLabel('');
      setStreet('');
      setCity('');
    } catch {
      feedback.error();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <TextField icon="bookmark" placeholder="Nome (ex: Casa, Trabalho)" value={label} onChangeText={setLabel} />
      <TextField icon="home" placeholder="Rua, número e complemento" value={street} onChangeText={setStreet} />
      <TextField icon="business" placeholder="Bairro, Cidade - UF" value={city} onChangeText={setCity} />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {onCancel && <DuoButton title="Cancelar" variant="outline" small style={{ flex: 1 }} onPress={onCancel} />}
        <DuoButton title="Salvar endereço" icon="checkmark" small style={{ flex: 1 }} onPress={save} loading={saving} sound="none" />
      </View>
    </View>
  );
}
