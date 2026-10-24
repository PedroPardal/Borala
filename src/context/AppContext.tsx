import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Booking,
  BookingStatus,
  Conversation,
  GeoPoint,
  PaymentMethod,
  PriceItem,
  Provider,
  UserProfile,
  UserRole,
} from '../types';
import { defaultAvailability } from '../data/categories';
import { fb, isFirebaseConfigured } from '../services/firebase';
import { uploadUserImage } from '../services/uploads';
import { distanceKm, getCurrentPosition } from '../services/geo';
import { toISODate } from '../utils/format';

interface Session {
  uid: string;
  role: UserRole;
  name: string;
  email: string;
}

type ProfilePatch = Partial<Pick<UserProfile, 'name' | 'phone' | 'avatar' | 'addresses'>>;

export interface NewBooking {
  provider: Provider;
  service: PriceItem;
  date: string;
  time: string;
  address: string;
  payment: PaymentMethod;
  price: number;
  notes?: string;
}

type ConversationParties = Pick<
  Conversation,
  'clientId' | 'providerId' | 'clientName' | 'clientAvatar' | 'providerName' | 'providerAvatar'
>;

interface AppContextValue {
  /** true enquanto descobre se há login salvo e carrega o perfil */
  initializing: boolean;
  session: Session | null;
  profile: UserProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (p: { role: UserRole; name: string; email: string; password: string }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;

  updateProfile: (patch: ProfilePatch) => Promise<void>;
  /** envia uma foto local para o Storage da conta e devolve a URL */
  uploadImage: (name: string, localUri: string) => Promise<string>;

  myLocation: GeoPoint | null;
  refreshLocation: () => Promise<GeoPoint | null>;

  providers: Provider[];
  loggedProvider: Provider | null;
  updateLoggedProvider: (patch: Partial<Provider>) => Promise<void>;
  getProvider: (id: string) => Provider | undefined;

  bookings: Booking[];
  createBooking: (b: NewBooking) => Promise<string>;
  setBookingStatus: (b: Booking, status: BookingStatus) => Promise<void>;

  addReview: (b: Booking, rating: number, comment: string) => Promise<void>;

  conversations: Conversation[];
  getOrCreateConversation: (parties: ConversationParties) => Promise<string>;
  sendMessage: (conv: Conversation, text: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const withId = <T,>(id: string, data: object) => ({ ...data, id }) as T;

/** Avisa uma vez por sessão quando as regras do Firestore bloqueiam a leitura (regras não publicadas). */
let warnedRules = false;
function onListenError(e: { code?: string }) {
  console.warn('[firestore]', e);
  if (e.code === 'permission-denied' && !warnedRules) {
    warnedRules = true;
    Alert.alert('Sem permissão no banco', 'Publique as regras do arquivo firestore.rules no Console do Firebase.');
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(!isFirebaseConfigured);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rawProviders, setRawProviders] = useState<Provider[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [myLocation, setMyLocation] = useState<GeoPoint | null>(null);
  // durante o cadastro o perfil ainda está sendo gravado; não criar um perfil padrão por cima
  const signingUp = useRef(false);

  const uid = authUser?.uid;
  const role = profile?.role;

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(fb.auth, (u) => {
      setAuthUser(u);
      setAuthResolved(true);
    });
  }, []);

  // perfil privado da conta
  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const ref = doc(fb.db, 'users', uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile(withId<UserProfile>(snap.id, snap.data()));
        } else if (!snap.metadata.fromCache && !signingUp.current) {
          // conta criada fora do app (ex.: pelo console): vira cliente com perfil vazio
          const email = authUser?.email ?? '';
          setDoc(ref, { role: 'client', name: email.split('@')[0], email, avatar: '', addresses: [], createdAt: Date.now() }).catch(
            onListenError,
          );
        }
      },
      onListenError,
    );
  }, [uid, authUser?.email]);

  // prestadores (perfis públicos)
  useEffect(() => {
    if (!uid) {
      setRawProviders([]);
      return;
    }
    return onSnapshot(
      collection(fb.db, 'providers'),
      (snap) => setRawProviders(snap.docs.map((d) => withId<Provider>(d.id, d.data()))),
      onListenError,
    );
  }, [uid]);

  // pedidos em que sou cliente ou prestador
  useEffect(() => {
    if (!uid || !role) {
      setBookings([]);
      return;
    }
    const q = query(collection(fb.db, 'bookings'), where(role === 'client' ? 'clientId' : 'providerId', '==', uid));
    return onSnapshot(q, (snap) => setBookings(snap.docs.map((d) => withId<Booking>(d.id, d.data()))), onListenError);
  }, [uid, role]);

  // conversas em que participo, mais recentes primeiro
  useEffect(() => {
    if (!uid) {
      setConversations([]);
      return;
    }
    const q = query(collection(fb.db, 'conversations'), where('participants', 'array-contains', uid));
    return onSnapshot(
      q,
      (snap) =>
        setConversations(
          snap.docs.map((d) => withId<Conversation>(d.id, d.data())).sort((a, b) => b.updatedAt - a.updatedAt),
        ),
      onListenError,
    );
  }, [uid]);

  const refreshLocation = useCallback(async () => {
    const p = await getCurrentPosition();
    if (p) setMyLocation(p);
    return p;
  }, []);

  // clientes veem a distância até cada prestador
  useEffect(() => {
    if (role === 'client') refreshLocation();
  }, [role, refreshLocation]);

  const providers = useMemo(
    () =>
      rawProviders.map((p) => ({
        ...p,
        distanceKm: myLocation && p.location ? distanceKm(myLocation, p.location) : undefined,
      })),
    [rawProviders, myLocation],
  );

  const getProvider = useCallback((id: string) => providers.find((p) => p.id === id), [providers]);
  const loggedProvider = (role === 'provider' && uid && providers.find((p) => p.id === uid)) || null;

  const session: Session | null = useMemo(
    () => (uid && profile ? { uid, role: profile.role, name: profile.name, email: profile.email } : null),
    [uid, profile],
  );

  // ---- conta ----

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(fb.auth, email.trim(), password);
  }, []);

  const signUp = useCallback<AppContextValue['signUp']>(async ({ role: newRole, name, email, password }) => {
    signingUp.current = true;
    try {
      const cred = await createUserWithEmailAndPassword(fb.auth, email.trim(), password);
      const id = cred.user.uid;
      const now = Date.now();
      const batch = writeBatch(fb.db);
      batch.set(doc(fb.db, 'users', id), { role: newRole, name, email: email.trim(), avatar: '', addresses: [], createdAt: now });
      if (newRole === 'provider') {
        const provider: Omit<Provider, 'id' | 'distanceKm'> = {
          name,
          avatar: '',
          bio: '',
          categories: [],
          rating: 0,
          reviewsCount: 0,
          basePrice: 0,
          radiusKm: 10,
          completedJobs: 0,
          priceTable: [],
          portfolio: [],
          availability: defaultAvailability,
          online: true,
          location: null,
          createdAt: now,
        };
        batch.set(doc(fb.db, 'providers', id), provider);
      }
      await batch.commit();
    } finally {
      signingUp.current = false;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(fb.auth, email.trim());
  }, []);

  const signOut = useCallback(async () => {
    setMyLocation(null);
    await fbSignOut(fb.auth);
  }, []);

  const uploadImage = useCallback(
    (name: string, localUri: string) => {
      if (!uid) throw new Error('Sem login');
      return uploadUserImage(uid, name, localUri);
    },
    [uid],
  );

  /** Pedidos e conversas guardam cópia do meu nome/foto; atualiza todos de uma vez. */
  const syncIdentityCopies = useCallback(
    async (name: string, avatar: string) => {
      if (!uid || !role) return;
      const keys = role === 'client' ? { name: 'clientName', avatar: 'clientAvatar' } : { name: 'providerName', avatar: 'providerAvatar' };
      const data = { [keys.name]: name, [keys.avatar]: avatar };
      const refs = [
        ...bookings.map((b) => doc(fb.db, 'bookings', b.id)),
        ...conversations.map((c) => doc(fb.db, 'conversations', c.id)),
      ];
      // writeBatch aceita até 500 operações
      for (let i = 0; i < refs.length; i += 450) {
        const batch = writeBatch(fb.db);
        refs.slice(i, i + 450).forEach((r) => batch.update(r, data));
        await batch.commit();
      }
    },
    [uid, role, bookings, conversations],
  );

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!uid || !profile) return;
      await updateDoc(doc(fb.db, 'users', uid), patch);
      const identityChanged =
        (patch.name !== undefined && patch.name !== profile.name) || (patch.avatar !== undefined && patch.avatar !== profile.avatar);
      if (!identityChanged) return;
      const name = patch.name ?? profile.name;
      const avatar = patch.avatar ?? profile.avatar;
      if (profile.role === 'provider') await updateDoc(doc(fb.db, 'providers', uid), { name, avatar });
      await syncIdentityCopies(name, avatar);
    },
    [uid, profile, syncIdentityCopies],
  );

  const updateLoggedProvider = useCallback(
    async (patch: Partial<Provider>) => {
      if (!uid) return;
      // campos calculados ou controlados pelas avaliações nunca são gravados pelo dono
      const { id: _id, distanceKm: _d, rating: _r, reviewsCount: _c, ...data } = patch;
      await updateDoc(doc(fb.db, 'providers', uid), data);
    },
    [uid],
  );

  // ---- pedidos ----

  const createBooking = useCallback(
    async (b: NewBooking) => {
      if (!uid || !profile) throw new Error('Sem login');
      const bookingRef = doc(collection(fb.db, 'bookings'));
      const booking: Omit<Booking, 'id'> = {
        providerId: b.provider.id,
        providerName: b.provider.name,
        providerAvatar: b.provider.avatar,
        clientId: uid,
        clientName: profile.name,
        clientAvatar: profile.avatar,
        serviceId: b.service.id,
        serviceTitle: b.service.title,
        date: b.date,
        time: b.time,
        address: b.address,
        payment: b.payment,
        price: b.price,
        status: 'pendente',
        reviewed: false,
        notes: b.notes,
        createdAt: Date.now(),
      };
      const batch = writeBatch(fb.db);
      batch.set(bookingRef, booking);
      // o id do horário é único: se outra pessoa reservou antes, as regras recusam o lote inteiro
      batch.set(doc(fb.db, 'busySlots', `${b.provider.id}_${b.date}_${b.time}`), {
        providerId: b.provider.id,
        clientId: uid,
        bookingId: bookingRef.id,
        date: b.date,
        time: b.time,
      });
      await batch.commit();
      return bookingRef.id;
    },
    [uid, profile],
  );

  const setBookingStatus = useCallback(
    async (b: Booking, status: BookingStatus) => {
      const batch = writeBatch(fb.db);
      batch.update(doc(fb.db, 'bookings', b.id), { status });
      if (status === 'recusado') batch.delete(doc(fb.db, 'busySlots', `${b.providerId}_${b.date}_${b.time}`));
      if (status === 'concluido') batch.update(doc(fb.db, 'providers', b.providerId), { completedJobs: increment(1) });
      await batch.commit();
    },
    [],
  );

  const addReview = useCallback(
    async (b: Booking, rating: number, comment: string) => {
      if (!uid || !profile) return;
      const providerRef = doc(fb.db, 'providers', b.providerId);
      await runTransaction(fb.db, async (tx) => {
        const snap = await tx.get(providerRef);
        if (!snap.exists()) throw new Error('Prestador não encontrado');
        const p = snap.data() as Provider;
        const count = p.reviewsCount + 1;
        const avg = Math.round(((p.rating * p.reviewsCount + rating) / count) * 10) / 10;
        tx.set(doc(fb.db, 'reviews', b.id), {
          providerId: b.providerId,
          clientId: uid,
          clientName: profile.name,
          clientAvatar: profile.avatar,
          rating,
          comment,
          date: toISODate(new Date()),
        });
        tx.update(providerRef, { rating: avg, reviewsCount: count, lastReviewId: b.id });
        tx.update(doc(fb.db, 'bookings', b.id), { reviewed: true });
      });
    },
    [uid, profile],
  );

  // ---- chat ----

  const getOrCreateConversation = useCallback(async (p: ConversationParties) => {
    const id = `${p.clientId}_${p.providerId}`;
    const ref = doc(fb.db, 'conversations', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // aceita um Booking inteiro, mas grava só os campos da conversa
      await setDoc(ref, {
        clientId: p.clientId,
        providerId: p.providerId,
        clientName: p.clientName,
        clientAvatar: p.clientAvatar,
        providerName: p.providerName,
        providerAvatar: p.providerAvatar,
        participants: [p.clientId, p.providerId],
        updatedAt: Date.now(),
      });
    }
    return id;
  }, []);

  const sendMessage = useCallback(
    async (conv: Conversation, text: string) => {
      if (!uid || !role) return;
      const createdAt = Date.now();
      const batch = writeBatch(fb.db);
      batch.set(doc(collection(fb.db, 'conversations', conv.id, 'messages')), { from: role, senderId: uid, text, createdAt });
      batch.update(doc(fb.db, 'conversations', conv.id), { lastMessage: { text, senderId: uid, createdAt }, updatedAt: createdAt });
      await batch.commit();
    },
    [uid, role],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      initializing: !authResolved || (!!uid && !profile),
      session,
      profile,
      signIn,
      signUp,
      resetPassword,
      signOut,
      updateProfile,
      uploadImage,
      myLocation,
      refreshLocation,
      providers,
      loggedProvider,
      updateLoggedProvider,
      getProvider,
      bookings,
      createBooking,
      setBookingStatus,
      addReview,
      conversations,
      getOrCreateConversation,
      sendMessage,
    }),
    [
      authResolved,
      uid,
      session,
      profile,
      signIn,
      signUp,
      resetPassword,
      signOut,
      updateProfile,
      uploadImage,
      myLocation,
      refreshLocation,
      providers,
      loggedProvider,
      updateLoggedProvider,
      getProvider,
      bookings,
      createBooking,
      setBookingStatus,
      addReview,
      conversations,
      getOrCreateConversation,
      sendMessage,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de <AppProvider>');
  return ctx;
}
