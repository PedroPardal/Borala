import { useEffect, useState } from 'react';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { fb } from './firebase';

/**
 * Fotos do app (perfil e antes/depois) ficam no próprio Firestore, em `photos/{id}`, como um JPEG
 * pequeno em base64. Assim funcionam no plano gratuito do Firebase: o Storage exige o plano Blaze
 * e era por isso que o envio de fotos falhava.
 *
 * Nos perfis, pedidos e conversas fica só a referência "photo:{id}". O <Photo> e o <Avatar>
 * buscam a imagem quando precisam e guardam na memória enquanto o app está aberto.
 */
const PREFIX = 'photo:';
/** o documento do Firestore aceita até 1 MiB; deixa folga para os outros campos */
const MAX_CHARS = 900_000;
/** limite de fotos guardadas na memória (as mais antigas saem primeiro) */
const MEMORY_LIMIT = 80;

export const isPhotoRef = (uri?: string | null): uri is string => !!uri && uri.startsWith(PREFIX);

/** Foto escolhida agora no celular e ainda não salva (vem como data URI). */
export const isUnsavedPhoto = (uri?: string | null): uri is string => !!uri && uri.startsWith('data:');

const photoError = (code: string) => Object.assign(new Error(code), { code });

/**
 * Redimensiona e comprime a foto escolhida. Devolve um data URI JPEG que já pode ser mostrado
 * na tela e depois salvo com `savePhoto`.
 */
export async function compressPhoto(uri: string, width: number | undefined, maxWidth: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  // sem a largura (alguns Androids não informam) redimensiona sempre
  if (!width || width > maxWidth) ctx.resize({ width: maxWidth });
  const image = await ctx.renderAsync();
  try {
    for (let quality = 0.7; ; quality -= 0.2) {
      const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
      const data = `data:image/jpeg;base64,${out.base64}`;
      if (data.length <= MAX_CHARS) return data;
      if (quality <= 0.3) throw photoError('photo/too-big');
    }
  } finally {
    image.release();
    ctx.release();
  }
}

const memory = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();

function remember(id: string, data: string) {
  memory.delete(id);
  memory.set(id, data);
  if (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value as string);
}

/** Salva a foto (data URI de `compressPhoto`) e devolve a referência para gravar no perfil. */
export async function savePhoto(uid: string, dataUri: string): Promise<string> {
  if (dataUri.length > MAX_CHARS) throw photoError('photo/too-big');
  const id = `${uid}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  try {
    await setDoc(doc(fb.db, 'photos', id), { owner: uid, data: dataUri, createdAt: Date.now() });
  } catch (e) {
    // regra antiga publicada no console, sem a coleção "photos"
    if ((e as { code?: string }).code === 'permission-denied') throw photoError('photo/permission-denied');
    throw e;
  }
  remember(id, dataUri);
  return PREFIX + id;
}

/** Apaga uma foto que saiu do perfil (se falhar, só fica sobrando no banco). */
export function deletePhoto(ref?: string | null) {
  if (!isPhotoRef(ref)) return;
  const id = ref.slice(PREFIX.length);
  memory.delete(id);
  deleteDoc(doc(fb.db, 'photos', id)).catch((e) => console.warn('[photos] não apagou', e));
}

function load(id: string): Promise<string | null> {
  let p = loading.get(id);
  if (!p) {
    p = getDoc(doc(fb.db, 'photos', id))
      .then((snap) => {
        const data = snap.exists() ? (snap.data().data as string) : null;
        if (data) remember(id, data);
        return data;
      })
      .catch((e) => {
        console.warn('[photos] não carregou', e);
        return null;
      })
      .finally(() => loading.delete(id));
    loading.set(id, p);
  }
  return p;
}

/**
 * Transforma o que está salvo no campo de foto em algo que o <Image> mostra:
 * "photo:{id}" vira o data URI; links https e fotos recém-escolhidas passam direto.
 */
export function usePhotoUri(uri?: string | null): string | undefined {
  const id = isPhotoRef(uri) ? uri.slice(PREFIX.length) : null;
  const [resolved, setResolved] = useState<string | undefined>(() => (id ? memory.get(id) : uri || undefined));

  useEffect(() => {
    if (!id) {
      setResolved(uri || undefined);
      return;
    }
    const hit = memory.get(id);
    if (hit) {
      setResolved(hit);
      return;
    }
    setResolved(undefined);
    let alive = true;
    load(id).then((data) => {
      if (alive) setResolved(data ?? undefined);
    });
    return () => {
      alive = false;
    };
  }, [id, uri]);

  return resolved;
}
