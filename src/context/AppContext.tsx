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
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Address,
  Booking,
  BookingStatus,
  CategoryId,
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
import { requireOnline, useOnline } from '../services/network';
import { clearOfflineSnapshot, loadOfflineSnapshot, saveOfflineSnapshot } from '../services/offlineCache';
import { toISODate } from '../utils/format';

interface Session {
  uid: string;
  role: UserRole;
  name: string;
  email: string;
}

type ProfilePatch = Partial<Pick<UserProfile, 'name' | 'phone' | 'avatar' | 'addresses' | 'cpf'>>;

export interface NewBooking {
  provider: Provider;
  service: PriceItem;
  date: string;
  time: string;
  address: string;
  payment: PaymentMethod;
  price: number;
  platformFee: number;
  notes?: string;
}

/** Tudo o que o cadastro com o Mélo coleta (veja screens/auth/OnboardingScreen). */
export interface OnboardingData {
  role: UserRole;
  name: string;
  email: string;
  password: string;
  phone: string;
  cpf?: string;
  birthDate?: string;
  address?: Address;
  provider?: {
    bio: string;
    categories: CategoryId[];
    /** fotos locais (do seletor); são enviadas ao Storage depois de criar a conta */
    avatarUri?: string;
    service: { title: string; price: number; unit: string; photoUri: string };
  };
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
  /** cria a conta, envia as fotos e grava perfil (e perfil de prestador) de uma vez */
  completeSignUp: (d: OnboardingData) => Promise<{ photosFailed: boolean }>;
  /** true do fim do cadastro até a pessoa sair da tela de comemoração do Mélo */
  onboardingHold: boolean;
  releaseOnboarding: () => void;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** troca a conta entre contratar (cliente) e divulgar serviços (prestador) */
  switchRole: (next: UserRole) => Promise<void>;

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
  /** cliente reporta um problema: o pedido não é concluído automaticamente e o repasse fica parado */
  reportProblem: (b: Booking) => Promise<void>;

  addReview: (b: Booking, rating: number, comment: string) => Promise<void>;

  conversations: Conversation[];
  getOrCreateConversation: (parties: ConversationParties) => Promise<string>;
  sendMessage: (conv: Conversation, text: string) => Promise<void>;

  /** há internet agora */
  online: boolean;
  /** quando os pedidos foram sincronizados com o servidor pela última vez (ms) */
  lastSync: number | null;
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
  const [lastSync, setLastSync] = useState<number | null>(null);
  const online = useOnline();
  // durante o cadastro o perfil ainda está sendo gravado; não criar um perfil padrão por cima
  const signingUp = useRef(false);
  // o que já chegou do Firestore nesta sessão; a cópia salva no aparelho nunca passa por cima disso
  const live = useRef({ profile: false, providers: false, bookings: false, conversations: false });

  const uid = authUser?.uid;
  const role = profile?.role;

