import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from '../../components/Avatar';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import DuoButton from '../../components/DuoButton';
import PressableScale from '../../components/PressableScale';
import SettingsRow from '../../components/SettingsRow';
import RatingStars from '../../components/RatingStars';
import FadeInView from '../../components/FadeInView';
import PriceTableEditor from '../../components/PriceTableEditor';
import PortfolioEditor from '../../components/PortfolioEditor';
import { useApp } from '../../context/AppContext';
import { categories } from '../../data/categories';
import { CategoryId, Provider, WeeklySlot } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { feedback, Sound } from '../../services/feedback';
import { describePosition } from '../../services/geo';

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const PERIODS: { id: string; label: string; slots: string[] }[] = [
  { id: 'manha', label: 'Manhã', slots: ['07:00', '08:00', '09:00', '10:00'] },
  { id: 'tarde', label: 'Tarde', slots: ['13:00', '14:00', '15:00'] },
  { id: 'fim', label: 'Fim de tarde', slots: ['16:00', '17:00'] },
];
const RADIUS_MIN = 2;
const RADIUS_MAX = 30;

export default function ProviderSettingsScreen() {
  const { loggedProvider } = useApp();
  if (!loggedProvider) {
    return (
      <View style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <ProviderSettings me={loggedProvider} />;
}

function ProviderSettings({ me }: { me: Provider }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile, updateLoggedProvider, uploadImage, refreshLocation, signOut } = useApp();
  const editProfile = () => navigation.navigate('EditProfile');
  const [soundOn, setSoundOn] = useState(Sound.isEnabled());
  const [locating, setLocating] = useState(false);

  // cada mudança grava direto no Firestore; se falhar, só avisa
  const save = (patch: Partial<Provider>) => updateLoggedProvider(patch).catch(() => feedback.error());

  const useMyLocation = async () => {
    setLocating(true);
    const pos = await refreshLocation();
    if (!pos) {
      setLocating(false);
      feedback.error();
      Alert.alert('Localização indisponível', 'Permita o acesso à localização para os clientes verem a distância até você.');
      return;
    }
    const area = await describePosition(pos);
    await save({ location: pos, area });
    setLocating(false);
    feedback.success();
  };

  // animação do "círculo de alcance"
  const ring = useRef(new Animated.Value(me.radiusKm)).current;
  useEffect(() => {
    Animated.spring(ring, { toValue: me.radiusKm, useNativeDriver: true, speed: 14, bounciness: 10 }).start();
  }, [me.radiusKm, ring]);
  const ringScale = ring.interpolate({ inputRange: [RADIUS_MIN, RADIUS_MAX], outputRange: [0.35, 1] });

  const changeRadius = (delta: number) => {
    const next = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, me.radiusKm + delta));
    if (next === me.radiusKm) return feedback.error();
    feedback.select();
    save({ radiusKm: next });
  };

  const toggleCategory = (id: CategoryId) => {
    const has = me.categories.includes(id);
    save({ categories: has ? me.categories.filter((c) => c !== id) : [...me.categories, id] });
  };

  const hasPeriod = (day: number, periodId: string) => {
    const period = PERIODS.find((p) => p.id === periodId)!;
    const slots = me.availability.find((a) => a.day === day)?.slots ?? [];
    return period.slots.some((s) => slots.includes(s));
  };

  const togglePeriod = (day: number, periodId: string) => {
    feedback.select();
    const period = PERIODS.find((p) => p.id === periodId)!;
    const current = me.availability.find((a) => a.day === day)?.slots ?? [];
    const on = hasPeriod(day, periodId);
    const nextSlots = on ? current.filter((s) => !period.slots.includes(s)) : [...current, ...period.slots].sort();
    const others = me.availability.filter((a) => a.day !== day);
    const availability: WeeklySlot[] = nextSlots.length ? [...others, { day, slots: nextSlots }] : others;
    save({ availability });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <FadeInView style={styles.head}>
          <PressableScale onPress={editProfile}>
            <Avatar uri={me.avatar} size={84} />
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={14} color={colors.white} />
            </View>
          </PressableScale>
          <Text style={styles.name}>{me.name}</Text>
          {me.reviewsCount > 0 ? (
            <RatingStars rating={me.rating} showValue count={me.reviewsCount} size={15} />
          ) : (
            <Text style={styles.contact}>Ainda sem avaliações</Text>
          )}
          {!!profile?.phone && <Text style={styles.contact}>{profile.phone}</Text>}
          <DuoButton title="Editar perfil" icon="create" variant="outline" small onPress={editProfile} style={styles.editBtn} />
        </FadeInView>

        <FadeInView delay={60}>
          <Text style={styles.h}>Bio profissional</Text>
          <PressableScale onPress={editProfile} scaleTo={0.98}>
            <Card style={styles.bioCard}>
              <Text style={[styles.bio, !me.bio && { color: colors.textMuted }]}>
                {me.bio || 'Conte o que você faz, há quanto tempo e seus diferenciais.'}
              </Text>
              <Ionicons name="pencil" size={16} color={colors.textMuted} />
            </Card>
          </PressableScale>
        </FadeInView>

        <FadeInView delay={100}>
          <Text style={styles.h}>Especialidades</Text>
          {me.categories.length === 0 && <Text style={styles.needed}>Escolha pelo menos uma para aparecer nas buscas.</Text>}
          <View style={styles.wrap}>
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                icon={c.icon as any}
                color={c.color}
                selected={me.categories.includes(c.id)}
                onPress={() => toggleCategory(c.id)}
              />
            ))}
          </View>
        </FadeInView>

        <FadeInView delay={140}>
          <Text style={styles.h}>Raio de atendimento</Text>
          <Card style={styles.radiusCard}>
            <View style={styles.map}>
              <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }] }]} />
              <View style={styles.pin}>
                <Ionicons name="home" size={18} color={colors.white} />
              </View>
            </View>
            <View style={styles.stepper}>
              <PressableScale sound="none" style={styles.stepBtn} onPress={() => changeRadius(-2)}>
                <Ionicons name="remove" size={22} color={colors.text} />
              </PressableScale>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.radiusValue}>{me.radiusKm} km</Text>
                <Text style={styles.muted}>{me.area ? `a partir de ${me.area}` : 'a partir da sua localização'}</Text>
              </View>
              <PressableScale sound="none" style={styles.stepBtn} onPress={() => changeRadius(2)}>
                <Ionicons name="add" size={22} color={colors.text} />
              </PressableScale>
            </View>
            <DuoButton
              title={me.location ? 'Atualizar localização' : 'Usar minha localização'}
              icon="locate"
              variant={me.location ? 'outline' : 'blue'}
              small
              loading={locating}
              onPress={useMyLocation}
              style={{ alignSelf: 'stretch', marginTop: spacing.lg }}
            />
          </Card>
        </FadeInView>

        <FadeInView delay={180}>
          <Text style={styles.h}>Horários disponíveis</Text>
          <Card>
            <View style={styles.gridRow}>
              <View style={styles.gridLabel} />
              {DAYS.map((d, i) => (
                <Text key={i} style={styles.gridHead}>
                  {d}
                </Text>
              ))}
            </View>
            {PERIODS.map((p) => (
              <View key={p.id} style={styles.gridRow}>
                <Text style={styles.gridLabel}>{p.label}</Text>
                {DAYS.map((_, day) => {
                  const on = hasPeriod(day, p.id);
                  return (
                    <PressableScale
                      key={day}
                      sound="none"
                      scaleTo={0.85}
                      onPress={() => togglePeriod(day, p.id)}
                      style={[styles.cell, on && styles.cellOn]}
                    >
                      {on && <Ionicons name="checkmark" size={14} color={colors.white} />}
                    </PressableScale>
                  );
                })}
              </View>
            ))}
          </Card>
        </FadeInView>

        <FadeInView delay={220}>
          <Text style={styles.h}>Tabela de preços</Text>
          {me.priceTable.length === 0 && <Text style={styles.needed}>Cadastre pelo menos um serviço para aparecer nas buscas.</Text>}
          <PriceTableEditor
            items={me.priceTable}
            onSave={(priceTable) => save({ priceTable, basePrice: priceTable.length ? Math.min(...priceTable.map((p) => p.price)) : 0 })}
          />
        </FadeInView>

        <FadeInView delay={240}>
          <Text style={styles.h}>Antes e depois</Text>
          <PortfolioEditor items={me.portfolio} upload={uploadImage} onChange={(portfolio) => updateLoggedProvider({ portfolio })} />
        </FadeInView>

        <FadeInView delay={260}>
          <Text style={styles.h}>Preferências</Text>
          <Card>
            <SettingsRow
              icon="volume-high"
              label="Efeitos sonoros"
              toggle={{
                value: soundOn,
                onChange: (v) => {
                  Sound.setEnabled(v);
                  setSoundOn(v);
                },
              }}
            />
          </Card>
          <DuoButton title="Sair" variant="outline" icon="log-out" onPress={signOut} style={{ marginTop: spacing.xl }} />
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { alignItems: 'center', marginVertical: spacing.lg, gap: 6 },
  name: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: spacing.sm },
  h: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  muted: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  contact: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  needed: { fontSize: 13, fontWeight: '700', color: colors.primaryDark, marginTop: -4, marginBottom: spacing.sm },
  editBtn: { alignSelf: 'stretch', marginTop: spacing.sm },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  bio: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text, lineHeight: 21 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  radiusCard: { alignItems: 'center' },
  map: {
    width: '100%',
    height: 170,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,87,34,0.16)',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pin: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: spacing.lg },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusValue: { fontSize: 26, fontWeight: '900', color: colors.primaryDark },
  gridRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  gridLabel: { width: 84, fontSize: 12, fontWeight: '800', color: colors.text },
  gridHead: { flex: 1, textAlign: 'center', fontWeight: '800', color: colors.textMuted },
  cell: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: 2,
    borderRadius: 8,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: { backgroundColor: colors.primary },
});
