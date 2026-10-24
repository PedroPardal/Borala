import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ProviderTabParamList } from './types';
import TabIcon from './TabIcon';
import { useTabScreenOptions } from './tabOptions';
import DashboardScreen from '../screens/provider/DashboardScreen';
import RequestsScreen from '../screens/provider/RequestsScreen';
import ConversationsScreen from '../screens/shared/ConversationsScreen';
import ProviderSettingsScreen from '../screens/provider/ProviderSettingsScreen';
import { feedback } from '../services/feedback';
import { useApp } from '../context/AppContext';

const Tab = createBottomTabNavigator<ProviderTabParamList>();

export default function ProviderTabs() {
  const screenOptions = useTabScreenOptions();
  const { bookings } = useApp();
  const pending = bookings.filter((b) => b.status === 'pendente').length;

  return (
    <Tab.Navigator screenOptions={screenOptions} screenListeners={{ tabPress: () => feedback.select() }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={({ navigation }) => ({ title: 'Painel', tabBarIcon: () => <TabIcon name="stats-chart" focused={navigation.isFocused()} /> })}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={({ navigation }) => ({
          title: 'Solicitações',
          tabBarIcon: () => <TabIcon name="notifications" focused={navigation.isFocused()} badge={pending} />,
        })}
      />
      <Tab.Screen
        name="Messages"
        component={ConversationsScreen}
        options={({ navigation }) => ({ title: 'Mensagens', tabBarIcon: () => <TabIcon name="chatbubbles" focused={navigation.isFocused()} /> })}
      />
      <Tab.Screen
        name="ProviderSettings"
        component={ProviderSettingsScreen}
        options={({ navigation }) => ({ title: 'Perfil', tabBarIcon: () => <TabIcon name="person" focused={navigation.isFocused()} /> })}
      />
    </Tab.Navigator>
  );
}
