import React from 'react';
import { View, StyleSheet, Platform, Pressable, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, FontFamily, SpringConfig } from '../../lib/constants';
import { haptic } from '../../lib/haptics';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassView from '../../components/ui/GlassView';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

type IoniconsName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------------------
// Tab definitions
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
  { name: 'feed', title: 'Akis', iconFocused: 'chatbubbles', iconOutline: 'chatbubbles-outline' as IoniconsName },
  { name: 'add', title: '', iconFocused: 'add', iconOutline: 'add', isAdd: true },
  { name: 'messages', title: 'Mesajlar', iconFocused: 'mail', iconOutline: 'mail-outline' as IoniconsName },
  { name: 'profile', title: 'Profil', iconFocused: 'person', iconOutline: 'person-outline' as IoniconsName },
];

const ADD_BUTTON_SIZE = 56;
const ADD_BUTTON_LIFT = 18;
const CENTER_SPACER_WIDTH = ADD_BUTTON_SIZE + 4;

// Pill-shaped active indicator dimensions (iOS 26 Liquid Glass)
const PILL_WIDTH = 56;
const PILL_HEIGHT = 36;
const PILL_COLOR = 'rgba(226, 55, 68, 0.12)';
const PILL_SPRING = { damping: 20, stiffness: 300 };

// ---------------------------------------------------------------------------
// Elevated center "+" button with gradient & glow
// ---------------------------------------------------------------------------

