import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DuoButton from './DuoButton';
import TextField from './TextField';
import LocationMap from './LocationMap';
import { Address, GeoPoint } from '../types';
import { colors, spacing, makeStyles } from '../theme';
import { t } from '../i18n';
import { feedback } from '../services/feedback';
import { addressFromPosition, getCurrentPosition } from '../services/geo';

/**
 * Campos de um novo endereço. Ao abrir, pega o GPS e já preenche rua e cidade;
 * o pino no mapa pode ser arrastado para corrigir. `onCancel` é opcional
 * (no checkout sem endereço não há o que cancelar).
 */
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
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  // o usuário digitou na mão: o GPS não sobrescreve mais
  const typed = useRef({ street: false, city: false });
  // só a resposta da última busca vale (arrastar rápido o pino dispara várias)
  const lookup = useRef(0);

  const fillFrom = async (p: GeoPoint) => {
    const id = ++lookup.current;
    const found = await addressFromPosition(p);
    if (id !== lookup.current || !found) return;
    if (!typed.current.street && found.street) setStreet(found.street);
    if (!typed.current.city && found.city) setCity(found.city);
  };

  const locate = async () => {
    setLocating(true);
    setGpsFailed(false);
    const p = await getCurrentPosition();
    setLocating(false);
    if (!p) {
      setGpsFailed(true);
      return;
    }
    // pediu de novo pelo botão: volta a preencher pelo GPS
    typed.current = { street: false, city: false };
    setPoint(p);
    await fillFrom(p);
  };

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!label.trim() || street.trim().length < 3 || !city.trim()) return feedback.error();
    setSaving(true);
    try {
      await onSave({
        id: `a${Date.now()}`,
        label: label.trim(),
        street: street.trim(),
        city: city.trim(),
        ...(point ? { location: point } : {}),
      });
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
      <LocationMap
        center={point}
        draggable
        height={180}
        style={{ marginBottom: spacing.sm }}
        onChange={(p) => {
          setPoint(p);
          typed.current = { street: false, city: false };
          fillFrom(p);
        }}
      />
      <Pressable onPress={locate} disabled={locating} style={styles.gps} hitSlop={8}>
        {locating ? <ActivityIndicator size="small" color={colors.blue} /> : <Ionicons name="locate" size={16} color={colors.blue} />}
        <Text style={styles.gpsText}>
          {locating ? t('addr.locating') : gpsFailed ? t('addr.gpsFailed') : t('addr.useCurrent')}
        </Text>
      </Pressable>

      <TextField icon="bookmark" placeholder={t('addr.label')} value={label} onChangeText={setLabel} />
      <TextField
        icon="home"
        placeholder={t('addr.street')}
        value={street}
        onChangeText={(v) => {
          typed.current.street = true;
          setStreet(v);
        }}
      />
      <TextField
        icon="business"
        placeholder={t('addr.city')}
        value={city}
        onChangeText={(v) => {
          typed.current.city = true;
          setCity(v);
        }}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {onCancel && <DuoButton title={t('common.cancel')} variant="outline" small style={{ flex: 1 }} onPress={onCancel} />}
        <DuoButton title={t('addr.save')} icon="checkmark" small style={{ flex: 1 }} onPress={save} loading={saving} sound="none" />
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  gps: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  gpsText: { fontSize: 13, fontWeight: '800', color: colors.blue },
}));
