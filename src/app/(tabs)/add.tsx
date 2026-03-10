import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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
import { useThemeColors } from '../../hooks/useThemeColors';

type TabMode = 'venue' | 'post' | 'meetup' | 'question' | 'moment';

const TAB_OPTIONS = [
  { key: 'venue' as TabMode, label: 'Mekan', icon: 'restaurant' as const },
  { key: 'post' as TabMode, label: 'Kesif', icon: 'camera' as const },
  { key: 'meetup' as TabMode, label: 'Bulusma', icon: 'people' as const },
  { key: 'question' as TabMode, label: 'Soru', icon: 'help-circle' as const },
  { key: 'moment' as TabMode, label: 'Anlik', icon: 'flash' as const },
];

export default function AddScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabMode>('venue');
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Auth Guard
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={['top']}>
        <View style={styles.authGuard}>
          <View style={[styles.authIconCircle, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="restaurant-outline" size={44} color={Colors.primary} />
          </View>
          <Text style={[styles.authTitle, { color: colors.text }]}>Giris Yap</Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            Mekan eklemek veya gonderi paylasmak icin{'\n'}hesabiniza giris yapin.
          </Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
            <Text style={styles.authButtonText}>Giris Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Yeni Ekle" />

        {/* Segment Control — horizontal scrollable chips */}
        <View style={[styles.segmentWrapper, { backgroundColor: colors.backgroundSecondary }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.segmentScroll}
          >
            {TAB_OPTIONS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.segmentChip, activeTab === tab.key && styles.segmentChipActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={activeTab === tab.key ? '#FFFFFF' : colors.textSecondary}
                />
                <Text style={[styles.segmentChipText, activeTab === tab.key && styles.segmentChipTextActive, activeTab !== tab.key && { color: colors.textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'venue' ? (
            <VenueForm user={user} />
          ) : activeTab === 'meetup' ? (
            <EventForm user={user} />
          ) : activeTab === 'question' ? (
            <QuestionForm user={user} />
          ) : activeTab === 'moment' ? (
            <MomentCapture user={user} />
          ) : (
            <PostForm user={user} />
          )}
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
  segmentScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  segmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
