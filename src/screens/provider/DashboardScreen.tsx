import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Avatar from '../../components/Avatar';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import BarChart from '../../components/BarChart';
import RequestCard from '../../components/RequestCard';
import PressableScale from '../../components/PressableScale';
import FadeInView from '../../components/FadeInView';
import EmptyState from '../../components/EmptyState';
import OfflineBanner from '../../components/OfflineBanner';
import AdBanner from '../../components/AdBanner';
import { useApp } from '../../context/AppContext';
import { ProviderTabParamList } from '../../navigation/types';
import { Provider } from '../../types';
import { colors, radius, spacing, makeStyles } from '../../theme';
import { t } from '../../i18n';
import { formatBRL, formatDateNumeric, parseISODate, toISODate, weekdayShort } from '../../utils/format';
import { feedback } from '../../services/feedback';

type Period = 'week' | 'month';

export default function DashboardScreen() {
  const { loggedProvider } = useApp();
  if (!loggedProvider) {
    return (
      <View style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <Dashboard me={loggedProvider} />;
}

/** O que falta para o prestador aparecer nas buscas dos clientes. */
function profileChecklist(me: Provider) {
  return [
    { done: !!me.avatar, label: t('dash.addPhoto') },
    { done: (me.bio ?? '').trim().length > 0, label: t('dash.writeBio') },
    { done: me.categories.length > 0, label: t('dash.pickCategories'), required: true },
    { done: me.priceTable.length > 0, label: t('dash.addService'), required: true },
    { done: !!me.location, label: t('dash.setLocation') },
  ];
}

function Dashboard({ me }: { me: Provider }) {
  const navigation = useNavigation<BottomTabNavigationProp<ProviderTabParamList>>();
  const { bookings, updateLoggedProvider, online: connected } = useApp();
  const [period, setPeriod] = useState<Period>('week');
  const online = me.online;
  const checklist = profileChecklist(me);
  const missing = checklist.filter((c) => !c.done);
  const hidden = checklist.some((c) => c.required && !c.done);

  const mine = bookings;
  const pending = mine.filter((b) => b.status === 'pendente');
  const upcoming = mine.filter((b) => b.status === 'aceito').sort((a, b) => a.date.localeCompare(b.date));
  const completed = mine.filter((b) => b.status === 'concluido');

  // ganhos por dia a partir dos serviços concluídos
  const daily = useMemo(() => {
    const map = new Map<string, number>();
    completed.forEach((b) => map.set(b.date, (map.get(b.date) ?? 0) + b.price));
    return map;
  }, [completed]);

  const chart = useMemo(() => {
    const today = new Date();
    if (period === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        return { label: weekdayShort(d), value: daily.get(toISODate(d)) ?? 0 };
      });
    }
    // mês: 4 semanas
    return Array.from({ length: 4 }, (_, w) => {
      let sum = 0;
      for (let k = 0; k < 7; k++) {
        const d = new Date(today);
        d.setDate(today.getDate() - ((3 - w) * 7 + (6 - k)));
        sum += daily.get(toISODate(d)) ?? 0;
      }
      return { label: t('dash.weekShort', { n: w + 1 }), value: sum };
    });
  }, [period, daily]);

  const total = chart.reduce((s, c) => s + c.value, 0);
  const allTime = Array.from(daily.values()).reduce((s, v) => s + v, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <OfflineBanner />
        <FadeInView style={styles.head}>
          <Avatar uri={me.avatar} size={48} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.hello}>{t('dash.hello', { name: me.name.split(' ')[0] })}</Text>
            <Text style={[styles.status, { color: online ? colors.primary : colors.textMuted }]}>
              ● {online ? t('dash.available') : t('dash.offline')}
            </Text>
          </View>
          <Switch
            value={online}
            disabled={!connected}
            onValueChange={(v) => {
              v ? feedback.success() : feedback.select();
              updateLoggedProvider({ online: v }).catch(() => feedback.error());
            }}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.white}
          />
        </FadeInView>

        <FadeInView delay={60}>
          <Card style={styles.earnings}>
            <View style={styles.earnHead}>
              <View>
                <Text style={styles.earnLabel}>{period === 'week' ? t('dash.earningsWeek') : t('dash.earningsMonth')}</Text>
                <Text style={styles.earnValue}>{formatBRL(total)}</Text>
              </View>
              <View style={styles.segment}>
                {(['week', 'month'] as Period[]).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => {
                      feedback.select();
                      setPeriod(p);
                    }}
                    style={[styles.segItem, period === p && styles.segActive]}
                  >
                    <Text style={[styles.segText, period === p && { color: colors.primary }]}>{p === 'week' ? t('dash.week') : t('dash.month')}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <BarChart key={period} data={chart} />
          </Card>
        </FadeInView>

        <FadeInView delay={120} style={styles.stats}>
          <StatCard label={t('dash.totalEarnings')} value={formatBRL(allTime)} icon="cash" color={colors.primary} />
          <StatCard label={t('dash.scheduled')} value={`${upcoming.length}`} icon="calendar" color={colors.blue} />
          <StatCard label={t('dash.rating')} value={me.reviewsCount ? me.rating.toFixed(1) : '—'} icon="star" color={colors.star} />
        </FadeInView>

        <AdBanner />

        {missing.length > 0 && (
          <FadeInView delay={150}>
            <PressableScale style={styles.setup} onPress={() => navigation.navigate('ProviderSettings')}>
              <Text style={styles.setupTitle}>
                {hidden ? t('dash.hidden') : t('dash.incomplete')}
              </Text>
              {checklist.map((c) => (
                <View key={c.label} style={styles.setupRow}>
                  <Ionicons
                    name={c.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={c.done ? colors.success : c.required ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.setupText, c.done && styles.setupDone]}>
                    {c.label}
                    {c.required && !c.done ? t('dash.required') : ''}
                  </Text>
                </View>
              ))}
              <Text style={styles.setupLink}>{t('dash.complete')}</Text>
            </PressableScale>
          </FadeInView>
        )}

        {pending.length > 0 && (
          <FadeInView delay={180}>
            <PressableScale style={styles.alert} onPress={() => navigation.navigate('Requests')}>
              <View style={styles.alertIcon}>
                <Ionicons name="notifications" size={22} color={colors.onSecondary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.alertTitle}>
                  {t(pending.length > 1 ? 'dash.newRequestsOther' : 'dash.newRequestsOne', { n: pending.length })}
                </Text>
                <Text style={styles.alertSub}>{t('dash.respondFast')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </PressableScale>
          </FadeInView>
        )}

        <FadeInView delay={240}>
          <Text style={styles.h}>{t('dash.upcoming')}</Text>
          {upcoming.length === 0 ? (
            <EmptyState icon="calendar-outline" title={t('dash.nothing')} subtitle={t('dash.nothingSub')} />
          ) : (
            upcoming.map((b) => <RequestCard key={b.id} booking={b} title={b.clientName} avatar={b.clientAvatar} />)
          )}
        </FadeInView>

        <FadeInView delay={300}>
          <Text style={styles.h}>{t('dash.history')}</Text>
          {[...completed]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((b) => (
              <View key={b.id} style={styles.history}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.histTitle}>{b.serviceTitle}</Text>
                  <Text style={styles.histSub}>
                    {b.clientName} • {formatDateNumeric(parseISODate(b.date))}
                  </Text>
                </View>
                <Text style={styles.histValue}>+{formatBRL(b.price)}</Text>
              </View>
            ))}
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  hello: { fontSize: 22, fontWeight: '900', color: colors.text },
  status: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  earnings: { paddingBottom: spacing.md },
  earnHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  earnLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  earnValue: { fontSize: 28, fontWeight: '900', color: colors.text, marginTop: 2 },
  segment: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.sm, padding: 3 },
  segItem: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  segActive: { backgroundColor: colors.card },
  segText: { fontWeight: '800', fontSize: 12, color: colors.textMuted },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.secondaryDark,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  alertIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  alertSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  h: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  setup: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.primary,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: 8,
  },
  setupTitle: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 2 },
  setupRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setupText: { fontSize: 14, fontWeight: '700', color: colors.text },
  setupDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  setupLink: { fontSize: 14, fontWeight: '900', color: colors.primaryText, marginTop: 4 },
  history: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  histTitle: { fontWeight: '800', color: colors.text },
  histSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  histValue: { fontWeight: '900', color: colors.primaryText },
}));
