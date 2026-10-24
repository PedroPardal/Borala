import React, { useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../components/Avatar';
import DuoButton from '../../components/DuoButton';
import TextField from '../../components/TextField';
import PressableScale from '../../components/PressableScale';
import FadeInView from '../../components/FadeInView';
import { useApp } from '../../context/AppContext';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';
import { pickImage } from '../../services/pickImage';
import { isLocalUri } from '../../services/uploads';

const PRESET_AVATARS = [3, 8, 11, 16, 26, 31, 36, 49, 57, 65].map((n) => `https://i.pravatar.cc/200?img=${n}`);
const BIO_MAX = 240;

/** Deixa o telefone no formato (11) 91234-5678 enquanto digita. */
function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function EditProfileScreen({ navigation }: RootScreenProps<'EditProfile'>) {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, loggedProvider, updateLoggedProvider, uploadImage } = useApp();
  const isProvider = profile?.role === 'provider';

  const [avatar, setAvatar] = useState(profile?.avatar ?? '');
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(loggedProvider?.bio ?? '');
  const [saving, setSaving] = useState(false);

  const shake = useRef(new Animated.Value(0)).current;
  const doShake = () => {
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 50, useNativeDriver: true })),
    ).start();
  };

  const pickFrom = async (source: 'gallery' | 'camera') => {
    const uri = await pickImage(source);
    if (uri) {
      feedback.success();
      setAvatar(uri);
    }
  };

  const save = async () => {
    const invalid = name.trim().length < 2 || (phone.length > 0 && phone.replace(/\D/g, '').length < 10);
    if (invalid) {
      feedback.error();
      doShake();
      return;
    }
    setSaving(true);
    try {
      // foto nova vem do aparelho: sobe para o Storage e guarda a URL
      const avatarUrl = isLocalUri(avatar) ? await uploadImage('avatar', avatar) : avatar;
      await updateProfile({ name: name.trim(), phone, avatar: avatarUrl });
      if (isProvider && bio.trim() !== loggedProvider?.bio) await updateLoggedProvider({ bio: bio.trim() });
      feedback.success();
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      feedback.error();
      Alert.alert('Não foi possível salvar', firebaseErrorMessage(e));
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <FadeInView style={styles.photoBox}>
          <View>
            <Avatar uri={avatar} size={104} ring={colors.primary} />
            <PressableScale style={styles.cameraBadge} onPress={() => pickFrom('gallery')}>
              <Ionicons name="camera" size={18} color={colors.white} />
            </PressableScale>
          </View>
          <View style={styles.photoActions}>
            <PressableScale style={styles.photoBtn} onPress={() => pickFrom('gallery')}>
              <Ionicons name="images" size={16} color={colors.blue} />
              <Text style={styles.photoBtnText}>Galeria</Text>
            </PressableScale>
            <PressableScale style={styles.photoBtn} onPress={() => pickFrom('camera')}>
              <Ionicons name="camera" size={16} color={colors.blue} />
              <Text style={styles.photoBtnText}>Tirar foto</Text>
            </PressableScale>
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <Text style={styles.h}>Ou escolha um avatar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
            {PRESET_AVATARS.map((uri) => (
              <PressableScale key={uri} sound="select" onPress={() => setAvatar(uri)} style={{ marginRight: spacing.sm }}>
                <Avatar uri={uri} size={52} ring={avatar === uri ? colors.primary : colors.border} />
              </PressableScale>
            ))}
          </ScrollView>
        </FadeInView>

        <FadeInView delay={120}>
          <Text style={styles.h}>Seus dados</Text>
          <Animated.View style={{ transform: [{ translateX: shake }] }}>
            <TextField icon="person" placeholder="Nome completo" value={name} onChangeText={setName} />
            <TextField icon="mail" value={profile?.email ?? ''} editable={false} style={{ color: colors.textMuted }} />
            <TextField
              icon="call"
              placeholder="Telefone (opcional)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(v) => setPhone(maskPhone(v))}
            />
          </Animated.View>
        </FadeInView>

        {isProvider && (
          <FadeInView delay={180}>
            <Text style={styles.h}>Bio profissional</Text>
            <TextInput
              value={bio}
              onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
              multiline
              placeholder="Conte o que você faz, há quanto tempo e seus diferenciais"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.counter}>
              {bio.length}/{BIO_MAX}
            </Text>
          </FadeInView>
        )}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <DuoButton title="Salvar perfil" icon="checkmark" onPress={save} loading={saving} sound="none" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  photoBox: { alignItems: 'center', marginTop: spacing.sm },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.blueLight,
  },
  photoBtnText: { fontWeight: '800', color: colors.blue, fontSize: 13 },
  h: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  input: {
    minHeight: 110,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', marginTop: 4, fontSize: 12, fontWeight: '700', color: colors.textMuted },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
});
