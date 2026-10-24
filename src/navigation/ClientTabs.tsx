import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClientTabParamList } from './types';
import TabIcon from './TabIcon';
import { useTabScreenOptions } from './tabOptions';
import HomeScreen from '../screens/client/HomeScreen';
import OrdersScreen from '../screens/client/OrdersScreen';
import ConversationsScreen from '../screens/shared/ConversationsScreen';
import ClientProfileScreen from '../screens/client/ClientProfileScreen';
import { feedback } from '../services/feedback';

const Tab = createBottomTabNavigator<ClientTabParamList>();

export default function ClientTabs() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tab.Navigator screenOptions={screenOptions} screenListeners={{ tabPress: () => feedback.select() }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({ title: 'Explorar', tabBarIcon: () => <TabIcon name="compass" focused={navigation.isFocused()} /> })}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={({ navigation }) => ({ title: 'Pedidos', tabBarIcon: () => <TabIcon name="receipt" focused={navigation.isFocused()} /> })}
      />
      <Tab.Screen
        name="Messages"
        component={ConversationsScreen}
        options={({ navigation }) => ({ title: 'Mensagens', tabBarIcon: () => <TabIcon name="chatbubbles" focused={navigation.isFocused()} /> })}
      />
      <Tab.Screen
        name="ClientProfile"
        component={ClientProfileScreen}
        options={({ navigation }) => ({ title: 'Perfil', tabBarIcon: () => <TabIcon name="person" focused={navigation.isFocused()} /> })}
      />
    </Tab.Navigator>
  );
}
