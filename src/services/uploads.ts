import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { fb } from './firebase';

/** Fotos novas vêm do seletor como arquivo local; as já salvas são URLs https. */
export const isLocalUri = (uri: string) => !!uri && !/^https?:\/\//.test(uri);

/**
 * Lê um arquivo local (file:// ou content://) como Blob.
 * No React Native o `fetch(uri).blob()` falha ou gera um blob vazio em vários Androids,
 * o que fazia o envio da foto de perfil dar erro. O XMLHttpRequest lê o arquivo nativo direto.
 */
function readLocalFile(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(Object.assign(new Error('Não foi possível ler a foto do celular'), { code: 'storage/read-failed' }));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/** Envia uma imagem local para `users/{uid}/{name}.jpg` e devolve a URL pública de download. */
export async function uploadUserImage(uid: string, name: string, localUri: string): Promise<string> {
  const blob = await readLocalFile(localUri);
  try {
    const fileRef = ref(fb.storage, `users/${uid}/${name}.jpg`);
    await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
    // o "v=" muda a URL a cada envio; sem isso o celular continua mostrando a foto antiga do cache
    const url = await getDownloadURL(fileRef);
    return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  } finally {
    // libera a memória do blob nativo
    (blob as Blob & { close?: () => void }).close?.();
  }
}
