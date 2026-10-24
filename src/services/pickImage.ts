import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { feedback } from './feedback';

/** Abre a galeria ou a câmera com recorte; devolve a URI local da foto ou null se cancelar. */
export async function pickImage(source: 'gallery' | 'camera', aspect: [number, number] = [1, 1]): Promise<string | null> {
  const perm =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    feedback.error();
    Alert.alert('Permissão negada', `Libere o acesso à ${source === 'camera' ? 'câmera' : 'galeria'} nas configurações do celular.`);
    return null;
  }
  // qualidade 0.6 deixa a foto com poucas centenas de KB, bom para enviar pelo celular
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.6 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}