  // abre com a última cópia salva no aparelho (funciona sem internet)
  useEffect(() => {
    live.current = { profile: false, providers: false, bookings: false, conversations: false };
    setLastSync(null);
    if (!uid) return;
    let cancelled = false;
    loadOfflineSnapshot(uid).then((saved) => {
      if (cancelled || !saved) return;
      if (!live.current.profile && saved.profile) setProfile(saved.profile);
      if (!live.current.providers) setRawProviders(saved.providers ?? []);
      if (!live.current.bookings) {
        setBookings(saved.bookings ?? []);
        setLastSync(saved.syncedAt ?? null);
      }
      if (!live.current.conversations) setConversations(saved.conversations ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // guarda a cópia sempre que algo muda (com um pequeno atraso para juntar várias mudanças)
  useEffect(() => {
    if (!uid || !profile || profile.id !== uid) return;
    const t = setTimeout(() => {
      saveOfflineSnapshot(uid, { profile, providers: rawProviders, bookings, conversations, syncedAt: lastSync });
    }, 800);
    return () => clearTimeout(t);
  }, [uid, profile, rawProviders, bookings, conversations, lastSync]);

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
          live.current.profile = true;
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
      (snap) => {
        // sem internet ao abrir, o Firestore responde "vazio" do cache em memória: manter a cópia salva
        if (snap.metadata.fromCache && snap.empty) return;
        live.current.providers = true;
        setRawProviders(snap.docs.map((d) => withId<Provider>(d.id, d.data())));
      },
      onListenError,
    );
  }, [uid]);

  // pedidos em que sou cliente ou prestador
  const lastRole = useRef(role);
  useEffect(() => {
    if (!uid || !role) {
      setBookings([]);
      return;
    }
    // trocou de modo: os pedidos do modo anterior não valem mais
    if (lastRole.current && lastRole.current !== role) {
      live.current.bookings = false;
      setBookings([]);
    }
    lastRole.current = role;
    const q = query(collection(fb.db, 'bookings'), where(role === 'client' ? 'clientId' : 'providerId', '==', uid));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.fromCache && snap.empty) return;
        live.current.bookings = true;
        setBookings(snap.docs.map((d) => withId<Booking>(d.id, d.data())));
        if (!snap.metadata.fromCache) setLastSync(Date.now());
      },
      onListenError,
    );
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
      (snap) => {
        if (snap.metadata.fromCache && snap.empty) return;
        live.current.conversations = true;
        setConversations(
          snap.docs.map((d) => withId<Conversation>(d.id, d.data())).sort((a, b) => b.updatedAt - a.updatedAt),
        );
      },
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

  const [onboardingHold, setOnboardingHold] = useState(false);
  const releaseOnboarding = useCallback(() => setOnboardingHold(false), []);

  const completeSignUp = useCallback<AppContextValue['completeSignUp']>(async (d) => {
    requireOnline();
    signingUp.current = true;
    // segura a tela do Mélo mesmo depois que o perfil existir, para mostrar a comemoração
    setOnboardingHold(true);
    try {
      const email = d.email.trim();
      // numa nova tentativa (ex.: a gravação falhou), o login com esse e-mail já pode existir
      const current = fb.auth.currentUser;
      const user =
        current && current.email?.toLowerCase() === email.toLowerCase()
          ? current
          : (await createUserWithEmailAndPassword(fb.auth, email, d.password)).user;
      const id = user.uid;

      // fotos: se falharem, a conta é criada assim mesmo e a pessoa troca depois no perfil
      let photosFailed = false;
      const upload = async (name: string, uri?: string) => {
        if (!uri) return '';
        try {
          return await uploadUserImage(id, name, uri);
        } catch (e) {
          console.warn('[cadastro] falha ao enviar foto', e);
          photosFailed = true;
          return '';
        }
      };
      const [avatar, servicePhoto] = await Promise.all([
        upload('avatar', d.provider?.avatarUri),
        upload('servico-s1', d.provider?.service.photoUri),
      ]);

      const now = Date.now();
      const batch = writeBatch(fb.db);
      batch.set(doc(fb.db, 'users', id), {
        role: d.role,
        name: d.name,
        email,
        phone: d.phone,
        cpf: d.cpf,
        birthDate: d.birthDate,
        avatar,
        addresses: d.address ? [d.address] : [],
        createdAt: now,
      });
      if (d.role === 'provider' && d.provider) {
        const { service } = d.provider;
        const provider: Omit<Provider, 'id' | 'distanceKm'> = {
          name: d.name,
          avatar,
          bio: d.provider.bio,
          categories: d.provider.categories,
          rating: 0,
          reviewsCount: 0,
          basePrice: service.price,
          radiusKm: 10,
          completedJobs: 0,
          priceTable: [{ id: 's1', title: service.title, price: service.price, unit: service.unit, photo: servicePhoto || undefined }],
          portfolio: [],
          availability: defaultAvailability,
          online: true,
          location: null,
          createdAt: now,
        };
        batch.set(doc(fb.db, 'providers', id), provider);
      }
      await batch.commit();
      return { photosFailed };
    } catch (e) {
      setOnboardingHold(false);
      throw e;
    } finally {
      signingUp.current = false;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(fb.auth, email.trim());
  }, []);

  const signOut = useCallback(async () => {
    setMyLocation(null);
    // a cópia offline tem dados pessoais: não deixar no aparelho depois de sair
    if (uid) await clearOfflineSnapshot(uid);
    await fbSignOut(fb.auth);
  }, [uid]);

  const switchRole = useCallback(
    async (next: UserRole) => {
      if (!uid || !profile || profile.role === next) return;
      requireOnline();
      const batch = writeBatch(fb.db);
      batch.update(doc(fb.db, 'users', uid), { role: next });
      if (next === 'provider') {
        // primeira vez como prestador: cria o perfil público (vazio até ele cadastrar os serviços)
        const providerRef = doc(fb.db, 'providers', uid);
        const existing = await getDoc(providerRef);
        if (!existing.exists()) {
          const provider: Omit<Provider, 'id' | 'distanceKm'> = {
            name: profile.name,
            avatar: profile.avatar,
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
            createdAt: Date.now(),
          };
          batch.set(providerRef, provider);
        }
      }
      await batch.commit();
    },
    [uid, profile],
  );

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
      requireOnline();
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
      requireOnline();
      // campos calculados ou controlados pelas avaliações nunca são gravados pelo dono
      const {
        id: _id,
        distanceKm: _d,
        rating: _r,
        reviewsCount: _c,
        completedJobs: _j,
        blockedForDebt: _b,
        acceptsOnlinePayment: _o,
        ...data
      } = patch;
      await updateDoc(doc(fb.db, 'providers', uid), data);
    },
    [uid],
  );

