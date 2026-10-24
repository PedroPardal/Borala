import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from '../../components/Avatar';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import SettingsRow from '../../components/SettingsRow';
import DuoButton from '../../components/DuoButton';
import AddressForm from '../../components/AddressForm';
import PressableScale from '../../components/PressableScale';
import FadeInView from '../../components/FadeInView';
import { useApp } from '../../context/AppContext';
import { RootStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { feedback, Sound } from '../../services/feedback';
import { formatBRL } from '../../utils/format';

export default function ClientProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile, updateProfile, signOut, bookings } = useApp();
  const [soundOn, setSoundOn] = useState(Sound.isEnabled());
  const mine = bookings;
  const spent = mine.filter((b) => b.status === 'concluido').reduce((s, b) => s + b.price, 0);

  const [adding, setAdding] = useState(false);

  if (!profile) return null;

  const removeAddress = (id: string) => {
    feedback.tap();
    updateProfile({ addresses: profile.addresses.filter((a) => a.id !== id) }).catch(() => feedback.error());
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <FadeInView style={styles.head}>
          <PressableScale onPress={() => navigation.navigate('EditProfile')}>
            <Avatar uri={profile.avatar} size={84} />
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={14} color={colors.white} />
            </View>
          </PressableScale>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.muted}>{profile.email}</Text>
          {!!profile.phone && <Text style={styles.muted}>{profile.phone}</Text>}
          <DuoButton
            title="Editar perfil"
            icon="create"
            variant="outline"
            small
            onPress={() => navigation.navigate('EditProfile')}
            style={{ marginTop: spacing.md, alignSelf: 'stretch' }}
          />
        </FadeInView>

        <FadeInView delay={60} style={styles.stats}>
          <StatCard label="Pedidos" value={`${mine.length}`} icon="receipt" color={colors.blue} />
          <StatCard label="Investido" value={formatBRL(spent)} icon="wallet" color={colors.primary} />
        </FadeInView>

        <FadeInView delay={120}>
          <Text style={styles.h}>Endereços salvos</Text>
          <Card>
            {profile.addresses.map((a) => (
              <View key={a.id} style={styles.addrRow}>
                <Ionicons name="location" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addrLabel}>{a.label}</Text>
                  <Text style={styles.addrText}>
                    {a.street} • {a.city}
                  </Text>
                </View>
                <PressableScale sound="none" onPress={() => removeAddress(a.id)} style={styles.trash}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </PressableScale>
              </View>
            ))}
            {profile.addresses.length === 0 && !adding && <Text style={styles.muted}>Nenhum endereço salvo ainda.</Text>}
            {adding ? (
              <View style={{ marginTop: spacing.md }}>
                <AddressForm
                  onCancel={() => setAdding(false)}
                  onSave={async (a) => {
                    await updateProfile({ addresses: [...profile.addresses, a] });
                    setAdding(false);
                  }}
                />
              </View>
            ) : (
              <SettingsRow icon="add-circle" label="Adicionar endereço" color={colors.primary} onPress={() => setAdding(true)} />
            )}
          </Card>
        </FadeInView>

        <FadeInView delay={180}>
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
            <SettingsRow icon="notifications" label="Notificações" onPress={() => {}} />
            <SettingsRow icon="help-circle" label="Ajuda" onPress={() => {}} />
          </Card>
        </FadeInView>

        <FadeInView delay={240}>
          <DuoButton title="Sair" variant="outline" icon="log-out" onPress={signOut} style={{ marginTop: spacing.xl }} />
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { alignItems: 'center', marginVertical: spacing.lg },
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
  name: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: spacing.md },
  muted: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  stats: { flexDirection: 'row', gap: spacing.md },
  h: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addrLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  addrText: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  trash: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: '#FFF1F3', alignItems: 'center', justifyContent: 'center' },
});
