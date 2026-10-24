import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SearchBar from '../../components/SearchBar';
import ProviderCard from '../../components/ProviderCard';
import PressableScale from '../../components/PressableScale';
import Chip from '../../components/Chip';
import FadeInView from '../../components/FadeInView';
import EmptyState from '../../components/EmptyState';
import { useApp } from '../../context/AppContext';
import { categories } from '../../data/categories';
import { CategoryId } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';

type Sort = 'distance' | 'rating' | 'price';
const FAR = 1e6; // prestadores sem localização vão para o fim da lista "mais próximos"
const SORTS: { id: Sort; label: string; icon: 'navigate' | 'star' | 'pricetag' }[] = [
  { id: 'distance', label: 'Mais próximos', icon: 'navigate' },
  { id: 'rating', label: 'Melhor avaliados', icon: 'star' },
  { id: 'price', label: 'Menor preço', icon: 'pricetag' },
];

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { providers, profile, myLocation } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [sort, setSort] = useState<Sort>('distance');

  // só aparece quem está online, com perfil completo e me atende (se as duas localizações forem conhecidas)
  const listed = useMemo(
    () =>
      providers.filter(
        (p) =>
          p.online &&
          p.categories.length > 0 &&
          p.priceTable.length > 0 &&
          (p.distanceKm === undefined || p.distanceKm <= p.radiusKm),
      ),
    [providers],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listed
      .filter((p) => (category ? p.categories.includes(category) : true))
      .filter((p) =>
        q
          ? p.name.toLowerCase().includes(q) ||
            p.bio.toLowerCase().includes(q) ||
            p.priceTable.some((s) => s.title.toLowerCase().includes(q))
          : true,
      )
      .sort((a, b) =>
        sort === 'distance'
          ? (a.distanceKm ?? FAR) - (b.distanceKm ?? FAR)
          : sort === 'rating'
            ? b.rating - a.rating
            : a.basePrice - b.basePrice,
      );
  }, [listed, query, category, sort]);

  const firstName = (profile?.name ?? '').split(' ')[0];
  const where = profile?.addresses[0]?.street ?? (myLocation ? 'Usando sua localização atual' : 'Adicione um endereço no seu Perfil');

  const header = (
    <View>
      <FadeInView style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Olá, {firstName} 👋</Text>
          <View style={styles.address}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.addressText} numberOfLines={1}>
              {where}
            </Text>
          </View>
        </View>
        <View style={styles.bell}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </View>
      </FadeInView>

      <FadeInView delay={60}>
        <Text style={styles.title}>Bora resolver o que hoje?</Text>
        <SearchBar value={query} onChangeText={setQuery} />
      </FadeInView>

      <FadeInView delay={120}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
          {categories.map((c) => {
            const active = category === c.id;
            return (
              <PressableScale
                key={c.id}
                sound="select"
                onPress={() => setCategory(active ? null : c.id)}
                style={[styles.cat, active && { borderColor: c.color, backgroundColor: `${c.color}14` }]}
              >
                <View style={[styles.catIcon, { backgroundColor: c.color }]}>
                  <Ionicons name={c.icon as any} size={24} color={colors.white} />
                </View>
                <Text style={styles.catLabel} numberOfLines={2}>
                  {c.label}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </FadeInView>

      <FadeInView delay={180}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
          {SORTS.map((s) => (
            <Chip key={s.id} label={s.label} icon={s.icon} selected={sort === s.id} onPress={() => setSort(s.id)} />
          ))}
        </ScrollView>
        <Text style={styles.section}>
          {list.length} prestador{list.length === 1 ? '' : 'es'} perto de você
        </Text>
      </FadeInView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <FadeInView delay={220 + index * 70}>
            <ProviderCard provider={item} onPress={() => navigation.navigate('ProviderDetails', { providerId: item.id })} />
          </FadeInView>
        )}
        ListEmptyComponent={
          listed.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="Ainda não há prestadores por aqui"
              subtitle="O BoraLá acabou de chegar! Convide quem faz bicos na sua região para se cadastrar como prestador."
            />
          ) : (
            <EmptyState icon="search" title="Nenhum prestador encontrado" subtitle="Tente outra categoria ou termo de busca." />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 32 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  hello: { fontSize: 22, fontWeight: '800', color: colors.text },
  address: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  addressText: { marginLeft: 4, color: colors.textMuted, fontWeight: '600', fontSize: 13, flexShrink: 1 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: spacing.md, lineHeight: 32 },
  cats: { paddingVertical: spacing.lg },
  cat: {
    width: 96,
    marginRight: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  catIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  catLabel: { fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'center' },
  section: { fontSize: 17, fontWeight: '800', color: colors.text, marginVertical: spacing.sm },
});
