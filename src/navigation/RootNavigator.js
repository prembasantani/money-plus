import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../context/FinanceContext';
import DashboardScreen from '../screens/DashboardScreen';
import AccountsScreen from '../screens/AccountsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SyncScreen from '../screens/SyncScreen';
import AdjustScreen from '../screens/AdjustScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function RootNavigator() {
  const insets = useSafeAreaInsets();
  const { theme } = useFinance();

  // Clear Android 3-button system navigation (e.g. ||| O <) or gesture bar with comfortable padding
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10);
  const tabHeight = 60 + bottomInset;

  return (
    <View style={styles.navContainer}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.tabBg,
            borderTopColor: theme.tabBorder,
            borderTopWidth: 2,
            height: tabHeight,
            paddingBottom: bottomInset,
            paddingTop: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.12,
            shadowRadius: 12,
            elevation: 16,
          },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
          },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Dashboard') {
              iconName = focused ? 'wallet' : 'wallet-outline';
            } else if (route.name === 'Accounts') {
              iconName = focused ? 'card' : 'card-outline';
            } else if (route.name === 'Reports') {
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
            } else if (route.name === 'Sync') {
              iconName = focused ? 'flash' : 'flash-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }

            return <Ionicons name={iconName} size={size || 21} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ tabBarLabel: 'Dashboard' }}
        />
        <Tab.Screen
          name="Accounts"
          component={AccountsScreen}
          options={{ tabBarLabel: 'Accounts' }}
        />
        <Tab.Screen
          name="Reports"
          component={ReportsScreen}
          options={{ tabBarLabel: 'Reports' }}
        />
        <Tab.Screen
          name="Sync"
          component={SyncScreen}
          options={{ tabBarLabel: 'SMS Sync' }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarLabel: 'Settings' }}
        />
        <Tab.Screen
          name="Adjust"
          component={AdjustScreen}
          options={{
            tabBarItemStyle: { display: 'none' },
            tabBarButton: () => null,
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    flex: 1,
  },
});