  // ---- pedidos ----

  const createBooking = useCallback(
    async (b: NewBooking) => {
      if (!uid || !profile) throw new Error('Sem login');
      requireOnline();
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
        servicePrice: b.service.price,
        platformFee: b.platformFee,
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
      requireOnline();
      const batch = writeBatch(fb.db);
      batch.update(doc(fb.db, 'bookings', b.id), { status });
      // recusado ou cancelado libera o horário; o estorno do Pix/cartão e o contador de serviços
      // concluídos ficam com a Cloud Function onBookingUpdated
      if (status === 'recusado' || status === 'cancelado') {
        batch.delete(doc(fb.db, 'busySlots', `${b.providerId}_${b.date}_${b.time}`));
      }
      await batch.commit();
    },
    [],
  );

  const reportProblem = useCallback(async (b: Booking) => {
    requireOnline();
    await updateDoc(doc(fb.db, 'bookings', b.id), { disputed: true });
  }, []);

  const addReview = useCallback(
    async (b: Booking, rating: number, comment: string) => {
      if (!uid || !profile) return;
      requireOnline();
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
    requireOnline();
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
      requireOnline();
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
      // durante o cadastro com o Mélo a conta existe antes do perfil: não mostrar a tela de carregamento
      // (ela desmontaria o cadastro e perderia o passo da comemoração)
      initializing: !authResolved || (!!uid && !profile && !onboardingHold),
      session,
      profile,
      signIn,
      completeSignUp,
      onboardingHold,
      releaseOnboarding,
      resetPassword,
      signOut,
      switchRole,
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
      reportProblem,
      addReview,
      conversations,
      getOrCreateConversation,
      sendMessage,
      online,
      lastSync,
    }),
    [
      online,
      lastSync,
      authResolved,
      uid,
      session,
      profile,
      signIn,
      completeSignUp,
      onboardingHold,
      releaseOnboarding,
      resetPassword,
      signOut,
      switchRole,
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
      reportProblem,
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
