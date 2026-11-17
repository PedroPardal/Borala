import React from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { colors } from '../theme';
import { usePhotoUri } from '../services/photos';

/** Imagem que aceita as fotos salvas no Firestore ("photo:{id}"), links https e fotos recém-escolhidas. */
export default function Photo({ uri, style }: { uri?: string | null; style?: StyleProp<ImageStyle> }) {
  const resolved = usePhotoUri(uri);
  if (!resolved) return <View style={[{ backgroundColor: colors.border }, style as object]} />;
  return <Image source={{ uri: resolved }} style={[{ backgroundColor: colors.border }, style]} />;
}
