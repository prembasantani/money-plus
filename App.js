import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceProvider, useFinance } from './src/context/FinanceContext';
import { DialogProvider } from './src/context/DialogContext';
import RootNavigator from './src/navigation/RootNavigator';

function MainApp() {
  const { theme, themeMode, isLoading } = useFinance();

  if (isLoading) {
    return (
      <View style={[styles.bootLoadingContainer, { backgroundColor: '#0B0F17' }]}>
        <StatusBar style="light" backgroundColor="#0B0F17" />
        <View style={styles.bootLogoBadge}>
          <Ionicons name="wallet" size={32} color="#6366F1" />
        </View>
        <Text style={styles.bootAppName}>Money+</Text>
        <Text style={styles.bootTagline}>Cute Offline Expense Tracker</Text>
        <View style={{ marginTop: 24 }}>
          <ActivityIndicator size="small" color="#6366F1" />
        </View>
      </View>
    );
  }

  const navTheme =
    themeMode === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: theme.background,
            card: theme.tabBg,
            text: theme.text,
            border: theme.tabBorder,
            primary: theme.primary,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: theme.background,
            card: theme.tabBg,
            text: theme.text,
            border: theme.tabBorder,
            primary: theme.primary,
          },
        };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={theme.statusBar} backgroundColor={theme.background} />
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bootLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bootLogoBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  bootAppName: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  bootTagline: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <FinanceProvider>
        <DialogProvider>
          <MainApp />
        </DialogProvider>
      </FinanceProvider>
    </SafeAreaProvider>
  );
}
