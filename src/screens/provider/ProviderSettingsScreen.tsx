import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
import SwitchRoleCard from '../../components/SwitchRoleCard';
import PriceTableEditor from '../../components/PriceTableEditor';
import PortfolioEditor from '../../components/PortfolioEditor';
import LocationMap from '../../components/LocationMap';
import PreferencesCard from '../../components/PreferencesCard';
import { useApp } from '../../context/AppContext';
import { categories } from '../../data/categories';
import { CategoryId, GeoPoint, Provider, WeeklySlot } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { colors, radius, spacing, makeStyles } from '../../theme';
import { t, TKey, tList } from '../../i18n';
import { feedback } from '../../services/feedback';
import { describePosition } from '../../services/geo';

const PERIODS: { id: string; label: TKey; slots: string[] }[] = [
  { id: 'manha', label: 'ps.morning', slots: ['07:00', '08:00', '09:00', '10:00'] },
  { id: 'tarde', label: 'ps.afternoon', slots: ['13:00', '14:00', '15:00'] },
  { id: 'fim', label: 'ps.evening', slots: ['16:00', '17:00'] },
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
  const [locating, setLocating] = useState(false);
  // letra de cada dia da semana, começando no domingo
  const days = tList('date.weekdayLetters');

  // cada mudança grava direto no Firestore; se falhar, só avisa
  const save = (patch: Partial<Provider>) => updateLoggedProvider(patch).catch(() => feedback.error());

  const useMyLocation = async (silent = false) => {
    setLocating(true);
    const pos = await refreshLocation();
    if (!pos) {
      setLocating(false);
      if (silent) return;
      feedback.error();
      Alert.alert(t('ps.locUnavailable'), t('ps.locUnavailableSub'));
      return;
    }
    const area = await describePosition(pos);
    await save({ location: pos, area });
    setLocating(false);
    if (!silent) feedback.success();
  };

  // sem localização salva: pega pelo GPS sozinho ao abrir a tela
  const autoLocated = useRef(false);
  useEffect(() => {
    if (me.location || autoLocated.current) return;
    autoLocated.current = true;
    useMyLocation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.location]);

  // arrastou o pino no mapa: grava o ponto novo e o bairro
  const movePin = async (pos: GeoPoint) => {
    const area = await describePosition(pos);
    save({ location: pos, area });
  };

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
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={30}
      >
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
            <Text style={styles.contact}>{t('ps.noReviews')}</Text>
          )}
          {!!profile?.phone && <Text style={styles.contact}>{profile.phone}</Text>}
          <DuoButton title={t('common.editProfile')} icon="create" variant="outline" small onPress={editProfile} style={styles.editBtn} />
        </FadeInView>

        <FadeInView delay={60}>
          <Text style={styles.h}>{t('common.bio')}</Text>
          <PressableScale onPress={editProfile} scaleTo={0.98}>
            <Card style={styles.bioCard}>
              <Text style={[styles.bio, !me.bio && { color: colors.textMuted }]}>
                {me.bio || t('ps.bioPh')}
              </Text>
              <Ionicons name="pencil" size={16} color={colors.textMuted} />
            </Card>
          </PressableScale>
        </FadeInView>

        <FadeInView delay={100}>
          <Text style={styles.h}>{t('ps.categories')}</Text>
          {me.categories.length === 0 && <Text style={styles.needed}>{t('ps.categoriesNeeded')}</Text>}
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
          <Text style={styles.h}>{t('ps.radius')}</Text>
          <Card style={styles.radiusCard}>
            <LocationMap center={me.location ?? null} radiusKm={me.radiusKm} draggable height={220} onChange={movePin} />
            <View style={styles.stepper}>
              <PressableScale sound="none" style={styles.stepBtn} onPress={() => changeRadius(-2)}>
                <Ionicons name="remove" size={22} color={colors.text} />
              </PressableScale>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.radiusValue}>{me.radiusKm} km</Text>
                <Text style={styles.muted}>{me.area ? t('ps.fromArea', { area: me.area }) : t('ps.fromLocation')}</Text>
              </View>
              <PressableScale sound="none" style={styles.stepBtn} onPress={() => changeRadius(2)}>
                <Ionicons name="add" size={22} color={colors.text} />
              </PressableScale>
            </View>
            <DuoButton
              title={me.location ? t('ps.updateLocation') : t('ps.useLocation')}
              icon="locate"
              variant={me.location ? 'outline' : 'blue'}
              small
              loading={locating}
              onPress={() => useMyLocation()}
              style={{ alignSelf: 'stretch', marginTop: spacing.lg }}
            />
          </Card>
        </FadeInView>

        <FadeInView delay={180}>
          <Text style={styles.h}>{t('ps.hours')}</Text>
          <Card>
            <View style={styles.gridRow}>
              <View style={styles.gridLabel} />
              {days.map((d, i) => (
                <Text key={i} style={styles.gridHead}>
                  {d}
                </Text>
              ))}
            </View>
            {PERIODS.map((p) => (
              <View key={p.id} style={styles.gridRow}>
                <Text style={styles.gridLabel}>{t(p.label)}</Text>
                {days.map((_, day) => {
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
          <Text style={styles.h}>{t('common.priceTable')}</Text>
          {me.priceTable.length === 0 && <Text style={styles.needed}>{t('ps.priceNeeded')}</Text>}
          <PriceTableEditor
            items={me.priceTable}
            onSave={(priceTable) => save({ priceTable, basePrice: priceTable.length ? Math.min(...priceTable.map((p) => p.price)) : 0 })}
          />
        </FadeInView>

        <FadeInView delay={240}>
          <Text style={styles.h}>{t('ps.portfolio')}</Text>
          <PortfolioEditor items={me.portfolio} upload={uploadImage} onChange={(portfolio) => updateLoggedProvider({ portfolio })} />
        </FadeInView>

        <FadeInView delay={250}>
          <Text style={styles.h}>{t('ps.payments')}</Text>
          <Card>
            <SettingsRow
              icon="wallet"
              label={t('ps.payoutRow')}
              value={me.acceptsOnlinePayment ? t('ps.payoutActive') : t('ps.payoutActivate')}
              color={me.acceptsOnlinePayment ? colors.text : colors.primary}
              onPress={() => navigation.navigate('PayoutAccount')}
            />
          </Card>
        </FadeInView>

        <FadeInView delay={260}>
          <Text style={styles.h}>{t('common.preferences')}</Text>
          <PreferencesCard />
          <View style={{ marginTop: spacing.xl }}>
            <SwitchRoleCard to="client" />
          </View>
          <DuoButton title={t('common.signOut')} variant="outline" icon="log-out" onPress={signOut} style={{ marginTop: spacing.xl }} />
        </FadeInView>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { alignItems: 'center', marginVertical: spacing.lg, gap: 6 },
  name: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: spacing.sm },
  h: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  muted: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  contact: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  needed: { fontSize: 13, fontWeight: '700', color: colors.primaryText, marginTop: -4, marginBottom: spacing.sm },
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
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  bio: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text, lineHeight: 21 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  radiusCard: { alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: spacing.lg },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusValue: { fontSize: 26, fontWeight: '900', color: colors.primaryText },
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
}));
