import React from 'react';
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
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
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
  { name: 'feed', title: 'Keşfet', iconFocused: 'compass', iconOutline: 'compass-outline' as IoniconsName },
  { name: 'add', title: '', iconFocused: 'add', iconOutline: 'add', isAdd: true },
  { name: 'profile', title: 'Profil', iconFocused: 'person', iconOutline: 'person-outline' as IoniconsName },
];

const SPRING_CONFIG = { damping: 15, stiffness: 180, mass: 0.7 };
const ADD_BUTTON_SIZE = 56;
const ADD_BUTTON_LIFT = 22;

// ---------------------------------------------------------------------------
// Elevated center "+" button with gradient & glow
// ---------------------------------------------------------------------------

function AddButton({ isFocused, onPress, onLongPress, isDark }: {
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  isDark: boolean;
}) {
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (isFocused) {
      rotation.value = withSpring(45, { damping: 12, stiffness: 150 });
      scale.value = withSpring(1.08, SPRING_CONFIG);
      ringOpacity.value = withTiming(0, { duration: 200 });
    } else {
      rotation.value = withSpring(0, { damping: 12, stiffness: 150 });
      scale.value = withSpring(1, SPRING_CONFIG);
      // Subtle pulse ring when not focused
      ringOpacity.value = withDelay(500, withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1500, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      ));
      ringScale.value = withDelay(500, withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 0 }),
        ),
        -1,
        false,
      ));
    }
  }, [isFocused, rotation, scale, ringOpacity, ringScale]);

  const buttonAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  const pulseRingAnim = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <View style={iosStyles.addButtonArea}>
      {/* Pulse ring */}
      <Animated.View
        style={[
          iosStyles.pulseRing,
          pulseRingAnim,
          { borderColor: Colors.primary },
        ]}
      />
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel="Ekle"
        accessibilityState={isFocused ? { selected: true } : {}}
      >
        <Animated.View style={buttonAnim}>
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
}

function GlassTabItem({ tab, isFocused, onPress, onLongPress, color, isDark }: GlassTabItemProps) {
  const scale = useSharedValue(isFocused ? 1 : 0);
  const iconY = useSharedValue(isFocused ? -2 : 0);

  React.useEffect(() => {
    scale.value = withSpring(isFocused ? 1 : 0, SPRING_CONFIG);
    iconY.value = withSpring(isFocused ? -2 : 0, SPRING_CONFIG);
  }, [isFocused, scale, iconY]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: scale.value,
    transform: [{ scale: scale.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconY.value }],
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
        <Animated.View style={iconAnimStyle}>
          <Ionicons
            name={isFocused ? tab.iconFocused : tab.iconOutline}
            size={23}
            color={color}
          />
        </Animated.View>
        {tab.title ? (
          <Text
            style={[
              iosStyles.label,
              { color, fontWeight: isFocused ? '700' : '500' },
            ]}
            numberOfLines={1}
          >
            {tab.title}
          </Text>
        ) : null}
        {/* Active dot indicator */}
        <Animated.View
          style={[
            iosStyles.activeDot,
            { backgroundColor: Colors.primary },
            dotStyle,
          ]}
        />
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

  // Split tabs: left side, center (add), right side
  const leftTabs = TABS.filter((t) => !t.isAdd).slice(0, 2);
  const addTab = TABS.find((t) => t.isAdd)!;
  const rightTabs = TABS.filter((t) => !t.isAdd).slice(2);

  const findRouteIndex = (name: string) =>
    state.routes.findIndex((r: any) => r.name === name);

  const handlePress = (name: string) => {
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

  return (
    <View
      style={[
        iosStyles.floatingWrapper,
        { bottom: Math.max(insets.bottom, Spacing.sm) },
      ]}
      pointerEvents="box-none"
    >
      {/* Elevated add button — sits above the glass bar */}
      <View style={iosStyles.addButtonPositioner}>
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
        effect="regular"
      >
        <View style={iosStyles.tabRow}>
          {/* Left tabs */}
          {leftTabs.map((tab) => {
            const idx = findRouteIndex(tab.name);
            const isFocused = state.index === idx;
            const color = isFocused ? colors.primary : colors.textTertiary;
            return (
              <GlassTabItem
                key={tab.name}
                tab={tab}
                isFocused={isFocused}
                onPress={() => handlePress(tab.name)}
                onLongPress={() => handleLongPress(tab.name)}
                color={color}
                isDark={isDark}
              />
            );
          })}

          {/* Center spacer for elevated button */}
          <View style={iosStyles.centerSpacer} />

          {/* Right tabs */}
          {rightTabs.map((tab) => {
            const idx = findRouteIndex(tab.name);
            const isFocused = state.index === idx;
            const color = isFocused ? colors.primary : colors.textTertiary;
            return (
              <GlassTabItem
                key={tab.name}
                tab={tab}
                isFocused={isFocused}
                onPress={() => handlePress(tab.name)}
                onLongPress={() => handleLongPress(tab.name)}
                color={color}
                isDark={isDark}
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
  addButtonPositioner: {
    position: 'absolute',
    alignSelf: 'center',
    top: -ADD_BUTTON_LIFT,
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
    borderRadius: BorderRadius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glass.border,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
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
    minHeight: 40,
    gap: 3,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  label: {
    fontSize: FontSize.xs,
    letterSpacing: 0.3,
    marginTop: 1,
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
