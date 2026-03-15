import React from 'react';
import { View, StyleSheet, Platform, Pressable, Text, type LayoutChangeEvent } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, FontFamily } from '../../lib/constants';
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
  withSequence,
  withDelay,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

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
// Pill-shaped active indicator dimensions (iOS 26 Liquid Glass)
const PILL_WIDTH = 66;
const PILL_COLOR = 'rgba(226, 55, 68, 0.12)';
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
    rotation.value = withSpring(isFocused ? 45 : 0, { damping: 14, stiffness: 120, mass: 0.8 });
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
// Liquid Glass sliding indicator — single pill that slides between tabs
// ---------------------------------------------------------------------------

// Spring for the horizontal slide
const SLIDE_SPRING = { damping: 20, stiffness: 350, mass: 0.4 };
// Spring for the blob stretch effect
const STRETCH_SPRING = { damping: 22, stiffness: 400, mass: 0.4 };
// Spring for the pill contracting back
const CONTRACT_SPRING = { damping: 18, stiffness: 300, mass: 0.5 };
// Spring for icon/label transitions
const ICON_SPRING = { damping: 18, stiffness: 250, mass: 0.4 };

// Non-add tabs in render order (left 2, right 2)
const VISIBLE_TABS = TABS.filter((t) => !t.isAdd);

interface TabLayout {
  x: number;
  width: number;
}

// ---------------------------------------------------------------------------
// Tab item (no per-tab pill — just icon + label with crossfade)
// ---------------------------------------------------------------------------

interface GlassTabItemProps {
  tab: TabDef;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  color: string;
  badge?: number;
  onTabLayout: (e: LayoutChangeEvent) => void;
}

