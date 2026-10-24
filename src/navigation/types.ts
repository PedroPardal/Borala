import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PaymentMethod } from '../types';

export type ClientTabParamList = {
  Home: undefined;
  Orders: undefined;
  Messages: undefined;
  ClientProfile: undefined;
};

export type ProviderTabParamList = {
  Dashboard: undefined;
  Requests: undefined;
  Messages: undefined;
  ProviderSettings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  ClientTabs: NavigatorScreenParams<ClientTabParamList>;
  ProviderTabs: NavigatorScreenParams<ProviderTabParamList>;
  ProviderDetails: { providerId: string };
  Schedule: { providerId: string; serviceId: string };
  Checkout: { providerId: string; serviceId: string; date: string; time: string };
  BookingSuccess: { bookingId: string; payment: PaymentMethod };
  Chat: { conversationId: string };
  Review: { bookingId: string };
  EditProfile: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