function AddButton({ isFocused, onPress, onLongPress, isDark }: {
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  isDark: boolean;
}) {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withSpring(isFocused ? 45 : 0, SpringConfig.snappy);
  }, [isFocused]);

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={iosStyles.addButtonArea}>
      <Pressable
        onPress={() => { haptic.medium(); onPress(); }}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel="Ekle"
        accessibilityState={isFocused ? { selected: true } : {}}
      >
        <Animated.View style={rotateStyle}>
          <LinearGradient
            colors={[Colors.gradientStart, Colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={iosStyles.addGradient}
          >
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Regular tab item with animated indicator
// ---------------------------------------------------------------------------

interface GlassTabItemProps {
  tab: TabDef;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  color: string;
  isDark: boolean;
  badge?: number;
}

function GlassTabItem({ tab, isFocused, onPress, onLongPress, color, isDark, badge }: GlassTabItemProps) {
  // Shared value: 0 = inactive, 1 = active
  const progress = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, PILL_SPRING);
  }, [isFocused, progress]);

  // Pill-shaped background indicator
  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.6, 1]),
    transform: [
      { scaleX: interpolate(progress.value, [0, 1], [0.4, 1]) },
      { scaleY: interpolate(progress.value, [0, 1], [0.4, 1]) },
    ],
  }));

  // Active (filled) icon: fades in + scales up
  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.8, 1.1]) },
    ],
  }));

  // Outline icon: fades out
  const outlineIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 0.8]) },
    ],
  }));

  // Label: only visible on active tab (iOS 26 style)
  const labelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [4, 0]) },
    ],
  }));

  if (tab.isAdd) return null; // handled separately

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
        {/* Pill-shaped active background */}
        <Animated.View
          style={[
            iosStyles.pillIndicator,
            { backgroundColor: isDark ? 'rgba(226, 55, 68, 0.18)' : PILL_COLOR },
            pillStyle,
          ]}
        />

        {/* Icon container with crossfade */}
        <View style={iosStyles.iconContainer}>
          {/* Outline icon (inactive) */}
          <Animated.View style={[iosStyles.iconLayer, outlineIconStyle]}>
            <Ionicons name={tab.iconOutline} size={23} color={color} />
          </Animated.View>
          {/* Filled icon (active) */}
          <Animated.View style={[iosStyles.iconLayer, activeIconStyle]}>
            <Ionicons name={tab.iconFocused} size={23} color={color} />
          </Animated.View>
          {/* Badge overlay */}
          {badge != null && badge > 0 && (
            <View style={[iosStyles.badge, { borderColor: isDark ? '#121212' : '#FFFFFF' }]}>
              <Text style={iosStyles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>

        {/* Label: hidden on inactive tabs (iOS 26 style) */}
        {tab.title ? (
          <Animated.Text
            style={[
              iosStyles.label,
              { color, fontFamily: isFocused ? FontFamily.headingBold : FontFamily.bodyMedium },
              labelStyle,
            ]}
            numberOfLines={1}
          >
            {tab.title}
          </Animated.Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Custom floating glass tab bar (iOS)
// ---------------------------------------------------------------------------

function FloatingGlassTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const totalUnreadCount = useMessageStore((s) => s.totalUnreadCount);
  const fetchUnreadCount = useMessageStore((s) => s.fetchUnreadCount);
  const authUser = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (authUser) fetchUnreadCount(authUser.id);
  }, [authUser?.id]);

  // Split tabs: left side, center (add), right side
  const leftTabs = TABS.filter((t) => !t.isAdd).slice(0, 2);
  const addTab = TABS.find((t) => t.isAdd)!;
  const rightTabs = TABS.filter((t) => !t.isAdd).slice(2);

  const findRouteIndex = (name: string) =>
    state.routes.findIndex((r: any) => r.name === name);

  const handlePress = (name: string) => {
    haptic.light();
    const idx = findRouteIndex(name);
    const route = state.routes[idx];
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (state.index !== idx && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const handleLongPress = (name: string) => {
    const idx = findRouteIndex(name);
    navigation.emit({
      type: 'tabLongPress',
      target: state.routes[idx].key,
    });
  };

  const renderTab = (tab: TabDef) => {
    const idx = findRouteIndex(tab.name);
    const isFocused = state.index === idx;
    const color = isFocused ? colors.primary : colors.textTertiary;
    const badge = tab.name === 'messages' ? totalUnreadCount : undefined;
    return (
      <GlassTabItem
        key={tab.name}
        tab={tab}
        isFocused={isFocused}
        onPress={() => handlePress(tab.name)}
        onLongPress={() => handleLongPress(tab.name)}
        color={color}
        isDark={isDark}
        badge={badge}
      />
    );
  };

  return (
    <View
      style={[
        iosStyles.floatingWrapper,
        { bottom: Math.max(insets.bottom, Spacing.sm) },
      ]}
      pointerEvents="box-none"
    >
      {/* + button overlay — absolutely centered, outside GlassView */}
      <View style={iosStyles.addButtonOverlay} pointerEvents="box-none">
        <AddButton
          isFocused={state.index === findRouteIndex(addTab.name)}
          onPress={() => handlePress(addTab.name)}
          onLongPress={() => handleLongPress(addTab.name)}
          isDark={isDark}
        />
      </View>

      {/* Glass bar */}
      <GlassView
        style={[iosStyles.glassBar, { borderColor: colors.glass.border }]}
        interactive
      >
        <View style={iosStyles.tabRow}>
          {leftTabs.map(renderTab)}
          <View style={iosStyles.centerSpacer} />
          {rightTabs.map(renderTab)}
        </View>
      </GlassView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

function AndroidUnreadBadge() {
  const count = useMessageStore((s) => s.totalUnreadCount);
  const authUser = useAuthStore((s) => s.user);
  const fetchUnreadCount = useMessageStore((s) => s.fetchUnreadCount);
  const colors = useThemeColors();

  React.useEffect(() => {
    if (authUser) fetchUnreadCount(authUser.id);
  }, [authUser?.id]);

  if (!count || count <= 0) return null;
  return (
    <View style={[iosStyles.badge, { borderColor: colors.background }]}>
      <Text style={iosStyles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

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
          title: 'Akis',
          tabBarIcon: ({ color, focused }) => (
            <View style={androidStyles.tabIconWrap}>
              <Ionicons
                name={focused ? 'chatbubbles' : ('chatbubbles-outline' as IoniconsName)}
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

      {/* ---- Messages ---- */}
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mesajlar',
          tabBarIcon: ({ color, focused }) => (
            <View style={androidStyles.tabIconWrap}>
              <View>
                <Ionicons
                  name={focused ? 'mail' : ('mail-outline' as IoniconsName)}
                  size={22}
                  color={color}
                />
                <AndroidUnreadBadge />
              </View>
              {focused && (
                <View style={[androidStyles.activeIndicator, { backgroundColor: color }]} />
              )}
            </View>
          ),
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
  addButtonOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -ADD_BUTTON_LIFT,
    alignItems: 'center',
    zIndex: 10,
  },
  addButtonArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ADD_BUTTON_SIZE + 20,
    height: ADD_BUTTON_SIZE + 20,
  },
  pulseRing: {
    position: 'absolute',
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,
    borderRadius: ADD_BUTTON_SIZE / 2,
    borderWidth: 2,
  },
  addGradient: {
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,
    borderRadius: ADD_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },
  glassBar: {
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glass.border,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centerSpacer: {
    width: ADD_BUTTON_SIZE + 8,
  },
  tabSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
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
    minHeight: 44,
    gap: 2,
  },
  pillIndicator: {
    position: 'absolute',
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: 9999,
    top: 0,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.xs,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
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
