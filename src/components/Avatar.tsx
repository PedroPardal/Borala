import React from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, makeStyles } from '../theme';
import { usePhotoUri } from '../services/photos';

/** Foto redonda com anel; sem foto (ou enquanto carrega), mostra um ícone de pessoa. */
export default function Avatar({ uri, size = 48, ring }: { uri?: string; size?: number; ring?: string }) {
  const resolved = usePhotoUri(uri);
  return (
    <View
      style={[
        styles.wrap,
        { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, borderColor: ring ?? colors.primaryLight },
      ]}
    >
      {resolved ? (
        <Image source={{ uri: resolved }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border }} />
      ) : (
        <View style={[styles.empty, { width: size, height: size, borderRadius: size / 2 }]}>
          <Ionicons name="person" size={size * 0.5} color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  wrap: { borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  empty: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
}));
