import React, { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import DuoButton from './DuoButton';
import PressableScale from './PressableScale';
import Photo from './Photo';
import { PortfolioItem } from '../types';
import { colors, makeStyles, radius, spacing } from '../theme';
import { feedback } from '../services/feedback';
import { pickImage } from '../services/pickImage';
import { firebaseErrorMessage } from '../services/firebase';
import { deletePhoto } from '../services/photos';
import { t } from '../i18n';

const MAX_ITEMS = 6;
/** largura máxima das fotos de antes/depois, em pixels */
const PHOTO_WIDTH = 960;

interface Props {
  items: PortfolioItem[];
  /** salva a foto escolhida e devolve a referência para gravar no perfil */
  upload: (photo: string) => Promise<string>;
  onChange: (items: PortfolioItem[]) => Promise<void>;
}

function PhotoSlot({ label, uri, onPick }: { label: string; uri: string | null; onPick: () => void }) {
  return (
    <PressableScale style={styles.slot} onPress={onPick}>
      {uri ? (
        <Photo uri={uri} style={styles.slotImg} />
      ) : (
        <View style={styles.slotEmpty}>
          <Ionicons name="image-outline" size={26} color={colors.textMuted} />
        </View>
      )}
      <Text style={styles.slotLabel}>{label}</Text>
    </PressableScale>
  );
}

/** Fotos de "antes e depois" do prestador. */
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

  const pick = async (set: (uri: string) => void) => {
    const uri = await pickImage('gallery', [4, 3], PHOTO_WIDTH);
    if (uri) set(uri);
  };

  const save = async () => {
    if (title.trim().length < 2 || !before || !after) return feedback.error();
    setSaving(true);
    try {
      const [beforeRef, afterRef] = await Promise.all([upload(before), upload(after)]);
      await onChange([...items, { id: `pf${Date.now()}`, title: title.trim(), before: beforeRef, after: afterRef }]);
      feedback.success();
      reset();
    } catch (e) {
      feedback.error();
      Alert.alert(t('common.couldNotSave'), firebaseErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: PortfolioItem) => {
    Alert.alert(t('pf.removeTitle'), t('pf.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: () =>
          onChange(items.filter((i) => i.id !== item.id))
            .then(() => {
              // as fotos só eram usadas aqui: apaga do banco também
              deletePhoto(item.before);
              deletePhoto(item.after);
            })
            .catch(() => feedback.error()),
      },
    ]);
  };

  return (
    <Card>
      {items.length === 0 && !adding && <Text style={styles.hint}>{t('pf.hint')}</Text>}
      {items.map((i) => (
        <View key={i.id} style={styles.item}>
          <Photo uri={i.before} style={styles.thumb} />
          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
          <Photo uri={i.after} style={styles.thumb} />
          <Text style={styles.itemTitle} numberOfLines={2}>
            {i.title}
          </Text>
          <PressableScale sound="none" onPress={() => remove(i)} style={styles.trash}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </PressableScale>
        </View>
      ))}

      {adding ? (
        <View style={{ marginTop: spacing.md }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('pf.titlePh')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <View style={styles.slots}>
            <PhotoSlot label={t('pf.before')} uri={before} onPick={() => pick(setBefore)} />
            <PhotoSlot label={t('pf.after')} uri={after} onPick={() => pick(setAfter)} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <DuoButton title={t('common.cancel')} variant="outline" small style={{ flex: 1 }} onPress={reset} disabled={saving} />
            <DuoButton title={t('common.save')} icon="cloud-upload" small style={{ flex: 1 }} onPress={save} loading={saving} sound="none" />
          </View>
        </View>
      ) : (
        items.length < MAX_ITEMS && (
          <PressableScale style={styles.add} onPress={() => setAdding(true)} sound="none">
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={styles.addText}>{t('pf.add')}</Text>
          </PressableScale>
        )
      )}
    </Card>
  );
}

const styles = makeStyles(() => ({
  hint: { fontSize: 14, fontWeight: '600', color: colors.textMuted, lineHeight: 20 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumb: { width: 52, height: 40, borderRadius: 8 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.text },
  trash: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
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
}));
