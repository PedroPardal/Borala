import React, { useRef, useState } from 'react';
import { Animated, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../components/Avatar';
import RatingStars from '../../components/RatingStars';
import DuoButton from '../../components/DuoButton';
import Card from '../../components/Card';
import PressableScale from '../../components/PressableScale';
import FadeInView from '../../components/FadeInView';
import EmptyState from '../../components/EmptyState';
import { useApp } from '../../context/AppContext';
import { useProviderReviews } from '../../context/hooks';
import { categories } from '../../data/categories';
import { PortfolioItem, Provider } from '../../types';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { formatBRL, formatDateLong } from '../../utils/format';
import { feedback } from '../../services/feedback';

const { width } = Dimensions.get('window');
const SLIDE_W = width - spacing.lg * 2;

/** Cartão "Antes e Depois" — toque para alternar com animação de flip suave. */
function BeforeAfter({ item }: { item: PortfolioItem }) {
  const [showAfter, setShowAfter] = useState(true);
  const fade = useRef(new Animated.Value(1)).current;

  const toggle = () => {
    feedback.select();
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setShowAfter((v) => !v), 140);
  };

  return (
    <Pressable onPress={toggle} style={styles.slide}>
      <Animated.View style={{ opacity: fade }}>
        <Image source={{ uri: showAfter ? item.after : item.before }} style={styles.slideImg} />
      </Animated.View>
      <View style={[styles.baBadge, { backgroundColor: showAfter ? colors.primary : colors.navy }]}>
        <Text style={styles.baText}>{showAfter ? 'DEPOIS' : 'ANTES'}</Text>
      </View>
      <View style={styles.slideFooter}>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideHint}>Toque para ver o {showAfter ? 'antes' : 'depois'}</Text>
      </View>
    </Pressable>
  );
}

export default function ProviderDetailsScreen(props: RootScreenProps<'ProviderDetails'>) {
  const { getProvider } = useApp();
  const provider = getProvider(props.route.params.providerId);
  if (!provider) return <EmptyState icon="person-remove-outline" title="Prestador não encontrado" />;
  return <ProviderDetails {...props} provider={provider} />;
}

