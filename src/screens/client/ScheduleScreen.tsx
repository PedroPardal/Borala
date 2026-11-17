import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '../../components/PressableScale';
import DuoButton from '../../components/DuoButton';
import Chip from '../../components/Chip';
import FadeInView from '../../components/FadeInView';
import EmptyState from '../../components/EmptyState';
import { useApp } from '../../context/AppContext';
import { useBusySlots } from '../../context/hooks';
import { PriceItem, Provider } from '../../types';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing, makeStyles } from '../../theme';
import { t, tList } from '../../i18n';
import { formatDateLong, nextDays, toISODate, weekdayShort } from '../../utils/format';

export default function ScheduleScreen(props: RootScreenProps<'Schedule'>) {
  const { getProvider } = useApp();
  const provider = getProvider(props.route.params.providerId);
  const service = provider?.priceTable.find((s) => s.id === props.route.params.serviceId);
  if (!provider || !service) {
    return <EmptyState icon="alert-circle-outline" title={t('common.serviceUnavailable')} subtitle={t('common.serviceUnavailableSub')} />;
  }
  return <Schedule {...props} provider={provider} service={service} />;
}

function Schedule({ navigation, provider, service }: RootScreenProps<'Schedule'> & { provider: Provider; service: PriceItem }) {
  const insets = useSafeAreaInsets();

  const days = useMemo(() => nextDays(21), []);
  const slotsFor = (d: Date) => provider.availability.find((a) => a.day === d.getDay())?.slots ?? [];

  const firstAvailable = days.find((d) => slotsFor(d).length > 0) ?? days[0];
  const [date, setDate] = useState<Date>(firstAvailable);
  const [time, setTime] = useState<string | null>(null);

  const iso = toISODate(date);
  const taken = useBusySlots(provider.id, iso);

  const now = new Date();
  const slots = slotsFor(date).filter((s) => {
    if (iso !== toISODate(now)) return true;
    const [h] = s.split(':').map(Number);
    return h > now.getHours(); // não mostra horários que já passaram hoje
  });

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        <FadeInView style={styles.summary}>
          <Ionicons name="briefcase" size={20} color={colors.primary} />
          <Text style={styles.summaryText}>
            {service.title} {t('schedule.with')} <Text style={{ fontWeight: '900' }}>{provider.name.split(' ')[0]}</Text>
          </Text>
        </FadeInView>

        <FadeInView delay={60}>
          <Text style={styles.h}>{tList('date.monthsLong')[date.getMonth()]}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {days.map((d) => {
              const available = slotsFor(d).length > 0;
              const active = toISODate(d) === iso;
              return (
                <PressableScale
                  key={d.toISOString()}
                  sound={available ? 'select' : 'none'}
                  disabled={!available}
                  onPress={() => {
                    setDate(d);
                    setTime(null);
                  }}
                  style={[
                    styles.day,
                    active && styles.dayActive,
                    !available && { opacity: 0.4 },
                  ]}
                >
                  <Text style={[styles.dayWeek, active && { color: colors.white }]}>{weekdayShort(d)}</Text>
                  <Text style={[styles.dayNum, active && { color: colors.white }]}>{d.getDate()}</Text>
                  <View style={[styles.dot, { backgroundColor: available ? (active ? colors.white : colors.primary) : 'transparent' }]} />
                </PressableScale>
              );
            })}
          </ScrollView>
        </FadeInView>

        <FadeInView delay={120} key={iso}>
          <Text style={styles.h}>{t('schedule.slots', { date: formatDateLong(iso) })}</Text>
          {slots.length === 0 ? (
            <EmptyState icon="time-outline" title={t('schedule.noSlots')} subtitle={t('schedule.noSlotsSub')} />
          ) : (
            <View style={styles.slots}>
              {slots.map((s) => {
                const busy = taken.includes(s);
                return busy ? (
                  <View key={s} style={styles.busy}>
                    <Text style={styles.busyText}>{s}</Text>
                  </View>
                ) : (
                  <Chip key={s} label={s} icon="time" selected={time === s} onPress={() => setTime(s)} />
                );
              })}
            </View>
          )}
          <View style={styles.legend}>
            <Ionicons name="information-circle" size={16} color={colors.textMuted} />
            <Text style={styles.legendText}>{t('schedule.legend')}</Text>
          </View>
        </FadeInView>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <DuoButton
          title={time ? t('schedule.continue', { time }) : t('schedule.pick')}
          disabled={!time}
          onPress={() =>
            time &&
            navigation.navigate('Checkout', { providerId: provider.id, serviceId: service.id, date: iso, time })
          }
        />
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  flex: { flex: 1, backgroundColor: colors.bg },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  summaryText: { marginLeft: 8, fontSize: 15, fontWeight: '600', color: colors.text },
  h: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  day: {
    width: 62,
    paddingVertical: 12,
    marginRight: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  dayWeek: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  dayNum: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  slots: { flexDirection: 'row', flexWrap: 'wrap' },
  busy: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  busyText: { fontWeight: '700', fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through' },
  legend: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  legendText: { marginLeft: 6, fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
}));
