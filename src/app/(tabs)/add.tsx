import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import VenueForm from '../../components/forms/VenueForm';
import PostForm from '../../components/forms/PostForm';
import EventForm from '../../components/forms/EventForm';
import QuestionForm from '../../components/forms/QuestionForm';
import MomentCapture from '../../components/forms/MomentCapture';
import ScreenHeader from '../../components/ui/ScreenHeader';
import GlassView from '../../components/ui/GlassView';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';

type TabMode = 'venue' | 'post' | 'meetup' | 'question' | 'moment';

const TAB_OPTIONS = [
  { key: 'venue' as TabMode, label: 'Mekan', icon: 'restaurant' as const },
  { key: 'post' as TabMode, label: 'Keşif', icon: 'camera' as const },
  { key: 'meetup' as TabMode, label: 'Buluşma', icon: 'people' as const },
  { key: 'question' as TabMode, label: 'Soru', icon: 'help-circle' as const },
  { key: 'moment' as TabMode, label: 'Anlık', icon: 'flash' as const },
];

const INDICATOR_SPRING = { damping: 20, stiffness: 300 };

export default function AddScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabMode>('venue');
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Sliding indicator state
  const indicatorLeft = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const tabLayouts = React.useRef<Record<string, { x: number; width: number }>>({});

  const indicatorStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: indicatorLeft.value,
    width: indicatorWidth.value,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  }));

  const handleTabLayout = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      tabLayouts.current[key] = { x, width };
      // Initialize indicator position for the default active tab
      if (key === 'venue' && indicatorWidth.value === 0) {
        indicatorLeft.value = x;
        indicatorWidth.value = width;
      }
    },
    [indicatorLeft, indicatorWidth],
  );

  const handleTabPress = useCallback(
    (key: TabMode) => {
      haptic.selection();
      setActiveTab(key);
      const layout = tabLayouts.current[key];
      if (layout) {
        indicatorLeft.value = withSpring(layout.x, INDICATOR_SPRING);
        indicatorWidth.value = withSpring(layout.width, INDICATOR_SPRING);
      }
    },
    [indicatorLeft, indicatorWidth],
  );

  // Auth Guard
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={['top']}>
        <View style={styles.authGuard}>
          <View style={[styles.authIconCircle, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="restaurant-outline" size={44} color={Colors.primary} />
          </View>
          <Text style={[styles.authTitle, { color: colors.text }]}>Giriş Yap</Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            Mekan eklemek veya gönderi paylaşmak için{'\n'}hesabınıza giriş yapın.
          </Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
            <Text style={styles.authButtonText}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderSegmentControl = useCallback(() => {
    const inner = (
      <View style={styles.segmentInner}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentScroll}
        >
          <View style={styles.segmentTrack}>
            {/* Sliding indicator behind active tab */}
            <Animated.View style={indicatorStyle} />

            {TAB_OPTIONS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={styles.segmentChip}
                onPress={() => handleTabPress(tab.key)}
                onLayout={handleTabLayout(tab.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={activeTab === tab.key ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentChipText,
                    activeTab === tab.key
                      ? styles.segmentChipTextActive
                      : { color: colors.textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );

    if (Platform.OS === 'ios') {
      return (
        <GlassView
          style={[styles.segmentWrapper, { backgroundColor: 'transparent' }]}
          blurIntensity={60}
        >
          {inner}
        </GlassView>
      );
    }

    return (
      <View style={[styles.segmentWrapper, { backgroundColor: colors.backgroundSecondary }]}>
        {inner}
      </View>
    );
  }, [activeTab, colors, indicatorStyle, handleTabLayout, handleTabPress]);

  const renderActiveForm = useCallback(() => {
    const formContent =
      activeTab === 'venue' ? (
        <VenueForm user={user} />
      ) : activeTab === 'meetup' ? (
        <EventForm user={user} />
      ) : activeTab === 'question' ? (
        <QuestionForm user={user} />
      ) : activeTab === 'moment' ? (
        <MomentCapture user={user} />
      ) : (
        <PostForm user={user} />
      );

    return (
      <Animated.View
        key={activeTab}
        entering={FadeIn.duration(200)}
        style={styles.flex}
      >
        {formContent}
      </Animated.View>
    );
  }, [activeTab, user]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Yeni Ekle" />

        {/* Segment Control — glass on iOS, with animated sliding indicator */}
        {renderSegmentControl()}

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderActiveForm()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  flex: {
    flex: 1,
  },
  segmentWrapper: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  segmentInner: {
    flex: 1,
  },
  segmentScroll: {
    paddingHorizontal: Spacing.lg,
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: Spacing.sm,
    position: 'relative',
  },
  segmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    zIndex: 1,
  },
  segmentChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  segmentChipTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 60,
  },
  authGuard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl + 8,
  },
  authIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  authTitle: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.heading,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  authSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  authButtonText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
});
