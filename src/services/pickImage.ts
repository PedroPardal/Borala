import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { feedback } from './feedback';

/** Abre a galeria ou a câmera com recorte; devolve a URI local da foto ou null se cancelar. */
export async function pickImage(source: 'gallery' | 'camera', aspect: [number, number] = [1, 1]): Promise<string | null> {
  // a galeria usa o seletor de fotos do sistema, que não precisa de permissão.
  // Pedir a permissão de "arquivos e mídia" antes bloqueava quem tinha negado ou só liberado algumas fotos.
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      feedback.error();
      Alert.alert('Permissão negada', 'Libere o acesso à câmera nas configurações do celular.');
      return null;
    }
  }
  // qualidade 0.6 deixa a foto com poucas centenas de KB, bom para enviar pelo celular
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.6 };
  try {
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    // o Storage aceita até 5 MB por foto
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      feedback.error();
      Alert.alert('Foto muito grande', 'Escolha uma foto de até 5 MB.');
      return null;
    }
    return asset.uri;
  } catch (e) {
    console.warn('[pickImage]', e);
    feedback.error();
    Alert.alert('Não foi possível abrir as fotos', 'Tente de novo.');
    return null;
  }
}
