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
  /** ponto marcado no mapa (endereços antigos não têm) */
  location?: GeoPoint;
}

export interface PriceItem {
  id: string;
  title: string;
  price: number;
  unit: string; // ex: "por hora", "por m²"
  /** foto do serviço (URL do Storage) */
  photo?: string;
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
  /** gravado só pela Cloud Function: com comissões acima do limite, o prestador não aceita pedidos em dinheiro */
  blockedForDebt?: boolean;
  /** gravado só pela Cloud Function: o prestador tem conta no Asaas e recebe por Pix e cartão */
  acceptsOnlinePayment?: boolean;
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
  /** exigido pelo Asaas para cobrar por Pix ou cartão */
  cpf?: string;
  /** yyyy-mm-dd; o prestador informa no cadastro (o Asaas pede para a conta de recebimento) */
  birthDate?: string;
  avatar: string;
  addresses: Address[];
  createdAt: number;
}

export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro';

export type BookingStatus = 'pendente' | 'aceito' | 'recusado' | 'concluido' | 'cancelado';

/** Pagamento por Pix ou cartão no Asaas (gravado só pela Cloud Function). */
export type PaymentStatus = 'aguardando' | 'pago' | 'estornado' | 'cancelado';

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
  /** total cobrado do cliente (serviço + taxa da plataforma + acréscimo do cartão) */
  price: number;
  /** valor do serviço que vai para o prestador (pedidos antigos não têm) */
  servicePrice?: number;
  /** comissão da plataforma neste pedido */
  platformFee?: number;
  /** preenchido pela Cloud Function quando um pedido pago no app é concluído */
  payout?: BookingPayout;
  paymentStatus?: PaymentStatus;
  status: BookingStatus;
  /** o cliente reportou um problema: não é concluído automaticamente e o repasse fica parado */
  disputed?: boolean;
  concludedBy?: 'automatico';
  cancelledBy?: 'sem_pagamento';
  reviewed: boolean;
  notes?: string;
  createdAt: number;
}

/** Repasse ao prestador de um pedido pago por Pix ou cartão. */
export interface BookingPayout {
  /** quanto o prestador recebe depois do desconto */
  amount: number;
  /** comissões de serviços em dinheiro descontadas deste repasse */
  debtDeducted: number;
  status: 'pendente' | 'processando' | 'pago' | 'erro';
  createdAt: number;
}

/** O que a Cloud Function createPayment devolve para mostrar a cobrança. */
export interface PaymentView {
  billingType: 'PIX' | 'CREDIT_CARD';
  value: number;
  invoiceUrl: string;
  pixPayload?: string;
  /** PNG em base64 */
  pixImage?: string;
  pixExpiresAt?: string;
}

/** Dados que o Asaas pede para abrir a conta de recebimento do prestador. */
export interface PayoutAccountForm {
  cpfCnpj: string;
  birthDate?: string; // yyyy-mm-dd (pessoa física)
  companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION'; // pessoa jurídica
  mobilePhone: string;
  incomeValue: number;
  postalCode: string;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
}

/** providerBalances/{providerId}: só a Cloud Function grava; o prestador lê o próprio */
export interface ProviderBalance {
  /** comissões de serviços pagos em dinheiro que ainda não foram descontadas */
  cashDebt: number;
  updatedAt: number;
}

/** providerBalances/{providerId}/entries/{id}: histórico do saldo */
export interface BalanceEntry {
  id: string;
  type: 'comissao_dinheiro' | 'desconto_repasse';
  /** positivo aumenta o débito, negativo diminui */
  amount: number;
  bookingId: string;
  serviceTitle: string;
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