function GlassTabItem({ tab, isFocused, onPress, onLongPress, color, badge, onTabLayout }: GlassTabItemProps) {
  const progress = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, ICON_SPRING);
  }, [isFocused]);

  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0.5, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 0.5, 1], [0.5, 1.12, 1.05]) }],
  }));

  const outlineIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [1, 0.3, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 0.5, 1], [1, 0.9, 0.5]) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.4, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 0.5, 1], [6, -1, 0]) },
      { scale: interpolate(progress.value, [0, 0.5, 1], [0.8, 1.02, 1]) },
    ],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onLayout={onTabLayout}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      style={iosStyles.tabItem}
    >
      <View style={iosStyles.tabItemInner}>
        <View style={iosStyles.iconContainer}>
          <Animated.View style={[iosStyles.iconLayer, outlineIconStyle]}>
            <Ionicons name={tab.iconOutline} size={23} color={color} />
          </Animated.View>
          <Animated.View style={[iosStyles.iconLayer, activeIconStyle]}>
            <Ionicons name={tab.iconFocused} size={23} color={color} />
          </Animated.View>
          {badge != null && badge > 0 && (
            <View style={iosStyles.badge}>
              <Text style={iosStyles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>

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
// Custom floating glass tab bar (iOS) — sliding liquid pill
// ---------------------------------------------------------------------------

const FloatingGlassTabBar = React.memo(function FloatingGlassTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const totalUnreadCount = useMessageStore((s) => s.totalUnreadCount);
  const fetchUnreadCount = useMessageStore((s) => s.fetchUnreadCount);
  const authUser = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (authUser) fetchUnreadCount(authUser.id);
  }, [authUser?.id]);

  const addTab = TABS.find((t) => t.isAdd)!;
  const leftTabs = VISIBLE_TABS.slice(0, 2);
  const rightTabs = VISIBLE_TABS.slice(2);

  // --- Tab position measurement ---
  const tabLayouts = React.useRef<Record<string, TabLayout>>({});
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(PILL_WIDTH);
  const pillScale = useSharedValue(1);
  const pillOpacity = useSharedValue(1);
  const prevIndex = React.useRef(state.index);
  const initialised = React.useRef(false);
  const isDragging = useSharedValue(false);
  const dragStartX = useSharedValue(0);

  const findRouteIndex = (name: string) =>
    state.routes.findIndex((r: any) => r.name === name);

  // Map route index → visible tab name
  const routeNameForIndex = (idx: number): string | undefined =>
    state.routes[idx]?.name;

  // Get sorted tab center positions (only visible tabs, not "add")
  const getTabCenters = (): { name: string; centerX: number }[] => {
    return VISIBLE_TABS
      .map((t) => {
        const layout = tabLayouts.current[t.name];
        if (!layout) return null;
        return { name: t.name, centerX: layout.x + layout.width / 2 };
      })
      .filter(Boolean) as { name: string; centerX: number }[];
  };

  // Find nearest tab to a given x position
  const findNearestTab = (x: number): string | null => {
    const centers = getTabCenters();
    if (centers.length === 0) return null;
    let nearest = centers[0];
    let minDist = Math.abs(x - centers[0].centerX);
    for (let i = 1; i < centers.length; i++) {
      const dist = Math.abs(x - centers[i].centerX);
      if (dist < minDist) {
        minDist = dist;
        nearest = centers[i];
      }
    }
    return nearest.name;
  };

  // Navigate to a tab by name (called from worklet via runOnJS)
  const navigateToTab = React.useCallback((name: string) => {
    haptic.light();
    const idx = findRouteIndex(name);
    const route = state.routes[idx];
    if (state.index !== idx) {
      navigation.navigate(route.name, route.params);
    }
  }, [state.routes, state.index, navigation]);

  // Snap pill to nearest tab (called from worklet via runOnJS)
  const snapToNearestTab = React.useCallback((currentPillCenter: number) => {
    const name = findNearestTab(currentPillCenter);
    if (name) {
      const layout = tabLayouts.current[name];
      if (layout) {
        pillX.value = withSpring(
          layout.x + (layout.width - PILL_WIDTH) / 2,
          SLIDE_SPRING,
        );
        // Settle pulse
        pillScale.value = withSequence(
          withSpring(1.04, { damping: 14, stiffness: 300, mass: 0.5 }),
          withSpring(1.0, { damping: 16, stiffness: 200, mass: 0.6 }),
        );
        pillWidth.value = withSpring(PILL_WIDTH, CONTRACT_SPRING);
        navigateToTab(name);
      }
    }
  }, [navigateToTab]);

  // --- Pan gesture for dragging the pill ---
  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8]) // Must drag 8px horizontally before activating
    .onStart(() => {
      isDragging.value = true;
      dragStartX.value = pillX.value;
    })
    .onUpdate((e) => {
      // Move pill directly with finger
      pillX.value = dragStartX.value + e.translationX;
      // Slight stretch while dragging
      const speed = Math.abs(e.velocityX);
      const stretch = Math.min(speed / 2000, 0.15);
      pillWidth.value = PILL_WIDTH + PILL_WIDTH * stretch;
    })
    .onEnd((e) => {
      isDragging.value = false;
      // Snap to nearest tab based on pill center position
      const pillCenter = pillX.value + PILL_WIDTH / 2;
      runOnJS(snapToNearestTab)(pillCenter);
    });

  // When active tab changes (from tap), slide the pill
  React.useEffect(() => {
    // Skip if currently dragging
    if (isDragging.value) return;

    const name = routeNameForIndex(state.index);
    if (!name) return;
    const layout = tabLayouts.current[name];
    if (!layout) return;

    const targetX = layout.x + (layout.width - PILL_WIDTH) / 2;

    // If the tab is the "add" tab, hide the pill
    if (name === 'add') {
      pillOpacity.value = withSpring(0, ICON_SPRING);
      prevIndex.current = state.index;
      return;
    }

    // Show pill if coming from add tab
    pillOpacity.value = withSpring(1, ICON_SPRING);

    if (!initialised.current) {
      pillX.value = targetX;
      initialised.current = true;
      prevIndex.current = state.index;
      return;
    }

    const prevName = routeNameForIndex(prevIndex.current);
    const prevLayout = prevName ? tabLayouts.current[prevName] : null;

    if (prevLayout && prevName !== 'add') {
      pillScale.value = withSequence(
        withSpring(1.06, { damping: 12, stiffness: 300, mass: 0.5 }),
        withSpring(1.0, { damping: 14, stiffness: 200, mass: 0.6 }),
      );
    }

    pillX.value = withSpring(targetX, SLIDE_SPRING);
    prevIndex.current = state.index;
  }, [state.index]);

  // Animated pill style
  const slidingPillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pillX.value },
      { scaleY: pillScale.value },
    ],
    width: pillWidth.value,
    opacity: pillOpacity.value,
  }));

  const handleTabLayout = React.useCallback((tabName: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    tabLayouts.current[tabName] = { x, width };

    const activeName = routeNameForIndex(state.index);
    if (tabName === activeName && !initialised.current) {
      pillX.value = x + (width - PILL_WIDTH) / 2;
      initialised.current = true;
    }
  }, [state.index]);

  const handlePress = React.useCallback((name: string) => {
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
  }, [state.routes, state.index, navigation]);

  const handleLongPress = React.useCallback((name: string) => {
    const idx = findRouteIndex(name);
    navigation.emit({
      type: 'tabLongPress',
      target: state.routes[idx].key,
    });
  }, [state.routes, navigation]);

  const renderTab = React.useCallback((tab: TabDef) => {
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
        badge={badge}
        onTabLayout={handleTabLayout(tab.name)}
      />
    );
  }, [state.index, colors, totalUnreadCount, handleTabLayout]);

  return (
    <View
      style={[
        iosStyles.floatingWrapper,
        { bottom: Math.max(insets.bottom, Spacing.sm) },
      ]}
      pointerEvents="box-none"
    >
      <View style={iosStyles.addButtonOverlay} pointerEvents="box-none">
        <AddButton
          isFocused={state.index === findRouteIndex(addTab.name)}
          onPress={() => handlePress(addTab.name)}
          onLongPress={() => handleLongPress(addTab.name)}
          isDark={isDark}
        />
      </View>

      <GestureDetector gesture={panGesture}>
        <GlassView
          style={[iosStyles.glassBar, { borderColor: colors.glass.border }]}
          interactive
        >
          <View style={iosStyles.tabRow}>
            {/* Sliding liquid glass pill — single shared indicator */}
            <Animated.View
              style={[
                iosStyles.slidingPill,
                {
                  backgroundColor: isDark ? 'rgba(226, 55, 68, 0.18)' : PILL_COLOR,
                  borderColor: isDark ? 'rgba(226, 55, 68, 0.12)' : 'rgba(226, 55, 68, 0.08)',
                },
                slidingPillStyle,
              ]}
            />

            {leftTabs.map(renderTab)}
            <View style={iosStyles.centerSpacer} onLayout={handleTabLayout('add')} />
            {rightTabs.map(renderTab)}
          </View>
        </GlassView>
      </GestureDetector>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

const AndroidUnreadBadge = React.memo(function AndroidUnreadBadge() {
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
});

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
  slidingPill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#E23744',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
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
