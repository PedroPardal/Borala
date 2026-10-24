import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { fb } from './firebase';

/** Fotos novas vêm do seletor como arquivo local; as já salvas são URLs https. */
export const isLocalUri = (uri: string) => !!uri && !/^https?:\/\//.test(uri);

/** Envia uma imagem local para `users/{uid}/{name}.jpg` e devolve a URL pública de download. */
export async function uploadUserImage(uid: string, name: string, localUri: string): Promise<string> {
  const blob = await (await fetch(localUri)).blob();
  const fileRef = ref(fb.storage, `users/${uid}/${name}.jpg`);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(fileRef);
}