function ProviderDetails({ navigation, provider }: RootScreenProps<'ProviderDetails'> & { provider: Provider }) {
  const insets = useSafeAreaInsets();
  const { profile, getOrCreateConversation } = useApp();
  const [serviceId, setServiceId] = useState(provider.priceTable[0]?.id);
  const selected = provider.priceTable.find((s) => s.id === serviceId) ?? provider.priceTable[0];
  const providerReviews = useProviderReviews(provider.id);
  const cats = categories.filter((c) => provider.categories.includes(c.id));

  // header que aparece conforme rola
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [120, 200], outputRange: [0, 1], extrapolate: 'clamp' });

  const openChat = async () => {
    if (!profile) return;
    try {
      const conversationId = await getOrCreateConversation({
        clientId: profile.id,
        clientName: profile.name,
        clientAvatar: profile.avatar,
        providerId: provider.id,
        providerName: provider.name,
        providerAvatar: provider.avatar,
      });
      navigation.navigate('Chat', { conversationId });
    } catch {
      feedback.error();
    }
  };

  return (
    <View style={styles.flex}>
      <Animated.View pointerEvents="none" style={[styles.stickyHeader, { paddingTop: insets.top, opacity: headerOpacity }]}>
        <Text style={styles.stickyTitle}>{provider.name}</Text>
      </Animated.View>
      <View style={[styles.topButtons, { top: insets.top + 8 }]}>
        <PressableScale style={styles.roundBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </PressableScale>
        <PressableScale style={styles.roundBtn} onPress={openChat}>
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.text} />
        </PressableScale>
      </View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <View style={[styles.cover, { paddingTop: insets.top + 56 }]}>
          <FadeInView style={{ alignItems: 'center' }}>
            <Avatar uri={provider.avatar} size={96} ring={colors.white} />
            <Text style={styles.name}>{provider.name}</Text>
            {provider.reviewsCount > 0 ? (
              <RatingStars rating={provider.rating} showValue count={provider.reviewsCount} size={16} />
            ) : (
              <Text style={styles.newBadge}>Novo no BoraLá ✨</Text>
            )}
            <View style={styles.tags}>
              {cats.map((c) => (
                <View key={c.id} style={styles.tag}>
                  <Text style={styles.tagText}>{c.label}</Text>
                </View>
              ))}
            </View>
          </FadeInView>
        </View>

        <View style={styles.body}>
          <FadeInView delay={80} style={styles.statsRow}>
            <Stat icon="checkmark-done" value={`${provider.completedJobs}`} label="serviços" />
            <Stat
              icon="navigate"
              value={provider.distanceKm !== undefined ? `${provider.distanceKm.toFixed(1)} km` : '—'}
              label={provider.distanceKm !== undefined ? 'de você' : provider.area ?? 'sem local'}
            />
            <Stat icon="radio" value={`${provider.radiusKm} km`} label="raio" />
          </FadeInView>

          <FadeInView delay={140}>
            <Text style={styles.h}>Sobre</Text>
            <Text style={styles.bio}>{provider.bio}</Text>
          </FadeInView>

          {provider.portfolio.length > 0 && (
          <FadeInView delay={200}>
            <Text style={styles.h}>Antes e Depois</Text>
            <ScrollView
              horizontal
              snapToInterval={SLIDE_W + spacing.md}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
            >
              {provider.portfolio.map((p) => (
                <BeforeAfter key={p.id} item={p} />
              ))}
            </ScrollView>
          </FadeInView>
          )}

          <FadeInView delay={260}>
            <Text style={styles.h}>Tabela de preços</Text>
            {provider.priceTable.map((s) => {
              const active = s.id === selected?.id;
              return (
                <PressableScale
                  key={s.id}
                  sound="select"
                  onPress={() => setServiceId(s.id)}
                  style={[styles.service, active && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                >
                  <View style={[styles.radio, active && { borderColor: colors.primary }]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceTitle}>{s.title}</Text>
                    <Text style={styles.serviceUnit}>{s.unit}</Text>
                  </View>
                  <Text style={styles.servicePrice}>{formatBRL(s.price)}</Text>
                </PressableScale>
              );
            })}
          </FadeInView>

          <FadeInView delay={320}>
            <Text style={styles.h}>Avaliações</Text>
            {providerReviews.length === 0 && <Text style={styles.bio}>Ainda sem avaliações.</Text>}
            {providerReviews.map((r) => (
              <Card key={r.id} style={{ marginBottom: spacing.md }}>
                <View style={styles.reviewHead}>
                  <Avatar uri={r.clientAvatar} size={34} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.reviewName}>{r.clientName}</Text>
                    <Text style={styles.serviceUnit}>{formatDateLong(r.date)}</Text>
                  </View>
                  <RatingStars rating={r.rating} size={13} />
                </View>
                <Text style={styles.reviewText}>{r.comment}</Text>
              </Card>
            ))}
          </FadeInView>
        </View>
      </Animated.ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ marginRight: spacing.lg }}>
          <Text style={styles.serviceUnit}>Valor estimado</Text>
          <Text style={styles.total}>{selected ? formatBRL(selected.price) : '—'}</Text>
        </View>
        <DuoButton
          title={provider.online ? 'Agendar' : 'Indisponível'}
          icon="calendar"
          disabled={!selected || !provider.online}
          style={{ flex: 1 }}
          onPress={() => selected && navigation.navigate('Schedule', { providerId: provider.id, serviceId: selected.id })}
        />
      </View>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.serviceUnit}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    alignItems: 'center',
    paddingBottom: 14,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 14 },
  topButtons: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
  },
  cover: { backgroundColor: colors.primaryLight, paddingBottom: spacing.xl, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  name: { fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 10, marginBottom: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 10, paddingHorizontal: spacing.lg },
  tag: { backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginHorizontal: 4, marginBottom: 6 },
  tagText: { fontSize: 12, fontWeight: '800', color: colors.primaryDark },
  newBadge: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  body: { padding: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: -40 },
  stat: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 4 },
  h: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  bio: { fontSize: 15, lineHeight: 22, color: colors.text, fontWeight: '500' },
  slide: { width: SLIDE_W, marginRight: spacing.md, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.border },
  slideImg: { width: SLIDE_W, height: 210 },
  baBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  baText: { color: colors.white, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  slideFooter: { backgroundColor: colors.white, padding: spacing.md },
  slideTitle: { fontWeight: '800', fontSize: 15, color: colors.text },
  slideHint: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderDark, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  serviceTitle: { fontWeight: '800', fontSize: 15, color: colors.text },
  serviceUnit: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  servicePrice: { fontWeight: '900', fontSize: 16, color: colors.primaryDark },
  reviewHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewName: { fontWeight: '800', color: colors.text },
  reviewText: { fontSize: 14, color: colors.text, fontWeight: '500', lineHeight: 20 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
  },
  total: { fontSize: 20, fontWeight: '900', color: colors.text },
});
