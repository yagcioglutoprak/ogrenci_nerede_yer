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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize } from '../../lib/constants';
import VenueForm from '../../components/forms/VenueForm';
import PostForm from '../../components/forms/PostForm';
import GlassView from '../../components/ui/GlassView';
import { useThemeColors } from '../../hooks/useThemeColors';

type TabMode = 'venue' | 'post';

export default function AddScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabMode>('venue');
  const colors = useThemeColors();

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
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Yeni Ekle</Text>
        </View>

        {/* Segment Control */}
        <View style={[styles.segmentWrapper, { backgroundColor: colors.backgroundSecondary }]}>
          <GlassView style={styles.segmentContainer} fallbackColor={colors.background}>
            <TouchableOpacity
              style={[styles.segmentButton, activeTab === 'venue' && styles.segmentButtonActive]}
              onPress={() => setActiveTab('venue')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="restaurant"
                size={16}
                color={activeTab === 'venue' ? '#FFFFFF' : Colors.textSecondary}
              />
              <Text style={[styles.segmentText, activeTab === 'venue' && styles.segmentTextActive, activeTab !== 'venue' && { color: colors.textSecondary }]}>
                Mekan Ekle
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentButton, activeTab === 'post' && styles.segmentButtonActive]}
              onPress={() => setActiveTab('post')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="camera"
                size={16}
                color={activeTab === 'post' ? '#FFFFFF' : Colors.textSecondary}
              />
              <Text style={[styles.segmentText, activeTab === 'post' && styles.segmentTextActive, activeTab !== 'post' && { color: colors.textSecondary }]}>
                Gonderi Paylas
              </Text>
            </TouchableOpacity>
          </GlassView>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'venue' ? (
            <VenueForm user={user} />
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
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  segmentWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    padding: 3,
    ...(Platform.OS === 'ios'
      ? {}
      : {
          backgroundColor: Colors.background,
          borderWidth: 1,
          borderColor: Colors.border,
        }),
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs + 2,
  },
  segmentButtonActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  segmentText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
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
    fontWeight: '800',
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
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
