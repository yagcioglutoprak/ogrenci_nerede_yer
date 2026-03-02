import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../lib/constants';

type IoniconsName = keyof typeof Ionicons.glyphMap;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: 'Harita',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'map' : ('map-outline' as IoniconsName)}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Kesfet',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'compass' : ('compass-outline' as IoniconsName)}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Ekle',
          tabBarIcon: ({ focused }) => (
            <View style={styles.addButtonOuter}>
              <View style={[styles.addButton, focused && styles.addButtonFocused]}>
                <Ionicons name="add" size={30} color="#FFFFFF" />
              </View>
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : ('person-outline' as IoniconsName)}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 68;

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.background,
    borderTopWidth: 0,
    height: TAB_BAR_HEIGHT,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : Spacing.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 12,
  },
  tabBarLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  tabBarItem: {
    paddingTop: 2,
  },
  addButtonOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  addButtonFocused: {
    backgroundColor: Colors.primaryDark,
    transform: [{ scale: 1.08 }],
  },
});
