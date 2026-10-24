export type UserRole = 'client' | 'provider';

export type CategoryId =
  | 'entregas'
  | 'fretes'
  | 'limpeza'
  | 'reparos'
  | 'jardinagem'
  | 'beleza'
  | 'pets'
  | 'tecnologia'
  | 'aulas';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string; // nome do ícone Ionicons
  color: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
}

export interface PriceItem {
  id: string;
  title: string;
  price: number;
  unit: string; // ex: "por hora", "por m²"
}

export interface PortfolioItem {
  id: string;
  title: string;
  before: string;
  after: string;
}

/** reviews/{bookingId}: uma avaliação por pedido */
export interface Review {
  id: string;
  providerId: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  rating: number;
  comment: string;
  date: string; // ISO
}

export interface WeeklySlot {
  day: number; // 0 = domingo
  slots: string[]; // "08:00"
}

/** providers/{uid}: perfil público do prestador (qualquer usuário logado lê) */
export interface Provider {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  categories: CategoryId[];
  rating: number;
  reviewsCount: number;
  basePrice: number;
  radiusKm: number;
  completedJobs: number;
  priceTable: PriceItem[];
  portfolio: PortfolioItem[];
  availability: WeeklySlot[];
  online: boolean;
  location?: GeoPoint | null;
  area?: string; // "Bairro, Cidade"
  createdAt: number;
  /** calculada no aparelho a partir da localização do cliente */
  distanceKm?: number;
}

/** users/{uid}: dados privados da conta (só o dono lê) */
export interface UserProfile {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  avatar: string;
  addresses: Address[];
  createdAt: number;
}

export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro';

export type BookingStatus = 'pendente' | 'aceito' | 'recusado' | 'concluido';

/** bookings/{id}: guarda cópia de nome/foto das duas partes para as listas */
export interface Booking {
  id: string;
  providerId: string;
  providerName: string;
  providerAvatar: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  serviceId: string;
  serviceTitle: string;
  date: string; // ISO (yyyy-mm-dd)
  time: string; // "09:00"
  address: string;
  payment: PaymentMethod;
  price: number;
  status: BookingStatus;
  reviewed: boolean;
  notes?: string;
  createdAt: number;
}

/** conversations/{clientId}_{providerId}/messages/{id} */
export interface ChatMessage {
  id: string;
  from: UserRole;
  senderId: string;
  text: string;
  createdAt: number;
}

/** conversations/{clientId}_{providerId} */
export interface Conversation {
  id: string;
  clientId: string;
  providerId: string;
  participants: string[];
  clientName: string;
  clientAvatar: string;
  providerName: string;
  providerAvatar: string;
  lastMessage?: { text: string; senderId: string; createdAt: number };
  updatedAt: number;
}
