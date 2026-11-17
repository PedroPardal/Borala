import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { feedback } from './feedback';
import { compressPhoto } from './photos';
import { firebaseErrorMessage } from './firebase';
import { t } from '../i18n';

/**
 * Abre a galeria ou a câmera com recorte e devolve a foto já reduzida e comprimida
 * (data URI JPEG, pronta para mostrar e salvar com `savePhoto`), ou null se cancelar.
 * `maxWidth` é a largura máxima em pixels: 512 para foto de perfil, 960 para o portfólio.
 */
export async function pickImage(
  source: 'gallery' | 'camera',
  aspect: [number, number] = [1, 1],
  maxWidth = 512,
): Promise<string | null> {
  // a galeria usa o seletor de fotos do sistema, que não precisa de permissão.
  // Pedir a permissão de "arquivos e mídia" antes bloqueava quem tinha negado ou só liberado algumas fotos.
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      feedback.error();
      Alert.alert(t('photo.permDenied'), t('photo.permCamera'));
      return null;
    }
  }
  // qualidade máxima aqui: a compressão de verdade acontece depois de reduzir o tamanho
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect, quality: 1 };
  let asset: ImagePicker.ImagePickerAsset;
  try {
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets[0]) return null;
    asset = result.assets[0];
  } catch (e) {
    console.warn('[pickImage]', e);
    feedback.error();
    Alert.alert(t('photo.openFailed'), t('photo.tryAgain'));
    return null;
  }
  try {
    return await compressPhoto(asset.uri, asset.width, maxWidth);
  } catch (e) {
    console.warn('[pickImage] compressão', e);
    feedback.error();
    const code = (e as { code?: string }).code;
    Alert.alert(t('photo.openFailed'), firebaseErrorMessage(code ? e : { code: 'photo/process-failed' }));
    return null;
  }
}
