import React, { useCallback } from 'react';
import { View, StyleSheet, Platform, Pressable, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize } from '../../lib/constants';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassView from '../../components/ui/GlassView';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

type IoniconsName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------------------
// Tab definitions shared across platforms
// ---------------------------------------------------------------------------

interface TabDef {
  name: string;
  title: string;
  iconFocused: IoniconsName;
  iconOutline: IoniconsName;
  isAdd?: boolean;
}

const TABS: TabDef[] = [
  { name: 'map', title: 'Harita', iconFocused: 'map', iconOutline: 'map-outline' as IoniconsName },
  { name: 'feed', title: 'Kesfet', iconFocused: 'compass', iconOutline: 'compass-outline' as IoniconsName },
  { name: 'add', title: '', iconFocused: 'add', iconOutline: 'add', isAdd: true },
  { name: 'profile', title: 'Profil', iconFocused: 'person', iconOutline: 'person-outline' as IoniconsName },
];

// ---------------------------------------------------------------------------
// Animated tab item for iOS glass tab bar
// ---------------------------------------------------------------------------

interface GlassTabItemProps {
  tab: TabDef;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  color: string;
}

const SPRING_CONFIG = { damping: 18, stiffness: 200, mass: 0.8 };

function GlassTabItem({ tab, isFocused, onPress, onLongPress, color }: GlassTabItemProps) {
  const scale = useSharedValue(isFocused ? 1 : 0.85);
  const opacity = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    scale.value = withSpring(isFocused ? 1 : 0.85, SPRING_CONFIG);
    opacity.value = withSpring(isFocused ? 1 : 0, SPRING_CONFIG);
  }, [isFocused, scale, opacity]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (tab.isAdd) {
    return (
      <Pressable
        key={tab.name}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        style={iosStyles.tabItem}
      >
        <GlassView
          style={iosStyles.addCircle}
          effect="clear"
          tintColor={Colors.primary}
        >
          <Ionicons name="add" size={26} color={Colors.primary} />
        </GlassView>
      </Pressable>
    );
  }

  return (
    <Pressable
      key={tab.name}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      style={iosStyles.tabItem}
    >
      <View style={iosStyles.tabItemInner}>
        {/* Active pill indicator behind icon */}
        <Animated.View style={[iosStyles.activePill, indicatorStyle]} />
        <Ionicons
          name={isFocused ? tab.iconFocused : tab.iconOutline}
          size={22}
          color={color}
        />
        {tab.title ? (
          <Text
            style={[
              iosStyles.label,
              { color },
            ]}
            numberOfLines={1}
          >
            {tab.title}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Custom floating glass tab bar (iOS only)
// ---------------------------------------------------------------------------

function FloatingGlassTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <View
      style={[
        iosStyles.floatingWrapper,
        { bottom: Math.max(insets.bottom, Spacing.sm) },
      ]}
      pointerEvents="box-none"
    >
      <GlassView style={[iosStyles.glassBar, { borderColor: colors.glass.border }]} effect="regular">
        <View style={iosStyles.tabRow}>
          {state.routes.map((route: any, index: number) => {
            const tab = TABS.find((t) => t.name === route.name);
            if (!tab) return null;

            const isFocused = state.index === index;
            const { options } = descriptors[route.key];

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            const color = isFocused ? colors.primary : colors.textTertiary;

            return (
              <GlassTabItem
                key={route.key}
                tab={tab}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                color={color}
              />
            );
          })}
        </View>
      </GlassView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const colors = useThemeColors();

  const isIOS = Platform.OS === 'ios';

  // On iOS, inject the custom floating glass tab bar
  const tabBarProp = isIOS
    ? { tabBar: (props: any) => <FloatingGlassTabBar {...props} /> }
    : {};

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        // Android keeps the classic opaque tab bar style
        ...(!isIOS && {
          tabBarStyle: [
            androidStyles.tabBar,
            { paddingBottom: bottomPadding, height: 60 + bottomPadding },
            { backgroundColor: colors.background },
          ],
          tabBarLabelStyle: androidStyles.tabBarLabel,
          tabBarItemStyle: androidStyles.tabBarItem,
        }),
      }}
      {...tabBarProp}
    >
      {/* ---- Map ---- */}
      <Tabs.Screen
        name="map"
        options={{
          title: 'Harita',
          tabBarIcon: ({ color, focused }) => (
            <View style={androidStyles.tabIconWrap}>
              <Ionicons
                name={focused ? 'map' : ('map-outline' as IoniconsName)}
                size={22}
                color={color}
              />
              {focused && (
                <View style={[androidStyles.activeIndicator, { backgroundColor: color }]} />
              )}
            </View>
          ),
        }}
      />

      {/* ---- Feed ---- */}
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Kesfet',
          tabBarIcon: ({ color, focused }) => (
            <View style={androidStyles.tabIconWrap}>
              <Ionicons
                name={focused ? 'compass' : ('compass-outline' as IoniconsName)}
                size={22}
                color={color}
              />
              {focused && (
                <View style={[androidStyles.activeIndicator, { backgroundColor: color }]} />
              )}
            </View>
          ),
        }}
      />

      {/* ---- Add ---- */}
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={androidStyles.addButtonOuter}>
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={androidStyles.addButton}
              >
                <Ionicons name="add" size={28} color="#FFFFFF" />
              </LinearGradient>
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />

      {/* ---- Profile ---- */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <View style={androidStyles.tabIconWrap}>
              <Ionicons
                name={focused ? 'person' : ('person-outline' as IoniconsName)}
                size={22}
                color={color}
              />
              {focused && (
                <View style={[androidStyles.activeIndicator, { backgroundColor: color }]} />
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// iOS floating glass tab bar styles
// ---------------------------------------------------------------------------

const iosStyles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
  },
  glassBar: {
    borderRadius: BorderRadius.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glass.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 36,
  },
  activePill: {
    position: 'absolute',
    width: 44,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(226, 55, 68, 0.15)',
    top: -5,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  addCircle: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glass.border,
    overflow: 'hidden',
  },
});

// ---------------------------------------------------------------------------
// Android classic tab bar styles (unchanged from original)
// ---------------------------------------------------------------------------

const androidStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.background,
    borderTopWidth: 0,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 16,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  tabBarItem: {
    paddingTop: 4,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  addButtonOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
